# Interaction Patterns Field Brief

A one-page reference for the MCPA "Interactions and Execution" domain (26 percent of the exam, its largest).

## The one rule that separates a request from a notification

- **Request**: carries a non-null `id`. The server must answer it with exactly one JSON-RPC response, a result or an error, keyed to that same `id`.
- **Notification**: has no `id` key at all. The server processes it if it recognizes the method, but never sends anything back, not even an error.

If you remember one fact for this domain, remember this: the presence of `id` is the entire test. Nothing about the method name, the params, or how important the message looks changes that rule.

## The three server primitives, one sentence each

- **Tool**: a named, schema-typed action the model decides to invoke; it can have side effects.
- **Resource**: addressable content, typically read by URI, that a host or user attaches to context; reading one should stay side-effect free.
- **Prompt**: a reusable message template a user explicitly selects, often through a slash command or menu.

Each family gets its own discovery method (`tools/list`, `resources/list`, `prompts/list`) and its own invocation method (`tools/call`, `resources/read`, `prompts/get`). Two more primitives, sampling and roots, live on the client side of the architecture and are out of scope here.

## Response handling

A client with several requests in flight on one connection matches every incoming response to its pending call by `id`, not by the order replies arrive in. A response carrying `id: 7` answers whichever pending request was sent with `id: 7`, no matter what else has completed in between.

## Error codes you will see

| Code | Name | When this lesson's mock uses it |
|------|------|----------------------------------|
| -32600 | Invalid Request | The message is not a well-formed JSON-RPC 2.0 object |
| -32601 | Method not found | The top-level method name is not one the server implements at all |
| -32602 | Invalid params | A known method was called with a bad, missing, or unknown-named argument, including an unknown tool, resource URI, or prompt name |

## Exam facts for this domain

- Interactions and Execution is 26 percent of the MCPA exam, the largest single domain.
- Its published sub-competencies include Interaction Patterns and Response Handling, Error Handling, Tool Invocation Lifecycle, and Protocol Primitives.
- Source: MCPA certification page and the MCP specification, version 2026-07-28; see `certifications/mcpa/research/source-verification-ledger.md`.
