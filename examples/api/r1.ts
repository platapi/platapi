import { ALL, GET, POST } from "../../src";

export default class API {
    @ALL
    static get() {
        return "This is route /r1!";
    }
}
