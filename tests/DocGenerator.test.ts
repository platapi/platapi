import { DocGenerator } from "../src/docgen/DocGenerator";

describe("DocGenerator", () => {
    it("Should generate docs for a sample API", async () => {
        const info = {
            title: "Test API",
            version: "1.0.0"
        };

        // const apiSpec = await DocGenerator.generateDocs(info, {
        //     apiRootDirectory: "./tests/sample-api"
        // });
        // console.log(JSON.stringify(apiSpec, null, 4));
    });
});
