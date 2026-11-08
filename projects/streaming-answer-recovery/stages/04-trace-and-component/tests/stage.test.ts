import { test } from "node:test";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import path from "node:path";
const m = await import(
  pathToFileURL(path.join(process.env.PROJECT_WORKSPACE!, "main.ts")).href
);

const event = (id, type, value = {}) => ({
  id: String(id),
  event: "message",
  data: JSON.stringify({ type, ...value }),
});
test("interrupted replay", () => {
  const s = m.interrupt(m.apply(m.initial(), event(1, "text", { text: "雪" })));
  assert.deepEqual(m.replay(m.trace(s)), s);
});
test("completed replay", () => {
  const s = m.apply(m.initial(), event(1, "complete"));
  assert.deepEqual(m.replay(m.trace(s)), s);
});
test("fake completion fails", () =>
  assert.throws(() =>
    m.replay('{"schemaVersion":1,"status":"completed","events":[]}'),
  ));
test("unknown schema fails", () =>
  assert.throws(() =>
    m.replay('{"schemaVersion":2,"status":"draft","events":[]}'),
  ));
test("cancel replay", () =>
  assert.equal(m.replay(m.trace(m.cancel(m.initial()))).status, "cancelled"));
test("trace contains only accepted events", () => {
  const s = m.apply(m.initial(), event(1, "text", { text: "Caf" }));
  assert.equal(JSON.parse(m.trace(s)).events.length, 1);
});
