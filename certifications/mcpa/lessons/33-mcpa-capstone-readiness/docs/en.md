# Reading One MCP Exchange End to End

> A production incident does not announce which MCPA domain it belongs to. It hands you a transcript, and reading that transcript correctly, stage by stage, is the whole skill this certification tests.

**Type:** Capstone
**Languages:** Python
**Prerequisites:** Lessons 00 to 32
**Time:** ~60 minutes

## Learning Objectives

- Assemble one 2026-07-28 exchange that carries discovery with cache hints, a schema check, an MRTR consent round trip, a task, progress notifications, an OAuth audience check, and a hash chained audit log, and say what each stage defends against
- Tell a protocol error, a tool execution error, and a missing capability error apart on sight, and name the correct JSON-RPC code for each
- Trace one W3C trace id across every hop of a multi step exchange, including the single call that crosses onto HTTP and behind OAuth
- Verify a hash chained audit log and explain precisely what tampering with one entry does to every entry recorded after it
- Use the readiness checklist in outputs/ to confirm, objective by objective, that every domain this exam weighs maps to something concrete you did in this lesson's transcript

## The Problem

An on call engineer opens a console and reads two lines that do not match: a ticket claims `checkout-api` was restarted in production, and the incident channel says it was not. Nothing about that discrepancy announces itself as "an MRTR question" or "a Security and Governance question." Untangling it means reading one transcript end to end: was the restart request well formed, did the server ask for confirmation, did the confirmation actually come back signed and unaltered, did the caller hold a capability that let them see the question in the first place, and does the audit log agree with all of it. Every one of those checks belongs to a different domain on the MCPA blueprint, MCP Fundamentals, Architecture and Components, Interactions and Execution, Security and Governance, and Use Cases and Ecosystem, and the exam's hardest questions are built exactly like that discrepancy: a symptom, not a definition, with the answer sitting at a specific point on one exchange's timeline.

This lesson introduces no new protocol surface. It recomposes what lessons 00 through 32 covered one topic at a time into the single artifact a real system actually produces: one incident response workflow against one MCP server, correct where it should be correct and refused where it should be refused, with a reason attached to every refusal and a durable record of what happened. Treat it as a rehearsal for that exam question type, and as a rehearsal for the job the credential is actually certifying: operating a system where a tool call is never trusted by default and nothing about a peer is assumed until the peer has said so on the wire.

## The Concept

`code/main.py` plays out one incident against an `incident-console` server, and every stage maps onto a fact this track already taught, now seen working together instead of in isolation.

The transcript opens on protocol versioning, the lesson 04 and lesson 05 territory. A client accidentally configured for `2025-11-25` calls `server/discover` and gets back `UnsupportedProtocolVersionError`, code `-32022`, with `data.supported` naming every version the server actually speaks. There is no handshake to blame and no session that could have remembered the version from an earlier call: every request names its own protocol version in `params._meta`, so the fix is simply to ask again with the right one. The corrected `server/discover` returns a cacheable `DiscoverResult`: `supportedVersions`, `capabilities` (including `extensions: {"io.modelcontextprotocol/tasks": {}}`, declared up front so a client knows tasks are even possible before it tries one), `ttlMs`, and `cacheScope: "public"`, the same freshness contract lesson 20 built out in depth.

```json
{
  "jsonrpc": "2.0", "id": 2,
  "result": {
    "resultType": "complete",
    "supportedVersions": ["2026-07-28"],
    "capabilities": {"tools": {"listChanged": false}, "extensions": {"io.modelcontextprotocol/tasks": {}}},
    "ttlMs": 600000, "cacheScope": "public"
  }
}
```

`tools/list` and the first real call, a read only fleet scan, exercise architecture and interaction flow together: the schema each tool advertises is the only contract the client has, and a request for a tool the server never registered comes back `-32602`, not `-32601`, the single most exam tested distinction in the whole error taxonomy. `-32601` is reserved for a JSON-RPC method the server has genuinely never heard of, which this lesson also triggers once, on purpose, by misspelling `tools/call` as `tools/execute`. Because the scan's request set `_meta.progressToken`, the server answers with a short run of `notifications/progress` before the final result, unrelated to any subscription and gone the moment the request completes, exactly the request scoped channel lesson 16 separates from `subscriptions/listen`.

The `restart_service` sequence is where three domains meet in one tool. A call missing `environment` gets a normal result with `isError: true`, a tool execution error the model can read and correct, never a protocol error, because the request itself was legal JSON-RPC even though its arguments were not (lesson 08, lesson 18). A corrected call from a read only console that never declared the `elicitation` capability is refused with `-32021`, `MissingRequiredClientCapability`, naming exactly what was missing, because a server may never assume a capability a specific request did not declare (lesson 07). Only when both checks pass does the server open an MRTR round trip: `resultType: "input_required"`, an `inputRequests` map naming one `elicitation/create` call, and a `requestState` that is not a convenience string but an HMAC signed, principal bound, single use token (lesson 14, lesson 22). The retry must use a brand new JSON-RPC id and echo that `requestState` byte for byte:

