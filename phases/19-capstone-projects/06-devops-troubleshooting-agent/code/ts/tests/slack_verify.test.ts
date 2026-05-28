import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  REPLAY_WINDOW_SECONDS,
  signForTesting,
  verifySlackSignature,
} from "../src/slack_verify.js";

const SECRET = "shh";

describe("verifySlackSignature", () => {
  it("fresh に signed された body を受け入れる", () => {
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

  it("tampered signature を拒否する", () => {
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

  it("5分の replay window 外の timestamp を拒否する", () => {
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

  it("non-numeric timestamp を拒否する", () => {
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

  it("early return で漏らさず mismatched signature length を拒否する", () => {
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
