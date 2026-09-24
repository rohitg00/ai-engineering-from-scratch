# The Schema Every Tool Call Has to Match

> A tool's description is a hint aimed at the model. Its inputSchema is the part nothing gets past: the client and the model build an argument object against it, and the server checks that object against it again before anything runs.

**Type:** Reference
**Languages:** Python
**Prerequisites:** Lesson 02
**Time:** ~45 minutes

## Learning Objectives

- Explain why a tool advertises an inputSchema and what that schema promises to the model and to the server
- Read the fields of a tool definition: name, description, inputSchema, and how properties and required work together
- Trace how an argument object is built on the client side and validated on the server side before a tool runs
- Distinguish a validation error from a successful execution and identify the JSON-RPC code that reports each
- Describe how a tool result carries typed, structured content back across the same connection

## The Problem

Lesson 02 established that a tool is a named, described, schema-typed action a server exposes. The name and the description are for a reader, human or model, working through natural language. But reading a description is not the same as constructing a correct argument object. "Create a ticket with a title and a priority" tells a reader what the tool is for. It does not tell a program whether priority is a string or an integer, whether it has to be one of a fixed set of values, or whether title can be left out entirely.

Without an agreed shape, a client has three bad options. It can guess the argument names and types from the description text and hope the server accepts them. It can hard-code the shape for one particular server and break the moment that server adds or renames a field. Or it can forward whatever the model produced and let the server crash, hang, or silently misbehave on a malformed request. None of those scale past a handful of hand-integrated tools, which is the same N times M problem earlier material named, now showing up once per call instead of once per system.

MCP closes this gap the way it closes the larger one: with data the client can read, not a convention it has to be told about out of band. Every tool carries an inputSchema, a JSON Schema document that states exactly which fields exist, what type each one is, which ones are required, and in many cases which values are even allowed. The schema is not documentation sitting next to the code. It is a machine-checkable contract, and this lesson is about reading it, building arguments against it, and enforcing it before a tool ever runs.

## The Concept

A tool definition returned from tools/list has three parts: a name, a description, and an inputSchema. The name and description are what a reader uses to decide whether a tool is relevant. The inputSchema is where this lesson lives, and it is ordinary JSON Schema, restricted in practice to a small, predictable subset.

At the top, an inputSchema almost always declares `"type": "object"`, because a tool call's arguments are a single JSON object, not a bare value. Inside it, `"properties"` maps each argument name to its own small schema: at minimum a `"type"`, such as string, integer, number, boolean, array, or object, and optionally an `"enum"`, a fixed list of the only values that field may hold. A `"required"` array lists which property names must be present; anything not listed is optional. Put together, a schema like `{"type": "object", "properties": {"priority": {"type": "string", "enum": ["low", "medium", "high"]}}, "required": ["priority"]}` states precisely what a valid call looks like, with no prose to misread.

Two different participants read that schema for two different reasons. The model, working through the client, reads it to construct the arguments object in the first place: it is the difference between guessing a field is called "urgency" and knowing it is called "priority" and must be "low", "medium", or "high". The server reads the same schema a second time, after the call arrives, to validate the arguments before the tool handler ever runs. That second read is not optional and not redundant. A client can be wrong, a model can hallucinate a field, and a server that trusts the client's construction without checking it is one bad argument away from running a handler on data it was never designed to receive.

Validation failure and execution failure are different things, and MCP keeps them different. A request whose arguments do not match the schema, an unrecognized method, or a malformed envelope is a protocol-level problem, and the server reports it as a JSON-RPC error object with a numeric code, most commonly -32602, Invalid params, keyed to the request's id. The tool handler never runs in that case. A request that matches the schema and then fails for a domain reason, such as a ticket system that happens to be down, is a different kind of failure the tool itself can choose to report inside a successful-looking result. This lesson only concerns the first kind: rejecting a call before it starts, because its shape is wrong.

