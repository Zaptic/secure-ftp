import { FTPSOptions } from '../interfaces';
import TransferHandler from './handler';
export default function getHandler(type: string, secure: boolean, options: FTPSOptions): TransferHandler;
