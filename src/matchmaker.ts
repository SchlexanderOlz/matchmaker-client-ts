import EventEmitter from "events";
import { io, type Socket } from "socket.io-client";
import ping from 'web-pingjs';

import {
  GameServerClientDefault,
  GameServerWriteClient,
  type GameServerClientBuilder,
} from "./gameserver-client.js";

export interface GameMode {
  name: string;
  player_count: number;
  computer_lobby: boolean;
}

export interface SearchInfo {
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

interface MatchMakingEvents {
  match: GameServerWriteClient;
  reject: string;
  _servers: string[];
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
      transports: ["websocket", "polling"]
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
  };


  async search(search_info: SearchInfo) {
    while (!this.ready) {
      await MatchMaker.wait(100);
    }
    let search: Search = { ...search_info, player_id: this.userId };
    this.socket.on("reject", this.onReject.bind(this));
    this.socket.on("servers", this.onServers.bind(this));
    this.socket.emit("search", search);
  }

  private async onServers(data: any) {
    const servers = data as string[];
    const ranked = await this.pingRankServers(servers);

    this.socket.emit("servers", ranked);
    this.socket.on("match", this.onMatch.bind(this));
    this.emit("_servers", ranked);
  }

  private onReject(data: any) {
    this.emit("reject", data);
  }

  private onMatch(data: any) {
    const match = data as Match;
    this.emit("match", this.clientBuilder.fromMatch(this.userId, match));
  }

  private async pingRankServers(servers: string[]): Promise<string[]> {
    const ping = servers.map((server) => {
      server = server.split(":")[0] || server;
      return MatchMaker.pingServer(server);
    });

    return Promise.all(ping).then((pings) =>
      servers
        .map((server, index) => {
          return { server, ping: pings[index] };
        })
        .sort((a, b) => a.ping - b.ping)
        .map((server) => server.server)
    );
  }

  private static async pingServer(
    server: string,
    timeout: number = 2000
  ): Promise<number> {
    return new Promise((resolve, reject) => {
      const start = Date.now();

      const pingTime = ping(server).then(() => {
        resolve(Date.now() - start);
      }).catch(() => {
        reject(new Error(`Ping ${server} failed`));
      });

      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Ping ${server} timed out`));
        }, timeout);
      });

      Promise.race([pingTime, timeoutPromise]).catch(reject);
    });
  }
}