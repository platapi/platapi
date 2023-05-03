import path from "path";
import { ClassDeclaration, MethodDeclaration, Project, SourceFile, SyntaxKind, Type } from "ts-morph";
import { OpenAPIObject } from "openapi3-ts/oas31";
import { OperationObject, ParameterObject, ResponsesObject, SchemaObject } from "openapi3-ts/src/model/openapi31";
import * as TJS from "typescript-json-schema";
import crypto from "crypto";
import fs from "fs";
import os from "os";
import { PlatAPI } from "../PlatAPI";
import defaultsDeep from "lodash/defaultsDeep";
import isString from "lodash/isString";
import set from "lodash/set";
import { Utils } from "../Utils";
import { PlatAPIConfig, PlatAPIConfigObject, PlatAPIRoute } from "../Types";

const HTTP_METHODS = ["get", "post", "put", "patch", "delete", "head", "options", "trace"];

const docProject = new Project({
    tsConfigFilePath: path.join(process.cwd(), "tsconfig.json")
});

const HAPI_SUCCESS_SCHEMA = {
    type: "object",
    properties: {
        this: {
            type: "string",
            const: "succeeded"
        }
    },
    required: ["this", "with"]
};

const HAPI_FAILURE_SCHEMA = {
    type: "object",
    properties: {
        this: {
            type: "string",
            const: "failed"
        },
        with: {
            type: "number"
        }
    },
    required: ["this", "with"]
};

