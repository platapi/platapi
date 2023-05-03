import { PlatAPI, PlatAPIConfigObject } from "../src";
import { Utils } from "../src/Utils";

const config: PlatAPIConfigObject = Utils.getAPIConfig();
module.exports = new PlatAPI(config);
