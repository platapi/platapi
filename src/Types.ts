import type { Logger, LogLevelDesc } from "loglevel";
import type { RequestHandler, Request, Response } from "express";
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

    /**
     * Set this to true if you are connecting the PlatAPI.app instance to a testing framework like Supertest and don't want to spin up an HTTP listener.
     * May also use environment variable of PLATAPI_TESTING=true
     */
    testingMode?: boolean;
}

export type PlatAPIConfig = Partial<PlatAPIConfigObject> | string;

export interface PlatAPIFriendlyResponseSuccess<T = any> {
    this: "succeeded";
    with: any;
}

export interface PlatAPIFriendlyResponseFailure<C extends number = number, T = any> {
    this: "failed";
    with: C;
    because?: T;
    id: string;
}

export interface PlatAPIStandardResponseFailure<C extends number = number, M extends string = string> {
    error: {
        message: M;
        code: C;
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
    requestValidator?: {
        runBeforeMiddleware?: boolean;
        handler: PlatAPIRequestHandler;
    };
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

export interface PlatAPIFriendlyError<S extends number = number, M extends string = string> extends Error {
    statusCode: S;
    friendlyMessage?: M;
    id: string;
}
