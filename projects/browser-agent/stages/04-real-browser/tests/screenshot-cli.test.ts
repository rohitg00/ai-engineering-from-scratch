import test from "node:test";
import assert from "node:assert/strict";
import { cpSync, readFileSync, writeFileSync, mkdtempSync, rmSync, realpathSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
const W = process.env.PROJECT_WORKSPACE!;

test("CLI saves a failure receipt when its recorded screenshot is corrupt", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "browser-receipt-"));
  try {
    const workspace = path.join(dir, "workspace");
    cpSync(W, workspace, { recursive: true });
    writeFileSync(path.join(workspace, "success.png"), "corrupt PNG fixture");
    const output = path.join(dir, "run.json");
    const run = spawnSync(process.execPath, ["--experimental-strip-types", path.join(workspace, "cli.ts"), "--task", path.join(workspace, "samples/contact.json"), "--output", output], { cwd: dir, encoding: "utf8" });
    assert.equal(run.status, 2, run.stderr);
    const receipt = JSON.parse(readFileSync(output, "utf8"));
    assert.equal(receipt.status, "screenshot-error");
    assert.equal(receipt.trace.at(-1).action.kind, "done");
    assert.equal(receipt.screenshot, realpathSync(path.join(workspace, "success.png")));
    assert.equal("visual" in receipt, false);
    assert.deepEqual(JSON.parse(run.stdout), receipt);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
