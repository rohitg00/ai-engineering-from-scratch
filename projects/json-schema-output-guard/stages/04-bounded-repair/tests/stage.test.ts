import test from "node:test";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";
const m = await import(
  pathToFileURL(path.join(process.env.PROJECT_WORKSPACE!, "main.ts")).href
);

test("success on first attempt", async () =>
  assert.equal(
    (await m.repair(async () => '{"a":1}', { type: "object" })).trace.length,
    1,
  ));
test("feedback reaches next attempt", async () => {
  let seen: any;
  const r = await m.repair(
    async (f: any[], i: number) => {
      seen = f;
      return i === 1 ? "x" : "1";
    },
    { type: "number" },
  );
  assert.equal(r.status, "accepted");
  assert.equal(seen.length, 1);
});
test("exhausted budget", async () =>
  assert.equal(
    (await m.repair(async () => '"x"', { type: "number" }, 2)).trace.length,
    2,
  ));
test("zero budget rejected", async () =>
  assert.rejects(() => m.repair(async () => "1", {}, 0), /budget/));
test("provider errors propagate", async () =>
  assert.rejects(
    () =>
      m.repair(async () => {
        throw new Error("offline");
      }, {}),
    /offline/,
  ));
test("accepted result retains value", async () =>
  assert.deepEqual((await m.repair(async () => "[1]", {})).value, [1]));
