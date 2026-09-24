# Deprecated, Not Removed: Roots, Sampling, and Logging

> Deprecated in MCP 2026-07-28 does not mean gone: roots, sampling, and logging still answer exactly as before, and only a twelve month clock has started.

**Type:** Reference
**Languages:** Python
**Prerequisites:** Lesson 14
**Time:** ~45 minutes

## Learning Objectives

- Tell a Deprecated feature from a Removed one under the MCP feature lifecycle, including the twelve month minimum window and how earliest removal is computed
- Trace how roots and sampling now travel as MRTR input requests, gated by a client capability the caller must declare on that request
- Explain why logging moved to a per-request `io.modelcontextprotocol/logLevel` key, and when a server may or may not send `notifications/message`
- State the migration path for each deprecated feature: roots, sampling, logging, Dynamic Client Registration, scoped `includeContext`, and HTTP+SSE
- Recognize the small set of methods 2026-07-28 actually deleted, such as `logging/setLevel` and `notifications/roots/list_changed`, and explain why a stateless core could not keep them

## The Problem

A candidate who treats "deprecated" as a synonym for "gone" will miss a predictable slice of MCPA questions, and one who treats it as "permanent scaffolding, ignore it" will miss a different slice. MCP 2026-07-28 deprecated three whole client-facing features at once, roots, sampling, and logging, while, in that same revision, deleting a much smaller and different set of methods outright. The two lists do not overlap, and the exam leans on that gap. A tool call that opens an `input_required` result asking for `roots/list` or `sampling/createMessage` is completely ordinary 2026-07-28 wire traffic today, months or years before either feature could legally disappear. A request that still tries `logging/setLevel` gets a flat "method not found," because that particular message depended on a connection wide session the stateless core does not have anymore. Knowing which bucket a name falls into, and why, is the actual skill this lesson builds.

## The Concept

Every feature in the MCP specification sits in exactly one of three lifecycle states: Active, Deprecated, or Removed. Active means implement it per its normative text, same as anything else in the current revision. Deprecated means the feature is still fully in the specification and still fully functional, but a Core Maintainer decision has scheduled it for eventual removal, and a migration path is already published. Removed means the feature is gone from the draft specification and absent from the next Current revision, though it stays documented in whichever Final revision last carried it. A Deprecated feature carries a minimum twelve month window, measured from the release of the revision that first marks it Deprecated, before it is even eligible for removal; the actual removal date is a separate Core Maintainer decision made later, during release preparation, and can land well after the window closes, or never. Roots, Sampling, and Logging became Deprecated the moment the 2026-07-28 revision shipped, under SEP-2577, so their earliest removal is the first specification revision released on or after 2027-07-28, not that exact calendar date and not the next revision that happens to ship.

SEP-2577 grouped these three because each showed the same pattern: low real-world adoption against a real implementation cost. Roots gives a server informational directory hints that it is never required to honor, and few clients ever implemented the picker UI. Sampling lets a server borrow the client's model access, but doing it correctly needs human-in-the-loop review, model selection logic, and, since 2025-11-25, a full tool loop, and adoption stayed thin regardless. Logging duplicates infrastructure every runtime already has: `stderr` on stdio transports, OpenTelemetry everywhere else. None of the three touch the resource, tool, or prompt model that actually defines MCP, so deprecating them narrows the implementation surface without narrowing what the protocol is for.

Both roots and sampling kept their exact wire shape; only the delivery mechanism changed. Before 2026-07-28, a server sent `roots/list` or `sampling/createMessage` straight to the client as a server-initiated request on the open connection. The stateless core removed that connection entirely, so both requests now travel the same way every other server-to-client ask does: as an entry inside an `InputRequiredResult`'s `inputRequests` map, answered on a retry that carries a new JSON-RPC id, the same multi round-trip pattern that replaced every server push.

```json
{
  "jsonrpc": "2.0",
  "id": 4,
  "result": {
    "resultType": "input_required",
    "inputRequests": {
      "workspace_roots": {"method": "roots/list"},
      "workspace_summary": {
        "method": "sampling/createMessage",
        "params": {
          "messages": [
            {"role": "user", "content": {"type": "text", "text": "Summarize this workspace in one sentence."}}
          ],
          "maxTokens": 100
        }
      }
    },
    "requestState": "summarize-workspace:v1"
  }
}
```

