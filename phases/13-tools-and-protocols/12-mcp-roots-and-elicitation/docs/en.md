# Explicit Scope and Stateless Elicitation

> Roots are deprecated in MCP 2026-07-28 and were never a security sandbox. Put scope in visible tool arguments or resource URIs, authorize it on the server, and use MRTR when a tool genuinely needs user input. The user sees the decision, the model sees the handle, and any server instance can process the retry.

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 13 · 07 (MCP server), Phase 13 · 11 (stateless MRTR)
**Time:** ~60 minutes

## Learning Objectives

- Replace deprecated Roots with explicit workspace parameters, resource URIs, or server configuration.
- Separate scope hints from authorization, path containment, and operating-system sandboxing.
- Deliver form-mode `elicitation/create` through an MRTR `input_required` result.
- Advertise elicitation support in per-request client capabilities and reject unsupported modes.
- Validate `accept`, `decline`, and `cancel` as distinct outcomes.
- Bind destructive confirmation to an authenticated principal, original arguments, candidate set, and expiry.

## Two Problems That Look Similar

A notes tool receives this request: "Delete the old TPS report."

The server must answer two different questions.

1. Which workspace may this operation touch?
2. Which of three matching notes did the user mean?

The first is scope and authorization. The second is interactive disambiguation. Mixing them leads to dangerous designs, such as treating a client-provided folder as proof that the caller may delete everything inside it.

## Roots Are a Migration Surface

Earlier MCP revisions let a client advertise Roots and notify a server when the list changed. Roots were informational guidance. They did not constrain what the server process could read, did not authorize the caller, and did not create an operating-system sandbox.

MCP 2026-07-28 deprecates `roots/list` and `notifications/roots/list_changed` for new designs. Prefer one of these explicit replacements:

- A `workspaceUri` or `directory` tool argument when scope varies per call.
- A resource URI when the operation already targets a resource.
- Server configuration when one deployment owns one fixed workspace.
- A process sandbox or jailed filesystem when code must be technically unable to escape.

If an existing 2026-07-28 integration still needs `roots/list` during the deprecation window, the server embeds it in MRTR `inputRequests`. It must not send a live reverse request. That is a migration adapter; new handlers should accept explicit scope instead.

The model can see and repeat an explicit handle. Hidden transport-session scope is harder to inspect, replay, audit, and route.

### The three-layer rule

An explicit URI still does not authorize itself. Enforce all three layers:

1. **Authorization:** Is this authenticated principal allowed to use this workspace?
2. **Containment:** Does the normalized target URI stay inside the authorized workspace boundary?
3. **Sandbox:** Can the operating system stop a compromised server from escaping anyway?

The runnable server keeps an allowlist of authorized workspace URIs, normalizes percent-encoded paths, checks a real path-component boundary, and re-checks containment immediately before deletion.

Naive string-prefix checks are wrong:

```text
allowed:   file:///work/notes
attacker:  file:///work/notes-evil/secret.md
traversal: file:///work/notes/%2e%2e/private.md
```

Both hostile paths start with a misleading string. Normalize first, then compare path components. A production filesystem server must also defend against symbolic-link races and platform-specific path semantics.

## Elicitation Still Exists, but Delivery Changed

Elicitation is the current client feature for collecting user input during `tools/call`, `prompts/get`, or `resources/read`. The method name remains `elicitation/create`. What changed is the direction of the wire flow.

A 2026-07-28 server does not send a reverse JSON-RPC request. It returns an `InputRequiredResult`:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "resultType": "input_required",
    "inputRequests": {
      "delete_choice": {
        "method": "elicitation/create",
        "params": {
          "mode": "form",
          "message": "Choose one matching note and confirm deletion.",
          "requestedSchema": {
            "type": "object",
            "properties": {
              "note_id": {
                "type": "string",
                "enum": ["note-3", "note-7", "note-14"]
              },
              "confirm": {"type": "boolean"}
            },
            "required": ["note_id", "confirm"]
          }
        }
      }
    },
    "requestState": "integrity-protected-delete-state"
  }
}
```

The host renders the form. The user can accept, explicitly decline, or dismiss it. The client then retries the original `tools/call` with a fresh id:

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "notes_delete",
    "arguments": {
      "workspaceUri": "file:///Users/alice/Documents/Notes",
      "title": "TPS report"
    },
    "inputResponses": {
      "delete_choice": {
        "action": "accept",
        "content": {"note_id": "note-14", "confirm": true}
      }
    },
    "requestState": "integrity-protected-delete-state",
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientCapabilities": {
        "elicitation": {"form": {}}
      }
    }
  }
}
```

