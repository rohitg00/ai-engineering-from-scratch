# Capstone 06 - DevOps Troubleshooting Agent (TypeScript)

`../main.py` の on-call agent 向け Slack integration skeleton です。slash-command endpoint と interactivity (button-click) endpoint を公開し、どちらも Slack の HMAC-SHA256 request signature と5分の replay window で gate されます。destructive remediation は Slack card が approve された後にだけ実行されます。

## Layout

```text
ts/
  package.json
  tsconfig.json
  src/
    index.ts          # entrypoint、demo + HTTP server
    server.ts         # hono app、/slack/command + /slack/interactivity
    slack_verify.ts   # HMAC v0 verification + timing-safe compare
    agent.ts          # mocked hypothesis ranker
    blocks.ts         # Block Kit response builder
    types.ts          # Hypothesis, AgentReport, SlackResponse, OutboundCall
  tests/
    slack_verify.test.ts
    agent.test.ts
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

placeholder secret を上書きするには `SLACK_SIGNING_SECRET=...` を設定します。interactive server は chosen port を表示します (`PORT` 未設定時は random)。

## Tests

tsx 経由の `node --test` runner。coverage:

- Slack signature verification: valid signature は pass、tampered signature は reject、stale timestamp (>5 min skew) は reject、non-numeric timestamp は reject、length-mismatch path は constant-time compare 前に exercise。
- Mock agent: OOM keyword path、CrashLoop keyword path、fallback path。
- Server: `/health`、`/slack/command` happy/tampered/stale paths、`/slack/interactivity` approve action。
