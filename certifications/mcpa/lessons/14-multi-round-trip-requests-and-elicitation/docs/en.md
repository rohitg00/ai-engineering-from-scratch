# Multi Round-Trip Requests and Elicitation

> A server that needs the user's confirmation mid call does not hold a connection open and wait. It ends the call, hands the client a receipt, and lets a brand new request pick up where the first one left off.

**Type:** Reference
**Languages:** Python
**Prerequisites:** Lesson 13
**Time:** ~45 minutes

## Learning Objectives

- Explain why Multi Round-Trip Requests (MRTR) replaced server-initiated requests such as elicitation, sampling, and roots, and what that trade buys a horizontally scaled server
- Read an InputRequiredResult and its retry as ordinary JSON-RPC messages: inputRequests, inputResponses, and a requestState that must be echoed exactly
- Distinguish form mode elicitation from URL mode elicitation and know which one a server must use for sensitive data
- Protect requestState with hmac and hashlib from the standard library so it survives an untrusted client without becoming a forgeable capability
- Tell a tampered, expired, or misbound requestState apart from a working one, and explain why a server must reject each one

## The Problem

A deploy tool is about to replace the running release of a service. Before it does, it needs the user to say yes. That single requirement used to be expensive to build correctly.

The old pattern had the server hold the original request open, on a stream, while it sent a separate request of its own, such as `elicitation/create`, down that same connection. The client answered on a second request, and the server had to match that answer back to the first one that was still waiting. For a single process talking to a single client, that match up is trivial: the same process is holding both ends. The trouble starts the moment the server is more than one process. A load balancer that routed the confirmation to a different replica than the one holding the original call left the server needing a shared storage layer, or sticky routing that pins a client to one instance, just to reunite the two halves of one conversation. Either fix is expensive: a shared store is a new dependency with its own availability and cleanup problems, and sticky routing breaks the even load distribution a fleet of stateless replicas depends on.

That cost falls hardest on the common case. Most tools are ephemeral: nothing about the deploy tool's own logic needs to survive between the moment it asks "are you sure" and the moment it hears "yes". The stateless core from the earlier lessons already established that a server must not lean on a connection to remember anything between requests. Server-initiated requests broke that promise the instant they needed an answer mid call, because the only place that answer could land, safely and quickly, was back inside the process that was still blocking on it.

## The Concept

Multi Round-Trip Requests removes the server-initiated request entirely (SEP-2322). Instead of asking a question from inside an open call, a server that needs more information ends the call early with a distinct kind of result, and the client starts a completely new, independent request once it has what the server asked for. The flow has four steps: the client sends a request; the server decides it needs more and ends that request with `resultType: "input_required"`; the client gathers the missing information; the client retries the original request, now carrying the answers, as a request with its own new id. Nothing about step four depends on which server replica answered step one, or step two, or will answer step four itself. Any of them can, because everything they need travels with the request.