export class DocGenerator {
    static async generateDocs(config: PlatAPIConfig): Promise<OpenAPIObject> {
        const configObject = Utils.getAPIConfig(config);
        const apiRootDirectory = path.resolve(configObject.apiRootDirectory);

        const apiSpec: OpenAPIObject = {
            openapi: "3.1.0",
            info: configObject.info,
            paths: {},
            components: {
                schemas: {}
            }
        };

        // Get all of our API routes
        const routes = Utils.generateAPIRoutesFromFiles(apiRootDirectory);

        // Change route param formats from :param to {param}
        routes.forEach(route => (route.endpoint = route.endpoint.replace(/:(.+?)(\/|$)/g, `{$1}$2`)));
        const typeDefs = new Set<string>();

        // Loop through all of our endpoints and extract all types from them
        DocGenerator._forEachEndpoint(routes, (route, method, httpMethodName) => {
            let partialBodyTypes: { name: string; type: string; optional: boolean }[] = [];

            for (let parameter of method.getParameters()) {
                const isPartialBodyParam = !!parameter.getDecorator("Body");
                const isOptional = !!parameter.getDecorator("Optional") || parameter.isOptional();
                const parameterType = parameter.getType();
                const parameterTypeDef = DocGenerator._generateTypeDefinition(parameterType);
                if (parameterTypeDef) {
                    if (isPartialBodyParam) {
                        partialBodyTypes.push({
                            name: parameter.getName(),
                            type: DocGenerator._getTypeString(parameterType),
                            optional: isOptional
                        });
                    } else {
                        typeDefs.add(parameterTypeDef);
                    }
                }
            }

            if (partialBodyTypes.length > 0) {
                const partialBodyTypeProps = partialBodyTypes.map(pbt => `${pbt.name}${pbt.optional ? "?" : ""}: ${pbt.type}`).join(";");
                typeDefs.add(`export interface _PartialBodyType${DocGenerator._createHash(route.endpoint + method)} {${partialBodyTypeProps}};`);
            }

            const returnTypeDef = DocGenerator._generateTypeDefinition(method.getReturnType());
            if (returnTypeDef) {
                typeDefs.add(returnTypeDef);
            }
        });

        // Generate a typescript file with all of our types
        const typeDefsString = [...typeDefs].join("\n");
        const typeDefFilename = path.join(os.tmpdir(), `${DocGenerator._createHash(typeDefsString)}.ts`);
        await fs.promises.writeFile(typeDefFilename, typeDefsString);

        const schemaProgram = TJS.getProgramFromFiles([typeDefFilename], {
            skipLibCheck: true
        });

        DocGenerator._forEachEndpoint(routes, (route, method, httpMethodName, sourceFile) => {
            const pathParamNames = [...route.endpoint.matchAll(/\{(.+?)}/g)].map(match => match[1]);

            let endpoint: OperationObject = {
                summary: DocGenerator._toSentenceCase(method.getName()),
                parameters: [],
                responses: {}
            };

            const [docs] = method.getJsDocs();
            const paramDescriptions: Record<string, string> = {};
            let isPublicEndpoint = true;
            let requestBodyType: Type | undefined = undefined;

            if (docs) {
                endpoint.description = docs.getDescription();

                for (const tag of docs.getTags()) {
                    switch (tag.getTagName()) {
                        case "arg":
                        case "argument":
                        case "param": {
                            const paramDescription = tag.getCommentText();
                            if (paramDescription && (tag as any).getName) {
                                paramDescriptions[(tag as any).getName() as string] = paramDescription.replace(/^[\s-]*/, "");
                            }
                            break;
                        }
                        case "description": {
                            endpoint.description = tag.getCommentText();
                            break;
                        }
                        case "private": {
                            isPublicEndpoint = false;
                            break;
                        }
                        case "summary": {
                            endpoint.summary = tag.getCommentText();
                            break;
                        }
                        case "deprecated": {
                            endpoint.deprecated = true;
                            break;
                        }
                        case "tags": {
                            const tags = tag.getCommentText();
                            if (tags) {
                                endpoint.tags = tags.split(/\s*,\s*/);
                            }
                            break;
                        }
                    }
                }
            }

            if (!isPublicEndpoint) {
                return;
            }

            for (const parameter of method.getParameters()) {
                const paramName = parameter.getName();
                let isPublicParameter = true;

                const param: ParameterObject = {
                    name: paramName,
                    description: paramDescriptions[paramName] ?? DocGenerator._toSentenceCase(paramName),
                    in: "query",
                    required: !parameter.isOptional()
                };

                if (pathParamNames.includes(paramName)) {
                    param.in = "path";
                }

                for (const decorator of parameter.getDecorators()) {
                    const decoratorName = decorator.getName();

                    switch (decoratorName) {
                        case "BodyPart": {
                            isPublicParameter = false;
                            break;
                        }
                        case "Body": {
                            isPublicParameter = false;
                            requestBodyType = parameter.getType();
                            break;
                        }
                        case "Optional": {
                            param.required = false;
                            break;
                        }
                        case "Required": {
                            param.required = true;
                            break;
                        }
                        case "Path": {
                            param.in = "path";
                            break;
                        }
                        case "Cookie": {
                            param.in = "cookie";
                            break;
                        }
                        case "Query": {
                            param.in = "query";
                            break;
                        }
                        case "Header": {
                            param.in = "header";
                            break;
                        }
                        case "AllCookies":
                        case "AllPath":
                        case "AllQuery":
                        case "AllHeaders":
                        case "Logger":
                        case "Response":
                        case "Request": {
                            isPublicParameter = false;
                            break;
                        }
                    }
                }

                if (!isPublicParameter) {
                    continue;
                }

                param.schema = DocGenerator._generateAPISchema(parameter.getType(), apiSpec, schemaProgram);

                endpoint.parameters?.push(param);
            }

            let requestBodySchema = DocGenerator._generateAPISchema(
                requestBodyType ?? `_PartialBodyType${DocGenerator._createHash(route.endpoint + method)}`,
                apiSpec,
                schemaProgram
            );

            if (requestBodySchema) {
                switch (requestBodySchema.type) {
                    case "object":
                    case "array": {
                        endpoint.requestBody = {
                            content: {
                                "application/json": {
                                    schema: requestBodySchema
                                }
                            }
                        };
                        break;
                    }
                }
            }

            const returnType = method.getReturnType();
            endpoint.responses = DocGenerator._generateResponseSchema(returnType, apiSpec, schemaProgram, configObject);

            // Does this method have any overriding documentation?
            const docsDecorator = method.getDecorator("Docs");
            if (!!docsDecorator) {
                try {
                    const apiModule = require(sourceFile.getFilePath()).default;
                    // @ts-ignore
                    const [handlerSettings] = PlatAPI._getManagedHandler(apiModule, httpMethodName);
                    if (handlerSettings.docs) {
                        endpoint = {
                            ...endpoint,
                            ...handlerSettings.docs
                        };
                    }
                } catch (e) {
                }
            }

            set(apiSpec.paths!, [route.endpoint, httpMethodName], endpoint);
        });

        return apiSpec;
    }

    private static _generateResponseSchema(type: Type, apiSpec: OpenAPIObject, program: TJS.Program, config: PlatAPIConfigObject): ResponsesObject {
        const responses: ResponsesObject = {};

        let returnTypeSchema = DocGenerator._generateAPISchema(type, apiSpec, program);

        if (returnTypeSchema) {
            if (config.returnFriendlyResponses) {
                returnTypeSchema = defaultsDeep({}, HAPI_SUCCESS_SCHEMA, {
                    properties: {
                        with: returnTypeSchema
                    }
                }) as any;
            }

            switch (returnTypeSchema?.type) {
                case "object":
                case "array": {
                    responses["200"] = {
                        description: "Successful Response",
                        content: {
                            "application/json": {
                                schema: returnTypeSchema
                            }
                        }
                    };
                    break;
                }
            }
        }

        return responses;
    }

