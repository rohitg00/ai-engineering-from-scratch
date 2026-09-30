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

test("separate CLI processes retain revisions", () =>
  temporary((d) => {
    const args = [
      "--data-dir",
      d,
      "--put",
      path.join(W, "samples/memory.json"),
    ];
    assert.equal(JSON.parse(cli(args, d)).revision, 1);
    assert.equal(JSON.parse(cli([...args, "--revision", "1"], d)).revision, 2);
    const history = JSON.parse(
      cli(
        ["--data-dir", d, "--namespace", "docs", "--history", "cache-policy"],
        d,
      ),
    );
    assert.deepEqual(
      history.map((r: any) => r.revision),
      [1, 2],
    );
  }));
test("stale CLI update fails without appending", () =>
  temporary((d) => {
    const args = [
      "--data-dir",
      d,
      "--put",
      path.join(W, "samples/memory.json"),
    ];
    cli(args, d);
    assert.throws(() => cli(args, d), /conflict/);
    assert.equal(
      readFileSync(path.join(d, "memory.jsonl"), "utf8").trim().split("\n")
        .length,
      1,
    );
  }));
test("serve requires explicit persistent location", () => {
  const r = spawnSync(process.execPath, [path.join(W, "cli.ts"), "--serve"], {
    encoding: "utf8",
  });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /data-dir/);
});
test("malformed append log fails before serving", () =>
  temporary((d) => {
    writeFileSync(path.join(d, "memory.jsonl"), "not json\n");
    assert.throws(() => cli(["--data-dir", d, "--query", "cache"], d));
  }));
test("namespace remains a search boundary after restart", () =>
  temporary((d) => {
    cli(["--data-dir", d, "--put", path.join(W, "samples/memory.json")], d);
    assert.deepEqual(
      JSON.parse(
        cli(["--data-dir", d, "--namespace", "other", "--query", "cache"], d),
      ),
      [],
    );
  }));
