const { isAxiosError } = require("axios");

/** @type {import("platapi").PlatAPIConfigObject} */
const apiConfig = {
    apiRootDirectory: "./examples/api",
    info: {
        title: "My API",
        version: "1.0.0"
    },
    errorLoggingFormatter: err => {
        if (isAxiosError(err)) {
            console.log("Axios error!");
        }

        return err;
    }
};

module.exports = apiConfig;
