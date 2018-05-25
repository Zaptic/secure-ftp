import PASVHandler from './pasvHandler'
import EPSVHandler from './epsvHandler'
import { FTPSOptions } from '../interfaces'
import TransferHandler from './handler'

export default function getHandler(type: string, secure: boolean, options: FTPSOptions): TransferHandler {
    if (type === 'pasv') return new PASVHandler(secure, options)
    return new EPSVHandler(options.secure, options)
}
