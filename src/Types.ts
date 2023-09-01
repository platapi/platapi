import type { Logger, LogLevelDesc } from "loglevel";
import type { RequestHandler, Request, Response } from "express/ts4.0";
import type { InfoObject, OperationObject } from "openapi3-ts/src/model/openapi31";
import type { Express } from "express";
import { SecuritySchemeObject } from "openapi3-ts/dist/model/openapi31";

export interface PlatAPIConfigObject {
    info: InfoObject;

    /**
     * The server port to listen on. Defaults to 3000. May also be set with environment variable API_PORT. This setting is ignored when running on Lambda.
     */
    apiPort: number;

    /**
     * If set to true, standard middleware like body-parser and cookie-parser will be loaded by default. Defaults to true.
     */
    loadStandardMiddleware?: boolean;

    /**
     * List of CORS origins that will be allowed in the request. Wildcards supported.
     */
    corsWhitelist?: string[];

    /**
     * Pass in an existing express app instance.
     */
    app?: Express;

    logLevel?: LogLevelDesc;

    /**
     * Specify a handler function if you want to add any additional information to the logging context for a request. Just modify the passed `context` object with your own data.
     * @param req - The express.js request
     * @param context - The context object you can modify with your own data
     */
    logContextHandler?: (req: Request, context: any) => void;

    routes?: PlatAPIRoute[];

    /**
     * The directory with which to serve API routes. Defaults to "./api". May also be set with environment variable API_ROOT_DIRECTORY.
     */
    apiRootDirectory: string;

    /**
     * Return HAPI responses (https://github.com/jheising/HAPI). Defaults to false.
     */
    returnFriendlyResponses?: boolean;

    binaryMediaTypes?: string[];

    /**
     * An HTML template to use to return nicely formatted API error messages when the user-agent looks like a browser
     */
    browserHTMLErrorTemplate?: string;
}

export type PlatAPIConfig = Partial<PlatAPIConfigObject> | string;

export interface PlatAPIFriendlyResponseSuccess<T = any> {
    this: "succeeded";
    with: any;
}

export interface PlatAPIFriendlyResponseFailure<T = any> {
    this: "failed";
    with: number;
    because?: T;
    id: string;
}

export interface PlatAPIStandardResponseFailure<T = any> {
    error: {
        message: string;
        code: number;
        id: string;
    };
}

export interface PlatAPIInputParameterRequirement {
    required?: boolean;

    /**
     * Try to convert values into typed values, like numbers, objects, arrays, etc.
     * @default false
     */
    autoConvert?: boolean;
    sources?: (string | string[])[];

    transformFunction?: (value: any) => any;
}

export type PlatAPIResponseFormatter = (outputValue: any, statusCode: number, requestID: string, formatForBrowser?: boolean) => any;

export interface PlatAPIManagedAPIHandlerConfig {
    responseContentType?: string;
    responseFormatter?: PlatAPIResponseFormatter;
    middleware?: PlatAPIRequestHandler[];
    params?: PlatAPIInputParameterRequirements;
    docs?: Partial<OperationObject>;
    securitySchemes?: SecuritySchemeObject[];
}

export type PlatAPIInputParameterRequirements = { [paramName: string]: PlatAPIInputParameterRequirement };
export type PlatAPIManagedAPIHandler = [PlatAPIManagedAPIHandlerConfig, Function];
export type PlatAPILogger = Logger;

export interface PlatAPIRequestLocals {
    logger: PlatAPILogger;

    [x: string | number | symbol]: unknown;
}

export type PlatAPIRequest = Request<any, any, any, any, PlatAPIRequestLocals>;
export type PlatAPIResponse = Response<any, PlatAPIRequestLocals>;
export type PlatAPIRequestHandler = RequestHandler<any, any, any, any, PlatAPIRequestLocals>;

export interface PlatAPIRoute {
    endpoint: string;
    file: string;
}

export interface PlatAPIFriendlyError extends Error {
    statusCode: number;
    friendlyMessage?: string;
    id: string;
}
