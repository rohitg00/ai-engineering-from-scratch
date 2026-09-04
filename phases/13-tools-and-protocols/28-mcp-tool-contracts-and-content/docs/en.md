# MCP Tool Contracts and Content

> A tool is safe to automate only when discovery, arguments, results, pagination, and transport metadata agree on one contract.

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 13, Lessons 07, 09, and 10
**Time:** ~120 minutes

## Learning Objectives

- Define tool inputs and outputs with JSON Schema 2020-12.
- Validate structured results without assuming they are JSON objects.
- Choose between text, image, audio, resource links, and embedded resources.
- Reject unsafe `x-mcp-header` definitions before a tool reaches the model.
- Encode parameter-header values and verify exact header-to-body parity.
- Traverse cursor pagination without interpreting cursor values.
- Bound and authorize `completion/complete` suggestions.

## The Problem

Calling a Python function is easy. Calling a remote capability through an AI host is a contract problem.

The server publishes a descriptor. The client turns that descriptor into model context and user interface. The model creates arguments. A gateway may route the request from mirrored headers. The server executes the tool. The client then decides whether the result is safe and valid enough to return to the model.

One weak boundary corrupts the whole chain.

Consider five failures:

- The descriptor says the result is an object, but the server returns an array.
- The client stops pagination when `nextCursor` is an empty string.
- A token parameter is mirrored into an HTTP header and becomes visible to intermediaries.
- A Unicode routing value is sent as a raw header, then the gateway and origin interpret different bytes.
- A completion endpoint suggests a production environment to a caller who cannot access it.

None of these failures is fixed by better prompting. They require explicit protocol and application contracts.

## The Contract Pipeline

Treat each tool call as five gates:

1. **Discover.** Read a deterministic, paginated tool list.
2. **Admit.** Validate each descriptor and apply local security policy.
3. **Invoke.** Validate arguments and build transport metadata.
4. **Execute.** Run the handler and classify failures correctly.
5. **Consume.** Validate content blocks and structured output before model use.

```figure
mcp-contract-pipeline
```

The host owns the admission and consumption gates. A server cannot force a client to trust its annotations, schemas, or outputs.

## JSON Schema Is a Runtime Boundary

In MCP `2026-07-28`, `inputSchema` and `outputSchema` use JSON Schema. When `$schema` is absent, the default dialect is 2020-12.

The input schema must be a schema object. A tool with no arguments should still say exactly what it accepts:

```json
{
  "type": "object",
  "additionalProperties": false
}
```

This is stricter than `{ "type": "object" }`, which accepts arbitrary properties.

An output schema is optional. Once a server publishes one, every complete tool
result commits to returning conforming `structuredContent`, including results
with `isError: true`. The error flag classifies execution outcome; it does not
waive the published output contract. Clients should validate the result instead
of trusting the descriptor.

### Structured content is any JSON value

Do not hard-code `structuredContent` as a dictionary. It can be:

- an object;
- an array;
- a string;
- a number;
- a boolean;
- `null`.

This tool returns an array:

```json
{
  "name": "tag_catalog",
  "inputSchema": {
    "type": "object",
    "additionalProperties": false
  },
  "outputSchema": {
    "type": "array",
    "items": {"type": "string"}
  }
}
```

Its successful result is valid:

```json
{
  "resultType": "complete",
  "content": [
    {
      "type": "text",
      "text": "[\"contracts\", \"mcp\", \"stateless\"]"
    }
  ],
  "structuredContent": ["contracts", "mcp", "stateless"],
  "isError": false
}
```

For compatibility, structured results should also include serialized JSON in a text block. The text is not the validation source. `structuredContent` is.

### A small validator still teaches the boundary

The lesson uses a deliberate JSON Schema subset because it stays inside the Python standard library. It checks the mechanisms used by the sample tools:

- object, array, string, integer, number, boolean, and null types;
- required properties;
- `additionalProperties: false`;
- array items;
- enum values;
- minimum string length.

This is not a replacement for a complete production validator. The reusable lesson is where validation happens: after discovery for descriptors, before execution for arguments, and before consumption for structured results.

## Content Blocks Carry Different Costs

The `content` array can combine several content types.

| Type | Use it for | Main boundary |
|------|------------|---------------|
| `text` | Human and model-readable summaries | Treat text as untrusted output |
| `image` | Visual evidence encoded as base64 | Validate media type and size |
| `audio` | Spoken or recorded output encoded as base64 | Validate media type and duration limits |
| `resource_link` | A URI the client may fetch later | Reauthorize the later resource read |
| `resource` | Data embedded directly in the result | Enforce payload and content limits now |

