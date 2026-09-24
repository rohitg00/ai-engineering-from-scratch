# One Server, Many Hosts: The Portability Rule

> A server that only works with one host is a plugin. A server that works, unchanged, with any conformant host is what the Model Context Protocol is actually for.

**Type:** Reference
**Languages:** Python
**Prerequisites:** Lesson 07
**Time:** ~45 minutes

## Learning Objectives

- Explain why a single MCP server can run unchanged under two or more independent hosts
- Distinguish the responsibilities of a server author, a host, and a user in an MCP deployment
- Select operational use cases where MCP connects an agent host to internal data, tools, and workflows
- Reason about ecosystem portability: why adopting a new host does not require rewriting an existing server
- Map the Use Cases and Ecosystem domain's roles, use cases, and portability rule to a running example

## The Problem

Every team that adopts an agent host eventually asks a second question: what happens when we adopt a second one. Maybe engineering wants an assistant embedded in the IDE while support wants one embedded in the help desk. Maybe a vendor evaluation goes well and it is time to trial a competing host without ripping out the first. Before a shared protocol, that question was expensive to answer, because each host shaped its integrations around itself: its own way to describe a tool, its own request format, its own idea of what a result looked like. A server built for one host's dialect did not run against another host without a rewrite, even though the underlying system it wrapped, an internal ticket database, say, had not changed at all.

That is the same integration problem the MCP Fundamentals lesson named, seen from the adoption side rather than the build side. It is not enough for a protocol to make one server easy to write. For the protocol to be worth standardizing on, the server it produces has to keep working as the surrounding ecosystem of hosts changes around it. The Use Cases and Ecosystem domain is the part of the exam that tests whether you can reason about that durability: who is responsible for what in a running deployment, which real jobs MCP is built to connect, and what exactly stays the same when the host driving a server changes.

## The Concept

Three roles carry the weight in this domain, and they sit on top of the host, client, and server roles from MCP Fundamentals, with responsibility attached to each. The server author writes and maintains one implementation. They decide what capabilities exist: which tools are registered, what each tool's input schema requires, what a resource returns. They build this against the specification, version 2026-07-28, not against any particular host's SDK or interface conventions. The host is the application a person actually runs. It embeds one or more clients, and it owns everything about how a discovered tool is surfaced: the list a user sees before approving a call, the panel or bubble a result is rendered into, the memory and sampling policy layered around the model. The user sits above both, deciding, through whatever consent flow the host offers, which of a server's capabilities may actually run. Splitting the work this way is what makes the next claim possible.

Because the wire contract itself, the JSON-RPC 2.0 envelope, the initialize handshake, tools/list discovery, tools/call invocation, is fixed by the specification and not by any host, a server author only has to implement the server side of that contract once. Any host whose client implements the same contract can drive it. The server carries no branch of logic that says: if the caller is host X, behave one way, and if it is host Y, behave another. It answers a tools/list request with the same tool list and a tools/call request with the same result payload, regardless of which client sent it. That is the entire mechanism behind ecosystem portability. Not a compatibility shim, not a translation layer, just the absence of anything host-specific in the server's own code.

This is what makes the domain's operational use cases practical at scale. A team that stands up a server exposing internal data, an issue tracker search, or internal tools, a deploy trigger, or internal workflows, a multi-step approval process, is not committing that capability to one host. It is exposing it to the ecosystem: every conformant host a team adopts can reach the same server without the server author doing anything differently for each one. Adding a second host is a cost the host vendor pays once, by writing a client; it is never a cost the server author pays again.

Portability has a boundary worth naming precisely, because the exam will test the edge of it. What travels unchanged is the capability contract: tool names, schemas, descriptions, and the result payload a call returns. What does not travel is presentation and host policy: how a result is rendered, what a host's consent flow looks like, what a host chooses to sample or remember. Two hosts calling the same tool with the same arguments must get the same payload back. They are not required, and not expected, to show that payload to their users the same way.

