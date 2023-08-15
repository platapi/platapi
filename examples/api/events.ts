import { Body, POST } from "../../src";
import { Event } from "../src/Event";

export default class SampleAPI {
    @POST
    static async createEvent(
        @Body
        event: Event | Event[]
    ): Promise<void> {
        throw new Error("something bad!");
    }
}
