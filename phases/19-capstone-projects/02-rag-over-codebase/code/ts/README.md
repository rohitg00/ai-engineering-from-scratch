# Capstone 19/02 — RAG over Codebase (TypeScript)

`../docs/en.md` で説明した hybrid retrieval pipeline の multi-file TypeScript code-search API です。offline、deterministic、6 chunk の sample corpus、hono fetch handler 背後の node:http で動きます。

## Layout

```text
src/
  index.ts        entry point。node:http + self-probe を起動して exit 0
  server.ts       zod-validated POST body を持つ hono routes (/healthz, /query)
  retrieval.ts    dense と BM25 に対する runQuery + RRF merge
  index_store.ts  FNV-1a hash embedder、cosine、field-weighted BM25
  corpus.ts       6 chunk sample (uploader / auth / client / catalog)
  types.ts        Chunk, RankedChunk, QueryResponse, anchor()
tests/
  index_store.test.ts
  retrieval.test.ts
  server.test.ts
```

## Run

```bash
npm install
npm start                # API を起動し、3 query を probe して exit 0
npm start -- --serve     # server を維持。停止は ctrl-c
npm test                 # tsx 経由の node --test runner
npm run typecheck        # tsc --noEmit
```

non-interactive `npm start` path は `/healthz` が 200 を返し、各 probe query が少なくとも1つの citation を返すことを assert します。routes:

- `GET /healthz` — `{ok, corpus}` を返します。
- `GET /query?q=...` — hybrid query を実行します。
- `POST /query` — JSON `{q, topK?}`。zod で validate され、`topK` は 50 capped。
