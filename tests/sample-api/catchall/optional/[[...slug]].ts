import { GET, Optional } from "../../../../src";

export default class SampleAPI {
    @GET
    static getEndpoint(
        @Optional
        slug?: any[]
    ) {
        return Object.fromEntries((slug ?? []).map((value, index) => [index, value]));
    }
}
