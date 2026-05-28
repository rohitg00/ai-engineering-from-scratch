import { test } from "node:test";
import { strict as assert } from "node:assert";
import { decodeFrame, encodeFrame } from "../src/protocol.ts";

test("encodeFrame + decodeFrame: event frame を round-trip する", () => {
  const f = { type: "event" as const, line: "100ms LISTENING" };
  const raw = encodeFrame(f);
  const back = decodeFrame(raw);
  assert.deepEqual(back, f);
});

test("encodeFrame + decodeFrame: summary frame を round-trip する", () => {
  const f = {
    type: "summary" as const,
    turnCompleteMs: 1000,
    firstLlmTokenMs: 1200,
    firstAudioOutMs: 1400,
    turnLatencyMs: 400,
    bargeIns: 0,
  };
  const raw = encodeFrame(f);
  const back = decodeFrame(raw);
  assert.deepEqual(back, f);
});

test("decodeFrame: unknown type を zod discriminated union で拒否する", () => {
  assert.throws(() => decodeFrame(JSON.stringify({ type: "garbage" })));
});

test("decodeFrame: missing field を拒否する", () => {
  assert.throws(() => decodeFrame(JSON.stringify({ type: "summary" })));
});
