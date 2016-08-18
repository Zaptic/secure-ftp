import { FTPOptions } from '../interfaces';
import { Duplex } from 'stream';
declare abstract class Handler {
    private secure;
    protected options: FTPOptions;
    socket: Duplex;
    message: string;
    constructor(secure: boolean, options: FTPOptions);
    protected abstract parse(message: string): {
        host: string;
        port: number;
    };
    protected getSecureSocket(options: {
        host: string;
        port: number;
        rejectUnauthorized?: boolean;
    }): Duplex;
    private static getUnSecureSocket(options);
    getSocket(message: string): Duplex;
    getData(message: string): Promise<string>;
}
export default Handler;
