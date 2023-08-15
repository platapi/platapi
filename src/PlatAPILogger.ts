import logLevel from "loglevel";
import isObjectLike from "lodash/isObjectLike";

const PlatAPILogger = logLevel.getLogger("platapi-default-logger");
let originalFactory = PlatAPILogger.methodFactory;
PlatAPILogger.methodFactory = (methodName, logLevel, loggerName) => {
    let rawMethod = originalFactory(methodName, logLevel, loggerName);
    return function () {
        const argData = Array.from(arguments).map(arg => {
            if (arg instanceof Error) {
                return [arg.message, arg.stack].join(" ");
            }
            // Convert all objects to JSON
            else if (isObjectLike(arg)) {
                return JSON.stringify(arg);
            }

            return arg;
        });

        rawMethod(...argData);
    };
};

PlatAPILogger.setLevel((process.env.LOG_LEVEL as any) ?? "error");

export { PlatAPILogger };
