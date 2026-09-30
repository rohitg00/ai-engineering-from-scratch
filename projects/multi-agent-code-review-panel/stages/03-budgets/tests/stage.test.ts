import test from "node:test";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";
const m = await import(
  pathToFileURL(path.join(process.env.PROJECT_WORKSPACE!, "main.ts")).href
);

const r = (id: string, cost: number, run = async () => []) => ({
  id,
  cost,
  run,
});
test("cost reserved before launch", async () => {
  let called = 0;
  const result = await m.runPanel(
    [
      r("a", 2),
      r("b", 2, async () => {
        called++;
        return [];
      }),
    ],
    2,
  );
  assert.equal(called, 0);
  assert.equal(result.spent, 2);
});
test("completed results retained", async () =>
  assert.equal((await m.runPanel([r("a", 1)], 1)).reviews.length, 1));
test("failure recorded", async () =>
  assert.equal(
    (
      await m.runPanel(
        [
          r("a", 1, async () => {
            throw new Error("offline");
          }),
        ],
        1,
      )
    ).trace[0].status,
    "failed",
  ));
test("deadline returns without hanging", async () =>
  assert.equal(
    (await m.runPanel([r("a", 1, () => new Promise(() => {}))], 1, 10)).trace[0]
      .status,
    "timeout",
  ));
test("negative cost rejected", async () =>
  assert.rejects(() => m.runPanel([r("a", -1)], 1), /cost/));
test("duplicate reviewer rejected", async () =>
  assert.rejects(() => m.runPanel([r("a", 1), r("a", 1)], 2), /duplicate/));

test("invalid later cost prevents all launches", async () => {
  let calls = 0;
  await assert.rejects(
    () =>
      m.runPanel(
        [
          r("a", 1, async () => {
            calls++;
            return [];
          }),
          r("b", -1),
        ],
        3,
      ),
    /cost/,
  );
  assert.equal(calls, 0);
});
