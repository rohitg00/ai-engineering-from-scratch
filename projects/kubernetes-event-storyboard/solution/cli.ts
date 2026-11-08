import { readFile, writeFile } from "node:fs/promises";
import { parsePack, timeline } from "./main.ts";
const input = process.argv[2] ?? "/tmp/aiefs-kubernetes-context.json",
  out = process.argv[3] ?? "/tmp/aiefs-kubernetes-timeline.html";
const pack = parsePack(await readFile(input, "utf8"));
await writeFile(out, timeline(pack));
console.log(
  JSON.stringify({
    output: out,
    rows: pack.rows.length,
    revisions: pack.rows.map((r) => r.revision ?? "unknown"),
  }),
);
