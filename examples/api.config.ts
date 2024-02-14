import { isAxiosError } from "axios";

const apiConfig = {
    apiRootDirectory: "./examples/api",
    info: {
        title: "My API",
        version: "1.0.0"
    },
    errorLoggingFormatter: (err: any) => {
        if (isAxiosError(err)) {
            console.log("Axios error!");
        }

        return err;
    }
};

export default apiConfig;
