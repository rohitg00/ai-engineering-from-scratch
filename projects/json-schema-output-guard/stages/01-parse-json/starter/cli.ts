import { readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { guard, repair } from "./main.ts";
const { values } = parseArgs({
  options: {
    schema: { type: "string" },
    input: { type: "string" },
    attempts: { type: "string" },
    output: { type: "string" },
    html: { type: "string" },
  },
});
if (!values.schema || (!values.input && !values.attempts))
  throw new Error(
    "Usage: node cli.ts --schema samples/schema.json --input response.json OR --attempts samples/attempts.json",
  );
const schema = JSON.parse(readFileSync(values.schema, "utf8"));
const outputs = values.attempts
  ? JSON.parse(readFileSync(values.attempts, "utf8"))
  : null;
if (
  outputs &&
  (!Array.isArray(outputs) ||
    !outputs.length ||
    outputs.length > 10 ||
    outputs.some((x) => typeof x !== "string"))
)
  throw new Error("one to ten recorded raw strings required");
const result = outputs
  ? await repair(
      async (_, attempt) => outputs[attempt - 1],
      schema,
      outputs.length,
    )
  : guard(readFileSync(values.input!, "utf8"), schema);
const report = {
  schema_version: 1,
  mode: outputs ? "recorded-repair" : "validate",
  ...result,
};
const text = JSON.stringify(report, null, 2);
if (values.output) writeFileSync(values.output, text + "\n");
if (values.html)
  writeFileSync(
    values.html,
    '<!doctype html><meta charset="utf-8"><title>Output guard</title><h1>Structured output evidence</h1><pre>' +
      text.replaceAll("&", "&amp;").replaceAll("<", "&lt;") +
      "</pre>",
  );
console.log(text);
if (
  ("ok" in result && !result.ok) ||
  ("status" in result && result.status !== "accepted")
)
  process.exitCode = 2;
