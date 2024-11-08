import { GET, Optional } from "../../../src";

export default class API {
    @GET
    static get(
        @Optional
        optionalCatchAll: string
    ) {
        return `This is /r2 ${optionalCatchAll}`;
    }
}
