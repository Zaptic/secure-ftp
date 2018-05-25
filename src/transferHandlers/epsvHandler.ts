import { FTPSOptions } from '../interfaces'
import TransferHandler from './handler'

const epsvRegex = /\|([-\d]+)\|/

export default class EPSVHandler extends TransferHandler {
    constructor(secure: boolean, options: FTPSOptions) {
        super(secure, options)
        this.message = 'EPSV'
    }

    protected parse(message: string) {
        const parsedNumbers = epsvRegex.exec(message)

        if (!parsedNumbers) throw new Error(`Unable to parse EPSV response. Received: ${message}`)

        return {
            host: this.options.host,
            port: parseInt(parsedNumbers[1], 10)
        }
    }
}
