import { Cookie, GET, Header, Optional, OPTIONS, POST, PUT, Request, PATCH, Body } from "../../../../src";
import { Persons, Person } from "../../../sample-types/Person";

export default class SampleAPIWithPathParams {
    @GET
    static getAValue(
        pathParam1: string,
        pathParam2: string,
        @Header
        headerparam: string,
        @Cookie
        cookieParam: string
    ): string[] {
        return [pathParam1, pathParam2, headerparam, cookieParam];
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
    @POST
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

    @PATCH
    static patchAValue(
        pathParam1: string,
        pathParam2: string,
        @Body
        person: Person
    ): Persons {
        return [];
    }

    @PUT
    private static privateEndpoint1(pathParam1: string, pathParam2: string) {}

    /**
     * @private
     * @param pathParam1
     * @param pathParam2
     */
    @OPTIONS
    static privateEndpoint2(pathParam1: string, pathParam2: string) {}
}
