import { Body, GET, POST, ValidateRequest } from "../../src";
import { Event } from "../src/Event";

export default class SampleAPI {
    @POST
    @GET
    @ValidateRequest((request, response) => {
        if (request.method === "GET") {
            throw new Error("something bad!");
        }
    })
    static async createEvent(
        @Body
        event: Event | Event[]
    ): Promise<Event | Event[]> {
        return event;
    }
}