Neither entry is legal unless the client declared the matching capability, `roots: {}` or `sampling: {}`, in `io.modelcontextprotocol/clientCapabilities` on that same request. A server that needs one anyway has to refuse with `-32021` and list what it needed in `data.requiredCapabilities`, the identical capability gate that governs every other feature a server cannot assume. The client answers by retrying the original request with a brand new id, `params.inputResponses` keyed the same as `inputRequests`, and `params.requestState` echoed back byte for byte, never invented.

Sampling requests can still carry `includeContext`, but its `"thisServer"` and `"allServers"` values are separately deprecated too, an older notice folded into the same lifecycle registry under a different SEP. The field defaults to `"none"` regardless, so the simplest correct move is to omit it rather than reach for a deprecated value on purpose.

Logging deprecated differently, because the feature name covers two distinct pieces of wire behavior, and only one of them survived. The part that survives is per request: a client adds `io.modelcontextprotocol/logLevel` to a single request's `_meta`, and the server may answer with `notifications/message` at or above that severity, only on that request's own response stream, only before the final result, and never at all when the key is absent from that request.

```json
{
  "jsonrpc": "2.0",
  "method": "notifications/message",
  "params": {
    "level": "warning",
    "logger": "diagnostics",
    "data": {"message": "cache subsystem degraded"}
  }
}
```

The part that did not survive is the ambient one: a client used to send `logging/setLevel` once, and every later message on that connection inherited the level until changed again. That only made sense when a connection held state between requests. The stateless core has nothing to hang a connection-wide level on, so `logging/setLevel` is not merely Deprecated, it is gone: a modern server has no handler for it at all and answers `-32601`, Method not found, exactly like any other unrecognized method name, not a tool execution error and not `-32602`.

Two more items share the deprecated registry with roots, sampling, and logging. Dynamic Client Registration yields to Client ID Metadata Documents (a later lesson covers the full registration decision in depth). The HTTP+SSE transport from the first public revision yields to Streamable HTTP. Both follow the same rule as everything else here: still specified, still legal to encounter, running on the same kind of clock. The exam's favorite trap is collapsing that whole list into "removed." It is not. What 2026-07-28 actually removed is a short, different list: the `initialize` handshake and `notifications/initialized`, `Mcp-Session-Id` and the session-scoped HTTP endpoints, `ping`, `resources/subscribe`, `logging/setLevel`, `notifications/roots/list_changed`, `Last-Event-ID` and SSE resumability, every server-initiated request outside MRTR, `tasks/result` and `tasks/list`, and the URL-mode elicitation fields tied to `notifications/elicitation/complete`. None of those sit on the deprecated registry, because a registry entry, by definition, describes something still there to migrate away from.

One more asymmetry is worth naming, because it explains why `notifications/roots/list_changed` specifically disappeared while roots itself did not. That notification told a server the client's exposed roots had changed, a push traveling client to server. MRTR replaced every server-initiated push with a request-and-retry pattern, and the only listening channel 2026-07-28 kept is `subscriptions/listen`, which a client opens toward a server, never the reverse. Once there was no channel left for a client to push anything unsolicited to a server, the change notification had nowhere to travel, deprecated or not, so it left with the connection model that carried it.

```figure
mcpa-15-deprecation-timeline
```

## Interactive Lab

The figure lays a timeline across the 2026-07-28 release date and the earliest removal date one year later, with a lane each for roots, sampling, and logging: a solid bar from deprecation to today, easing into a dashed bar past the earliest-removal marker, because eligible for removal is not the same as scheduled for removal. Below it, two short columns contrast what still answers on the wire, `roots/list`, `sampling/createMessage`, and a per-request `logLevel` paired with `notifications/message`, against the two names that are simply gone, `logging/setLevel` and `notifications/roots/list_changed`. Trace a lane past the removal marker and the bar keeps going, because Core Maintainers, not a calendar, decide the actual removal date.

## Practice Lab

