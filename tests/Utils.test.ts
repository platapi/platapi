import { Utils } from "../src/Utils";
import axios from "axios";

function shuffleArray(array: any[]) {
    for (let i = array.length - 1; i >= 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }

    return array;
}

describe("Utils", () => {
    // it("should generate API routes", () => {
    //     const routes = Utils.generateAPIRoutesFromFiles("./tests/sample-api/");
    //     console.log(routes);
    // });

    it("should properly order API routes", () => {
        function sortRoutes(routes: string[]): string[] {
            return routes.sort(Utils.compareRoutes);
        }

        expect(sortRoutes(["/r2/[[...oca]].ts", "/[...ca]/index.ts", "/r2/a3", "/r1.ts", "/r2/a1/[[...oca]].ts"])).toStrictEqual([
            "/r2/a3",
            "/r2/a1/[[...oca]].ts",
            "/r2/[[...oca]].ts",
            "/r1.ts",
            "/[...ca]/index.ts"
        ]);
    });

    it("should create an error object", async () => {
        try {
            const result = await axios.delete("https://google.com");
        } catch (e) {
            const errorObject = Utils.convertErrorToObject(e);
            expect(JSON.stringify(errorObject).includes(`"statusText":"Method Not Allowed"`)).toBeTruthy();
        }
    });
});
