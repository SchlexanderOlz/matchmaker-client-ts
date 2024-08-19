import EventEmitter from "events";
import type { Match } from "./matchmaker";
import { io, type Socket } from "socket.io-client";

export class GameServerReadClient extends EventEmitter {
  readonly url: string;
  protected readonly readToken: string;
  protected socket: Socket;

  constructor(url: string, readToken: string) {
    super();
    this.url = url.at(-1) === "/" ? url.slice(0, -1) : url;
    this.readToken = readToken;
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
    fromMatch(match: Match): T;
}


export class GameServerClientDefault implements GameServerClientBuilder<GameServerWriteClient> {
    fromMatch(match: Match): GameServerWriteClient {
        return new GameServerWriteClient(match);
    }
}


export class GameServerWriteClient extends GameServerReadClient {
  protected readonly writeToken: string;

  constructor(match: Match) {
    super(match.address, match.read);
    this.writeToken = match.write;

    this.socket.on("connected", () => {
        this.socket.emit("auth", this.writeToken);
    });
  }

  static fromMatch(match: Match): GameServerWriteClient {
    return new GameServerWriteClient(match);
  }
}
