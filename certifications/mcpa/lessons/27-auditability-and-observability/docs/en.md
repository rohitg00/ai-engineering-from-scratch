# One Trace ID Ties Auditability to Observability

> A trace id is the one value that follows a single call through a client, a server, and whatever that server calls next, and a hash chain is what lets you prove, months later, that the record of what happened has not been quietly edited.

**Type:** Reference
**Languages:** Python
**Prerequisites:** Lesson 26
**Time:** ~45 minutes

## Learning Objectives

- Propagate OpenTelemetry trace context, the `traceparent`, `tracestate`, and `baggage` keys, through `_meta` in the W3C formats SEP-414 defines, across a client, a server, and the upstream call that server makes on a caller's behalf
- Generate and validate a W3C `traceparent` value's four segments (version, trace id, parent id, flags) in lowercase hex, and derive a child span that keeps the trace id while minting a fresh parent id at every hop
- Explain why logging is deprecated in favor of `stderr` on stdio or OpenTelemetry for structured observability, and what a per-request log level still does despite that deprecation
- Build an audit record that names an authenticated principal instead of self-reported `clientInfo`, redacts a flagged argument before an entry ever exists, and correlates activity by request id and trace id
- Verify a hash-chained audit log, explain exactly where tampering surfaces and why, and treat a log without that property as a claim rather than as evidence

## The Problem

An account's API key gets rotated. The call that rotated it actually touched two programs: the service desk tool a support agent invoked, and the credential vault that tool asked, behind the scenes, to persist the new value. A month later a reviewer asks a plain question: prove this rotation happened, prove who asked for it, and prove that what you are showing me has not been edited since it was written. Two log files, one per service, each on its own clock and keyed by request ids that mean nothing outside their own process, do not answer that. They raise a second question before the first is even settled: how do you know these two lines describe the same event at all?

The risk and safety controls lesson built the layer that decides whether a call is allowed to happen at all: a pinned descriptor, a scan for an injected instruction, a rule against forwarding a credential upstream. None of that proves what actually ran. A control is a gate; a record is a memory. This lesson builds the memory: a value that threads a single request through every program it touches, and a log, kept independently by each of those programs, that a reviewer can trust was not rewritten after the fact.

## The Concept

MCP already answered half of this problem by accident. Because the protocol is stateless, a server cannot infer anything about a request from a shared connection, so every request already carries its own identity in `_meta`, a protocol version and a set of capabilities, the way the json-rpc-and-meta lesson first covered. The same block turns out to be exactly where a correlation id belongs too, and SEP-414 gives that id a name and a format instead of leaving every SDK to invent its own: `traceparent`, `tracestate`, and `baggage`, reserved as the one deliberate exception to `_meta`'s prefix rule so MCP stays compatible with the OpenTelemetry tooling that already reads those exact bare key names.

A `traceparent` value is four hyphen-separated segments, always lowercase hex, always the same lengths: a two-character version, a 32-character trace id, a 16-character parent id, and a two-character flags byte.

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "reset_api_key",
    "arguments": {"account_id": "acct-42", "new_key": "k-8f2c9e"},
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientCapabilities": {},
      "traceparent": "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01"
    }
  }
}
```

The trace id names the whole operation and never changes for its duration. The parent id names one span, one hop's worth of work, and a well-behaved participant never reuses somebody else's parent id as its own. When `ops-desk` receives that request and, to actually rotate the key, has to call `credential-vault`, it does not forward the traceparent unchanged: it mints a fresh parent id, keeps the same trace id, and sends that pair on as the outbound call's own `traceparent`.

```python
def child_traceparent(value):
    parsed = parse_traceparent(value)
    return make_traceparent(parsed["trace_id"], new_span_id(), sampled=parsed["flags"] != "00")
