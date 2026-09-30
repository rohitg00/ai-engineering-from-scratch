# The Contract Inside a Tool Definition

> An inputSchema is not a suggestion the model can approximate: a server checks arguments against it before a handler ever runs, and a broken argument still comes back as a result the model can read and fix.

**Type:** Reference
**Languages:** Python
**Prerequisites:** Lesson 07
**Time:** ~45 minutes

## Learning Objectives

- Name the fields on a tool definition beyond name and description, including outputSchema, icons, and annotations, and state the one thing inputSchema must never be
- Explain why JSON Schema 2020-12 is the default dialect for inputSchema and outputSchema, when a schema declares a different one explicitly, and what SEP-2106 loosened about which keywords a schema may use
- Trace how structuredContent conforms to outputSchema and why a server also serializes that same value into a text content block
- State the tool naming rules and why a host that aggregates several servers prefixes names instead of trusting serverInfo for uniqueness
- Separate an unknown tool, a protocol error, from arguments that fail a schema, a tool execution error with isError true, and explain why only the second one reliably reaches the model

## The Problem

The discovery step from lesson 07 gets a client a list of tools, each with a name and a description a model can read. A description is prose, though, and prose is not something a program checks an arguments object against. "Look up a product by its SKU" tells a reader what the tool does. It does not say whether the field is spelled sku or productId, whether it is a string or an integer, or what should happen if the call leaves it out entirely.

A tool definition closes that gap with a second, stricter part: inputSchema, a JSON Schema object every client and every server can read the same way. It is not documentation sitting beside the code. It is the shape an arguments object must have before a handler is allowed to run, and a conformant server checks it on every call, regardless of how carefully the client claims to have built the arguments already.

Getting that check right matters for a second reason the exam weights heavily. A schema violation and a made-up tool name look similar from a distance, both are "the call did not work," but MCP 2026-07-28 treats them completely differently on the wire. Confusing the two is one of the most common mistakes an implementation makes, and it is the specific correction this lesson makes over an easy but wrong intuition: that any invalid tools/call should come back as a JSON-RPC error.

## The Concept

A tool definition carries more than name, description, and inputSchema. The full set is: name, an optional title for display, description, optional icons, the required inputSchema, an optional outputSchema, optional annotations (hints such as readOnlyHint and destructiveHint, untrusted unless the server itself is trusted, covered in depth once you get to reading a full manifest), and an optional _meta. The one hard rule across all of it: inputSchema must be a valid JSON Schema object and must never be null. For a tool with no parameters, the recommended shape is `{"type": "object", "additionalProperties": false}`, which accepts only an empty object; `{"type": "object"}` alone would still accept an object carrying properties nobody asked for.

