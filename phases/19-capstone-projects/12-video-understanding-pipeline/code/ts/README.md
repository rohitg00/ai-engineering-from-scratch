# Lesson 12 - Video Understanding Pipeline (TypeScript UI)

TypeScript half of the capstone. The Python side (`code/main.py`) owns the
multi-vector index and temporal grounding. This project ships the dashboard
half: a Hono app over the four pipeline stages (chunk, embed, index, qa).

## Layout

```text
src/
  index.ts     entry: demo (default) or HTTP server (--serve)
  server.ts    Hono routes (/, /jobs, /job/:id) + HTML index
  jobs.ts     JobStore + fixture seeder
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
npm start              # self-terminating demo
npm run serve          # HTTP server on :8123
```
