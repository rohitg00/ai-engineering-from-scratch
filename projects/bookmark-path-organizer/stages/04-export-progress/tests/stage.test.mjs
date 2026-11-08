import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";
const m = await import(
  pathToFileURL(path.join(process.env.PROJECT_WORKSPACE, "main.ts")).href
);
const rows = [
  {
    id: "a",
    title: "<script>alert(1)</script>",
    url: "https://x.invalid",
    originals: ["https://x.invalid"],
    folders: [[]],
    topics: [],
    score: 0,
    evidence: [],
  },
  {
    id: "b",
    title: "B",
    url: "https://b.invalid",
    originals: ["https://b.invalid"],
    folders: [[]],
    topics: [],
    score: 0,
    evidence: [],
  },
];
test("default progress contains whole path", () =>
  assert.deepEqual(m.applyProgress(rows).progress, {
    schemaVersion: 1,
    order: ["a", "b"],
    completed: [],
  }));
test("downloaded order roundtrips", () => {
  const p = { schemaVersion: 1, order: ["b", "a"], completed: ["a"] };
  assert.deepEqual(
    m.applyProgress(rows, JSON.parse(JSON.stringify(p))).items.map((x) => x.id),
    ["b", "a"],
  );
});
test("stale IDs rejected", () =>
  assert.throws(
    () =>
      m.applyProgress(rows, {
        schemaVersion: 1,
        order: ["a", "z"],
        completed: [],
      }),
    /order/,
  ));
test("duplicate completed IDs rejected", () =>
  assert.throws(
    () =>
      m.applyProgress(rows, {
        schemaVersion: 1,
        order: ["a", "b"],
        completed: ["a", "a"],
      }),
    /completed/,
  ));
test("heldout script text cannot break embedded data", () => {
  const html = m.renderCollection(rows, m.applyProgress(rows).progress);
  assert.ok(!html.includes("<script>alert(1)</script>"));
  assert.ok(html.includes("Download progress.json"));
  assert.ok(html.includes("Move up"));
});
test("progress does not mutate input", () => {
  const r = m.applyProgress(rows);
  r.items[0].originals.push("changed");
  assert.equal(rows[0].originals.length, 1);
});
