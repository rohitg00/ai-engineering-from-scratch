import test from "node:test";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { join } from "node:path";
const m = await import(
  pathToFileURL(join(process.env.PROJECT_WORKSPACE, "main.ts")).href
);
function deck() {
  return {
    sources: [
      {
        id: "s",
        title: "Repair guide",
        text: "Store spare bolts in the green tray. Check the label each Friday.",
      },
    ],
    cards: [
      {
        id: "c",
        sourceId: "s",
        question: "Where are spare bolts stored?",
        answer: "green tray",
        accepted: ["the green tray"],
        start: 0,
        end: 36,
      },
    ],
  };
}

test("case whitespace and terminal punctuation normalize", () =>
  assert.equal(m.normalizeAnswer("  GREEN   TRAY!  "), "green tray"));
test("approved variant is accepted", () =>
  assert.equal(m.gradeAnswer(deck(), "c", "The green tray.").correct, true));
test("negative substring cannot pass", () =>
  assert.equal(m.gradeAnswer(deck(), "c", "not green tray").correct, false));
test("empty and punctuation-only answers fail", () => {
  for (const answer of ["", "   ", "!!!"])
    assert.equal(m.gradeAnswer(deck(), "c", answer).correct, false);
});
test("feedback preserves source quote and location", () => {
  const g = m.gradeAnswer(deck(), "c", "red tray");
  assert.equal(g.correct, false);
  assert.equal(g.expected, "green tray");
  assert.equal(g.quote, deck().sources[0].text.slice(g.start, g.end));
  assert.equal(g.sourceId, "s");
});
test("unknown card and invalid response fail", () => {
  assert.throws(() => m.gradeAnswer(deck(), "missing", "green tray"));
  assert.throws(() => m.gradeAnswer(deck(), "c", null));
});
test("compatibility-width letters normalize", () =>
  assert.equal(m.normalizeAnswer("ＧＲＥＥＮ ＴＲＡＹ"), "green tray"));
