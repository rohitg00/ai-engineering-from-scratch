import test from "node:test";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";
const m = await import(
  pathToFileURL(path.join(process.env.PROJECT_WORKSPACE!, "main.ts")).href
);

const read = { id: "T", message: "find policy" };
test("successful read", async () =>
  assert.equal(
    (await m.runTicket(read, async () => "answer")).status,
    "complete",
  ));
test("write suspends without calls", async () => {
  let calls = 0;
  const r = await m.runTicket(
    { id: "T", message: "update account" },
    async () => {
      calls++;
      return "ok";
    },
  );
  assert.equal(r.status, "suspended");
  assert.equal(calls, 0);
});
test("approved checkpoint resumes", async () => {
  const r = await m.runTicket(
    { id: "T", message: "update account" },
    async () => "ok",
  );
  assert.equal(
    (
      await m.executePlan(r.checkpoint, async () => "updated", {
        approved: true,
      })
    ).status,
    "complete",
  );
});
test("retry consumes calls", async () => {
  let n = 0;
  const r = await m.runTicket(read, async () => {
    if (++n === 1) throw new Error("temporary");
    return "ok";
  });
  assert.equal(r.result.calls, 2);
});
test("shared budget exhaustion explicit", async () =>
  assert.equal(
    (
      await m.runTicket(
        read,
        async () => {
          throw new Error("x");
        },
        { maxCalls: 1, maxAttempts: 3 },
      )
    ).reason,
    "call budget exhausted",
  ));
test("empty result fails", async () =>
  assert.equal((await m.runTicket(read, async () => "")).status, "failed"));
