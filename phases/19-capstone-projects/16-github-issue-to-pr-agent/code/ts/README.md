# Lesson 16 - GitHub Issue-to-PR Agent (TypeScript webhook receiver)

Capstone の TypeScript 側。Python 側は agent loop と dispatcher、YAML 側は
Actions workflow を提供する。この project は GitHub App webhook receiver であり、
raw body を HMAC verify し、event type で route し、`issues.opened` に対して
stub agent を dispatch する。

## 構成

```text
src/
  index.ts    entry: demo (default) または HTTP server (--serve)
  server.ts   Hono webhook receiver (POST /webhook)
  verify.ts   X-Hub-Signature-256 HMAC, timing-safe
  router.ts   event-type routing (ping, issues, pull_request)
  agent.ts    stub agent + audit log
  types.ts    payload + audit shapes
tests/
  verify.test.ts  signature pass、tampered、router pathing
```

## Run

```bash
npm install
npm run typecheck
npm test
npm start            # 自動終了する demo (in-process replays)
npm run serve        # HTTP server on :8081
```

HMAC secret は `GH_WEBHOOK_SECRET` から読む (demo では default
`demo-shared-secret`)。
