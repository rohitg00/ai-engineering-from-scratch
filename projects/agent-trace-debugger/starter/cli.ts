import { readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { parseTrace, analyze, render } from "./main.ts";
import { fromOTLP } from "./otlp.ts";
const { values } = parseArgs({
  options: {
    input: { type: "string" },
    format: { type: "string", default: "jsonl" },
    baseline: { type: "string" },
    output: { type: "string", default: "trace.html" },
    json: { type: "string" },
  },
});
if (!values.input)
  throw new Error(
    "Usage: node cli.ts --input samples/trace.jsonl [--baseline samples/before.jsonl] --output trace.html",
  );
if (!["jsonl", "otlp"].includes(values.format!))
  throw new Error("format must be jsonl or otlp");
const spans = parseTrace(
  values.format === "otlp"
    ? fromOTLP(JSON.parse(readFileSync(values.input, "utf8")))
        .map((x) => JSON.stringify(x))
        .join("\n")
    : readFileSync(values.input, "utf8"),
);
const report: any = { schema_version: 1, ...analyze(spans) };
if (values.baseline) {
  const old = analyze(parseTrace(readFileSync(values.baseline, "utf8")));
  report.comparison = {
    wall_time_delta_ms: report.wallTime - old.wallTime,
    token_delta: report.totalTokens - old.totalTokens,
    error_delta: report.errors.length - old.errors.length,
  };
}
writeFileSync(values.output!, render(spans));
if (values.json)
  writeFileSync(values.json, JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({ ...report, artifact: values.output }, null, 2));
