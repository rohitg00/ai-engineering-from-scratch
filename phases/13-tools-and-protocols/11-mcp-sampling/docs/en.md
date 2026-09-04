# MCP Model Input: Sampling Migration and Stateless MRTR

> MCP 2026-07-28 deprecates Sampling for new designs and removes the server-to-client request channel. If an existing workflow still needs the client's model, the server returns an `input_required` result and the client retries the original request with the model output. The reasoning loop becomes explicit, bounded, and stateless at the protocol layer.

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 13 · 07 (MCP server), Phase 13 · 10 (resources and prompts)
**Time:** ~75 minutes

## Learning Objectives

- Explain why Sampling is deprecated in MCP 2026-07-28 and choose the direct model integration default for new servers.
- Implement a compatibility workflow that carries `sampling/createMessage` through Multi Round-Trip Requests (MRTR).
- Put the protocol revision and client capabilities in every request `_meta` object.
- Return `resultType: "input_required"` and retry the original method with a fresh JSON-RPC id.
- Integrity-protect `requestState` and bind it to the principal, method, arguments, and expiry.
- Bound model-assisted loops with capability checks, approval, response validation, and a round limit.

## The Decision Before the Protocol

A tool such as `summarize_repo` needs two kinds of work:

1. Deterministic work: list files, read allowed files, validate paths, and assemble content.
2. Model work: choose representative files and synthesize the summary.

You now have two valid architectures.

### New server: integrate with a model provider directly

This is the current default. The server owns model selection, credentials, budgets, retries, and observability. It returns one ordinary `tools/call` result to the MCP client.

Choose this when the server is already a hosted service or when predictable model behavior matters more than using the host's model.

### Existing Sampling workflow: migrate it to MRTR

Sampling still exists during its deprecation window. A server targeting 2026-07-28 cannot send a live `sampling/createMessage` request back to the client. It instead embeds that request in an `InputRequiredResult`.

Choose this compatibility path only when using the client's model and credentials is a real product requirement. Record a removal plan because new implementations should not adopt deprecated Sampling.

## The Stateless Contract

The July 2026 protocol has no `initialize` exchange, no `notifications/initialized`, and no `Mcp-Session-Id`. Every request carries the information that used to live in the handshake:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "summarize_repo",
    "arguments": {"audience": "developer"},
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientCapabilities": {"sampling": {}},
      "io.modelcontextprotocol/clientInfo": {
        "name": "lesson-client",
        "version": "1.0.0"
      }
    }
  }
}
```

The server validates the revision on every request. A missing or non-string version is invalid params, `-32602`. An unsupported string returns `-32022` with exact data `{"supported":["2026-07-28"],"requested":"<client version>"}`. A missing Sampling capability returns `-32021` with `data.requiredCapabilities` set to `{"sampling":{}}`.

An envelope without a JSON-RPC `id` is a notification. The receiver may process it, but it emits neither a success response nor an error response. A Streamable HTTP adapter returns `202 Accepted` with no body for an accepted notification.

The server also implements `server/discover` with the exact `supportedVersions` key, capabilities, `ttlMs`, and `cacheScope` so a client can learn and cache the server contract before calling a tool. Because discovery advertises `tools`, the server also implements mandatory `tools/list`. Its deterministic `summarize_repo` descriptor includes a valid object `inputSchema`, `resultType: "complete"`, server identity metadata, and public cache hints.

Every successful modern result has a discriminator:

- `resultType: "complete"` means the operation finished.
- `resultType: "input_required"` means the client must fulfill embedded requests and retry.
- Extensions may define additional result types. The Tasks extension adds `"task"` in Lesson 13.

## One MRTR Round

The server cannot call the client while handling the request. It returns this result instead:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "resultType": "input_required",
    "inputRequests": {
      "pick_files": {
        "method": "sampling/createMessage",
        "params": {
          "messages": [
            {
              "role": "user",
              "content": {
                "type": "text",
                "text": "Choose three representative files and return a JSON array."
              }
            }
          ],
          "systemPrompt": "Return only the requested value.",
          "modelPreferences": {
            "costPriority": 0.8,
            "intelligencePriority": 0.2
          },
          "maxTokens": 400
        }
      }
    },
    "requestState": "opaque-integrity-protected-value"
  }
}
```

