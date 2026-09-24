# The Integration Problem MCP Solves

> Every system you connect to an AI application is a contract. MCP makes that contract the same shape everywhere, so one client can use a server it has never seen before.

**Type:** Reference
**Languages:** Python
**Prerequisites:** Lesson 01
**Time:** ~45 minutes

## Learning Objectives

- Explain the N times M integration problem and how one shared protocol reduces it to N plus M
- State what MCP standardizes between AI applications and external systems, and what it deliberately leaves out
- Name the participants of an MCP system and the three server primitives in one sentence each
- Read a discovery request, a tool list, and a tool call as ordinary JSON-RPC messages carrying per-request metadata
- Tell a protocol error from a tool execution error and explain why the difference matters to the model

## The Problem

Connecting an AI application to an outside system used to mean writing glue. An assistant that needed your files, your ticket queue, and your database needed three integrations, and each one invented its own way to describe what it could do, its own argument format, its own error shape, and its own idea of who was allowed to call it. A fourth system meant a fourth integration. A second AI application meant writing all of them again, because nothing written for the first one fit the second.

That is an N times M problem. Four applications and six systems cost twenty-four integrations, and every one of them is a place where the format drifts and the security assumptions blur. The expensive part is not the first integration. It is the twentieth, and the review that has to reason about all twenty at once.

The Model Context Protocol turns N times M into N plus M. Each application learns to speak MCP once. Each system exposes an MCP server once. Any modern client can then use any modern server, because both sides agree on one message format, one way to describe capabilities, and one way to call a tool and read what comes back. Four applications and six systems now cost ten implementations, and each new system adds one.

## The Concept

MCP is a protocol, not a product. It standardizes the conversation between an AI application and the systems that give it context and let it act: how a server describes itself, how a client asks what the server offers, how a tool is invoked, and how results and errors come back. It deliberately does not standardize the model, which model a host uses, how the host builds its prompt, or what the user interface looks like. Those stay the application's decisions.

The participants are few. The **host** is the application the user works in, such as a chat assistant or an editor. Inside the host, a **client** manages the conversation with one **server**, and a host runs one client per server it uses. A server exposes three kinds of **primitives**. **Tools** are named, described, schema-typed actions the model can decide to invoke. **Resources** are readable data, identified by URIs, that the application chooses to place in context. **Prompts** are reusable templates the user picks explicitly. Who is in control differs for each: tools are model-controlled, resources are application-driven, and prompts are user-controlled.

Every message is JSON-RPC 2.0. A request has an `id`, a `method`, and `params`. A response carries either a `result` or an `error` with the same `id`. In the 2026-07-28 revision, the one the MCPA exam is aligned to, every request also carries its own protocol metadata in `params._meta`: the protocol version under the key `io.modelcontextprotocol/protocolVersion`, the client's capabilities under `io.modelcontextprotocol/clientCapabilities`, and, recommended, the client's name and version under `io.modelcontextprotocol/clientInfo`. There is no opening handshake and no session. Each request stands on its own, which is why any replica of a server can answer it.

Every result carries a `resultType`. For now you will see `complete`, meaning the result holds the final content. Later lessons introduce `input_required`, the answer a server gives when it needs something from the user before it can finish.

Discovery is data, not code. A client can call `server/discover` to learn which protocol versions a server supports, which capabilities it offers, and its name, and it can call `tools/list` to receive each tool's name, description, and input schema. Nothing is compiled into the client ahead of time. That is the entire interoperability argument in one sentence: a client written today can drive a server written next year, because the server describes itself in the protocol.

Errors come in two kinds, and the exam cares about the difference. A **protocol error** is a JSON-RPC error: the request itself was wrong, such as a call naming a tool the server does not have, which is code `-32602` (Invalid params). A **tool execution error** is a normal result with `isError: true` and an explanation in its content: the tool ran into a problem the model can fix, such as a missing argument. The model sees tool execution errors and can retry with corrected arguments. It learns much less from a protocol error.

```figure
mcpa-02-n-by-m
```

## Interactive Lab

The figure shows the same four applications and six systems twice. On the left, every application is wired to every system, twenty-four lines of custom glue. On the right, each application and each system connects once to the shared protocol, ten connections in total. Then follow a single request from one client to one server: the request names a method, carries its own version and capabilities, and gets back a result whose `resultType` says it is complete. Notice what is missing on the right side: there is no setup conversation before the first useful request.

## Practice Lab

Open `code/main.py`. It is a standard-library model with no network and no SDK, but the message shapes follow the 2026-07-28 schema. It builds two unrelated servers, a weather service and a ticket service, and one client class that was written for neither. The client discovers each server, lists its tools, and calls them.

```bash
python3 code/main.py
```

Read the printed exchanges against the concept section. Find the `_meta` block on every request and the `resultType` on every result. Then find three deliberate failures. A call to `get_forecast` without a city comes back as a normal result with `isError: true`. A call to a tool that does not exist comes back as JSON-RPC error `-32602`. A request that claims protocol version `1999-01-01` comes back as error `-32022`, whose `data` lists the versions the server does support. Change the city, add a third tool to the ticket server, and rerun to watch discovery pick it up without any change to the client.

## Shipped Artifact

`outputs/mcp-scope-brief.md` is a one-page brief you can hand to a teammate: the N plus M argument, what MCP does and does not standardize, the participants and primitives with who controls each, and the two error channels. Use it when you explain why a team should expose one MCP server instead of writing another bespoke integration.

## Verify It

Run the tests from the lesson directory:

```bash
python3 -m unittest discover code/tests
```

They check the claims in this lesson: the integration arithmetic, that one client discovers two unrelated servers, that every request carries the version and capabilities, that discovery returns cache hints and the server's identity, that an unknown tool is a protocol error while a missing argument is a tool execution error, that a request without metadata is rejected, that an unsupported version names the supported ones, and that the tool list order is stable. The repository's wire checker also validates the lesson's transcript against the 2026-07-28 rules:

```bash
python3 scripts/check_mcpa_wire.py certifications/mcpa/lessons/02-the-integration-problem
```

## Capstone Connection

The capstone assembles a full 2026-07-28 exchange from discovery to an audited tool call. Everything in it rests on this lesson's picture: a host with one client per server, servers that describe themselves as data, requests that carry their own metadata, and results that say what kind of result they are. When the capstone asks you to justify a design, you will argue from the N plus M model and from the split between protocol errors and tool execution errors.

## Key Terms

| Term | Meaning |
|------|---------|
| Host | The application the user works in; it runs one client per server |
| Client | The component inside the host that talks to one server |
| Server | A program that exposes tools, resources, and prompts over MCP |
| Tool | A model-controlled action with a name, description, and input schema |
| Resource | Application-driven readable data identified by a URI |
| Prompt | A user-controlled template the user selects explicitly |
| `_meta` | The per-request metadata block carrying version, capabilities, and client identity |
| `resultType` | The field that says whether a result is complete or needs more input |
| Protocol error | A JSON-RPC error for a request that is itself wrong, such as an unknown tool (`-32602`) |
| Tool execution error | A normal result with `isError: true` that the model can read and correct |

## Further Reading

- [MCP specification 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28), especially the Overview and the Tools pages
- [MCP architecture overview](https://modelcontextprotocol.io/docs/2026-07-28/learn/architecture)
- [JSON-RPC 2.0 specification](https://www.jsonrpc.org/specification)
- `certifications/mcpa/research/mcp-2026-07-28-brief.md`, sections 2, 3, 5, and 10
- `phases/13-tools-and-protocols/06-mcp-fundamentals`, which builds the stateless request model in depth
