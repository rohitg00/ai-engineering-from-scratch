import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";
const m = await import(
  pathToFileURL(path.join(process.env.PROJECT_WORKSPACE, "main.ts")).href
);
const t = [
  {
    id: "map",
    term: "map",
    aliases: [],
    definition: "A </script><script>oops</script>",
  },
];
test("ships standalone document", () =>
  assert.ok(
    m.publishGlossary("<p>map</p>", t).html.startsWith("<!doctype html>"),
  ));
test("exports reusable exact glossary", () => {
  const r = m.publishGlossary("<p>map</p>", t);
  assert.deepEqual(
    m.validateGlossary(JSON.parse(JSON.stringify(r.glossary))),
    t,
  );
});
test("reports absent terms", () =>
  assert.equal(m.publishGlossary("<p>Other text</p>", t).coverage[0].count, 0));
test("includes a keyboard-native disclosure button", () =>
  assert.ok(m.publishGlossary("<p>map</p>", t).html.includes(">map</button>")));
test("heldout embedded script escaped", () =>
  assert.ok(
    !m.publishGlossary("<p>map</p>", t).html.includes("</script><script>oops"),
  ));
test("exports a copy", () => {
  const r = m.publishGlossary("<p>map</p>", t);
  r.glossary[0].definition = "new";
  assert.notEqual(t[0].definition, "new");
});
