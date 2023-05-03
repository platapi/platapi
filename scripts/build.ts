import { OutputOptions, rollup } from "rollup";
import typescript from "@rollup/plugin-typescript";
import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import terser from "@rollup/plugin-terser";
import { optimizeLodashImports } from "@optimize-lodash/rollup-plugin";

import path from "path";
import fs from "fs-extra";
import { Utils } from "../src/Utils";

export async function build(configFilePath: string, generateSourcemaps: boolean = false) {
    const apiConfig = Utils.getAPIConfig(configFilePath);
    const buildDir = path.resolve(process.cwd(), "build");
    const cacheDir = path.resolve(buildDir, "cache");

    console.log("Cleaning up from previous build...");
    await fs.remove(buildDir);

    console.log("Generating server file...");
    let configFile = (await fs.readFile(configFilePath)).toString();
    const routes = Utils.generateAPIRoutesFromFiles(apiConfig.apiRootDirectory ?? "./api");

    const serverFile = `
    import { PlatAPI } from "../../src";
    
    const ___apiConfig:any ${configFile.replace("module.exports", "")}
    
    if(!___apiConfig.routes)
    {
        ___apiConfig.routes = [];
    }
    
    ${routes
        .map(
            route => `___apiConfig.routes.push({
    endpoint: "${route.endpoint}",
    import: () => import("${route.file!.replace(/.ts$/, "")}")
    });`
        )
        .join("\n")}
    
    module.exports.handler = new PlatAPI(___apiConfig).handler;
    `;

    await fs.outputFile(cacheDir + "/server.ts", serverFile);

    console.log("Bundling API...");
    const output: OutputOptions = {
        dir: buildDir,
        format: "cjs",
        sourcemap: generateSourcemaps
    };

    const bundle = await rollup({
        input: cacheDir + "/server.ts",
        output: output,
        plugins: [
            resolve({
                browser: false,
                preferBuiltins: true
            }),
            json(),
            commonjs(),
            typescript({
                sourceMap: generateSourcemaps,
                compilerOptions: {
                    module: "esnext",
                    target: "es2020",
                    outDir: undefined,
                    declarationDir: cacheDir
                }
            }),
            optimizeLodashImports(),
            terser()
        ]
    });

    await bundle.write(output);

    await bundle.close();

    console.log("Cleaning up build...");
    await fs.remove(cacheDir);
}
