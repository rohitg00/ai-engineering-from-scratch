---
id: a2a-webhook-at-least-once
title: A webhook that may fire twice or not at all
card: protocols
kind: tradeoff
level: 3
roles: [agentic-ai-engineer, forward-deployed-ai-engineer]
rounds: [system-design, design-review]
tags: [a2a, push-notifications, webhook, idempotency, ssrf]
minutes: 10
lessons: []
manuals: [a2a-101#s-push-notification-configs, a2a-101#s-security-requirements]
practice: []
cheatsheet: [a2a-and-agent-messaging]
related: [protocols/a2a-stream-drop-resubscribe, protocols/retry-is-not-idempotency]
updated: 2026-11-03
---

A test run outlasts any connection your planner can hold open, so you want a webhook. Compare a webhook with polling and with streaming for this case. Then list the receiver's duties, given that the agent promises only to try each delivery at least once, and that the config operations return the stored webhook credentials to anyone who can call them.

## Short answer

Register the config inline in `SendMessage` with `returnImmediately: true`, so that no event escapes before the config exists, and close the connection. Delivery is at least once, so a notification can arrive twice or, after an outage, not at all: the receiver answers 2xx, checks the task id, processes idempotently, and reads the task with `GetTask` before it acts. Put the secret your receiver checks in `authentication`, because `token` has no standard header, and restrict who can call the four config operations, because a read returns the credentials in clear.

## Full answer

### Three ways to wait

| Mechanism | Holds a connection | Learns of a change | Cost when the client restarts |
|---|---|---|---|
| polling with `GetTask` | no | on the next poll | none, the task is stored |
| `SendStreamingMessage` or `SubscribeToTask` | yes | at once | missed frames; subscribe again for a snapshot |
| webhook | no | at once, when delivery succeeds | missed deliveries; read the task |

A webhook suits work that outlasts the caller. It moves the connection problem to the receiver and adds a second trust boundary.

### What arrives

Each notification is one HTTP POST whose body is one `StreamResponse` in the HTTP+JSON form, with no JSON-RPC envelope. In the recorded run the first body was a `statusUpdate` with `TASK_STATE_WORKING`, under `Content-Type: application/a2a+json`, `Authorization: Bearer <secret>` and `X-A2A-Notification-Token`. The SDKs differ on the content type, on the token header, and on timeouts of 5 s or 30 s, and none of them retries. So accept both content types, read either token header, and handle every `StreamResponse` member, because the reference SDK also posts the first `Task`.

### The receiver's duties

1. Answer with a 2xx status to confirm receipt.
2. Check that the task id matches a task you expect.
3. Process idempotently. A status update is safe to apply twice, keyed by task id and timestamp. An `artifactUpdate` with `append: true` is not, and no delivery id exists.
4. Treat each notification as a signal and read the task with `GetTask` before you act.
5. Check the `Authorization` value against the credential you put in `authentication`.

### The agent's duties, and where they fail

The agent must put the configured credentials in the request headers and should validate the URL against server-side request forgery, rejecting private ranges such as `10.0.0.0/8` and `192.168.0.0/16`, loopback and link-local addresses. The reference SDK's validator does that only when the host turns it on. A config must stay until the task completes or a client deletes it, and a delete must be idempotent.

### The trade

Inline registration costs one field and closes the gap between the first event and the config. The secret in `authentication` costs a per-run value and buys a check the receiver can make. The read-back of credentials in clear is the price of the four config operations, so scope them to the task's owner.

## Follow-ups

- **Level 3:** An `artifactUpdate` with `append: true` arrives twice. Why can you not apply it twice? Expected: it duplicates parts, and there is no delivery id to deduplicate on, so read the task instead.
- **Level 3:** The receiver was down for a minute. What did it miss? Expected: possibly everything, because no SDK retries; read the task when the receiver returns.
- **Level 4:** Why must the agent reject a webhook URL inside a private range? Expected: the agent calls that URL for every later event of the task, so an outside caller could aim the agent's requests at an internal service.
- **Level 4:** Who may call `ListTaskPushNotificationConfigs`, and why? Expected: only the task's owner, because the reply returns `credentials` and `token` unchanged.

## Wrong answers

- "Register the webhook after the task starts with the create operation." Events before the config exists are lost. Inline registration leaves no gap.
- "Authenticate on the token header." The specification gives `token` no transport, and the SDKs use two header names. Put the secret in `authentication` and check `Authorization`.
- "Apply each notification as it arrives." Duplicates and lost deliveries both happen. The stored task is the source of truth.

## Taught in

The [push notification section](../../../manuals/a2a-101/sections/4-6-push-notification-configs.md) records the eight deliveries and the SDK table, and the [security requirements section](../../../manuals/a2a-101/sections/6-3-security-requirements.md) lists the webhook rules.
