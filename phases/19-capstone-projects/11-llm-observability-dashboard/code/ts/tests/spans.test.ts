import { strict as assert } from "node:assert";
import { test } from "node:test";
import { ObservabilityStore, RingBuffer, normaliseSpan } from "../src/spans.js";

test("ring buffer は capacity 未満の item を保持する", () => {
  const rb = new RingBuffer<number>(3);
  rb.push(1);
  rb.push(2);
  assert.deepEqual(rb.snapshot(), [1, 2]);
  assert.equal(rb.size(), 2);
  assert.equal(rb.isFull(), false);
});

test("ring buffer は満杯になると最古 item を evict する", () => {
  const rb = new RingBuffer<number>(3);
  rb.push(1);
  rb.push(2);
  rb.push(3);
  rb.push(4);
  assert.deepEqual(rb.snapshot(), [2, 3, 4]);
  assert.equal(rb.isFull(), true);
});

test("ring buffer は多数の write 後も eviction order を保つ", () => {
  const rb = new RingBuffer<number>(4);
  for (let i = 0; i < 100; i++) rb.push(i);
  assert.deepEqual(rb.snapshot(), [96, 97, 98, 99]);
});

test("ring buffer は non-positive capacity を reject する", () => {
  assert.throws(() => new RingBuffer<number>(0));
  assert.throws(() => new RingBuffer<number>(-1));
});

test("normaliseSpan は malformed input を reject する", () => {
  assert.equal(normaliseSpan(null), null);
  assert.equal(normaliseSpan({}), null);
  assert.equal(
    normaliseSpan({ attributes: { "gen_ai.system": "openai" } }),
    null,
  );
});

test("normaliseSpan は complete GenAI shape を受け付ける", () => {
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

test("ObservabilityStore は accepted、rejected、held を追跡する", () => {
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