There is no protocol session between the two calls. The server verifies the echoed state, validates the response against the expected schema, checks that the selected note was in the signed candidate set, re-authorizes the workspace, re-checks containment, and then deletes.

## Capability Negotiation Is Per Request

A client that supports form-mode elicitation declares:

```json
{
  "io.modelcontextprotocol/clientCapabilities": {
    "elicitation": {"form": {}}
  }
}
```

An empty elicitation capability, `"elicitation": {}`, remains equivalent to form-only support for compatibility. Explicit `"elicitation": {"form": {}}` also supports form mode. A URL-only declaration, `"elicitation": {"url": {}}`, does not. The server must not embed a mode absent from the current request's capabilities, even if an earlier request advertised it.

Every request also carries `io.modelcontextprotocol/protocolVersion`. A missing or non-string version returns `-32602`. An unsupported string returns `-32022` with exact `supported` and `requested` data. Missing or URL-only elicitation support returns `-32021` with `data.requiredCapabilities` set to `{"elicitation":{"form":{}}}`.

An envelope without a JSON-RPC `id` is a notification. Process it without emitting a JSON-RPC success or error response. On Streamable HTTP, an accepted notification receives `202 Accepted` with no body.

`clientInfo` should be included for diagnostics, but it is self-reported and cannot identify the user for authorization.

The server implements `server/discover` and returns `supportedVersions`, capabilities, `ttlMs`, and `cacheScope` with `resultType: "complete"`. It does not advertise Roots for this modern design. Because it advertises tools, it also implements mandatory `tools/list`. That result returns the deterministic `notes_delete` descriptor, a valid object `inputSchema`, server identity metadata, and public cache hints.

## Form Mode

Form mode uses a restricted JSON Schema designed for usable dialogs. The root is an object and its properties are flat primitive fields or supported enum arrays. Deeply nested objects and general-purpose document schemas do not belong in a confirmation dialog.

Use form mode for:

- choosing one of several candidates;
- confirming a destructive operation;
- collecting non-sensitive preferences;
- gathering a small number of values the user, not the model, must decide.

Do not use form mode for passwords, API keys, access tokens, or payment credentials. Those secrets would pass through the MCP client and could reach logs or model context.

The server validates the returned content again. Client-side form validation improves UX but does not create trust.

## URL Mode

URL mode sends a secure web URL for an out-of-band interaction:

```json
{
  "method": "elicitation/create",
  "params": {
    "mode": "url",
    "message": "Connect the report service to continue.",
    "url": "https://mcp.example.com/connect/report-service"
  }
}
```

Use it when sensitive information must go directly to a server-controlled web flow, such as third-party authorization. The client shows the full destination and obtains consent before opening it. It must not prefetch the URL.

An `accept` response means the user agreed to open the URL. It does not prove the external flow completed. On retry, the server checks its own state and either completes or returns another `input_required` result.

URL elicitation is not a replacement for authorization between the MCP client and MCP server. It is for an external interaction the MCP server needs to perform on the user's behalf. The server must bind the browser user to the same authenticated principal that began the MCP operation.

## Response Branches

Treat the actions as product decisions, not aliases:

| Action | Meaning | Safe server behavior |
|--------|---------|----------------------|
| `accept` | User submitted the interaction | Validate content and continue |
| `decline` | User explicitly refused | Return a complete, non-error refusal outcome |
| `cancel` | User dismissed or could not finish | Stop safely and allow a later retry |

Never interpret missing content as consent. Never convert decline into a repeated prompt loop.

## Protecting Destructive MRTR State

The candidate list cannot live only in a prompt or unsigned Base64 value. A client controls everything it sends back.

The lesson signs a state payload containing:

- authenticated principal;
- originating method;
- digest of `workspaceUri` and `title`;
- allowed note ids shown in the form;
- operation phase;
- short expiry.

Before mutation, the server also checks the live note record. This catches deletion races and a target moved outside the workspace after the form was shown.

For a one-time financial or irreversible action, HMAC alone does not prevent a valid state from being replayed within its expiry. Store and consume a nonce exactly once in a replay store shared by every handler instance. The lesson injects a bounded, TTL-pruned store and holds its atomic claim while performing the in-memory deletion. A production database should couple the nonce claim and mutation in one transaction or equivalent conditional-write boundary.

