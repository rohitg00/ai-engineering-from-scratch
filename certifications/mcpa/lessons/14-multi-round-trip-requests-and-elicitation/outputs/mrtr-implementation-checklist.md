# MRTR Implementation Checklist

A one-page reference for building Multi Round-Trip Requests and elicitation into a server or client, aligned to MCP 2026-07-28.

## Server side: ending a call with input_required

- Only end a request with resultType input_required when the request is tools/call, prompts/get, or resources/read. No other client request may receive it.
- Include at least one of inputRequests or requestState in every InputRequiredResult.
- Each inputRequests entry names a server chosen key and a request object that is exactly one of elicitation/create, sampling/createMessage, or roots/list.
- Never include an inputRequests type the requesting client did not declare in that request's clientCapabilities. If a tool always needs elicitation and the request lacks the capability, refuse with -32021 (data.requiredCapabilities) instead of guessing.
- Do not assume the client will ever retry. Do not hold any resource open, in memory or otherwise, waiting for the answer.

## Protecting requestState

- Treat requestState as attacker controlled input the moment it crosses the client, even if your own server produced the bytes.
- If requestState affects authorization, resource access, or business logic, protect its integrity with HMAC or an AEAD cipher. Reject state that fails verification.
- Bind the payload to three things and check all three on every retry: the authenticated principal (not clientInfo, which is self reported), a short expiry, and a digest of the originating request's salient parameters (method, tool name, arguments).
- Enforce single use server side when a token must be redeemed at most once. Signature and expiry checks alone do not stop replay of a still valid token.
- Never encode secrets, credentials, or personal data directly into requestState even when it is encrypted; treat it as logged, cached, and copied by intermediaries.

## Client side: handling the retry

- Treat requestState as fully opaque: do not parse it, inspect it, decode it, or make decisions based on its contents.
- If the InputRequiredResult carried inputRequests, construct every requested input before retrying. If it did not, the client may retry immediately.
- If the InputRequiredResult carried requestState, echo the exact same string on the retry. If it did not, do not add one.
- Always use a new JSON-RPC id on the retry. It is an independent request, not a continuation of the original id.
- inputRequests and requestState apply only to the client's next retry of that one original request; never reuse them on an unrelated call running in parallel.

## Choosing form mode or URL mode elicitation

| Situation | Mode | Why |
|---|---|---|
| Confirm a destructive action, pick from a short list, fill a short form | form | Structured data the client can validate against requestedSchema and show to the user |
| Collect a password, API key, access token, or payment detail | url | Form mode must never carry these; URL mode keeps them out of the MCP client entirely |
| Run a third-party OAuth flow on the user's behalf | url | The server acts as its own OAuth client to the third party; the client's bearer token to the MCP server is unrelated and unchanged |

- form mode requestedSchema is a flat object of primitive properties only: string, number, integer, boolean, and single or multi select enums. No nested objects, no arrays of objects.
- ElicitResult.action is accept, decline, or cancel. Accept carries content for form mode and nothing for URL mode. Handle all three; do not treat decline or cancel as an error.
- URL mode carries only a mode, message, and url in 2026-07-28. There is no elicitationId and no notifications/elicitation/complete: both were removed along with the legacy -32042 error code. The server learns the outcome only when the client retries the original request with the requestState it was given.

## Quick trap check

- A retry that reuses the original id is wrong; it must be new.
- A retry that changes or omits a requestState the server sent is wrong; it must be echoed exactly.
- The specification requires a server to reject requestState that fails verification but does not prescribe the channel. This lab answers a tampered or expired requestState the way an expired handle is treated, with a tool execution error (isError true) the model can read and act on by calling the tool again; asking again with a fresh input_required result is also a valid choice.
- A server that pushes elicitation/create down an open stream without ending the original call is implementing the pre-2026-07-28 pattern SEP-2322 replaced.

Source: `certifications/mcpa/research/mcp-2026-07-28-brief.md`, sections 7 and 11.
