// @ts-ignore
import functionArguments from "function-arguments";
import mergeWith from "lodash/mergeWith";
import path from "path";
import isArray from "lodash/isArray";
import { PlatAPIInputParameterRequirement, PlatAPIManagedAPIHandlerConfig, PlatAPIConfig, PlatAPIConfigObject, PlatAPIRoute, PlatAPIManagedAPIHandler } from "./Types";
import castArray from "lodash/castArray";
import fs from "fs";
import isFunction from "lodash/isFunction";
import isString from "lodash/isString";
import defaults from "lodash/defaults";
import { Request } from "express/ts4.0";

const CATCH_ALL_REGEX = /\.{3}(.+)/;
const OPTIONAL_CATCH_ALL_REGEX = /\[\.{3}(.+)]/;

export class Utils {
    static isBrowserRequest(request: Request): boolean {
        if (request.get("sec-fetch-mode")?.toLowerCase() === "navigate") {
            return true;
        }

        if (request.get("user-agent")?.toLowerCase().includes("mozilla")) {
            return true;
        }

        return false;
    }

    static replaceHandlebarAttributesInText(text: string, attributes: { [attributeName: string]: any }): string {
        return Utils.replaceHandlebarsInText(text, (wholeMatch, attributeName) => (attributeName in attributes ? attributes[attributeName] : ""));
    }

