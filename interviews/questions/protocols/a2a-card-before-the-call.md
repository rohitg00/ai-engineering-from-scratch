---
id: a2a-card-before-the-call
title: What an A2A client reads before its first message
card: protocols
kind: concept
level: 1
roles: [agentic-ai-engineer, forward-deployed-ai-engineer, ai-developer-relations-engineer]
rounds: [screen, system-design]
tags: [a2a, agent-card, discovery, capabilities]
minutes: 7
lessons: []
manuals: [a2a-101#s-agentcard-fields, a2a-101#s-discovery-and-supported-interfaces]
practice: []
cheatsheet: [a2a]
related: [protocols/a2a-rejected-task-loop]
updated: 2026-11-03
---

Your planner agent must delegate a test run to a remote agent that it knows only by host and port. Describe what it fetches first, how it decides which endpoint to call, and what it checks before it asks that agent for a stream.

## Short answer

It fetches the agent card with a plain GET on `/.well-known/agent-card.json`. From `supportedInterfaces` it takes the first entry whose binding and version it speaks, and it calls that entry's URL. Before `SendStreamingMessage` it reads `capabilities.streaming`, because a server must refuse the call with `UnsupportedOperationError` when the flag is absent or false.

## Full answer

### One GET, one document

The specification names three routes to a card: the well-known URI, a registry or catalog, and direct configuration. It standardizes only the first. A planner with hosts in its configuration fetches each card from the well-known path.

The proto gives `AgentCard` 14 fields, and eight are REQUIRED: `name`, `description`, `supportedInterfaces`, `version`, `capabilities`, `defaultInputModes`, `defaultOutputModes` and `skills`. Four of them are lists, and a required list must hold at least one element. Reject a card that lacks one.

### The endpoint comes from the interface list

Each `supportedInterfaces` entry has a REQUIRED `url`, `protocolBinding` and `protocolVersion`. The list is ordered, and the client selects the first entry it supports. Supported means a binding and a version that the client implements. The client also copies that entry's `tenant` into every request, and omits the field when the entry has none.

### Flags decide which operations exist

| Flag in `capabilities` | Operations it allows | Error when absent or `false` |
|---|---|---|
| `streaming` | `SendStreamingMessage`, `SubscribeToTask` | `UnsupportedOperationError`, `-32004` |
| `pushNotifications` | the four push configuration operations | `PushNotificationNotSupportedError`, `-32003` |
| `extendedAgentCard` | `GetExtendedAgentCard` | `UnsupportedOperationError`, `-32004` |

An absent flag counts as `false`. In the recorded error run, a push configuration sent to an agent without the flag got `-32003` for a task id that did not even exist. The card had already answered.

### Cache it like any document

A card changes rarely. The server should send `Cache-Control` with `max-age` and an `ETag`. The client honors them and revalidates with `If-None-Match`.

## Follow-ups

- **Level 1:** Which field tells you what work the agent can do? Expected: `skills`, each with an `id`, a `name`, a `description` and at least one tag; pick the agent by skills and media modes.
- **Level 2:** The card lists a gRPC entry first and a JSON-RPC entry second, and your client speaks only JSON-RPC. Which URL do you call? Expected: the JSON-RPC one, because the rule is the first entry that you support.
- **Level 2:** How do media types reach the agent? Expected: the card's `defaultInputModes` and `defaultOutputModes`, a skill's own `inputModes` and `outputModes`, and a `mediaType` on each part the client sends.
- **Level 3:** You hold a bearer token and the card sets `extendedAgentCard`. What changes? Expected: call `GetExtendedAgentCard` with the declared credential and use the fuller card in place of the cached public one for that session, or until the card's `version` changes.

## Wrong answers

- "Read the top-level `url` field of the card." The current version moved the endpoint into `supportedInterfaces`, and there is no top-level `url`.
- "Try the stream and fall back when it fails." The flag answers the question in advance. The failed call costs a round trip for nothing.
- "Put the skill id in the message so the server runs that skill." No field of `SendMessageRequest` or `Message` names a skill. The list describes the agent.

## Taught in

The [AgentCard fields section](../../../manuals/a2a-101/sections/2-1-agentcard-fields.md) lists the fields, and the [discovery section](../../../manuals/a2a-101/sections/2-2-discovery-and-supported-interfaces.md) gives the interface rule and the flag table.
