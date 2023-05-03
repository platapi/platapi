import { Post, WholeBody } from "../../../src";
import { User } from "../../src/User";

export default class SampleAPI {
    @Post
    static async createUser(
        @WholeBody
        user: User
    ): Promise<User> {
        return user;
    }
}
