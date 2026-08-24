---
name: elicitation-form-designer
description: Design explicit resource scope and stateless MCP 2026-07-28 elicitation with authorization, safe forms, and signed retry state.
version: 2.0.0
phase: 13
lesson: 12
tags: [mcp, elicitation, mrtr, scope, authorization]
---

Design a user-input step for an MCP operation targeting protocol revision `2026-07-28`.

Produce:

1. Scope contract. Put the workspace, directory, or resource URI in visible tool arguments or server configuration. State which authenticated principals may use it.
2. Boundary checks. Define URI normalization, path-component containment, symbolic-link policy, and the operating-system sandbox.
3. Trigger condition. Name the exact ambiguity, confirmation, or external interaction that requires user input.
4. Discovery and capability gate. Return exact `supportedVersions`, capabilities, `ttlMs`, and `cacheScope` from `server/discover`. If tools are advertised, include mandatory deterministic `tools/list` descriptors with a valid object `inputSchema`, server identity metadata, and cache hints. Treat `elicitation: {}` and explicit `elicitation.form` as form support. Reject missing or URL-only support with `-32021` and `data.requiredCapabilities.elicitation.form`; use `-32022` with exact `supported` and `requested` data for an unsupported version.
5. MRTR result. Return `resultType: "input_required"` with a stable `inputRequests` key and `elicitation/create` request.
6. Interaction design. For form mode, provide a plain message and restricted flat schema. For URL mode, show the HTTPS destination and out-of-band completion rule.
7. Retry contract. Require a fresh JSON-RPC id, original method and arguments, current `inputResponses`, per-request `_meta`, and exact `requestState` echo.
   An id-less notification never receives a JSON-RPC result or error; an accepted Streamable HTTP notification receives `202` with no body.
8. Branch handling. Map `accept`, `decline`, and `cancel` to different safe outcomes.
9. State protection. Bind HMAC or authenticated encryption to the authenticated principal, original argument digest, candidate set, operation phase, expiry, and one-time nonce. Consume the nonce atomically in a bounded, TTL-pruned replay store shared by every handler instance.
10. Final revalidation. Re-check authorization, live record state, and containment immediately before mutation.

Hard rejects:

- Treating deprecated Roots as authorization, containment, or sandboxing.
- Using `roots/list` or `notifications/roots/list_changed` in a new 2026-07-28 design.
- Sending a reverse `elicitation/create` request instead of returning it through MRTR.
- Collecting passwords, API keys, access tokens, or payment credentials in form mode.
- Sending an elicitation mode absent from current per-request capabilities.
- Treating `clientInfo` as an authenticated user identity.
- Performing a destructive action before validated acceptance and final authorization checks.
- Unsigned `requestState` that carries candidates or permission-relevant data.

Refusal rules:

- Refuse repeated prompts after explicit decline.
- Refuse elicitation for a value the server can derive or validate without the user.
- Refuse a URL that contains credentials, user secrets, or a pre-authenticated bearer value.
- Refuse a request that uses hidden protocol-session state, `initialize`, or `Mcp-Session-Id`.

Output a one-page design with scope, authorization, containment, interaction mode, schema or URL, MRTR wire shape, state fields, response branches, replay policy, and final revalidation checklist.
