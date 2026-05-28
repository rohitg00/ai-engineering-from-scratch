# Capstone 19/01 — Terminal-Native Coding Agent (TypeScript)

`../docs/en.md` で説明した plan/act/observe loop の multi-file TypeScript harness です。offline、deterministic、network call なしで動きます。

## Layout

```text
src/
  index.ts     entry point。scripted demo と eval を実行して exit 0
  repl.ts      interactive command parser (run / eval / help / quit)
  harness.ts   hook bus に接続された plan-act-observe loop
  hooks.ts     eight-event hook bus と destructive-command guard
  model.ts     demo を駆動する scripted offline LLM
  tools.ts     zod-validated args 付き read_file + run_shell
  plan.ts      PlanState (todo rewrite) + Budget (turn / token / dollar ceilings)
  eval.ts      3つの offline task の tiny pass/fail counter
  types.ts     shared shape definitions
tests/
  harness.test.ts
  tools.test.ts
```

## Run

```bash
npm install
npm start                # scripted demo + offline eval を実行し、exit 0
npm start -- --repl      # interactive harness REPL を開く
npm test                 # tsx 経由の node --test runner
npm run typecheck        # tsc --noEmit
```

non-interactive `npm start` path は eval が `passed=3 failed=0` を報告し、scripted run が all-done plan に収束することを assert します。drift があれば run は失敗します。
