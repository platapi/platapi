import { GET, Optional } from "../../../../src";

export default class SampleAPI {
    @GET
    static getEndpoint(
        @Optional
        slug?: string
    ) {
        return slug;
    }
}
