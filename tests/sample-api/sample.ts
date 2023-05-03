import { Cookie, Post, Header, BodyPart, Optional, Docs, Get } from "../../src";
import { Person } from "../sample-types/Person";

export default class SampleAPI {
    @Get
    static postWithPartialBody(
        @BodyPart
        bodyParam1: string,
        @BodyPart
        bodyParam2: number = 5,
        @BodyPart
        bodyParam3?: Person
    ) {}
}
