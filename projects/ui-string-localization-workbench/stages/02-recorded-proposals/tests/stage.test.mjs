import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";
const m = await import(
  pathToFileURL(path.join(process.env.PROJECT_WORKSPACE, "main.ts")).href
);
const msgs = [
  {
    key: "count",
    text: "{count} tools",
    context: "summary",
    ambiguous: false,
    placeholders: ["{count}"],
  },
];
test("valid recorded proposal retained", () =>
  assert.deepEqual(
    m.proposeTranslations(msgs, { count: "{count} herramientas" }, "es")[0]
      .issues,
    [],
  ));
test("missing placeholder exposed", () =>
  assert.ok(
    m
      .proposeTranslations(msgs, { count: "Herramientas" }, "es")[0]
      .issues.includes("Placeholder multiset changed"),
  ));
test("missing proposal explicit", () =>
  assert.equal(m.proposeTranslations(msgs, {}, "es")[0].translation, null));
test("unknown proposal rejected", () =>
  assert.throws(
    () => m.proposeTranslations(msgs, { other: "x" }, "es"),
    /Unknown/,
  ));
test("heldout oversized proposal rejected", () =>
  assert.throws(
    () => m.proposeTranslations(msgs, { count: "x".repeat(2001) }, "es"),
    /2000/,
  ));
test("bad locale rejected", () =>
  assert.throws(
    () => m.proposeTranslations(msgs, {}, "not a locale"),
    /locale/,
  ));
