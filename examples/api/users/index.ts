import { Body, PlatAPIFriendlyError, POST, ErrorReturn } from "../../../src";
import { User } from "../../src/User";

export default class SampleAPI {
    @POST
    @ErrorReturn<PlatAPIFriendlyError<500, "Unknown">>()
    @ErrorReturn<PlatAPIFriendlyError<421, "error1" | "error2">>()
    static async createUser(
        @Body
        user: User | string
    ): Promise<User | string> {
        return user;
    }
}
