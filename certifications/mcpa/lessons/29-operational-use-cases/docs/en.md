# Choosing MCP's Shape for the Job

> Four questions, who initiates the call, how sensitive the data is, how long the work runs, and whether a human needs to see it, turn a vague request into a specific choice of primitive, transport, auth path, and extension.

**Type:** Reference
**Languages:** Python
**Prerequisites:** Lesson 28
**Time:** ~45 minutes

## Learning Objectives

- Map seven operational use case families, developer tools, data access, enterprise systems of record, long running workflow automation, interactive UIs, reusable workflows, and machine to machine integration, to the MCP primitive, transport, and extension that fit each one
- Choose between a tool, a resource, and a prompt by asking who controls the action: the model, the application, or the user
- Recognize when MCP is the wrong tool for a job and name what a team should reach for instead
- Reason about the four operational concerns, authorization path, cache scope, consent, and observability, that any use case design has to answer
- Read a server/discover result and a tools/call exchange and connect their cache hints and extension declarations back to the use case that produced them

## The Problem

A team that has learned MCP's message shapes still hits a harder question the moment a real project lands on their desk: given this job, which of the protocol's shapes actually fits? The wire rules hold equally for a five second lookup and a twenty minute pipeline, so nothing in the JSON-RPC envelope forces the choice by itself. Left to instinct, two mistakes show up constantly. Some teams reach for a tool for everything, including data a host should simply read into context on its own, so every retrieval becomes a model decision instead of an application one, and every answer costs a round trip the model has to ask for by name. Other teams treat MCP as the default integration layer for problems that never leave one process, wrapping a currency formatter or a string template in a server nobody else will ever call, and pay a protocol's overhead for zero interoperability benefit. Real operational work also stacks concerns the base message shapes do not settle on their own: who authorizes a call when no human is watching, whether last week's cached list is safe to reuse for this user, and how an auditor traces a result back to the request that produced it. This domain is the part of the exam that checks whether a candidate can answer those questions from a description of the job, not from a diagram already labeled with the right answer.

## The Concept

Start from a rule already earned in this course: tools are model controlled, resources are application driven, and prompts are user controlled. That split answers the first and largest question a use case asks, who is expected to decide that this capability runs. A code search the model reaches for mid conversation is a tool. A ticket's current status that the host quietly drops into context before the model ever answers is a resource. A code review checklist the user explicitly picks from a menu is a prompt, and when that checklist is really a cataloged multi step procedure with supporting files rather than one template, the Skills over MCP extension (`io.modelcontextprotocol/skills`) serves its instructions through the same `resources/read` call this track already covers, discoverable first through `skills/list` and `skills/get`.

Four more questions round out the design. Does the system this wraps live on the same machine as the host, or somewhere remote? A local filesystem or a local database answers with stdio, and stdio implementations should not run an OAuth flow at all, they read credentials from the environment. A remote system answers with Streamable HTTP, and now authorization enters the picture: a human approving a redirect gets the core framework's interactive OAuth 2.1 flow, a background job with nobody watching gets the OAuth client credentials authorization extension (`io.modelcontextprotocol/oauth-client-credentials`), and an organization with a central identity provider gets the Enterprise-Managed Authorization extension (`io.modelcontextprotocol/enterprise-managed-authorization`) instead of asking every employee to grant every server individually.

How long does the work take? A call that can finish inside one request-response pair stays a plain result. A deploy pipeline or a batch import that might run for minutes returns a `CreateTaskResult` from the tasks extension (`io.modelcontextprotocol/tasks`) instead, so the client polls a durable `taskId` rather than holding a connection open against a timeout:

```json
{
  "jsonrpc": "2.0",
  "id": 9,
  "result": {
    "resultType": "task",
    "taskId": "task_4471",
    "status": "working",
    "ttlMs": 3600000,
    "pollIntervalMs": 2000
  }
}
```

Does the result need an interactive surface? A number or a short paragraph stays plain content. A dashboard a user actually wants to click through calls for MCP Apps (`io.modelcontextprotocol/ui`), a tool whose definition points at a `ui://` resource that the host renders in a sandboxed iframe, but only once the caller declares the extension:

```json
{
  "_meta": {
    "io.modelcontextprotocol/clientCapabilities": {
      "extensions": { "io.modelcontextprotocol/ui": {} }
    }
  }
}
```

A server that offers this well still answers a caller who never declared that block with ordinary text content instead of an error, the graceful degradation the extensions framework expects of both sides.

How sensitive is the data, and is a human present to weigh in? Sensitive results carry `cacheScope: "private"` on whichever of the six cacheable operations produced them, never as an access control by itself, only as a promise not to hand one user's cached answer to another. A human present for a sensitive or slow action is worth an MRTR elicitation confirming the specific detail before the server commits, echoing the retry pattern this track already builds elsewhere; nobody present at all means the call runs inside whatever scope it was already granted, with no elicitation to answer. Every path still ends the same way for an auditor: trace context in `_meta` follows a call across every hop, and the audit record keys on the authenticated principal a token names, never on the self reported `clientInfo` a client could put anything into.

Not every job clears the bar for a protocol boundary at all. A capability that never leaves one process, formatting a string, rounding a number, composing a prompt from local variables, has no second consumer for MCP's interoperability to pay for and no separate system for a client and server to stand between. Standing up a server for it adds a JSON-RPC envelope, a discovery round trip, and an authorization decision on top of a function call that already worked. The seven use case families above are the ones where a second consumer, a second host, or a boundary worth guarding is genuinely in play; when none of those hold, a library call is the correct answer, not an under-built MCP server.

```figure
mcpa-29-use-case-matrix
```

## Interactive Lab

