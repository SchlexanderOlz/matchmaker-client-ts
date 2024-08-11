import { EventEmitter } from "events";
import { io, type Socket } from "socket.io-client";
import * as ping from "ping";
import { sleep } from "bun";

export interface GameMode {
  name: string;
  player_count: number;
  computer_lobby: boolean;
}

export interface SearchInfo {
  player_id: string;
  game: string;
  mode: GameMode;
}

export interface Match {
  address: string;
  read: string;
  write: string;
}

export class MatchMaker extends EventEmitter {
  url: string;
  private socket: Socket;
  private ready: boolean = false;

  constructor(url: string) {
    super();
    this.url = url.at(-1) === "/" ? url.slice(0, -1) : url;
    this.socket = io(this.url + "/match", {
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
    this.socket.on("reject", this.onReject.bind(this));
    this.socket.on("servers", this.onServers.bind(this));
    this.socket.emit("search", search_info);
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
    this.emit("match", match);
  }

  private async pingRankServers(servers: string[]): Promise<string[]> {
    const ping = servers.map((server) => MatchMaker.pingServer(server));

    return await Promise.all(ping).then((pings) =>
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

      const pingTime = ping.promise.probe(server).then((res) => {
        if (res.alive) {
          resolve(Date.now() - start);
        }
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
