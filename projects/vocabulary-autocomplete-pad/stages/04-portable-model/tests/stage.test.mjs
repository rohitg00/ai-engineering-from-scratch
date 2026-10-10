import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";
const m = await import(
  pathToFileURL(path.join(process.env.PROJECT_WORKSPACE, "main.ts")).href
);
const model = {
  schemaVersion: 1,
  words: { seed: 2 },
  histories: { '["seed"]': { seed: 1 } },
  sources: { seed: ["garden"] },
};
test("portable JSON roundtrip", () =>
  assert.deepEqual(m.importModel(JSON.parse(JSON.stringify(model))), model));
test("bad schema rejected", () =>
  assert.throws(() => m.importModel({ ...model, schemaVersion: 2 }), /schema/));
test("conditional count cannot exceed total", () =>
  assert.throws(
    () => m.importModel({ ...model, histories: { '["seed"]': { seed: 3 } } }),
    /conditional/,
  ));
test("invalid word rejected", () =>
  assert.throws(
    () => m.importModel({ ...model, words: { "two words": 2 } }),
    /word/,
  ));
test("heldout page escapes source delimiters", () => {
  const html = m.renderPad(model, "</script><script>evil()</script>");
  assert.ok(!html.includes("</script><script>evil()"));
  assert.ok(html.includes("Download vocabulary-model.json"));
});
test("model import returns independent copy", () => {
  const copy = m.importModel(model);
  copy.sources.seed.push("x");
  assert.deepEqual(model.sources.seed, ["garden"]);
});