Both inputSchema and outputSchema are JSON Schema. When a schema has no $schema field, it defaults to JSON Schema 2020-12. A schema may declare a different dialect explicitly:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {"a": {"type": "number"}},
  "required": ["a"]
}
```

Before SEP-2106, inputSchema was restricted to type, properties, and required, which made composition keywords such as oneOf unusable. Since SEP-2106, inputSchema keeps type: object (arguments are always an object) but allows any other 2020-12 keyword, and outputSchema allows any valid JSON Schema at all, with no type: object requirement, because a tool's output can be an object, an array, or a primitive:

```json
{
  "type": "object",
  "oneOf": [
    {"properties": {"id": {"type": "string"}}, "required": ["id"]},
    {"properties": {"name": {"type": "string"}}, "required": ["name"]}
  ]
}
```

Two constraints apply once a schema can carry arbitrary JSON Schema. First, a $ref that resolves to a network URI, an absolute https address rather than a same-document pointer like #/$defs/Sku, must never be dereferenced automatically. A naive validator that fetches every $ref it meets hands an attacker a way to make the server issue requests to arbitrary hosts. An opt-in fetch mode may exist, but it has to be off by default, allowlisted, and bounded. Second, composition keywords (anyOf, oneOf, allOf, if/then/else) and $defs should be bounded, by depth, by subschema count, or by a time budget, so a pathological schema cannot turn validation itself into a denial of service.

outputSchema and structuredContent work together. structuredContent can be any JSON value, not only an object: an array of records or a bare number are both legal when outputSchema says so. When outputSchema exists, the server must return structuredContent that conforms to it, and for compatibility with a client that only reads text, the server should also serialize that same value into a text content block:

```json
{
  "content": [{"type": "text", "text": "{\"sku\": \"SKU-100\", \"priceUsd\": 24.99}"}],
  "structuredContent": {"sku": "SKU-100", "priceUsd": 24.99}
}
```

Names have rules too: 1 to 128 characters, case-sensitive, built only from letters, digits, underscore, hyphen, and dot, unique within one server. A host that aggregates tools from several servers can still collide on a name like search, which is why it prefixes names with a server identifier rather than leaning on serverInfo.name, which the specification explicitly does not guarantee to be unique.

Now the correction. When arguments fail inputSchema, a missing required field, a wrong type, a value outside an enum, an extra property a schema forbids, that is a tool execution error: a normal result with isError: true and content explaining what to fix. It is not a JSON-RPC error, and specifically not -32602. A protocol error, including -32602 for a tool name the server never advertised, or a request that fails the CallToolRequest schema itself, is reserved for problems the model cannot fix by trying better arguments. SEP-1303 made this split explicit after implementations kept reporting schema failures as protocol errors: a client only reliably shows tool execution errors to the model, so a validation failure hidden inside a protocol error means the model repeats the same mistake with no way to learn why.

```figure
mcpa-08-schema-contract
```

## Interactive Lab

The figure places one tool's inputSchema and outputSchema on the left, next to a validate step that either lets a call through to the handler or turns it back. Follow the two outcomes: a schema failure produces a result with isError: true, on a dashed path that never reaches the handler; a pass runs the handler and produces structuredContent next to its text mirror. On the right, a name the server never advertised takes an entirely separate path straight to a protocol error, -32602, because there is no schema to check against a tool that does not exist. Open code/main.py and run it, then match each printed response back to which of the two paths produced it.

```bash
python3 code/main.py
```

Read the transcript in order: a valid call to lookup_product, then four ways to fail its schema (missing sku, an enum value outside region, sku sent as the wrong type, and an extra property the schema forbids), then the no-parameter server_time tool called correctly and then with a property it does not accept, and finally a call naming a tool the server never registered. Every one of the schema failures comes back as isError: true content. Only the last one, the unknown name, comes back as a JSON-RPC error.

## Practice Lab

Extend build_catalog_server in code/main.py with a third tool, list_regions, whose outputSchema describes an array of strings at the root rather than an object, matching the array and primitive structuredContent SEP-2106 allows. Give it an empty inputSchema using the recommended no-parameter form, and have its handler return a plain Python list. Confirm with validate_arguments that the array you return has no required-field or type errors against your new schema (the validator in this lesson checks type, properties, required, enum, and additionalProperties, the same subset a production JSON Schema library would extend to the full 2020-12 vocabulary). Then try registering a tool whose inputSchema contains a $ref pointing at a different network host than the one already refused in attempt_network_ref_registration, and confirm the registration is refused the same way, before any call against it could ever run.

## Shipped Artifact

outputs/tool-schema-reference.md is a one-page reference: every field on a tool definition, the JSON Schema dialect and $ref rules, the outputSchema and structuredContent contract, the tool naming rules, and a table contrasting the two error channels with concrete examples of each. Keep it open next to an unfamiliar server's tools/list result when you need to know quickly whether a call you are about to send will pass.

## Verify It

Run the tests from the lesson directory:

```bash
python3 -m unittest discover code/tests
```

They check the claims in this lesson: valid arguments produce structuredContent that itself passes validation against outputSchema, a missing required field and a wrong type and an enum violation and a forbidden extra property all come back as isError: true rather than a JSON-RPC error, the no-parameter schema accepts an empty object but rejects one with an extra property, an unknown tool name comes back as a protocol error instead of isError, a network $ref is refused at registration, and the tool naming rules accept and reject the right names. The repository's wire checker also validates the lesson's transcript against the 2026-07-28 rules:

```bash
python3 scripts/check_mcpa_wire.py certifications/mcpa/lessons/08-tool-schemas-and-structured-content
```

## Capstone Connection

The capstone review asks you to defend every tool in an ecosystem you assemble, and "the schema will catch it" is only true if the schema is precise and the server actually enforces it as a tool execution error rather than a protocol error a client might hide from the model. Bring the naming rules and the $ref refusal back when a tool in your capstone design accepts user-shaped input or references a shared schema fragment, and bring the two-channel error split back whenever you are deciding how a handler should report a problem it finds.

## Key Terms

| Term | Meaning |
|------|---------|
| inputSchema | The required JSON Schema object on a tool definition that a valid arguments object must satisfy |
| outputSchema | An optional JSON Schema object that structuredContent must conform to |
| structuredContent | Any JSON value a tool result returns, validated against outputSchema when one exists |
| additionalProperties | A schema keyword that, set to false, rejects an arguments object carrying an undeclared property |
| $ref | A schema keyword that can point at another location; a network URI target must never be dereferenced automatically |
| Tool execution error | A normal result with isError true, reporting a problem such as a schema failure that the model can read and correct |
| Protocol error | A JSON-RPC error such as -32602, reporting a problem the model cannot fix by adjusting arguments, such as an unknown tool name |
| Tool naming rules | 1 to 128 characters, case-sensitive, limited to letters, digits, underscore, hyphen, and dot, unique within a server |

## Further Reading

- [MCP specification 2026-07-28, Tools](https://modelcontextprotocol.io/specification/2026-07-28/server/tools), for the normative fields, schema rules, and error handling this lesson covers
- [MCP specification 2026-07-28, JSON Schema Usage](https://modelcontextprotocol.io/specification/2026-07-28/basic/index#json-schema-usage), for the dialect and $ref resolution rules
- [SEP-2106, tools inputSchema and outputSchema conform to JSON Schema 2020-12](https://modelcontextprotocol.io/seps/2106-json-schema-2020-12)
- [SEP-1303, input validation errors as tool execution errors](https://modelcontextprotocol.io/seps/1303-input-validation-errors-as-tool-execution-errors)
- `certifications/mcpa/research/mcp-2026-07-28-brief.md`, sections 5 and 10
- `phases/13-tools-and-protocols/05-tool-schema-design`, on naming and parameter design for model selection
- `phases/13-tools-and-protocols/28-mcp-tool-contracts-and-content`, on the JSON Schema runtime boundary and content blocks