A resource link is not proof that the resource appears in `resources/list`. It is a reference returned by this tool call. The client still applies its resource policy when it follows the URI.

An embedded resource avoids another round trip but increases the current response size. Use links for large or independently changing artifacts. Use embedded resources for small evidence that must travel atomically with the result.

The lesson's `evidence_bundle` result includes all five types. The client validates each block before accepting the result.

## `x-mcp-header` Is Routing Metadata

A property inside `inputSchema` may declare `x-mcp-header`. Over Streamable HTTP, the client mirrors that argument into `Mcp-Param-{name}`.

```json
{
  "region": {
    "type": "string",
    "x-mcp-header": "Region"
  }
}
```

With `region: "eu-west"`, the transport can emit:

```http
Mcp-Param-Region: eu-west
```

The annotation exists so a load balancer, gateway, or policy engine can route without parsing the JSON body. It is not a place to put credentials.

The protocol constrains the annotation:

- the header name is non-empty and follows HTTP field-name token syntax;
- header names are unique without regard to case;
- the property type is string, integer, or boolean;
- `number` is not allowed;
- the annotation appears only on a direct member of `inputSchema.properties`;
- integer values stay within `-9007199254740991` through `9007199254740991`.

The location rule is syntactic and fail-closed. Walk the entire schema tree,
not just the properties your validator happens to understand. Reject an
annotation under a nested object's `properties`, a `oneOf` branch, `items`, a
definition reached by `$ref`, or any output schema. Resolving a reference does
not turn the referenced node into a direct top-level property.

This lesson adds a deployment policy: reject descriptors that mirror names such as `password`, `secret`, `token`, `api_key`, or `authorization`. The official specification advises server authors not to mirror sensitive parameters. A client can turn that advice into a hard admission rule.

Audit the header name, not its value. The sample code records `Mcp-Param-Region` while keeping `eu-west` out of the audit event.

### Encode values before building HTTP headers

A parameter value may travel as plain text only when it is a non-empty string
of visible ASCII characters from `!` through `~` and does not resemble the
encoding sentinel. Everything else uses this exact form:

```text
=?base64?{Base64UTF8}?=
```

`Base64UTF8` is standard base64 over the exact UTF-8 bytes. Do not trim,
normalize, or replace the value first. Encode Unicode, empty strings, spaces,
tabs, control characters, CR or LF, leading or trailing whitespace, and any
value beginning with `=?base64?`. Encoding a sentinel-looking value again is
what lets the receiver recover the literal original text instead of decoding
it as transport syntax.

Booleans render as lowercase `true` or `false`. Integers render in base 10 and
must stay inside the JavaScript safe integer range. Values outside that range
are rejected instead of rounded by an intermediary.

### The server checks the mirrored copy

Header generation is only the client half. At the Streamable HTTP boundary,
the server must:

1. find recognized `Mcp-Param-*` names without regard to header-name case;
2. decode the exact base64 sentinel form when present;
3. compare the decoded text with the corresponding JSON body argument exactly;
4. reject a missing, duplicated, unexpected, malformed, or mismatched
   recognized header before dispatch.

The rejection is HTTP `400` with JSON-RPC error code `-32020`. Neither the
body value nor its encoded header form belongs in the audit record. Record the
recognized header name and the rejection category only.

`code/main.py` models this boundary directly. [Lesson 09](../../09-mcp-transports/)
covers the wider Streamable HTTP validation order, including method and
protocol-version parity.

## Pagination Cursors Are Opaque

MCP list operations use cursor pagination. The server selects page size and cursor format. The client gets one decision:

```python
if result.get("nextCursor") is None:
    break
cursor = result["nextCursor"]
```

Do not write this:

```python
if not result.get("nextCursor"):
    break
```

An empty string is a valid cursor. Truthiness would stop too early.

Clients must not decode a cursor, increment it, compare it with a prior cursor for ordering, or infer a page number. A server may sign a cursor, bind it to a catalog version, or map it to private state. That is the server's implementation detail.

The sample server deliberately returns `""` after the first page. The client must send that exact value on the second request. Its trace is:

```text
<first request with no cursor>
<second request with cursor "">
```

Invalid cursors produce JSON-RPC invalid params, code `-32602`.

## Completion Is an Authorization Surface

`completion/complete` provides suggestions for prompt arguments and resource-template arguments. It is useful for interactive forms, but it can leak names that ordinary list methods protect.

