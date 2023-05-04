import { GET } from "../../../../../src";

export default class SampleAPI {
    @GET
    static getEndpoint(slug: string) {
        return slug;
    }
}
