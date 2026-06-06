// Capstone 19/02: code RAG query API (multi-file TypeScript).
//
// Sources:
//   This lesson's docs/en.md (hybrid retrieval + cited answer API)
//   Hono web framework           https://hono.dev/docs/
//   BM25 (Robertson + Zaragoza) https://en.wikipedia.org/wiki/Okapi_BM25
//   Reciprocal Rank Fusion       https://plg.uwaterloo.ca/~gvcormac/cormacksigir09-rrf.pdf
//
// Hybrid retrieval API split into modules: index_store.ts (FNV-1a embedder + BM25),
// retrieval.ts (RRF merge), server.ts (hono routes /healthz, /query), this entry
// (boots node:http behind the hono fetch handler, runs a self-probe, exits 0).

import * as http from "node:http";
import { Readable } from "node:stream";
import { buildIndices } from "./retrieval.ts";
import { buildApp } from "./server.ts";
import type { QueryResponse } from "./types.ts";
import { SAMPLE_CORPUS } from "./corpus.ts";

type FetchLike = (req: Request) => Response | Promise<Response>;

function nodeListener(fetchHandler: FetchLike) {
  return (req: http.IncomingMessage, res: http.ServerResponse): void => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => {
      void (async () => {
        try {
          const url = `http://${req.headers.host ?? "localhost"}${req.url ?? "/"}`;
          const init: RequestInit = {
            method: req.method,
            headers: req.headers as Record<string, string>,
          };
          const method = (req.method ?? "GET").toUpperCase();
          if (method !== "GET" && method !== "HEAD" && chunks.length > 0) {
            init.body = Buffer.concat(chunks);
          }
          const response = await fetchHandler(new Request(url, init));
          res.statusCode = response.status;
          response.headers.forEach((v, k) => res.setHeader(k, v));
          if (response.body) {
            Readable.fromWeb(response.body as never).pipe(res);
          } else {
            res.end();
          }
        } catch (err) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: (err as Error).message }));
        }
      })();
    });
  };
}

async function probe(server: http.Server, port: number): Promise<void> {
  const queries = [
    "how is S3 multipart abort wired into retry budget",
    "where is authorization centralized",
    "how does rank fusion work",
  ];
  const get = (p: string): Promise<{ status: number; body: string }> =>
    new Promise((resolve, reject) => {
      const r = http.request(
        { host: "127.0.0.1", port, path: p, method: "GET" },
        (resp) => {
          const parts: Buffer[] = [];
          resp.on("data", (c: Buffer) => parts.push(c));
          resp.on("end", () =>
            resolve({
              status: resp.statusCode ?? 0,
              body: Buffer.concat(parts).toString("utf8"),
            }),
          );
        },
      );
      r.on("error", reject);
      r.end();
    });

  const health = await get("/healthz");
  console.log(`GET /healthz -> ${health.status} ${health.body}`);
  if (health.status !== 200) throw new Error(`healthz returned ${health.status}`);

  for (const q of queries) {
    const r = await get(`/query?q=${encodeURIComponent(q)}`);
    if (r.status !== 200) throw new Error(`query '${q}' returned ${r.status}`);
    const parsed = JSON.parse(r.body) as QueryResponse;
    console.log(`GET /query?q=${JSON.stringify(q)} -> ${r.status}`);
    console.log(`  dense  : ${JSON.stringify(parsed.denseTop)}`);
    console.log(`  sparse : ${JSON.stringify(parsed.sparseTop)}`);
    console.log(`  fused  : ${JSON.stringify(parsed.fusedTop)}`);
    console.log(
      `  cites  : ${parsed.citations
        .map((c) => `${c.anchor}@${c.score.toFixed(4)}`)
        .join(", ")}`,
    );
    if (parsed.citations.length === 0) {
      throw new Error(`query '${q}' returned no citations`);
    }
  }
  await new Promise<void>((resolve) => server.close(() => resolve()));
}

async function main(): Promise<void> {
  const { dense, bm25 } = buildIndices();
  console.log(`indexed ${dense.size()} chunks across ${SAMPLE_CORPUS.length} entries`);
  const app = buildApp(dense, bm25);
  const server = http.createServer(nodeListener(app.fetch as FetchLike));
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const addr = server.address();
  if (!addr || typeof addr === "string") throw new Error("server address unavailable");
  const port = addr.port;
  console.log(`code-rag api listening on http://127.0.0.1:${port}`);
  if (process.argv.includes("--serve")) {
    process.on("SIGINT", () => server.close(() => process.exit(0)));
    return;
  }
  await probe(server, port);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
