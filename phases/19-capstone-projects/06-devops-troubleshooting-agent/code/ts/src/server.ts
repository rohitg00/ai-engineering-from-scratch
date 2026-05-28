import { Hono } from "hono";
import { z } from "zod";
import { verifySlackSignature } from "./slack_verify.js";
import { mockAgent } from "./agent.js";
import { actionReply, buildSlackResponse } from "./blocks.js";
import type { OutboundCall } from "./types.js";

const InteractivitySchema = z.object({
  actions: z
    .array(
      z.object({
        action_id: z.string().optional(),
        value: z.string().optional(),
      }),
    )
    .optional(),
  response_url: z.string().optional(),
});

export type AppOptions = {
  signingSecret?: string;
  outboundLog?: OutboundCall[];
  now?: () => number;
};

export function buildApp(options: AppOptions = {}): {
  app: Hono;
  outboundLog: OutboundCall[];
} {
  const signingSecret = options.signingSecret || process.env.SLACK_SIGNING_SECRET;
  if (!signingSecret) {
    throw new Error("SLACK_SIGNING_SECRET が必要です");
  }
  const outboundLog: OutboundCall[] = options.outboundLog ?? [];
  const now = options.now ?? (() => Math.floor(Date.now() / 1000));
  const app = new Hono();

  app.get("/health", (c) => c.json({ ok: true, outboundCount: outboundLog.length }));

  app.post("/slack/command", async (c) => {
    const rawBody = await c.req.text();
    const timestamp = c.req.header("x-slack-request-timestamp") ?? "";
    const signature = c.req.header("x-slack-signature") ?? "";
    const verdict = verifySlackSignature({
      signingSecret,
      timestamp,
      signature,
      rawBody,
      nowSeconds: now(),
    });
    if (!verdict.ok) {
      return c.json({ error: `signature ${verdict.reason}` }, 401);
    }
    const params = new URLSearchParams(rawBody);
    const text = params.get("text") ?? "";
    const responseUrl = params.get("response_url") ?? "";
    const report = mockAgent(text);
    const payload = buildSlackResponse(report);
    if (responseUrl) {
      outboundLog.push({ url: responseUrl, body: payload });
    }
    return c.json({
      response_type: "ephemeral",
      text: `incident を triage 中です。<${responseUrl || "channel"}> に follow up します。`,
    });
  });

  app.post("/slack/interactivity", async (c) => {
    const rawBody = await c.req.text();
    const timestamp = c.req.header("x-slack-request-timestamp") ?? "";
    const signature = c.req.header("x-slack-signature") ?? "";
    const verdict = verifySlackSignature({
      signingSecret,
      timestamp,
      signature,
      rawBody,
      nowSeconds: now(),
    });
    if (!verdict.ok) {
      return c.json({ error: `signature ${verdict.reason}` }, 401);
    }
    const params = new URLSearchParams(rawBody);
    const payloadStr = params.get("payload") ?? "{}";
    let parsed: z.infer<typeof InteractivitySchema>;
    try {
      parsed = InteractivitySchema.parse(JSON.parse(payloadStr));
    } catch {
      return c.json({ error: "interactivity payload が不正です" }, 400);
    }
    const action = parsed.actions?.[0] ?? {};
    const actionId = action.action_id ?? "unknown";
    const incidentId = action.value ?? "unknown";
    const reply = actionReply(actionId, incidentId);
    if (parsed.response_url) {
      outboundLog.push({ url: parsed.response_url, body: { text: reply.text } });
    }
    return c.json(reply);
  });

  app.notFound((c) => c.json({ error: "not found" }, 404));

  return { app, outboundLog };
}
