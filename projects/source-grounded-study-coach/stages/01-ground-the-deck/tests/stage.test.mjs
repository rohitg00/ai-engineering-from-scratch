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

test("valid evidence keeps offsets and original text", () => {
  const d = m.validateDeck(deck());
  assert.equal(d.cards[0].answer, "green tray");
  assert.equal(
    d.sources[0].text.slice(0, 36),
    "Store spare bolts in the green tray.",
  );
});
test("duplicate source or card identities fail", () => {
  let d = deck();
  d.cards.push({ ...d.cards[0] });
  assert.throws(() => m.validateDeck(d));
  d = deck();
  d.sources.push({ ...d.sources[0] });
  assert.throws(() => m.validateDeck(d));
});
test("unknown source and outside offsets fail", () => {
  let d = deck();
  d.cards[0].sourceId = "absent";
  assert.throws(() => m.validateDeck(d));
  for (const end of [0, 500, 1.5]) {
    d = deck();
    d.cards[0].end = end;
    assert.throws(() => m.validateDeck(d));
  }
});
test("answer must occur in its selected evidence quote", () => {
  const d = deck();
  d.cards[0].answer = "Friday";
  assert.throws(() => m.validateDeck(d));
});
test("result is detached from mutable input", () => {
  const d = deck(),
    checked = m.validateDeck(d);
  d.sources[0].text = "changed";
  assert.notEqual(checked.sources[0].text, "changed");
});
test("UTF-16 offsets remain compatible with slicing", () => {
  const d = deck();
  d.sources[0].text = "🧰 " + d.sources[0].text;
  d.cards[0].start = 3;
  d.cards[0].end = 39;
  assert.equal(
    m.validateDeck(d).sources[0].text.slice(3, 39),
    "Store spare bolts in the green tray.",
  );
});
test("empty and wrongly typed authored variants fail", () => {
  for (const accepted of [[""], [12], null]) {
    const d = deck();
    d.cards[0].accepted = accepted;
    assert.throws(() => m.validateDeck(d));
  }
});
