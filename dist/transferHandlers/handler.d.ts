/// <reference types="node" />
import { FTPSOptions } from '../interfaces';
import { Duplex } from 'stream';
declare abstract class TransferHandler {
    private static getUnSecureSocket(options);
    socket: Duplex;
    message: string;
    protected options: FTPSOptions;
    private readonly secure;
    protected constructor(secure: boolean, options: FTPSOptions);
    getSocket(message: string): Duplex;
    getData(message: string): Promise<string>;
    protected abstract parse(message: string): {
        host: string;
        port: number;
    };
    protected getSecureSocket(options: {
        host: string;
        port: number;
        rejectUnauthorized?: boolean;
    }): Duplex;
}
export default TransferHandler;
