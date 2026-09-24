# Discovering a Server and Negotiating What It Can Do

> A server describes itself once through `server/discover`, but every request still declares its own capabilities: nothing the server needs is assumed just because a client asked what was available.

**Type:** Reference
**Languages:** Python
**Prerequisites:** Lesson 06
**Time:** ~45 minutes

## Learning Objectives

- Read a `server/discover` request and its `DiscoverResult`: `supportedVersions`, `capabilities`, `instructions`, `serverInfo`, `ttlMs`, `cacheScope`
- Explain why implementing `server/discover` is mandatory for a server while calling it stays optional for a client
- Read the shapes of `ServerCapabilities` and `ClientCapabilities` and say what each flag promises
- Explain why a server must not rely on a capability the client did not declare on that specific request, and what `MissingRequiredClientCapabilityError` (`-32021`) carries
- Walk a version-negotiation retry from `UnsupportedProtocolVersionError` (`-32022`) through a client picking a mutually supported version

## The Problem

Lesson 06 gave a host one client per server and a clear split of responsibilities, but it left an open question: the first time a client talks to a server it has never seen, how does it learn what that server is and what it can do, without a setup conversation to ask? The stateless core from lesson 04 already ruled out an `initialize` handshake and a session that remembers the answer. Every request still has to be self-describing.

That cuts both ways. A client needs a fast way to learn a server's identity, its supported protocol versions, and the shape of what it offers, ideally in one round trip rather than probing `tools/list`, `resources/list`, and `prompts/list` separately just to build a picture. And a server, precisely because it cannot lean on connection state, cannot assume that because a client asked what elicitation or sampling support looks like five requests ago, that same client is still willing and able to handle an elicitation request on this call. The two problems, learning what a server offers and proving what a client can currently accept, sound similar but run in opposite directions, and 2026-07-28 solves them with two different mechanisms that are easy to conflate if you only skim the field names.

## The Concept

`server/discover` is the first mechanism. A server **MUST** implement it; a client **MAY** call it, or skip straight to whatever request it actually wants and handle a version mismatch if one comes back. The request carries nothing beyond the standard `_meta`:

```json
{
  "jsonrpc": "2.0",
  "id": "discover-1",
  "method": "server/discover",
  "params": {
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientCapabilities": {}
    }
  }
}
```

The result, a `DiscoverResult`, is a `CacheableResult`, so it always carries `ttlMs` and `cacheScope` alongside its own fields: `supportedVersions` (the list the client should choose from for later requests), `capabilities` (a `ServerCapabilities` object), and an optional `instructions` string, natural-language guidance for the model, not a duplicate of tool descriptions. The server's own identity travels in `result._meta["io.modelcontextprotocol/serverInfo"]`, a name and version the server reports about itself. That field is a courtesy, not a credential: use it for display, logs, and debugging, and never let it drive an authorization or trust decision, because nothing in the protocol verifies it.

`ServerCapabilities` lists what a server offers as a set of flags: `tools {listChanged}`, `resources {listChanged, subscribe}`, `prompts {listChanged}`, `completions {}`, `logging {}` (deprecated, still present, covered in depth once you reach lesson 15), and `extensions {}` (a map of extension identifiers to settings objects, the subject of lesson 30). An empty object for a capability like `completions` means "supported, no extra settings to report." A missing key means the server does not offer that primitive at all. `ClientCapabilities` is the mirror image, describing what a client can accept: `elicitation {form, url}` for the two modes covered in lesson 14, `sampling` and `roots` (both deprecated, migration paths in lesson 15), and `extensions {}`. Two shapes, same naming rules, opposite direction of travel.

Here is the part that trips up a reader who has only skimmed the field names: `DiscoverResult.capabilities` is what the *server* can do, reported once, cacheable, and safe to reuse until the `ttlMs` hint goes stale. It says nothing about what a *client* can currently accept. That is a separate, per-request fact, carried in `_meta["io.modelcontextprotocol/clientCapabilities"]` on every single request, discover or otherwise. A server that needs to use a client capability, for example asking a form-mode elicitation question in the middle of handling a tool call, must check the `clientCapabilities` on *that specific request*, never a value it remembers from an earlier discover call or an earlier `tools/call`. This is statelessness from lesson 04 applied directly to capabilities: no inference from prior requests, ever, even on the same connection.

When a server needs a capability the current request did not declare, it returns `MissingRequiredClientCapabilityError`:

```json
{
  "jsonrpc": "2.0",
  "id": 7,
  "error": {
    "code": -32021,
    "message": "notify_oncall requires a capability this request did not declare",
    "data": {
      "requiredCapabilities": {
        "elicitation": {}
      }
    }
  }
}
```

`data.requiredCapabilities` is shaped exactly like `ClientCapabilities`, naming the categories that were missing so the client can retry with them declared, not guess. On HTTP the status code for this error is `400 Bad Request`.

Version selection is the other half of negotiation, and it is not tied to discovery at all: any request can trigger it. If a request names a protocol version the server does not implement, the server must reject it with `UnsupportedProtocolVersionError`:

```json
{
  "jsonrpc": "2.0",
  "id": 8,
  "error": {
    "code": -32022,
    "message": "Unsupported protocol version",
    "data": {
      "supported": ["2026-07-28"],
      "requested": "2025-11-25"
    }
  }
}
```

