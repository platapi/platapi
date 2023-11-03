import { Body, PlatAPIFriendlyError, POST, ErrorReturn, GET, PlatAPI } from "../../../src";
import { User } from "../../src/User";

export default class SampleAPI {
    @GET
    @ErrorReturn<PlatAPIFriendlyError<500, "Unknown">>()
    @ErrorReturn<PlatAPIFriendlyError<421, "error1" | "error2">>()
    static async createUser(
        @Body
        user: User | string
    ): Promise<User | string> {
        throw PlatAPI.createAPIFriendlyError({ hello: "world" });
        return user;
    }
}
