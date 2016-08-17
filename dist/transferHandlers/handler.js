'use strict';
const tls = require('tls');
const net = require('net');
const env = process.env.NODE_ENV;
const debug = env !== 'production';
class Handler {
    constructor(secure, options) {
        this.secure = secure;
        this.options = options;
    }
    getSecureSocket(options) {
        options.rejectUnauthorized = this.options.tls.rejectUnauthorized;
        return tls.connect(options);
    }
    static getUnSecureSocket(options) {
        return net.createConnection(options);
    }
    getSocket(message) {
        const options = this.parse(message);
        const socket = this.secure ? this.getSecureSocket(options) : Handler.getUnSecureSocket(options);
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
}
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = Handler;
