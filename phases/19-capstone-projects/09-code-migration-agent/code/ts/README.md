# Code migration agent dashboard (TypeScript skeleton)

Multi-file TypeScript skeleton for the dashboard layer of the code migration
agent capstone. The agent (Python) runs in a sandbox; this server renders
progress for the operator.

## Layout

- `src/index.ts` — entry point, simulates ticks and optionally serves HTTP.
- `src/server.ts` — Hono routes for `/`, `/dashboard`, `/migrations`, `/migrations/:id`.
- `src/migrations.ts` — per-file state machine and seed data.
- `src/cost.ts` — turn count and dollar budget enforcement.
- `src/types.ts` — shared types.
- `tests/*.test.ts` — `node --test` style tests via `tsx`.

## Install

```bash
npm install
```

## Run

```bash
npm start         # offline: simulate 40 ticks and print rollup
npm run serve     # serve the HTML dashboard on PORT (default 8009)
```

## Verify

```bash
npm run typecheck
npm test
```

## Spec references

- Source lesson: `phases/19-capstone-projects/09-code-migration-agent/docs/en.md`
- Recipes: [OpenRewrite](https://docs.openrewrite.org), libcst.
