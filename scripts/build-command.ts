#!/usr/bin/env node

import { build } from "./build";

const { program } = require("commander");

program
    .name("build")
    .description("PlatAPI build command")
    .version("0.1.0")
    .option("-c --config <string>", "the location of your api.config.js file", "./api.config.js")
    .option("-s --sourcemap", "generate source maps", false)
    .option("--no-minify", "skip minification to reduce memory usage and build time")
    .action(async (options: any) => {
        await build(options.config, options.sourcemap, options.minify);
    });

program.parse();
