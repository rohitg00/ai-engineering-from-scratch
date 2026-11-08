import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";
const m = await import(
  pathToFileURL(path.join(process.env.PROJECT_WORKSPACE, "main.ts")).href
);
const model = {
  schemaVersion: 1,
  words: { seed: 5, shade: 10, share: 2 },
  histories: { '["garden","club"]': { share: 1 }, '["club"]': { shade: 2 } },
  sources: { seed: ["a"], shade: ["b"], share: ["c"] },
};
test("two-word history outranks higher unigram", () =>
  assert.equal(m.suggest(model, "s", ["garden", "club"])[0].word, "share"));
test("one-word backoff outranks unigram", () =>
  assert.equal(m.suggest(model, "s", ["club"])[0].word, "shade"));
test("unknown history falls back to count", () =>
  assert.equal(m.suggest(model, "s", ["unknown"])[0].word, "shade"));
test("prefix filters candidates", () =>
  assert.deepEqual(
    m.suggest(model, "see").map((x) => x.word),
    ["seed"],
  ));
test("heldout unmatched prefix returns none", () =>
  assert.deepEqual(m.suggest(model, "zzz"), []));
test("limit validation and zero", () => {
  assert.deepEqual(m.suggest(model, "", [], 0), []);
  assert.throws(() => m.suggest(model, "", [], 1.5), /limit/);
});
