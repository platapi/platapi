import { GET } from "../../../src";

export default class API {
    @GET
    static get(catchAll: string) {
        return catchAll;
    }
}