The figure lines up six of this lesson's catalog entries against the questions that shape them most visibly: who controls the primitive, which transport it rides, and which extension, if any, it declares. Follow the developer tools row first: a tool, stdio, no extension, because a code search a model triggers on a local machine needs nothing beyond a trusted subprocess reading its own environment. Then follow the bottom three rows, a long job pulling in the tasks extension, an interactive dashboard pulling in the ui extension, and a machine to machine sync pulling in the OAuth client credentials extension, and notice each extension answers a different one of the four questions, duration, interactivity, and who is present to authorize. The two middle rows, data access and reusable flow, show the other primitive split: an application quietly reading ticket context becomes a resource, while a user explicitly picking a checklist becomes a prompt even though both ride the same remote transport.

## Practice Lab

Open `code/main.py`. `CATALOG` holds eight `UseCaseProfile` entries: one for each of the seven use case families above, plus the in-process case where MCP does not fit at all. `recommend()` turns each profile into a `Recommendation` carrying its own `reasoning` trail. Run it:

```bash
python3 code/main.py
```

Read the printed catalog against the concept section above, then find `run_scenario()`. It drives one `opsdesk` server through a `server/discover` call, a `tools/list` call, a successful `search_internal_docs` call, and two calls to `usage_dashboard`, one without the ui extension declared and one with it, ending on a call to a tool that does not exist. Confirm that the `tools/list` result carries `cacheScope: "private"` while `server/discover` carries `"public"`, since a server's own capability description is not sensitive even when the tools behind it are. Then add a ninth profile to `CATALOG` for a use case of your own choosing, a monitoring alert that pages a human after ten minutes of silence, say, fill in its fields, predict what `recommend()` will return before you rerun the script, and check your prediction against the printed reasoning.

## Shipped Artifact

`outputs/use-case-decision-matrix.md` lays out the seven use case families in one table: the primitive, transport, auth path, extensions, and cache scope each one calls for, next to the "when MCP is not the right tool" test and the four operational concerns this lesson walks through. Keep it next to the roles and responsibilities brief; that material names who owns a deployment, and this one names what they should build for the job actually in front of them.

## Verify It

Run the tests from the lesson directory:

```bash
python3 -m unittest discover code/tests
```

They check the claims in this lesson: a local system recommends a tool over stdio with environment credentials, an application-initiated case recommends a resource, a user-initiated template recommends a prompt and the skills extension, a long job recommends the tasks extension, a machine-to-machine case recommends the client credentials extension, an interactive dashboard recommends MCP Apps with a text fallback, private data recommends a private cache scope, public data recommends a public cache scope, an enterprise-managed deployment recommends the enterprise authorization extension, a use case with no external system is not recommended for MCP at all, the demonstration transcript's discover and list results carry the right cache hints, the dashboard tool falls back to text without the ui extension, an unknown tool is a protocol error, a request missing its metadata is rejected, and an unsupported version names the versions the server does support. The repository's wire checker also validates the lesson's transcript against the 2026-07-28 rules:

```bash
python3 scripts/check_mcpa_wire.py certifications/mcpa/lessons/29-operational-use-cases
```

## Capstone Connection

The capstone readiness review asks for one design defended end to end, not five domains recited in isolation. This lesson is where that defense starts: given a scenario, name the primitive, the transport, the auth path, the extensions, and the cache scope before writing a single message, the same four questions this lesson's recommender answers in code. When a capstone scenario adds a long running step or an interactive result partway through, reach for the tasks extension or MCP Apps the way the catalog above does, and when a piece of the scenario turns out not to need MCP at all, say so plainly instead of forcing a server around it.

## Key Terms

| Term | Meaning |
|------|---------|
| Operational use case | A concrete job, developer tooling, data access, enterprise records, long running automation, an interactive UI, a reusable workflow, or machine to machine integration, that a design has to fit MCP to |
| Control split | The rule that a tool is model controlled, a resource is application driven, and a prompt is user controlled |
| Tasks extension | `io.modelcontextprotocol/tasks`; returns a durable `taskId` for work too long for one blocking request |
| MCP Apps | `io.modelcontextprotocol/ui`; renders a tool's result as an interactive surface in a sandboxed iframe, with a text fallback |
| Skills over MCP | `io.modelcontextprotocol/skills`; serves a cataloged multi step procedure's instructions through `resources/read` |
| Authorization extension | An opt-in auth path, client credentials for an unattended caller or enterprise-managed for a central identity provider, beyond the core interactive flow |
| cacheScope | The `public` or `private` marker on a cacheable result that limits sharing across authorization contexts; never an access control by itself |
| Graceful degradation | A server's obligation to fall back to core behavior, or reject with a clear error, when a caller has not declared an extension it offers |

## Further Reading

- [MCP server concepts](https://modelcontextprotocol.io/docs/2026-07-28/learn/server-concepts), for the tools, resources, and prompts control split this lesson builds on
- [MCP client concepts](https://modelcontextprotocol.io/docs/2026-07-28/learn/client-concepts), for elicitation and the client features it grounds
- [Extensions overview](https://modelcontextprotocol.io/extensions/overview), for extension identifiers, negotiation, and graceful degradation
- [MCP Tasks](https://modelcontextprotocol.io/extensions/tasks/overview), [MCP Apps](https://modelcontextprotocol.io/extensions/apps/overview), [Skills over MCP](https://modelcontextprotocol.io/extensions/skills/overview), and [authorization extensions](https://modelcontextprotocol.io/extensions/auth/overview)
- `certifications/mcpa/research/mcp-2026-07-28-brief.md`, sections 10 and 14
- `phases/13-tools-and-protocols/23-capstone-tool-ecosystem`, for a worked end-to-end ecosystem scenario
