/*
 * PR Review Reporter reference implementation.
 * Follow stages in projects/pr-review-reporter/stages/.
 * The demo is deterministic and requires no provider credentials.
 * Protocol references are listed in the project README.
 */
import { pathToFileURL } from "node:url";
import path from "node:path";

import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { writeFileSync } from "node:fs";
export type AddedLine = { file: string; line: number; text: string };
export type Finding = {
  file: string;
  line: number;
  quote: string;
  rule: string;
  severity: "high" | "medium" | "low";
  message: string;
};
export function parseDiff(raw: string): AddedLine[] {
  return JSON.parse(
    execFileSync(
      "python3",
      [fileURLToPath(new URL("./diff_parser.py", import.meta.url))],
      { input: raw, encoding: "utf8", maxBuffer: 1_000_000 },
    ),
  );
}
export function inspect(lines: AddedLine[]): Finding[] {
  const rules: [RegExp, string, Finding["severity"], string][] = [
    [
      /\beval\s*\(/,
      "dynamic-eval",
      "high",
      "Untrusted input can execute code.",
    ],
    [
      /\bexec\s*\(/,
      "shell-exec",
      "high",
      "Use an argument array instead of shell interpolation.",
    ],
    [
      /rejectUnauthorized\s*:\s*false/,
      "tls-disabled",
      "high",
      "TLS certificate verification is disabled.",
    ],
    [
      /\.catch\s*\(\s*\(\)\s*=>\s*\{\s*\}/,
      "empty-catch",
      "medium",
      "An empty catch hides failures.",
    ],
  ];
  return lines.flatMap((line) =>
    rules
      .filter(
        ([pattern]) =>
          !/^\s*(?:\/\/|\*|#)/.test(line.text) && pattern.test(line.text),
      )
      .map(([, rule, severity, message]) => ({
        ...line,
        quote: line.text,
        rule,
        severity,
        message,
      })),
  );
}
export function verify(
  findings: unknown[],
  lines: AddedLine[],
): { accepted: Finding[]; rejected: unknown[] } {
  if (!Array.isArray(findings)) throw new Error("candidates must be an array");
  const accepted: Finding[] = [];
  const rejected: unknown[] = [];
  for (const candidate of findings) {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
      rejected.push(candidate);
      continue;
    }
    const f = candidate as Finding;
    if (
      ![f.file, f.quote, f.rule, f.message].every((value) => typeof value === "string") ||
      !Number.isSafeInteger(f.line) || f.line < 1
    ) {
      rejected.push(candidate);
      continue;
    }
    const line = lines.find((l) => l.file === f.file && l.line === f.line);
    if (
      !line ||
      !f.quote.trim() ||
      !line.text.includes(f.quote) ||
      !["high", "medium", "low"].includes(f.severity) ||
      !f.rule.trim() ||
      !f.message.trim()
    )
      rejected.push(f);
    else accepted.push(f);
  }
  return { accepted, rejected };
}
export function merge(findings: Finding[]): Finding[] {
  const ranks = { high: 3, medium: 2, low: 1 };
  const unique = new Map<string, Finding>();
  for (const f of findings) {
    const key = JSON.stringify([f.file, f.line, f.rule]);
    const prev = unique.get(key);
    if (!prev || ranks[f.severity] > ranks[prev.severity]) unique.set(key, f);
  }
  return [...unique.values()].sort(
    (a, b) =>
      ranks[b.severity] - ranks[a.severity] ||
      a.file.localeCompare(b.file) ||
      a.line - b.line,
  );
}
export function escapeHTML(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
}
export function render(findings: Finding[], rejected = 0): string {
  return (
    '<!doctype html><meta charset="utf-8"><title>PR Review</title><h1>Anchored review</h1><p>' +
    findings.length +
    " findings; " +
    rejected +
    " rejected</p><ol>" +
    findings
      .map(
        (f) =>
          `<li><strong>${escapeHTML(f.severity)} ${escapeHTML(f.file)}:${f.line}</strong><p>${escapeHTML(f.message)}</p><pre>${escapeHTML(f.quote)}</pre><small>${escapeHTML(f.rule)}</small></li>`,
      )
      .join("") +
    "</ol>"
  );
}
export const fixture =
  "diff --git a/src/run.ts b/src/run.ts\n--- a/src/run.ts\n+++ b/src/run.ts\n@@ -1,1 +1,2 @@\n const input = request.body;\n+eval(input);\n";
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  const lines = parseDiff(fixture);
  const result = verify(inspect(lines), lines);
  const findings = merge(result.accepted);
  writeFileSync("review.html", render(findings, result.rejected.length));
  console.log(
    JSON.stringify(
      { addedLines: lines.length, findings, report: "review.html" },
      null,
      2,
    ),
  );
}
