import { OutputOptions, Plugin, rollup } from "rollup";
import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import terser from "@rollup/plugin-terser";
import { optimizeLodashImports } from "@optimize-lodash/rollup-plugin";

import path from "path";
import fs from "fs-extra";
import { Utils } from "../src/Utils";
import { collectGarbage, logMemory } from "../src/MemoryUtils";

type TypeScriptModule = typeof import("typescript");

function getTypeScriptModule(): TypeScriptModule {
    try {
        return require(require.resolve("typescript", {
            paths: [process.cwd()]
        }));
    } catch (e) {
        return require("typescript");
    }
}

function transpileTypeScript(generateSourcemaps: boolean): Plugin {
    const ts = getTypeScriptModule();

    return {
        name: "platapi-transpile-typescript",
        transform(code, id) {
            if (!/\.tsx?$/.test(id)) {
                return null;
            }

            const output = ts.transpileModule(code, {
                fileName: id,
                compilerOptions: {
                    module: ts.ModuleKind.ESNext,
                    target: ts.ScriptTarget.ES2020,
                    sourceMap: generateSourcemaps,
                    experimentalDecorators: true,
                    emitDecoratorMetadata: true,
                    esModuleInterop: true,
                    allowSyntheticDefaultImports: true,
                    resolveJsonModule: true
                }
            });

            return {
                code: output.outputText,
                map: output.sourceMapText ? JSON.parse(output.sourceMapText) : null
            };
        }
    };
}

export async function build(configFilePath: string, generateSourcemaps: boolean = false, minify: boolean = true) {
    const apiConfig = Utils.getAPIConfig(configFilePath);
    const buildDir = path.resolve(process.cwd(), "build");
    const cacheDir = path.resolve(buildDir, "cache");

    console.log("Cleaning up from previous build...");
    await fs.remove(buildDir);
    logMemory("build:after-clean");

    console.log("Generating server file...");
    const routes = Utils.generateAPIRoutesFromFiles(apiConfig.apiRootDirectory ?? "./api");
    logMemory("build:after-route-scan");

    const serverFile = `
import { PlatAPI } from "platapi";
// @ts-ignore
import ___apiConfig from "${path.resolve(process.cwd(), configFilePath)}";

if(!___apiConfig.routes)
{
    ___apiConfig.routes = [];
}
    
    ${routes
        .map(
            route => `
___apiConfig.routes.push({
    endpoint: "${route.endpoint.replace(/\\/g, "\\\\")}",
    import: () => import("${route.file!.replace(/.ts$/, "")}")
});
    `
        )
        .join("\n")}
    
module.exports.handler = new PlatAPI(___apiConfig).handler;
    `;

    await fs.outputFile(cacheDir + "/server.ts", serverFile);
    collectGarbage();
    logMemory("build:after-server-file");

    console.log("Bundling API...");
    const output: OutputOptions = {
        dir: buildDir,
        format: "cjs",
        sourcemap: generateSourcemaps
    };

    const plugins = [
        commonjs(),
        resolve({
            browser: false,
            preferBuiltins: true,
            exportConditions: ["node"],
            extensions: [".mjs", ".js", ".json", ".node", ".ts", ".tsx"]
        }),
        json(),
        transpileTypeScript(generateSourcemaps),
        optimizeLodashImports()
    ];

    if (minify) {
        plugins.push(
            terser({
                mangle: false
            })
        );
    }

    const bundle = await rollup({
        input: cacheDir + "/server.ts",
        output: output,
        onwarn(warning, warn) {
            if (warning.code === "THIS_IS_UNDEFINED") {
                return;
            }

            warn(warning);
        },
        plugins: plugins
    });
    collectGarbage();
    logMemory("build:after-rollup");

    await bundle.write(output);
    collectGarbage();
    logMemory("build:after-write");

    await bundle.close();
    collectGarbage();
    logMemory("build:after-close");

    console.log("Cleaning up build...");
    await fs.remove(cacheDir);
}
