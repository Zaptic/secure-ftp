'use strict';

import PASVHandler from './pasvHandler';
import EPSVHandler from './epsvHandler';
import {FTPOptions} from '../interfaces';
import Handler from './handler';

export default function getHandler(type: string, secure: boolean, options: FTPOptions) : Handler {
    if (type === 'pasv') return new PASVHandler(options.secure, options);
    else return new EPSVHandler(options.secure, options);
}
