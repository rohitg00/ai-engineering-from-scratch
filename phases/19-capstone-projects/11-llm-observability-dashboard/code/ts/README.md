# LLM observability dashboard (TypeScript skeleton)

LLM observability dashboard capstone 用の multi-file TypeScript skeleton。
Hono server が OpenTelemetry GenAI span を受け取り、10k ring buffer に保持し、
p50/p95/p99 latency と model ごとの cost を描画する。

## 構成

- `src/index.ts` — entry point。Synthetic span を seed し、必要なら HTTP を serve する。
- `src/server.ts` — `/trace`、`/`、`/dashboard`、`/dashboard.json`、`/healthz` 用 Hono routes。
- `src/spans.ts` — `RingBuffer` と `ObservabilityStore` (default は 10k spans)。
- `src/rollup.ts` — `percentile` と `rollUpByModel`。
- `src/pricing.ts` — 2026 年の model ごとの price と cost helper。
- `src/types.ts` — shared types。
- `tests/*.test.ts` — `tsx` 経由の `node --test` style tests。

## Install

```bash
npm install
```

## Run

```bash
npm start         # 1200 件の synthetic span を seed し、rollup を表示する
npm run serve     # HTTP ingest + dashboard も PORT (default 8011) で serve する
```

## Verify

```bash
npm run typecheck
npm test
```

## Spec references

- Source lesson: `phases/19-capstone-projects/11-llm-observability-dashboard/docs/en.md`
- [OpenTelemetry GenAI semantic conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/)
