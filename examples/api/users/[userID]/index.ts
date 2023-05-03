import { Get } from "../../../../src";
import { User } from "../../../src/User";

export default class SampleAPI {
    @Get
    static async getUserByID(userID: string): Promise<User> {
        return {
            id: userID,
            firstName: "Jill",
            lastName: "Johnson"
        };
    }
}
