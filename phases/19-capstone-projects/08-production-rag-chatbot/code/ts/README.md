# Capstone 08 - Production RAG Chatbot (TypeScript)

Chat UI skeleton that streams a citation-anchored response over Server-Sent
Events. Pairs with the Python pipeline in `../main.py`. Conversation state lives
in an in-process Map keyed by `sessionId`, so the same session id can drive
multi-turn dialogues.

## Layout

```text
ts/
  package.json
  tsconfig.json
  src/
    index.ts        # entrypoint, demo + HTTP server
    server.ts      # hono app, /, /chat/stream (SSE), /sessions, /health
    session.ts     # SessionStore (Map<sessionId, Session>)
    stream.ts      # SSE frame encoder + parser + mock retrieval + tokenizer
    types.ts        # Session, Turn, Citation, KbEntry, SseEvent
  tests/
    session.test.ts
    stream.test.ts
    server.test.ts
```

## Run

```bash
npm install
npm run typecheck
npm test
npm start          # one self-check pass, exits 0
npm run serve      # interactive HTTP server on 127.0.0.1:<port>
```

The interactive server picks a free port when `PORT` is unset, mounts the chat
HTML client on `/`, and streams via `GET /chat/stream?sessionId=...&q=...`. The
demo client uses `EventSource` and listens for `session`, `citations`, `token`,
and `done` events.

## Tests

`node --test` runner via tsx. Coverage:

- SessionStore: create, lookup, append, list, no-op on missing id.
- SSE encoder + parser round-trip; retrieval boost by jurisdiction tag;
  tokenizer fallback + "See also" tail.
- Server: `/`, `/health`, `/chat/stream` happy path (session + citations +
  token + done), 400 on missing q, multi-turn session persistence,
  `/sessions` listing.
