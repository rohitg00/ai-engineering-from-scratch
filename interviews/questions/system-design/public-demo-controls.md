---
id: public-demo-controls
title: Put a model demo behind a public link safely
card: system-design
kind: design
level: 2
roles: [applied-ai-engineer, ai-developer-relations-engineer, forward-deployed-ai-engineer]
rounds: [system-design]
tags: [demo, rate-limit, token-bucket, validation, privacy]
minutes: 15
lessons: [phases/17-infrastructure-and-production/29-model-demo-interfaces]
manuals: []
practice: []
cheatsheet: [production-llm-app]
related: [system-design/demo-to-product-signals, system-design/streaming-and-fallback]
updated: 2026-11-03
---

A reviewer and a customer want to try your model from a link, on a phone, without your notebook. Each model call costs money. Design the demo: the input contract, the order of the checks, the controls for a public link, and what the log is allowed to keep.

## Short answer

Write the contract first: a string of 1 to 500 characters with no control characters, a model call with a known cost, and an output that includes a JSON error with a hint. Run the checks in order of cost, body size, access token, per-client token bucket, input validation, daily cap, and only then the model call. Return a stable error code with a message, a hint and a request id, and log the route, the status, the latency and the input length with a keyed hash of the client, never the text or the address.

## Full answer

### The contract

| Part | Question | Answer in the lesson |
|---|---|---|
| Input | What type, size and characters | A string of 1 to 500 characters, no control characters |
| Model call | How long and how much | Known latency and cost per call |
| Output | What the user sees on success and failure | A label and a reply, or a JSON error with a hint |

A notebook has no limit on any part. The demo sets one on each, and the server applies it to every client, because any client can skip the page.

### Checks in order of cost

1. Read the content length and refuse a body over 4,096 bytes before reading it.
2. Check the access token when one is required.
3. Take one token from the client's bucket; refuse with 429 and a `Retry-After` header when empty.
4. Parse and validate the body: JSON object, text present, inside the limit, no control characters, with 422 for a bad field.
5. Charge the daily cap; refuse with 503 and `Retry-After` when the day's budget is spent.
6. Call the model.

A bad request stops at the first failed check and costs almost nothing. The paid step is last, so only valid requests count against the cap.

### Controls once the link is public

| Risk | Control |
|---|---|
| One client floods | A token bucket per client: a capacity for bursts, a refill rate for the long run |
| Strangers find the link | An optional access token in the authorization header |
| Total cost grows | A daily usage cap over all clients, counted in windows of 86,400 seconds |
| Large or odd input | Body limit, text limit, control character check |
| Logs keep private input | Records with the input length and a keyed hash of the client |

A rate limit controls each client and not the total; a hundred polite clients can still spend the budget, which is what the cap is for.

### Errors a user can act on

Every error has the same shape: a stable `code` for clients and tests, a `message` with the numbers the user needs, a `hint` with one action, and a `request_id` that joins a user report to one log record. A stack trace does none of these jobs for a stranger.

### Feedback and streaming

The page disables the button while a request runs, shows the elapsed time, and shows the time to first token when it arrives, so the user can tell a slow model from a broken page and does not click again. Tokens stream as server-sent events over a POST body, not a GET URL, so the input never lands in an access log.

### What the log keeps

Route, status, error code, latency and input length, plus a keyed hash of the client address for per-client counts. Never the input text, never the raw path, never the address. The page tells users what is kept.

## Follow-ups

- **Level 2:** Why does the daily cap run after validation and not before? Expected: so only valid requests count against the budget; a rejected request should not spend it.
- **Level 2:** Behind a reverse proxy every request has the proxy's address. What breaks? Expected: all users share one bucket; read the client address from a header that only your proxy sets and trust it from nowhere else.
- **Level 3:** Why send the input in a POST body instead of the URL for the event stream? Expected: servers and proxies write URLs into access logs, so a GET would store user text.
- **Level 3:** A framework builds the page for you. Which controls are still your job? Expected: the rate limit, the cost cap and log privacy; the frameworks save work on the form and the streaming, not on the risks of a public link.

## Wrong answers

- "Validate in the browser with a maximum length attribute." The browser helps honest users only; the server repeats every check.
- "A rate limit per client is enough to control cost." It bounds each client, not the sum; the daily cap bounds the total.
- "Log the full request so you can debug reports." The log then holds user text and addresses; a request id joins a report to a record without either.

## Taught in

The [model demo interfaces lesson](../../../phases/17-infrastructure-and-production/29-model-demo-interfaces/) gives the contract, the ordered checks, the token bucket, the usage cap and the private log.
