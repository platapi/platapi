import { Utils } from "./Utils";
import castArray from "lodash/castArray";
import { PlatAPIRequestHandler, PlatAPIInputParameterRequirement, PlatAPIResponseFormatter } from "./Types";
import { OperationObject } from "openapi3-ts/src/model/openapi31";

/**
 * A method decorator for a POST endpoint
 */
export const POST = Utils.generateHTTPMethodDecorator("POST");

/**
 * A method decorator for a GET endpoint
 */
export const GET = Utils.generateHTTPMethodDecorator("GET");

/**
 * A method decorator for a PUT endpoint
 */
export const PUT = Utils.generateHTTPMethodDecorator("PUT");

/**
 * A method decorator for a PATCH endpoint
 */
export const PATCH = Utils.generateHTTPMethodDecorator("PATCH");

/**
 * A method decorator for a DELETE endpoint
 */
export const DELETE = Utils.generateHTTPMethodDecorator("DELETE");

/**
 * A method decorator for an OPTIONS endpoint
 */
export const OPTIONS = Utils.generateHTTPMethodDecorator("OPTIONS");

/**
 * A method decorator for a HEAD endpoint
 */
export const HEAD = Utils.generateHTTPMethodDecorator("HEAD");

/**
 * A method decorator for a TRACE endpoint
 */
export const TRACE = Utils.generateHTTPMethodDecorator("TRACE");

/**
 * A parameter decorator to extract a value from an HTTP request
 * @param requirements
 * @constructor
 */
export const Param = (requirements: PlatAPIInputParameterRequirement) => {
    return Utils.generateParameterDecorator(requirements);
};

/**
 * A parameter decorator to extract a single value from a JSON body from an HTTP request
 */
export const BodyPart = Utils.generateParameterSourceDecorator(["request", "body"]);

/**
 * A parameter decorator to extract the whole JSON body from an HTTP request
 */
export const Body = Utils.generateParameterSourceDecorator(["request", "body"], false, false);

/**
 * A parameter decorator to extract a single value from a cookie in an HTTP request
 */
export const Cookie = Utils.generateParameterSourceDecorator(["request", "cookies"]);

/**
 * A parameter decorator to extract all cookies from an HTTP request
 */
export const AllCookies = Utils.generateParameterSourceDecorator(["request", "cookies"], false);

/**
 * A parameter decorator to extract a single query parameter from an HTTP request
 */
export const Query = Utils.generateParameterSourceDecorator(["request", "query"]);

/**
 * A parameter decorator to extract all query parameters from an HTTP request
 */
export const AllQuery = Utils.generateParameterSourceDecorator(["request", "query"], false);

/**
 * A parameter decorator to extract a single path parameter from an HTTP request
 */
export const Path = Utils.generateParameterSourceDecorator(["request", "params"]);

/**
 * A parameter decorator to extract all path parameters from an HTTP request
 */
export const AllPath = Utils.generateParameterSourceDecorator(["request", "params"], false);

/**
 * A parameter decorator to extract a single header from an HTTP request
 */
export const Header = Utils.generateParameterSourceDecorator(["request", "headers"]);

/**
 * A parameter decorator to extract all headers from an HTTP request
 */
export const AllHeaders = Utils.generateParameterSourceDecorator(["request", "headers"], false);

/**
 * A parameter decorator to extract a bearer token from an HTTP request
 */
export const BearerToken = Utils.generateParameterSourceDecorator(["request", "headers", "authorization"], false, false, token => {
    return token.replace(/Bearer\s+/i, "");
});

/**
 * A parameter decorator to return the raw Express.js request
 */
export const Request = Utils.generateParameterSourceDecorator("request", false);

/**
 * A parameter decorator to return the raw Express.js response
 */
export const Response = Utils.generateParameterSourceDecorator("response", false);

/**
 * A parameter decorator to return a context sensitive
 */
export const Logger = Utils.generateParameterSourceDecorator(["response", "locals", "logger"], false);

/**
 * A parameter decorator to designate a parameter is optional
 */
export const Optional = Utils.generateParameterDecorator({
    required: false
});

export const Required = Utils.generateParameterDecorator({
    required: true
});

export const FormatResponse = (formatter: PlatAPIResponseFormatter, contentType?: string) => {
    return Utils.generateMethodDecorator({
        responseFormatter: formatter,
        responseContentType: contentType
    });
};

export const Use = (middleware: PlatAPIRequestHandler | PlatAPIRequestHandler[]) => {
    return Utils.generateMethodDecorator({
        middleware: castArray(middleware)
    });
};

/**
 * Specify OpenAPI operation documentation for this object. Any values here will overrule those auto-generated
 * @param openAPIDocs
 * @constructor
 */
export const Docs = (openAPIDocs: Partial<OperationObject>) => {
    return Utils.generateMethodDecorator({
        docs: openAPIDocs
    });
};
