import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { SessionStore } from "./session.js";
import { encodeSseFrame, retrieve, tokenizeAnswer } from "./stream.js";

const QuerySchema = z.object({
  sessionId: z.string().min(1).optional(),
  role: z.string().min(1).optional(),
  jurisdiction: z.string().min(1).optional(),
  q: z.string().min(1),
});

export type AppOptions = {
  sessionStore?: SessionStore;
  tokenDelayMs?: number;
};

function renderClient(): string {
  return `<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><title>Production RAG chatbot</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 720px; margin: 2rem auto; color: #222; }
  #log { border: 1px solid #ddd; padding: 1rem; min-height: 200px; white-space: pre-wrap; }
  form { margin-top: 1rem; display: flex; gap: .5rem; }
  input[type=text] { flex: 1; padding: .5rem; }
  .cites { margin-top: 1rem; font-size: .9rem; color: #333; }
</style></head><body>
<h1>Capstone 08 chat (skeleton)</h1>
<p>Role: <code>analyst</code>, jurisdiction: <code>GDPR</code>。SSE で token-by-token に stream します。</p>
<div id="log"></div>
<div class="cites" id="cites"></div>
<form id="f">
  <input type="text" id="q" placeholder="policy について質問..." required>
  <button type="submit">送信</button>
</form>
<script>
  const sessionId = "demo-session";
  const role = "analyst";
  const jurisdiction = "GDPR";
  const log = document.getElementById("log");
  const cites = document.getElementById("cites");
  document.getElementById("f").addEventListener("submit", (ev) => {
    ev.preventDefault();
    const q = document.getElementById("q").value;
    log.textContent += "\\nuser: " + q + "\\nassistant: ";
    cites.textContent = "";
    const url = "/chat/stream?sessionId=" + encodeURIComponent(sessionId)
      + "&role=" + encodeURIComponent(role)
      + "&jurisdiction=" + encodeURIComponent(jurisdiction)
      + "&q=" + encodeURIComponent(q);
    const es = new EventSource(url);
    es.addEventListener("token", (e) => {
      const data = JSON.parse(e.data);
      log.textContent += data.text;
    });
    es.addEventListener("citations", (e) => {
      const data = JSON.parse(e.data);
      cites.textContent = "citations: " + data.items.map((c) => c.docId + " p." + c.page).join(", ");
    });
    es.addEventListener("done", () => { es.close(); });
    es.onerror = () => { es.close(); };
  });
</script></body></html>`;
}

export function buildApp(options: AppOptions = {}): {
  app: Hono;
  sessions: SessionStore;
} {
  const sessions = options.sessionStore ?? new SessionStore();
  const tokenDelayMs = options.tokenDelayMs ?? 0;
  const app = new Hono();

  app.get("/", (c) => c.html(renderClient()));

  app.get("/health", (c) => c.json({ ok: true, sessions: sessions.size() }));

  app.get("/sessions", (c) => {
    const list = sessions.list().map((s) => ({
      id: s.id,
      role: s.role,
      jurisdiction: s.jurisdiction,
      turnCount: s.turns.length,
    }));
    return c.json({ sessions: list });
  });

  app.get("/chat/stream", (c) => {
    const parsed = QuerySchema.safeParse({
      sessionId: c.req.query("sessionId"),
      role: c.req.query("role"),
      jurisdiction: c.req.query("jurisdiction"),
      q: c.req.query("q"),
    });
    if (!parsed.success) {
      return c.json({ error: "q がありません" }, 400);
    }
    const sessionId = parsed.data.sessionId ?? randomUUID();
    const role = parsed.data.role ?? "analyst";
    const jurisdiction = parsed.data.jurisdiction ?? "GDPR";
    const q = parsed.data.q;

    const session = sessions.getOrCreate(sessionId, role, jurisdiction);
    sessions.appendTurn(sessionId, { role: "user", content: q, ts: Date.now() });

    return streamSSE(c, async (stream) => {
      const writeFrame = async (event: string, data: unknown): Promise<void> => {
        await stream.write(encodeSseFrame(event, data));
      };
      await writeFrame("session", {
        sessionId,
        role,
        jurisdiction,
        turn: session.turns.length,
      });
      const citations = retrieve(q, jurisdiction, 3);
      await writeFrame("citations", { items: citations });

      const tokens = tokenizeAnswer(q, citations);
      let assembled = "";
      for (const tok of tokens) {
        if (stream.aborted) return;
        assembled += tok;
        await writeFrame("token", { text: tok });
        if (tokenDelayMs > 0) await stream.sleep(tokenDelayMs);
      }
      sessions.appendTurn(sessionId, {
        role: "assistant",
        content: assembled,
        ts: Date.now(),
      });
      await writeFrame("done", { totalTokens: tokens.length });
    });
  });

  app.notFound((c) => c.json({ error: "not found" }, 404));

  return { app, sessions };
}
