import { Body, Post } from "../../../src";
import { User } from "../../src/User";

export default class SampleAPI {
    @Post
    static async createUser(
        @Body
        user: User
    ): Promise<User> {
        return user;
    }
}
