# The Tool Interface — Why Agents Need Structured I/O

> A language model produces tokens. A program takes actions. The gap between those two is the tool interface: a contract that lets the model request an action and the host execute it. Every 2026 stack — function calling on OpenAI, Anthropic, and Gemini; MCP's `tools/call`; A2A's task parts — is a different encoding of the same four-step loop. This lesson names the loop and shows the minimum machinery to run it.

**Type:** Learn
**Languages:** Python (stdlib, no LLM)
**Prerequisites:** Phase 11 (LLM completion APIs)
**Time:** ~45 minutes

## Learning Objectives

- Explain why an LLM that can only generate text cannot, on its own, take actions against the real world.
- Draw the four-step tool-call loop (describe → decide → execute → observe) and name who owns each step.
- Write a tool description as three parts: name, JSON Schema input, and a deterministic executor function.
- Distinguish pure and side-effecting tools and state why the split matters for safety.

## The Problem

An LLM emits a probability distribution over the next token. That is the entire output surface. If you ask a chat model "what is the weather in Bengaluru right now," it can write a plausible sentence, but it cannot dial into a weather API. The sentence might be right by coincidence or three days stale.

Closing that gap is the purpose of the tool interface. The host program — your agent runtime, Claude Desktop, ChatGPT, Cursor, or a custom script — advertises a list of callable tools to the model. The model, when it decides an action is needed, emits a structured payload naming a tool and its arguments. The host parses that payload, runs the tool for real, and feeds the result back. The loop continues until the model decides no more calls are needed.

The first version of this contract shipped in June 2023 as OpenAI's "functions" parameter. Anthropic followed with `tool_use` blocks in Claude 2.1. Gemini added `functionDeclarations` a few months later. Every provider now exposes the same shape: a JSON-Schema-typed tool list in, a JSON-payload tool call out. The Model Context Protocol (November 2024) generalized the contract so one tool registry serves every model. A2A (April 2026, v1.0) layered the same primitive for agent-to-agent delegation.

The four-step loop is the invariant underneath all of these. Everything else in Phase 13 is an elaboration.

## The Concept

### Step one: describe

The host declares each tool with three fields.

- **Name.** A stable, machine-readable identifier. `get_weather`, not "weather thing".
- **Description.** A one-paragraph natural-language brief. "Use when the user asks about current conditions for a specific city. Do not use for historical data."
- **Input schema.** A JSON Schema object (draft 2020-12) describing the tool's arguments.

The model receives the list. Modern providers serialize these declarations into the system prompt using a provider-specific template, so you as the caller only deal with the structured form.

### Step two: decide

Given the user's message and the available tools, the model chooses one of three behaviors.

1. **Answer directly** in text. No tool call.
2. **Call one or more tools.** Emit structured call objects. Under `parallel_tool_calls: true` (default on OpenAI and Gemini, opt-in on Anthropic) the model can emit multiple calls in one turn.
3. **Refuse.** Strict-mode structured outputs can produce a typed `refusal` block instead of a call.

A tool call payload has three stable fields: a call `id`, a tool `name`, and a JSON `arguments` object. The id exists so the host can correlate the later result with the specific call, which matters when parallel calls come back out of order.

### Step three: execute

The host receives the call, validates arguments against the declared schema, and runs the executor. Invalid arguments mean the model hallucinated a field or used the wrong type — a very common failure mode on weak models. Production hosts do one of three things on invalid arguments: fail fast and surface the error to the model, repair the JSON with a constrained parser, or retry the model with the validation error included in the prompt.

The executor itself is ordinary code. Python, TypeScript, a shell command, a database query. It produces a result, which is usually a string but can be any JSON value or a structured content block (text, image, or resource reference in MCP). The result must be serializable.

### Step four: observe

The host appends the tool result to the conversation (as a `tool` role message with matching `id`) and re-invokes the model. The model now has the tool output in context and can produce a final answer or request more calls. This continues until the model stops emitting calls or the host hits a safety limit on iteration count.

### The trust split

Tools come in two flavors that matter for safety.

- **Pure.** Read-only, deterministic, no side effects. `get_weather`, `search_docs`, `get_current_time`. Safe to call speculatively.
- **Consequential.** Mutates state, spends money, touches user data. `send_email`, `delete_file`, `execute_trade`. Must be gated.

Meta's 2026 "Rule of Two" for agent security says a single turn may combine at most two of: untrusted input, sensitive data, consequential action. The tool interface is where you enforce that rule — by rejecting calls, requiring user confirmation, or escalating scopes. See Phase 13 · 15 for the full security chapter and Phase 14 · 09 for agent-level permission policies.

### Where the loop lives

| Context | Who describes | Who decides | Who executes |
|---------|---------------|-------------|--------------|
| Single-turn function calling (OpenAI/Anthropic/Gemini) | App developer | LLM | App developer |
| MCP | MCP server | LLM via MCP client | MCP server |
| A2A | Agent Card publisher | Calling agent | Called agent |
| Web browser (function-calling agent) | Browser extension / WebMCP | LLM | Browser runtime |

Everywhere, the same four steps. The column names change; the structure does not.

### Why not just prompt the model to emit JSON?

"Ask the model to reply in JSON" was the pre-function-calling pattern. It fails ~5 to 15 percent of the time on frontier models and far more on smaller models. Failure modes include missing braces, trailing commas, hallucinated fields, and wrong types. You then need a JSON repair pass, a retry, or a constrained decoder.

