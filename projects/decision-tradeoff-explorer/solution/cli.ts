import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { parse, record, csv, html, sensitivity } from "./main.ts";
const input = process.argv[2] ?? "fixtures/exhibition.json",
  out = process.argv[3] ?? "/tmp/aiefs-decision-board";
const data = parse(await readFile(input, "utf8"));
await mkdir(out, { recursive: true });
await writeFile(path.join(out, "criteria.csv"), csv(data));
await writeFile(
  path.join(out, "decision-record.json"),
  JSON.stringify(record(data), null, 2),
);
await writeFile(path.join(out, "index.html"), html(data));
console.log(
  JSON.stringify(
    {
      output: out,
      record: record(data),
      sensitivity: sensitivity(data, data.criteria[0].id).map(
        ({ weight, winner }) => ({ weight, winner }),
      ),
    },
    null,
    2,
  ),
);
