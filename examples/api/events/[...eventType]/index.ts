import { Body, Path, POST } from "../../../../src";

export default class SampleAPI {
    @POST
    static async saveEvent(
        @Path
        eventType: string,
        @Body
        event: any
    ): Promise<string> {
        return eventType;
    }
}
