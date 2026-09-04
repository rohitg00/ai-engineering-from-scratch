import { test } from "node:test";
import { strict as assert } from "node:assert";
import { CURRICULUM, buildIndex, pickNextLesson, topoOrder } from "../src/curriculum.js";
import { MasteryStore } from "../src/mastery.js";
import { scheduleNextDue, MIN_INTERVAL_MS, MAX_INTERVAL_MS } from "../src/repetition.js";
import { BASE_INTERVAL_MS, MASTERY_THRESHOLD } from "../src/types.js";

test("topoOrder respects prereqs (parent before child)", () => {
  const order = topoOrder(CURRICULUM);
  const pos = new Map(order.map((id, i) => [id, i]));
  for (const l of CURRICULUM) {
    for (const p of l.prereqs) {
      const pp = pos.get(p);
      const cp = pos.get(l.id);
      assert.ok(pp !== undefined && cp !== undefined);
      assert.ok(pp < cp, `prereq ${p} must come before ${l.id}`);
    }
  }
});

test("topoOrder produces stable lexicographic tie-break", () => {
  const order = topoOrder(CURRICULUM);
  assert.equal(order[0], "py-01");
});

test("pickNextLesson returns first eligible un-mastered lesson", () => {
  const store = new MasteryStore();
  const index = buildIndex(CURRICULUM);
  const topo = topoOrder(CURRICULUM);
  const pick = pickNextLesson(topo, index, store.all(), 0);
  assert.ok(pick);
  assert.equal(pick.lesson.id, "py-01");
  assert.equal(pick.reason, "new_eligible");
});

test("BKT-ish update: score increases on correct, falls on wrong", () => {
  const store = new MasteryStore();
  const score1 = store.record("py-01", true, 1_000).score;
  assert.ok(score1 > 0);
  const due1 = store.peek("py-01")!.next_due_at;
  const score2 = store.record("py-01", true, due1 + 1).score;
  assert.ok(score2 > score1, `expected ${score2} > ${score1}`);
  const due2 = store.peek("py-01")!.next_due_at;
  const after3 = store.record("py-01", false, due2 + 1);
  assert.equal(after3.attempts, 3);
  assert.ok(after3.score <= score2, `expected ${after3.score} <= ${score2}`);
});

test("pickNextLesson advances frontier after mastery", () => {
  const store = new MasteryStore();
  const index = buildIndex(CURRICULUM);
  const topo = topoOrder(CURRICULUM);
  for (let i = 0; i < 10; i += 1) {
    store.record("py-01", true, 1_000 + i * 100);
  }
  const peek = store.peek("py-01");
  assert.ok(peek);
  assert.ok(peek.score >= MASTERY_THRESHOLD);
  const pick = pickNextLesson(topo, index, store.all(), 1_000_000);
  assert.ok(pick);
  assert.notEqual(pick.lesson.id, "py-01");
});

test("scheduleNextDue doubles interval on correct, halves on wrong", () => {
  const up = scheduleNextDue(BASE_INTERVAL_MS, true, 0);
  assert.equal(up.interval_ms, BASE_INTERVAL_MS * 2);
  assert.equal(up.next_due_at, BASE_INTERVAL_MS * 2);
  const down = scheduleNextDue(BASE_INTERVAL_MS, false, 0);
  assert.equal(down.interval_ms, Math.floor(BASE_INTERVAL_MS / 2));
});

test("scheduleNextDue clamps to MIN/MAX interval", () => {
  const tiny = scheduleNextDue(MIN_INTERVAL_MS, false, 0);
  assert.equal(tiny.interval_ms, MIN_INTERVAL_MS);
  const huge = scheduleNextDue(MAX_INTERVAL_MS, true, 0);
  assert.equal(huge.interval_ms, MAX_INTERVAL_MS);
});

test("pickNextLesson surfaces overdue review when no eligible new lessons", () => {
  const store = new MasteryStore();
  const index = buildIndex(CURRICULUM);
  const topo = topoOrder(CURRICULUM);

  let now = 1_000;
  for (const id of topo) {
    for (let i = 0; i < 8; i += 1) {
      store.record(id, true, now);
      now += 100;
    }
  }
  const allMastered = topo.every((id) => (store.peek(id)?.score ?? 0) >= MASTERY_THRESHOLD);
  assert.ok(allMastered);
  const later = now + MAX_INTERVAL_MS * 2;
  const pick = pickNextLesson(topo, index, store.all(), later);
  if (pick) assert.equal(pick.reason, "review_overdue");
});
