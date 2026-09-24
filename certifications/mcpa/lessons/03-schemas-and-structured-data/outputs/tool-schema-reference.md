# Tool Schema Reference

A one-page reference for the MCPA "Architecture and Components" domain: the fields inside a tool definition and the validation rules a conformant server applies before it runs a handler.

## The fields of a tool definition

- **name**: the identifier a client uses in a tools/call request; unique within one server.
- **description**: natural-language text a model reads to decide whether the tool is relevant.
- **inputSchema**: a JSON Schema object that declares the shape a valid arguments object must have.

## Inside an inputSchema

- **type**: almost always `"object"` at the top level, since a tool call's arguments are one JSON object.
- **properties**: maps each argument name to its own schema, at minimum a `type`.
- **required**: an array of property names that must be present; anything left off is optional.
- **enum**: an optional fixed list of values a property is restricted to.

## What the client checks, before sending

1. Build the arguments object using only property names declared in `properties`.
2. Include every name listed in `required`.
3. Match each property's declared `type`, and stay inside its `enum` when one is present.

## What the server checks, before running the handler

1. Re-validate the arguments against its own copy of the schema. Never trust the client's construction.
2. Reject a request that fails validation with a JSON-RPC error, code -32602 (Invalid params), before the handler runs.
3. Only after validation passes, invoke the handler and return a result.

## Reading a validation error

| Failure | Example | Error code |
|---|---|---|
| Missing required field | `priority` left out of the arguments | -32602 Invalid params |
| Wrong type | `points` sent as a string instead of an integer | -32602 Invalid params |
| Enum violation | `priority` set to a value outside its enum | -32602 Invalid params |
| Unknown tool | `name` does not match any registered tool | -32601 Method not found |
| Malformed envelope | Request missing `jsonrpc`, `method`, or `id` | -32600 Invalid Request |

## Structured results

A successful `tools/call` response returns a `result` whose `content` is a list of typed items, most often `type: "text"`, carrying the same structured data the tool produced back to the model.

## Exam facts for this domain

- Architecture and Components is 14 percent of the MCPA exam.
- The exam is aligned to MCP specification 2026-07-28.
- Source: MCPA certification page and the source-verification ledger in this repository.
