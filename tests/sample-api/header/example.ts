import { GET, Header } from "../../../src";

export default class SampleApiHeaders {
    @GET
    static getHeaders(
        @Header
        headerparam1: string,
        @Header
        HEADERPARAM2: string,
        @Header
        HeaderParam3: string
    ): string[] {
        return [headerparam1, HEADERPARAM2, HeaderParam3];
    }
}
