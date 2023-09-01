import { BearerToken, GET, AllHeaders, Logger, PlatAPILogger, Request, Header } from "../../../../src";
import { User } from "../../../src/User";

export default class SampleAPI {
    @GET
    static async getUserByID(
        userID: string,
        @Header
        blah: any
    ): Promise<User> {
        return {
            id: userID,
            firstName: "Jill",
            lastName: "Johnson"
        };
    }
}
