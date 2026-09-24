# One Client, One Server: The Process Topology of MCP

> A host never talks to a server directly. It talks through a client, and every client answers to exactly one server, so one assistant can hold a dozen separate, mutually distrustful connections without any of them blurring together.

**Type:** Reference
**Languages:** Python
**Prerequisites:** Lesson 01, MCP Fundamentals
**Time:** ~45 minutes

## Learning Objectives

- Distinguish the responsibilities of a host, a client, and a server, and explain why a client holds exactly one connection to exactly one server
- Read the structured fields of an initialize request and response, including the protocol version and a server's declared capabilities object
- Explain why a host and a server run as separate processes, often separate trust domains, and what that separation is for
- Trace how a host that embeds multiple clients reaches multiple servers at once and routes a tool call to the right one
- Recognize a protocol version mismatch during the handshake as a reported error rather than a silent or crashing failure

## The Problem

Picture an assistant that needs to read local files, search the web, and query a ticket system, all in the same session. It is tempting to draw that as one arrow: the host talks to some servers. That picture hides the two questions the Architecture and Components domain actually tests: which process is which, and who is allowed to see what.

A design that flattens three servers into one connection has no clean place to ask which server a tool result came from, or whether to trust its output as much as the last one. If a single client multiplexed requests across three servers, a capability one server declared could bleed into a session with a server that never declared it, and a protocol version negotiated with one server could be silently applied to a different one that speaks an older release. None of that is hypothetical. It is exactly what the specification's connection model exists to rule out.

The fix is not a policy layered on top of MCP. It is built into the architecture itself: a client is scoped to one connection, a connection is scoped to one server, and a host that needs more reach embeds more clients. This lesson works through that topology field by field, from the process boundary down to the individual fields of the handshake that opens each connection.

## The Concept

Start with the host. A host is the single application process the user is running: an assistant, an IDE, a batch pipeline. Inside that one process, the host embeds one or more clients, and a client is a thin, stateful object whose entire job is to own a connection. That ownership is exclusive. A client holds exactly one connection to exactly one server for the life of that connection. If the host needs a second server, it does not reuse the first client's connection; it creates a second client. A host with five active servers is a host with five clients wired to five servers, not a single busy client juggling five conversations at once.

The server is a separate process. It might be a subprocess the host spawned over a local pipe, or a long-running service the host reaches over HTTP; either way, the server's code, its memory, and its failures are isolated from the host's own. That isolation is also, usually, a trust boundary: a server is frequently written by a different team or a different company than the host, so nothing the server returns is assumed safe by default. The process boundary and the trust boundary line up often enough that an MCPA candidate should treat them as the same fact until a specific design says otherwise.

Every connection opens with the same ritual: initialize. The client sends the protocol version it speaks; for this lesson, and for the exam, that version is `2026-07-28`. The server checks that version against its own and, on a match, responds with two structured pieces of data: a `serverInfo` object naming the server, and a `capabilities` object describing what that particular server supports, for instance whether it exposes tools, whether its tool list can change after the handshake, whether it offers resources or prompts. Nothing about that capabilities object is standard across servers; it is data the server declares for this connection, and a client that skips reading it is guessing at what it is allowed to call next. If the versions do not match, the server does not guess or silently coerce. It returns a structured error, and the client treats the connection as never having opened.

Multiply this by however many servers the host needs, and you get the shape this lesson names: one host process, several client objects inside it, each client wired to its own server process through its own negotiated connection. A user request that needs a file read and a web search is not one message. It is the host picking a tool by name, consulting a directory built from every connected server's own declared tools, and handing the call to the one client that owns the connection to the server that declared it. That directory is the structured data the Architecture and Components domain calls out by name, and it is the mechanism the next section's code builds and tests.

```figure
mcpa-02-process-topology
```

## Interactive Lab

