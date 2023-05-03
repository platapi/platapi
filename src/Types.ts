import { Logger } from "loglevel";
import { RequestHandler, Request, Response } from "express/ts4.0";
import { Route } from "./Utils";
import { OperationObject } from "openapi3-ts/src/model/openapi31";

export interface FriendlyAPIResponseSuccess<T = any> {
    this: "succeeded";
    with: any;
}

export interface FriendlyAPIResponseFailure<T = any> {
    this: "failed";
    with: number;
    because?: T;
}

export interface InputParameterRequirement {
    required?: boolean;

    /**
     * Try to convert values into typed values, like numbers, objects, arrays, etc.
     * @default false
     */
    autoConvert?: boolean;
    sources?: (string | string[])[];
}

export type ResponseFormatter = (outputValue: any, statusCode: number) => any;

export interface ManagedAPIHandlerConfig {
    responseContentType?: string;
    responseFormatter?: ResponseFormatter;
    middleware?: PlatAPIRequestHandler[];
    params?: InputParameterRequirements;
    docs?: Partial<OperationObject>;
}

export type InputParameterRequirements = { [paramName: string]: InputParameterRequirement };
export type ManagedAPIHandler = [ManagedAPIHandlerConfig, Function];
export type PlatAPILogger = Logger;

export interface PlatAPIRequestLocals {
    logger: PlatAPILogger;

    [x: string | number | symbol]: unknown;
}

export type PlatAPIRequest = Request<any, any, any, any, PlatAPIRequestLocals>;
export type PlatAPIResponse = Response<any, PlatAPIRequestLocals>;
export type PlatAPIRequestHandler = RequestHandler<any, any, any, any, PlatAPIRequestLocals>;

export type PlatAPIRoute = Route;
