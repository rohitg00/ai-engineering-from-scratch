import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";
const m = await import(
  pathToFileURL(path.join(process.env.PROJECT_WORKSPACE, "main.ts")).href
);
const model = {
  schemaVersion: 1,
  words: { seeds: 2 },
  histories: {},
  sources: { seeds: ["a"] },
};
test("separates partial final token", () => {
  const r = m.completeText(model, "garden club se");
  assert.equal(r.prefix, "se");
  assert.deepEqual(r.history, ["garden", "club"]);
});
test("trailing space requests next word", () => {
  const r = m.completeText(model, "garden club ");
  assert.equal(r.prefix, "");
  assert.deepEqual(r.history, ["garden", "club"]);
});
test("period resets history", () =>
  assert.deepEqual(m.completeText(model, "garden club. se").history, []));
test("accept replaces prefix", () =>
  assert.equal(m.acceptSuggestion("grow se", "se", "seeds"), "grow seeds "));
test("heldout stale prefix rejected", () =>
  assert.throws(() => m.acceptSuggestion("grow sh", "se", "seeds"), /Prefix/));
test("non-token suggestion rejected", () =>
  assert.throws(() => m.acceptSuggestion("", "", "two words"), /token/));