A completion request names a reference and the argument being completed:

```json
{
  "method": "completion/complete",
  "params": {
    "ref": {
      "type": "ref/prompt",
      "name": "deployment_review"
    },
    "argument": {
      "name": "environment",
      "value": "st"
    }
  }
}
```

The result returns at most 100 values and may report `total` plus `hasMore`.

Apply the same authorization boundary used by the referenced prompt or resource. An analyst in the sample receives `development` and `staging`. Only an operator can receive `production`.

Production completion also needs:

- input validation;
- caller-aware filtering;
- request debouncing in the client;
- rate limiting in the server;
- bounded result counts;
- logs that do not expose sensitive suggestion values.

Completion is assistance, not discovery bypass.

## Two Error Layers

Keep protocol errors separate from tool execution errors.

Use a JSON-RPC error when the MCP request cannot be dispatched correctly:

- unknown tool name;
- malformed request shape;
- missing request metadata;
- invalid cursor.

Use a complete tool result with `isError: true` when the invocation reached the tool and the tool reports an actionable failure:

- a report source is unavailable;
- a date is outside the supported range;
- a business rule rejects the requested operation.

Models can often repair a tool execution error. They cannot repair a server that violated its own output schema.

If the tool declares an output schema, model an actionable failure inside that
schema. The sample `route_report` failure returns its requested region with
`accepted: false`, alongside human-readable error text and `isError: true`.

## Build It

`code/main.py` builds both sides of the boundary with the Python standard library.

The server implements:

- per-request MCP metadata validation;
- `server/discover` with tools and completions capabilities;
- deterministic `tools/list` pagination;
- four tool descriptors, including one that must be rejected;
- array structured output;
- every current tool content block type;
- a Streamable HTTP parity gate that decodes recognized parameter headers and
  returns HTTP `400` plus JSON-RPC `-32020` on mismatch;
- authorized and rate-limited completion.

The client implements:

- descriptor admission;
- full-tree `x-mcp-header` placement validation and sensitive-field policy;
- exact plain-visible-ASCII or base64 UTF-8 value encoding;
- an opaque cursor loop that follows an empty string;
- argument and result validation;
- content-block validation;
- header audit events containing names but not values.

The deliberately unsafe descriptor is teaching data. It proves that one rejected tool does not prevent valid tools from loading.

## Use It

From the repository root:

```bash
cd phases/13-tools-and-protocols/28-mcp-tool-contracts-and-content/code
python3 main.py
python3 -m unittest discover tests -v
```

The demo prints admitted tools, the rejected descriptor, both pagination
requests, structured array content, content-block types, mirrored header
names, whether the value required encoding, the HTTP parity status, and
caller-filtered completion values.

## Interactive Lab

Open `code/main.py` and locate `TOOLS`.

1. Change `tag_catalog.outputSchema.type` from `array` to `object`.
2. Run the demo. The client should reject the returned array.
3. Restore the schema.
4. Keep the first page's `nextCursor` as `""`, then make the final page return
   `nextCursor: None` instead of omitting the field.
5. Run the tests and compare the cursor trace.
6. Add `x-mcp-header: "Authorization"` to a string property.
7. Confirm descriptor admission rejects it before invocation.
8. Try `region` values containing Unicode, a newline, surrounding spaces, and
   the literal text `=?base64?SGVsbG8=?=`. Decode each emitted header and prove
   the original value survives exactly.
9. Move the annotation under `oneOf`, `items`, or a `$ref` definition. Confirm
   each descriptor is rejected even if that branch is never used by the demo.
10. Remove the recognized header or change its decoded value. Confirm the HTTP
    boundary returns status `400` and JSON-RPC code `-32020`.

The point is not to memorize a JSON shape. It is to watch each gate fail at the boundary that owns it.

## Practice Lab

Extend the contract lab with a `search_evidence` tool.

Requirements:

1. Its input schema accepts `query`, `limit`, and a safe `region` routing field.
2. Its output schema is an array of objects with `uri`, `title`, and `score`.
3. The result includes compatibility text and a resource link per item.
4. Arguments reject unknown properties.
5. `limit` is bounded by application validation.
6. A caller without access to one URI never sees that URI through completion or tool output.
7. Tests include a nonconforming score, an invalid header annotation, and a two-page list.
8. Header-value tests cover visible ASCII, Unicode, control characters,
   whitespace, sentinel-looking text, and both JavaScript-safe integer bounds.
