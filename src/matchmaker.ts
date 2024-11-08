import { sleep } from "bun";
import EventEmitter from "events";
import { io, type Socket } from "socket.io-client";
import * as ping from "ping";
import {
  GameServerClientDefault,
  GameServerWriteClient,
  type GameServerClientBuilder,
} from "./gameserver-client";

export interface GameMode {
  name: string;
  player_count: number;
  computer_lobby: boolean;
}

export interface SearchInfo {
  region: string;
  game: string;
  mode: GameMode;
}

export interface Search extends SearchInfo {
  player_id: string;
}

export interface Match {
  address: string;
  read: string;
  write: string;
}

export class MatchMaker<C extends GameServerWriteClient> extends EventEmitter {
  url: string;
  private socket: Socket;
  private ready: boolean = false;
  private readonly clientBuilder: GameServerClientBuilder<C>;
  private readonly userId: string;

  constructor(
    url: string,
    userId: string,
    clientBuilder?: GameServerClientBuilder<C>
  ) {
    super();
    this.userId = userId;

    this.url = url.at(-1) === "/" ? url.slice(0, -1) : url;
    this.socket = io(this.url + "/match", {
      autoConnect: true,
      reconnection: true,
      forceNew: true,
    });

    this.clientBuilder =
      clientBuilder ??
      (new GameServerClientDefault() as GameServerClientBuilder<C>);

    this.socket.on("connect_error", (err) => {
      throw err;
    });

    this.socket.on("connect_timeout", () => {
      throw new Error("Connection Timeout");
    });

    this.socket.on("connect", () => {
      this.ready = true;
    });

    this.socket.on("error", (err) => {
      throw err;
    });
  }

  async search(search_info: SearchInfo) {
    while (!this.ready) {
      await sleep(100);
    }
    let search: Search = { ...search_info, player_id: this.userId };
    this.socket.on("reject", this.onReject.bind(this));
    this.socket.on("match", this.onMatch.bind(this));

    this.socket.emit("search", search);
  }

  private onReject(data: any) {
    this.emit("reject", data);
  }

  private onMatch(data: any) {
    const match = data as Match;
    this.emit("match", this.clientBuilder.fromMatch(this.userId, match));
  }
}
