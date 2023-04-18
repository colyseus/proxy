import * as net from "net";
import { EventEmitter } from "events";

function connectCb1(){ return }

export class TcpClient extends EventEmitter  {
    die: boolean = false;
    remoteAddress: string = "";
    socket: net.Socket;
    maxLen: number;
    len: number = 0;
    buffer: Buffer = Buffer.allocUnsafe(0);

    constructor(port: number, host: string, maxLen: number=5, noDelay: boolean = false, connectCb: () => void = connectCb1) {
        super();
        this.socket = net.connect(port, host, () => {
            this.remoteAddress = this.socket.remoteAddress as string;
            connectCb();
        });
        this.socket.setNoDelay(noDelay);
        this.maxLen = maxLen;
        this.socket.on("close", (err) => {
            if (!this.die) {
                this.die = true;
                this.emit("close", err);
            }
        });
        this.socket.on("error", (err) => {
            if (!this.die) {
                this.die = true;
                this.emit("close", err);
            }
        });
        this.socket.on("data", (data) => {
            if (!this.die) {
            } else {
                this.close();
            }
        });
    }

    send(data: Buffer) {
        this.socket.write(data);
    }

    close() {
        this.socket.destroy();
        this.socket.emit("close");
    }
}


/**
 * Unpack
 */
 export function decode(socket: TcpClient, msg: Buffer) {
    let readLen = 0;
    while (readLen < msg.length) {
        if (socket.len === 0) //data length is unknown
        {
            socket.buffer = Buffer.concat([socket.buffer, Buffer.from([msg[readLen]])]);
            if (socket.buffer.length === 4) {
                socket.len = socket.buffer.readUInt32BE(0);
                if (socket.len > socket.maxLen || socket.len === 0) {
                    socket.close();
                    throw new Error("socket data length is longer then " + socket.maxLen + ", close it, " + socket.remoteAddress);
                    return;
                }
                socket.buffer = Buffer.allocUnsafe(socket.len);
            }
            readLen++;
        }
        else if (msg.length - readLen < socket.len)	// data not coming all
        {
            msg.copy(socket.buffer, socket.buffer.length - socket.len, readLen);
            socket.len -= (msg.length - readLen);
            readLen = msg.length;
        }
        else {
            msg.copy(socket.buffer, socket.buffer.length - socket.len, readLen, readLen + socket.len);

            readLen += socket.len;
            socket.len = 0;
            let data = socket.buffer;
            socket.buffer = Buffer.allocUnsafe(0);

            //data coming all
            socket.emit("data", data);
        }
    }
}