import { strict as assert } from "node:assert";
import { test } from "node:test";
import { ObservabilityStore, RingBuffer, normaliseSpan } from "../src/spans.js";

test("ring buffer holds items below capacity", () => {
  const rb = new RingBuffer<number>(3);
  rb.push(1);
  rb.push(2);
  assert.deepEqual(rb.snapshot(), [1, 2]);
  assert.equal(rb.size(), 2);
  assert.equal(rb.isFull(), false);
});

test("ring buffer evicts oldest once full", () => {
  const rb = new RingBuffer<number>(3);
  rb.push(1);
  rb.push(2);
  rb.push(3);
  rb.push(4);
  assert.deepEqual(rb.snapshot(), [2, 3, 4]);
  assert.equal(rb.isFull(), true);
});

test("ring buffer keeps eviction order after many writes", () => {
  const rb = new RingBuffer<number>(4);
  for (let i = 0; i < 100; i++) rb.push(i);
  assert.deepEqual(rb.snapshot(), [96, 97, 98, 99]);
});

test("ring buffer rejects non-positive capacity", () => {
  assert.throws(() => new RingBuffer<number>(0));
  assert.throws(() => new RingBuffer<number>(-1));
});

test("normaliseSpan rejects malformed input", () => {
  assert.equal(normaliseSpan(null), null);
  assert.equal(normaliseSpan({}), null);
  assert.equal(
    normaliseSpan({ attributes: { "gen_ai.system": "openai" } }),
    null,
  );
});

test("normaliseSpan accepts a complete GenAI shape", () => {
  const span = normaliseSpan({
    trace_id: "t-1",
    span_id: "s-1",
    name: "chat.completion",
    start_time_unix_nano: 1_000,
    end_time_unix_nano: 2_000,
    status: "OK",
    attributes: {
      "gen_ai.system": "openai",
      "gen_ai.request.model": "gpt-4o-mini",
      "gen_ai.operation.name": "chat",
      "gen_ai.usage.input_tokens": 100,
      "gen_ai.usage.output_tokens": 50,
    },
  });
  assert.ok(span);
  assert.equal(span?.attributes["gen_ai.request.model"], "gpt-4o-mini");
});

test("ObservabilityStore tracks accepted, rejected, held", () => {
  const store = new ObservabilityStore(4);
  store.ingest({
    attributes: {
      "gen_ai.system": "openai",
      "gen_ai.request.model": "gpt-4o-mini",
      "gen_ai.operation.name": "chat",
    },
  });
  store.ingest({ bad: true });
  const c = store.counters();
  assert.equal(c.accepted, 1);
  assert.equal(c.rejected, 1);
  assert.equal(c.held, 1);
});
