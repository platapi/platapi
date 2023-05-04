import { BearerToken, GET, Logger } from "../../../../src";
import { User } from "../../../src/User";

export default class SampleAPI {
    @GET
    static async getUserByID(
        userID: string,
        @BearerToken
        accessToken: string,
        @Logger
        logger: string
    ): Promise<User> {
        console.log(accessToken);

        return {
            id: userID,
            firstName: "Jill",
            lastName: "Johnson"
        };
    }
}
