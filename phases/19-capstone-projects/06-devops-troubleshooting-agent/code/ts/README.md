# Capstone 06 - DevOps Troubleshooting Agent (TypeScript)

Slack-integration skeleton for the on-call agent in `../main.py`. Exposes a
slash-command endpoint and an interactivity (button-click) endpoint, both gated
by Slack's HMAC-SHA256 request signature plus a 5-minute replay window.
Destructive remediations only run after the Slack card is approved.

## Layout

```text
ts/
  package.json
  tsconfig.json
  src/
    index.ts          # entrypoint, demo + HTTP server
    server.ts         # hono app, /slack/command + /slack/interactivity
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
npm start          # one self-check pass, exits 0
npm run serve      # interactive HTTP server on 127.0.0.1:<port>
```

Set `SLACK_SIGNING_SECRET=...` to override the placeholder secret. The
interactive server prints the chosen port (random when `PORT` is unset).

## Tests

`node --test` runner via tsx. Coverage:

- Slack signature verification: valid signature passes, tampered signature is
  rejected, stale timestamp (>5 min skew) is rejected, non-numeric timestamp is
  rejected, length-mismatch path is exercised before constant-time compare.
- Mock agent: OOM keyword path, CrashLoop keyword path, fallback path.
- Server: `/health`, `/slack/command` happy/tampered/stale paths,
  `/slack/interactivity` approve action.
