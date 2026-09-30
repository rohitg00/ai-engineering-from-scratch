import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
const m = await import(pathToFileURL(path.join(process.env.PROJECT_WORKSPACE!, "main.ts")).href);
const task = { name: "Ada", email: "ada@example.test", allowedOrigin: "http://127.0.0.1:8877" };

test("missing and malformed screenshots retain the completed action trace", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "browser-pixels-"));
  try {
    const malformed = path.join(dir, "bad.png");
    writeFileSync(malformed, "not a png");
    for (const screenshot of [path.join(dir, "missing.png"), malformed]) {
      assert.throws(() => m.inspectPNG(screenshot));
      const result = await m.runAgent(new m.FixtureDriver(screenshot), task);
      assert.equal(result.status, "screenshot-error");
      assert.equal(result.screenshot, screenshot);
      assert.equal(result.trace.at(-1).action.kind, "done");
      assert.equal(result.trace.length, 4);
      assert.equal(typeof result.reason, "string");
      assert.ok(result.reason.length > 0);
      assert.equal("visual" in result, false);
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("capture failure has no invented screenshot path or metrics", async () => {
  const driver = new m.FixtureDriver("unused");
  driver.capture = async () => { throw new Error("capture unavailable"); };
  const result = await m.runAgent(driver, task);
  assert.equal(result.status, "screenshot-error");
  assert.equal(result.reason, "capture unavailable");
  assert.equal(result.screenshot, null);
  assert.equal(result.trace.at(-1).action.kind, "done");
  assert.equal("visual" in result, false);
});
