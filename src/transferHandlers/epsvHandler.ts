'use strict';

import {FTPOptions} from '../interfaces';
import Handler from './handler';

const epsvRegex = /\|([-\d]+)\|/;

export default class EPSVHandler extends Handler {
    constructor(secure: boolean, options: FTPOptions) {
        super(secure, options);
        this.message = 'EPSV';
    }

    protected parse(message: string) {
        var parsedNumbers = epsvRegex.exec(message);

        if (!parsedNumbers) throw new Error(`Unable to parse EPSV response. Received: ${message}`);

        return {
            host: this.options.host,
            port: parseInt(parsedNumbers[1])
        };
    }
}
