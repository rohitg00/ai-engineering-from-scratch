import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  REPLAY_WINDOW_SECONDS,
  signForTesting,
  verifySlackSignature,
} from "../src/slack_verify.js";

const SECRET = "shh";

describe("verifySlackSignature", () => {
  it("accepts a freshly signed body", () => {
    const ts = String(Math.floor(Date.now() / 1000));
    const body = "command=%2Foncall&text=test";
    const sig = signForTesting(SECRET, ts, body);
    const verdict = verifySlackSignature({
      signingSecret: SECRET,
      timestamp: ts,
      signature: sig,
      rawBody: body,
      nowSeconds: Number(ts),
    });
    assert.equal(verdict.ok, true);
  });

  it("rejects a tampered signature", () => {
    const ts = String(Math.floor(Date.now() / 1000));
    const body = "command=%2Foncall&text=test";
    const sig = signForTesting(SECRET, ts, body);
    const tampered = sig.slice(0, -1) + (sig.endsWith("0") ? "1" : "0");
    const verdict = verifySlackSignature({
      signingSecret: SECRET,
      timestamp: ts,
      signature: tampered,
      rawBody: body,
      nowSeconds: Number(ts),
    });
    assert.equal(verdict.ok, false);
    if (!verdict.ok) assert.equal(verdict.reason, "mismatch");
  });

  it("rejects a timestamp outside the 5-minute replay window", () => {
    const ts = String(Math.floor(Date.now() / 1000));
    const body = "command=%2Foncall&text=test";
    const sig = signForTesting(SECRET, ts, body);
    const verdict = verifySlackSignature({
      signingSecret: SECRET,
      timestamp: ts,
      signature: sig,
      rawBody: body,
      nowSeconds: Number(ts) + REPLAY_WINDOW_SECONDS + 1,
    });
    assert.equal(verdict.ok, false);
    if (!verdict.ok) assert.equal(verdict.reason, "stale");
  });

  it("rejects a non-numeric timestamp", () => {
    const verdict = verifySlackSignature({
      signingSecret: SECRET,
      timestamp: "not-a-number",
      signature: "v0=deadbeef",
      rawBody: "",
      nowSeconds: 0,
    });
    assert.equal(verdict.ok, false);
    if (!verdict.ok) assert.equal(verdict.reason, "bad-timestamp");
  });

  it("rejects a mismatched signature length without leaking via early return", () => {
    const ts = String(Math.floor(Date.now() / 1000));
    const verdict = verifySlackSignature({
      signingSecret: SECRET,
      timestamp: ts,
      signature: "v0=short",
      rawBody: "body",
      nowSeconds: Number(ts),
    });
    assert.equal(verdict.ok, false);
    if (!verdict.ok) assert.equal(verdict.reason, "length-mismatch");
  });
});
