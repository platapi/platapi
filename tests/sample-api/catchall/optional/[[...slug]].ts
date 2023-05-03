import { Get, Optional } from "../../../../src";

export default class SampleAPI {
    @Get
    static getEndpoint(
        @Optional
        slug?: string
    ) {
        return slug;
    }
}