    static replaceHandlebarsInText(text: string, replacerFunction: (wholeMatch: string, attributeName: string) => string) {
        return text.replace(/\{\{([^}]+?)\}\}/g, replacerFunction);
    }

    static generateMethodHandler(theObject: any, httpMethod: string): PlatAPIManagedAPIHandler | undefined {
        // Is there a key on this object that contains the
        const handler = theObject[httpMethod.toLowerCase()] ?? theObject[httpMethod.toUpperCase()];

        let handlerConfig: PlatAPIManagedAPIHandlerConfig | undefined;
        let handlerFunction: Function | undefined;

        if (isArray(handler) && (handler as PlatAPIManagedAPIHandler).length >= 2) {
            handlerConfig = { ...(handler as PlatAPIManagedAPIHandler)[0] };
            handlerFunction = (handler as PlatAPIManagedAPIHandler)[1];
        } else if (theObject.__httpMethods?.[httpMethod.toUpperCase()]) {
            handlerFunction = theObject[theObject.__httpMethods?.[httpMethod.toUpperCase()]];
            if (handlerFunction) {
                handlerConfig = Utils.getManagedAPIHandlerConfig(handlerFunction);
            }
        } else if (theObject?.prototype.__httpMethods?.[httpMethod.toUpperCase()]) {
            // This is an instance function which means we need to create an instance of the object
            const objectInstance = new theObject();
            handlerFunction = objectInstance[theObject.prototype.__httpMethods[httpMethod.toUpperCase()]];

            // Bind "this" to the object instance
            //handlerFunction = handlerFunction?.bind(objectInstance); // TODO: this screws with the function parameter names

            if (handlerFunction) {
                handlerConfig = Utils.getManagedAPIHandlerConfig(handlerFunction);
            }
        }

        if (handlerFunction) {
            if (!handlerConfig) {
                handlerConfig = {};
            }

            return [handlerConfig, handlerFunction];
        }
    }

    static getAPIConfig(config?: string | Partial<PlatAPIConfig>): PlatAPIConfigObject {
        let configObject = isString(config) ? undefined : (config as PlatAPIConfigObject | undefined);

        if (!configObject) {
            let configPath = isString(config) ? (config as string) : undefined;

            try {
                configPath = path.resolve(process.cwd(), configPath ?? process.env.API_CONFIG_FILE ?? "api.config.js");

                configObject = require(configPath);
                if (isFunction(config)) {
                    configObject = config();
                }
            } catch (e) {
                // No config file present
            }
        }

        const defaultConfig: PlatAPIConfig = {
            info: {
                title: "My API",
                version: "1.0.0"
            },
            apiRootDirectory: path.resolve(process.cwd(), process.env.API_ROOT_DIRECTORY ?? "./api"),
            apiPort: Number(process.env.API_PORT ?? 3000),
            returnFriendlyResponses: false,
            loadStandardMiddleware: true
        };

        return defaults({}, configObject, defaultConfig);
    }

    static walkFileTree(directory: string, tree: string[] = []): string[] {
        const results: string[] = [];

        for (const fileName of fs.readdirSync(directory)) {
            const filePath = path.join(directory, fileName);
            const fileStats = fs.statSync(filePath);

            if (fileStats.isDirectory()) {
                results.push(...Utils.walkFileTree(filePath, [...tree, filePath]));
            } else {
                results.push(filePath);
            }
        }

        return results;
    }

    static mergeObjects(...values: any[]): any {
        // @ts-ignore
        return mergeWith(...values, (objValue, srcValue) => {
            if (isArray(objValue)) {
                return objValue.concat(srcValue);
            }
        });
    }

    static getFunctionParamNames(fn: Function): string[] {
        const args: string[] = functionArguments(fn);

        return args.map(arg => {
            return arg.replace(/\s*[=].*$/, ""); // Remove any initializers
        });
    }

    public static setManagedAPIHandlerConfig(handler: Function, config: Partial<PlatAPIManagedAPIHandlerConfig>) {
        const handlerConfig = (handler as any).__handler ?? {};
        Utils.mergeObjects(handlerConfig, config);
        (handler as any).__handler = handlerConfig;
    }

    public static getManagedAPIHandlerConfig(handler: Function): PlatAPIManagedAPIHandlerConfig | undefined {
        return (handler as any).__handler;
    }

    public static nextRouteToExpressRoute(filename: string): string {
        return (
            filename
                .replace(/index\..+$/, "") // Remove index.ext from all endpoints
                .replace(/\.[^/.]+$/, "") // Remove file extensions
                .replace(/\[([^/]+)]/g, (fullMatch, paramName) => {
                    if (OPTIONAL_CATCH_ALL_REGEX.test(paramName)) {
                        return paramName.replace(OPTIONAL_CATCH_ALL_REGEX, `:$1([\\w/]+$)?`);
                    } else if (CATCH_ALL_REGEX.test(paramName)) {
                        return paramName.replace(CATCH_ALL_REGEX, `:$1([\\w/]+$)`);
                    }

                    return `:${paramName}`;
                }) // Handle route parameters like [slug]
                // .replace(/\[\[\.{3}(.+?)]]/g, ":$1(.+)?") // Handle optional catch-all routes like [[...slug]]
                // .replace(/\[\.{3}(.+?)]/g, ":$1(.{1,}$)") // Handle catch-all routes like [...slug]
                .replace(/\/$/, "")
        ); // Remove trailing slashes
    }

    public static calculateRoutePriority(route: string): number {
        const parts = route.split("/");
        return parts.reduce((sum, part, index) => {
            let priority = 0;

            if (part.startsWith(":")) {
                priority = parts.length - index;
            }

            return sum + priority;
        }, 0);
    }

    public static generateAPIRoutesFromFiles(rootDirectory: string): PlatAPIRoute[] {
        rootDirectory = path.resolve(rootDirectory);

        try {
            const files = Utils.walkFileTree(rootDirectory);

            return files
                .filter(filename => /.ts$|.js$/.test(filename))
                .map(filename => {
                    let expressRoute = Utils.nextRouteToExpressRoute(filename.replace(rootDirectory, ""));
                    return {
                        endpoint: expressRoute,
                        file: filename
                    };
                })
                .sort((a, b) => Utils.calculateRoutePriority(a.endpoint) - Utils.calculateRoutePriority(b.endpoint));
        } catch (e) {
            return [];
        }
    }

    static getHandlerAndParameterName(target: Object, propertyKey: string | symbol, parameterIndex: number): [Function, string] {
        // @ts-ignore
        const handlerFunction: Function = target[propertyKey];
        const handlerArgNames = Utils.getFunctionParamNames(handlerFunction);
        const parameterName = handlerArgNames[parameterIndex];
        return [handlerFunction, parameterName];
    }

    static generateHTTPMethodDecorator(httpMethod: string): (target: any, propertyKey: string, descriptor: PropertyDescriptor) => void {
        return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
            let httpMethods: { [method: string]: string } = target.__httpMethods;

            if (!httpMethods) {
                httpMethods = {};
                target.__httpMethods = httpMethods;
            }

            httpMethods[httpMethod] = propertyKey;
        };
    }

    static generateMethodDecorator(config: Partial<PlatAPIManagedAPIHandlerConfig>): (target: any, propertyKey: string, descriptor: PropertyDescriptor) => void {
        return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
            // @ts-ignore
            const handlerFunction: Function = target[propertyKey];
            Utils.setManagedAPIHandlerConfig(handlerFunction, config);
        };
    }

    static generateParameterDecorator(requirements: Partial<PlatAPIInputParameterRequirement>): (target: Object, propertyKey: string | symbol, parameterIndex: number) => void {
        return (target: Object, propertyKey: string | symbol, parameterIndex: number) => {
            const [handlerFunction, parameterName] = Utils.getHandlerAndParameterName(target, propertyKey, parameterIndex);
            Utils.setManagedAPIHandlerConfig(handlerFunction, {
                params: {
                    [parameterName]: requirements
                }
            });
        };
    }

    static generateParameterSourceDecorator(
        baseSource: string | string[],
        parameterNameIsPartOfPath: boolean = true,
        autoConvert: boolean = true,
        transformFunction?: (value: any) => any,
        extraConfig?: Partial<PlatAPIManagedAPIHandlerConfig>
    ) {
        return (target: Object, propertyKey: string | symbol, parameterIndex: number) => {
            const [handlerFunction, parameterName] = Utils.getHandlerAndParameterName(target, propertyKey, parameterIndex);

            let source = castArray(baseSource);

            if (parameterNameIsPartOfPath) {
                source = [...source, parameterName];
            }

            Utils.setManagedAPIHandlerConfig(handlerFunction, {
                params: {
                    [parameterName]: {
                        autoConvert: autoConvert,
                        sources: [source],
                        transformFunction: transformFunction
                    }
                }
            });

            if (extraConfig) {
                Utils.setManagedAPIHandlerConfig(handlerFunction, extraConfig);
            }
        };
    }
}
