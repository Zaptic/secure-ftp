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
const filter = /.*\.csf/;
ftp.connect().then(() => {
    return ftp.nlist('incoming');
}).then((files) => {
    const filesToProcess = files.filter((file) => filter.test(file));
    if (filesToProcess.length === 0)
        throw new Error('No files matching the expression');
    return ftp.get(filesToProcess[0]);
}).then((stream) => {
    return new Promise((resolve, reject) => {
        let data = '';
        stream.on('data', (chunk) => {
            data += chunk;
        });
        stream.on('getEnd', () => {
            resolve(data);
        });
        stream.on('error', reject);
        stream.resume();
    });
}).then((data) => {
    console.log('Done');
    console.log(data);
}).then(() => {
    ftp.quit();
}).catch(console.error);
