import express from "express";
import bodyParser from "body-parser";
// @ts-ignore
import cookieParser from "cookie-parser";
// @ts-ignore
import isLambda from "is-lambda";
import { APIGatewayProxyHandler } from "aws-lambda";
import { Server } from "http";
import { Express, Request, Response, NextFunction } from "express/ts4.0";
import log, { Logger } from "loglevel";
import { nanoid } from "nanoid";
import get from "lodash/get";
import has from "lodash/has";
import isNil from "lodash/isNil";
import isArray from "lodash/isArray";
import { Utils } from "./Utils";
import { ErrorRequestHandler } from "express-serve-static-core";
import cors from "cors";
import wcmatch from "wildcard-match";
import {
    PlatAPIResponse,
    PlatAPIFriendlyResponseFailure,
    PlatAPIFriendlyResponseSuccess,
    PlatAPIInputParameterRequirements,
    PlatAPIManagedAPIHandler,
    PlatAPIManagedAPIHandlerConfig,
    PlatAPIResponseFormatter,
    PlatAPIConfigObject,
    PlatAPIConfig,
    PlatAPIRoute,
    PlatAPIFriendlyError,
    PlatAPIStandardResponseFailure
} from "./Types";

interface ExtendedRoute extends PlatAPIRoute {
    import?: () => Promise<any>;
}

export class PlatAPI {
    readonly handler?: APIGatewayProxyHandler;
    readonly app?: Express;
    readonly server?: Server;
    readonly config: PlatAPIConfigObject;
    static readonly logger = log;

    constructor(config?: PlatAPIConfig) {
        this.config = Utils.getAPIConfig(config);

        log.setLevel((process.env.LOG_LEVEL as any) ?? "error");

        const packageInfo = require("../package.json");

        log.info(packageInfo.name, packageInfo.version);

        this.app = this.config.app ?? express();

        // Create our contextual logger
        this.app.use((req, res, next) => {
            res.locals.requestID = nanoid();

            const context = {
                method: req.method,
                url: req.url,
                requestID: res.locals.requestID
            };

            if (this.config.logContextHandler) {
                this.config.logContextHandler(req, context);
            }

            const requestLogger = this._createContextualLogger(nanoid(), this._sanitizeObject(context));
            res.locals.logger = requestLogger;

            res.once("finish", () => {
                requestLogger.debug({ statusCode: res.statusCode });

                // Clean the logger up after the request
                const loggers = log.getLoggers();
                delete loggers[(requestLogger as any).name];
            });

            next();
        });

        if (this.config.corsWhitelist) {
            const isMatch = wcmatch(this.config.corsWhitelist);
            this.app.use(
                cors({
                    origin: (requestOrigin, callback) => {
                        const isAllowedOrigin = !!requestOrigin && isMatch(requestOrigin);
                        callback(null, isAllowedOrigin);
                    }
                })
            );
        }

        if (this.config.loadStandardMiddleware) {
            this.app.use(cookieParser());
            this.app.use(
                bodyParser.urlencoded({
                    extended: true
                })
            );
            this.app.use(bodyParser.json());
            this.app.use(bodyParser.text());
        }

        let apiRoutes = this.config.routes as ExtendedRoute[];

        // If routes aren't directly specified, then we can use file-system routing
        if (!apiRoutes) {
            log.info("Loading API routes from", this.config.apiRootDirectory);
            apiRoutes = Utils.generateAPIRoutesFromFiles(this.config.apiRootDirectory as string);

            if (apiRoutes.length === 0) {
                log.warn("No API routes found at", this.config.apiRootDirectory);
            }
        }

        const apiRouter = express.Router();

        for (let route of apiRoutes) {
            apiRouter.all(route.endpoint, async (req, res, next) => {
                // Lazy load the route code
                let module = route.import ? await route.import() : route.file ? require(route.file) : undefined;

                if (module?.default) {
                    module = module.default;
                }

                if (!module) {
                    next(PlatAPI.createNotFoundError());
                    return;
                }

                const handler = Utils.generateMethodHandler(module, req.method);
                if (!handler) {
                    next(PlatAPI.createNotFoundError());
                    return;
                }

                try {
                    await this._handleRequest(handler, req, res as PlatAPIResponse, next);
                } catch (e) {
                    next(e);
                }
            });
        }

        // Our main route handler
        this.app.use("/", apiRouter);

        // Our default uncaught error handler
        const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
            // I don't think err is never missing, but do this just in case
            if (err) {
                const statusCode = err.statusCode ?? 500;
                const message = err.friendlyMessage ?? "unknown";

                // Log our raw error
                res.locals.logger.error(statusCode, err.message, err.stack);

                // Send a friendly response back to the user
                this._sendResponse(req, res, message, statusCode);
            } else {
                next();
            }
        };
        this.app.use(errorHandler);

