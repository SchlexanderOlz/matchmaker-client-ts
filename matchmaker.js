import { sleep } from "bun";
import EventEmitter from "events";
import { io } from "socket.io-client";
import * as ping from "ping";
import { GameServerClientDefault, GameServerWriteClient, } from "./gameserver-client";
export class MatchMaker extends EventEmitter {
    url;
    socket;
    ready = false;
    clientBuilder;
    userId;
    constructor(url, userId, clientBuilder) {
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
                new GameServerClientDefault();
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
    async search(search_info) {
        while (!this.ready) {
            await sleep(100);
        }
        let search = { ...search_info, player_id: this.userId };
        this.socket.on("reject", this.onReject.bind(this));
        this.socket.on("servers", this.onServers.bind(this));
        this.socket.emit("search", search);
    }
    async onServers(data) {
        const servers = data;
        // const ranked = await this.pingRankServers(servers);
        const ranked = data;
        this.socket.emit("servers", ranked);
        this.socket.on("match", this.onMatch.bind(this));
        this.emit("_servers", ranked);
    }
    onReject(data) {
        this.emit("reject", data);
    }
    onMatch(data) {
        const match = data;
        this.emit("match", this.clientBuilder.fromMatch(this.userId, match));
    }
    async pingRankServers(servers) {
        const ping = servers.map((server) => MatchMaker.pingServer(server));
        return await Promise.all(ping).then((pings) => servers
            .map((server, index) => {
            return { server, ping: pings[index] };
        })
            .sort((a, b) => a.ping - b.ping)
            .map((server) => server.server));
    }
    static async pingServer(server, timeout = 2000) {
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
