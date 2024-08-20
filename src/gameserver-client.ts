import EventEmitter from "events";
import type { Match } from "./matchmaker";
import { io, type Socket } from "socket.io-client";

export class GameServerReadClient extends EventEmitter {
  readonly url: string;
  protected readonly readToken: string;
  protected socket: Socket;

  constructor(url: string, readToken: string) {
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



export interface GameServerClientBuilder<T> {
    fromMatch(userId: string, match: Match): T;
}


export class GameServerClientDefault implements GameServerClientBuilder<GameServerWriteClient> {
    fromMatch(userId: string, match: Match): GameServerWriteClient {
        return new GameServerWriteClient(userId, match);
    }
}


export class GameServerWriteClient extends GameServerReadClient {
  protected readonly writeToken: string;
  protected readonly userId: string;

  constructor(userId: string, match: Match) {
    super(match.address, match.read);
    this.userId = userId;
    this.writeToken = match.write;

    this.socket.on("connect", () => {
        this.socket.emit("auth", this.writeToken);
    });
  }

  static fromMatch(userId: string, match: Match): GameServerWriteClient {
    return new GameServerWriteClient(userId, match);
  }
}
