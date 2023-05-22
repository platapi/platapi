#!/usr/bin/env node

import { DocGenerator } from "../src/docgen/DocGenerator";
import fs from "fs-extra";
import defaultsDeep from "lodash/defaultsDeep";
import { spawn } from "child_process";
import path from "path";
import { PlatAPIConfigObject } from "../src";
import { Utils } from "../src/Utils";
import { build } from "./build";

const { program } = require("commander");

program.name("platapi").description("PlatAPI command line interface").version("0.1.0");

program
    .command("dev")
    .option("-c --config <string>", "the location of your api.config.ts or api.config.js file", "./api.config.js")
    .action(async (options: any) => {
        const child = spawn("node_modules/.bin/ts-node-dev", ["--watch", "./**/*.ts", "--ignore-watch", "node_modules/*", "--transpile-only", path.resolve(__dirname, "server")], {
            stdio: "inherit",
            env: {
                ...process.env,
                API_CONFIG_FILE: options.config
            }
        });
    });

program
    .command("build")
    .option("-c --config <string>", "the location of your api.config.ts or api.config.js file", "./api.config.js")
    .action(async (options: any) => {
        await build(options.config);
    });

program
    .command("generate:docs")
    .option("-d --defaultSpecFile <string>", "the default OpenAPI 3.1 spec for your API— this will be merged in with the generated documentation")
    .option("-c --config <string>", "the location of your api.config.ts or api.config.js file", "./api.config.js")
    .option("-o, --outfile <string>", "output docs to a file, otherwise will print to console.")
    .action(async (options: any) => {
        let args = [path.resolve(__dirname, "generate-docs")];

        for (let optionName of Object.keys(options)) {
            args = [...args, `--${optionName}`, options[optionName]];
        }

        // We need to use ts-node here so the doc generator can load typescript files
        const child = spawn("node_modules/.bin/ts-node", args, {
            stdio: "inherit",
            env: {
                ...process.env,
                API_CONFIG_FILE: options.config
            }
        });
    });

program.parse();
