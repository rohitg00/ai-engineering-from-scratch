import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";
const m = await import(
  pathToFileURL(path.join(process.env.PROJECT_WORKSPACE, "main.ts")).href
);
const c = [
  {
    id: "p1",
    original: "Utilize maps.",
    candidate: "Use maps.",
    before: { words: 2, sentences: 1, averageWords: 2, longWords: 0 },
    after: { words: 2, sentences: 1, averageWords: 2, longWords: 0 },
    issues: [],
  },
];
test("pending retains original", () =>
  assert.equal(m.exportRevisions(c).markdown, "Utilize maps.\n"));
test("explicit accept exports candidate", () =>
  assert.equal(
    m.exportRevisions(c, {
      schemaVersion: 1,
      decisions: [{ id: "p1", decision: "accept", candidate: "Use maps." }],
    }).markdown,
    "Use maps.\n",
  ));
test("reject keeps original and resolves review", () => {
  const r = m.exportRevisions(c, {
    schemaVersion: 1,
    decisions: [{ id: "p1", decision: "reject", candidate: "Use maps." }],
  });
  assert.deepEqual(r.unresolved, []);
  assert.equal(r.markdown, "Utilize maps.\n");
});
test("stale proposal approval rejected", () =>
  assert.throws(
    () =>
      m.exportRevisions(c, {
        schemaVersion: 1,
        decisions: [{ id: "p1", decision: "accept", candidate: "Different" }],
      }),
    /Stale/,
  ));
test("heldout edited review cannot bypass issues", () =>
  assert.throws(
    () =>
      m.exportRevisions([{ ...c[0], issues: ["Numeric facts changed"] }], {
        schemaVersion: 1,
        decisions: [{ id: "p1", decision: "accept", candidate: "Use maps." }],
      }),
    /factual/,
  ));
test("interface exposes review download", () =>
  assert.ok(
    m.renderDesk(c, m.exportRevisions(c)).includes("revision-decisions.json"),
  ));
