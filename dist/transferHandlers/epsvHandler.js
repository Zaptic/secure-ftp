"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const handler_1 = require("./handler");
const epsvRegex = /\|([-\d]+)\|/;
class EPSVHandler extends handler_1.default {
    constructor(secure, options) {
        super(secure, options);
        this.message = 'EPSV';
    }
    parse(message) {
        const parsedNumbers = epsvRegex.exec(message);
        if (!parsedNumbers)
            throw new Error(`Unable to parse EPSV response. Received: ${message}`);
        return {
            host: this.options.host,
            port: parseInt(parsedNumbers[1], 10)
        };
    }
}
exports.default = EPSVHandler;
