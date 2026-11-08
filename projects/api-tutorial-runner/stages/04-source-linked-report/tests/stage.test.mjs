import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";
const m = await import(
  pathToFileURL(path.join(process.env.PROJECT_WORKSPACE, "main.ts")).href
);
const receipts = [
  {
    id: "read",
    line: 3,
    status: "fail",
    message: "Missing field <title>",
    variables: {},
  },
  {
    id: "return",
    line: 8,
    status: "skip",
    message: "Earlier failure",
    variables: {},
  },
];
test("JUnit failure and skip counts", () => {
  const r = m.exportResults([], receipts);
  assert.ok(r.junit.includes('failures="1"'));
  assert.ok(r.junit.includes('skipped="1"'));
});
test("JUnit escapes failure attributes", () =>
  assert.ok(m.exportResults([], receipts).junit.includes("&lt;title&gt;")));
test("draft corrections remain unapproved", () =>
  assert.equal(m.exportResults([], receipts).corrections[0].approved, false));
test("approved correction reimports", () =>
  assert.deepEqual(
    m.acceptedCorrections(receipts, {
      schemaVersion: 1,
      corrections: [
        {
          id: "read",
          line: 3,
          issue: receipts[0].message,
          approved: true,
          proposal: "Use title",
        },
      ],
    }),
    [{ id: "read", line: 3, proposal: "Use title" }],
  ));
test("heldout stale failure rejected", () =>
  assert.throws(
    () =>
      m.acceptedCorrections(receipts, {
        schemaVersion: 1,
        corrections: [
          { id: "read", line: 3, issue: "old", approved: true, proposal: "x" },
        ],
      }),
    /Stale/,
  ));
test("empty approved correction rejected", () =>
  assert.throws(
    () =>
      m.acceptedCorrections(receipts, {
        schemaVersion: 1,
        corrections: [
          {
            id: "read",
            line: 3,
            issue: receipts[0].message,
            approved: true,
            proposal: "",
          },
        ],
      }),
    /nonempty/,
  ));
