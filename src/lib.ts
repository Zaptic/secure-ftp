import * as tls from 'tls'
import * as net from 'net'
import * as fs from 'fs'
import { Stream, Duplex } from 'stream'

import TransferHandler from './transferHandlers/handler'
import getHandler from './transferHandlers/factory'
import { FTPSOptions } from './interfaces'
import { Callback } from './helpers/typeHelpers'

const ftpLineEnd = '\r\n'
const ftpSeparator = ' '
const debug = process.env.DEBUG_SECURE_FTP === 'true'

// spec for FTP: https://www.ietf.org/rfc/rfc959.txt
// spec for FTPS: https://tools.ietf.org/html/rfc4217
/* tslint:disable:no-console unified-signatures */
export default class FTPS {
    private readonly options: FTPSOptions
    private socket: Duplex // Duplex is the only common type between net.Socket and tls.ClearTextStream
    private handler: TransferHandler
    private responseHandler: ResponseHandler

    constructor(options: FTPSOptions) {
        this.options = options
        this.responseHandler = new ResponseHandler()
    }

    public connect() {
        const connectionPromise = this.options.secure ? this.connectSecure() : this.connectInsecure()
        return connectionPromise.then((socket: Duplex) => {
            this.socket = socket
            this.handler = getHandler(this.options.handler, this.options.secure, this.options)
        })
    }

    public nlist(path?: string): Promise<string[]> {
        return new Promise((resolve, reject) => {
            this.send(this.handler.message).then(handlerResponse => {
                const command = path ? `NLST${ftpSeparator}${path}` : `NLST`

                const sendPromise = new Promise<string[]>((resolveInner, rejectInner) => {
                    this.send(command).then(response => {
                        // 5yz "Permanent Negative Completion reply". see spec at the top of the file
                        if (response.startsWith('5')) return rejectInner(response)

                        this.responseHandler.registerCallback((error, value) => {
                            if (error) return rejectInner(error)
                            if (value.startsWith('5')) return rejectInner(value)

                            resolveInner([])
                        })
                    })
                })

                const getDataPromise = this.handler.getData(handlerResponse).then(data => {
                    return data.split(ftpLineEnd).filter(value => (value ? true : false))
                })

                Promise.all([sendPromise, getDataPromise])
                    .then(values => {
                        resolve(values[1])
                    })
                    .catch(reject)
            })
        })
    }

    public get(remotePath: string) {
        return this.send(this.handler.message).then(handlerResponse => {
            const command = `RETR${ftpSeparator}${remotePath}`
            let isDone = false
            let lastValue: string

            this.send(command).then(response => {
                if (response.startsWith('5')) return socket.emit('error', response)

                this.responseHandler.registerCallback((error, value) => {
                    if (error) return socket.emit('error', error)
                    if (value.startsWith('5')) return socket.emit('error', value)

                    // Protecting against race condition between this callback and the socket end event
                    if (isDone) socket.emit('getEnd', value)
                    else {
                        lastValue = value
                        isDone = true
                    }
                })
            })

            const socket = this.handler.getSocket(handlerResponse)

            socket.on('end', () => {
                // Protecting against race condition between this socket end and the send callback
                if (isDone) socket.emit('getEnd', lastValue)
                else isDone = true
            })

            return socket
        })
    }

    public put(remotePath: string, stream: Stream): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            stream.on('error', reject)

