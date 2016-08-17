'use strict';
const handler_1 = require('./handler');
const epsvRegex = /\|([-\d]+)\|/;
class EPSVHandler extends handler_1.default {
    constructor(secure, options) {
        super(secure, options);
    }
    parse(message) {
        var parsedNumbers = epsvRegex.exec(message);
        if (!parsedNumbers)
            throw new Error(`Unable to parse EPSV response. Received: ${message}`);
        return {
            host: this.options.host,
            port: parseInt(parsedNumbers[1])
        };
    }
}
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = EPSVHandler;
