import { BearerToken, GET, Logger, PlatAPILogger } from "../../../../src";
import { User } from "../../../src/User";

export default class SampleAPI {
    @GET
    static async getUserByID(
        userID: string,
        @BearerToken
        accessToken: string
    ): Promise<User> {
        return {
            id: userID,
            firstName: "Jill",
            lastName: "Johnson"
        };
    }
}