```json
{
  "jsonrpc": "2.0", "id": 10, "method": "tools/call",
  "params": {
    "name": "restart_service",
    "arguments": {"service": "checkout-api", "environment": "production"},
    "inputResponses": {"confirm": {"action": "accept", "content": {"confirmed": true}}},
    "requestState": "eyJwcmluY2lwYWwiOiJhbGljZS1vbmNhbGwi...9f1c2a"
  }
}
```

This lesson also sends a deliberately broken version of that same retry, with one character of the signature flipped after the server issued it, wrapped in the transcript as a `violation` so the wire checker knows it is a worked counterexample rather than real traffic. The server's own HMAC verification rejects it with a tool execution error naming exactly what failed, which is what "protected" has to mean in practice: not merely present, but tamper evident.

`run_full_diagnostics` is where the tasks extension, lesson 21's subject, earns its keep. The very same tool call behaves differently depending on one thing only, whether that specific request declared `io.modelcontextprotocol/tasks` in `clientCapabilities.extensions`. Undeclared, it runs to completion synchronously and returns `resultType: "complete"` like any other tool. Declared, and only because the server also advertised the extension in `server/discover`, it returns `resultType: "task"` immediately, with a `taskId` the client polls through `tasks/get`. A poll for an unknown id is `-32602`; a poll that itself forgets to declare the extension is `-32021`, exactly the same capability rule applied to a different method. `tasks/cancel` on a second task is cooperative, an acknowledgement now and a `cancelled` status on the next poll, never a `notifications/cancelled`, which this revision reserves for tearing down a `subscriptions/listen` stream or, on stdio, cancelling one still open request.

One call in this transcript, `acknowledge_incident`, is different on purpose: it travels over Streamable HTTP, carrying `MCP-Protocol-Version`, `Mcp-Method`, and `Mcp-Name` headers that must agree with the JSON-RPC body underneath them, and it sits behind OAuth 2.1 rather than the environment credentials lesson 12's stdio examples rely on (lesson 19, lesson 23). A bearer token minted for a different resource server is rejected with `401` before the request ever reaches JSON-RPC handling, because audience validation is not optional and a server must never accept a token that was not issued for it. The identical call with a correctly scoped token succeeds. This is also the one place the lesson deliberately does not force OAuth onto every request: stdio SHOULD NOT run an OAuth flow at all, so mixing that model into the rest of the exchange would teach the wrong lesson about where authorization actually lives.

Underneath every one of those stages runs the same W3C `traceparent`, threaded through `_meta` on every request as one unbroken trace id with a fresh span at each hop, and the same hash chained audit log, one entry per decision, each entry's hash covering the entry before it (lesson 27). Edit one entry after the fact, in the version, the outcome, anything, and `verify()` fails starting at that exact index, because the entries after it were chained against a hash that no longer matches. That is what makes the log a record instead of a formatted print statement.

```figure
mcpa-33-capstone-flow
```

## Interactive Lab

The figure traces this same shape: discovery feeding a schema check, a schema check feeding MRTR consent, consent feeding a polled task, and a result, with the dashed line underneath standing for the one trace id that survives every hop, and the small chained boxes standing for the audit log that verifies at the end. Run the lab and read the printed lines against it in order.

```bash
python3 code/main.py
```

Watch for the four moments that decide the outcome of a call before any business logic runs: the `-32022` at the very top before the version is corrected, the `isError: true` for the missing `environment` argument, the `-32021` for the console that never declared `elicitation`, and the `input_required` result that only appears once both of those checks have already passed. Then watch the audit log print at the end, followed by `verify()` returning `True`, followed by one entry edited in place and `verify()` failing at that same index. Change which capabilities `alice`'s `run_full_diagnostics` call declares and predict, before rerunning, whether you will see `resultType: "task"` or an ordinary synchronous result.

## Practice Lab

Open a Python shell from `code/` and `import main`. Build a fresh server with `server = main.build_server()` and a client with `client = main.Client("alice-oncall", server)`. Call `restart_service` with `capabilities={}` and confirm you get `-32021` back, then add `capabilities=main.ELICIT_CAPS` and confirm the same call now returns `input_required`. Take the `requestState` out of that result, flip its last character the way the transcript does, and retry with it by hand: you should see an `isError` result whose text names a signature failure, not a silent success. Finally, create a task, poll it once, then reach into `server.audit.entries` and change one field on an entry you already recorded. Call `server.audit.verify()` before and after. The index it reports should be exactly the entry you touched, never the one before it and never the end of the list, because every entry after the edited one was hashed against a value that no longer exists.

