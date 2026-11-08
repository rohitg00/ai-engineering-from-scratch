import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";
const m = await import(
  pathToFileURL(path.join(process.env.PROJECT_WORKSPACE, "main.ts")).href
);
const msgs = [
    {
      key: "return",
      text: "Return",
      context: "Return a tool",
      ambiguous: true,
      placeholders: [],
    },
  ],
  props = [
    { key: "return", translation: "Devolver", issues: [], needsContext: true },
  ];
const review = (decision, ack = true) => ({
  schemaVersion: 1,
  decisions: {
    return: { decision, translation: "Devolver", acknowledgeContext: ack },
  },
});
test("pending omitted from locale", () =>
  assert.deepEqual(m.reviewTranslations(msgs, props).catalog, {}));
test("explicit acknowledged approval exported", () =>
  assert.deepEqual(
    m.reviewTranslations(msgs, props, review("approve")).catalog,
    { return: "Devolver" },
  ));
test("ambiguous approval requires acknowledgement", () =>
  assert.throws(
    () => m.reviewTranslations(msgs, props, review("approve", false)),
    /context/,
  ));
test("rejected key remains unresolved", () =>
  assert.equal(
    m.reviewTranslations(msgs, props, review("reject")).unresolved[0].key,
    "return",
  ));
test("heldout approval cannot bypass mismatch", () =>
  assert.throws(
    () =>
      m.reviewTranslations(
        msgs,
        [{ ...props[0], issues: ["Placeholder multiset changed"] }],
        review("approve"),
      ),
    /issues/,
  ));
test("stale translation rejected", () => {
  const r = review("approve");
  r.decisions.return.translation = "Old";
  assert.throws(() => m.reviewTranslations(msgs, props, r), /Stale/);
});
