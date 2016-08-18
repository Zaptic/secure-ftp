/// <reference path="../typings/globals/node/index.d.ts" />

import * as tls from 'tls';
import * as net from 'net';
import * as fs from 'fs';
import {Callback, FTPOptions as Options, TLSOptions} from './interfaces';
import {TlsOptions} from 'tls';
import {Duplex} from 'stream';

import Handler from './transferHandlers/handler';
import getHandler from './transferHandlers/factory';

const ftpLineEnd = '\r\n';
const ftpSeparator = ' ';
const env = process.env.NODE_ENV;
const debug = env !== 'production';


export default class FTP {
    private options: Options;
    private pendingCallbacks: Callback<any>[] = [];
    socket: Duplex; // Duplex is the only common type between net.Socket and tls.ClearTextStream
    connected: boolean;
    handler: Handler;

    constructor(options: Options) {
        this.options = options
    }

    connect() {
        const connectionPromise = this.options.secure ? this.connectSecure() : this.connectUnSecure();
        if (this.options.secure) console.log('Starting connection in secure mode');
        else console.log('Starting connection in unsecure mode');
        return connectionPromise.then((socket: Duplex) => {
            this.socket = socket;
            this.connected = true;
            this.handler = getHandler(this.options.handler, this.options.secure, this.options);
        });
    }

    private connectUnSecure() {
        return new Promise((resolve, reject) => {
            const socket = net.connect({host: this.options.host, port: this.options.port});
            socket.setEncoding('utf8');

            let first = true;

            socket.on('error', (error: Error) => {
                const callback = this.pendingCallbacks.pop();

                if (callback) callback(error);
                else console.error('Uncaught error: ', error, error.stack);
            });

            socket.on('data', (data: string) => {
                if (debug) console.log('[CONTROL]', data);

                if (first) {
                    first = false;
                    if (!data.startsWith('220')) reject(data);

                    this.send(`USER ${this.options.user}`, socket).then((response) => {
                        if (response.startsWith('5')) throw new Error(response);
                        return this.send(`PASS ${this.options.password}`, socket);
                    }).then((response) => {
                        if (response.startsWith('5')) throw new Error(response);
                        resolve(socket);
                    }).catch(reject);
                } else {
                    const callback = this.pendingCallbacks.pop();
                    if (callback) callback(null, data);
                }
            });
        });
    }

    private connectSecure() {
        return new Promise((resolve, reject) => {
            const socket = net.connect({host: this.options.host, port: this.options.port});
            socket.setEncoding('utf8');

            socket.on('data', (data: String) => {
                if (debug) console.log('[CONTROL]', data);

                if (data.startsWith('220')) {
                    socket.write('AUTH TLS' + ftpLineEnd);
                } else if (data.startsWith('234')) {
                    this.createSecureSocket(socket, this.options).then(resolve, reject);
                } else reject(data);

            });

            socket.on('error', reject);
        });
    }

    private createSecureSocket(socket: Duplex, options: Options) {
        return new Promise((resolve, reject)=> {
            // Control socket
            const tlsSocket = tls.connect(<TlsOptions>{socket, rejectUnauthorized: options.tls.rejectUnauthorized});
            tlsSocket.setEncoding('utf8');

            tlsSocket.on('error', (error: Error) => {
                const callback = this.pendingCallbacks.pop();

                if (callback) callback(error);
                else console.error('Uncaught error: ', error, error.stack);
            });

            tlsSocket.on('data', (data: string) => {
                if (!data) return console.log('Empty Data Recieved');
                const callback = this.pendingCallbacks.pop();
                if (callback) callback(null, data);
                else console.error('Uncaught data: ', data);
            });

            tlsSocket.on('secureConnect', () => {
                this.send('PBSZ 0', tlsSocket).then((response) => {
                    if (response.startsWith('5')) throw new Error(response);
                    return this.send(`USER ${options.user}`, tlsSocket);
                }).then((response) => {
                    if (response.startsWith('5')) throw new Error(response);
                    return this.send(`PASS ${options.password}`, tlsSocket);
                }).then((response) => {
                    if (response.startsWith('5')) throw new Error(response);
                    return this.send('PROT P', tlsSocket);
                }).then((response) => {
                    if (response.startsWith('5')) throw new Error(response);
                    resolve(tlsSocket);
                }).catch(reject);
            })
        });
    }

    send(command: string): Promise<string>;
    send(command: string, socket: Duplex): Promise<string>;

    send(command: string, socket?: Duplex): Promise<string> {
        const target = socket ? socket : this.socket;

        return new Promise((resolve, reject) => {

            this.pendingCallbacks.push((error, data) => {
                if (error) reject(error);
                if (debug) console.log('[CONTROL]', data);
                resolve(data);
            });

            const message = `${command}${ftpLineEnd}`;

            if (debug) console.log('[SENDING CONTROL]', message);
            target.write(message);
        });
    }

    nlist(path?: string) {
        return new Promise((resolve, reject) => {
            let files: string[];

            this.send('EPSV').then((pasvResponse) => {
                const command = path ? `NLST${ftpSeparator}${path}` : `NLST`;
                const promises: PromiseLike<string[]>[] = [];

                const sendPromise = this.send(command).then((response) => {
                    if (response.startsWith('5')) reject(response);

                    this.pendingCallbacks.push((error, value) => {
                        if (debug) console.log('[CONTROL]', value);
                        if (error) return reject(error);
                        if (value.startsWith('5')) reject(value);

                        resolve(files);
                    });
                    return [response];
                });
                const getDataPromise = this.handler.getData(pasvResponse).then((data) => {
                    return data.split(ftpLineEnd).filter((value) => value ? true : false);
                });

                promises.push(sendPromise);
                promises.push(getDataPromise);

                Promise.all(promises).then((values) => {
                    files = values[1];
                })
            })
        });
    }

    get(remote: string) {
        return this.send('EPSV').then((pasvResponse) => {
            const command = `RETR${ftpSeparator}${remote}`;

            this.send(command).then((response) => {
                if (response.startsWith('5')) return socket.emit('error', response);

                this.pendingCallbacks.push((error, value) => {
                    if (debug) console.log('[CONTROL]', value);
                    if (error) return socket.emit('error', error);
                    if (value.startsWith('5')) return socket.emit('error', value);

                    socket.emit('getEnd', value);
                })
            });

            const socket = this.handler.getSocket(pasvResponse);

            return socket;
        })
    }

    download(remote: string, local: string) {
        return new Promise((resolve, reject) => {
            this.send('EPSV').then((pasvResponse) => {
                const command = `RETR${ftpSeparator}${remote}`;

                const sendPromise = this.send(command).then(() => {
                    this.pendingCallbacks.push((error, value) => {
                        if (debug) console.log('[CONTROL]', value);
                        if (error) reject(error);
                        resolve();
                    })
                });

                const socket = this.handler.getSocket(pasvResponse);
                const writeStream = fs.createWriteStream(local);

                socket.on('error', reject);
                socket.on('end', () => {
                    writeStream.close();
                });

                socket.pipe(writeStream);

                return sendPromise;
            })
        });
    }

    rename(from: string, to: string) {
        return this.send(`RNFR${ftpSeparator}${from}`).then((rnfrResponse) => {
            if (rnfrResponse.startsWith('5')) throw new Error(rnfrResponse);
            return this.send(`RNTO${ftpSeparator}${to}`)
        }).then((rntoResponse) => {
            if (rntoResponse.startsWith('5')) throw new Error(rntoResponse);
            return rntoResponse;
        });
    }

    quit() {
        return this.send('quit');
    }
}
