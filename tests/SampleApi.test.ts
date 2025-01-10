import SuperTest from "supertest";
import { PlatAPIConfigObject } from "../src/Types";
import { PlatAPI } from "../src/PlatAPI";
import { Utils } from "../src/Utils";
import express from "express";

const app = express();
const config: PlatAPIConfigObject = Utils.getAPIConfig({
    apiRootDirectory: "tests/sample-api",
    app
});
config.testingMode = true;
const platAPI = new PlatAPI(config);
const request = SuperTest(platAPI.app);

describe("sample-api", () => {
    it("/r1", async () => {
        await request.get("/r1").expect(404);
    });

    it("/path/s/1", async () => {
        await request
            .get("/path/s/1")
            .set({
                headerParam: "world",
                Cookie: ["session=eyJqd3QiOiJ...", "cookieParam=hello"]
            })
            .expect(200)
            .then(response => {
                expect(response.body).toEqual(["s", "1", "world", "hello"]);
            });
    });

    it("/catchall/required/*", async () => {
        await request
            .get("/catchall/required/hello/world")
            .expect(200)
            .then(response => {
                expect(response.body).toEqual(["hello", "world"]);
            });
    });
});
