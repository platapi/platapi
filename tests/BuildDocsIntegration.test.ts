import { spawn } from "child_process";
import fs from "fs-extra";
import path from "path";

const repoRoot = path.resolve(__dirname, "..");
const fixtureConfigPath = path.join(repoRoot, ".tmp", "large-api", "api.config.js");
const fixtureDocsPath = path.join(repoRoot, ".tmp", "large-api", "docs.json");

function runCommand(command: string, args: string[], cwd: string) {
    return new Promise<{ code: number | null; stderr: string; stdout: string }>((resolve, reject) => {
        const child = spawn(command, args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
        let stdout = "";
        let stderr = "";

        child.stdout.on("data", chunk => {
            stdout += chunk.toString();
        });

        child.stderr.on("data", chunk => {
            stderr += chunk.toString();
        });

        child.on("error", reject);
        child.on("close", code => resolve({ code, stderr, stdout }));
    });
}

function parseMaxRssKb(output: string) {
    const match = output.match(/Maximum resident set size \(kbytes\):\s+(\d+)/);
    return match ? Number(match[1]) : undefined;
}

describe("Build/docs integration", () => {
    it(
        "builds the synthetic fixture and logs memory measurements",
        async () => {
            const fixtureResult = await runCommand("node", ["./scripts/generate-memory-fixture.js"], repoRoot);
            expect(fixtureResult.code).toBe(0);

            const docsResult = await runCommand(
                "/usr/bin/time",
                ["-v", "./node_modules/.bin/tsx", "./scripts/generate-docs.ts", "-c", fixtureConfigPath, "-o", fixtureDocsPath],
                repoRoot
            );
            expect(docsResult.code).toBe(0);
            expect(await fs.pathExists(fixtureDocsPath)).toBe(true);

            const buildResult = await runCommand(
                "/usr/bin/time",
                ["-v", "./node_modules/.bin/tsx", "./scripts/platapi.ts", "build", "-c", fixtureConfigPath, "--no-minify"],
                repoRoot
            );
            expect(buildResult.code).toBe(0);

            const docsRssKb = parseMaxRssKb(docsResult.stderr);
            const buildRssKb = parseMaxRssKb(buildResult.stderr);

            expect(docsRssKb).toBeDefined();
            expect(buildRssKb).toBeDefined();

            console.info(`docs fixture max RSS: ${docsRssKb} KB`);
            console.info(`build fixture max RSS: ${buildRssKb} KB`);
        },
        120000
    );

    afterAll(async () => {
        await fs.remove(path.join(repoRoot, ".tmp", "large-api"));
        await fs.remove(path.join(repoRoot, "build"));
    });
});
