export interface Callback<T> {
    (error: Error, data?: T): void;
}

export interface FTPOptions {
    host: string
    port: number
    user: string
    password: string
    secure: boolean
    handler?: 'pasv' | 'epsv'
    tls: TLSOptions
}

export interface TLSOptions {
    rejectUnauthorized: boolean
}