```figure
mcpa-08-portability
```

## Interactive Lab

`code/main.py` builds one `MockServer`, named `internal-ops`, exposing two tools: a knowledge-base search and an open-ticket listing. It then builds two `Host` objects, `assistant-chat` and `ide-sidebar`, and hands each one its own `MockClient` wired to that same server instance. Read `build_internal_server` first and confirm there is nothing in it that mentions either host by name; there cannot be, since the function runs before either host exists. Then read the two render functions, `render_as_chat_bubble` and `render_as_sidebar_panel`, and notice they only touch the string a result becomes on screen. Run the script and follow the figure above: both hosts print the same discovered tool names, both hosts call `search_knowledge_base` with the same query, and the script prints whether the two result payloads matched. They do. Only the printed presentation differs.

```bash
python3 code/main.py
```

## Practice Lab

Open `code/main.py` and add a third host next to the existing two: a `cli-agent` whose render function formats a result as a single command-line style line, something like `$ tool_name -> result`. Wire it to the same server instance the other two hosts use, the way `assistant-chat` and `ide-sidebar` already are, then call `discover()` and `run()` on it inside `demo()` the same way they do. Confirm three things by eye: the new host lists the same two tools as the others, a call to `search_knowledge_base` returns the same result payload the other hosts got, and you did not change one line inside `MockServer`, `Tool`, or `build_internal_server` to make it work. That is the practice, not just the theory: portability is the property you can verify by refusing to touch the server.

## Shipped Artifact

`outputs/ecosystem-portability-brief.md` is a one-page field brief: the three roles in a deployment and what each one owns, the operational use cases MCP is built to connect, and the portability rule stated precisely enough to apply to an exam question that describes a scenario rather than names the rule. Keep it next to the MCP Fundamentals brief; this domain builds directly on that one.

## Verify It

Run the tests with `python3 -m unittest discover code/tests`. They assert the properties this lesson claims: that both hosts discover an identical tool set with schemas attached, that both hosts receive an identical result payload for an identical call, that the rendered presentation differs even though the payload does not, that the server answers a raw request the same way it answers a host-mediated one, that a third host added after the fact needs no server change to work, and that a missing argument or an unknown tool produces the same structured error regardless of which host asked. If a test fails, the mock and the lesson have drifted, and the mock is the source of truth for what portability actually guarantees.

## Capstone Connection

The capstone readiness review in lesson 09 asks you to defend a design, not just describe one. This lesson is where you earn the vocabulary to say, precisely, why a server you are proposing will not need to be rewritten when the team adopts a second host, and which parts of the design, presentation, consent, sampling policy, are host concerns you should not be promising to control from the server side. Bring the field brief. The roles and the portability rule are the two things this domain expects you to apply to an unfamiliar scenario, not just recall.

## Key Terms

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Portability | "It works everywhere" | The same server, unmodified, can be driven by any host that implements the client side of the same protocol version |
| Server author | "The vendor" | The person or team that builds and maintains a server; they target the specification, not any particular host |
| Adoption | "Switching tools" | A team or user choosing which host application to run; adding a host is a client-side integration cost only |
| Operational use case | "A real job" | A concrete task, such as connecting internal data, tools, or workflows, that a server exposes to every connected host |
| Capability contract | "What it can do" | The tool, resource, and prompt definitions a server advertises; portability covers this contract, not host-side presentation |

## Further Reading

- Model Context Protocol specification, version 2026-07-28, at modelcontextprotocol.io/specification/2026-07-28, for the normative message shapes every host and server share.
- `phases/13-tools-and-protocols/17-mcp-gateways-and-registries`, for how gateways and registries extend this same portability property across many servers at once.
- MCPA certification page, at training.linuxfoundation.org/certification/model-context-protocol-associate-mcpa/, for the Use Cases and Ecosystem domain as published.
