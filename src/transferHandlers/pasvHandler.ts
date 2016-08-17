'use strict';

import {FTPOptions} from '../interfaces';
import Handler from './handler';

// Regex parsing the PASSV reply to get the ip and port for data transmission
// See PASVHandler.parse for more details
const pasvRegex = /([-\d]+,[-\d]+,[-\d]+,[-\d]+),([-\d]+),([-\d]+)/;

export default class PASVHandler extends Handler {
    constructor(secure: boolean, options: FTPOptions) {
        super(secure,options)
    }

    protected parse(message: string) {
        // According to the spec https://www.ietf.org/rfc/rfc959.txt (p44)
        // we need to extract the ip and port from the PASV response that looks like
        // "227 Entering Passive Mode  A1,A2,A3,A4,a1,a2" where A is the ip and a the port.
        var parsedNumbers = pasvRegex.exec(message);

        if (!parsedNumbers) throw new Error(`Unable to parse PASV response. Received: ${message}`);

        return {
            host: parsedNumbers[1].replace(/,/g, '.'),
            port: (parseInt(parsedNumbers[2], 10) & 255) * 256 + (parseInt(parsedNumbers[3], 10) & 255)
        };
    }
}
