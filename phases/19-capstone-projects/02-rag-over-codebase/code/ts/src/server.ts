import { Hono } from "hono";
import { z } from "zod";
import type { BM25Index, DenseIndex } from "./index_store.ts";
import { runQuery } from "./retrieval.ts";
import { SAMPLE_CORPUS } from "./corpus.ts";

export const QueryBody = z.object({
  q: z
    .string()
    .refine((s) => s.trim().length > 0, {
      message: "query must not be empty or whitespace",
    }),
  topK: z.number().int().positive().max(50).optional(),
});

export function buildApp(dense: DenseIndex, bm25: BM25Index): Hono {
  const app = new Hono();

  app.get("/healthz", (c) => c.json({ ok: true, corpus: SAMPLE_CORPUS.length }));

  app.get("/query", (c) => {
    const q = c.req.query("q");
    if (!q || q.trim().length === 0) {
      return c.json({ error: "query must not be empty or whitespace" }, 400);
    }
    return c.json(runQuery(q, dense, bm25));
  });

  app.post("/query", async (c) => {
    let raw: unknown;
    try {
      raw = await c.req.json();
    } catch (err) {
      return c.json({ error: (err as Error).message }, 400);
    }
    const parsed = QueryBody.safeParse(raw);
    if (!parsed.success) {
      return c.json({ error: parsed.error.issues[0]?.message ?? "bad body" }, 400);
    }
    const { q, topK = 5 } = parsed.data;
    return c.json(runQuery(q, dense, bm25, topK));
  });

  app.notFound((c) => c.json({ error: "not found", path: c.req.path }, 404));

  return app;
}
