---
id: mrtr-confirmation-state
title: Confirm a deletion without a session
card: protocols
kind: design
level: 3
roles: [agentic-ai-engineer, forward-deployed-ai-engineer]
rounds: [system-design, design-review]
tags: [mcp, elicitation, mrtr, request-state, replay, confirmation]
minutes: 12
lessons: [phases/13-tools-and-protocols/12-mcp-roots-and-elicitation, phases/13-tools-and-protocols/15-mcp-security-tool-poisoning]
manuals: []
practice: []
cheatsheet: [mcp-tasks-elicitation-apps, mcp-security-auth]
related: [protocols/roots-are-not-a-sandbox, protocols/header-body-mismatch-order]
updated: 2026-11-03
---

A tool that deletes notes, `notes_delete`, finds three notes that match the title the user gave. Design the confirmation flow under the current MCP revision: how the server asks the user to pick one and confirm, how the answer comes back, and what stops a client from answering a different question or replaying one confirmation with changed arguments.

## Short answer

The server answers with a result typed `input_required` that embeds an `elicitation/create` form request listing the three candidate ids and a `confirm` boolean, plus an integrity-protected `requestState`. The client shows the form and retries the original `tools/call` with a new request id, echoing `requestState` and the `inputResponses`. The server signs the state over the principal, the method, a digest of the arguments, the candidate set, the phase and an expiry, verifies the echo, checks that the chosen id was in the signed set, re-authorizes the workspace and re-checks containment, and consumes a one-time nonce in a shared replay store before it deletes.

## Full answer

### The first response

```json
{
  "resultType": "input_required",
  "inputRequests": {
    "delete_choice": {
      "method": "elicitation/create",
      "params": {
        "mode": "form",
        "message": "Choose one matching note and confirm deletion.",
        "requestedSchema": {
          "type": "object",
          "properties": {
            "note_id": {"type": "string", "enum": ["note-3", "note-7", "note-14"]},
            "confirm": {"type": "boolean"}
          },
          "required": ["note_id", "confirm"]
        }
      }
    }
  },
  "requestState": "integrity-protected-delete-state"
}
```

A current server sends no reverse JSON-RPC request. The embedded request is complete, with `method` and `params`, and its key must match the entry in `inputResponses` on the retry.

### Capabilities are checked on this request

The server may embed a form only when the current request's `clientCapabilities` support it. `{"elicitation": {}}` and `{"elicitation": {"form": {}}}` both support form mode. A URL-only declaration does not, and the server returns `-32021` with `data.requiredCapabilities` equal to `{"elicitation":{"form":{}}}`. An earlier request's declaration never counts.

### Form mode has limits

The root is an object with flat primitive fields or supported enums. Use it to choose among candidates, confirm a destructive operation or collect non-sensitive preferences. Never collect passwords, API keys or payment credentials in it, because they would pass through the client and could reach logs or model context. URL mode exists for that external flow.

### Three outcomes, three behaviors

| Action | Meaning | Server behavior |
|---|---|---|
| `accept` | the user submitted the form | validate the content and continue |
| `decline` | the user refused | return a complete, non-error refusal; consume the nonce without deleting |
| `cancel` | the user dismissed or could not finish | stop safely; the state stays retryable until expiry |

Never read missing content as consent, and never turn a decline into a repeated prompt.

### What the signed state binds

The state holds the authenticated principal, the originating method, a digest of `workspaceUri` and `title`, the allowed note ids shown in the form, the operation phase and a short expiry. On the retry the server verifies the signature, validates the response against the schema, checks that `note_id` is in the signed candidate set, re-authorizes the workspace, re-checks containment, and only then mutates. A changed title cannot reuse the original state.

### Why HMAC alone is not enough

A valid state can be replayed within its expiry. Store and consume a nonce exactly once in a replay store shared by every handler instance, and hold the atomic claim while the deletion runs. A database couples the claim and the mutation in one transaction. Validate before you claim: a malformed response or a cancel claims nothing.

## Follow-ups

- **Level 3:** The client declares `{"elicitation": {"url": {}}}` only. What does the server do? Expected: return `-32021` with the required form capability in `data`; it must not embed a mode the current request did not declare.
- **Level 3:** The user dismisses the dialog. Which action, and what happens to the state? Expected: `cancel`; nothing is mutated and the state stays retryable until it expires, unlike `decline`, which is terminal.
- **Level 4:** Two server instances share the note store. How do you stop both from executing one confirmation? Expected: a shared replay store with an atomic nonce claim coupled to the mutation; the lesson's test runs two server objects against one state.
- **Level 4:** A note moves outside the workspace after the form was shown. What catches it? Expected: the live record check and the containment re-check before mutation, not the signed state alone.

## Wrong answers

- "Keep the candidate list in server memory keyed by the connection." There is no session, and the retry can reach any instance. The candidates travel inside the signed state.
- "The host validated the form, so the server can trust the content." The client controls everything it sends. The server validates the schema and the candidate set again.
- "Ask for the user's password in the form as the confirmation." Form mode must not carry secrets. An external credential flow uses URL mode and binds the browser user to the same principal.

## Taught in

The [roots and elicitation lesson](../../../phases/13-tools-and-protocols/12-mcp-roots-and-elicitation/) builds this flow with a replay store, and the [security lesson](../../../phases/13-tools-and-protocols/15-mcp-security-tool-poisoning/) treats `requestState` as hostile input.
