# Capstone 04 - Multimodal Document QA (TypeScript)

document の page image URL と cited bounding box の JSON list を返す viewer skeleton です。HTML response は小さな canvas-overlay script を inline し、page image の上に cited region を描きます。`../main.py` の Python pipeline と対になります。

## Layout

```text
ts/
  package.json
  tsconfig.json
  src/
    index.ts        # entrypoint、demo + HTTP server
    server.ts       # hono app、/health、/、/document/:id
    fixtures.ts     # 10-K table + Nature figure fixtures
    render.ts       # HTML index + per-document overlay renderer
    types.ts        # DocumentFixture, EvidenceRegion, BoundingBox
  tests/
    fixtures.test.ts
    render.test.ts
    server.test.ts
```

## Run

```bash
npm install
npm run typecheck
npm test
npm start          # self-check を1回実行して exit 0
npm run serve      # 127.0.0.1:<port> の interactive HTTP server
```

`PORT` が未設定の場合、interactive server は空き port を選び、chosen URL を stdout に出します。index は `/`、demo overlay は `/document/10k-acme-2025` です。`accept: application/json` を指定すると structured response を返します。

## Tests

tsx 経由の `node --test` runner。fixture lookup (positive + negative)、5つの hostile character に対する HTML escaping、document HTML payload structure、hono routes (200, 404, content negotiation) を cover します。
