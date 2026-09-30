import { runPanel, aggregate, evaluate, validateFinding } from "./main.ts";
import { readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { createHash } from "node:crypto";
const { values } = parseArgs({
  options: {
    input: { type: "string" },
    "pr-report": { type: "string" },
    budget: { type: "string", default: "3" },
    quorum: { type: "string", default: "2" },
    timeout: { type: "string", default: "1000" },
    output: { type: "string", default: "panel.json" },
    html: { type: "string", default: "panel.html" },
  },
});
if (!values.input)
  throw new Error("--input source-and-reviewers.json is required");
const data = JSON.parse(readFileSync(values.input, "utf8"));
const files = Object.fromEntries(
  Object.entries(data.files).map(([name, value]) => [
    name,
    Array.isArray(value) ? value : String(value).split("\n"),
  ]),
) as Record<string, string[]>;
const signatures = (findings: any[]) =>
  findings.map((f) => JSON.stringify([f.file, f.line, f.rule]));
const scan = (strategy: string) =>
  Object.entries(files).flatMap(([file, lines]) =>
    lines.flatMap((quote, index) => {
      const rows: any[] = [];
      const active = strategy === "broad" || !/^\s*(?:\/\/|\*|#)/.test(quote);
      if (active && /\beval\s*\(/.test(quote))
        rows.push({
          file,
          line: index + 1,
          quote,
          rule: "dynamic-eval",
          severity: 3,
        });
      if (
        active &&
        strategy !== "eval-only" &&
        /rejectUnauthorized\s*:\s*false/.test(quote)
      )
        rows.push({
          file,
          line: index + 1,
          quote,
          rule: "tls-disabled",
          severity: strategy === "broad" ? 2 : 3,
        });
      return rows;
    }),
  );
const configs = data.reviewers ?? [
  { id: "broad", strategy: "broad", cost: 1 },
  { id: "focused", strategy: "focused", cost: 1 },
  { id: "eval-only", strategy: "eval-only", cost: 1 },
];
const pr = values["pr-report"]
  ? JSON.parse(readFileSync(values["pr-report"], "utf8"))
  : null;
if (pr) {
  if (pr.schema_version !== 1 || !Array.isArray(pr.findings))
    throw new Error("expected PR reporter schema version1");
  configs.push({
    id: "pr-reporter",
    cost: 0,
    findings: pr.findings.map((f: any) => ({
      ...f,
      severity: ({ high: 3, medium: 2, low: 1 } as Record<string, number>)[
        f.severity
      ],
    })),
  });
}
const run = await runPanel(
  configs.map((c: any) => ({
    id: c.id,
    cost: c.cost,
    run: async () => c.findings ?? scan(c.strategy),
  })),
  Number(values.budget),
  Number(values.timeout),
);
const combined = aggregate(run.reviews, files, Number(values.quorum));
const expected = (data.expected ?? []).map((f: any) =>
  JSON.stringify([f.file, f.line, f.rule]),
);
const consensus = combined.findings
  .filter((f) => f.status === "consensus")
  .map((f) => f.finding);
const measurements = data.expected
  ? {
      individual: run.reviews.map((r) => ({
        reviewer: r.reviewer,
        ...evaluate(
          signatures(r.findings.filter((f) => validateFinding(f, files))),
          expected,
        ),
      })),
      consensus: evaluate(signatures(consensus), expected),
    }
  : null;
const report = {
  schema_version: 1,
  pr_diff_sha256: pr?.diff_sha256 ?? null,
  dataset_sha256: createHash("sha256")
    .update(JSON.stringify(files))
    .digest("hex"),
  mode: "local static reviewers or supplied recordings; no LLM independence claim",
  ...run,
  ...combined,
  measurements,
};
const text = JSON.stringify(report, null, 2);
writeFileSync(values.output!, text + "\n");
writeFileSync(
  values.html!,
  '<!doctype html><meta charset="utf-8"><title>Review disagreement</title><h1>Single review versus quorum</h1><pre>' +
    text.replaceAll("&", "&amp;").replaceAll("<", "&lt;") +
    "</pre>",
);
console.log(text);
