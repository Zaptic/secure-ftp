import { FTPOptions } from '../interfaces';
import Handler from './handler';
export default class EPSVHandler extends Handler {
    constructor(secure: boolean, options: FTPOptions);
    protected parse(message: string): {
        host: string;
        port: number;
    };
}
