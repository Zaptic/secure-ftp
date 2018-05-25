export interface FTPSOptions {
    host: string;
    port: number;
    username: string;
    password: string;
    secure: boolean;
    handler?: 'pasv' | 'epsv';
    tls: TLSOptions;
}
export interface TLSOptions {
    rejectUnauthorized: boolean;
}
