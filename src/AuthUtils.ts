import { RequestHandler, Response } from "express/ts4.0";
import jwt, { JwtPayload } from "jsonwebtoken";
import castArray from "lodash/castArray";
import { PlatAPI } from "./PlatAPI";
import JwksRsa from "jwks-rsa";
import { Utils } from "./Utils";
import crypto from "crypto";

export interface PlatAPIAuthMiddlewareConfig {}

export interface APIKeyMiddlewareConfig extends PlatAPIAuthMiddlewareConfig {
    apiKeys: string | string[];

    /**
     * @default true
     */
    allowTempAPIKeys?: boolean;

    /**
     * @default X-API-KEY
     */
    headerName?: string;
}

export interface JWTMiddlewareConfig extends PlatAPIAuthMiddlewareConfig {
    allowedIssuers: string[];
    ignoreExpiration?: boolean;
}

export class PlatAPIAuth {
    static TMP_API_KEY_PREFIX = "tmp_";

    private static _initializeAuthResponse(res: Response) {
        if (!res.locals.auth) {
            res.locals.auth = {};
        }
    }

    static createSHA256Hash(plaintext: string): string {
        return crypto.createHash("sha256").update(plaintext).digest("hex");
    }

    static generateTemporaryAPIKey(rootAPIKey: string, expirationInSeconds: number = 300): string {
        const expirationTimeString = Math.round(Date.now() / 1000 + expirationInSeconds).toString();
        return PlatAPIAuth.TMP_API_KEY_PREFIX + PlatAPIAuth.createSHA256Hash(`${rootAPIKey}${expirationTimeString}`) + ":" + expirationTimeString;
    }

    static isValidTemporaryAPIKey(tempAPIKey: string, rootAPIKey: string): boolean {
        tempAPIKey = tempAPIKey.replace(PlatAPIAuth.TMP_API_KEY_PREFIX, "");
        const [tokenHash, expirationInSecondsString] = tempAPIKey.split(":");
        const currentTimeInSeconds = Math.round(Date.now() / 1000);

        if (Number(expirationInSecondsString) <= currentTimeInSeconds || tokenHash !== PlatAPIAuth.createSHA256Hash(rootAPIKey + expirationInSecondsString)) {
            return false;
        }

        return true;
    }

    static APIKeyMiddleware(config: APIKeyMiddlewareConfig): RequestHandler {
        const apiKeys = castArray(config.apiKeys);

        return (req, res, next) => {
            let isValidKey = false;
            const apiKey = req.get(config.headerName ?? "X-API-KEY");

            if (apiKey) {
                // Does this API key exist in the key list?
                isValidKey = apiKeys.includes(apiKey);

                // Can we verify this as temp API key?
                if (!isValidKey && config.allowTempAPIKeys !== false && apiKey.startsWith(PlatAPIAuth.TMP_API_KEY_PREFIX)) {
                    for (let rootAPIKey of apiKeys) {
                        if (PlatAPIAuth.isValidTemporaryAPIKey(apiKey, rootAPIKey) === true) {
                            isValidKey = true;
                            break;
                        }
                    }
                }
            }

            if (isValidKey) {
                PlatAPIAuth._initializeAuthResponse(res);
                res.locals.auth.apiKey = apiKey;
                next();
            } else {
                next(PlatAPI.createUnauthorizedError());
            }
        };
    }

    private static _jwksClients: { [iss: string]: JwksRsa.JwksClient } = {};

    static async verifyJWT<PayloadType extends JwtPayload = JwtPayload>(
        jwtString: string,
        allowedIssuers: string[],
        ignoreExpiration: boolean = false,
        throwError: boolean = true
    ): Promise<PayloadType | undefined> {
        let unverifiedPayload: JwtPayload;
        try {
            unverifiedPayload = jwt.decode(jwtString) as any;
        } catch (e: any) {
            if (throwError) {
                PlatAPI.throwUnauthorizedError(e);
            }
            return;
        }

        if (!unverifiedPayload) {
            if (throwError) {
                PlatAPI.throwUnauthorizedError();
            }
            return;
        }

        if (allowedIssuers.length < 1 || !unverifiedPayload.iss) {
            if (throwError) {
                PlatAPI.throwUnauthorizedError(new Error("Must have at least one allowed JWT issuer defined."));
            }
            return;
        }

        // Does this token belong to one of our issuers?
        if (!allowedIssuers.includes(unverifiedPayload.iss)) {
            if (throwError) {
                PlatAPI.throwUnauthorizedError(new Error(`JWT issuer ${unverifiedPayload.iss} is not allowed.`));
            }
            return;
        }

        // If we get here it means we have an allowed issuer, let's verify their signature
        let client: JwksRsa.JwksClient = PlatAPIAuth._jwksClients[unverifiedPayload.iss];

        if (!client) {
            client = JwksRsa({
                jwksUri: `${unverifiedPayload.iss}/.well-known/jwks.json`,
                cache: true
            });
            PlatAPIAuth._jwksClients[unverifiedPayload.iss] = client;
        }

        try {
            return await new Promise((resolve, reject) => {
                jwt.verify(
                    jwtString,
                    async (header, callback) => {
                        const key = await client.getSigningKey(header.kid);
                        const publicKey = key.getPublicKey();
                        callback(null, publicKey);
                    },
                    {
                        ignoreExpiration: ignoreExpiration
                    },
                    (err, decoded) => {
                        if (err) {
                            reject(err);
                            return;
                        }
                        resolve(decoded as any);
                    }
                );
            });
        } catch (e: any) {
            if (throwError) {
                PlatAPI.throwUnauthorizedError(e);
            }
            return;
        }
    }

    static JWTMiddleware(config: JWTMiddlewareConfig): RequestHandler {
        return async (req, res, next) => {
            let jwtString = req.get("Authorization");
            if (jwtString) {
                jwtString = jwtString.replace("Bearer ", "");

                try {
                    const decodedPayload = await PlatAPIAuth.verifyJWT(jwtString, config.allowedIssuers, config.ignoreExpiration, true);
                    if (decodedPayload) {
                        PlatAPIAuth._initializeAuthResponse(res);
                        res.locals.auth.jwt = jwtString;
                        res.locals.auth.jwtPayload = decodedPayload;
                        next();
                        return;
                    }
                } catch (e) {
                    next(e);
                    return;
                }
            }

            next(PlatAPI.createUnauthorizedError());
        };
    }
}

export const UseAPIKeyAuth = (config: APIKeyMiddlewareConfig) => {
    return Utils.generateMethodDecorator({
        middleware: castArray(PlatAPIAuth.APIKeyMiddleware(config))
    });
};

export const UseJWTAuth = (config: JWTMiddlewareConfig) => {
    return Utils.generateMethodDecorator({
        middleware: castArray(PlatAPIAuth.JWTMiddleware(config))
    });
};