The figure above draws the shape this lesson argues for: one host process, two client boxes inside its boundary, and two separate server processes, each reached through exactly one connection. Open `code/main.py` and run it. It builds a `Host`, connects two `MockClient` instances, one to a `files` server and one to a `search` server, and prints the negotiated protocol version and the capabilities object each server returned during its own `initialize` call. Watch that the two capabilities objects are not identical; each server declares its own, and a client only knows what a server can do because the server said so during the handshake.

After the two real connections, the demo attempts a third one against a server that speaks an older protocol version. Read the output: the server returns a JSON-RPC error naming the mismatch, the host does not add that connection to its roster, and the script keeps running and still exits cleanly. Then look at `host.tool_directory()` and `host.route_tool_call(...)` in the source; that is the piece that turns "the host is connected to two servers" into "the host knows exactly one place to send a named tool call."

```bash
python3 code/main.py
```

## Practice Lab

Add a third mock server to `code/main.py`, for example a `notes` server exposing a `save_note` tool, and wire a third client into the `Host` the same way the first two are wired in. Call `host.tool_directory()` again and confirm it now lists three entries, one per tool, each pointing at the server that actually declared it. Then call `host.route_tool_call("save_note", {...})` and confirm the result comes back from the new server, not from `files` or `search`.

Once that works, break it on purpose. Change the `protocol_version` on one server to a string other than `2026-07-28` and reconnect. Confirm the host receives a structured error instead of a crash, and that the server you broke never appears in `host.tool_directory()`. That is the same boundary the Security and Governance domain will ask you to reason about later: a connection that never negotiated cleanly gets no access at all.

## Shipped Artifact

`outputs/mcp-architecture-map.md` is a one-page reference for this domain: the roles restated for process topology, exactly what crosses a process boundary and why it is a trust boundary, and every field the `initialize` handshake carries in each direction. Keep it next to the field brief from Lesson 01; together they cover MCP Fundamentals and Architecture and Components, 30 percent of the exam blueprint between them.

## Verify It

Run the tests with `python3 -m unittest discover code/tests`. They assert the claims this lesson makes: that two connections are established independently, that each client is bound to exactly one server object and cannot drift to another, that a handshake echoes the negotiated protocol version and returns the connecting server's own capabilities, that a version mismatch comes back as a structured error rather than an exception, that the host routes a tool call to the server that actually declared the tool, and that an unrouted tool name fails the same structured way. If a test fails, trust the mock over this document; the code is what the audit script and the exam both hold you to.

## Capstone Connection

The capstone in Lesson 09 asks you to describe a working MCP deployment end to end, and the first thing a reviewer will ask is how many servers your host actually reaches and how you know a request went to the right one. Answer that with this lesson's vocabulary: name each client, name the server it owns a connection to, and point at the directory your host builds from discovery. A capstone answer that cannot draw its own version of the figure above is not ready yet.

## Key Terms

| Term | Meaning |
|------|---------|
| Host process | The single application process the user runs; it embeds one or more clients |
| Client | An object inside the host that owns exactly one connection to exactly one server |
| Server process | A separate program exposing capabilities; isolated from the host by process and often by trust |
| Capabilities object | The structured data a server returns in its initialize response, naming what it supports |
| Protocol version mismatch | A negotiation failure returned as a JSON-RPC error, not a silent coercion or a crash |
| Tool directory | The host's map from a discovered tool name to the server and client that own it |

## Further Reading

- Model Context Protocol specification, version 2026-07-28, at modelcontextprotocol.io/specification/2026-07-28, for the normative shape of initialize, capabilities, and the connection lifecycle.
- Phase 13's "Building an MCP Client" lesson, `phases/13-tools-and-protocols/08-building-an-mcp-client`, for a from-scratch client that owns a single connection end to end.
- The MCPA certification page, training.linuxfoundation.org/certification/model-context-protocol-associate-mcpa/, for the official domain weighting this lesson maps to.
- The `certifications/mcpa/research/source-verification-ledger.md` file in this repository, for the domain weights and sources behind this lesson's exam facts.
