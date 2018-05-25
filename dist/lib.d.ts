/// <reference types="node" />
import { Stream, Duplex } from 'stream';
import { FTPSOptions } from './interfaces';
import { Callback } from './helpers/typeHelpers';
export default class FTPS {
    private readonly options;
    private socket;
    private handler;
    private responseHandler;
    constructor(options: FTPSOptions);
    connect(): Promise<void>;
    nlist(path?: string): Promise<string[]>;
    get(remotePath: string): Promise<Duplex>;
    put(remotePath: string, stream: Stream): Promise<void>;
    upload(localPath: string, remotePath: string): Promise<void>;
    download(remotePath: string, localPath: string): Promise<{}>;
    rename(from: string, to: string): Promise<string>;
    remove(remotePath: string): Promise<string>;
    quit(): Promise<string>;
    private connectInsecure();
    private connectSecure();
    private createSecureSocket(socket, options);
    private send(command);
    private send(command, socket);
}
export declare class ResponseHandler {
    private pendingCallbacks;
    private multiLineMessageCode;
    registerCallback(callback: Callback<any>): number;
    handleData(data: string): void;
    handleError(error: Error): void;
}
