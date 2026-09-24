# Hosts, Clients, and Servers: MCP's Process Topology

> A host never talks to a server directly, only through one client per server. That single binding is where MCP draws its trust boundaries, and where a host aggregating many servers has to start resolving name collisions.

**Type:** Reference
**Languages:** Python
**Prerequisites:** Lesson 05
**Time:** ~45 minutes

## Learning Objectives

- Name the three participants of an MCP system, host, client, and server, and state what each one is responsible for
- Explain why a host embeds exactly one client per server connection instead of one client juggling several
- Tell a local stdio server from a remote Streamable HTTP server and explain which boundary each one's trust actually follows
- Match each server primitive, tools, resources, prompts, and completion, and each client feature to who controls it or who supplies it
- Aggregate the tools of several connected servers into one registry, resolve a name collision with a server-id prefix, and explain why a server's self-reported serverInfo.name is never the key to route on

## The Problem

Picture an assistant wired into three systems at once: a files server, a notes server, and a metrics service. Every one of those connections carries the same stateless request shape you already know from the stateless core and the era-negotiation work in the lessons before this one: each request stamps its own protocol version and capabilities, and no connection remembers anything between calls. What those earlier lessons did not answer is a different question: when a host is talking to three servers at once, who is talking to whom, and what happens when two of those servers describe themselves the same way or expose a tool with the same name.

A naive design flattens all three servers into one busy connection object that keeps track of which server sent what. That design has no clean place to say which server a result came from, no way to stop one server's declared capabilities from leaking into a call meant for another, and no way to tell two servers apart once you notice that both of them happen to call themselves "primary" in their own self-description. None of that is a corner case. Any host that connects to more than one MCP server has to solve it, and the specification's architecture solves it structurally rather than through discipline: fixed roles, one connection per pairing, and a naming rule for what happens when two independently written servers do not know about each other.

## The Concept

Three participants make up an MCP system, and each one has a narrow job. The **host** is the single application process the user is actually running: a chat assistant, an IDE, a batch pipeline. The host creates clients, controls which connections are allowed to exist, enforces consent before a tool runs, and aggregates whatever context its connected servers hand back. The host is the only party in the system that ever sees the full picture across every connected server.

A **client** is an object the host creates, and every client is scoped to exactly one server for the life of that connection. This is not a suggestion; it is how the architecture keeps servers from bleeding into each other. If the host needs a second server, it does not reuse the first client's connection, it creates a second client. A host with three active servers is a host with three client objects, each one wired to its own server, each one stamping the same per-request protocol version and capabilities you saw in the stateless core, and each one kept from ever seeing what the other two clients are doing. A client's other job is bookkeeping that never leaks into the wire: correlating request ids, tracking a server's declared capabilities, and knowing which server it is allowed to ask for a tool call.

A **server** is a separate program, and it can be **local** or **remote**. A local server is typically launched as a subprocess and reached over stdio, newline-delimited JSON-RPC with no header layer, so the whole message lives in `_meta`. A remote server is typically a long-running service reached over Streamable HTTP, one POST per message, with the protocol version repeated in a required header alongside the version already present in `_meta`. Trust follows whichever boundary a given server actually crosses. A local stdio server crosses a process boundary: it usually runs under the same user, reads credentials straight from the environment, and the specification says stdio implementations should not run an OAuth flow at all. A remote Streamable HTTP server crosses a network boundary: it is commonly operated by a different team or a different company, and it is the transport the authorization framework is built for, bearer tokens, protected resource metadata, audience validation. Neither boundary is stronger by default; they are just different boundaries, and a host should reason about each connected server against the boundary it actually crosses rather than treating "server" as one undifferentiated category.

The specification also states a design principle worth holding onto here: servers should not be able to read the whole conversation, and should not be able to see into each other. Every request a client sends carries only what that one request needs, never the host's full history, and the isolation between two connected servers is not a courtesy, it is enforced by the fact that they are different processes talking to different client objects that never compare notes.

Server primitives split by who is in control. **Tools** are model-controlled: the model decides when to call one, based on its name, description, and input schema. **Resources** are application-driven: the host decides which ones to fetch and place into context, and the resource itself is just a URI plus content. **Prompts** are user-controlled: a person explicitly picks a template rather than having the model reach for one on its own. A fourth server feature, **completion**, gives argument autocomplete for a prompt or resource template and follows the application, since it is the host deciding what to suggest as a user types. Client features run the other direction, a server asking the client for something. **Elicitation** lets a server request information from the user mid-call, delivered as an `input_required` result the client answers by retrying with `inputResponses`, and it is fully active in this revision. **Sampling** and **roots** are both deprecated as of 2026-07-28: sampling let a server ask the client to run a model completion on its behalf, and new servers should call an LLM provider's API directly instead; roots let a client advertise filesystem boundaries, and new servers should take a directory as a tool argument, a resource URI, or server configuration instead. Deprecated does not mean removed. Both still work, and the earliest either can be removed is a revision released on or after 2027-07-28.

Put several servers behind one host and a real design problem shows up: aggregation. Tool names only have to be unique within one server. Two servers that have never heard of each other can both expose a tool named `search`, and both can self-report the same `serverInfo.name` in their `server/discover` result, because that field is whatever the server operator chose to put there. A host that keys its aggregated registry on the self-reported name, or that lets the second `search` silently overwrite the first, has built something that routes a model's tool call to the wrong server without anyone noticing. The fix has two parts. First, key every entry in the registry, and every routing decision, on the connection identifier the host itself assigned when it connected, a config key, a slot index, anything under the host's own control, never on `serverInfo.name`. Second, when two servers declare the same tool name, keep the first one's name as the plain, canonical entry and expose the later collision under a server-id prefix, so both tools stay reachable under distinct names. The server that owns a tool still enforces its own errors regardless of how the host aggregated it: an unknown tool is still `-32602`, and a bad argument still comes back as a tool execution error, exactly as you saw before aggregation entered the picture.

