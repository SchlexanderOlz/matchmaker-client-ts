import { SearchInfo, HostRequestInfo, MatchMaker } from "../src/matchmaker";

const sessionToken = process.argv[2] ? process.argv[2] : "test";


let instance = new MatchMaker(
  // "http://127.0.0.1:4000",
  "https://matchmaking.jjhost.at",
  "saus" + Math.random(),
  sessionToken,
);

const info: SearchInfo = {
    region: "eu-central-1",
    game: "Schnapsen",
    mode: "speed",
    ai: "*",
    allow_reconnect: false
}

await instance.search(info)

instance.on("match", (match) => {
    console.log(match)
})