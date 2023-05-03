import { Utils } from "./Utils";
import castArray from "lodash/castArray";
import { PlatAPIRequestHandler, PlatAPIInputParameterRequirement, PlatAPIResponseFormatter } from "./Types";
import { OperationObject } from "openapi3-ts/src/model/openapi31";

export const Post = Utils.generateHTTPMethodDecorator("POST");
export const Get = Utils.generateHTTPMethodDecorator("GET");
export const Put = Utils.generateHTTPMethodDecorator("PUT");
export const Patch = Utils.generateHTTPMethodDecorator("PATCH");
export const Delete = Utils.generateHTTPMethodDecorator("DELETE");
export const Options = Utils.generateHTTPMethodDecorator("OPTIONS");
export const Head = Utils.generateHTTPMethodDecorator("HEAD");
export const Trace = Utils.generateHTTPMethodDecorator("TRACE");

export const Param = (requirements: PlatAPIInputParameterRequirement) => {
    return Utils.generateParameterDecorator(requirements);
};

export const BodyPart = Utils.generateParameterSourceDecorator(["request", "body"]);
export const Body = Utils.generateParameterSourceDecorator(["request", "body"], true, false);

export const Cookie = Utils.generateParameterSourceDecorator(["request", "cookies"]);
export const AllCookies = Utils.generateParameterSourceDecorator(["request", "cookies"], true);

export const Query = Utils.generateParameterSourceDecorator(["request", "query"]);
export const AllQuery = Utils.generateParameterSourceDecorator(["request", "query"], true);

export const Path = Utils.generateParameterSourceDecorator(["request", "params"]);
export const AllPath = Utils.generateParameterSourceDecorator(["request", "params"], true);

export const Header = Utils.generateParameterSourceDecorator(["request", "headers"]);
export const AllHeaders = Utils.generateParameterSourceDecorator(["request", "headers"], true);

export const Request = Utils.generateParameterSourceDecorator("request", true);
export const Response = Utils.generateParameterSourceDecorator("response", true);
export const Logger = Utils.generateParameterSourceDecorator(["response", "locals", "logger"], true);

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
