import { Hono } from "hono";
import { rollUpByModel } from "./rollup.js";
import type { ObservabilityStore } from "./spans.js";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildApp(store: ObservabilityStore): Hono {
  const app = new Hono();

  app.post("/trace", async (c) => {
    try {
      const body = await c.req.json();
      const counters = store.ingest(body);
      return c.json({ status: "accepted", counters }, 202);
    } catch (err) {
      return c.json({ error: "bad_request", message: String(err) }, 400);
    }
  });

  app.get("/", (c) => c.html(renderDashboardHtml(store)));
  app.get("/dashboard", (c) => c.html(renderDashboardHtml(store)));

  app.get("/dashboard.json", (c) =>
    c.json({
      counters: store.counters(),
      models: rollUpByModel(store.snapshot()),
    }),
  );

  app.get("/healthz", (c) =>
    c.json({ status: "ok", counters: store.counters() }),
  );

  return app;
}

export function renderDashboardHtml(store: ObservabilityStore): string {
  const rollups = rollUpByModel(store.snapshot());
  const counters = store.counters();
  const rows = rollups
    .map(
      (r) =>
        `<tr><td>${escapeHtml(r.model)}</td><td>${r.count}</td><td>${r.errors}</td>` +
        `<td>${r.inputTokens}</td><td>${r.outputTokens}</td>` +
        `<td>$${r.costUsd.toFixed(4)}</td>` +
        `<td>${r.p50LatencyMs}</td><td>${r.p95LatencyMs}</td><td>${r.p99LatencyMs}</td></tr>`,
    )
    .join("\n");
  return [
    "<!doctype html>",
    "<html><head><title>LLM observability dashboard</title>",
    "<style>",
    "body{font-family:system-ui,sans-serif;margin:2rem;max-width:1100px;}",
    "table{border-collapse:collapse;width:100%;}",
    "th,td{padding:.4rem .8rem;border-bottom:1px solid #ddd;text-align:left;font-variant-numeric:tabular-nums;}",
    "th{background:#f3f3f3;}",
    ".stats{display:flex;gap:1.5rem;margin-bottom:1rem;}",
    ".stat{background:#fafafa;border:1px solid #ddd;padding:.6rem 1rem;border-radius:6px;}",
    "</style></head><body>",
    "<h1>LLM observability dashboard</h1>",
    "<div class='stats'>",
    `<div class='stat'><b>${counters.accepted}</b> span accepted</div>`,
    `<div class='stat'>ring buffer 内 ${counters.held}</div>`,
    `<div class='stat'>rejected ${counters.rejected}</div>`,
    "</div>",
    "<table><thead><tr>",
    "<th>model</th><th>spans</th><th>errors</th><th>input tok</th><th>output tok</th>",
    "<th>cost</th><th>p50 ms</th><th>p95 ms</th><th>p99 ms</th>",
    "</tr></thead><tbody>",
    rows,
    "</tbody></table>",
    "<p><small>OTel-GenAI span は /trace に POST します。JSON roll-up は /dashboard.json です。</small></p>",
    "</body></html>",
  ].join("\n");
}