Validate the interaction before claiming the nonce. A malformed response or `cancel` performs no mutation and leaves the state retryable until expiry. An explicit `decline` is terminal, so the lesson consumes the nonce without deleting anything.

```figure
t3-roots-boundary
```

## Build It

`code/main.py` demonstrates a modern `notes_delete` tool:

- `tools/list` returns a deterministic, cacheable descriptor with the required workspace and title schema.
- Scope is an explicit `workspaceUri` argument.
- Server configuration authorizes that workspace for the lesson principal.
- URI normalization rejects prefix confusion and encoded traversal.
- Every destructive deletion requires form-mode elicitation.
- The elicitation travels inside `resultType: "input_required"`.
- Signed `requestState` binds the exact candidate list and original arguments.
- An injected replay store rejects the same accepted or declined state across server instances.
- The retry uses a fresh request id and returns `resultType: "complete"`.

The data store is in memory so the protocol behavior is easy to inspect. The security rules remain the same with a database.

## Use It

From the repository root:

```bash
cd phases/13-tools-and-protocols/12-mcp-roots-and-elicitation/code
python3 main.py
python3 -m unittest discover tests -v
```

Expected checkpoints:

- Discovery advertises tools without Roots.
- Tool discovery returns `notes_delete` with `resultType`, server identity, and cache hints.
- Request id `1` returns the form in `inputRequests.delete_choice`.
- Request id `2` echoes the signed state and completes the deletion.
- A prefix path and an encoded traversal path both fail containment.
- A changed title cannot reuse the original confirmation state.
- A decline leaves the note unchanged.
- Two server objects sharing note and replay state cannot both execute one confirmation.
- Empty and explicit form declarations work, while URL-only support returns exact `-32021` form requirements.
- Unsupported version failures use the exact `-32022` data shape.
- An id-less notification produces no JSON-RPC response.

## Ship It

`outputs/skill-elicitation-form-designer.md` designs the explicit scope, authorization checks, MRTR form, response branches, and state binding. It refuses to treat deprecated Roots as a sandbox or to collect secrets through form mode.

## Exercises

1. Replace the in-memory replay store with SQLite. Use one transaction to claim the nonce and delete the note, then prove two processes cannot both commit.
2. Add `url` capability negotiation and an out-of-band setup flow. Keep third-party credentials out of `inputResponses`.
3. Replace the in-memory note map with a temporary SQLite database. Re-check authorization and containment inside the mutation transaction.
4. Add a symbolic-link policy for a real filesystem implementation. Explain why URI lexical containment alone cannot stop a symlink escape.
5. Design a 2025-11-25 adapter that maps modern MRTR handler output to legacy server-initiated elicitation. Keep it isolated from the current handler.

## Key Terms

| Term | Meaning in 2026-07-28 |
|------|------------------------|
| Roots | Deprecated informational workspace hints, not authorization or sandboxing |
| Explicit scope | Workspace, directory, or resource handle visible in request arguments |
| Containment | Normalized path-component check that keeps a target inside a boundary |
| Elicitation | Client feature for obtaining user input during an MCP operation |
| Form mode | In-band structured user input using a restricted flat schema |
| URL mode | Out-of-band interaction for sensitive or external workflows |
| MRTR | Stateless input-required result followed by a fresh retry |
| `requestState` | Opaque state echoed exactly and integrity-checked by the server |
| Decline | Explicit user refusal |
| Cancel | Dismissal or incomplete interaction without approval |

## Legacy Compatibility

For a peer pinned to 2025-11-25, `roots/list`, `notifications/roots/list_changed`, and live server-initiated `elicitation/create` may still exist. Label that adapter legacy. Do not allow a legacy Root list to bypass server authorization, and do not carry protocol-session assumptions into the modern handler.

## Further Reading

- [MCP 2026-07-28 Elicitation](https://modelcontextprotocol.io/specification/2026-07-28/client/elicitation)
- [MCP 2026-07-28 Multi Round-Trip Requests](https://modelcontextprotocol.io/specification/2026-07-28/basic/patterns/mrtr)
- [MCP 2026-07-28 Roots deprecation](https://modelcontextprotocol.io/specification/2026-07-28/client/roots)
- [MCP 2026-07-28 server discovery](https://modelcontextprotocol.io/specification/2026-07-28/server/discover)
