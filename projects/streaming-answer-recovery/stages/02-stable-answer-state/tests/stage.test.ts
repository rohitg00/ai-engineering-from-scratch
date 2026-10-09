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
test("append and complete", () => {
  let s = m.apply(m.initial(), event(1, "text", { text: "heldout" }));
  s = m.apply(s, event(2, "complete"));
  assert.equal(s.text, "heldout");
  assert.equal(s.status, "completed");
});
test("duplicate ignored", () => {
  const e = event(1, "text", { text: "x" }),
    s = m.apply(m.initial(), e);
  assert.deepEqual(m.apply(s, e), s);
});
test("conflicting ID rejected", () => {
  const s = m.apply(m.initial(), event(1, "text", { text: "x" }));
  assert.throws(() => m.apply(s, event(1, "text", { text: "y" })));
});
test("gap rejected", () =>
  assert.throws(() => m.apply(m.initial(), event(2, "complete"))));
test("unsafe citation rejected", () =>
  assert.throws(() =>
    m.apply(
      m.initial(),
      event(1, "citation", { label: "bad", url: "javascript:alert(1)" }),
    ),
  ));
test("interrupted text retained", () => {
  const s = m.interrupt(
    m.apply(m.initial(), event(1, "text", { text: "draft" })),
  );
  assert.equal(s.text, "draft");
  assert.equal(s.status, "interrupted");
});
test("cancel terminal", () => {
  const s = m.cancel(m.initial());
  assert.deepEqual(m.apply(s, event(1, "text", { text: "late" })), s);
});
