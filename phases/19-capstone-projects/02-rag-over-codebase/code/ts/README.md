# Capstone 19/02 — RAG over Codebase (TypeScript)

Multi-file TypeScript code-search API for the hybrid retrieval pipeline
described in `../docs/en.md`. Offline, deterministic, six-chunk sample corpus,
node:http behind a hono fetch handler.

## Layout

```text
src/
  index.ts        entry point; boots node:http + self-probe + exits 0
  server.ts       hono routes (/healthz, /query) with zod-validated POST body
  retrieval.ts    runQuery + RRF merge over dense and BM25
  index_store.ts  FNV-1a hash embedder, cosine, field-weighted BM25
  corpus.ts       six-chunk sample (uploader / auth / client / catalog)
  types.ts        Chunk, RankedChunk, QueryResponse, anchor()
tests/
  index_store.test.ts
  retrieval.test.ts
  server.test.ts
```

## Run

```bash
npm install
npm start                # boots api, probes three queries, exits 0
npm start -- --serve     # keep server up; ctrl-c to stop
npm test                 # node --test runner via tsx
npm run typecheck        # tsc --noEmit
```

The non-interactive `npm start` path asserts that `/healthz` returns 200 and
that every probe query returns at least one citation. Routes:

- `GET /healthz` — returns `{ok, corpus}`.
- `GET /query?q=...` — runs a hybrid query.
- `POST /query` — JSON `{q, topK?}`, validated by zod (`topK` capped at 50).
