import { test } from "node:test";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import path from "node:path";
const m = await import(
  pathToFileURL(path.join(process.env.PROJECT_WORKSPACE!, "main.ts")).href
);

const receipt = () => ({
  schemaVersion: 1,
  mode: "deterministic-simulation",
  clients: 2,
  calls: 3,
  retries: 1,
  successes: 2,
  timeline: [
    { client: 0, attempt: 1, atMs: 0, status: 503 },
    { client: 1, attempt: 1, atMs: 0, status: 200 },
    { client: 0, attempt: 2, atMs: 10, status: 200 },
  ],
});
test("amplification", () =>
  assert.equal(m.analyze(JSON.stringify(receipt())).amplification, 1.5));
test("peak timeline", () =>
  assert.equal(m.analyze(JSON.stringify(receipt())).peakSameMillisecond, 2));
test("counter tamper", () => {
  const r = receipt();
  r.calls = 9;
  assert.throws(() => m.analyze(JSON.stringify(r)));
});
test("attempt gap", () => {
  const r = receipt();
  r.timeline[2].attempt = 3;
  assert.throws(() => m.analyze(JSON.stringify(r)));
});
test("unknown client", () => {
  const r = receipt();
  r.timeline[0].client = 5;
  assert.throws(() => m.analyze(JSON.stringify(r)));
});
test("success terminal", () => {
  const r = receipt();
  r.timeline[0].status = 200;
  assert.throws(() => m.analyze(JSON.stringify(r)));
});
