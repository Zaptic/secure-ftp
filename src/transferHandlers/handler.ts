'use strict';

import * as tls from 'tls';
import * as net from 'net';
import {FTPOptions} from '../interfaces';
import {Duplex} from 'stream';

const env = process.env.NODE_ENV;
const debug = env !== 'production';

abstract class Handler {
    private secure: boolean;
    protected options: FTPOptions;
    public socket: Duplex;
    public message: string;

    constructor(secure: boolean, options: FTPOptions) {
        this.secure = secure;
        this.options = options;
    }

    protected abstract parse(message: string): {host: string, port: number};

    protected getSecureSocket(options: {host: string, port: number, rejectUnauthorized?: boolean}): Duplex {
        options.rejectUnauthorized = this.options.tls.rejectUnauthorized;
        return tls.connect(options);
    }

    private static getUnSecureSocket(options: {host: string, port: number}): Duplex {
        return net.createConnection(options);
    }

    getSocket(message: string): Duplex {
        const options = this.parse(message);
        const socket = this.secure ? this.getSecureSocket(options) : Handler.getUnSecureSocket(options);

        socket.setEncoding('utf8');
        socket.pause();
        this.socket = socket;

        return socket;
    }

    getData(message: string): Promise<string> {
        return new Promise((resolve, reject) => {
            const socket = this.getSocket(message);

            let data = '';

            socket.on('data', (part: string) => {
                data += part;
            });

            socket.on('close', () => {
                if (debug) console.log('[RECEIVED DATA]', data);
                resolve(data);
            });
            socket.on('error', reject);

            socket.resume();
        });
    }
}


export default Handler;
