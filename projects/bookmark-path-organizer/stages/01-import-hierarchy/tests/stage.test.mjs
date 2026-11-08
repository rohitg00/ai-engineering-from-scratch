import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";
const m = await import(
  pathToFileURL(path.join(process.env.PROJECT_WORKSPACE, "main.ts")).href
);
test("keeps nested hierarchy and originals", () => {
  const r = m.importBookmarks([
    {
      title: "Maps",
      children: [
        {
          title: "Basics",
          children: [
            { id: "a", title: "A", url: "https://EXAMPLE.invalid/#x" },
          ],
        },
      ],
    },
  ]);
  assert.deepEqual(r[0].folders, ["Maps", "Basics"]);
  assert.equal(r[0].url, "https://EXAMPLE.invalid/#x");
  assert.equal(r[0].notes, "");
});
test("empty import is valid", () =>
  assert.deepEqual(m.importBookmarks([]), []));
test("duplicate IDs rejected", () =>
  assert.throws(
    () =>
      m.importBookmarks([
        { id: "a", title: "A", url: "https://x.invalid" },
        { id: "a", title: "B", url: "https://y.invalid" },
      ]),
    /Duplicate/,
  ));
test("active protocols rejected", () =>
  assert.throws(
    () =>
      m.importBookmarks([{ id: "a", title: "A", url: "javascript:alert(1)" }]),
    /HTTP/,
  ));
test("heldout malformed notes rejected", () =>
  assert.throws(
    () =>
      m.importBookmarks([
        { id: "a", title: "A", url: "https://x.invalid", notes: 17 },
      ]),
    /notes/,
  ));
test("input tree stays unchanged", () => {
  const x = [
      {
        title: "F",
        children: [{ id: "z", title: "Z", url: "https://z.invalid" }],
      },
    ],
    s = JSON.stringify(x);
  m.importBookmarks(x);
  assert.equal(JSON.stringify(x), s);
});
