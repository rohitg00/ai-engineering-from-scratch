import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  encodeSseFrame,
  parseSseStream,
  retrieve,
  tokenizeAnswer,
} from "../src/stream.js";

describe("encodeSseFrame", () => {
  it("encodes event + JSON-stringified data with the SSE double-newline terminator", () => {
    const frame = encodeSseFrame("token", { text: "hi" });
    assert.equal(frame, 'event: token\ndata: {"text":"hi"}\n\n');
  });

  it("round-trips through parseSseStream", () => {
    const concat =
      encodeSseFrame("session", { sessionId: "s-1" }) +
      encodeSseFrame("token", { text: "a" }) +
      encodeSseFrame("token", { text: "b" }) +
      encodeSseFrame("done", { totalTokens: 2 });
    const events = parseSseStream(concat);
    assert.equal(events.length, 4);
    assert.equal(events[0]?.event, "session");
    assert.equal(events[3]?.event, "done");
  });
});

describe("retrieve", () => {
  it("boosts entries that match the jurisdiction tag", () => {
    const results = retrieve("erasure", "GDPR", 3);
    assert.ok(results.length > 0);
    const top = results[0];
    assert.ok(top);
    assert.equal(top.docId, "GDPR-Art-17");
  });

  it("returns at most k citations", () => {
    const results = retrieve("data", "GDPR", 2);
    assert.ok(results.length <= 2);
  });
});

describe("tokenizeAnswer", () => {
  it("falls back to a no-match message when there are no citations", () => {
    const tokens = tokenizeAnswer("anything", []);
    const joined = tokens.join("");
    assert.match(joined, /No matching policy found for "anything"\./);
  });

  it("leads with the first citation when present", () => {
    const tokens = tokenizeAnswer("q", [
      { docId: "GDPR-Art-17", page: 1, snippet: "snippet text", score: 5 },
    ]);
    const joined = tokens.join("");
    assert.match(joined, /^Per GDPR-Art-17, snippet text$/);
  });

  it("appends a 'See also' tail when there are more citations", () => {
    const tokens = tokenizeAnswer("q", [
      { docId: "A", page: 1, snippet: "x", score: 1 },
      { docId: "B", page: 2, snippet: "y", score: 1 },
      { docId: "C", page: 3, snippet: "z", score: 1 },
    ]);
    const joined = tokens.join("");
    assert.match(joined, /See also B, C\./);
  });
});
