"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const pasvHandler_1 = require("./pasvHandler");
const epsvHandler_1 = require("./epsvHandler");
function getHandler(type, secure, options) {
    if (type === 'pasv')
        return new pasvHandler_1.default(secure, options);
    return new epsvHandler_1.default(options.secure, options);
}
exports.default = getHandler;
