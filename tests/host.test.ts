import { HostInfo, HostRequestInfo, MatchMaker } from "../src/matchmaker";


const sessionToken = process.argv[2] ? process.argv[2] : "test";


let instance = new MatchMaker(
  "http://127.0.0.1:4000",
  "saus" + Math.random(),
  sessionToken,
);

const info: HostRequestInfo = {
  region: "eu-central-1",
  game: "Schnapsen",
  mode: "duo",
  reserved_players: []
}

let host_info = await instance.host(info)

console.log(host_info)

instance.on("match", (match) => {
    console.log(match)
})