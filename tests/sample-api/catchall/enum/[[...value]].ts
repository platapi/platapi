import { GET, Optional } from "../../../../src";

enum PetSpecies {
    Dog,
    Cat
}

export default class SampleAPI {
    @GET
    static getEndpoint(
        @Optional
        value?: PetSpecies[]
    ) {
        return value;
    }
}
