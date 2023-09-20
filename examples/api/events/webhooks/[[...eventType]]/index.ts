import { Body, Optional, Path, POST } from "../../../../../src";

export default class SampleAPI {
    @POST
    static async saveEvent(
        @Path
        @Optional
        eventType: string,
        @Body
        event: any
    ): Promise<string> {
        return eventType ?? "none";
    }
}
