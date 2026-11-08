import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";
const m = await import(
  pathToFileURL(path.join(process.env.PROJECT_WORKSPACE, "main.ts")).href
);
test("normalizes host port and fragment", () =>
  assert.equal(
    m.normalizeURL("https://EXAMPLE.invalid:443/a#b"),
    "https://example.invalid/a",
  ));
test("query semantics retained", () =>
  assert.notEqual(
    m.normalizeURL("https://x.invalid/a?q=1"),
    m.normalizeURL("https://x.invalid/a?q=2"),
  ));
test("trailing slash retained", () =>
  assert.notEqual(
    m.normalizeURL("https://x.invalid/a/"),
    m.normalizeURL("https://x.invalid/a"),
  ));
test("groups retain original evidence", () => {
  const x = [
    {
      id: "a",
      title: "a",
      url: "https://x.invalid/#a",
      notes: "",
      folders: ["f"],
    },
    {
      id: "b",
      title: "b",
      url: "https://x.invalid/#b",
      notes: "",
      folders: [],
    },
  ];
  const r = m.groupDuplicates(x);
  assert.equal(r.length, 1);
  assert.equal(r[0].items.length, 2);
  r[0].items[0].folders.push("changed");
  assert.deepEqual(x[0].folders, ["f"]);
});
test("heldout credentials rejected", () =>
  assert.throws(
    () => m.normalizeURL("https://user:password@x.invalid"),
    /credentials/,
  ));
test("HTTP and HTTPS remain distinct", () =>
  assert.notEqual(
    m.normalizeURL("http://x.invalid"),
    m.normalizeURL("https://x.invalid"),
  ));
