import { buildBuildCommandArgs, getDefaultHeapSize, getHeavyCommandExecArgs } from "../scripts/HeavyCommandUtils";

describe("HeavyCommandUtils", () => {
    it("adds no-minify only when requested", () => {
        expect(buildBuildCommandArgs({ config: "./api.config.js", minify: true, sourcemap: false })).toEqual(["--config", "./api.config.js"]);
        expect(buildBuildCommandArgs({ config: "./api.config.js", minify: false, sourcemap: true })).toEqual([
            "--config",
            "./api.config.js",
            "--sourcemap",
            "--no-minify"
        ]);
    });

    it("defaults heavy commands to a 4096MB heap on Node 22+", () => {
        expect(getDefaultHeapSize({}, "22.18.0")).toBe("4096");
        expect(getDefaultHeapSize({}, "20.17.0")).toBeUndefined();
        expect(getDefaultHeapSize({ PLATAPI_MAX_OLD_SPACE_SIZE: "6144" }, "22.18.0")).toBe("6144");
    });

    it("does not add another heap flag when one is already present", () => {
        expect(
            getHeavyCommandExecArgs({
                processExecArgv: ["--max-old-space-size=2048"],
                maxOldSpaceSize: "4096",
                nodeOptions: "--trace-gc",
                scriptArgs: ["--config", "./api.config.js"],
                scriptPath: "/tmp/build-command",
                tsxCliPath: "/tmp/tsx-cli"
            })
        ).toEqual(["--trace-gc", "/tmp/tsx-cli", "/tmp/build-command", "--config", "./api.config.js"]);
    });

    it("adds heap and passthrough node options for heavy commands", () => {
        expect(
            getHeavyCommandExecArgs({
                processExecArgv: [],
                maxOldSpaceSize: "4096",
                nodeOptions: "--trace-gc --conditions=dev",
                scriptArgs: ["--config", "./api.config.js", "--no-minify"],
                scriptPath: "/tmp/build-command",
                tsxCliPath: "/tmp/tsx-cli"
            })
        ).toEqual([
            "--max-old-space-size=4096",
            "--trace-gc",
            "--conditions=dev",
            "/tmp/tsx-cli",
            "/tmp/build-command",
            "--config",
            "./api.config.js",
            "--no-minify"
        ]);
    });
});
