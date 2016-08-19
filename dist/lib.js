/// <reference path="../typings/globals/node/index.d.ts" />
"use strict";
const tls = require('tls');
const net = require('net');
const fs = require('fs');
const factory_1 = require('./transferHandlers/factory');
const ftpLineEnd = '\r\n';
const ftpSeparator = ' ';
const env = process.env.NODE_ENV;
const debug = env !== 'production';
class FTP {
    constructor(options) {
        this.pendingCallbacks = [];
        this.options = options;
    }
    connect() {
        const connectionPromise = this.options.secure ? this.connectSecure() : this.connectUnSecure();
        if (this.options.secure)
            console.log('Starting connection in secure mode');
        else
            console.log('Starting connection in unsecure mode');
        return connectionPromise.then((socket) => {
            this.socket = socket;
            this.connected = true;
            this.handler = factory_1.default(this.options.handler, this.options.secure, this.options);
        });
    }
    connectUnSecure() {
        return new Promise((resolve, reject) => {
            const socket = net.connect({ host: this.options.host, port: this.options.port });
            socket.setEncoding('utf8');
            let first = true;
            socket.on('error', (error) => {
                const callback = this.pendingCallbacks.pop();
                if (callback)
                    callback(error);
                else
                    console.error('Uncaught error: ', error, error.stack);
            });
            socket.on('data', (data) => {
                if (debug)
                    console.log('[CONTROL]', data);
                if (first) {
                    first = false;
                    if (!data.startsWith('220'))
                        reject(data);
                    this.send(`USER ${this.options.user}`, socket).then((response) => {
                        if (response.startsWith('5'))
                            throw new Error(response);
                        return this.send(`PASS ${this.options.password}`, socket);
                    }).then((response) => {
                        if (response.startsWith('5'))
                            throw new Error(response);
                        resolve(socket);
                    }).catch(reject);
                }
                else {
                    const callback = this.pendingCallbacks.pop();
                    if (callback)
                        callback(null, data);
                }
            });
        });
    }
    connectSecure() {
        return new Promise((resolve, reject) => {
            const socket = net.connect({ host: this.options.host, port: this.options.port });
            socket.setEncoding('utf8');
            socket.on('data', (data) => {
                if (debug)
                    console.log('[CONTROL]', data);
                if (data.startsWith('220')) {
                    socket.write('AUTH TLS' + ftpLineEnd);
                }
                else if (data.startsWith('234')) {
                    this.createSecureSocket(socket, this.options).then(resolve, reject);
                }
                else
                    reject(data);
            });
            socket.on('error', reject);
        });
    }
    createSecureSocket(socket, options) {
        return new Promise((resolve, reject) => {
            // Control socket
            const tlsSocket = tls.connect({ socket: socket, rejectUnauthorized: options.tls.rejectUnauthorized });
            tlsSocket.setEncoding('utf8');
            tlsSocket.on('error', (error) => {
                const callback = this.pendingCallbacks.pop();
                if (callback)
                    callback(error);
                else
                    console.error('Uncaught error: ', error, error.stack);
            });
            tlsSocket.on('data', (data) => {
                if (!data)
                    return console.log('Empty Data Recieved');
                const callback = this.pendingCallbacks.pop();
                if (callback)
                    callback(null, data);
                else
                    console.error('Uncaught data: ', data);
            });
            tlsSocket.on('secureConnect', () => {
                this.send('PBSZ 0', tlsSocket).then((response) => {
                    if (response.startsWith('5'))
                        throw new Error(response);
                    return this.send(`USER ${options.user}`, tlsSocket);
                }).then((response) => {
                    if (response.startsWith('5'))
                        throw new Error(response);
                    return this.send(`PASS ${options.password}`, tlsSocket);
                }).then((response) => {
                    if (response.startsWith('5'))
                        throw new Error(response);
                    return this.send('PROT P', tlsSocket);
                }).then((response) => {
                    if (response.startsWith('5'))
                        throw new Error(response);
                    resolve(tlsSocket);
                }).catch(reject);
            });
        });
    }
    send(command, socket) {
        const target = socket ? socket : this.socket;
        return new Promise((resolve, reject) => {
            this.pendingCallbacks.push((error, data) => {
                if (error)
                    reject(error);
                if (debug)
                    console.log('[CONTROL]', data);
                resolve(data);
            });
            const message = `${command}${ftpLineEnd}`;
            if (debug)
                console.log('[SENDING CONTROL]', message);
            target.write(message);
        });
    }
    nlist(path) {
        return new Promise((resolve, reject) => {
            let files;
            this.send(this.handler.message).then((handlerResponse) => {
                const command = path ? `NLST${ftpSeparator}${path}` : `NLST`;
                const promises = [];
                const sendPromise = this.send(command).then((response) => {
                    if (response.startsWith('5'))
                        reject(response);
                    this.pendingCallbacks.push((error, value) => {
                        if (debug)
                            console.log('[CONTROL]', value);
                        if (error)
                            return reject(error);
                        if (value.startsWith('5'))
                            reject(value);
                        resolve(files);
                    });
                    return [response];
                });
                const getDataPromise = this.handler.getData(handlerResponse).then((data) => {
                    return data.split(ftpLineEnd).filter((value) => value ? true : false);
                });
                promises.push(sendPromise);
                promises.push(getDataPromise);
                Promise.all(promises).then((values) => {
                    files = values[1];
                });
            });
        });
    }
    get(remotePath) {
        return this.send(this.handler.message).then((handlerResponse) => {
            const command = `RETR${ftpSeparator}${remotePath}`;
            this.send(command).then((response) => {
                if (response.startsWith('5'))
                    return socket.emit('error', response);
                this.pendingCallbacks.push((error, value) => {
                    if (debug)
                        console.log('[CONTROL]', value);
                    if (error)
                        return socket.emit('error', error);
                    if (value.startsWith('5'))
                        return socket.emit('error', value);
                    socket.emit('getEnd', value);
                });
            });
            const socket = this.handler.getSocket(handlerResponse);
            return socket;
        });
    }
    put(remotePath, stream) {
        return new Promise((resolve, reject) => {
            stream.on('error', reject);
            this.send(this.handler.message).then((handlerResponse) => {
                const command = `STOR${ftpSeparator}${remotePath}`;
                const sendPromise = this.send(command).then(() => {
                    this.pendingCallbacks.push((error, value) => {
                        if (debug)
                            console.log('[CONTROL]', value);
                        if (error)
                            reject(error);
                        resolve();
                    });
                });
                const socket = this.handler.getSocket(handlerResponse);
                socket.on('error', reject);
                stream.pipe(socket);
                return sendPromise;
            });
        });
    }
    upload(localPath, remotePath) {
        const readStream = fs.createReadStream(localPath);
        return this.put(remotePath, readStream).then((data) => {
            readStream.close();
            return data;
        });
    }
    download(remotePath, localPath) {
        return new Promise((resolve, reject) => {
            this.get(remotePath).then((socket) => {
                const writeStream = fs.createWriteStream(localPath);
                socket.on('error', reject);
                socket.on('getEnd', (value) => {
                    writeStream.close();
                    resolve(value);
                });
                socket.pipe(writeStream);
            });
        });
    }
    rename(from, to) {
        return this.send(`RNFR${ftpSeparator}${from}`).then((rnfrResponse) => {
            if (rnfrResponse.startsWith('5'))
                throw new Error(rnfrResponse);
            return this.send(`RNTO${ftpSeparator}${to}`);
        }).then((rntoResponse) => {
            if (rntoResponse.startsWith('5'))
                throw new Error(rntoResponse);
            return rntoResponse;
        });
    }
    quit() {
        return this.send('quit');
    }
}
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = FTP;
