import { Cookie, POST, Header, BodyPart, Optional, Docs, GET } from "../../src";
import { Person } from "../sample-types/Person";

export default class SampleAPI {
    @GET
    static postWithPartialBody(
        @BodyPart
        bodyParam1: string,
        @BodyPart
        bodyParam2: number = 5,
        @BodyPart
        bodyParam3?: Person
    ) {}
}
