# The Integration Problem MCP Solves

> Every tool you connect to an agent is a contract. The Model Context Protocol makes that contract the same shape everywhere, so one client can speak to a thousand servers it has never seen.

**Type:** Reference
**Languages:** Python
**Prerequisites:** None
**Time:** ~45 minutes

## Learning Objectives

- Explain the purpose and scope of the Model Context Protocol and the problem it standardizes
- Name the four roles in an MCP system and what each one is responsible for
- Describe why one open protocol beats writing a custom integration for every system
- Read a capability handshake and a tool call as ordinary JSON-RPC messages
- Map the MCPA "MCP Fundamentals" domain to the parts of a running system

## The Problem

Before MCP, connecting a model to an external system meant writing glue. If you wanted an assistant to read your files, call your ticketing API, and query your database, you wrote three different integrations. Each one had its own way to describe what it could do, its own argument format, its own error shape, and its own idea of who was allowed to call it. Add a fourth system and you wrote a fourth integration. Change your model vendor and you wrote them all again.

That is an N times M problem. N models and M systems means N times M integrations, and every one of them is a place where the format drifts and the security assumptions blur. The cost is not the first integration. It is the tenth, and the audit that has to reason about all ten at once.

The Model Context Protocol replaces N times M with N plus M. Each model host learns to speak MCP once. Each system exposes an MCP server once. Any host can then talk to any server, because they agree on one message format, one way to advertise capabilities, and one way to call a tool and read its result. This lesson is the foundation the MCPA exam builds on: what MCP is for, who the participants are, and why the standard is worth learning before any single feature of it.

## The Concept

MCP is a protocol, not a product. A protocol is a set of agreements about messages: what they look like, what order they come in, and what each side is allowed to assume. MCP's agreements ride on JSON-RPC 2.0, the same request and response envelope used across many systems, so a request carries a method name and parameters and a response carries either a result or an error keyed to the request id.

Four roles do the work. The **host** is the application the user interacts with, such as an assistant or an IDE. Inside the host runs one or more **clients**, and each client holds exactly one connection to one **server**. A **server** exposes capabilities, and the most visible capability is a **tool**: a named, described, schema-typed action the model can ask to run. Resources and prompts are two more capabilities a server can expose, but a tool is the one to anchor on first, because a tool call is where the model reaches out and something happens in the world.

The interaction always starts with a handshake. The client and server exchange the protocol version they speak and the capabilities they support. This lesson targets MCP version `2026-07-28`, the release the MCPA exam is aligned to. After the handshake, the client can ask the server what it offers, and the server answers with a list of tools, each carrying a name, a human description, and an input schema. Nothing is assumed out of band. Everything a client needs to use a server, the server tells it, in the protocol.

That last point is the whole value. Because the capability list is data, not code, a client written today can drive a server written next year. The host does not need to be recompiled to learn a new tool. The user, through the host, discovers the tool at runtime and decides whether to allow it. Interoperability is not a feature bolted onto MCP; it is the reason the protocol exists.

```figure
mcpa-01-mcp-roles
```

## Interactive Lab

The figure above traces one request through the four roles. Follow it from the left: a user asks the host to do something, the host asks the model, the model decides it needs a tool, the client that owns the connection sends a `tools/call` request to the server, the server runs the tool and returns a result, and the result flows back to the model so it can answer. Watch where the trust boundary sits. The host and its client are inside your application. The server is a separate program, often written by someone else, and the moment a result crosses back from the server is the moment untrusted content enters your model's context. Hold that thought; the Security and Governance domain lives on it.

## Practice Lab

Open `code/main.py`. It is a stdlib Python mock of an MCP fundamentals exchange: no network and no SDK, so it runs anywhere, but the message shapes are the real ones. It builds an `initialize` handshake, a `tools/list` request, and a `tools/call` request, dispatches them through a tiny in-memory server, and prints the results. Run it and read the three messages against the description above. Then change the tool the client calls to a name the server does not expose, and watch the server return a JSON-RPC error with a code and a message rather than a crash. That error path is not an accident of this mock; it is how a conformant server reports a bad request, and the Interactions and Execution domain will make you fluent in it.

```bash
python3 code/main.py
```

## Shipped Artifact

`outputs/mcp-fundamentals-brief.md` is a one-page field brief you can keep: the four roles in one sentence each, the handshake and discovery flow, the N plus M argument for adopting MCP, and the exam-relevant facts for this domain with their source. Drop it into a study deck or a team wiki when you are explaining to a colleague why the protocol is worth standardizing on.

## Verify It

Run the tests with `python3 -m unittest discover code/tests`. They assert the properties this lesson claims: that the handshake echoes the negotiated protocol version, that discovery returns every tool the server registered with its schema, that a valid call returns a result while an unknown tool returns a structured error, and that a malformed request is rejected rather than executed. If a test fails, the mock and the lesson have drifted, and the mock is the source of truth for the message shapes.

## Capstone Connection

This lesson is the ground floor of the MCPA capstone. Every later domain assumes you can place a message in the host, client, server, or tool and say who sent it and who is trusted. When you assemble the capstone readiness review, you will return here to justify a design in terms of the four roles and the one protocol, so keep the field brief close.

## Key Terms

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Host | "The app" | The application the user interacts with; it embeds one or more clients |
| Client | "The connection" | A component inside the host that holds exactly one connection to one server |
| Server | "The integration" | A separate program that exposes capabilities such as tools, resources, and prompts |
| Tool | "The function" | A named, described, schema-typed action a model can ask the server to run |
| Handshake | "The setup" | The initialize exchange where client and server agree on version and capabilities |

## Further Reading

- Model Context Protocol specification, version 2026-07-28, for the normative message shapes.
- JSON-RPC 2.0 specification, for the request, response, and error envelope MCP rides on.
- The `certifications/mcpa/research/source-verification-ledger.md` file in this repository, for the exam facts and their sources.
