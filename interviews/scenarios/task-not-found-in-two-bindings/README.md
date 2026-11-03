---
id: task-not-found-in-two-bindings
title: One error, two status codes
card: scenarios
kind: incident
level: 2
roles: [agentic-ai-engineer, forward-deployed-ai-engineer]
rounds: [debugging, system-design]
tags: [a2a, errors, json-rpc, retries, idempotency]
minutes: 20
lessons: [phases/14-agent-engineering/26-failure-modes-agentic]
manuals: []
practice: []
cheatsheet: [a2a, agent-failure-modes]
related: []
updated: 2026-11-03
system:
  version: A2A 1.0.1 with the manual's capture kit (the test-runner, code-reviewer and deployer agents)
  model: no model; the agents are deterministic fixtures
  hardware: one machine, localhost, no network
source:
  - manuals/a2a-101/capture/out/11-errors.http
  - manuals/a2a-101/capture/out/16-rest-binding.http
  - manuals/a2a-101/sections/5-5-errors.md
  - manuals/a2a-101/sections/5-1-json-rpc.md
  - manuals/a2a-101/sections/5-2-http-json.md
  - manuals/a2a-101/sections/r-4-errors.md
---

## Situation

A planner delegates test runs to a remote `test-runner` agent. Its transport layer was written for a plain REST service. A 2xx reply is a success. A 404 means the record is not visible yet, so the client waits and asks again. A 5xx gets a retry with backoff. The planner first talked to the agent over its JSON-RPC interface. Last night it looked up a task id that the agent had purged, logged the lookup as a success, and then crashed on an empty result.

A teammate moved the planner to the agent's HTTP+JSON interface this morning, "so that we get real status codes". The same lookup now comes back as a 404, and the planner has asked again every two seconds for an hour. You are asked to make the client stop at the right time in both bindings, without a special case for each error.

## Evidence

- [a GetTask for an unknown id over JSON-RPC, status and code](evidence/jsonrpc-lookup.txt)
- [the detail inside data of the same JSON-RPC error](evidence/jsonrpc-reason.txt)
- [the same lookup over HTTP+JSON, status and body head](evidence/rest-lookup.txt)
- [the detail inside the HTTP+JSON error](evidence/rest-reason.txt)
- [every A2A error with its code in each binding](evidence/error-table.txt)
- [which errors a client may retry](evidence/retry-rules.txt)

## Questions

1. In the JSON-RPC reply, where is the fact that the lookup failed, and what does the HTTP status tell you?
2. Which field is identical in both replies, and which fields differ?
3. How many of the nine A2A errors share one HTTP status, and what does that do to a policy that keys on the status alone?
4. Which errors may a client retry, and what should it do with a task that is not found?
5. The planner also retries a SendMessage after a timeout. What must it keep the same, and why?

## Walkthrough

1. **Read the JSON-RPC reply.** The status line says `200 OK`, and the body has no `result`. In its place sits an `error` member with the code -32001 and the message `Task not found`. In this binding every reply is a 200, so the status carries no information. The client must open the body and test for `error` before it reads `result`.
2. **Read the detail in `data`.** It is a list with one object. Its `reason` is `TASK_NOT_FOUND`, its `domain` is `a2a-protocol.org`, and its `metadata` repeats the task id. The reason is the name of the error without its suffix. This is the field a client can decide on.
3. **Read the HTTP+JSON reply.** The status line says `404 Not Found`. The body is a Status object with `code` 404, `status` `NOT_FOUND`, the same message, and `details` where JSON-RPC had `data`. Inside the details sits the same detail object with the same reason. The envelope changed, and the error did not.
4. **Read the table.** Seven of the nine A2A errors map to HTTP 400, and `InvalidParamsError` maps to 400 as well. The three JSON-RPC parse and request errors have no HTTP status at all. A rule keyed to the status cannot tell a task that cannot be canceled from a request with a bad field. Only `TaskNotFoundError` maps to 404, so a REST policy that waits on 404 waits on the one error that never clears.
5. **Apply the retry rules.** `-32603`, HTTP 500 or 503, or a dropped connection: retry with backoff and honor `Retry-After`. HTTP 401: get a fresh credential. `-32600`, `-32602`, `-32005` and `-32009`: fix the request. `-32001`: stop, because the id is wrong, purged, or hidden from this caller. `-32002`, or `-32004` on a terminal task: start a new task. `-32003` or `-32007`: read the card again. A server must not reveal a task that the caller may not see, so not found can also mean "not yours".
6. **Check the other retry.** A SendMessage that timed out may have created a task. Duplicate detection by `messageId` is optional, so a resend with a fresh id can start a second task. The planner resends the same bytes with the same `messageId`, and the server gets its one chance to recognize the duplicate.

## Resolution

The client decoded the transport and never the protocol. The fix is one error reader for both bindings. Read the HTTP status, then the `error` member or the Status body, then the `reason` of the first detail. Classify by reason into retry, re-authenticate, fix the request, or stop. On `TASK_NOT_FOUND` the planner stops after one reply, in either binding, which is what the capture shows: one request and one reply for the unknown id over JSON-RPC, and one request and one reply over HTTP+JSON. A retried send keeps its `messageId`. The hour of repeated lookups does not come back, because the decision no longer depends on a status code that one binding does not even use.

## Wrong turns

- "Move every client to HTTP+JSON, then the status codes are real." Seven of the nine A2A errors arrive as 400 there, next to invalid parameters. The status still does not name the error.
- "Match on the message text." The message is for a person. The reference implementation answers the same cases with other words and other field names, so a text match breaks on the next server.
- "Treat 404 as eventual consistency and keep polling." The specification tells a server to answer not found for a purged id and for a task the caller may not see. No later call changes that answer.
- "Resend with a fresh messageId to be safe." Duplicate detection is optional, and a fresh id removes the only hint the server has. The suite can run twice.

## Generalize

A protocol carried over HTTP has two layers of status. The transport status says whether the bytes arrived. The protocol's own error says what happened to the request, and in some bindings it hides behind a 200. Decide on the protocol's discriminator, keep the set of retryable errors small and explicit, and give every retry an idempotency key that the server can see.

## Taught in

The [errors page of A2A 101](../../../manuals/a2a-101/sections/5-5-errors.md) reads these two replies and gives the retry rules, [the error table](../../../manuals/a2a-101/sections/r-4-errors.md) maps every error into the three bindings, and the [failure modes lesson](../../../phases/14-agent-engineering/26-failure-modes-agentic/) names the cascade that follows a client that cannot tell failure from success.
