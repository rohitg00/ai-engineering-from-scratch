# The id Field Is a Promise to Reply

> An id is not a label. It is a promise: include one and a response keyed to it is coming back; leave it out and nothing is coming back at all.

**Type:** Reference
**Languages:** Python
**Prerequisites:** Lesson 03
**Time:** ~45 minutes

## Learning Objectives

- Tell a JSON-RPC request from a notification by whether it carries an id, and state what response each one is owed
- Explain why a notification can never receive an error, even when its method is unknown to the receiver
- Name the three server primitives, tools, resources, and prompts, what each one is for, and who typically decides to use it
- Key an outgoing JSON-RPC response to the id of the request that triggered it, so concurrent calls on one connection never cross wires
- Map the MCPA "Interactions and Execution" domain's interaction pattern and protocol primitive sub-competencies to a running dispatcher

## The Problem

Say a server receives a message and has to decide what to do with it. If it treats every message as something that deserves a reply, it will eventually try to answer a message whose sender already moved on the instant it was sent, and that reply goes nowhere. If it treats every message as fire and forget, it will silently drop a caller who is sitting there waiting for an answer, and that caller hangs until it times out and assumes something crashed. Both mistakes share one root cause: nothing marks the message as one kind or the other, so the receiver is guessing.

A related mistake shows up on the server's other axis, what it exposes rather than how it replies. A server that describes every capability the same way, one flat list called tools, forces a model to treat actions, inert content, and canned instructions as if they were interchangeable. The model starts calling things it should only be reading. A host starts auto-running something a user was supposed to pick on purpose.

The fix for both problems is the same kind of fix: a small, explicit piece of structure that removes the guessing. For interaction patterns, that structure is one field, id. For capabilities, it is three named, distinct families, each with its own discovery method and its own invocation method. This lesson covers both, because the MCPA exam's Interactions and Execution domain, its largest at 26 percent of the exam, tests both together.

## The Concept

Start from the JSON-RPC 2.0 envelope every MCP message rides on. A message carries `jsonrpc`, a `method`, and optional `params`. Whether it also carries an `id` decides everything else about how the receiver must treat it.

A **request** carries a non-null `id`, a number or a string the sender chose, usually just an incrementing counter. Because the id is present, the receiver has an obligation: answer it, exactly once, with a JSON-RPC response that repeats the same `id` and carries either a `result` or an `error`.

```json
{"jsonrpc": "2.0", "id": 7, "method": "tools/call", "params": {"name": "add", "arguments": {"a": 2, "b": 3}}}
```

```json
{"jsonrpc": "2.0", "id": 7, "result": {"content": [{"type": "text", "text": "5"}]}}
```

The id is not decoration. It is how a client with several requests in flight on one connection knows which pending call a given response belongs to. It matches the response to a promise by id, not by the order replies happen to arrive in.

A **notification** carries no `id` key at all.

```json
{"jsonrpc": "2.0", "method": "notifications/initialized"}
```

By definition, nothing is owed back. The sender already decided it does not need to wait for confirmation, so the receiver processes the notification if it recognizes the method and then does nothing further. This holds even when something goes wrong. If a notification names a method the receiver has never heard of, the receiver still cannot send an error, because an error is itself a kind of response, and a response needs an id to be keyed to. With no id, there is nowhere for that error to go. The only correct move is to drop the notification, silently or with a log line for your own debugging, and move on. Real MCP clients use notifications constantly for exactly this reason: `notifications/initialized` tells a server the client finished processing the initialize result, `notifications/progress` and `notifications/cancelled` narrate a request that is still in flight, and `notifications/tools/list_changed`, `notifications/resources/list_changed`, and `notifications/prompts/list_changed` tell a client one of its cached lists went stale. None of these need or get a reply.

Now turn from how a message is answered to what it can be about. A server built on MCP exposes its capabilities through three primitive families, and the exam expects you to place any given capability into the right one on sight.

A **tool** is a named, schema-typed action the model decides to invoke. Tools are model-controlled: given a task and a list of available tools, the model chooses when calling one serves the request, the same way it chooses words. A tool can have side effects, so a host should keep a human able to see or approve what is about to run.

A **resource** is addressable content, most often identified by a URI, that a host, an application, or a user attaches to the model's context. Reading a resource should stay side-effect free. The model does not usually decide to read a resource the way it decides to call a tool; something above the model, the host or the person using it, decides what context the model gets to see.

A **prompt** is a reusable message template a user explicitly selects, commonly surfaced as a slash command or a menu item in the host's interface. The server defines what the template says and what arguments it accepts, but a person, not the model, is the one who triggers it.

Two more primitives, sampling and roots, live on the client side of this same architecture; they let a server ask a client to run a model completion or share a working directory boundary. They earn their own lesson. This one stays on the three primitives a server exposes.

