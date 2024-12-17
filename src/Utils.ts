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
    static convertErrorToObject(error: any): any {
        const errorObject: any = {};

        function getCircularReplacer() {
            const ancestors: any[] = [];
            return function (key: any, value: any) {
                if (typeof value !== "object" || value === null) {
                    return value;
                }
                // `this` is the object that value is contained in,
                // i.e., its direct parent.
                // @ts-ignore
                while (ancestors.length > 0 && ancestors.at(-1) !== this) {
                    ancestors.pop();
                }
                if (ancestors.includes(value)) {
                    return "[Circular]";
                }
                ancestors.push(value);
                return value;
            };
        }

        // Error objects to serialize easily— we have to do it this way.
        Object.getOwnPropertyNames(error).forEach(function (key) {
            errorObject[key] = (error as any)[key];
        }, this);

        // Some error objects contain circular references— we need to break this
        return JSON.parse(JSON.stringify(errorObject, getCircularReplacer()));
    }

    static isBrowserRequest(request: Request): boolean {
        if (request.get("x-requested-with")?.toLowerCase() === "xmlhttprequest") {
            return false;
        }

        if (request.get("sec-fetch-mode")?.toLowerCase() === "navigate") {
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
        // Is there a key on this object that contains the HTTP method
        const handler = theObject[httpMethod.toLowerCase()] ?? theObject[httpMethod.toUpperCase()];

        let handlerConfig: PlatAPIManagedAPIHandlerConfig | undefined;
        let handlerFunction: Function | undefined;

        if (isArray(handler) && (handler as PlatAPIManagedAPIHandler).length >= 2) {
            handlerConfig = { ...(handler as PlatAPIManagedAPIHandler)[0] };
            handlerFunction = (handler as PlatAPIManagedAPIHandler)[1];
        } else {
            let handlerObject: any;
            let httpMethods: { [method: string]: string } | undefined;

            if (theObject.__httpMethods) {
                httpMethods = theObject.__httpMethods;
                handlerObject = theObject;
            } else if (theObject.prototype?.__httpMethods) {
                httpMethods = theObject.prototype.__httpMethods;
                // This is an instance function which means we need to create an instance of the object
                handlerObject = new theObject();
            }

            if (handlerObject && httpMethods) {
                handlerFunction = handlerObject[httpMethods[httpMethod.toUpperCase()]];

                // If we can't find a default HTTP method, look for one that handles ALL
                if (!handlerFunction) {
                    handlerFunction = handlerObject[httpMethods["ALL"]];
                }
            }

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
            configPath = configPath ?? process.env.API_CONFIG_FILE ?? "./api.config.js";

            try {
                configPath = path.resolve(process.cwd(), configPath);

                configObject = require(configPath);

                // @ts-ignore
                if (configObject.default && configObject.__esModule) {
                    // @ts-ignore
                    configObject = configObject.default;
                }

                if (isFunction(config)) {
                    configObject = config();
                }
            } catch (e) {
                throw new Error(`No PlatAPI api.config.js file found. ${(e as Error).message}`);
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
            loadStandardMiddleware: true,
            testingMode: process.env.PLATAPI_TESTING === "true" || process.env.PLATAPI_TESTING === "1"
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
        return filename
            .replace(/index\..+$/, "") // Remove index.ext from all endpoints
            .replace(/\.[^/.]+$/, "") // Remove file extensions
            .replace(/\/\[([^/]+)]/g, (fullMatch, paramName) => {
                if (OPTIONAL_CATCH_ALL_REGEX.test(paramName)) {
                    return paramName.replace(OPTIONAL_CATCH_ALL_REGEX, `{/*$1}`);
                } else if (CATCH_ALL_REGEX.test(paramName)) {
                    return paramName.replace(CATCH_ALL_REGEX, `/*$1`);
                }

                return `/:${paramName}`;
            })
            .replace(/\/$/, ""); // Remove trailing slashes
    }

    public static calculateRoutePriority(route: string): number {
        const parts = route.split("/");
        const result = parts.reduce((sum, part, index) => {
            if (part.startsWith("index.")) {
                sum -= 100;
            } else if (part.startsWith("[[...")) {
                sum -= 100;
            } else if (part.startsWith("[...")) {
                sum -= 2;
            } else if (part.startsWith("[")) {
                sum -= 1;
            }

            return sum;
        }, parts.length * 100);
        return result;
    }

    public static compareRoutes(routeA: string, routeB: string) {
        return Utils.calculateRoutePriority(routeB) - Utils.calculateRoutePriority(routeA);
    }

    public static generateAPIRoutesFromFiles(rootDirectory: string): PlatAPIRoute[] {
        rootDirectory = path.resolve(rootDirectory);

        try {
            const files = Utils.walkFileTree(rootDirectory);

            return files
                .filter(filename => !/^\./.test(filename)) // Filter out hidden files
                .filter(filename => /\.ts$|\.([c|m])?js$/.test(filename)) // Filter typescript and javascript files
                .sort(Utils.compareRoutes)
                .map(filename => {
                    let expressRoute = Utils.nextRouteToExpressRoute(filename.replace(rootDirectory, ""));
                    return {
                        endpoint: expressRoute,
                        file: filename
                    };
                });
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
