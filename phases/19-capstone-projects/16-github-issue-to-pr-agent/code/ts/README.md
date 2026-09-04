# Lesson 16 - GitHub Issue-to-PR Agent (TypeScript webhook receiver)

TypeScript half of the capstone. Python side ships the agent loop and
dispatcher; YAML side ships the Actions workflow. This project is the GitHub
App webhook receiver: HMAC verify the raw body, route on event type, dispatch
a stub agent for `issues.opened`.

## Layout

```text
src/
  index.ts    entry: demo (default) or HTTP server (--serve)
  server.ts   Hono webhook receiver (POST /webhook)
  verify.ts   X-Hub-Signature-256 HMAC, timing-safe
  router.ts   event-type routing (ping, issues, pull_request)
  agent.ts    stub agent + audit log
  types.ts    payload + audit shapes
tests/
  verify.test.ts  signature pass, tampered, router pathing
```

## Run

```bash
npm install
npm run typecheck
npm test
npm start            # self-terminating demo (in-process replays)
npm run serve        # HTTP server on :8081
```

The HMAC secret is read from `GH_WEBHOOK_SECRET` (default `demo-shared-secret`
for the demo).
