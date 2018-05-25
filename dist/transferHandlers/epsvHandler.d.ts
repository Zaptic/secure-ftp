import { FTPSOptions } from '../interfaces';
import TransferHandler from './handler';
export default class EPSVHandler extends TransferHandler {
    constructor(secure: boolean, options: FTPSOptions);
    protected parse(message: string): {
        host: string;
        port: number;
    };
}
