// @ts-ignore
import functionArguments from "function-arguments";
import mergeWith from "lodash/mergeWith";
import path from "path";
import isArray from "lodash/isArray";
import { InputParameterRequirement, ManagedAPIHandlerConfig } from "./Types";
import castArray from "lodash/castArray";
import fs from "fs";
import { PlatAPIConfig } from "./PlatAPI";
import isFunction from "lodash/isFunction";

export interface Route {
    endpoint: string;
    file: string;
}

const CATCH_ALL_REGEX = /\.{3}(.+)/;
const OPTIONAL_CATCH_ALL_REGEX = /\[\.{3}(.+)]/;

export class Utils {
    static getAPIConfig(configPath?: string): PlatAPIConfig {
        try {
            configPath = path.resolve(process.cwd(), configPath ?? process.env.API_CONFIG_FILE ?? "api.config.js");

            let config = require(configPath);
            if (isFunction(config)) {
                config = config();
            }
            return config;
        } catch (e) {
            // No config file present
        }

        return {};
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

    static mergeObjects(...values: any[]) {
        // @ts-ignore
        mergeWith(...values, (objValue, srcValue) => {
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

    public static setManagedAPIHandlerConfig(handler: Function, config: Partial<ManagedAPIHandlerConfig>) {
        const handlerConfig = (handler as any).__handler ?? {};
        Utils.mergeObjects(handlerConfig, config);
        (handler as any).__handler = handlerConfig;
    }

    public static getManagedAPIHandlerConfig(handler: Function): ManagedAPIHandlerConfig | undefined {
        return (handler as any).__handler;
    }

    public static nextRouteToExpressRoute(filename: string): string {
        return (
            filename
                .replace(/index\..+$/, "") // Remove index.ext from all endpoints
                .replace(/\.[^/.]+$/, "") // Remove file extensions
                .replace(/\[([^/]+)]/g, (fullMatch, paramName) => {
                    if (OPTIONAL_CATCH_ALL_REGEX.test(paramName)) {
                        return paramName.replace(OPTIONAL_CATCH_ALL_REGEX, ":$1([\\w/]{0,})?");
                    } else if (CATCH_ALL_REGEX.test(paramName)) {
                        return paramName.replace(CATCH_ALL_REGEX, ":$1([\\w/]+)");
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

    public static generateAPIRoutesFromFiles(rootDirectory: string): Route[] {
        rootDirectory = path.resolve(rootDirectory);

        try {
            const files = Utils.walkFileTree(rootDirectory);

            return files
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

    static generateMethodDecorator(config: Partial<ManagedAPIHandlerConfig>): (target: any, propertyKey: string, descriptor: PropertyDescriptor) => void {
        return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
            // @ts-ignore
            const handlerFunction: Function = target[propertyKey];
            Utils.setManagedAPIHandlerConfig(handlerFunction, config);
        };
    }

    static generateParameterDecorator(requirements: Partial<InputParameterRequirement>): (target: Object, propertyKey: string | symbol, parameterIndex: number) => void {
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
        includeFullSource: boolean = false,
        autoConvert: boolean = true
    ): (target: Object, propertyKey: string | symbol, parameterIndex: number) => void {
        return (target: Object, propertyKey: string | symbol, parameterIndex: number) => {
            const [handlerFunction, parameterName] = Utils.getHandlerAndParameterName(target, propertyKey, parameterIndex);

            let source = castArray(baseSource);

            if (!includeFullSource) {
                source = [...source, parameterName];
            }

            Utils.setManagedAPIHandlerConfig(handlerFunction, {
                params: {
                    [parameterName]: {
                        autoConvert: autoConvert,
                        sources: [source]
                    }
                }
            });
        };
    }
}
