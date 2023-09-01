import { BearerToken, GET, AllHeaders, Logger, PlatAPILogger, Request } from "../../../../src";
import { User } from "../../../src/User";

export default class SampleAPI {
    @GET
    static async getUserByID(
        userID: string,
        @AllHeaders
        headers: any
    ): Promise<User> {
        return {
            id: userID,
            firstName: "Jill",
            lastName: "Johnson"
        };
    }
}
