import { DocGenerator } from "../src/docgen/DocGenerator";

describe("DocGenerator", () => {
    it("Should generate docs for a sample API", async () => {
        const apiSpec = await DocGenerator.generateDocs({
            info: {
                title: "Test API",
                version: "1.0.0"
            },
            apiRootDirectory: "./tests/sample-api"
        });

        expect(apiSpec.openapi).toBe("3.0.3");
        expect(apiSpec.info.title).toBe("Test API");
        expect(apiSpec.paths?.["/sample"]?.get).toBeDefined();
        expect(apiSpec.paths?.["/sample"]?.get?.requestBody).toBeDefined();
        expect(apiSpec.components?.schemas).toBeDefined();
    });
});
