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

test("source-driven panel measures individual and quorum precision", () =>
  temporary((d) => {
    const r = JSON.parse(
      cli(["--input", path.join(W, "samples/review.json")], d),
    );
    assert.equal(r.measurements.consensus.precision, 1);
    assert.ok(
      r.measurements.individual.find((x: any) => x.reviewer === "broad")
        .precision < 1,
    );
    assert.ok(r.findings.some((x: any) => x.disagreement));
  }));
test("budget affects executed reviewers and measured recall", () =>
  temporary((d) => {
    const r = JSON.parse(
      cli(["--input", path.join(W, "samples/review.json"), "--budget", "1"], d),
    );
    assert.equal(r.reviews.length, 1);
    assert.equal(r.measurements.consensus.recall, 0);
  }));
test("external unanchored recording is rejected", () =>
  temporary((d) => {
    const file = path.join(d, "input.json");
    writeFileSync(
      file,
      JSON.stringify({
        files: { "a.ts": ["safe();"] },
        reviewers: [
          {
            id: "external",
            cost: 1,
            findings: [
              {
                file: "a.ts",
                line: 99,
                quote: "evil()",
                rule: "bad",
                severity: 3,
              },
            ],
          },
        ],
      }),
    );
    assert.equal(JSON.parse(cli(["--input", file], d)).rejected, 1);
  }));
test("changed source gets different dataset hash", () =>
  temporary((d) => {
    const a = JSON.parse(
      cli(["--input", path.join(W, "samples/review.json")], d),
    );
    const file = path.join(d, "input.json");
    writeFileSync(file, JSON.stringify({ files: { "safe.ts": ["safe();"] } }));
    assert.notEqual(
      JSON.parse(cli(["--input", file], d)).dataset_sha256,
      a.dataset_sha256,
    );
  }));
test("empty expected set does not invent evidence", () =>
  assert.deepEqual(m.evaluate([], []), { precision: 0, recall: 0, hits: 0 }));