When a call does pass validation, the result that comes back is structured the same way the request was. A tools/call response carries a result object whose content is a list of typed items, each with its own `"type"`, most often `"text"`, though a server can return other content types such as images or embedded resources. The value inside that content is not free text for a human to skim; it is the same structured, typed data the tool produced, serialized so the model can read specific fields back out of it. Structure crosses the wire in both directions: typed arguments go in, typed content comes back.

```figure
mcpa-03-schema-shape
```

## Interactive Lab

The figure above places a tool definition next to an argument object being checked against it: the name and description on top, the inputSchema below with its typed properties and required list, and a path from a candidate arguments object into a validation step that either lets the call through or turns it back with an error. Open `code/main.py` and run it. It builds a `create_ticket` tool whose inputSchema declares three properties: title and priority as required, with priority constrained to an enum, and points as an optional integer. The demo calls that tool four times: once with valid arguments, once with priority missing, once with points sent as a string instead of an integer, and once with priority set to a value outside the enum. Read the four responses in order and match each error message back to the specific schema keyword it violated: required, type, or enum. Then add a fourth property to the schema and confirm the validator catches an argument object that used to pass before your change.

```bash
python3 code/main.py
```

## Practice Lab

Extend the validator in `code/main.py` to catch one more mistake without changing its existing behavior. Give the `create_ticket` schema an `"additionalProperties": false` flag, then change `validate_arguments` so that when a schema sets that flag, an arguments object containing a key not listed in properties is rejected with Invalid params naming the unexpected field. Register a second tool of your own, such as `close_ticket`, whose inputSchema requires a ticket id typed as a string and an enum'd resolution field. Call it once with a correct argument object and once with a field your schema never declared, and confirm your new check rejects the second call the way a conformant server would.

## Shipped Artifact

`outputs/tool-schema-reference.md` is a compact reference for the fields inside a tool definition and the validation rules a conformant server applies before it runs a handler: what type, properties, required, and enum mean, what a client is expected to check before sending a call, and what a server must check regardless of what the client already did. Keep it next to an unfamiliar server's tool list when you need to know quickly whether a value you are about to send will pass.

## Verify It

Run the tests with `python3 -m unittest discover code/tests`. They assert the properties this lesson claims: that valid arguments pass and the tool runs, that a missing required field is rejected with Invalid params, that a wrong-typed field is rejected the same way, that a value outside an enum is rejected, and that a tool the server does not expose still returns a structured error instead of crashing the process. If a test fails, the validator and the lesson have drifted, and the validator is the source of truth for what a conformant check looks like.

## Capstone Connection

The capstone review asks you to justify a design end to end, and a design that cannot say what shape its own arguments take does not survive that review. Every tool you add to the capstone's ecosystem needs an inputSchema precise enough that a stranger's client could build a valid call without reading your source code, and a server that enforces that schema rather than trusting whatever arrives. Bring the schema reference back when you assemble that ecosystem, and check every tool in it against the same required, type, and enum rules this lesson covers.

## Key Terms

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| inputSchema | "The parameters" | The JSON Schema on a tool definition that declares the shape a valid arguments object must have |
| properties | "The fields" | The part of a schema that maps each argument name to its own type and optional constraints such as enum |
| required | "The mandatory fields" | An array of property names that must be present in the arguments object for a call to be valid |
| enum | "The allowed values" | A fixed list of values a property is restricted to; any other value fails validation |
| Invalid params | "A bad request" | JSON-RPC error code -32602, returned when arguments fail schema validation before the tool handler runs |

## Further Reading

- Model Context Protocol specification, version 2026-07-28, at modelcontextprotocol.io/specification/2026-07-28, for the normative shape of a tool definition and its inputSchema.
- Lesson 05, Tool Schema Design, under `phases/13-tools-and-protocols/05-tool-schema-design`, for how naming and parameter shape affect whether a model selects a tool correctly.
- The Model Context Protocol Associate certification page, at training.linuxfoundation.org/certification/model-context-protocol-associate-mcpa, for the exam this track prepares you for.
