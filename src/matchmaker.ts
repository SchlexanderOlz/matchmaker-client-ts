import EventEmitter from "events";
import { io, type Socket } from "socket.io-client";

import {
  GameServerClientDefault,
  GameServerWriteClient,
  type GameServerClientBuilder,
} from "./gameserver-client.js";

export interface SearchInfo {
  region: string;
  game: string;
  mode: string;
  ai: boolean;
}

export interface HostRequestInfo {
  region: string;
  game: string;
  mode: string;
  public: boolean;
}

export interface HostRequest extends HostRequestInfo {
  session_token: string;
}

export interface HostInfo {
  host_id: string;
}

export interface Search extends SearchInfo {
  session_token: string;
}

export interface Match {
  address: string;
  read: string;
  write: string;
  players: string[];
}

interface MatchMakingEvents {
  match: GameServerWriteClient;
  reject: string;
  _servers: string[];
  host_info: HostInfo;
}

export class MatchMaker<C extends GameServerWriteClient> extends EventEmitter {
  url: string;
  private socket: Socket;
  private ready: boolean = false;
  private readonly clientBuilder: GameServerClientBuilder<C>;
  private readonly userId: string;
  private readonly sessionToken: string;

  constructor(
    url: string,
    userId: string,
    sessionToken: string,
    clientBuilder?: GameServerClientBuilder<C>
  ) {
    super();
    this.userId = userId;
    this.sessionToken = sessionToken;

    this.url = url.at(-1) === "/" ? url.slice(0, -1) : url;
    this.socket = io(this.url + "/match", {
      autoConnect: true,
      reconnection: true,
      forceNew: true,
      transports: ["websocket", "polling"],
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
      this.socket.on("reject", this.onReject.bind(this));
      this.socket.on("match", this.onMatch.bind(this));
    });

    this.socket.on("error", (err) => {
      throw err;
    });
  }

  public on<K extends keyof MatchMakingEvents>(
    event: K,
    listener: (payload: MatchMakingEvents[K]) => void
  ): this {
    return super.on(event, listener);
  }

  public emit<K extends keyof MatchMakingEvents>(
    event: K,
    payload?: MatchMakingEvents[K]
  ): boolean {
    return super.emit(event, payload);
  }

  static async wait(t: number) {
    return new Promise((resolve) => setTimeout(resolve, t));
  }

  async search(search_info: SearchInfo) {
    while (!this.ready) {
      await MatchMaker.wait(100);
    }
    let search: Search = { ...search_info, session_token: this.sessionToken };
    this.socket.emit("search", search);
  }

  async host(host_info: HostRequestInfo): Promise<HostInfo> {
    while (!this.ready) {
      await MatchMaker.wait(100);
    }
    let host: HostRequest = { ...host_info, session_token: this.sessionToken };

    this.socket.on("host_info", (info) => this.emit("host_info", info));

    this.socket.emit("host", host);

    return new Promise((resolve) => {
      this.once("host_info", (info) => {
        resolve(info);
      });
    })
  }

  async join_pub(host_id: string) {
    while (!this.ready) {
      await MatchMaker.wait(100);
    }

    this.socket.emit("join", {
      host_id: host_id,
      session_token: this.sessionToken,
    });
  }

  async join_priv(join_token: string) {
    while (!this.ready) {
      await MatchMaker.wait(100);
    }

    this.socket.emit("join", {
      join_token: join_token,
      session_token: this.sessionToken,
    });
  }

  async join(host_id?: string, join_token?: string) {
    if (host_id) {
      this.join_pub(host_id);
    } else if (join_token) {
      this.join_priv(join_token);
    }
  }

  private onReject(data: any) {
    this.emit("reject", data);
  }

  private onMatch(data: any) {
    const match = data as Match;
    this.emit("match", this.clientBuilder.fromMatch(this.userId, match));
  }
}