            this.send(this.handler.message).then(handlerResponse => {
                const command = `STOR${ftpSeparator}${remotePath}`

                const sendPromise = this.send(command).then(() => {
                    this.responseHandler.registerCallback(error => {
                        if (error) return reject(error)
                        resolve()
                    })
                })

                const socket = this.handler.getSocket(handlerResponse)

                socket.on('error', reject)
                stream.pipe(socket)

                return sendPromise
            })
        })
    }

    public upload(localPath: string, remotePath: string) {
        const readStream = fs.createReadStream(localPath)
        return this.put(remotePath, readStream).then(_ => {
            readStream.close()
        })
    }

    public download(remotePath: string, localPath: string) {
        return new Promise((resolve, reject) => {
            this.get(remotePath).then(socket => {
                const writeStream = fs.createWriteStream(localPath)

                socket.on('error', reject)
                socket.on('getEnd', (value: string) => {
                    writeStream.close()
                    resolve(value)
                })

                socket.pipe(writeStream)
            })
        })
    }

    public rename(from: string, to: string) {
        return this.send(`RNFR${ftpSeparator}${from}`)
            .then(rnfrResponse => {
                if (rnfrResponse.startsWith('5')) throw new Error(rnfrResponse)
                return this.send(`RNTO${ftpSeparator}${to}`)
            })
            .then(rntoResponse => {
                if (rntoResponse.startsWith('5')) throw new Error(rntoResponse)
                return rntoResponse
            })
    }

    public remove(remotePath: string) {
        return this.send(`DELE${ftpSeparator}${remotePath}`).then(deleResponse => {
            if (deleResponse.startsWith('5')) throw new Error(deleResponse)
            return deleResponse
        })
    }

    public quit() {
        return this.send('quit')
    }

    private connectInsecure() {
        return new Promise((resolve, reject) => {
            const socket = net.connect({ host: this.options.host, port: this.options.port })
            socket.setEncoding('utf8')

            let first = true

            socket.on('error', (error: Error) => this.responseHandler.handleError(error))

            socket.on('data', (data: string) => {
                if (!first) return this.responseHandler.handleData(data)

                first = false
                // 220 "Service ready for new user". see spec at the top of the file
                if (!data.startsWith('220')) return reject(data)

                this.send(`USER${ftpSeparator}${this.options.username}`, socket)
                    .then(response => {
                        if (response.startsWith('5')) throw new Error(response)
                        return this.send(`PASS${ftpSeparator}${this.options.password}`, socket)
                    })
                    .then(response => {
                        if (response.startsWith('5')) throw new Error(response)
                        resolve(socket)
                    })
                    .catch(reject)
            })
        })
    }

    private connectSecure() {
        return new Promise((resolve, reject) => {
            const socket = net.connect({ host: this.options.host, port: this.options.port })
            socket.setEncoding('utf8')

            socket.on('data', (data: String) => {
                if (debug) console.log('[RECEIVED CONTROL]', data)

                if (data.startsWith('220')) {
                    if (debug) console.log('[SENDING CONTROL]', 'AUTH TLS' + ftpLineEnd)
                    socket.write('AUTH TLS' + ftpLineEnd)
                    // 234 "Specifies that the server accepts the authentication mechanism specified by the client,
                    // and the exchange of security data is complete.
                    // A higher level nonstandard code created by Microsoft."
                    // see https://en.wikipedia.org/wiki/List_of_FTP_server_return_codes
                } else if (data.startsWith('234')) {
                    this.createSecureSocket(socket, this.options).then(resolve, reject)
                } else reject(data)
            })

            socket.on('error', reject)
        })
    }

    private createSecureSocket(socket: Duplex, options: FTPSOptions) {
        return new Promise((resolve, reject) => {
            // Used to know if we are in a connecting state
            let connecting = true

            // Control socket
            const tlsSocket = tls.connect(<tls.ConnectionOptions>{
                socket,
                rejectUnauthorized: options.tls.rejectUnauthorized
            })
            tlsSocket.setEncoding('utf8')

            tlsSocket.on('error', (error: Error) => {
                if (connecting) return reject(error) // The connection failed
                this.responseHandler.handleError(error)
            })

            tlsSocket.on('data', (data: string) => this.responseHandler.handleData(data))

            tlsSocket.on('secureConnect', () => {
                connecting = false // We are not connecting anymore

                // PBSZ 0 indicates that no buffering is taking place and the data connection should not be encapsulated
                // Basically it says that we will be streaming rather than buffering.
                this.send(`PBSZ${ftpSeparator}0`, tlsSocket)
                    .then(response => {
                        if (response.startsWith('5')) throw new Error(response)
                        return this.send(`USER${ftpSeparator}${options.username}`, tlsSocket)
                    })
                    .then(response => {
                        if (response.startsWith('5')) throw new Error(response)
                        return this.send(`PASS${ftpSeparator}${options.password}`, tlsSocket)
                    })
                    .then(response => {
                        if (response.startsWith('5')) throw new Error(response)
                        // PROT P means that the connection is Private - NEVER CHANGE THIS TO A 'C' FOR CLEAR
                        return this.send(`PROT${ftpSeparator}P`, tlsSocket)
                    })
                    .then(response => {
                        if (response.startsWith('5')) throw new Error(response)
                        resolve(tlsSocket)
                    })
                    .catch(reject)
            })
        })
    }

    private send(command: string): Promise<string>
    private send(command: string, socket: Duplex): Promise<string>
    private send(command: string, socket?: Duplex): Promise<string> {
        const target = socket ? socket : this.socket

        return new Promise((resolve, reject) => {
            this.responseHandler.registerCallback((error, data) => {
                if (error) return reject(error)
                resolve(data)
            })

            const message = `${command}${ftpLineEnd}`

            if (debug) console.log('[SENDING CONTROL]', message)
            target.write(message)
        })
    }
}

