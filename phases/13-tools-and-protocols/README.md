# Phase 13: Tools & Protocols

> The interfaces between AI and the real world.

This phase moves from function calls and tool schemas into interoperable
protocols, Agent Skills, security, and production governance. Numeric order is
useful for browsing. The focused routes below are the reliable learning order.

## Start this phase on GitHub

**Prerequisites:** Phase 11 LLM completion APIs. For MCP or Agent Skills, use
the focused route below instead of assuming numeric lesson order.

**First full-phase lesson:** [The Tool Interface](01-the-tool-interface/)

Run this command from the repository root:

```bash
python3 phases/13-tools-and-protocols/01-the-tool-interface/code/main.py
```

Keep the command, exit code, describe-decide-execute-observe trace, rejected
input evidence, and one sentence explaining the turn limit.

**Next action:** Continue to [Function Calling Deep Dive](02-function-calling-deep-dive/),
or choose the Model Context Protocol (MCP) or Agent Skills route below.

Browse the [full Phase 13 lesson list](../../README.md#phase-13) or the
[cross-phase roadmap](../../ROADMAP.md).

## Model Context Protocol (MCP) path

The focused MCP route is 17 lessons and about 23 hours 15 minutes. It follows
MCP `2026-07-28` from one self-describing JSON-RPC request to an operational
conformance gate.

| Stage | Lessons | What you prove | Time |
|---|---|---|---:|
| Core | [06](06-mcp-fundamentals/), [07](07-building-an-mcp-server/), [08](08-building-an-mcp-client/), [09](09-mcp-transports/), [10](10-mcp-resources-and-prompts/) | Envelopes, discovery, client and server behavior, transports, resources, and prompts. | 5 hr 50 min |
| Bidirectional | [11](11-mcp-sampling/), [12](12-mcp-roots-and-elicitation/), [13](13-mcp-async-tasks/), [14](14-mcp-apps/) | MRTR input, explicit scope, durable tasks, and app boundaries without server-initiated requests. | 5 hr |
| Secure | [15](15-mcp-security-tool-poisoning/), [16](16-mcp-security-oauth-2-1/), [18](18-mcp-auth-production/), [17](17-mcp-gateways-and-registries/) | Poisoning defenses, authorization, production tokens, gateway routing, and registry admission. | 5 hr 15 min |
| Advanced | [28](28-mcp-tool-contracts-and-content/), [29](29-mcp-reliability-cancellation-and-flow-control/), [30](30-mcp-registry-supply-chain-and-drift/), [31](31-mcp-conformance-versioning-and-operations/) | Contract fidelity, cancellation races, supply-chain drift, and release evidence. | 7 hr 10 min |

The exact order is 06, 07, 08, 09, 10, 11, 12, 13, 14, 15, 16, 18, 17, 28,
29, 30, 31. It is defined in
[`learning-paths/model-context-protocol.json`](../../learning-paths/model-context-protocol.json).
The tutor creates `MCP-LEARNING.md`, teaches one lesson per
invocation, and records the request, response, command, working directory, exit
code, and redacted boundary evidence required by each checkpoint.

Start with the invocation supported by your host:

| Host | Invocation |
|---|---|
| Codex | `learn-mcp`, or choose it from `/skills` |
| Claude Code | `/learn-mcp` |
| Other compatible hosts | `Use learn-mcp to start or resume the Model Context Protocol (MCP) path.` |

### Your first ten minutes

From the repository root, run Lesson 06's stateless transcript:

```bash
python3 phases/13-tools-and-protocols/06-mcp-fundamentals/code/main.py
```

Find four things in the output: repeated request metadata, a complete
`server/discover` result, error `-32022` for an unsupported version, and a
transport close that does not create or terminate an MCP protocol session.
That transcript is the first checkpoint, not just a demo.

If the repository or Python 3 is unavailable, read [Lesson 06](06-mcp-fundamentals/)
and hand-trace one request and response. Mark the checkpoint conceptual and
leave runtime, transport, authorization, and deployment evidence pending.

Complete Lesson 15's executable security checkpoint before any non-loopback
bind, shared ingress, hosted endpoint, or registry publication. Review the
external target and requested authority, then confirm the deployment action
explicitly. A completed tutorial does not grant deployment authority.

Older `initialize`, `Mcp-Session-Id`, standalone SSE `GET`, session `DELETE`,
and server-initiated request flows appear only in explicit compatibility notes.
Modern requests declare protocol version and client capabilities in
`params._meta`, use `server/discover`, and carry enough information to be
validated, authorized, routed, and retried independently.

[Lesson 23](23-capstone-tool-ecosystem/) is the only optional MCP route
capstone. Complete the 17 required lessons plus [Lesson 19](19-a2a-protocol/)
and [Lesson 20](20-opentelemetry-genai/) before starting it.

## Agent Skills fast path

The focused route is five lessons and about 9 hours 30 minutes:

| Step | Lesson | Outcome | Time |
|---:|---|---|---:|
| 1 | [22: Portable Contract and Runtime Boundary](22-skills-and-agent-sdks/) | Create, install, invoke, verify, and remove a complete skill bundle. | 90 min |
| 2 | [24: Discovery and Progressive Disclosure](24-skill-discovery-and-progressive-disclosure/) | Trace discovery, cataloging, activation, and resource loading. | 105 min |
| 3 | [25: Invocation and Routing](25-skill-invocation-and-routing/) | Control explicit, implicit, human, model, and abstention paths. | 105 min |
| 4 | [26: Permissions, Sandboxes, and Trust](26-skill-permissions-sandboxes-and-trust/) | Separate instructions, permissions, containment, and verification. | 120 min |
| 5 | [27: Evals, Packaging, and Portability](27-skill-evals-packaging-and-portability/) | Build a release gate and prove behavior in real hosts. | 150 min |

Start with the invocation supported by your host:

| Host | Invocation |
|---|---|
| Codex | `learn-agent-skills`, or choose it from `/skills` |
| Claude Code | `/learn-agent-skills` |
| Other compatible hosts | `Use learn-agent-skills to start or resume the Agent Skills Engineering path.` |

The tutor creates or resumes `AGENT-SKILLS-LEARNING.md`, teaches one lesson per
invocation, and records the evidence required by each checkpoint. The route is
defined in
[`learning-paths/agent-skills.json`](../../learning-paths/agent-skills.json).

If you prefer to read first, start with [Lesson 22](22-skills-and-agent-sdks/).
Its first lab gets a skill into a real host in about ten minutes.

### Prerequisite fast lane

- For the real labs, you need `node`, `npx`, `python3`, one selected
  skill-capable host, and write access to the chosen project or user skill
  scope. Verify the three commands with `node --version`, `npx --version`, and
  `python3 --version` before installing.
- If that preflight is unavailable, use the website or read each `docs/en.md`
  manually. You can complete the conceptual work, but keep discovery,
  invocation, script, update, and uninstall evidence marked pending.
- Skim [Lesson 01](01-the-tool-interface/) and [Lesson 05](05-tool-schema-design/)
  if tool contracts are new to you.
- Before Lesson 26, confirm that you can explain tool poisoning and untrusted
  instructions. [Lesson 15](15-mcp-security-tool-poisoning/) is the optional
  refresher for that preflight, not a sixth required lesson in this route.
- [Lesson 23](23-capstone-tool-ecosystem/) is an optional systems capstone,
  not the next Agent Skills lesson after 22. Complete lessons 06 through 20
  before taking it.

## Full phase

See [ROADMAP.md](../../ROADMAP.md) for the full lesson plan.