Native function calling is better for three reasons. First, the provider trains the model end-to-end on the exact call shape, so valid-JSON rate climbs to 98 to 99 percent on strict mode. Second, the call payload sits in its own protocol slot, not inside free-text — so a tool call never leaks into the user-visible reply. Third, providers enforce schema compliance with constrained decoding (OpenAI's strict mode, Anthropic's `tool_use`, Gemini's `responseSchema`). The output is guaranteed to validate.

Phase 13 · 02 walks the three provider APIs side by side. Phase 13 · 04 goes deep on structured outputs.

### Circuit breakers

The loop terminates when the model stops emitting calls or the host hits a maximum turn count. Production hosts set this to between 5 and 20 turns. Beyond that, you are almost certainly in a loop the model cannot exit. Claude Code defaults to 20; OpenAI Assistants to 10; Cursor's agent mode to 25.

The alternative — unbounded loops — shows up every six months as "agent spent $400 in API calls overnight" post-mortems. Do not ship without a bound.

Phase 14 · 12 covers error recovery and self-healing in depth; Phase 17 covers production rate limits.

### Where Phase 13 goes from here

- Lessons 02 through 05 polish the provider-level tool-call surface.
- Lessons 06 through 14 generalize the loop into MCP.
- Lessons 15 through 18 defend the loop against hostile servers, adversarial users, and unauthenticated remote auth surfaces.
- Lessons 19 through 22 extend the pattern to agent-to-agent collaboration, observability, routing, and packaging.
- Lesson 23 ships a complete ecosystem using every primitive.

Every remaining lesson is an elaboration of this four-step loop. Hold it in mind as the invariant.

## Use It

`code/main.py` runs the four-step loop without an LLM. A fake "decider" function simulates the model by pattern-matching on the user message; the executor, schema validator, and observe-step harness are real. Run it to see the full request/response choreography with printable intermediate state, then replace the fake decider with any real provider in a later lesson.

What to look at:

- The tool registry holds three fields per tool: name, description, schema, and an executor reference.
- The validator is a minimal JSON Schema subset (types, required, enum, min/max) written in stdlib only. Phase 13 · 04 ships a fuller one.
- The loop bounds iteration count at five. Production agents need exactly this kind of circuit breaker.

## Ship It

This lesson produces `outputs/skill-tool-interface-reviewer.md`. Given a draft tool definition (name + description + schema + executor outline), the skill audits it for loop fitness: is the name machine-stable, is the description a complete usage brief, does the schema use JSON Schema 2020-12 correctly, and is the pure-vs-consequential classification explicit.

## Exercises

1. Add a fourth tool to `code/main.py` called `get_stock_price(ticker)`. Write its description as "Use when the user asks for a current stock price by ticker. Do not use for historical prices or market summaries." Run the harness and confirm the fake decider routes queries mentioning tickers to the new tool.

2. Break the schema validator. Pass a call whose `arguments` object is missing a required field, and confirm the host rejects it before execution. Then pass a call with an extra unknown field. Decide: should the host reject or ignore? Justify your choice with a safety argument.

3. Classify each tool in the harness as pure or consequential. Add a `consequential: true` flag to the registry entries that need it, and change the loop to print a "would confirm with user" line whenever a consequential tool is chosen. This is the shape of the confirmation gate every production host needs.

4. Draw the four-step loop on paper with the provider-column table above filled in for your favorite client (Claude Desktop, Cursor, ChatGPT, or a custom stack). Cross-reference with the MCP-specific variant in Phase 13 · 06.

5. Read OpenAI's function-calling guide top to bottom. Identify the one field that sits in the request but not in the four-step loop as presented here. Explain what it adds and why it is convenient rather than essential.

## Key Terms

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Tool | "A thing the model can call" | A triple of name + JSON-Schema-typed input + executor function |
| Function calling | "Native tool use" | Provider-level API support for emitting structured tool calls instead of prose |
| Tool call | "The model's request to act" | A JSON payload with `id`, `name`, `arguments` emitted by the model |
| Tool result | "What the tool returned" | The executor's output, wrapped in a `tool` role message with matching id |
| Parallel tool calls | "Many calls at once" | Multiple call objects in one model turn, independent and orderable by id |
| Strict mode | "Guaranteed JSON" | Constrained decoding that forces the model's output to validate against the declared schema |
| Pure tool | "Read-only tool" | No side effects; safe to re-run |
| Consequential tool | "Action tool" | Mutates external state; requires gate, audit, or user confirmation |
| Four-step loop | "The tool-call cycle" | describe → decide → execute → observe |
| Host | "Agent runtime" | The program that holds the tool registry, calls the model, and runs the executor |

## Further Reading

- [OpenAI — Function calling guide](https://platform.openai.com/docs/guides/function-calling) — canonical reference for OpenAI-style tool declarations and call shapes
- [Anthropic — Tool use overview](https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/overview) — Claude's `tool_use` / `tool_result` block format
- [Google — Gemini function calling](https://ai.google.dev/gemini-api/docs/function-calling) — `functionDeclarations` and parallel-call semantics in Gemini
- [Model Context Protocol — Specification 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25) — the provider-agnostic generalization of the tool interface
- [JSON Schema — 2020-12 release notes](https://json-schema.org/draft/2020-12/release-notes) — the schema dialect every modern tool API speaks
