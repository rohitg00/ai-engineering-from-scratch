# Tool Schema Reference

A one-page reference for the MCPA "Architecture and Components" domain: the fields inside a tool definition, the JSON Schema rules that govern inputSchema and outputSchema, and the two error channels a conformant 2026-07-28 server keeps separate.

## Fields on a tool definition

- **name**: unique within one server; see the naming rules below.
- **title**: optional human-readable display name.
- **description**: natural-language text a model reads to decide relevance.
- **icons**: optional, https or data URIs only, same origin as the server.
- **inputSchema**: a JSON Schema object, required, never null.
- **outputSchema**: optional JSON Schema object constraining structuredContent.
- **annotations**: optional hints (readOnlyHint, destructiveHint, idempotentHint, openWorldHint); untrusted unless the server itself is trusted.

## JSON Schema dialect

- No `$schema` field present: the schema defaults to JSON Schema 2020-12.
- A schema may declare a different dialect explicitly with `$schema`.
- Since SEP-2106, inputSchema keeps `type: object` but allows any other 2020-12 keyword (`oneOf`, `anyOf`, `allOf`, `if`/`then`/`else`, `$defs`); outputSchema allows any valid JSON Schema, with no `type: object` requirement.
- No-parameter tools: `{"type": "object", "additionalProperties": false}` is the recommended form; it accepts only an empty object.

## $ref rules

- Never automatically dereference a `$ref` that resolves to a network URI (only a same-document pointer such as `#/$defs/Foo` is safe to follow automatically).
- An opt-in fetch mode, if offered at all, must be disabled by default, allowlisted, timeout-bounded, and size-bounded.
- A schema that fails to validate because of an unresolved external `$ref` should be rejected, not treated as permissive.
- Composition keywords (`anyOf`, `oneOf`, `allOf`, `if`/`then`/`else`) and `$defs` should be bounded (depth, subschema count, or a time budget) against denial of service.

## outputSchema and structuredContent

- `structuredContent` accepts any JSON value: an object, an array, a string, a number, a boolean, or null.
- When outputSchema exists, the server must return structuredContent that conforms to it, and the client should validate it.
- For compatibility, a tool that returns structuredContent should also serialize the same value into a `text` content block.

## Tool naming rules

- 1 to 128 characters, case-sensitive.
- Allowed characters: `A-Z`, `a-z`, `0-9`, underscore, hyphen, dot.
- No spaces, commas, or other special characters.
- Unique within one server; an aggregator prefixes names with a server identifier, since `serverInfo.name` is not guaranteed unique.

## The two error channels

| Situation | Channel | Example |
|---|---|---|
| The named tool does not exist on this server | JSON-RPC error | `-32602` Invalid params |
| The request itself fails the CallToolRequest schema | JSON-RPC error | `-32602` Invalid params |
| Arguments fail the tool's own inputSchema | Tool execution error | result with `isError: true` |
| A business rule inside the handler rejects the call | Tool execution error | result with `isError: true` |

A schema-invalid argument is never `-32602`. That code is reserved for a request the server cannot even attempt to run, such as a tool name it never advertised. Anything the model could fix by trying again with different arguments belongs in a normal result with `isError: true`, because only that channel reliably reaches the model's context (SEP-1303).

## Exam facts for this domain

- Architecture and Components is part of the MCPA blueprint.
- The exam is aligned to MCP specification 2026-07-28.
- Source: `certifications/mcpa/research/mcp-2026-07-28-brief.md`, sections 5 and 10.