An `InputRequiredResult` carries two optional fields, and every response of this shape must include at least one of them. `inputRequests` is a map from a server chosen string key to a request object that must be exactly one of `elicitation/create`, `sampling/createMessage`, or `roots/list`. A server must never place a request type in that map unless the client declared the matching capability on this same request; if a tool always needs confirmation and the caller has not declared `elicitation`, the correct response is a protocol error, `-32021 MissingRequiredClientCapability`, naming what is missing in `data.requiredCapabilities`, the same pattern the capability negotiation lesson introduced. Only three client requests may ever receive an `input_required` result: `tools/call`, `prompts/get`, and `resources/read`. Every other request always finishes as `complete`.

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "resultType": "input_required",
    "inputRequests": {
      "confirm": {
        "method": "elicitation/create",
        "params": {
          "mode": "form",
          "message": "Deploy checkout to production? This replaces the running release.",
          "requestedSchema": {
            "type": "object",
            "properties": {"confirmed": {"type": "boolean", "title": "Confirm deploy"}},
            "required": ["confirmed"]
          }
        }
      }
    },
    "requestState": "eyJwcmluY2lwYWwiOiJ1c2VyLWFsaWNlIn0.9f2c...redacted"
  }
}
```

`requestState` is the field that lets a stateless server pick this conversation back up without remembering anything. It is an opaque string, meaningful only to the server that minted it. A client must not inspect it, parse it, or change a single byte of it; on retry the client either echoes it back exactly, or omits it entirely if the server never sent one in the first place. Because that string passes through a client the server does not fully trust, the specification treats it as attacker controlled the moment it influences authorization, resource access, or business logic, and requires integrity protection, an HMAC or an AEAD cipher, that rejects anything that fails verification. Good practice binds three things inside the protected payload and checks all three on every retry: the authenticated principal, so one user's confirmation token cannot be replayed by another; a short expiry, so a stale token cannot resurface days later; and a digest of the originating request's salient parameters, so a token minted for one call cannot be redirected onto a different one with the same tool name but different arguments. None of those three checks guarantee single use by themselves, so a server for which a token must be redeemed at most once still has to track that server side.

The retry itself is a fresh request with a fresh JSON-RPC id; it is never the same id as the call that received `input_required`, because the two are independent requests that happen to share the same `name` and `arguments`. It adds `params.inputResponses`, a map using the same keys the server issued in `inputRequests`, with each value being the matching result type, an `ElicitResult`, a `CreateMessageResult`, or a `ListRootsResult`.

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "deploy_release",
    "arguments": {"service": "checkout", "environment": "production"},
    "inputResponses": {"confirm": {"action": "accept", "content": {"confirmed": true}}},
    "requestState": "eyJwcmluY2lwYWwiOiJ1c2VyLWFsaWNlIn0.9f2c...redacted"
  }
}
```

Elicitation itself comes in two modes. Form mode asks the client to collect structured data through a `requestedSchema` restricted to flat objects of primitive properties: strings, numbers, booleans, and single or multi select enums, nothing nested. URL mode sends the user to a page the client never renders and never inspects, for interactions such as a third-party OAuth flow or a payment form; a server must use URL mode, never form mode, for passwords, API keys, tokens, or payment details. Every `ElicitResult` reports one of three actions: `accept` (with `content` for form mode), `decline`, or `cancel`. Before 2026-07-28, a URL mode elicitation also carried its own `elicitationId` and a server could send a `notifications/elicitation/complete` notification when the out-of-band step finished, together with an error code, `-32042`, for signaling that a URL elicitation was required. All three were removed: the ordinary requestState-carried retry that every MRTR exchange already uses is enough to let the server learn the outcome, so the extra machinery is gone.

```figure
mcpa-14-mrtr
```

## Interactive Lab

The figure lays the client and the server out as two lanes and follows one deploy attempt across both round trips. The first arrow is the ordinary `tools/call`; the reply ends that request with `input_required` instead of blocking; a note marks the gap where the client is away collecting the user's answer; the second arrow is a new, independent `tools/call` carrying `inputResponses` and the exact `requestState` string from the first reply; the last arrow is the ordinary `complete` result. Nothing crosses the gap except what the client chooses to send back, and no server-side memory bridges the two requests.

## Practice Lab

Open `code/main.py`. `DeployServer` exposes one tool, `deploy_release`, that always asks for confirmation before it runs, using form mode elicitation and an HMAC-protected `requestState` built from `hmac` and `hashlib` alone. `mint_request_state` signs a payload holding the principal, an expiry measured in the lesson's abstract clock ticks, and `digest_request`, a SHA-256 hash of the tool name and arguments. `verify_request_state` recomputes the signature with `hmac.compare_digest`, then checks the principal, the expiry, and the digest in turn, and finally checks that the token's nonce has not already been spent.

```bash
python3 code/main.py
```