```

A trace id of all zeros or a parent id of all zeros is invalid on its face, the W3C format's way of catching a generator that never actually ran. `tracestate` and `baggage` behave differently: unlike the parent id, nothing about forwarding them requires a hop to change them, so this lesson's servers pass both straight through, the same value a caller set on the first call still visible, unmodified, at the last hop of the operation.

This is also where logging leaves the picture. Logging is deprecated as of this revision: a server that used to lean on `notifications/message` for visibility is expected to write to `stderr` on stdio or adopt OpenTelemetry for anything that needs to be structured. The mechanism does not vanish overnight. A request that still sets `io.modelcontextprotocol/logLevel` in its `_meta` may still receive `notifications/message` at or above that level, on that request's own response stream, and nowhere else. What logging never gave you, even at its most useful, is durability: it is a live feed a viewer either watches or misses, gone the moment nobody is looking. A trace id solves correlation. It does not by itself solve the reviewer's actual question, which is about a record that outlives the moment it was written.

That record is the audit entry, and it earns the name only if it answers five things: who, what, when, which channel the result came back on, and how to correlate it with everything else that happened in the same operation. Who is the authenticated principal, the identity a validated credential, such as a bearer token, actually resolves to, never the self-reported `io.modelcontextprotocol/clientInfo` a caller can set to anything it likes; that field was already flagged as display-only, never a security signal, back in the json-rpc-and-meta lesson. What is the method, the tool, and its arguments, with anything flagged as sensitive replaced by a fixed marker before the entry exists in any form, so the raw secret is never written down even once. When is a timestamp. The channel is whichever of the three the request actually ended on: a completed tool result, an `isError` tool execution result, or a JSON-RPC protocol error. Correlation is the request id, unique to one hop, paired with the trace id, shared by every hop of the same operation, so that `ops-desk`'s own log and `credential-vault`'s own log, two entirely separate hash chains kept by two separate programs, can still be read together by anyone who knows to look for a matching trace id.

The record only proves anything if it cannot be rewritten quietly, which is what the hash chain is for. Each entry stores the hash of the entry before it plus a digest of its own fields, so entries form a chain rather than a pile. Editing an entry's content without touching its stored hash is caught immediately: recomputing that entry's digest from its new content no longer matches what was recorded, and verification stops right there. A more careful edit, one that also recomputes and overwrites that one entry's own hash to match the tampering, still fails, just one entry later, because the next entry in the chain still stores the original hash as its own link backward, and that link no longer matches anything the tampered entry now produces. Covering the edit invisibly would mean rewriting every entry after it, in order, which is a different, much harder problem than editing one line. None of this stops a write, the way a permission check does; it only makes an unauthorized write detectable, which is exactly the property a reviewer asking "prove this was not edited" is actually asking for.

```figure
mcpa-27-trace-propagation
```

## Interactive Lab

The figure follows one `traceparent` from a client's call into `ops-desk`, across the hop into `credential-vault`, and back, with the trace id held constant while the parent id changes at each arrow. Underneath, two small ledgers stand for the two servers' independent hash chains, tagged with the same trace id though neither log ever touches the other's entries or hashes.

`code/main.py` builds exactly that pair of servers. `ops-desk` exposes `list_recent_grants`, a read-only call with nothing to redact, and `reset_api_key`, which flags its `new_key` argument and, to actually do the rotation, calls `credential-vault`'s `store_secret` through `ctx.call_upstream(...)`. Run it from the repository root:

```bash
python3 certifications/mcpa/lessons/27-auditability-and-observability/code/main.py
```

Read the wire messages first: the `reset_api_key` request's `traceparent` and the nested `store_secret` request's `traceparent` share the same 32-character trace id segment and differ only in the parent id. Then read the two audit logs it prints. `ops-desk`'s entry for `reset_api_key` shows `new_key` as a fixed marker while `account_id` stays readable, and `credential-vault`'s entry for `store_secret` redacts `secret` the same way, independently, because each server enforces its own redaction policy on its own log. Find the one `ops-desk` entry whose principal reads `unauthenticated`: that call carried a bearer token nobody issued, so no tool ever ran, yet the attempt itself is still on record. The last two lines call `verify()` on the clean `ops-desk` log, then tamper with its first entry's arguments in place and call `verify()` again; the result flips and names the entry where the chain actually broke.

## Practice Lab

Extend the chain one more hop. Give `credential-vault` its own `upstream` server, `key-escrow`, with one tool, `escrow_key`, that simply acknowledges receipt. Update `store_secret`'s handler to call `ctx.call_upstream("escrow_key", {"account_id": arguments["account_id"]})` before it returns, the same pattern `reset_api_key` already uses to reach `credential-vault`. Run the demo again and confirm three things in the wire log: the `escrow_key` request's `traceparent` carries the identical trace id as the original client call and `store_secret`, a fresh parent id, and a request id that collides with nothing else on the wire, because it still comes from the one shared `IdSequence`. Then call `verify()` on all three servers' logs, `ops-desk`, `credential-vault`, and `key-escrow`, and confirm each returns `(True, None)` independently, proving that three separate hash chains kept by three separate programs can still be tied to one operation by nothing more than a shared trace id.

## Shipped Artifact

`outputs/audit-and-telemetry-spec.md` is a one-page reference: the `traceparent` field layout with valid lengths and the all-zero rejection rule, the five fields an audit entry must carry, the redaction and hash-chain rules stated as checkable procedures, and the one-line reason `clientInfo` can never stand in for a principal. Keep it next to the risk and safety controls lesson's threat-control matrix; one names what is allowed to happen, the other proves what did.

## Verify It

Run the tests from the lesson directory:

```bash
python3 -m unittest discover code/tests
```

They check the claims in this lesson: a `traceparent` matches the W3C format and a malformed or all-zero one is rejected, a child span keeps its parent's trace id while minting a new parent id, `tracestate` and `baggage` reach the upstream call unchanged, a flagged argument is redacted in both servers' logs independently, the principal recorded is the token's subject rather than the caller's self-reported `clientInfo` name, an unauthenticated call is still logged before it is denied, a clean chain verifies, a naive edit is caught at the entry that changed, a more careful edit that also patches its own hash is still caught one entry later, and two entries in two different servers' logs correlate by trace id while their request ids differ. The repository's wire checker also validates the lesson's transcript against the 2026-07-28 rules:

```bash
python3 scripts/check_mcpa_wire.py certifications/mcpa/lessons/27-auditability-and-observability
```

## Capstone Connection

Lesson 33 assembles one exchange that exercises every domain, and its own checklist names two things this lesson builds directly: a trace id preserved end to end, and an audit chain that verifies. By the time that exchange reaches a tool call, it is already carrying a `traceparent` this lesson's format rules would accept, and whatever server handles it is expected to write an entry naming a real principal, not a display name, to a log a reviewer could actually check. Carry the field brief forward and be ready to point at a trace id crossing a hop, not just describe the idea of one.

## Key Terms

| Term | Meaning |
|------|---------|
| `traceparent` | The W3C-formatted `_meta` key carrying a version, trace id, parent id, and flags for one hop of a trace |
| Trace id | The 32-character hex value shared by every span of one operation, unchanged hop to hop |
| Parent id | The 16-character hex value naming one span; a new one is minted at every hop |
| `tracestate` | Vendor-specific trace state that propagates unchanged alongside `traceparent` |
| `baggage` | User-defined key-value context that propagates unchanged across every hop of a trace |
| Principal | The authenticated identity a validated credential resolves to, never a self-reported field |
| Redaction | Replacing a flagged argument with a fixed marker before an audit entry ever exists |
| Hash chain | Each entry's hash covering its own content plus the previous entry's hash, so an edited entry is detectable |
| Result channel | Which of a completed result, an `isError` result, or a protocol error a call actually ended on |
| Correlation | Joining records across separate logs by a shared trace id, even when their request ids differ |

## Further Reading

- [MCP specification 2026-07-28, Base Protocol](https://modelcontextprotocol.io/specification/2026-07-28/basic), for the `_meta` reserved keys and the OpenTelemetry trace context section
- [SEP-414, OpenTelemetry trace context in `_meta`](https://modelcontextprotocol.io/seps/414-request-meta)
- [Logging (deprecated)](https://modelcontextprotocol.io/specification/2026-07-28/server/utilities/logging)
- `certifications/mcpa/research/mcp-2026-07-28-brief.md`, sections 3, 11, and 13
- `phases/13-tools-and-protocols/20-opentelemetry-genai`, for the span hierarchy and `gen_ai.*` attributes a full tracing backend expects alongside this lesson's `_meta` propagation
