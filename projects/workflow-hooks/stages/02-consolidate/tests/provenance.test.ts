import test from "node:test";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import path from "node:path";
const m = await import(
  pathToFileURL(path.join(process.env.PROJECT_WORKSPACE!, "main.ts")).href
);
const c = {
  id: "c",
  session: "s",
  scope: "repo",
  rule: "Use API_KEY, never api_key",
  source: "Original user correction",
  locator: "session:s#turn-2",
};
test("preserves case-sensitive rule semantics", () =>
  assert.equal(m.consolidate([c])[0].text, c.rule));
test("retains source and durable locator", () =>
  assert.deepEqual(m.consolidate([c])[0].evidence, [
    { id: "c", session: "s", source: c.source, locator: c.locator },
  ]));
test("case-sensitive variants do not collapse", () =>
  assert.equal(
    m.consolidate([c, { ...c, id: "d", rule: "Use api_key, never API_KEY" }])
      .length,
    2,
  ));
