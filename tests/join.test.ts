import { HostInfo, HostRequestInfo, MatchMaker } from "../src/matchmaker";

const sessionToken = process.argv[2] ? process.argv[2] : "test";
const search_id = process.argv[3] ? process.argv[3] : sessionToken;

let instance = new MatchMaker(
  "http://127.0.0.1:4000",
  "saus" + Math.random(),
  sessionToken,
);


instance.join_priv(search_id)

instance.on("match", (match) => {
    console.log(match)
})