```figure
mcpa-06-topology
```

## Interactive Lab

The figure shows one host process with three client boxes inside it, each one connected to its own server box on the right. Files and notes are drawn as local, stdio-transport servers, and both self-report the same `serverInfo.name`, "primary", on purpose. Metrics is drawn as a remote, Streamable HTTP server whose only declared capability is resources, not tools. Read the bottom of the figure: the registry keeps `search` pointed at files because files declared it first, and exposes the colliding `search` from notes as `notes/search`. Notice what never appears anywhere in that registry: the self-reported name "primary" that files and notes share. The host never asked either server what to call itself before deciding how to route.

## Practice Lab

Open `code/main.py`. It builds three servers with the standard library only, no network and no SDK, but the message shapes follow the 2026-07-28 schema exactly. `build_host()` connects a `Host` to `files`, `notes`, and `metrics` with three separate `Client` objects, one per server, then calls `build_registry()` to aggregate their tools.

```bash
python3 code/main.py
```

Read the printed output against the concept section above. The first block shows each connection's host-assigned id next to the server's self-reported name: files and notes both report "primary", proving the point that self-reported identity is not a safe key. The second block shows the aggregated registry: `search` maps to files, `notes/search` maps to notes, and nothing in the registry points at metrics, because metrics never declared a `tools` capability and the host never even sent it a `tools/list` request. The per-client exchanges that follow show every request's `_meta` block and every result's `resultType`, plus the last two entries: a routed call with a missing argument coming back as `isError: true`, and a direct call naming a tool the notes server does not have, coming back as JSON-RPC error `-32602`, both exactly as the two-error-channel rule from earlier lessons predicts.

Then change something and rerun. Add a fourth server whose `serverInfo.name` also collides with "primary" but whose host-assigned id is new, and confirm the registry still routes correctly by id. Or add a second colliding tool name between files and notes and confirm the prefix rule applies again without touching `Host.route`.

## Shipped Artifact

`outputs/architecture-roles-map.md` is a one-page reference: the three roles and what each is responsible for, a local-versus-remote comparison table, a server-features-versus-client-features table with who controls each one, and a six-step aggregation checklist ending in the rule that a receiving server still enforces its own errors no matter how the host aggregated the call. Keep it next to the stateless-core and protocol-eras references; together they cover how a request is built and how a host finds the right place to send it.

## Verify It

Run the tests from the lesson directory:

```bash
python3 -m unittest discover code/tests
```

They check the claims in this lesson: that each client stays bound to exactly one server object, that discovery runs independently per server so files, notes, and metrics each get their own capabilities, that a colliding tool name is disambiguated by a server-id prefix, that routing by canonical and prefixed name reaches the correct server, that the host never lists tools from a server that did not declare a tools capability, that two servers sharing one self-reported name still route independently, that an unknown tool on a specific server is still a protocol error, that a routed call with a missing argument is still a tool execution error, and that rebuilding the registry twice produces the same result. The repository's wire checker also validates the lesson's transcript against the 2026-07-28 rules:

```bash
python3 scripts/check_mcpa_wire.py certifications/mcpa/lessons/06-hosts-clients-and-servers
```

## Capstone Connection

The capstone asks you to describe a working MCP deployment end to end, and one of the first questions a reviewer asks is how many servers the host actually reaches and how a model-selected tool call ends up at the right one. Answer with this lesson's vocabulary: name each host-assigned connection id, name the server it is bound to, say whether that server is local or remote and which boundary its trust follows, and point at the registry entry that resolves any name collision. A capstone answer that reaches for a server's self-reported name to justify a routing decision has not learned this lesson yet.

## Key Terms

| Term | Meaning |
|------|---------|
| Host | The single application process the user runs; it creates and manages clients |
| Client | An object the host creates that is bound to exactly one server for the life of a connection |
| Server | A separate program, local (stdio) or remote (Streamable HTTP), that exposes tools, resources, and prompts |
| Local server | A subprocess reached over stdio; trust follows the process boundary |
| Remote server | A service reached over Streamable HTTP; trust follows the network boundary |
| Control model | Tools are model-controlled, resources are application-driven, prompts are user-controlled |
| Elicitation | A client feature that lets a server request input from the user through an MRTR round trip |
| serverInfo.name | A server's self-reported identity, for display and logging only, never a routing key |
| Server-id prefix | The disambiguation a host applies to a colliding tool name, such as `notes/search` |

## Further Reading

- [MCP architecture specification](https://modelcontextprotocol.io/specification/2026-07-28/architecture), for the normative host, client, and server roles and the design principles behind them
- [MCP architecture overview](https://modelcontextprotocol.io/docs/2026-07-28/learn/architecture), for the participants, transports, and a worked discovery example
- [Understanding MCP servers](https://modelcontextprotocol.io/docs/2026-07-28/learn/server-concepts), for the server-feature control model and multi-server examples
- [Understanding MCP clients](https://modelcontextprotocol.io/docs/2026-07-28/learn/client-concepts), for elicitation and the deprecated sampling and roots features
- `certifications/mcpa/research/mcp-2026-07-28-brief.md`, sections 4, 6, and 10
- `phases/13-tools-and-protocols/08-building-an-mcp-client`, for a from-scratch client that merges and routes tools across several peers
