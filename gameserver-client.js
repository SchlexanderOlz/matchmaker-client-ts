import EventEmitter from "events";
import { io } from "socket.io-client";
export class GameServerReadClient extends EventEmitter {
    url;
    readToken;
    socket;
    constructor(url, readToken) {
        super();
        this.readToken = readToken;
        this.url = "http://" + (url.at(-1) === "/" ? url.slice(0, -1) : url);
        this.socket = io(this.url + "/" + this.readToken, {
            autoConnect: true,
            reconnection: true,
            forceNew: true,
        });
        this.socket.on("connect_error", (err) => {
            throw err;
        });
        this.socket.on("connect_timeout", () => {
            throw new Error("Connection Timeout");
        });
        this.socket.on("error", (err) => {
            throw err;
        });
    }
}
export class GameServerClientDefault {
    fromMatch(userId, match) {
        return new GameServerWriteClient(userId, match);
    }
}
export class GameServerWriteClient extends GameServerReadClient {
    writeToken;
    userId;
    constructor(userId, match) {
        super(match.address, match.read);
        this.userId = userId;
        this.writeToken = match.write;
        this.socket.on("connect", () => {
            this.socket.emit("auth", this.writeToken);
        });
    }
    static fromMatch(userId, match) {
        return new GameServerWriteClient(userId, match);
    }
}
