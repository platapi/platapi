import { Utils } from "../src/Utils";
import axios from "axios";
import { error } from "loglevel";

describe("Utils", () => {
    it("should generate API routes", () => {
        const routes = Utils.generateAPIRoutesFromFiles("./tests/sample-api/");
        console.log(routes);
    });

    it("should create an error object", async () => {
        try {
            const result = await axios.delete("https://google.com");
            debugger;
        } catch (e) {
            const errorObject = Utils.convertErrorToObject(e);
            expect(JSON.stringify(errorObject).includes(`"statusText":"Method Not Allowed"`)).toBeTruthy();
        }
    });
});