    private static _generateAPISchema(type: Type | string, apiSpec: OpenAPIObject, program: TJS.Program, defaultValue?: any): SchemaObject | undefined {
        const parameterTypeName = isString(type) ? (type as string) : DocGenerator._generateTypeDefinitionName(type);

        try {
            let schema = TJS.generateSchema(program, parameterTypeName, {
                required: true,
                skipLibCheck: true
            });

            if (schema) {
                schema = DocGenerator._normalizeSchema(schema);

                if (defaultValue) {
                    switch (schema.type) {
                        case "number": {
                            schema.default = Number(defaultValue);
                            break;
                        }
                        case "boolean": {
                            schema.default = defaultValue === "true" || defaultValue === true;
                            break;
                        }
                        default: {
                            schema.default = defaultValue;
                            break;
                        }
                    }
                }

                const { definitions, ...restOfSchema } = schema;
                if (definitions) {
                    apiSpec.components!.schemas = {
                        ...apiSpec.components!.schemas,
                        ...(definitions as any)
                    };
                }

                return restOfSchema as SchemaObject;
            }
        } catch (e) {
            //console.error("_generateAPISchema", e);
        }
    }

    private static _normalizeSchema(schema: TJS.Definition): TJS.Definition {
        let defString = JSON.stringify(schema);
        defString = defString.replace(/#\/definitions\//g, "#/components/schemas/");
        const returnSchema = JSON.parse(defString);
        delete returnSchema["$schema"];
        return returnSchema;
    }

    private static _toSentenceCase(inputString: string): string {
        // Replace capital letters with a space and the lowercase version of the same letter
        const result = inputString.replace(/([A-Z0-9])/g, " $1").toLowerCase();
        // Capitalize the first letter of the first word
        return result.charAt(0).toUpperCase() + result.slice(1);
    }

    private static _forEachEndpoint(routes: PlatAPIRoute[], predicate: (route: PlatAPIRoute, method: MethodDeclaration, httpMethodName: string, sourceFile: SourceFile) => void) {
        for (let route of routes) {
            if (!route.file) {
                continue;
            }

            const sourceFile = docProject.getSourceFile(route.file);

            if (!sourceFile) {
                continue;
            }

            const defaultClass = sourceFile.getClasses().find(cls => cls.isDefaultExport());

            if (!defaultClass) {
                continue;
            }

            const endpointMethods = DocGenerator._getEndpointMethods(defaultClass);

            if (endpointMethods.length === 0) {
                continue;
            }

            for (let method of endpointMethods) {
                // Skip private methods
                if (method.hasModifier(SyntaxKind.PrivateKeyword)) {
                    continue;
                }

                const httpMethodName = DocGenerator._getHTTPMethodForClassMethod(method);

                if (!httpMethodName) {
                    continue;
                }

                predicate(route, method, httpMethodName, sourceFile);
            }
        }
    }

    private static _generateTypeDefinitionName(type: Type): string {
        return `_Type${DocGenerator._createHash(DocGenerator._getTypeString(type))}`;
    }

    private static _getTypeString(type: Type): string {
        return type
            .getNonNullableType()
            .getText()
            .replace(/Promise<(.+?)>/g, "$1");
    }

    private static _isNilType(type: Type): boolean {
        const rawTypeName = DocGenerator._getTypeString(type);
        return rawTypeName === "undefined" || rawTypeName === "void" || rawTypeName === "never";
    }

    private static _generateTypeDefinition(type: Type, ignoreNil: boolean = true): string | undefined {
        if (ignoreNil && DocGenerator._isNilType(type)) {
            return;
        }

        const rawTypeName = DocGenerator._getTypeString(type);

        const exportedTypeName = DocGenerator._generateTypeDefinitionName(type);
        return `export type ${exportedTypeName} = ${rawTypeName};`;
    }

    private static _getHTTPMethodForClassMethod(method: MethodDeclaration): string | undefined {
        const decorators = method.getDecorators();

        for (const decorator of decorators) {
            let decoratorName = decorator.getName().toLowerCase();
            if (HTTP_METHODS.includes(decoratorName)) {
                return decoratorName;
            }
        }
    }

    private static _getEndpointMethods(cls: ClassDeclaration): MethodDeclaration[] {
        return cls.getMethods().filter(method => {
            return !!DocGenerator._getHTTPMethodForClassMethod(method);
        });
    }

    private static _createHash(value: any): string {
        return crypto.createHash("sha256").update(value).digest("hex");
    }
}