The client verifies that it supports Sampling, applies its approval and model policies, and obtains a model response. Then it sends a new request with a different JSON-RPC id:

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "summarize_repo",
    "arguments": {"audience": "developer"},
    "inputResponses": {
      "pick_files": {
        "role": "assistant",
        "content": {
          "type": "text",
          "text": "[\"README.md\", \"server.py\", \"docs/intro.md\"]"
        },
        "model": "host-model",
        "stopReason": "endTurn"
      }
    },
    "requestState": "opaque-integrity-protected-value",
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientCapabilities": {"sampling": {}}
    }
  }
}
```

The retry is not a continuation of a protocol session. It is a new request that repeats the original method and arguments, adds only the current round's `inputResponses`, and echoes `requestState` byte for byte.

MRTR is allowed only on `tools/call`, `prompts/get`, and `resources/read`. A server must not return `input_required` from unrelated methods.

## Multi-Round State

This lesson needs two model calls:

1. `pick_files` returns a JSON array.
2. `summary` returns the final prose.

Each retry carries only the responses for that round. The server therefore puts the phase and validated intermediate data into the next `requestState`.

Treat that value as attacker-controlled. Signing a raw phase name is not enough. Bind the state to:

- the authenticated principal, not self-reported `clientInfo`;
- the originating method;
- a digest of the original arguments;
- a short expiry;
- the current phase and validated intermediate values.

Use HMAC when confidentiality is not required. Use authenticated encryption when the client must not read the state. Reject a bad signature, expired value, changed principal, or changed arguments with `-32602`.

The client must not parse or modify `requestState`. Its only job is to echo the exact string on the retry.

## Model Preferences Are Hints

`costPriority`, `speedPriority`, and `intelligencePriority` are independent preferences. They are not a probability distribution and do not need to sum to one. The client may ignore them because the client owns model policy.

Keep `includeContext` at `"none"` if you maintain a legacy Sampling flow. Other context modes increase leakage risk and are themselves deprecated. Pass the minimum explicit context in the request.

## Safety Invariants

The client is the trust boundary for embedded Sampling requests.

- Show the user what the server is asking the model to do when policy requires approval.
- Cap MRTR rounds. A malicious server can otherwise create a model-spend loop.
- Validate every sampling response before using it as a filename, URL, or tool input.
- Limit bytes and tokens per round.
- Refuse an input request that was not declared in current client capabilities.
- Keep model output out of authorization decisions.
- Log the originating method and input-request key without logging sensitive prompt content.

`clientInfo` and `serverInfo` are display and diagnostics metadata. Never use either as an authenticated identity.

```figure
t3-sampling-flip
```

## Build It

`code/main.py` implements the full two-round flow with no third-party package:

- `server/discover` returns `supportedVersions`, advertises tool support, and returns cache hints.
- `tools/list` returns a deterministic, cacheable `summarize_repo` descriptor with an object input schema.
- `tools/call` validates per-request metadata.
- The first result embeds `sampling/createMessage` for file selection.
- The first retry validates the model result and embeds a second request.
- HMAC-protected `requestState` carries the phase between independent requests.
- The final result uses `resultType: "complete"`.

The fake host model makes the example deterministic. Replace only `fake_host_model` when connecting a real host. The server-side state machine should stay deterministic and testable.

## Use It

From the repository root:

```bash
cd phases/13-tools-and-protocols/11-mcp-sampling/code
python3 main.py
python3 -m unittest discover tests -v
```

Expected checkpoints:

- Discovery returns a complete result with `ttlMs` and `cacheScope`.
- Tool discovery returns the same sorted descriptor with `resultType`, server identity, and cache hints.
- Missing capabilities and unsupported versions use exact `-32021` and `-32022` error data.
- An id-less notification produces no JSON-RPC response.
- Request ids are `[1, 2, 3]`, proving each MRTR round is independent.
- The first two results are `input_required`.
- The final result is `complete` and contains the selected files plus summary.
- Changing the original arguments on a retry fails the request-state check.

## Ship It

`outputs/skill-sampling-loop-designer.md` is now a migration planner. It first decides whether Sampling should be removed in favor of direct model integration. If compatibility is required, it produces the MRTR rounds, state binding, capability gate, budget, validation, and removal plan.

## Exercises

1. Change the file-selection response to invalid JSON. Confirm the server returns `-32602` instead of trusting model output.
2. Change `audience` between the first call and retry. Explain why the sealed state blocks cross-request reuse.
3. Add a third round that asks the host to critique the summary. Carry the earlier summary inside signed state and cap the entire flow at three rounds.
4. Remove Sampling by replacing the fake host callback with a server-owned model adapter. List which approval, billing, and observability responsibilities move to the server.
5. Add an expiry test using a state value that is one second past its deadline.

## Key Terms

| Term | Meaning in 2026-07-28 |
|------|------------------------|
| Sampling | Deprecated feature that asks the client's model for a completion |
| MRTR | Stateless retry pattern for client input required during a request |
| `InputRequiredResult` | Result with `resultType: "input_required"` |
| `inputRequests` | Server-assigned map of embedded elicitation, sampling, or roots requests |
| `inputResponses` | Current round's client results keyed like `inputRequests` |
| `requestState` | Opaque server state echoed exactly by the client and verified by the server |
| `resultType` | Required discriminator for modern MCP results |
| Direct model integration | Recommended replacement for new servers that need model inference |
| Capability gate | Rule that prevents sending an embedded request the client did not advertise |
| Loop budget | Maximum rounds, tokens, bytes, time, and spend allowed for the operation |

## Legacy Compatibility

A client pinned to 2025-11-25 may still use the older server-initiated `sampling/createMessage` flow over a live connection. Keep that behavior in a version-specific adapter only. Do not make the sessionful path the architecture for a 2026-07-28 server.

Official SDKs can translate modern `input_required` handlers for older peers. That shim is a compatibility boundary, not permission to add new session-dependent logic.

## Further Reading

- [MCP 2026-07-28 Multi Round-Trip Requests](https://modelcontextprotocol.io/specification/2026-07-28/basic/patterns/mrtr)
- [MCP 2026-07-28 changelog](https://modelcontextprotocol.io/specification/2026-07-28/changelog)
- [MCP Sampling deprecation](https://modelcontextprotocol.io/seps/2577-deprecate-roots-sampling-and-logging)
- [MCP 2026-07-28 server discovery](https://modelcontextprotocol.io/specification/2026-07-28/server/discover)
