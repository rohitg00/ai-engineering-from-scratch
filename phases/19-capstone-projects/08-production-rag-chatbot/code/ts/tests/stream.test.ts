import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  encodeSseFrame,
  parseSseStream,
  retrieve,
  tokenizeAnswer,
} from "../src/stream.js";

describe("encodeSseFrame", () => {
  it("event と JSON-stringified data を SSE double-newline terminator 付きで encode する", () => {
    const frame = encodeSseFrame("token", { text: "hi" });
    assert.equal(frame, 'event: token\ndata: {"text":"hi"}\n\n');
  });

  it("parseSseStream で round-trip する", () => {
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
  it("jurisdiction tag が一致する entry を boost する", () => {
    const results = retrieve("erasure", "GDPR", 3);
    assert.ok(results.length > 0);
    const top = results[0];
    assert.ok(top);
    assert.equal(top.docId, "GDPR-Art-17");
  });

  it("最大 k 件の citation を返す", () => {
    const results = retrieve("data", "GDPR", 2);
    assert.ok(results.length <= 2);
  });
});

describe("tokenizeAnswer", () => {
  it("citation がない場合は no-match message に fallback する", () => {
    const tokens = tokenizeAnswer("anything", []);
    const joined = tokens.join("");
    assert.match(joined, /"anything" に一致する policy は見つかりませんでした。/);
  });

  it("citation がある場合は最初の citation から始める", () => {
    const tokens = tokenizeAnswer("q", [
      { docId: "GDPR-Art-17", page: 1, snippet: "snippet text", score: 5 },
    ]);
    const joined = tokens.join("");
    assert.match(joined, /^GDPR-Art-17 によると、snippet text$/);
  });

  it("追加 citation がある場合は関連 tail を付ける", () => {
    const tokens = tokenizeAnswer("q", [
      { docId: "A", page: 1, snippet: "x", score: 1 },
      { docId: "B", page: 2, snippet: "y", score: 1 },
      { docId: "C", page: 3, snippet: "z", score: 1 },
    ]);
    const joined = tokens.join("");
    assert.match(joined, /関連: B, C。/);
  });
});
