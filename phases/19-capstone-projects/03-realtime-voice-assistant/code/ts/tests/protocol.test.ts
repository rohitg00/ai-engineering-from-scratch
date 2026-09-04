import { test } from "node:test";
import { strict as assert } from "node:assert";
import { decodeFrame, encodeFrame } from "../src/protocol.ts";

test("encodeFrame + decodeFrame: round-trips event frame", () => {
  const f = { type: "event" as const, line: "100ms LISTENING" };
  const raw = encodeFrame(f);
  const back = decodeFrame(raw);
  assert.deepEqual(back, f);
});

test("encodeFrame + decodeFrame: round-trips summary frame", () => {
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

test("decodeFrame: rejects unknown type via zod discriminated union", () => {
  assert.throws(() => decodeFrame(JSON.stringify({ type: "garbage" })));
});

test("decodeFrame: rejects missing fields", () => {
  assert.throws(() => decodeFrame(JSON.stringify({ type: "summary" })));
});
