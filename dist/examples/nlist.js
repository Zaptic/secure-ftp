'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const lib_1 = require("../lib");
const options = {
    host: 'ftp.juliand.co.uk',
    port: 21,
    user: 'juliand-test',
    password: 'B5zLWXzakS1kGhOiLPFXUPoJHuZRDp',
    secure: true,
    tls: { rejectUnauthorized: false }
};
const ftp = new lib_1.default(options);
ftp.connect().then(() => {
    return ftp.nlist('incoming');
}).then((files) => {
    console.log('Done');
    console.log(files);
}).then(() => {
    ftp.quit();
}).catch(console.error);
