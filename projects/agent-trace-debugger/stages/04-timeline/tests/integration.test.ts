import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
const W = process.env.PROJECT_WORKSPACE!;
const m = await import(pathToFileURL(path.join(W, "main.ts")).href);
function cli(args: string[], cwd: string) {
  return execFileSync(
    process.execPath,
    ["--experimental-strip-types", path.join(W, "cli.ts"), ...args],
    { cwd, encoding: "utf8" },
  );
}
function temporary(fn: (dir: string) => void) {
  const d = mkdtempSync(path.join(tmpdir(), "learning-integration-"));
  try {
    fn(d);
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
}

test("physical blank lines remain in error location", () =>
  assert.throws(() => m.parseTrace("\n\nnope"), /line 3/));
test("three overlapping children use union duration", () => {
  const spans = [
    { id: "r", name: "run", start: 0, end: 100, tokens: 0, status: "ok" },
    ...[
      ["a", 10, 60],
      ["b", 30, 80],
      ["c", 70, 90],
    ].map(([id, start, end]) => ({
      id,
      parent: "r",
      name: id,
      start,
      end,
      tokens: 0,
      status: "ok",
    })),
  ];
  assert.equal(m.analyze(spans).rows[0].exclusive, 20);
});
test("input CLI compares actual supplied runs", () =>
  temporary((d) => {
    const r = JSON.parse(
      cli(
        [
          "--input",
          path.join(W, "samples/trace.jsonl"),
          "--baseline",
          path.join(W, "samples/before.jsonl"),
          "--output",
          path.join(d, "trace.html"),
        ],
        d,
      ),
    );
    assert.equal(r.comparison.error_delta, 1);
    assert.ok(r.comparison.token_delta > 0);
  }));
test("HTML escapes supplied span names", () =>
  assert.ok(
    m
      .render([
        {
          id: "r",
          name: "<script>",
          start: 0,
          end: 1,
          tokens: 0,
          status: "ok",
        },
      ])
      .includes("&lt;script&gt;"),
  ));
test("empty trace reports no invented time", () =>
  assert.equal(m.analyze([]).wallTime, 0));

test("OTLP nanoseconds are normalized before floating conversion", () =>
  temporary((d) => {
    const r = JSON.parse(
      cli(
        [
          "--input",
          path.join(W, "samples/otlp.json"),
          "--format",
          "otlp",
          "--output",
          path.join(d, "trace.html"),
        ],
        d,
      ),
    );
    assert.equal(r.wallTime, 15);
    assert.equal(r.totalTokens, 60);
    assert.equal(r.errors.length, 1);
  }));
