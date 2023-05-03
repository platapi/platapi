import { Utils } from "../src/Utils";

describe("Utils", () => {
    it("should generate API routes", () => {
        const routes = Utils.generateAPIRoutesFromFiles("./tests/sample-api/");
        console.log(routes);
    });
});
