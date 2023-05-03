import { Cookie, Get, Header, Optional, Options, Post, Put, Request, Patch, Body } from "../../../../src";
import { Persons, Person } from "../../../sample-types/Person";

export default class SampleAPIWithPathParams {
    @Get
    static getAValue(
        pathParam1: string,
        pathParam2: string,
        @Header
        headerParam: string,
        @Cookie
        cookieParam: string
    ): Persons {
        return [];
    }

    /**
     * Post a value
     * @param pathParam1
     * @param pathParam2 A description
     * @param optionalParam1 - A description with a dash
     * @param {string} optionalParam2 - A description with a type and dash— the type is ignored.
     *
     * @description Post a value description
     * @summary Post a value summary
     * @tags Posting
     */
    @Post
    static async postAValue(
        pathParam1: string,
        pathParam2: string,
        @Request
        req: any,
        @Optional
        optionalParam1: string,
        optionalParam2?: string
    ): Promise<Person> {
        return {
            firstName: "John",
            lastName: "Doe"
        };
    }

    @Patch
    static patchAValue(
        pathParam1: string,
        pathParam2: string,
        @Body
        person: Person
    ): Persons {
        return [];
    }

    @Put
    private static privateEndpoint1(pathParam1: string, pathParam2: string) {}

    /**
     * @private
     * @param pathParam1
     * @param pathParam2
     */
    @Options
    static privateEndpoint2(pathParam1: string, pathParam2: string) {}
}
