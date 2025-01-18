import EventEmitter from "events";
import type { Match } from "./matchmaker.js";
import { io, type Socket } from "socket.io-client";

interface TimeoutThreat {
  timestamp: number;
  timeout: number;
}

interface Timeout {
  user_id: string;
  reason: string;
}

export class GameServerReadClient extends EventEmitter {
  readonly url: string;
  readonly readToken: string;
  readonly game: string;
  readonly mode: string;
  protected socket: Socket;
  protected latestEvent: { timestamp: number } = { timestamp: 0 };

  constructor(url: string, readToken: string, game: string, mode: string) {
    super();
    this.readToken = readToken;
    this.game = game;
    this.mode = mode;
    this.url = url.match(/^https?:\/\//)
      ? url
      : "https://" + (url.at(-1) === "/" ? url.slice(0, -1) : url);
    this.socket = io(this.url + "/" + this.readToken, {
      autoConnect: true,
      reconnection: true,
      forceNew: true,
      transports: ["websocket", "polling"],
    });

    this.socket.on("connect_error", (err) => {
      this.emit("error", err);
    });

    this.socket.onAny((event, ...args) => {
      if (args[0].timestamp) {
        this.latestEvent = args[0];
      }
    });

    this.socket.on("connect_timeout", () => {
      this.emit("error", new Error("Connection Timeout"));
    });

    this.socket.on("error", (err) => {
      this.emit("error", err);
    });
  }

  sync(timestamp?: number) {
    this.socket.emit(
      "sync",
      timestamp ? timestamp : this.latestEvent.timestamp
    );
  }
}

export interface GameServerClientBuilder<T> {
  fromMatch(userId: string, match: Match): T;
}

export class GameServerClientDefault
  implements GameServerClientBuilder<GameServerWriteClient>
{
  fromMatch(userId: string, match: Match): GameServerWriteClient {
    return new GameServerWriteClient(userId, match);
  }
}

export interface GameServerWriteClientEvents {
  threaten_timeout: TimeoutThreat;
  timeout_in: number; 
  timeout: Timeout;
  cancel_timeout_threat: void;
  error: Error;
}

export class GameServerWriteClient extends GameServerReadClient {
  public readonly writeToken: string;
  public readonly userId: string;
  public readonly opponents: string[] = [];

  public on<K extends keyof GameServerWriteClientEvents>(
    event: K,
    listener: (payload: GameServerWriteClientEvents[K]) => void
  ): this {
    return super.on(event, listener);
  }

  public emit<K extends keyof GameServerWriteClientEvents>(
    event: K,
    payload?: GameServerWriteClientEvents[K]
  ): boolean {
    return super.emit(event, payload);
  }

  constructor(userId: string, match: Match) {
    super(match.address, match.read, match.game, match.mode);
    this.userId = userId;
    this.writeToken = match.write;
    this.opponents = match.players.filter((player) => player !== userId);

    this.socket.on("connect", () => {
      this.socket.emit("auth", this.writeToken);
    });

    this.socket.on("threaten_timeout", (data: TimeoutThreat) => {
      this.emit("threaten_timeout", data);

      const current_time = new Date().getTime();
      const delta = current_time - new Date(data.timestamp / 1000).getTime();
      const timeout = data.timeout - delta;

      this.emit("timeout_in", timeout);
    });

    this.socket.on("cancel_timeout_threat", () => {
      this.emit("cancel_timeout_threat");
    })

    this.socket.on("timeout", (data: Timeout) => {
      this.emit("timeout", data);
    });
  }

  static fromMatch(userId: string, match: Match): GameServerWriteClient {
    return new GameServerWriteClient(userId, match);
  }
}
