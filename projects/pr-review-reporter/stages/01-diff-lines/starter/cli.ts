import { parseDiff, inspect, verify, merge, render } from "./main.ts";
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { parseArgs } from "node:util";
import { createHash } from "node:crypto";
const { values } = parseArgs({
  options: {
    diff: { type: "string" },
    repo: { type: "string" },
    base: { type: "string" },
    head: { type: "string", default: "HEAD" },
    candidates: { type: "string" },
    output: { type: "string", default: "review.json" },
    html: { type: "string", default: "review.html" },
    sarif: { type: "string" },
  },
});
if (!values.diff && !(values.repo && values.base))
  throw new Error(
    "Provide --diff patch.diff (or - for stdin), or --repo directory --base revision",
  );
if ([values.base, values.head].some((ref) => ref?.startsWith("-")))
  throw new Error("revisions must not begin with an option prefix");
const raw = values.diff
  ? readFileSync(values.diff === "-" ? 0 : values.diff, "utf8")
  : execFileSync(
      "git",
      [
        "-C",
        values.repo!,
        "diff",
        "--no-ext-diff",
        "--no-color",
        "--unified=3",
        values.base!,
        values.head!,
        "--",
      ],
      { encoding: "utf8", maxBuffer: 1_000_000 },
    );
if (Buffer.byteLength(raw) > 1_000_000)
  throw new Error("diff exceeds one megabyte");
const lines = parseDiff(raw);
const candidates = values.candidates
  ? JSON.parse(readFileSync(values.candidates, "utf8"))
  : inspect(lines);
const checked = verify(candidates, lines),
  findings = merge(checked.accepted);
const report = {
  schema_version: 1,
  diff_sha256: createHash("sha256").update(raw).digest("hex"),
  added_lines: lines.length,
  findings,
  rejected: checked.rejected,
  detector: values.candidates
    ? "supplied findings"
    : "four conservative lexical rules; not semantic review",
};
writeFileSync(values.output!, JSON.stringify(report, null, 2) + "\n");
writeFileSync(values.html!, render(findings, checked.rejected.length));
if (values.sarif)
  writeFileSync(
    values.sarif,
    JSON.stringify(
      {
        version: "2.1.0",
        $schema: "https://json.schemastore.org/sarif-2.1.0.json",
        runs: [
          {
            tool: { driver: { name: "anchored-pr-review" } },
            results: findings.map((f) => ({
              ruleId: f.rule,
              level: f.severity === "high" ? "error" : "warning",
              message: { text: f.message },
              locations: [
                {
                  physicalLocation: {
                    artifactLocation: { uri: f.file },
                    region: { startLine: f.line },
                  },
                },
              ],
            })),
          },
        ],
      },
      null,
      2,
    ),
  );
console.log(JSON.stringify(report, null, 2));