Each family follows the same two-method pattern: a discovery call that lists what is available, `tools/list`, `resources/list`, `prompts/list`, and an invocation call that uses one entry from that list, `tools/call`, `resources/read`, `prompts/get`. Both calls are ordinary requests. They carry an id, and they get a response, exactly the pattern from the first half of this lesson, now put to work.

```figure
mcpa-04-primitives
```

## Interactive Lab

The figure above draws both halves of this lesson. The top panel's response arrow travels the full distance back to the client carrying the same id as the request that caused it. The middle panel's reply arrow stops short and never arrives, because there was no id to carry it back to. The bottom panel lays the three primitive families side by side with who decides to use each one.

Run `code/main.py`. The demo opens with the same `initialize` request lesson 01 modeled, then immediately sends `notifications/initialized`, the real MCP message a client sends right after reading the initialize result, and prints that no response came back. It lists and invokes one tool, one resource, and one prompt, then sends the same made-up method, `widgets/list`, twice, once as a request and once as a notification, so you can watch the exact same unknown method produce a JSON-RPC error in one case and total silence in the other.

```bash
python3 code/main.py
```

Read the two `widgets/list` lines against the figure's top two panels; they are the same contrast in text instead of boxes and arrows.

## Practice Lab

Open `code/main.py` and find `_call_tool`. Call `client.call_tool("add", {"a": 2})`, leaving out the required `b` argument, and confirm the response is an error with code `main.INVALID_PARAMS`, not `main.METHOD_NOT_FOUND`. The method, `tools/call`, was perfectly valid; what failed was the argument list against the tool's own schema, one level below method resolution. That is why the two failures carry different codes even though both sound like "not found" in plain English.

Then register a second tool of your own in `build_demo_server`, give it two required arguments, and write one call that omits one of them. Confirm you get `INVALID_PARAMS` with your argument's name inside the `missing arguments` message, the same shape the `add` tool already produces. If your new tool's error looks different, you bypassed the shared validation path instead of reusing it.

## Shipped Artifact

`outputs/interaction-patterns-brief.md` is a one-page reference for this domain: the one rule that separates a request from a notification, the three primitives with the question each one answers about who decided to use it, the id-based response matching rule, and a table of the three JSON-RPC error codes this lesson's mock actually raises, with the condition that triggers each one. Keep it next to the code while you study; every fact in it traces back to a line `code/main.py` runs.

## Verify It

Run the tests with `python3 -m unittest discover code/tests`. They check that a request gets a response bearing its own id, that a notification, well formed or not, never gets anything back, that listing tools, resources, and prompts each returns exactly the family that was registered, that an unrecognized top-level method returns `METHOD_NOT_FOUND`, and that a known method called with a missing required argument returns `INVALID_PARAMS` instead. If a test fails, trust the mock over this document; the mock is what this track's own audit actually runs.

```bash
python3 -m unittest discover code/tests
```

## Capstone Connection

Lesson 09 assembles the MCPA capstone: a small client and server you exercise end to end and then defend, message by message, in a readiness review. The dispatcher built here is the routing core that capstone server reuses without modification: it tells a request from a notification by the presence of one field, answers each of the three primitive families through its own paired discovery and invocation methods, and keys every response to the id that asked for it. When the capstone review asks why a particular message got silence instead of an error, or why a capability showed up as a resource instead of a tool, the honest answer is the same one this lesson gives: look at the id, and look at who was supposed to decide.

## Key Terms

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Request | "A message" | A JSON-RPC message with a non-null id; the receiver must answer it with exactly one response |
| Notification | "A message" | A JSON-RPC message with no id; the receiver never sends anything back, even on error |
| Tool | "A function" | A named, schema-typed action the model decides to invoke; it can have side effects |
| Resource | "A file" | Addressable content, usually read by URI, that a host or user attaches to context |
| Prompt | "A canned message" | A reusable message template a user explicitly selects through the host |
| Response id | "A request number" | The value copied from a request into its response so a multiplexed connection can match them |

## Further Reading

- Model Context Protocol specification, version 2026-07-28, https://modelcontextprotocol.io/specification/2026-07-28, for the normative rule that a request gets a response and a notification does not, and for the tools, resources, and prompts server features.
- `phases/13-tools-and-protocols/10-mcp-resources-and-prompts` in this repository, a deeper implementation of the resource and prompt primitives against the current stateless profile.
- MCPA certification page, https://training.linuxfoundation.org/certification/model-context-protocol-associate-mcpa/, for how this domain is weighted on the exam.
- The `certifications/mcpa/research/source-verification-ledger.md` file in this repository, for the exam facts and their sources.
