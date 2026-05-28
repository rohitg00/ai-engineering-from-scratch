import { test } from "node:test";
import { strict as assert } from "node:assert";
import { synthCall, turnCompletionScore } from "../src/vad.ts";

test("turnCompletionScore: empty partial は 0 を返す", () => {
  assert.equal(turnCompletionScore(""), 0);
});

test("turnCompletionScore: terminal punctuation は 0.95 を score する", () => {
  assert.ok(turnCompletionScore("what time is it?") >= 0.9);
  assert.ok(turnCompletionScore("done.") >= 0.9);
  assert.ok(turnCompletionScore("stop!") >= 0.9);
});

test("turnCompletionScore: token count に応じて scale する", () => {
  assert.ok(turnCompletionScore("hi") < turnCompletionScore("hello there friend"));
  assert.ok(
    turnCompletionScore("hello there friend") <
      turnCompletionScore("hello there my dear close friend"),
  );
});

test("synthCall: leading silence、speech、trailing silence の frame sequence を生成する", () => {
  const frames = synthCall("hello world");
  assert.ok(frames.length > 100);
  // 最初の 6 frame は leading silence です (noise=0 のためここでは isSpeech は false)。
  for (let i = 0; i < 6; i++) assert.equal(frames[i].isSpeech, false);
  // 中央の frame は speech を含みます。
  const speechCount = frames.filter((f) => f.isSpeech).length;
  assert.ok(speechCount >= 16);
  // 末尾の tail は silence です。
  assert.equal(frames[frames.length - 1].isSpeech, false);
});

test("synthCall: timestamp は 20ms step で monotonic", () => {
  const frames = synthCall("hi there");
  for (let i = 1; i < frames.length; i++) {
    assert.equal(frames[i].tMs - frames[i - 1].tMs, 20);
  }
});
