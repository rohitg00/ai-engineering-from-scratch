# Telling a Modern MCP Server From a Legacy One

> Modern MCP has no opening handshake, so a client that must work with both current and older servers has to work out which kind it is talking to from how the very first exchange behaves, not from anything either side announces up front.

**Type:** Reference
**Languages:** Python
**Prerequisites:** Lesson 04
**Time:** ~45 minutes

## Learning Objectives

- Name the revision timeline from 2024-11-05 through 2026-07-28 and the headline change each revision made
- Define modern, legacy, and dual-era, and read the compatibility matrix for every combination of client era and server era
- Probe a server on stdio with `server/discover` and classify its response as modern, modern with a different version, or legacy, without keying the decision to one specific error code
- Explain how a client negotiates a version after an `UnsupportedProtocolVersionError` (code -32022) without performing a handshake
- State what 2026-07-28 removed outright, and why a server that only speaks modern versions still names its supported versions when it rejects an old connection attempt

## The Problem

Real deployments do not upgrade all at once. A client library gets built today and still has to talk to servers written months or years apart, some updated the day a new revision shipped and some left exactly as they were installed. The 2026-07-28 revision removed the one thing earlier revisions used to sort that out: an opening exchange that named a version before any real work began. Every modern request is now self-describing, which is exactly what makes the protocol stateless, but it also means there is no longer a dedicated moment where a client and server agree on ground rules.

So a client written to be useful across that spread of servers has a genuine problem to solve before it can be useful at all: given a connection it knows nothing about yet, decide, cheaply and reliably, whether the thing on the other end reads modern per-request metadata or expects to be greeted the old way. Guess wrong and the exchange fails in confusing ways: a modern server sees a method it does not recognize, or a legacy server tries to interpret a request that is missing everything it expects to find. This lesson is about making that decision on purpose, the way the specification defines it, rather than by accident.

## The Concept

The table below lists every named revision of the protocol and the change that defines it. Only the most recent one is modern; everything before it is legacy.

| Revision | Era | Headline change |
|---|---|---|
| 2024-11-05 | Legacy | First public revision: stdio and HTTP+SSE transports, plus the handshake that opened every connection. |
| 2025-03-26 | Legacy | Streamable HTTP replaces HTTP+SSE; OAuth 2.1 authorization; tool annotations; audio content. |
| 2025-06-18 | Legacy | Structured tool output; resource links; elicitation; OAuth resource server classification; the MCP-Protocol-Version header; JSON-RPC batching removed. |
| 2025-11-25 | Legacy | Icons; incremental scope consent; tool name guidance; URL mode elicitation; experimental tasks; validation errors become tool execution errors instead of protocol errors. |
| 2026-07-28 | Modern | Stateless core, no more handshake or sessions; adds `server/discover`, Multi Round-Trip Requests, `resultType`, and `subscriptions/listen`; moves tasks to an extension; deprecates roots, sampling, logging, and Dynamic Client Registration. |

Three words carry the rest of this lesson. **Modern** means a revision where version, identity, and capabilities travel as per-request metadata: 2026-07-28 and anything after it. **Legacy** means a revision that opens a connection with an `initialize` handshake and keeps state for a session: 2025-11-25 and everything before it. **Dual-era** describes an implementation, client or server, that supports both, with an explicit decision about which one it is dealing with before it parses anything else.

