import test from "node:test";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";
const m = await import(
  pathToFileURL(path.join(process.env.PROJECT_WORKSPACE!, "main.ts")).href
);

const ticket = { id: "T", message: "find billing policy" };
test("adapter result contract", async () =>
  assert.deepEqual(
    (await m.runTicket(ticket, async () => "receipt required")).result,
    { ticketId: "T", answer: "receipt required", calls: 1 },
  ));
test("tool receives selected name", async () => {
  let seen = "";
  await m.runTicket(ticket, async (name: string) => {
    seen = name;
    return "ok";
  });
  assert.equal(seen, "lookup");
});
test("tool receives original query", async () => {
  let seen = "";
  await m.runTicket(ticket, async (_: string, q: string) => {
    seen = q;
    return "ok";
  });
  assert.equal(seen, ticket.message);
});
test("invalid ticket prevents adapter call", async () => {
  let called = false;
  await assert.rejects(() =>
    m.runTicket({}, async () => {
      called = true;
      return "x";
    }),
  );
  assert.equal(called, false);
});
test("trace identifies retries", async () => {
  const r = await m.runTicket(ticket, async () => {
    throw new Error("offline");
  });
  assert.deepEqual(
    r.trace.map((t: any) => t.attempt),
    [1, 2],
  );
});
test("replay deterministic", async () =>
  assert.deepEqual(
    await m.runTicket(ticket, async () => "fixed"),
    await m.runTicket(ticket, async () => "fixed"),
  ));
