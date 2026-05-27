import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildApp } from "../src/server.js";
import {
  REPLAY_WINDOW_SECONDS,
  signForTesting,
} from "../src/slack_verify.js";

const SECRET = "test-secret";

type SignedOpts = { stale?: boolean; tamper?: boolean };

function headersFor(body: string, opts: SignedOpts = {}): Record<string, string> {
  const nowS = Math.floor(Date.now() / 1000);
  const ts = opts.stale ? String(nowS - REPLAY_WINDOW_SECONDS - 1) : String(nowS);
  let signature = signForTesting(SECRET, ts, body);
  if (opts.tamper) signature = signature.slice(0, -1) + (signature.endsWith("0") ? "1" : "0");
  return {
    "content-type": "application/x-www-form-urlencoded",
    "x-slack-request-timestamp": ts,
    "x-slack-signature": signature,
  };
}

describe("server", () => {
  it("GET /health returns ok", async () => {
    const { app } = buildApp({ signingSecret: SECRET });
    const res = await app.request("/health");
    assert.equal(res.status, 200);
    const body = (await res.json()) as { ok: boolean };
    assert.equal(body.ok, true);
  });

  it("POST /slack/command with valid signature returns 200 + logs outbound", async () => {
    const { app, outboundLog } = buildApp({ signingSecret: SECRET });
    const body = new URLSearchParams({
      command: "/oncall",
      text: "OOMKilled",
      response_url: "https://hooks.slack.example/redacted",
    }).toString();
    const res = await app.request("/slack/command", {
      method: "POST",
      headers: headersFor(body),
      body,
    });
    assert.equal(res.status, 200);
    const json = (await res.json()) as { response_type: string };
    assert.equal(json.response_type, "ephemeral");
    assert.equal(outboundLog.length, 1);
  });

  it("POST /slack/command with tampered signature returns 401", async () => {
    const { app } = buildApp({ signingSecret: SECRET });
    const body = "text=hi";
    const res = await app.request("/slack/command", {
      method: "POST",
      headers: headersFor(body, { tamper: true }),
      body,
    });
    assert.equal(res.status, 401);
  });

  it("POST /slack/command with stale timestamp returns 401", async () => {
    const { app } = buildApp({ signingSecret: SECRET });
    const body = "text=hi";
    const res = await app.request("/slack/command", {
      method: "POST",
      headers: headersFor(body, { stale: true }),
      body,
    });
    assert.equal(res.status, 401);
  });

  it("POST /slack/interactivity approve produces an approval reply", async () => {
    const { app, outboundLog } = buildApp({ signingSecret: SECRET });
    const body = new URLSearchParams({
      payload: JSON.stringify({
        actions: [{ action_id: "approve", value: "inc-42" }],
        response_url: "https://hooks.slack.example/redacted",
      }),
    }).toString();
    const res = await app.request("/slack/interactivity", {
      method: "POST",
      headers: headersFor(body),
      body,
    });
    assert.equal(res.status, 200);
    const json = (await res.json()) as { text?: string };
    assert.match(json.text ?? "", /Approved remediation for inc-42/);
    assert.equal(outboundLog.length, 1);
  });
});