Run it and look for six outcomes. A guest client that never declared the `elicitation` capability is refused immediately with `-32021`, before the server ever builds an `inputRequests` entry it could not use. Alice confirms a deploy and the retry completes with `structuredContent.deployed` true. Alice declines a different deploy and the retry still completes, `isError` false, because a decline is a normal outcome, not a failure; nothing gets deployed. Then come four deliberate negative examples, each wrapped in the transcript as a `violation` so the wire checker does not mistake a demonstration of broken input for a bug in the lesson: a retry whose `requestState` signature was flipped by one character, a retry that arrives after the state's short expiry, a retry from Mallory replaying a state the server minted for Alice, and a retry that keeps Alice's own valid state but changes the target environment out from under it. Every one of those four comes back as a tool execution error, `isError: true`, with a plain-language reason, the same channel an expired handle uses elsewhere in this track. The specification requires a server to reject state that fails verification but does not name the channel; this lab picks a tool execution error so the model can recover, and a server could equally answer with a fresh `input_required` result that asks again. A model reading that response can call the tool again for a fresh confirmation; it cannot fix a forged signature, but it can retry cleanly instead of getting stuck on an opaque failure.

## Shipped Artifact

`outputs/mrtr-implementation-checklist.md` is the one-page version: what a server must and must not do when it ends a call with `input_required`, how to protect `requestState`, what a client owes it in return, a table for choosing form mode against URL mode, and the traps worth rereading before the exam.

## Verify It

Run the tests from the lesson directory:

```bash
python3 -m unittest discover code/tests
```

They check the behaviors this lesson claims: a fresh call returns `input_required` with `inputRequests` and `requestState`; a retry with a new id and an accepted confirmation completes and records the deployment; the retry echoes `requestState` byte for byte; a decline completes without deploying anything; a tampered signature, an expired state, a state from another principal, and a state retargeted at different arguments are each rejected as a tool execution error; a redeemed state cannot be used a second time; a client without the `elicitation` capability never gets an `inputRequests` entry it could not answer; and a missing required argument is a tool execution error rather than a protocol error. The repository's wire checker validates the same transcript against the 2026-07-28 rules directly:

```bash
python3 scripts/check_mcpa_wire.py certifications/mcpa/lessons/14-multi-round-trip-requests-and-elicitation
```

## Capstone Connection

The capstone's single end-to-end exchange includes an MRTR elicitation for consent, protected with the same kind of `requestState` this lesson builds: bound to a principal, an expiry, and a digest of the request it belongs to, with a tampered attempt rejected as part of the walkthrough. Everything here, the four-step flow, the new-id rule, the exact echo, and the split between a protocol error and a tool execution error, is what that final scene assumes you already know cold.

## Key Terms

| Term | Meaning |
|------|---------|
| MRTR | Multi Round-Trip Requests: the pattern that ends a call with input_required instead of pushing a server-initiated request |
| InputRequiredResult | A result with resultType input_required, carrying inputRequests, requestState, or both |
| inputRequests | A map of server chosen keys to elicitation/create, sampling/createMessage, or roots/list requests |
| inputResponses | The client's retry field carrying answers keyed the same way as inputRequests |
| requestState | An opaque, server-minted string the client must echo exactly and never interpret |
| Form mode elicitation | In-band structured data collection validated against a flat requestedSchema |
| URL mode elicitation | Out-of-band interaction at a URL the client never inspects, required for sensitive data |
| ElicitResult action | One of accept, decline, or cancel, all normal outcomes a server must handle |
| Principal binding | Tying requestState to the authenticated caller so it cannot be replayed by someone else |
| Single use enforcement | A server-side check that a redeemed requestState's nonce cannot be spent twice |

## Further Reading

- [Multi Round-Trip Requests](https://modelcontextprotocol.io/specification/2026-07-28/basic/patterns/mrtr)
- [Elicitation](https://modelcontextprotocol.io/specification/2026-07-28/client/elicitation)
- [SEP-2322: Multi Round-Trip Requests](https://modelcontextprotocol.io/seps/2322-MRTR)
- [SEP-1036: URL Mode Elicitation for secure out-of-band interactions](https://modelcontextprotocol.io/seps/1036-url-mode-elicitation-for-secure-out-of-band-intera)
- `certifications/mcpa/research/mcp-2026-07-28-brief.md`, sections 7 and 11
- `phases/13-tools-and-protocols/12-mcp-roots-and-elicitation`, which walks through elicitation from the server author's side