9. The HTTP fixture accepts case-insensitive header names but rejects missing
   or mismatched recognized values with status `400` and code `-32020`.

## Shipped Artifact

`outputs/skill-mcp-contract-reviewer.md` is a flat, reusable review skill. Give it a tool descriptor, sample results, pagination behavior, and completion policy. It returns an admission decision, result-validation plan, header policy, and concrete failure tests.

## Verify It

The lesson is complete when these statements are true:

- `tools/list` returns the same logical order on repeated calls.
- The client performs a second request when `nextCursor` is `""`.
- The unsafe sensitive-header descriptor is excluded while other tools remain available.
- An array passes its array output schema.
- An object fails that same array schema.
- Error results cannot omit or violate a published output schema.
- Text, image, audio, resource link, and embedded resource blocks validate.
- Header audit events contain names and no values.
- Plain visible ASCII remains plain; Unicode, control, padded, empty, and
  sentinel-looking values round-trip through exact base64 UTF-8 encoding.
- Mirrored integers outside the JavaScript safe range are rejected.
- Annotations under `oneOf`, `items`, nested objects, `$ref` definitions, or
  output schemas are rejected during admission.
- Case-insensitive recognized header names pass only when the decoded value
  exactly matches the body; missing or mismatched copies produce HTTP `400`
  and JSON-RPC `-32020`.
- Analyst completion never returns `production`.
- A tool failure uses `isError: true`; a malformed protocol call uses JSON-RPC `error`.

## Production Failure Modes

| Failure | What the learner sees | Correct response |
|---------|-----------------------|------------------|
| Client assumes object output | Valid arrays fail or are silently wrapped | Validate against the published schema without object-only types |
| Empty cursor treated as false | Final pages disappear | Continue whenever `nextCursor` is present and non-null |
| Sensitive value mirrored | Secret appears in proxy, WAF, or trace data | Reject the descriptor and keep secrets in protected request data |
| Raw Unicode or whitespace mirrored | Gateway and origin disagree or the value is normalized | Use exact base64 UTF-8 sentinel encoding and compare after decoding |
| Annotation hidden in a schema branch | A client misses routing metadata during admission | Traverse the entire schema tree and allow only direct top-level properties |
| Large integer mirrored | JavaScript intermediary rounds the routing value | Reject values outside the JavaScript safe integer range |
| Header and body disagree | Gateway routes one target while the origin executes another | Reject before dispatch with HTTP `400` and JSON-RPC `-32020` |
| Output schema ignored | Downstream code consumes corrupt structure | Validate before model or application use |
| Resource link trusted automatically | Caller follows an unauthorized URI | Reauthorize every resource read |
| Completion shares global suggestions | Hidden tenant names leak | Filter by caller, reference, and authorization |
| Tool annotations treated as policy | Destructive operation bypasses confirmation | Enforce authorization and approval outside annotations |
| One malformed tool breaks discovery | Entire server becomes unavailable | Reject the bad descriptor and admit valid tools independently |

## Capstone Connection

The Phase 13 capstone needs a gateway that can merge tools from several servers. This lesson provides its admission core.

Use the artifact to grade four pieces of capstone evidence:

- deterministic and complete paginated discovery;
- descriptor validation before model exposure;
- validated structured output plus bounded content blocks;
- completion and routing metadata that preserve authorization boundaries.

Do not claim gateway compatibility from a successful `tools/call` alone. Capture the descriptor, page trace, admitted tool set, rejected tool set, and one validated result.

## Key Terms

| Term | Meaning |
|------|---------|
| `inputSchema` | JSON Schema object defining accepted tool arguments |
| `outputSchema` | Optional JSON Schema defining `structuredContent` |
| `structuredContent` | Any JSON value produced by a tool result |
| Content block | Typed text, image, audio, resource link, or embedded resource |
| `x-mcp-header` | Schema annotation that mirrors a primitive argument into Streamable HTTP metadata |
| Opaque cursor | Server-issued pagination token whose value the client does not interpret |
| Completion reference | Prompt name or resource URI/template whose argument is being completed |
| Admission | Client decision to expose or reject a discovered descriptor |

## Further Reading

- [MCP Tools](https://modelcontextprotocol.io/specification/2026-07-28/server/tools)
- [MCP Completion](https://modelcontextprotocol.io/specification/2026-07-28/server/utilities/completion)
- [MCP Pagination](https://modelcontextprotocol.io/specification/2026-07-28/server/utilities/pagination)
- [MCP Streamable HTTP Parameter Headers](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http#custom-headers-from-tool-parameters)
