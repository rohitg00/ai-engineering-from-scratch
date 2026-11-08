import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";
const m = await import(
  pathToFileURL(path.join(process.env.PROJECT_WORKSPACE, "main.ts")).href
);
test("extracts repeated placeholder contract", () =>
  assert.deepEqual(m.placeholders("{name}: {count} of {count}"), [
    "{count}",
    "{count}",
    "{name}",
  ]));
test("reads message context", () =>
  assert.equal(
    m.readCatalog({ title: { text: "Borrow", context: "page title" } })[0]
      .context,
    "page title",
  ));
test("nested braces rejected", () =>
  assert.throws(() => m.placeholders("{{name}}"), /simple/));
test("empty context rejected", () =>
  assert.throws(
    () => m.readCatalog({ title: { text: "Borrow", context: "" } }),
    /context/,
  ));
test("heldout unsafe key rejected", () =>
  assert.throws(
    () => m.readCatalog({ constructor: { text: "x", context: "y" } }),
    /key/,
  ));
test("ambiguous requires boolean", () =>
  assert.throws(
    () =>
      m.readCatalog({ title: { text: "x", context: "y", ambiguous: "yes" } }),
    /boolean/,
  ));
