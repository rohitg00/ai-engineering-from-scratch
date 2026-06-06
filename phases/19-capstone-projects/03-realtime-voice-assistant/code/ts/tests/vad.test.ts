import { test } from "node:test";
import { strict as assert } from "node:assert";
import { synthCall, turnCompletionScore } from "../src/vad.ts";

test("turnCompletionScore: empty partial returns 0", () => {
  assert.equal(turnCompletionScore(""), 0);
});

test("turnCompletionScore: terminal punctuation scores 0.95", () => {
  assert.ok(turnCompletionScore("what time is it?") >= 0.9);
  assert.ok(turnCompletionScore("done.") >= 0.9);
  assert.ok(turnCompletionScore("stop!") >= 0.9);
});

test("turnCompletionScore: scales with token count", () => {
  assert.ok(turnCompletionScore("hi") < turnCompletionScore("hello there friend"));
  assert.ok(
    turnCompletionScore("hello there friend") <
      turnCompletionScore("hello there my dear close friend"),
  );
});

test("synthCall: produces a frame sequence with leading silence, speech, trailing silence", () => {
  const frames = synthCall("hello world");
  assert.ok(frames.length > 100);
  // First six frames are leading silence (noise=0 so isSpeech is false here)
  for (let i = 0; i < 6; i++) assert.equal(frames[i].isSpeech, false);
  // Middle frames carry speech
  const speechCount = frames.filter((f) => f.isSpeech).length;
  assert.ok(speechCount >= 16);
  // Trailing tail is silence
  assert.equal(frames[frames.length - 1].isSpeech, false);
});

test("synthCall: timestamps are monotonic in 20ms steps", () => {
  const frames = synthCall("hi there");
  for (let i = 1; i < frames.length; i++) {
    assert.equal(frames[i].tMs - frames[i - 1].tMs, 20);
  }
});