## Shipped Artifact

`outputs/mcpa-readiness-checklist.md` is the exam eve document for this track: all 18 objectives from `certifications/mcpa/tracks/mcpa-f.json`, grouped by the five weighted domains, each one turned into a concrete thing you can point at, either in this lesson's transcript or in the earlier lesson that first taught it. Work through it once right after this lesson while the exchange is fresh, and once again the night before you sit the exam, when you want fast recall rather than fresh learning.

## Verify It

Run the tests from the lesson directory:

```bash
python3 -m unittest discover code/tests
```

They check the claims made above directly: every request in the transcript carries `_meta` with a protocol version and capabilities, an unknown tool is always `-32602` and an unknown method is always `-32601`, the schema invalid `restart_service` call is a tool execution error whose corrected retry reaches `input_required`, a caller without `elicitation` gets `-32021`, the accepted MRTR retry uses a new id and echoes `requestState` exactly, a tampered `requestState` is rejected, `run_full_diagnostics` only becomes a task when that specific request declares the extension, a task completes through polling and cancels cooperatively, `tasks/get` itself enforces the capability rule, a foreign audience token is rejected while a correctly scoped one succeeds, one trace id survives every hop that carries a `traceparent`, the audit log verifies and tampering is detected at the tampered index, and the transcript never uses a legacy method or a retired error code. The repository's wire checker validates the same transcript against the 2026-07-28 rules directly:

```bash
python3 scripts/check_mcpa_wire.py certifications/mcpa/lessons/33-mcpa-capstone-readiness
```

## Capstone Connection

Every domain on the blueprint shows up as a stage in this one exchange, not as a separate exercise. MCP Fundamentals is the version negotiation at the top and the stateless assumption underneath everything else, that no request may lean on what an earlier one established. Architecture and Components is the tool schema `restart_service` is checked against and the `tools/list` response `scan_fleet_health` was discovered through. Interactions and Execution is the entire error taxonomy this transcript exercises on purpose, `-32602` for an unknown tool, `-32601` for an unknown method, `-32021` for a missing capability, `isError: true` for bad arguments, `input_required` for consent, `task` for work that may outlive one request, and progress notifications scoped to the request that asked for them. Security and Governance is the HMAC signed `requestState`, the OAuth audience check that rejects a foreign token before it ever reaches JSON-RPC, and the hash chained audit log that turns "we log everything" into something you can actually verify. Use Cases and Ecosystem is the reason any of this matters outside a textbook: an on call console, a restart tool with a blast radius, a diagnostics job long enough to need a task handle, and an incident acknowledgement gated behind real authorization, which is what teams actually build behind MCP servers once they move past a demo.

What comes after this lesson is not another lesson. It is the readiness checklist, then the exam itself, then a system where this exchange is not a diagram to study but a dependency you are responsible for operating correctly.

## Key Terms

| Term | Meaning |
|------|---------|
| Protocol error | A JSON-RPC error for a malformed or unresolvable request, such as an unknown tool (`-32602`) or an unknown method (`-32601`) |
| Tool execution error | A normal result with `isError: true` that reports a problem the model can read and correct, such as a missing argument |
| MissingRequiredClientCapability | Code `-32021`, returned when a request needs a capability, such as `elicitation`, that request did not declare |
| MRTR | Multi Round-Trip Request: an `input_required` result followed by a retry with a new id, `inputResponses`, and the echoed `requestState` |
| requestState | Attacker reachable input returned inside an `input_required` result; when it drives authorization it must be signed, principal bound, and single use |
| Tasks extension | `io.modelcontextprotocol/tasks`; converts a `tools/call` into a durable, pollable `taskId` only when both sides declare it on that request |
| Canonical resource URI | The exact audience a server checks an OAuth access token against before honoring it; a token minted for a different audience is always rejected |
| traceparent | The W3C trace context field carried in `_meta`, one trace id per exchange with a new span id at each hop |
| Hash chained audit log | An append only record where each entry's hash covers the entry before it, so editing, inserting, or deleting an entry is detectable by recomputing the chain |

## Further Reading

- [MCP specification 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28), the full specification this exchange is built against
- [MCP architecture overview](https://modelcontextprotocol.io/docs/2026-07-28/learn/architecture), for the roles this transcript plays out
- [MCP changelog since 2025-11-25](https://modelcontextprotocol.io/specification/2026-07-28/changelog), for what the stateless core replaced
- `certifications/mcpa/research/mcp-2026-07-28-brief.md`, all sections, the protocol source of truth this whole track is built from
- `phases/13-tools-and-protocols/23-capstone-tool-ecosystem`, for a second, differently scoped build of a full tool ecosystem
- The MCPA certification page, at training.linuxfoundation.org/certification/model-context-protocol-associate-mcpa, for the exam's official format, timing, and domain weights
