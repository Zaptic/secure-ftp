# secure-ftp
A light FTP, FTPs library without external dependencies written in typescript.

At Zaptic we use this library for our FTP integrations and it can be considered production ready but is not necessarily bug free. 
It does not implement every methods from the RFC spec but we are open to adding them as the need arises.


## Installation
This package is available via NPM:
```
yarn add @zaptic-external/secure-ftp
```
or
```
npm install --save @zaptic-external/secure-ftp
```

## Usage

In typescript (not sure this code compiles by just copy pasting but it should be straight forward):
```typescript
import FTPS from '@zaptic-external/secure-ftp'

async function main() {
    const options = {
        host: 'ftp.example.com',
        port: '22', 
        username: '', // The remote user
        password: '', // The password for that user
        secure: true, // Enables SSL
        tls: { 
            rejectUnauthorized: false // Makes sure the server's certificate is valid 
        }
    }
    
    // This initialisealizes the FTPS object but will not open a connection
    const ftp = new FTPS(options)

    
    // Connects to the ftps server. You might want to check for possible errors
    await ftp.connect()

    try {
        // Transfers the file under localPath to the ftp server remotePath
        await ftp.upload(localPath, remotePath)

        // Downloads the file to the local path
        await ftp.download(remotePath, localPath)

        // Downloads the file and load it in memory
        // You might not want to do that with large files
        const fileContent = await ftp.get(remotePath)

        // Streams the content of the stream to the remote file
        await ftp.put(remotePath, stream)

        // Removes the said file from the ftp server
        await ftp.remove(remotePath)

        const remoteFolderContent = await ftp.nlist(remoteFolder)
    } catch (error) {
        // Do some error handling
    } finally {
        // This will close the connection. Make sure you always call that
        await this.ftp.quit()
    }
}
```