Open `code/main.py`. `advise_migrations` is the migration advisor from the lab brief: hand it a server's capabilities and a client's capabilities, and it reports every deprecated feature either side is using, each with its SEP, its migration path, and its earliest removal date computed by `add_months` from the twelve month window. The `Server` behind it exposes two tools. `summarize_workspace` needs both roots and sampling: a client that declares neither gets `-32021` back immediately with the missing capabilities named; a client that declares both gets an `input_required` result with `workspace_roots` and `workspace_summary` entries, answers them, and retries with a new id and the exact `requestState` echoed back for a completed result. A retry that echoes the wrong `requestState` is rejected. `run_diagnostic` needs no capability at all: called without a log level it stays silent, called with `logLevel: "info"` it emits `notifications/message` for its info and warning events but skips its debug one, and called with an unrecognized level it returns `-32602`.

```bash
python3 code/main.py
```

Read the last block of output: a wrapped, clearly labeled legacy exchange sends `logging/setLevel` to the very same server and gets `-32601` back, method not found, the concrete difference between a feature that is still there and one that is not.

## Shipped Artifact

`outputs/deprecation-migration-guide.md` is a one-page reference: what Deprecated means under the lifecycle policy, a table of the three SEP-2577 features next to Dynamic Client Registration and HTTP+SSE, the short list of names actually removed by 2026-07-28, and the shorter list of deprecated names that still pass a wire checker unwrapped today.

## Verify It

Run the tests from the lesson directory:

```bash
python3 -m unittest discover code/tests
```

They check the claims in this lesson: that roots, sampling, and logging are each flagged with a migration path and a correctly computed earliest removal date, that a capability set with nothing deprecated reports no findings, that `summarize_workspace` refuses an undeclared capability with `-32021` and otherwise opens a proper MRTR round trip that a retry completes with a new id and an echoed `requestState`, that a mismatched `requestState` is rejected, that `run_diagnostic` stays silent without a log level, emits only at or above the requested severity with one, rejects an unrecognized level, and that the wrapped legacy example shows a truly removed method answered `-32601` by a modern server. The repository's wire checker also validates the lesson's transcript against the 2026-07-28 rules:

```bash
python3 scripts/check_mcpa_wire.py certifications/mcpa/lessons/15-deprecated-client-features
```

## Capstone Connection

The capstone's end-to-end exchange assumes a candidate can tell a Deprecated feature from a Removed one on sight: it leans on MRTR for consent the same way this lesson leans on it for roots and sampling, and it never reaches for `initialize` or `logging/setLevel` while assembling its transcript. The migration advisor built here is also the shape a later policy engine and an audit pipeline both reuse: inspect a capability set or a wire record, and report what needs to change before a deadline that is a window, not a fixed date.

## Key Terms

| Term | Meaning |
|------|---------|
| Active | A feature fully specified and required by the current revision |
| Deprecated | A feature still specified and functional, with a migration path and a minimum twelve month window before removal is even possible |
| Removed | A feature deleted from the draft specification and absent from the next Current revision |
| Earliest removal | The first specification revision released on or after a feature's deprecation window elapses |
| Roots | A deprecated client feature offering directory hints to a server, now requested as an MRTR input request |
| Sampling | A deprecated client feature letting a server borrow the client's model access, now requested as an MRTR input request |
| `io.modelcontextprotocol/logLevel` | The per-request `_meta` key that opts a single request into receiving `notifications/message` |
| `notifications/message` | A log notification a server may send only on the response stream of a request that set `logLevel` |
| `logging/setLevel` | A removed, connection-wide log level setter with no place left in a stateless core |
| SEP-2577 | The proposal that deprecated roots, sampling, and logging together in the 2026-07-28 revision |

## Further Reading

- [Roots (deprecated)](https://modelcontextprotocol.io/specification/2026-07-28/client/roots)
- [Sampling (deprecated)](https://modelcontextprotocol.io/specification/2026-07-28/client/sampling)
- [Logging (deprecated)](https://modelcontextprotocol.io/specification/2026-07-28/server/utilities/logging)
- [Deprecated features registry](https://modelcontextprotocol.io/specification/2026-07-28/deprecated)
- [Feature lifecycle and deprecation policy](https://modelcontextprotocol.io/community/feature-lifecycle)
- `certifications/mcpa/research/mcp-2026-07-28-brief.md`, sections 11 and 15
- `phases/13-tools-and-protocols/11-mcp-sampling`, which builds the sampling migration path in depth
