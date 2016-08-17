/// <reference path="../typings/globals/node/index.d.ts" />
import { FTPOptions as Options } from './interfaces';
import { Duplex } from 'stream';
import Handler from './transferHandlers/handler';
export default class FTP {
    private options;
    private pendingCallbacks;
    socket: Duplex;
    connected: boolean;
    handler: Handler;
    constructor(options: Options);
    connect(): Promise<void>;
    private connectUnSecure();
    private connectSecure();
    private createSecureSocket(socket, options);
    send(command: string): Promise<string>;
    send(command: string, socket: Duplex): Promise<string>;
    nlist(path?: string): Promise<any>;
    get(path: string): Promise<any>;
    rename(from: string, to: string): Promise<string>;
}
