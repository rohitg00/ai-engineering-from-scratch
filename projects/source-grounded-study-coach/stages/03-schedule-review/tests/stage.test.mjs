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

function attempt(id, date, answer = "green tray") {
  return { id, cardId: "c", date, answer };
}
test("new card starts due on the initial date", () =>
  assert.deepEqual(m.buildProgress(deck(), [], "2026-09-01"), [
    { cardId: "c", box: 0, due: "2026-09-01", attempts: 0, lastDate: null },
  ]));
test("two correct events grow the next interval", () => {
  const p = m.buildProgress(
    deck(),
    [attempt("a", "2026-09-01"), attempt("b", "2026-09-02")],
    "2026-09-01",
  )[0];
  assert.equal(p.box, 2);
  assert.equal(p.due, "2026-09-04");
});
test("incorrect answer resets box and crosses month boundary", () => {
  const p = m.buildProgress(
    deck(),
    [attempt("a", "2026-09-30", "red tray")],
    "2026-09-01",
  )[0];
  assert.equal(p.box, 0);
  assert.equal(p.due, "2026-10-01");
});
test("exact replay duplicates do not advance again", () => {
  const a = attempt("a", "2026-09-01");
  assert.equal(
    m.buildProgress(deck(), [a, { ...a }], "2026-09-01")[0].attempts,
    1,
  );
  assert.throws(() =>
    m.buildProgress(deck(), [a, { ...a, answer: "red tray" }], "2026-09-01"),
  );
});
test("ordering is deterministic for out-of-order events", () => {
  const a = attempt("a", "2026-09-01"),
    b = attempt("b", "2026-09-02");
  assert.deepEqual(
    m.buildProgress(deck(), [b, a], "2026-09-01"),
    m.buildProgress(deck(), [a, b], "2026-09-01"),
  );
});
test("calendar invalidity unknown card and early event fail", () => {
  assert.throws(() => m.parseDay("2026-09-31"));
  assert.throws(() => m.parseDay("09/03/2026"));
  assert.throws(() =>
    m.buildProgress(deck(), [attempt("a", "2026-08-31")], "2026-09-01"),
  );
  assert.throws(() =>
    m.buildProgress(
      deck(),
      [{ ...attempt("a", "2026-09-01"), cardId: "missing" }],
      "2026-09-01",
    ),
  );
});
test("due selection is inclusive and box growth caps at five", () => {
  const attempts = Array.from({ length: 8 }, (_, i) =>
    attempt(String(i), `2026-09-${String(i + 1).padStart(2, "0")}`),
  );
  const p = m.buildProgress(deck(), attempts, "2026-09-01");
  assert.equal(p[0].box, 5);
  assert.equal(p[0].due, "2026-09-24");
  assert.equal(m.dueCards(p, "2026-09-23").length, 0);
  assert.equal(m.dueCards(p, "2026-09-24").length, 1);
});
