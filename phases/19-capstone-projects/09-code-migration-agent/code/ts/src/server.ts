import { Hono } from "hono";
import { rolledUpStats } from "./migrations.js";
import type { Migration } from "./types.js";

export function buildApp(migrations: Migration[]): Hono {
  const app = new Hono();

  app.get("/", (c) => c.html(renderDashboardHtml(migrations)));
  app.get("/dashboard", (c) => c.html(renderDashboardHtml(migrations)));

  app.get("/migrations", (c) =>
    c.json({
      stats: rolledUpStats(migrations),
      migrations: migrations.map((m) => ({
        id: m.id,
        repo: m.repo,
        state: m.state,
        sourceRuntime: m.sourceRuntime,
        targetRuntime: m.targetRuntime,
        turns: m.turns,
        spentUsd: m.spentUsd,
      })),
    }),
  );

  app.get("/migrations/:id", (c) => {
    const id = c.req.param("id");
    const m = migrations.find((x) => x.id === id);
    if (!m) return c.json({ error: "not_found", id }, 404);
    return c.json(m);
  });

  return app;
}

export function renderDashboardHtml(migrations: Migration[]): string {
  const stats = rolledUpStats(migrations);
  const rows = migrations
    .map((m) => {
      const passedFiles = m.files.filter((f) => f.status === "passed").length;
      const pct = m.files.length === 0 ? 0 : Math.round((passedFiles / m.files.length) * 100);
      return [
        "<tr>",
        `<td><a href="/migrations/${m.id}">${m.repo}</a></td>`,
        `<td>${m.sourceRuntime} to ${m.targetRuntime}</td>`,
        `<td>${m.state}</td>`,
        `<td>${pct}%</td>`,
        `<td>${m.turns}/${m.maxTurns}</td>`,
        `<td>$${m.spentUsd.toFixed(2)}/$${m.budgetUsd}</td>`,
        "</tr>",
      ].join("");
    })
    .join("\n");
  return [
    "<!doctype html>",
    "<html><head><title>Code migration dashboard</title>",
    "<style>",
    "body{font-family:system-ui,sans-serif;margin:2rem;max-width:960px;}",
    "table{border-collapse:collapse;width:100%;}",
    "th,td{padding:.4rem .8rem;border-bottom:1px solid #ddd;text-align:left;}",
    "th{background:#f3f3f3;}",
    ".stats{display:flex;gap:1.5rem;margin-bottom:1rem;}",
    ".stat{background:#fafafa;border:1px solid #ddd;padding:.6rem 1rem;border-radius:6px;}",
    "</style></head><body>",
    "<h1>Code migration dashboard</h1>",
    "<div class='stats'>",
    `<div class='stat'><b>${stats.total}</b> migrations</div>`,
    `<div class='stat'>${stats.running} running</div>`,
    `<div class='stat'>${stats.passed} passed</div>`,
    `<div class='stat'>${stats.failed} failed</div>`,
    `<div class='stat'>$${stats.spentUsd.toFixed(2)} spent</div>`,
    "</div>",
    "<table><thead><tr>",
    "<th>repo</th><th>migration</th><th>state</th><th>progress</th><th>turns</th><th>cost</th>",
    "</tr></thead><tbody>",
    rows,
    "</tbody></table>",
    "<p><small>2秒ごとに auto-refresh します。Endpoints: /migrations, /migrations/:id.</small></p>",
    "<script>setTimeout(()=>location.reload(),2000)</script>",
    "</body></html>",
  ].join("\n");
}
