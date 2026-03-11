#!/usr/bin/env node

import { spawn } from "child_process";
import path from "path";
import { buildBuildCommandArgs, getDefaultHeapSize, getHeavyCommandExecArgs } from "./HeavyCommandUtils";

const { program } = require("commander");

function runHeavyCommand(scriptPath: string, scriptArgs: string[], options: { env?: NodeJS.ProcessEnv; maxOldSpaceSize?: string | number }) {
    const execArgs = getHeavyCommandExecArgs({
        processExecArgv: process.execArgv,
        maxOldSpaceSize: options.maxOldSpaceSize,
        nodeOptions: process.env.PLATAPI_NODE_OPTIONS,
        scriptArgs,
        scriptPath,
        tsxCliPath: require.resolve("tsx/cli")
    });

    if (options.maxOldSpaceSize && execArgs[0] === `--max-old-space-size=${options.maxOldSpaceSize}`) {
        console.log(`Using Node heap limit ${options.maxOldSpaceSize}MB for this command.`);
    }

    return spawn(process.execPath, execArgs, {
        stdio: "inherit",
        env: options.env ?? process.env
    });
}

program.name("platapi").description("PlatAPI command line interface").version("0.1.0");

program
    .command("dev")
    .option("-c --config <string>", "the location of your api.config.js file", "./api.config.js")
    .action(async (options: any) => {
        const child = spawn(
            "node_modules/.bin/tsx",
            ["watch", "--include", "./**/*.ts", "--exclude", "node_modules/*", "--clear-screen=false", path.resolve(__dirname, "server")],
            {
                stdio: "inherit",
                env: {
                    ...process.env,
                    API_CONFIG_FILE: options.config
                }
            }
        );
    });

program
    .command("build")
    .option("-c --config <string>", "the location of your api.config.js file", "./api.config.js")
    .option("-s --sourcemap", "generate source maps", false)
    .option("--no-minify", "skip minification to reduce memory usage and build time")
    .option("--max-old-space-size <mb>", "set the Node.js heap limit for this command")
    .action(async (options: any) => {
        const child = runHeavyCommand(path.resolve(__dirname, "build-command"), buildBuildCommandArgs(options), {
            env: process.env,
            maxOldSpaceSize: options.maxOldSpaceSize ?? getDefaultHeapSize()
        });

        child.on("exit", code => process.exit(code ?? 0));
    });

program
    .command("generate:docs")
    .option("-d --defaultSpecFile <string>", "the default OpenAPI 3.1 spec for your API— this will be merged in with the generated documentation")
    .option("-c --config <string>", "the location of your api.config.js file", "./api.config.js")
    .option("-o, --outfile <string>", "output docs to a file, otherwise will print to console.")
    .option("--max-old-space-size <mb>", "set the Node.js heap limit for this command")
    .action(async (options: any) => {
        const args = [
            "--config",
            options.config,
            ...(options.defaultSpecFile ? ["--defaultSpecFile", options.defaultSpecFile] : []),
            ...(options.outfile ? ["--outfile", options.outfile] : [])
        ];

        const child = runHeavyCommand(path.resolve(__dirname, "generate-docs"), args, {
            env: {
                ...process.env,
                API_CONFIG_FILE: options.config
            },
            maxOldSpaceSize: options.maxOldSpaceSize ?? getDefaultHeapSize()
        });

        child.on("exit", code => process.exit(code ?? 0));
    });

program.parse();
