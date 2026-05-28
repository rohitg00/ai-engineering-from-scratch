# Lesson 12 - Video Understanding Pipeline (TypeScript UI)

Capstone の TypeScript 側。Python 側 (`code/main.py`) は multi-vector index と
temporal grounding を担当する。この project は dashboard 側を提供し、
4 つの pipeline stage (chunk、embed、index、qa) を Hono app で表示する。

## 構成

```text
src/
  index.ts     entry: demo (default) または HTTP server (--serve)
  server.ts    Hono routes (/, /jobs, /job/:id) + HTML index
  jobs.ts      JobStore + fixture seeder
  stages.ts    stage advance + overall status
  types.ts     Stage, StageState, Job
tests/
  stages.test.ts  job state transitions + store
```

## Run

```bash
npm install
npm run typecheck
npm test
npm start              # 自動終了する demo
npm run serve          # HTTP server on :8123
```
