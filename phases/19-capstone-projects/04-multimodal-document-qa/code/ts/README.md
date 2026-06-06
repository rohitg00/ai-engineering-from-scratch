# Capstone 04 - Multimodal Document QA (TypeScript)

Viewer skeleton that returns a page image URL plus a JSON list of cited bounding
boxes for a document. The HTML response inlines a small canvas-overlay script
that draws the cited regions on top of the page image. Pairs with the Python
pipeline in `../main.py`.

## Layout

```text
ts/
  package.json
  tsconfig.json
  src/
    index.ts        # entrypoint, demo + HTTP server
    server.ts       # hono app, /health, /, /document/:id
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
npm start          # one self-check pass, exits 0
npm run serve      # interactive HTTP server on 127.0.0.1:<port>
```

The interactive server picks a free port when `PORT` is unset and prints the
chosen URL on stdout. Visit `/` for the index, `/document/10k-acme-2025` for the
demo overlay, or set `accept: application/json` to get the structured response.

## Tests

`node --test` runner via tsx. Tests cover fixture lookup (positive + negative),
HTML escaping for the five hostile characters, document HTML payload structure,
and the hono routes (200, 404, content negotiation).
