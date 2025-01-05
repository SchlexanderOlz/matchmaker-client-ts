import { SearchInfo, HostRequestInfo, MatchMaker } from "../src/matchmaker";

const sessionToken = process.argv[2] ? process.argv[2] : "test";


let instance = new MatchMaker(
  "http://127.0.0.1:4000",
  "saus" + Math.random(),
  sessionToken,
);

const info: SearchInfo = {
    region: "eu-central-1",
    game: "Schnapsen",
    mode: "duo",
}

let search_info = await instance.search(info)

console.log(search_info)

instance.on("match", (match) => {
    console.log(match)
})