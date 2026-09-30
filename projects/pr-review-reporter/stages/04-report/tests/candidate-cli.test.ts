import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
const W = process.env.PROJECT_WORKSPACE!;

test("external malformed JSON candidates produce consistent JSON HTML and SARIF", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "review-candidates-"));
  try {
    writeFileSync(path.join(dir, "change.diff"), "+++ b/a.ts\n@@ -0,0 +1,1 @@\n+eval(x)\n");
    const valid = { file: "a.ts", line: 1, quote: "eval(x)", rule: "eval", severity: "high", message: "Inspect this call" };
    const rejected = [null, [], { ...valid, quote: 5 }, { ...valid, message: 5 }, { ...valid, rule: {} }];
    writeFileSync(path.join(dir, "candidates.json"), JSON.stringify([rejected[0], valid, ...rejected.slice(1)]));
    const run = spawnSync(process.execPath, ["--experimental-strip-types", path.join(W, "cli.ts"), "--diff", "change.diff", "--candidates", "candidates.json", "--sarif", "review.sarif"], { cwd: dir, encoding: "utf8" });
    assert.equal(run.status, 0, run.stderr);
    const report = JSON.parse(readFileSync(path.join(dir, "review.json"), "utf8"));
    assert.deepEqual(report.findings, [valid]);
    assert.deepEqual(report.rejected, rejected);
    assert.match(readFileSync(path.join(dir, "review.html"), "utf8"), /1 findings; 5 rejected/);
    const sarif = JSON.parse(readFileSync(path.join(dir, "review.sarif"), "utf8"));
    assert.equal(sarif.runs[0].results.length, 1);
    assert.equal(sarif.runs[0].results[0].message.text, valid.message);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("invalid outer candidate container fails before writing outputs", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "review-container-"));
  try {
    writeFileSync(path.join(dir, "change.diff"), "+++ b/a.ts\n@@ -0,0 +1,1 @@\n+eval(x)\n");
    writeFileSync(path.join(dir, "candidates.json"), "{}");
    const run = spawnSync(process.execPath, ["--experimental-strip-types", path.join(W, "cli.ts"), "--diff", "change.diff", "--candidates", "candidates.json"], { cwd: dir, encoding: "utf8" });
    assert.notEqual(run.status, 0);
    assert.match(run.stderr, /candidates must be an array/);
    assert.equal(existsSync(path.join(dir, "review.json")), false);
    assert.equal(existsSync(path.join(dir, "review.html")), false);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
