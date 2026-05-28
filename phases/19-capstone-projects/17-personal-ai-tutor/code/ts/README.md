# Lesson 17 - Personal AI Tutor (TypeScript web app)

Capstone の TypeScript 側。Python 側は learner model と tutor policy を提供する。
この project は web-app surface を expose し、curriculum DAG walker、
BKT-style learner model、FSRS-lite spaced-repetition scheduler を
2 つの HTTP route の背後に置く。

## 構成

```text
src/
  index.ts       entry: demo (default) または HTTP server (--serve)
  server.ts      Hono routes (GET /lesson/next, POST /lesson/:id/submit)
  curriculum.ts  DAG fixture + Kahn topo sort + next-lesson picker
  mastery.ts     MasteryStore (per-lesson BKT-ish update)
  repetition.ts  scheduleNextDue (interval doubling / halving, clamped)
  types.ts       Lesson, Mastery, Pick
tests/
  curriculum.test.ts  topo order、BKT update、FSRS scheduling
```

## Run

```bash
npm install
npm run typecheck
npm test
npm start            # 自動終了する curriculum walk
npm run serve        # HTTP server on :8090
```
