# Capstone 19/03 — Realtime Voice Assistant (TypeScript)

`../docs/en.md` で説明した streaming voice pipeline の multi-file TypeScript web-client harness です。offline state-machine simulation と、`ws` package を使う live WebSocket server を含みます。

## Layout

```text
src/
  index.ts        entry point。2つの offline session を走らせ、live ws を probe して exit 0
  server.ts       WebSocketServer 経由の hono /healthz + ws upgrade
  orchestrator.ts barge-in 付き IDLE -> LISTENING -> WAITING -> THINKING -> SPEAKING
  vad.ts          turn-completion scorer + synthetic 20ms-frame generator
  protocol.ts     zod-validated frame envelope (event / summary)
  types.ts        AudioChunk, Metrics, SessionOptions, SessionSummary
tests/
  vad.test.ts
  orchestrator.test.ts
  protocol.test.ts
```

## Run

```bash
npm install
npm start                # 2つの offline session + ws self-probe を実行し、exit 0
npm start -- --serve     # ws server を維持。停止は ctrl-c
npm test                 # tsx 経由の node --test runner
npm run typecheck        # tsc --noEmit
```

non-interactive `npm start` path は clean session が `first_audio_out` に到達し、barge-in session が少なくとも1つの barge-in event を登録し、live WebSocket probe が close 前に `summary` frame を受け取ることを assert します。
