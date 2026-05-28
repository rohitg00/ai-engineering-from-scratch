# Capstone 08 - Production RAG Chatbot (TypeScript)

Server-Sent Events で citation-anchored response を stream する Chat UI skeleton です。`../main.py` の Python pipeline と対になります。conversation state は `sessionId` key の in-process Map に保持されるため、同じ session id で multi-turn dialogue を進められます。

## Layout

```text
ts/
  package.json
  tsconfig.json
  src/
    index.ts        # entrypoint、demo + HTTP server
    server.ts       # hono app、/、/chat/stream (SSE)、/sessions、/health
    session.ts      # SessionStore (Map<sessionId, Session>)
    stream.ts       # SSE frame encoder + parser + mock retrieval + tokenizer
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
npm start          # self-check を1回実行して exit 0
npm run serve      # 127.0.0.1:<port> の interactive HTTP server
```

`PORT` が未設定の場合、interactive server は空き port を選び、chat HTML client を `/` に mount し、`GET /chat/stream?sessionId=...&q=...` で stream します。demo client は `EventSource` を使い、`session`、`citations`、`token`、`done` event を listen します。

## Tests

tsx 経由の `node --test` runner。coverage:

- SessionStore: create、lookup、append、list、missing id の no-op。
- SSE encoder + parser round-trip、jurisdiction tag による retrieval boost、tokenizer fallback + 関連 tail。
- Server: `/`、`/health`、`/chat/stream` happy path (session + citations + token + done)、q 欠落時の 400、multi-turn session persistence、`/sessions` listing。