        // Our 404 handler
        this.app.use((req, res, next) => {
            this._sendResponse(req, res, "Not Found", 404);
        });

        if (isLambda) {
            const serverless = require("serverless-http");
            const serverlessOptions: any = {};

            if (this.config.binaryMediaTypes) {
                serverlessOptions.binary = this.config.binaryMediaTypes;
            }

            this.handler = serverless(this.app, serverlessOptions);
        } else {
            this.server = this.app.listen(this.config.apiPort);
            log.info(`API Started on port`, this.config.apiPort);
        }
    }

    static createAPIFriendlyError(friendlyMessage?: string, statusCode: number = 500, rawError?: Error): PlatAPIFriendlyError {
        const friendlyError: PlatAPIFriendlyError = (rawError ?? new Error(friendlyMessage ?? "unknown")) as any;

        if (friendlyMessage) {
            friendlyError.friendlyMessage = friendlyMessage;
        }
        friendlyError.statusCode = statusCode;
        friendlyError.id = nanoid();
        return friendlyError;
    }

    static createNotFoundError(): PlatAPIFriendlyError {
        return PlatAPI.createAPIFriendlyError("Not found", 404);
    }

    static createUnauthorizedError(rawError?: Error): PlatAPIFriendlyError {
        return PlatAPI.createAPIFriendlyError("Unauthorized", 401, rawError);
    }

    static throwNotFoundError() {
        throw PlatAPI.createNotFoundError();
    }

    static throwUnauthorizedError(rawError?: Error) {
        throw PlatAPI.createUnauthorizedError(rawError);
    }

    static throwAPIError(friendlyMessage?: string, statusCode: number = 500, rawError?: Error) {
        throw PlatAPI.createAPIFriendlyError(friendlyMessage, statusCode, rawError);
    }

    private _createContextualLogger(id: string, contextData: any): Logger {
        const newLogger = log.getLogger(id);
        let originalFactory = newLogger.methodFactory;
        newLogger.methodFactory = (methodName, logLevel, loggerName) => {
            let rawMethod = originalFactory(methodName, logLevel, loggerName);
            return function () {
                const argData = Array.from(arguments);
                rawMethod(
                    JSON.stringify({
                        time: new Date().toISOString(),
                        level: methodName,
                        ...contextData,
                        message: argData
                    })
                );
            };
        };
        newLogger.setLevel(newLogger.getLevel());
        return newLogger;
    }

    private _defaultResponseFormatter = (
        response: any,
        statusCode: number,
        requestID: string,
        formatForBrowser: boolean = false
    ): PlatAPIFriendlyResponseSuccess | PlatAPIFriendlyResponseFailure | PlatAPIStandardResponseFailure | string => {
        if (formatForBrowser) {
            return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Error: ${statusCode}</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
    @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;600&display=swap');
    html, body
    {
    margin: 0;
    padding: 0;
    font-family: 'Poppins',sans-serif;
    font-size: 24px;
    color: #363636;
    }
    .error-container
    {
    min-height: 100vh;
    width: 100%;
    display: flex;
    flex-direction: column;
    }
    .error-box
    {
    flex: 1;
    display: flex;
    justify-content: center;
    align-items: center;
    flex-direction: row;
    }
    
    .error-code
    {
    font-weight: 600;
    font-size: 1.5rem;
    border-right: #A6A6A6 1px solid;
    }
    
    .error-message
    {
    white-space: pre-wrap;
    }
    
    .error-box > div
    {
    padding: 1.25rem;
    }
    
    .error-id
    {
    text-align: center;
    font-size: 0.5rem;
    padding: 1.25rem;
    opacity: 50%;
    }
    </style>
</head>
<body>
<div class="error-container">
    <div class="error-box">
        <div class="error-code">${statusCode}</div>
        <div>
            <div class="error-message">${JSON.stringify(response, null, 4).replace(/^"|"$/g, "")}</div>
        </div>
    </div>
    <div class="error-id">Error ID: ${requestID}</div>
</div>
</body>
</html>`;
        }

        if (statusCode <= 299) {
            if (this.config?.returnFriendlyResponses) {
                return {
                    this: "succeeded",
                    with: response
                };
            }

            return response;
        } else {
            if (this.config?.returnFriendlyResponses) {
                return {
                    this: "failed",
                    with: statusCode,
                    because: response,
                    id: requestID
                };
            }

            return {
                error: {
                    code: statusCode,
                    message: response,
                    id: requestID
                }
            };
        }
    };

    private _sendResponse(req: Request, res: Response, response: any, statusCode: number = 200, responseFormatter: PlatAPIResponseFormatter = this._defaultResponseFormatter) {
        const isBrowser = /Mozilla/i.test(req.get("user-agent") ?? "");
        const formattedResponse = responseFormatter(response, statusCode, res.locals.requestID, isBrowser);
        res.status(statusCode).send(formattedResponse);
    }

    private _sanitizeObject<T = any>(theObject: T): T {
        // TODO: implement to remove things like API keys, tokens, auth headers, etc.
        return theObject;
    }

    private static _processInputParams(req: Request, res: Response, requirements: PlatAPIInputParameterRequirements): { [paramName: string]: any } {
        const output: any = {};

        Object.entries(requirements).forEach(([paramName, requirement]) => {
            let paramValue;

            const inputSource = {
                request: {
                    ...req,
                    // Make a copy of the headers so we get by path
                    headers: { ...req.headers }
                },
                response: res
            };

            const inputSourcePaths = requirement.sources ?? [
                ["request", "params", paramName],
                ["request", "query", paramName],
                ["request", "body", paramName]
            ];

            const foundPath = inputSourcePaths.find(path => has(inputSource, path));

            if (foundPath) {
                paramValue = get(inputSource, foundPath);

                if (requirement.autoConvert) {
                    // Can we parse this value and turn it into a typed value?
                    try {
                        paramValue = JSON.parse(paramValue);
                    } catch (e) {
                        // ignore
                    }
                }

                if (requirement.transformFunction) {
                    paramValue = requirement.transformFunction(paramValue);
                }
            }

            if (requirement.required !== false && isNil(paramValue)) {
                PlatAPI.throwAPIError(`Required parameter '${paramName}' is missing`, 400);
            }

            output[paramName] = paramValue;
        });

        return output;
    }

    private async _handleRequest(handler: PlatAPIManagedAPIHandler, req: Request, res: PlatAPIResponse, next: NextFunction) {
        try {
            let result;
            let [handlerConfig, handlerFunction] = handler;

            // Do we have any middleware we need to execute first?
            if (handlerConfig.middleware) {
                for (let middleware of handlerConfig.middleware) {
                    try {
                        const shouldContinue = await new Promise(async (resolve, reject) => {
                            try {
                                await middleware(req as any, res, (...args) => {
                                    // If next has any arguments in it, let's bail out early
                                    if (args && args.length > 0) {
                                        next(...args);
                                        resolve(false);
                                        return;
                                    }

                                    resolve(true);
                                });
                            } catch (e) {
                                reject(e);
                                return;
                            }
                        });

                        // If res.writableEnded is true it means the middleware already ended the response and there is nothing more we can do.
                        // If shouldContinue is false, then we should assume that next has already been called with an error of some sort and we shouldn't move on any more
                        if (res.writableEnded || !shouldContinue) {
                            return;
                        }
                    } catch (e) {
                        next(e);
                        return;
                    }
                }
            }

            const handlerArgNames = Utils.getFunctionParamNames(handlerFunction);

            if (!handlerConfig.params) {
                handlerConfig.params = {};
            }

            for (let arg of handlerArgNames) {
                // Initialize any missing args
                if (!(arg in handlerConfig.params)) {
                    handlerConfig.params[arg] = {
                        required: true
                    };
                }
            }

            const inputParameters = PlatAPI._processInputParams(req, res, handlerConfig.params);
            const inputArgs = handlerArgNames.map(argName => inputParameters[argName]);

            result = await handlerFunction.apply(null, inputArgs);

            if (handlerConfig.responseContentType) {
                res.contentType(handlerConfig.responseContentType);
            }

            if (!res.writableEnded) {
                this._sendResponse(req, res, result, res.statusCode ?? 200, handlerConfig.responseFormatter);
            }
        } catch (e: any) {
            next(e);
        }
    }
}
