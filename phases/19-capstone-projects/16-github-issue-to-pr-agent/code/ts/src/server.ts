import { Hono } from "hono";
import type { AuditLog } from "./agent.js";
import { route } from "./router.js";
import { verifySignature } from "./verify.js";

export function buildApp(audit: AuditLog, secret: string): Hono {
  const app = new Hono();

  app.post("/webhook", async (c) => {
    const event = c.req.header("x-github-event") ?? "unknown";
    const signature = c.req.header("x-hub-signature-256");
    const raw = Buffer.from(await c.req.arrayBuffer());
    if (!verifySignature(raw, signature, secret)) {
      return c.json({ error: "invalid signature" }, 401);
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw.toString("utf8"));
    } catch (err) {
      return c.json({ error: "invalid JSON", detail: String(err) }, 400);
    }
    const result = route(audit, event, parsed);
    return c.json(result.body as Record<string, unknown>, result.code as 200 | 202 | 422);
  });

  app.notFound((c) => c.json({ error: "POST /webhook only", url: c.req.url }, 404));

  return app;
}
