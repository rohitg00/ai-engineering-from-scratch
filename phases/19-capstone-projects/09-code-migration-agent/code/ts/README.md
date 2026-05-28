# Code migration agent dashboard (TypeScript skeleton)

code migration agent capstone の dashboard layer 用 multi-file TypeScript skeleton です。agent (Python) は sandbox 内で走り、この server は operator 向けに progress を render します。

## Layout

- `src/index.ts` — entry point。tick を simulate し、必要なら HTTP を serve。
- `src/server.ts` — `/`, `/dashboard`, `/migrations`, `/migrations/:id` の Hono routes。
- `src/migrations.ts` — per-file state machine と seed data。
- `src/cost.ts` — turn count と dollar budget enforcement。
- `src/types.ts` — shared types。
- `tests/*.test.ts` — `tsx` 経由の `node --test` style tests。

## Install

```bash
npm install
```

## Run

```bash
npm start         # offline: 40 ticks を simulate し rollup を表示
npm run serve     # PORT (default 8009) で HTML dashboard を serve
```

## Verify

```bash
npm run typecheck
npm test
```

## Spec references

- Source lesson: `phases/19-capstone-projects/09-code-migration-agent/docs/en.md`
- Recipes: [OpenRewrite](https://docs.openrewrite.org), libcst.
