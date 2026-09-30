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

test("quoted Git paths decode before anchoring", () =>
  assert.equal(
    m.parseDiff('+++ "b/a file.ts"\n@@ -0,0 +1,1 @@\n+eval(x);\n')[0].file,
    "a file.ts",
  ));
test("added text resembling a file header remains content", () =>
  assert.equal(
    m.parseDiff("+++ b/a.ts\n@@ -0,0 +1,1 @@\n+++ harmless\n")[0].text,
    "++ harmless",
  ));
test("comment mentions are suppressed", () =>
  assert.equal(
    m.inspect([
      { file: "a.ts", line: 1, text: "// eval(input) is discouraged" },
    ]).length,
    0,
  ));
test("actual patch CLI emits SARIF locations", () =>
  temporary((d) => {
    const r = JSON.parse(
      cli(
        [
          "--diff",
          path.join(W, "samples/change.diff"),
          "--output",
          path.join(d, "review.json"),
          "--html",
          path.join(d, "review.html"),
          "--sarif",
          path.join(d, "review.sarif"),
        ],
        d,
      ),
    );
    assert.equal(r.findings.length, 1);
    const sarif = JSON.parse(
      readFileSync(path.join(d, "review.sarif"), "utf8"),
    );
    assert.equal(
      sarif.runs[0].results[0].locations[0].physicalLocation.region.startLine,
      2,
    );
  }));
test("quoted traversal remains forbidden", () =>
  assert.throws(() => m.parseDiff('+++ "b/../bad"\n@@ -0,0 +1,1 @@\n+x\n')));
