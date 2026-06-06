# Capstone 19/03 — Realtime Voice Assistant (TypeScript)

Multi-file TypeScript web-client harness for the streaming voice pipeline
described in `../docs/en.md`. Offline state-machine simulation plus a live
WebSocket server backed by the `ws` package.

## Layout

```text
src/
  index.ts        entry point; runs two offline sessions, probes the live ws, exits 0
  server.ts       hono /healthz + ws upgrade via WebSocketServer
  orchestrator.ts IDLE -> LISTENING -> WAITING -> THINKING -> SPEAKING with barge-in
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
npm start                # runs two offline sessions + ws self-probe, exits 0
npm start -- --serve     # keep ws server up; ctrl-c to stop
npm test                 # node --test runner via tsx
npm run typecheck        # tsc --noEmit
```

The non-interactive `npm start` path asserts the clean session reaches
`first_audio_out`, the barge-in session registers at least one barge-in event,
and the live WebSocket probe receives a `summary` frame before close.
