import { Hono } from "hono";
import { buildIndex, CURRICULUM, pickNextLesson, topoOrder } from "./curriculum.js";
import type { MasteryStore } from "./mastery.js";

export function buildApp(mastery: MasteryStore): Hono {
  const app = new Hono();
  const index = buildIndex(CURRICULUM);
  const topo = topoOrder(CURRICULUM);

  app.get("/lesson/next", (c) => {
    const pick = pickNextLesson(topo, index, mastery.all(), Date.now());
    if (!pick) return c.json({ done: true, message: "curriculum complete" });
    return c.json({
      lesson: pick.lesson,
      reason: pick.reason,
      mastery: mastery.peek(pick.lesson.id) ?? null,
    });
  });

  app.post("/lesson/:id/submit", async (c) => {
    const id = c.req.param("id");
    if (!index[id]) return c.json({ error: "unknown lesson", id }, 404);
    let raw: unknown;
    try {
      raw = await c.req.json();
    } catch (err) {
      return c.json({ error: "invalid body", detail: String(err) }, 400);
    }
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
      return c.json({ error: "invalid payload", detail: "body must be a JSON object" }, 400);
    }
    const correct = (raw as Record<string, unknown>).correct;
    if (typeof correct !== "boolean") {
      return c.json({ error: "invalid payload", detail: "correct must be boolean" }, 400);
    }
    const updated = mastery.record(id, correct, Date.now());
    return c.json({ id, correct, mastery: updated });
  });

  return app;
}