// This should handle responses and callbacks
export class ResponseHandler {
    private pendingCallbacks: Callback<any>[] = []
    private multiLineMessageCode: string = null

    public registerCallback(callback: Callback<any>) {
        return this.pendingCallbacks.push(callback)
    }

    public handleData(data: string) {
        // Returning here should be fine but it might break one of the future message we receive depending on why
        // the server sends an empty packet.
        // So far I've never seen an empty one that bugged but if it happens it would be simpler to reproduce if we
        // log it on the spot
        if (!data) return console.log('Empty Data Received')

        // Multi-line stuff must look like "123-"
        // Multi-line message can be either multiple lines in one frame or multiple lines over multiple frames
        // right now we assume that each response will use either one or the other but not both
        //
        // See ftp spec https://tools.ietf.org/html/rfc959
        // > the format for multi-line replies is that the first line
        // will begin with the exact required reply code, followed
        // immediately by a Hyphen, "-"
        if (data[3] === '-') {
            if (debug) console.log('[RECEIVED CONTROL] [MULTI LINE]', data)
            this.multiLineMessageCode = data.slice(0, 3)

            // We need to check if the message is a multi-line message fully contained in one frame, in that case,
            // the last line should start with something that looks like "123 "
            const bits = data.split(ftpLineEnd)

            // All frames end with an ftpSeparator so the last entry in bits is always ''
            // We want to get the last meaningful line and see if it's the end of the data, if it is, we pretend like
            // we only
            if (bits.length < 1) return
            if (!bits[bits.length - 2].startsWith(`${this.multiLineMessageCode}${ftpSeparator}`)) return

            data = bits[bits.length - 2] + ftpLineEnd
        } else if (this.multiLineMessageCode !== null) {
            // End of multi-line stuff must look like "123 "
            // The decision here is that because we only use the ftp code for parsing we can afford to only
            // return the last line
            //
            // See ftp spec https://tools.ietf.org/html/rfc959
            // > To satisfy all factions, it was decided that both
            // the first and last line codes should be the same

            if (debug) console.log('[RECEIVED CONTROL] [MULTI LINE]', data)
            if (!data.startsWith(this.multiLineMessageCode)) return
        } else {
            if (debug) console.log('[RECEIVED CONTROL]', data)
        }

        this.multiLineMessageCode = null

        const callback = this.pendingCallbacks.pop()
        if (callback) callback(null, data)
        else console.error('Uncaught data: ', data)
    }

    public handleError(error: Error) {
        const callback = this.pendingCallbacks.pop()

        if (callback) callback(error)
        else console.error('Uncaught error: ', error, error.stack)
    }
}
