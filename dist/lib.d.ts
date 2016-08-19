/// <reference path="../typings/globals/node/index.d.ts" />
import { FTPOptions as Options } from './interfaces';
import { Duplex } from 'stream';
import Handler from './transferHandlers/handler';
import { Stream } from 'stream';
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
    nlist(path?: string): Promise<{}>;
    get(remotePath: string): Promise<Duplex>;
    put(remotePath: string, stream: Stream): Promise<{}>;
    upload(localPath: string, remotePath: string): Promise<{}>;
    download(remotePath: string, localPath: string): Promise<{}>;
    rename(from: string, to: string): Promise<string>;
    quit(): Promise<string>;
}
