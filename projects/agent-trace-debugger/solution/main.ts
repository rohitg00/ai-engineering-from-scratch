/*
 * Agent Trace Debugger reference implementation.
 * Follow stages in projects/agent-trace-debugger/stages/.
 * The demo is deterministic and requires no provider credentials.
 * Protocol references are listed in the project README.
 */
import { pathToFileURL } from "node:url";
import path from "node:path";

import { writeFileSync } from "node:fs";
export type Span = {
  id: string;
  parent?: string;
  name: string;
  start: number;
  end: number;
  status: "ok" | "error";
  tokens: number;
};
export function parseTrace(raw: string): Span[] {
  return raw.split(/\r?\n/).flatMap((line, index) => {
    if (!line.trim()) return [];
    let s: Span;
    try {
      s = JSON.parse(line);
    } catch {
      throw new Error(`invalid JSON line ${index + 1}`);
    }
    if (
      !s ||
      typeof s.id !== "string" ||
      !s.id ||
      typeof s.name !== "string" ||
      (s.parent !== undefined && typeof s.parent !== "string") ||
      ![s.start, s.end, s.tokens].every(Number.isFinite) ||
      s.end < s.start ||
      s.tokens < 0 ||
      !["ok", "error"].includes(s.status)
    )
      throw new Error(`invalid span line ${index + 1}`);
    return [s];
  });
}
export function validateTree(spans: Span[]): Map<string, Span> {
  const map = new Map(spans.map((s) => [s.id, s]));
  if (map.size !== spans.length) throw new Error("duplicate span id");
  for (const s of spans) {
    const visited = new Set([s.id]);
    let p = s.parent;
    while (p !== undefined) {
      if (visited.has(p)) throw new Error("span cycle");
      visited.add(p);
      const parent = map.get(p);
      if (!parent) throw new Error("missing parent");
      p = parent.parent;
    }
    if (s.parent) {
      const p = map.get(s.parent)!;
      if (s.start < p.start || s.end > p.end)
        throw new Error("child outside parent");
    }
  }
  return map;
}
export function unionDuration(intervals: [number, number][]): number {
  const sorted = intervals.slice().sort((a, b) => a[0] - b[0]);
  let total = 0,
    start = 0,
    end = 0,
    first = true;
  for (const [a, b] of sorted) {
    if (b < a) throw new Error("negative interval");
    if (first) {
      start = a;
      end = b;
      first = false;
    } else if (a <= end) end = Math.max(end, b);
    else {
      total += end - start;
      start = a;
      end = b;
    }
  }
  return first ? 0 : total + end - start;
}
export function analyze(spans: Span[]) {
  validateTree(spans);
  const rows = spans.map((s) => {
    const children = spans.filter((c) => c.parent === s.id);
    return {
      ...s,
      inclusive: s.end - s.start,
      exclusive:
        s.end - s.start - unionDuration(children.map((c) => [c.start, c.end])),
    };
  });
  return {
    rows,
    totalTokens: spans.reduce((n, s) => n + s.tokens, 0),
    errors: spans.filter((s) => s.status === "error").map((s) => s.id),
    wallTime: unionDuration(
      spans.filter((s) => !s.parent).map((s) => [s.start, s.end]),
    ),
    slowest:
      [...rows].sort(
        (a, b) => b.exclusive - a.exclusive || a.id.localeCompare(b.id),
      )[0]?.id ?? null,
  };
}
const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export function render(spans: Span[]): string {
  const report = analyze(spans);
  const start = Math.min(0, ...spans.map((s) => s.start));
  const end = Math.max(1, ...spans.map((s) => s.end));
  return (
    `<!doctype html><meta charset="utf-8"><title>Agent trace</title><style>body{font:15px system-ui;max-width:1000px;margin:40px auto;background:#10151c;color:#e8edf5}article{margin:12px 0}.track{height:18px;background:#263344}.bar{height:100%;background:#59b7b2}.error{background:#e78284}pre{white-space:pre-wrap}</style><h1>Agent trace</h1><p>${report.wallTime} ms wall time | ${report.totalTokens} tokens | ${report.errors.length} errors</p>` +
    report.rows
      .map(
        (s) =>
          `<article><b>${escape(s.name)}</b> <small>${s.exclusive} ms own / ${s.inclusive} ms total</small><div class="track"><div class="bar ${s.status === "error" ? "error" : ""}" style="margin-left:${(100 * (s.start - start)) / (end - start)}%;width:${(100 * s.inclusive) / (end - start)}%"></div></div></article>`,
      )
      .join("")
  );
}
export const fixture: Span[] = [
  { id: "run", name: "Agent run", start: 0, end: 100, status: "ok", tokens: 0 },
  {
    id: "search",
    parent: "run",
    name: "Search notes",
    start: 10,
    end: 40,
    status: "ok",
    tokens: 50,
  },
  {
    id: "model",
    parent: "run",
    name: "Draft answer",
    start: 45,
    end: 90,
    status: "error",
    tokens: 280,
  },
];
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  writeFileSync("trace.html", render(fixture));
  console.log(
    JSON.stringify({ ...analyze(fixture), report: "trace.html" }, null, 2),
  );
}
