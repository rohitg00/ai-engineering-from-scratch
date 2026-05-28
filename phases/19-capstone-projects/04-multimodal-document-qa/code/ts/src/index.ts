// Capstone 04 entrypoint: multimodal document QA viewer.
// Source: ../../docs/en.md (evidence region 用 canvas overlay を備えた viewer UI)。
// References:
//   ColPali late-interaction retrieval https://arxiv.org/abs/2407.01449
//   Qwen3-VL bounding-box output spec  https://qwenlm.github.io/blog/qwen3-vl/
//   Canvas 2D rendering context (MDN)  https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D

import { createServer, IncomingMessage, ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { buildApp } from "./server.js";
import { listFixtures } from "./fixtures.js";

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
  return new Request(url, {
    method,
    headers,
    ...(body ? { body } : {}),
  });
}

async function writeWebResponse(res: ServerResponse, webRes: Response): Promise<void> {
  res.statusCode = webRes.status;
  webRes.headers.forEach((value, key) => res.setHeader(key, value));
  const buf = Buffer.from(await webRes.arrayBuffer());
  res.end(buf);
}

async function runDemo(): Promise<void> {
  const app = buildApp();
  console.log("=".repeat(72));
  console.log("CAPSTONE 04 - DOCUMENT QA VIEWER SKELETON (TypeScript)");
  console.log("=".repeat(72));

  const probes: Array<{ label: string; path: string; accept: string; expect: number }> = [
    { label: "GET /health", path: "/health", accept: "application/json", expect: 200 },
    { label: "GET / (index html)", path: "/", accept: "text/html", expect: 200 },
    {
      label: "GET /document/10k-acme-2025 (json)",
      path: "/document/10k-acme-2025",
      accept: "application/json",
      expect: 200,
    },
    {
      label: "GET /document/10k-acme-2025 (html)",
      path: "/document/10k-acme-2025",
      accept: "text/html",
      expect: 200,
    },
    {
      label: "GET /document/missing (404)",
      path: "/document/missing",
      accept: "application/json",
      expect: 404,
    },
  ];

  let ok = 0;
  for (const probe of probes) {
    const resp = await app.request(probe.path, { headers: { accept: probe.accept } });
    const body = await resp.text();
    const preview = body.replace(/\s+/g, " ").slice(0, 80);
    console.log(`\n${probe.label}`);
    console.log(`  status=${resp.status} ct=${resp.headers.get("content-type") ?? ""}`);
    console.log(`  body[:80]=${preview}`);
    if (resp.status === probe.expect) ok += 1;
  }
  console.log("\n" + "-".repeat(72));
  console.log(`probes ok=${ok}/${probes.length}`);
  console.log(`fixtures loaded=${listFixtures().length}`);
}

function startServer(): void {
  const app = buildApp();
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
    console.log(`viewer listening on http://127.0.0.1:${addr.port}`);
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
