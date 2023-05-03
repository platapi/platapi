import { Get } from "../../../../../src";

export default class SampleAPI {
    @Get
    static getEndpoint(slug: string) {
        return slug;
    }
}
