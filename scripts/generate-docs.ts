#!/usr/bin/env node

import { DocGenerator } from "../src/docgen/DocGenerator";
import fs from "fs-extra";
import defaultsDeep from "lodash/defaultsDeep";
import { PlatAPIConfigObject } from "../src";
import { Utils } from "../src/Utils";

const { program } = require("commander");

program
    .name("generate-docs")
    .description("PlatAPI documentation generator")
    .version("0.1.0")
    .option("-d --defaultSpecFile <string>", "the default OpenAPI 3.1 spec for your API— this will be merged in with the generated documentation")
    .option("-c --config <string>", "the location of your api.config.ts or api.config.js file", "./api.config.js")
    .option("-o, --outfile <string>", "output docs to a file, otherwise will print to console.")
    .action(async (options: any) => {
        const config: PlatAPIConfigObject = Utils.getAPIConfig(options.config);

        let docs = await DocGenerator.generateDocs(config);

        if (options.defaultSpecFile) {
            const defaultSpecFile = await fs.readJson(options.defaultSpecFile);
            docs = defaultsDeep({}, defaultSpecFile, docs);
        }

        if (options.outfile) {
            await fs.ensureFile(options.outfile);
            await fs.writeJSON(options.outfile, docs);
            return;
        }

        if (!options.outfile) {
            console.log(JSON.stringify(docs, null, 4));
            return;
        }
    });

program.parse();
