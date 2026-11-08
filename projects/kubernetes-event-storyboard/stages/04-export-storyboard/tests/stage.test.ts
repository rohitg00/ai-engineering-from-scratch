import { test } from "node:test";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import path from "node:path";
const m = await import(
  pathToFileURL(path.join(process.env.PROJECT_WORKSPACE!, "main.ts")).href
);

const pack = () => ({
  schemaVersion: 1,
  observedAt: "2026-01-02T00:00:00Z",
  redactions: ["message omitted"],
  rows: [
    {
      object: { uid: "heldout", name: "pod", namespace: "lab" },
      reason: "Started",
      type: "Normal",
      count: 1,
      firstOccurrence: "2026-01-01T00:00:00Z",
      lastOccurrence: "2026-01-01T00:00:01Z",
      eventUIDs: ["e9"],
      investigation: "Inspect object",
    },
  ],
});
test("consume pack", () =>
  assert.equal(m.parsePack(JSON.stringify(pack())).rows.length, 1));
test("wrong version", () => {
  const p = pack();
  p.schemaVersion = 9;
  assert.throws(() => m.parsePack(JSON.stringify(p)));
});
test("invalid count", () => {
  const p = pack();
  p.rows[0].count = 0;
  assert.throws(() => m.parsePack(JSON.stringify(p)));
});
test("invalid time", () => {
  const p = pack();
  p.rows[0].lastOccurrence = "2025-01-01T00:00:00Z";
  assert.throws(() => m.parsePack(JSON.stringify(p)));
});
test("escape output", () => {
  const p = pack();
  p.rows[0].object.name = "<script>alert(1)</script>";
  const h = m.timeline(p);
  assert.ok(h.includes("&lt;script&gt;"));
  assert.ok(!h.includes(p.rows[0].object.name));
});
test("interactive artifact", () => {
  const h = m.timeline(pack());
  assert.ok(h.includes("Show Warning events only"));
  assert.ok(h.includes("context-pack.json"));
});
