import { PlatAPI, PlatAPIConfig } from "../src";
import { Utils } from "../src/Utils";

const config: PlatAPIConfig = Utils.getAPIConfig();
module.exports = new PlatAPI(config);
