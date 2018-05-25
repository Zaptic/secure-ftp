"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tls = require("tls");
const net = require("net");
const debug = Boolean(process.env.DEBUG);
// We are logging for debug purposes
// tslint:disable:no-console
class TransferHandler {
    static getUnSecureSocket(options) {
        return net.createConnection(options);
    }
    constructor(secure, options) {
        this.secure = secure;
        this.options = options;
    }
    getSocket(message) {
        const options = this.parse(message);
        const socket = this.secure ? this.getSecureSocket(options) : TransferHandler.getUnSecureSocket(options);
        socket.setEncoding('utf8');
        socket.pause();
        this.socket = socket;
        return socket;
    }
    getData(message) {
        return new Promise((resolve, reject) => {
            const socket = this.getSocket(message);
            let data = '';
            socket.on('data', (part) => {
                data += part;
            });
            socket.on('close', () => {
                if (debug)
                    console.log('[RECEIVED DATA]', data);
                resolve(data);
            });
            socket.on('error', reject);
            socket.resume();
        });
    }
    getSecureSocket(options) {
        options.rejectUnauthorized = this.options.tls.rejectUnauthorized;
        return tls.connect(options);
    }
}
exports.default = TransferHandler;
