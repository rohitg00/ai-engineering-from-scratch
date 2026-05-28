import * as http from "node:http";
import { Hono } from "hono";
import { WebSocketServer } from "ws";
import type { WebSocket } from "ws";
import { runSession, summarize } from "./orchestrator.ts";
import { synthCall } from "./vad.ts";
import { encodeFrame } from "./protocol.ts";

export type ServerHandles = {
  server: http.Server;
  wss: WebSocketServer;
  app: Hono;
};

function nodeListener(app: Hono) {
  return (req: http.IncomingMessage, res: http.ServerResponse): void => {
    const url = `http://${req.headers.host ?? "localhost"}${req.url ?? "/"}`;
    void (async () => {
      try {
        const response = await app.fetch(
          new Request(url, {
            method: req.method,
            headers: req.headers as Record<string, string>,
          }),
        );
        res.statusCode = response.status;
        response.headers.forEach((v, k) => res.setHeader(k, v));
        const body = await response.text();
        res.end(body);
      } catch (err) {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: (err as Error).message }));
      }
    })();
  };
}

function driveSession(ws: WebSocket): void {
  const frames = synthCall("tokyo の明日の天気はどうですか");
  const m = runSession(frames, {
    useTool: true,
    bargeInAtMs: null,
    onEvent: (line) => ws.send(encodeFrame({ type: "event", line })),
  });
  ws.send(encodeFrame({ type: "summary", ...summarize(m) }));
  ws.close();
}

export function buildServer(): ServerHandles {
  const app = new Hono();
  app.get("/healthz", (c) => c.json({ ok: true }));
  app.notFound((c) => c.json({ error: "not found", path: c.req.path }, 404));

  const server = http.createServer(nodeListener(app));
  const wss = new WebSocketServer({ server });
  wss.on("connection", (ws) => {
    driveSession(ws);
  });
  return { server, wss, app };
}
