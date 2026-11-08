import { readFile, writeFile } from "node:fs/promises";
import { analyze } from "./main.ts";
const r = analyze(
  await readFile(process.argv[2] ?? "/tmp/aiefs-retry-report.json", "utf8"),
);
if (process.argv[3])
  await writeFile(process.argv[3], JSON.stringify(r, null, 2));
console.log(JSON.stringify(r, null, 2));