A dual-era client's whole job comes down to one probe. On stdio, before sending any request that matters, it sends `server/discover` carrying its preferred version in `_meta`, then reads what comes back:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32022,
    "message": "Unsupported protocol version",
    "data": {
      "supported": ["2026-07-28", "2025-11-25"],
      "requested": "1900-01-01"
    }
  }
}
```

Three outcomes, three conclusions. A `DiscoverResult` means the server is modern: pick a version from its `supportedVersions` and continue. A recognized modern error, the one shown above is `UnsupportedProtocolVersionError`, still means the server is modern, just not at the version the client tried first: retry with one of the versions listed in `data.supported`, using a fresh request id, and do not treat this as a reason to give up on the modern path. Anything else, an error the client does not recognize as one of the small set of modern error shapes, or no answer at all within a reasonable timeout, means the server is legacy: fall back to the legacy `initialize` handshake. The important discipline here is the third case. The fallback must never be keyed to one specific error code, because a legacy server has no obligation to answer an unfamiliar method the same way twice; it might reply with Method not found, with Invalid params, or simply hang. What identifies "legacy" is the absence of a recognizable modern answer, not the presence of any particular one.

On the Streamable HTTP transport the same idea takes a different shape, because modern servers also answer with `400 Bad Request` for several ordinary reasons: an unsupported version, a missing capability, a header that disagrees with the body. A dual-era client attempts a modern request first and, on a 400, reads the response body before deciding anything. A recognized modern JSON-RPC error in that body still means modern, so the client corrects the request or retries with a supported version rather than falling back. An empty body or one that does not parse as a recognized modern error means legacy, and the client falls back to the old handshake, and from there possibly further still to the deprecated transport that came before Streamable HTTP.

Era is a property of the server, not of any single request, so a client should cache the result for the life of the connection's process on stdio, or for the origin on HTTP, and can persist that assumption across restarts of the same configuration. If a cached assumption later turns out to be wrong, for example because the server was upgraded, the client is free to re-probe rather than trusting the stale answer forever.

There is one more rule worth knowing because it protects the users who benefit from it least: a server that only speaks modern versions should still name the versions it does support in any error it returns to an `initialize` request. That client has no fall-forward path of its own; the only diagnostic information it can show a person is whatever the server put in that one message.

2026-07-28 removed the whole legacy opening sequence, not just narrowed it. The `initialize` request and the `notifications/initialized` notification that used to follow it are gone. So are protocol sessions and the header that identified one, the standalone GET stream and the session teardown that went with it, and the two resource-watching methods now replaced by `subscriptions/listen`. A handful of session-scoped methods no longer have anywhere to live, stream resumability by event id is gone, and a server may no longer address the client except in a reply to something the client sent. None of these belong in a transcript that claims to be modern; if you ever need to show one for a compatibility example, mark it plainly as what it is.

```figure
mcpa-05-era-matrix
```

## Interactive Lab

The figure traces one probe into its three possible endings: a `DiscoverResult` box that leads straight to "use it," a recognized `-32022` box that leads to "retry with a supported version," and an "other error or timeout" box that leads to falling back. Notice that two of the three outcomes still count as modern. Only the third one changes what the client sends next.

## Practice Lab

Open `code/main.py`. `LEGACY_EXAMPLES` is set to `True` because this lesson has a legitimate reason to construct an old-style opening exchange: showing a dual-era client fall back to it, and showing a modern server reject it while naming its own versions. Every such message is wrapped as `{"legacy": true, "message": {...}}` in the transcript; every other message in the file is an ordinary modern request or result and is never wrapped.

```bash
python3 code/main.py
```

The demo builds four servers and probes each one with the same `DualEraClient`. `modern-server` supports only `2026-07-28`, so the first probe returns a `DiscoverResult` immediately. `modern-other-version-server` is a second, purely synthetic modern server invented for this lab, pinned to a made-up later version so you can watch the retry path: the first probe comes back `-32022`, and the client automatically retries with the version named in `data.supported`, never touching the fallback path at all. `legacy-error-server` answers an unrecognized method with a plain Method not found error, which the client correctly reads as legacy, and `legacy-timeout-server` never answers the probe at all, which the client also reads as legacy, proving the fallback does not depend on getting any particular error back. Probe `modern-server` a second time and compare the log length before and after: nothing new is sent, because the era was already cached. Last, watch `modern-only-server` reject an old-style opening request with an error that lists its own supported versions, exactly as a modern-only server should.

## Shipped Artifact

`outputs/era-compatibility-matrix.md` is a one-page reference: the revision timeline, the three era terms, the stdio and HTTP probe algorithms side by side, the full compatibility matrix for every client and server era pairing, and the handful of facts worth memorizing before the exam. Keep it next to you while building anything that has to survive contact with servers you did not write.

## Verify It

Run the tests from the lesson directory:

```bash
python3 -m unittest discover code/tests
```

They check the claims in this lesson: a `DiscoverResult` is read as modern, a recognized `-32022` triggers a retry rather than a fallback, an unrecognized error triggers a fallback, a timeout triggers the same fallback, a cached era is served without sending a new probe, a modern-only server names its versions when it rejects an old-style request, every legacy exchange in the transcript is wrapped, and no request id is ever reused across the whole run. The repository's wire checker validates the same transcript against the 2026-07-28 rules directly:

```bash
python3 scripts/check_mcpa_wire.py certifications/mcpa/lessons/05-protocol-eras-and-compatibility
```

## Capstone Connection

The capstone exchange in lesson 33 is written entirely in modern terms, with no probe anywhere in it, and that is only a safe thing to do because this lesson exists: somewhere upstream of that exchange, a client already ran the probe this lesson teaches and decided the connection was worth treating as modern. When you are asked to justify why a design can skip era detection, the answer is this lesson, not an assumption.

## Key Terms

| Term | Meaning |
|------|---------|
| Modern | A revision, 2026-07-28 or later, where version and capabilities travel as per-request metadata |
| Legacy | A revision, 2025-11-25 or earlier, that opens a connection with a handshake and keeps a session |
| Dual-era | An implementation that supports both eras, with an explicit decision before it parses anything |
| `initialize` (legacy) | The handshake that opened a legacy connection before 2026-07-28; gone in the modern era |
| `server/discover` | The request a dual-era client uses to probe a server's era on stdio |
| `DiscoverResult` | The response that identifies a server as modern and lists its supported versions |
| UnsupportedProtocolVersionError | Code -32022; a recognized modern error that triggers a retry, never a fallback |
| Era caching | Storing the probe's conclusion per server process or origin instead of probing every request |
| Compatibility matrix | The table of outcomes for every combination of client era and server era |
| 400 body inspection | On HTTP, reading a 400 response's body for a recognized modern error before assuming legacy |
| Modern-only rejection | A modern-only server naming its supported versions when it rejects an old-style opening request |

## Further Reading

- [Versioning and Compatibility](https://modelcontextprotocol.io/specification/2026-07-28/basic/versioning)
- [stdio transport, Backward Compatibility](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/stdio)
- [Streamable HTTP transport, Backward Compatibility](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http)
- [Inspector: Protocol eras](https://modelcontextprotocol.io/docs/2026-07-28/tools/inspector/protocol-eras)
- [2026-07-28 changelog](https://modelcontextprotocol.io/specification/2026-07-28/changelog), [2025-11-25 changelog](https://modelcontextprotocol.io/specification/2025-11-25/changelog), [2025-06-18 changelog](https://modelcontextprotocol.io/specification/2025-06-18/changelog), [2025-03-26 changelog](https://modelcontextprotocol.io/specification/2025-03-26/changelog)
- `certifications/mcpa/research/mcp-2026-07-28-brief.md`, sections 1 and 6