The client should pick a version out of `data.supported` and retry the same request with a new id. Notice what this is not: requesting an older, real revision string through the modern `_meta` shape is not the same as being a legacy client. A legacy client sends an `initialize` request instead of per-request metadata; that is an era, defined by message shape, not a version number. A modern-only server that receives an actual `initialize` request from a legacy client should still name its supported versions in whatever error it sends back, the only diagnostic a legacy client can show its user, the same discipline lesson 05's era model expects everywhere.

```figure
mcpa-07-discover
```

## Interactive Lab

The figure separates the two mechanisms visually. The top lane shows `server/discover`: optional for the client, a single round trip that returns supported versions, capabilities, instructions, and cache hints together. The bottom lane shows what happens on every `tools/call`, whether or not discovery ever ran: the request's own `clientCapabilities` is checked fresh. Declare nothing and the tool that needs elicitation comes back `-32021`, naming exactly what was missing. Declare it, on that request, and the same call completes. Nothing about the first successful discover call carries forward into the second lane.

## Practice Lab

Open `code/main.py`. `DeployServer` implements `server/discover` and one gated tool, `notify_oncall`, whose definition says it requires the `elicitation` capability before it will run, plus an ungated tool, `list_incidents`, that needs nothing extra.

```bash
python3 code/main.py
```

Read the printed exchanges in order. The first pair is a plain `server/discover`, returning `supportedVersions`, `capabilities`, `instructions`, and cache hints. The second pair calls `notify_oncall` with `clientCapabilities: {}` and gets back `-32021` with `data.requiredCapabilities` naming `elicitation`. The third pair repeats the same call, this time with `elicitation` declared in that request's `_meta`, and it completes normally. The fourth pair calls a tool name the server does not have, `close_all_incidents`, which is a protocol error, `-32602`, not a capability problem. The last two pairs show version negotiation: a `server/discover` asking for `2025-11-25` comes back `-32022` naming `["2026-07-28"]` as `data.supported`, and the client's next call picks that version and succeeds, with a new request id. Try declaring `elicitation` once and then dropping it on a later call; the server refuses again, because it never remembered the earlier declaration.

## Shipped Artifact

`outputs/capability-negotiation-cheatsheet.md` collects the `DiscoverResult` field table, the `ServerCapabilities` and `ClientCapabilities` shapes side by side, the `-32021` and `-32022` data shapes, and a short retry checklist, all citing the brief.

## Verify It

Run the tests from the lesson directory:

```bash
python3 -m unittest discover code/tests
```

They check that `server/discover` returns `supportedVersions`, a full `capabilities` object, `instructions`, and cache hints; that a call missing a required capability comes back `-32021` naming it; that declaring the capability on the retrying request lets the call complete; that a tool needing nothing extra never has to declare anything; that an unknown tool is `-32602` while an unknown method is `-32601`; that a version mismatch names both `supported` and `requested`; that the client's retry uses a new id; and that a request missing `_meta` entirely is rejected. The repository's wire checker validates the same transcript against the 2026-07-28 rules directly:

```bash
python3 scripts/check_mcpa_wire.py certifications/mcpa/lessons/07-discovery-and-capability-negotiation
```

## Capstone Connection

The capstone's opening move is a `server/discover` call that returns cache hints the rest of the exchange respects, followed by a tool call that only succeeds because the client declared the right capability on that specific request, then an MRTR elicitation exchange gated on exactly that declaration. Every step rests on the split this lesson draws: discovery describes the server, once, cacheably; capability declaration describes the client, on every request, freshly.

## Key Terms

| Term | Meaning |
|------|---------|
| `server/discover` | The request a server must implement to advertise its versions, capabilities, and identity |
| `DiscoverResult` | The cacheable result of discovery: `supportedVersions`, `capabilities`, optional `instructions`, `ttlMs`, `cacheScope` |
| `ServerCapabilities` | What a server offers: tools, resources, prompts, completions, logging, extensions |
| `ClientCapabilities` | What a client can accept on a request: elicitation, sampling, roots, extensions |
| `serverInfo` | The server's self-reported name and version, for display and logging, never for security decisions |
| `MissingRequiredClientCapabilityError` | `-32021`, returned when a request needs a capability its own `clientCapabilities` did not declare |
| `UnsupportedProtocolVersionError` | `-32022`, returned with `data.supported` and `data.requested` when a request names a version the server does not implement |
| Per-request negotiation | The rule that capability and version facts are read from the current request only, never inferred from an earlier one |

## Further Reading

- [Discovery: server/discover](https://modelcontextprotocol.io/specification/2026-07-28/server/discover)
- [Versioning and Compatibility](https://modelcontextprotocol.io/specification/2026-07-28/basic/versioning)
- [Base protocol overview and the _meta rules](https://modelcontextprotocol.io/specification/2026-07-28/basic/index)
- [Schema reference: DiscoverResult, ClientCapabilities, ServerCapabilities](https://modelcontextprotocol.io/specification/2026-07-28/schema#discoverresult)
- `certifications/mcpa/research/mcp-2026-07-28-brief.md`, section 6
