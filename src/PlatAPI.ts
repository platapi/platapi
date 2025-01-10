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
import isNil from "lodash/isNil";
import isString from "lodash/isString";
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
    PlatAPIResponseFormatter,
    PlatAPIConfigObject,
    PlatAPIConfig,
    PlatAPIRoute,
    PlatAPIFriendlyError,
    PlatAPIStandardResponseFailure
} from "./Types";
import { PlatAPILogger } from "./PlatAPILogger";
import { DefaultBrowserErrorTemplate } from "./DefaultBrowserErrorTemplate";

interface ExtendedRoute extends PlatAPIRoute {
    import?: () => Promise<any>;
}

export class PlatAPI {
    readonly handler?: APIGatewayProxyHandler;
    readonly app?: Express;
    readonly server?: Server;
    readonly config: PlatAPIConfigObject;
    static readonly logger = PlatAPILogger;

    constructor(config?: PlatAPIConfig) {
        this.config = Utils.getAPIConfig(config);

        const packageInfo = require("../package.json");

        PlatAPI.logger.info(packageInfo.name, packageInfo.version);

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
            PlatAPI.logger.info("Loading API routes from", this.config.apiRootDirectory);
            apiRoutes = Utils.generateAPIRoutesFromFiles(this.config.apiRootDirectory as string);

            if (apiRoutes.length === 0) {
                PlatAPI.logger.warn("No API routes found at", this.config.apiRootDirectory);
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

        // This is where we catch any uncaught errors
        const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
            // I don't think err is never missing, but do this just in case
            if (err) {
                this._sendErrorResponse(req, res, err, true);
            } else {
                next();
            }
        };
        this.app.use(errorHandler);

        // Our 404 handler
        this.app.use((req, res, next) => {
            this._sendErrorResponse(req, res, PlatAPI.createNotFoundError());
        });

        if (isLambda) {
            const serverless = require("serverless-http");
            const serverlessOptions: any = {};

            if (this.config.binaryMediaTypes) {
                serverlessOptions.binary = this.config.binaryMediaTypes;
            }

            this.handler = serverless(this.app, serverlessOptions);
        } else if (this.config.testingMode) {
            PlatAPI.logger.info("PlatAPI testing started");
        } else {
            this.server = this.app.listen(this.config.apiPort);
            PlatAPI.logger.info("PlatAPI started on port", this.config.apiPort);
        }
    }

    static createAPIFriendlyError<S extends number = number, M extends any = string>(friendlyMessage?: M, statusCode: S = 500 as S, rawError?: Error): PlatAPIFriendlyError<S, M> {
        const messageString = friendlyMessage === undefined ? "unknown" : isString(friendlyMessage) ? friendlyMessage : JSON.stringify(friendlyMessage);

        const friendlyError: PlatAPIFriendlyError = (rawError ?? new Error(messageString)) as any;

        if (friendlyMessage) {
            friendlyError.friendlyMessage = friendlyMessage as any;
        }
        friendlyError.statusCode = statusCode;
        friendlyError.id = nanoid();
        return friendlyError as any;
    }

    static createNotFoundError() {
        return PlatAPI.createAPIFriendlyError("Not found", 404);
    }

    static createUnauthorizedError(rawError?: Error) {
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
                let argData = Array.from(arguments);

                if (argData.length === 1) {
                    argData = argData[0];
                }

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
        newLogger.setLevel(PlatAPI.logger.getLevel());
        return newLogger;
    }

    private _defaultResponseFormatter = (
        response: any,
        statusCode: number,
        requestID: string,
        formatForBrowser: boolean = false
    ): PlatAPIFriendlyResponseSuccess | PlatAPIFriendlyResponseFailure | PlatAPIStandardResponseFailure | string => {
        if (statusCode <= 299) {
            if (this.config?.returnFriendlyResponses) {
                return {
                    this: "succeeded",
                    with: response
                };
            }

            return response;
        } else {
            if (formatForBrowser) {
                return Utils.replaceHandlebarAttributesInText(this.config.browserHTMLErrorTemplate ?? DefaultBrowserErrorTemplate, {
                    statusCode: statusCode,
                    errorMessage: JSON.stringify(response, null, 4).replace(/^"|"$/g, ""),
                    requestID: requestID
                });
            }

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

    private _sendErrorResponse(req: Request, res: Response, error: Error | PlatAPIFriendlyError, log2Console: boolean = false) {
        const statusCode = (error as PlatAPIFriendlyError).statusCode ?? 500;
        const message = (error as PlatAPIFriendlyError).friendlyMessage ?? "unknown";

        if (log2Console) {
            if (this.config.errorLoggingFormatter) {
                error = this.config.errorLoggingFormatter(error);
            }

            res.locals.logger.error({ statusCode: statusCode, error: Utils.convertErrorToObject(error) });
        }

        // Send a friendly response back to the user
        this._sendResponse(req, res, message, statusCode);
    }

    private _sendResponse(req: Request, res: Response, response: any, statusCode: number = 200, responseFormatter: PlatAPIResponseFormatter = this._defaultResponseFormatter) {
        const formattedResponse = responseFormatter(response, statusCode, res.locals.requestID, Utils.isBrowserRequest(req));
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
                request: req,
                response: res
            };

            const inputSourcePaths = requirement.sources ?? [
                ["request", "params", paramName],
                ["request", "query", paramName],
                ["request", "body", paramName],
                ["request", "headers", paramName.toLowerCase()]
            ];

            const foundPath = inputSourcePaths.find(path => get(inputSource, path) !== undefined);

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

            if (handlerConfig.requestValidator?.handler && handlerConfig.requestValidator.runBeforeMiddleware) {
                handlerConfig.requestValidator.handler(req as any, res, next);
            }

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

            if (handlerConfig.requestValidator?.handler && !handlerConfig.requestValidator.runBeforeMiddleware) {
                handlerConfig.requestValidator.handler(req as any, res, next);
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
