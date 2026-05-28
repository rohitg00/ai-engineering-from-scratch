import { Hono } from "hono";
import type { Context } from "hono";
import { getFixture } from "./fixtures.js";
import { renderDocument, renderIndex } from "./render.js";

export function buildApp(): Hono {
  const app = new Hono();

  app.get("/health", (c) => c.json({ ok: true }));

  app.get("/", (c) => c.html(renderIndex()));

  app.get("/document/:id", (c: Context) => {
    const id = c.req.param("id") ?? "";
    if (!id || !/^[A-Za-z0-9_-]+$/.test(id)) {
      return c.json({ error: "document id が不正です" }, 400);
    }
    const doc = getFixture(id);
    if (!doc) {
      return c.json({ error: "unknown document" }, 404);
    }
    const accept = c.req.header("accept") ?? "";
    if (accept.includes("application/json")) {
      return c.json({
        id: doc.id,
        title: doc.title,
        query: doc.query,
        answer: doc.answer,
        pageWidth: doc.pageWidth,
        pageHeight: doc.pageHeight,
        pageImageUrl: doc.pageImageUrl,
        evidence: doc.evidence,
      });
    }
    return c.html(renderDocument(doc));
  });

  app.notFound((c) => c.json({ error: "not found" }, 404));

  return app;
}
