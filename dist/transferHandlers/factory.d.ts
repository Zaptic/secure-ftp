import { FTPOptions } from '../interfaces';
import Handler from './handler';
export default function getHandler(type: string, secure: boolean, options: FTPOptions): Handler;
