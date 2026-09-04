# Lesson 17 - Personal AI Tutor (TypeScript web app)

TypeScript half of the capstone. Python side ships the learner model and
tutor policy; this project exposes the web-app surface: a curriculum DAG
walker, a BKT-style learner model, and an FSRS-lite spaced-repetition
scheduler behind two HTTP routes.

## Layout

```text
src/
  index.ts       entry: demo (default) or HTTP server (--serve)
  server.ts      Hono routes (GET /lesson/next, POST /lesson/:id/submit)
  curriculum.ts  DAG fixture + Kahn topo sort + next-lesson picker
  mastery.ts     MasteryStore (per-lesson BKT-ish update)
  repetition.ts  scheduleNextDue (interval doubling / halving, clamped)
  types.ts       Lesson, Mastery, Pick
tests/
  curriculum.test.ts  topo order, BKT update, FSRS scheduling
```

## Run

```bash
npm install
npm run typecheck
npm test
npm start            # self-terminating curriculum walk
npm run serve        # HTTP server on :8090
```
