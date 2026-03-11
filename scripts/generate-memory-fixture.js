#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const root = path.resolve(process.cwd(), ".tmp/large-api");

const branchFactor = 8;
const depth = 4;
const routeCount = 180;

fs.rmSync(root, { recursive: true, force: true });
fs.mkdirSync(path.join(root, "api"), { recursive: true });
fs.mkdirSync(path.join(root, "types"), { recursive: true });

const config = `module.exports = {
  apiRootDirectory: "./.tmp/large-api/api",
  info: { title: "Large API", version: "1.0.0" }
};
`;

fs.writeFileSync(path.join(root, "api.config.js"), config);

for (let i = 0; i < routeCount; i++) {
    const typeName = `Entity${i}`;
    let typeSource = "";

    for (let level = 0; level < depth; level++) {
        const interfaceName = `${typeName}Level${level}`;
        const nextType = level + 1 < depth ? `${typeName}Level${level + 1}` : "string";
        typeSource += `export interface ${interfaceName} {\n`;

        for (let branch = 0; branch < branchFactor; branch++) {
            typeSource += `  field${level}_${branch}: ${nextType}${level + 1 < depth ? "[]" : ""};\n`;
        }

        typeSource += "}\n\n";
    }

    typeSource += `export type ${typeName} = ${typeName}Level0;\n`;
    typeSource += `export interface ${typeName}Query {\n`;

    for (let q = 0; q < 12; q++) {
        typeSource += `  q${q}${q % 3 === 0 ? "?" : ""}: string | number | boolean;\n`;
    }

    typeSource += "}\n";
    typeSource += `export interface ${typeName}Body {\n`;

    for (let q = 0; q < 10; q++) {
        typeSource += `  b${q}${q % 2 === 0 ? "?" : ""}: ${typeName}Level1;\n`;
    }

    typeSource += "}\n";
    typeSource += `export class ${typeName}Error extends Error {\n  statusCode = 500 as const;\n  friendlyMessage = "${typeName} failed";\n  id = "${typeName.toLowerCase()}";\n}\n`;

    fs.writeFileSync(path.join(root, "types", `${typeName}.ts`), typeSource);

    const routeSource = `import { Body, ErrorReturn, GET, POST, Query } from "platapi";\nimport { ${typeName}, ${typeName}Body, ${typeName}Error, ${typeName}Query } from "../types/${typeName}";\n\nexport default class ${typeName}API {\n  @GET\n  @ErrorReturn<${typeName}Error>()\n  static get(@Query query: ${typeName}Query): Promise<${typeName}> {\n    return Promise.resolve({} as ${typeName});\n  }\n\n  @POST\n  @ErrorReturn<${typeName}Error>()\n  static post(@Body body: ${typeName}Body): Promise<${typeName}Body> {\n    return Promise.resolve(body);\n  }\n}\n`;

    fs.writeFileSync(path.join(root, "api", `route-${i}.ts`), routeSource);
}

console.log(root);
