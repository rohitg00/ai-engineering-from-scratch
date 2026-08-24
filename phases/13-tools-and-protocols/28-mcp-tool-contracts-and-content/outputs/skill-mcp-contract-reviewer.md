---
name: mcp-contract-reviewer
description: Review MCP tool descriptors, results, pagination, completions, and parameter-header policy before exposing tools to a model.
version: 1.0.0
phase: 13
lesson: 28
tags: [mcp, tools, json-schema, pagination, completion, security]
---

Review the supplied MCP tool surface against protocol version `2026-07-28`.

Ask for these inputs if they are absent:

1. The complete `tools/list` descriptor pages, including every `nextCursor` field.
2. At least one successful result and one failure result per tool.
3. The Streamable HTTP parameter-header mapping, if used.
4. Completion references, caller classes, and example suggestions.
5. The authorization context that can change the visible tool set.

Produce a compact report with these sections.

## Descriptor admission

For each tool:

- verify a non-empty stable name;
- require an object `inputSchema`;
- identify the JSON Schema dialect, defaulting to 2020-12 when omitted;
- validate `outputSchema` when present;
- list annotations as untrusted hints, not policy;
- return `ADMIT`, `REJECT`, or `CONDITIONAL` with one precise reason.

Reject one malformed descriptor without rejecting unrelated valid tools.

## Result contract

For every complete result, including one with `isError: true`:

- require `resultType: complete`;
- validate every content block by type;
- treat `structuredContent` as any JSON value, not object-only;
- require `structuredContent` and conformance to `outputSchema` when one exists;
- require a compatibility text block for structured results;
- distinguish resource links from embedded resources;
- state size and media-type limits.

Classify malformed requests as JSON-RPC errors. Classify actionable execution
failures as complete results with `isError: true`, without bypassing the
published output contract.

## Parameter headers

For every `x-mcp-header`:

- require a valid, non-empty HTTP field-name token;
- require case-insensitive uniqueness;
- require string, integer, or boolean type;
- traverse the entire input schema, including nested properties, combinators,
  array items, and definitions used by `$ref`;
- allow the annotation only on a direct `inputSchema.properties` member and
  reject every annotation found elsewhere or in `outputSchema`;
- reject `number` and integer values outside `-9007199254740991` through
  `9007199254740991`;
- reject credential, token, secret, password, authorization, and PII fields by deployment policy;
- transmit a value plainly only when it is non-empty visible ASCII and does
  not begin with `=?base64?`;
- otherwise emit exactly `=?base64?{Base64UTF8}?=` without trimming or
  normalizing the original value;
- encode Unicode, empty, whitespace, control, CR or LF, padded, and
  sentinel-looking strings, and render booleans as lowercase text;
- at the HTTP boundary, decode recognized `Mcp-Param-*` values, compare header
  names case-insensitively and decoded values exactly with the JSON body, and
  reject a missing, duplicated, unexpected, malformed, or mismatched copy as
  HTTP `400` plus JSON-RPC `-32020`;
- log the final header name and rejection category, never the argument value
  or encoded payload.

## Pagination

Trace every list request. Continue whenever `nextCursor` is present and non-null, including when it is an empty string. Never decode, modify, increment, order, or derive meaning from a cursor. Report duplicate tools, missing pages, and unstable ordering.

## Completion

For each prompt or resource reference:

- validate the reference and argument;
- filter suggestions through the caller's authorization;
- cap the result at 100 values;
- define client debounce and server rate limits;
- test that hidden tenant, resource, and environment names do not leak.

## Verification matrix

Return at least these checks:

| Check | Fixture | Expected result |
|------|---------|-----------------|
| Non-object structured output | Valid array, scalar, or null schema | Accepted when conforming |
| Output mismatch | Wrong JSON type or missing property | Rejected before model use |
| Error output mismatch | `isError: true` with missing or invalid structured content | Rejected before model use |
| Empty cursor | `nextCursor: ""` | Follow-up request sends the exact cursor |
| Unsafe header | Token or invalid field name | Descriptor rejected |
| Nested header annotation | `oneOf`, `items`, nested object, or `$ref` definition | Descriptor rejected during full-tree admission |
| Encoded header values | Unicode, newline, padding, or sentinel-looking text | Exact base64 UTF-8 sentinel round-trips the original value |
| Integer header values | Both safe bounds and one value beyond each bound | Safe bounds pass; unsafe values are rejected |
| Header and body parity | Case variant, missing copy, and decoded mismatch | Case variant passes; missing or mismatch returns HTTP 400 and JSON-RPC -32020 |
| Mixed content | Text, media, link, embedded resource | Each block validated independently |
| Completion isolation | Low-privilege caller | No privileged suggestion returned |
| Error layering | Unknown tool and business failure | JSON-RPC error and `isError: true` remain distinct |

Refuse approval when evidence includes only a successful tool call. Require discovery pages, admission decisions, and validated result fixtures.
