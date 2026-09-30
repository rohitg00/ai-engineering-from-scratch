import test from "node:test";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";
const m = await import(
  pathToFileURL(path.join(process.env.PROJECT_WORKSPACE!, "main.ts")).href
);

const t = {
  name: "Ada",
  email: "ada@example.test",
  allowedOrigin: "http://127.0.0.1:8877",
};
const png = path.join(process.env.PROJECT_ROOT!, "solution", "success.png");
test("fixture completes in four observations", async () => {
  const r = await m.runAgent(new m.FixtureDriver(png), t);
  assert.equal(r.status, "complete");
  assert.equal(r.trace.length, 4);
});
test("budget stops before submit", async () =>
  assert.equal(
    (await m.runAgent(new m.FixtureDriver(png), t, 2)).status,
    "budget-exhausted",
  ));
test("unchanged observation stalls", async () => {
  const d = new m.FixtureDriver(png);
  d.act = async () => {};
  assert.equal((await m.runAgent(d, t)).status, "stalled");
});
test("origin change blocks before action", async () => {
  const d = new m.FixtureDriver(png);
  d.observation.url = "https://evil.test";
  assert.equal((await m.runAgent(d, t)).status, "blocked");
  assert.equal(d.actions.length, 0);
});
test("invalid budget rejected", async () =>
  assert.rejects(() => m.runAgent(new m.FixtureDriver(png), t, 0), /budget/));
test("captured actions preserve values", async () => {
  const d = new m.FixtureDriver(png);
  await m.runAgent(d, t);
  assert.equal(d.actions[1].value, t.email);
});
