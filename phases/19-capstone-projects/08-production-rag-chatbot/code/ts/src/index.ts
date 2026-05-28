// Capstone 08 entrypoint: production RAG chatbot SSE chat UI.
// Source: ../../docs/en.md (SSE で stream する citation-anchored response)。
// References:
//   Server-Sent Events (WHATWG)  https://html.spec.whatwg.org/multipage/server-sent-events.html
//   text/event-stream (MDN)      https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events
//   EventSource interface (MDN)  https://developer.mozilla.org/en-US/docs/Web/API/EventSource

import { createServer, IncomingMessage, ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { buildApp } from "./server.js";
import { parseSseStream } from "./stream.js";

async function nodeRequestToWeb(req: IncomingMessage): Promise<Request> {
  const host = req.headers.host ?? "127.0.0.1";
  const url = `http://${host}${req.url ?? "/"}`;
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (v === undefined) continue;
    if (Array.isArray(v)) for (const item of v) headers.append(k, item);
    else headers.set(k, String(v));
  }
  const method = (req.method ?? "GET").toUpperCase();
  let body: Buffer | undefined;
  if (method !== "GET" && method !== "HEAD") {
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : (chunk as Buffer));
    }
    body = Buffer.concat(chunks);
  }
  return new Request(url, { method, headers, ...(body ? { body } : {}) });
}

async function writeWebResponse(res: ServerResponse, webRes: Response): Promise<void> {
  res.statusCode = webRes.status;
  webRes.headers.forEach((value, key) => res.setHeader(key, value));
  if (!webRes.body) {
    res.end();
    return;
  }
  const reader = webRes.body.getReader();
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    if (value) res.write(Buffer.from(value));
  }
  res.end();
}

async function runDemo(): Promise<void> {
  const { app, sessions } = buildApp();
  console.log("=".repeat(72));
  console.log("CAPSTONE 08 - PRODUCTION RAG CHAT UI SKELETON (TypeScript)");
  console.log("=".repeat(72));

  const indexResp = await Promise.resolve(app.request("/"));
  console.log(`\nGET /`);
  console.log(`  status=${indexResp.status} ct=${indexResp.headers.get("content-type") ?? ""}`);

  console.log(`\nGET /chat/stream (q=erasure right)`);
  const stream1 = await Promise.resolve(
    app.request(
      "/chat/stream?sessionId=s-1&role=analyst&jurisdiction=GDPR&q=erasure%20right",
    ),
  );
  const stream1Body = await stream1.text();
  const events1 = parseSseStream(stream1Body);
  const tokenCount1 = events1.filter((e) => e.event === "token").length;
  const citation1 = events1.find((e) => e.event === "citations");
  console.log(`  events=${events1.length} tokens=${tokenCount1}`);
  console.log(
    `  citations=${JSON.stringify(citation1?.data).slice(0, 140)}`,
  );
  console.log(`  has done=${events1.some((e) => e.event === "done")}`);

  console.log(`\nGET /chat/stream (同じ session、2 turn 目)`);
  const stream2 = await Promise.resolve(
    app.request(
      "/chat/stream?sessionId=s-1&role=analyst&jurisdiction=GDPR&q=access%20confirmation",
    ),
  );
  await stream2.text();

  console.log(`\nGET /sessions`);
  const sessResp = await Promise.resolve(app.request("/sessions"));
  const sessJson = (await sessResp.json()) as {
    sessions: Array<{ id: string; turnCount: number }>;
  };
  const s1 = sessJson.sessions.find((s) => s.id === "s-1");
  console.log(`  sessions=${sessJson.sessions.length} s-1 turns=${s1?.turnCount ?? 0}`);

  console.log(`\nGET /chat/stream missing q`);
  const badResp = await Promise.resolve(app.request("/chat/stream"));
  console.log(`  status=${badResp.status}`);

  const ok =
    indexResp.status === 200 &&
    tokenCount1 > 0 &&
    events1.some((e) => e.event === "done") &&
    badResp.status === 400 &&
    (s1?.turnCount ?? 0) === 4;
  console.log("\n" + "-".repeat(72));
  console.log(`smoke ok=${ok} total sessions=${sessions.size()}`);
}

function startServer(): void {
  const { app } = buildApp({ tokenDelayMs: 5 });
  const port = Number(process.env.PORT ?? 0);
  const server = createServer((req, res) => {
    nodeRequestToWeb(req)
      .then((webReq) => app.fetch(webReq))
      .then((webRes) => writeWebResponse(res, webRes))
      .catch((err: unknown) => {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: String(err) }));
      });
  });
  server.listen(port, "127.0.0.1", () => {
    const addr = server.address() as AddressInfo;
    console.log(`chat-ui listening on http://127.0.0.1:${addr.port}`);
  });
  process.on("SIGINT", () => server.close(() => process.exit(0)));
  process.on("SIGTERM", () => server.close(() => process.exit(0)));
}

async function main(): Promise<void> {
  if (process.argv.includes("--demo")) {
    await runDemo();
    return;
  }
  startServer();
}

main().catch((err: unknown) => {
  console.error("startup failed:", err);
  process.exit(1);
});
