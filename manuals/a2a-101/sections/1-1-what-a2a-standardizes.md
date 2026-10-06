# What A2A standardizes

> A2A defines a data model, a set of operations, and three bindings for agents that cannot see inside each other, and leaves everything inside an agent to the implementation.

Your planner needs the unit tests of `payments-api` run at commit `9f3c2e1`. The `test-runner` agent does that job on port 41241, in a container the platform team owns. You cannot import it as a function. You can only send it a request and read what comes back.

The specification calls such agents "independent, potentially opaque AI agent systems" {{spec §1}}. When you finish this section, you can name the three layers, state the core rules, and say where A2A stops.

## Three layers in the specification

The specification is "organized into three distinct layers" {{spec §1.3}}.

**Data model:** what the records are. Layer 1 defines them "expressed as Protocol Buffer messages" {{spec §1.3}}, and the proto file is normative {{spec §1.4}}.

**Operations:** what a client can ask for. Layer 2 describes the eleven RPCs of `A2AService` {{proto A2AService}} "independent of how they are exposed over specific protocols" {{spec §1.3}}.

**Bindings:** how the bytes travel. Layer 3 maps the operations onto JSON-RPC, gRPC, and HTTP+JSON {{spec §1.3}}.

A client first reads the `AgentCard`, usually at `/.well-known/agent-card.json` {{spec §8.2}}, with a plain `GET` that is none of the eleven operations. The card of `test-runner` lists `/a2a/jsonrpc` and `/a2a/rest`, and [figure](#fig-spec-layers) stacks the layers behind them.

Below the dashed line, `test-runner` builds what the protocol leaves open: an HTTP router, a request handler, a task store, and an event broadcast. The §1.3 diagram lists a Get Agent Card operation that §3.1 never defines ([conflict D25](#s-ref-sources)), and §1.4 misnames the proto path ([conflict D15](#s-ref-sources)).

```figure
id: fig-spec-layers
kind: layers
title: the A2A stack for test-runner
claim: A2A defines the card, the bindings, the operations, and the objects, while test-runner's server parts and agent logic below the dashed line belong to its owner.
caption: Read from the planner down. Above the dashed line sit the three layers of spec §1.3 with test-runner's real paths, from capture/out/01-agent-cards.http. Below it are the kit's own parts in capture/a2a_ref.py, and dashed boxes mark what a production agent adds.
```

## The core rules

**An agent is opaque:** agents collaborate "without needing to share their internal thoughts, plans, or tool implementations" {{spec §1.2}}, so a client sees only what comes back.

**The server chooses the reply:** a message gets either a new `Task` or "a direct `Message` response for simple interactions" {{spec §3.1.1}}, and [SendMessage](#s-send-message) shows both.

**The server owns the task:** "Client-provided `taskId` values for creating new tasks is NOT supported" {{spec §3.4.2}}, and the client mints only the `messageId` {{proto Message}}.

**A task is in one of nine states:** `status.state` holds one `TaskState` value {{proto TaskState}}, four of them terminal and two interrupted. [Task, TaskStatus, and TaskState](#s-task-and-task-state) lists all nine.

**A terminal task does not change:** no message moves it again, as [CancelTask and terminal states](#s-cancel-task-and-terminal-states) shows.

```rule
label: the end of a task
source: spec §3.1.1
---
"Messages sent to Tasks that are in a terminal state (`TASK_STATE_COMPLETED`, `TASK_STATE_FAILED`, `TASK_STATE_CANCELED`, `TASK_STATE_REJECTED`) cannot accept further messages."
```

**Artifacts carry results:** "Messages SHOULD NOT be used to deliver task outputs" {{spec §3.7}}, so the planner reads the test count from `summary.json`.

**Events arrive in order:** "All implementations MUST deliver events in the order they were generated" {{spec §3.5.2}}, and a client that reconnects confirms the state with `GetTask` {{spec §3.7}}.

**Credentials travel in HTTP headers:** the client "includes these credentials in protocol-appropriate headers or metadata for every A2A request" {{spec §7.3}}, so the planner sends `Authorization: Bearer` to `deployer` with every request.

## The boundary with MCP

MCP connects an agent to its tools, and A2A connects agents to each other: "One connects agents to tools and resources. The other enables agent-to-agent collaboration" {{docs a2a-and-mcp}}. The 1.0 announcement gives the short form, "MCP inside agents, A2A between agents" {{docs announcing-1.0}}. No card names a tool: the `run-tests` skill on the `test-runner` card describes the work and stops there. [MCP fundamentals](phases/13-tools-and-protocols/06-mcp-fundamentals) covers the other protocol.

## What A2A leaves to the host

A2A defines no registry: the specification "does not prescribe a standard API for curated registries" {{docs agent-discovery}}. It issues no credentials, since identity is handled "at the protocol layer, not within A2A semantics" {{spec §7}}. It sets no retention period, so a task id can be "invalid, expired, or already completed and purged" {{spec §3.3.2}}. It promises no exactly-once effect, because "Send Message operations MAY be idempotent" {{spec §3.3.1}} and a webhook gets at least one attempt {{spec §4.3.3}}. [Figure](#fig-guarantees) pairs each guarantee with the host's job.

```figure
id: fig-guarantees
kind: comparison
title: what A2A guarantees and what the host builds
claim: A2A fixes the messages, states, and events between agents, while trust, discovery, retention, and exactly-once effects stay with the host.
caption: Read across each row, one row per step. The left box is what the specification guarantees, and the grey box beside it is what you build. No capture: the rows come from spec §1, §3.3.1, §3.4.1, §3.7, §4.3.3, §7, §8.2, and §13.1.
```

The specification also contradicts itself in ten places that change your code, listed below and settled in [the sources reference](#s-ref-sources).

| Conflict | What disagrees |
|---|---|
| [D1](#s-ref-sources) | the HTTP verb for `SubscribeToTask` |
| [D2](#s-ref-sources) | whether a plain `SendMessage` waits |
| [D3](#s-ref-sources) | whether a stream closes at an interrupted state |
| [D4](#s-ref-sources) and [D5](#s-ref-sources) | the names of the push configuration objects |
| [D6](#s-ref-sources) | the name of the card's security field |
| [D11](#s-ref-sources) | deprecated OAuth flows |
| [D12](#s-ref-sources) | the page field names of `ListTasks` |
| [D13](#s-ref-sources) | the HTTP+JSON error body |
| [D36](#s-ref-sources) | the error for another client's task |

```takeaways
- Build your client against the operations and objects, and keep each binding in one module.
- Treat everything behind a remote agent's endpoint as private.
- Mint a fresh `messageId` for every message, read results from artifacts, and send credentials in HTTP headers.
```

Sources: spec §1, §1.2, §1.3, §1.4, §3.1.1, §3.3.1, §3.3.2, §3.4.1, §3.4.2, §3.5.2, §3.7, §4.3.3, §7, §7.3, §8.2, §13.1 (research/sources/specification.md); proto A2AService, Message, TaskState (research/sources/a2a.proto); docs a2a-and-mcp, announcing-1.0, agent-discovery (research/sources/docs.md); capture/a2a_ref.py, capture/planner.py; capture/out/01-agent-cards.http, 03-blocking-task.http, 10-cancel.http, 19-planner.http
