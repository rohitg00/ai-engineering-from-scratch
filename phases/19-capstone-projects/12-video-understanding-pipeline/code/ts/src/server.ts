import { Hono } from "hono";
import type { JobStore } from "./jobs.js";
import { advanceJob, overallStatus } from "./stages.js";

export function renderIndexHtml(store: JobStore): string {
  const rows = store
    .list()
    .map((j) => {
      advanceJob(j);
      return `<tr><td>${j.id}</td><td>${j.video_url}</td><td>${j.question}</td><td>${overallStatus(j)}</td></tr>`;
    })
    .join("");
  return `<!doctype html><meta charset="utf-8"><title>video jobs</title>
<style>body{font-family:system-ui;margin:2rem}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:.4rem .6rem;text-align:left}</style>
<h1>video understanding jobs</h1>
<table><thead><tr><th>id</th><th>video</th><th>question</th><th>status</th></tr></thead>
<tbody>${rows}</tbody></table>
<p>JSON: <a href="/jobs">/jobs</a>, single job: <code>/job/&lt;id&gt;</code></p>`;
}

export function buildApp(store: JobStore): Hono {
  const app = new Hono();

  app.get("/", (c) => c.html(renderIndexHtml(store)));

  app.get("/jobs", (c) => c.json({ jobs: store.summaries() }));

  app.get("/job/:id", (c) => {
    const id = c.req.param("id");
    const body = store.detail(id);
    if (!body) return c.json({ error: "job not found", id }, 404);
    return c.json(body);
  });

  return app;
}
