import { writeFile } from "node:fs/promises";
import { initial, connect, trace, replay } from "./main.ts";
const url = process.argv[2];
if (!url) throw Error("usage: node cli.ts SSE_URL [TRACE_PATH]");
let state = await connect(url, initial(), () => {});
console.log(
  JSON.stringify({
    connection: 1,
    status: state.status,
    text: state.text,
    lastID: state.lastID,
  }),
);
state = await connect(url, state, () => {});
const artifact = trace(state);
await writeFile(process.argv[3] ?? "/tmp/aiefs-answer-trace.json", artifact);
const restored = replay(artifact);
console.log(JSON.stringify({ connection: 2, ...restored }, null, 2));
if (restored.status !== "completed") process.exitCode = 1;
