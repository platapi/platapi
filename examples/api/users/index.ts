import { Body, POST } from "../../../src";
import { User } from "../../src/User";

export default class SampleAPI {
    @POST
    static async createUser(
        @Body
        user: User
    ): Promise<User> {
        return user;
    }
}
