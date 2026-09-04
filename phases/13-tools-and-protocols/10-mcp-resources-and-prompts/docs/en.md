# MCP Resources and Prompts: Addressable Context for Stateless Servers

> Tools perform operations. Resources expose addressable content. Prompts package user-selected message templates. A good MCP server keeps those contracts separate and predictable.

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 13, Lesson 07 (Building an MCP Server), Phase 13, Lesson 09 (MCP Transports)
**Time:** ~60 minutes

## Learning Objectives

- Choose among tools, resources, and prompts from the consumer's intent.
- Advertise the resource and prompt surface through mandatory `server/discover`.
- Build deterministic `resources/list` and `prompts/list` results.
- Apply `ttlMs` and `cacheScope` without leaking user-specific data.
- Return JSON-RPC error `-32602` for an invalid or unknown resource URI.
- Open a `subscriptions/listen` POST-response stream and correlate every event by subscription ID.
- Treat resource content and prompt templates as untrusted server output.

## Start With the Consumer

The easiest way to misuse MCP is to begin with implementation code. A database query becomes a tool because functions are familiar. A reusable workflow becomes a resource because it is stored in a file. A prompt becomes hidden policy because the host can inject it.

Begin with who chooses and what they expect.

| Primitive | Primary intent | Selection owner | Typical result |
|---|---|---|---|
| Tool | Perform an operation | Model or application | Structured action result |
| Resource | Read content at a URI | Host, application, or user | Text or binary content |
| Prompt | Start a reusable message workflow | User through host UI | One or more prompt messages |

A note at `notes://note-1` is a resource because it is addressable content. `delete_note` is a tool because it changes state. `review_note` is a prompt because a user chooses a prepared review workflow.

Do not expose one operation as all three merely to look complete. Each extra surface needs discovery, authorization, caching, error handling, tests, and documentation.

## The 2026-07-28 Stateless Envelope

This lesson targets MCP protocol revision `2026-07-28`. There is no initialization handshake or protocol session in this profile. Every request carries its protocol version and client capabilities in reserved `_meta` keys.

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "resources/list",
  "params": {
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientInfo": {
        "name": "course-client",
        "version": "1.0.0"
      },
      "io.modelcontextprotocol/clientCapabilities": {}
    }
  }
}
```

A server must implement `server/discover`. Its result advertises supported
versions, resource and prompt capabilities, implementation identity, and
cache hints. A client may call another method directly, but discovery gives it
one stable snapshot before it builds a UI.

```json
{
  "resultType": "complete",
  "supportedVersions": ["2026-07-28"],
  "capabilities": {
    "resources": {"listChanged": true, "subscribe": true},
    "prompts": {"listChanged": true}
  },
  "ttlMs": 3600000,
  "cacheScope": "public"
}
```

A normal result declares `"resultType": "complete"`. The response `_meta` identifies the serving implementation with `io.modelcontextprotocol/serverInfo`. This information is useful for diagnostics. It is not an authentication identity. A request carrying an unsupported revision returns `-32022` with both the requested revision and the server's supported revisions.

The stateless contract changes your design instincts. A list cannot depend on a prior call on one connection. Authorization may change the visible set because credentials are request input, but connection history must not.

## Resources Are Stable URI Contracts

A resource is content identified by a URI. Design the URI before the handler.

Good URI properties:

- Stable enough to bookmark or pass between requests.
- Namespaced to the server's domain.
- Independent from a process ID or connection.
- Validated before storage access.
- Authorized on every read.

`notes://note-1` is better than `note-1` because its namespace is explicit. A file server may use `file://` URIs, but it must still check configured directory boundaries after resolving symlinks and relative segments.

`resources/list` returns the resources currently visible to the caller. Sort by a stable key such as URI. Deterministic order prevents noisy cache misses, changing snapshots, and host UIs that jump between refreshes.

```json
{
  "resultType": "complete",
  "resources": [
    {
      "uri": "notes://note-1",
      "name": "Architecture decision",
      "description": "Why the service uses a stateless boundary",
      "mimeType": "text/markdown"
    }
  ],
  "ttlMs": 300000,
  "cacheScope": "public",
  "_meta": {
    "io.modelcontextprotocol/serverInfo": {
      "name": "notes-server",
      "version": "2.0.0"
    }
  }
}
```

`resources/read` returns one or more content items. An unknown URI is not a successful empty read. The current Resources specification assigns invalid or unknown resource URIs to JSON-RPC invalid parameters, code `-32602`.

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "error": {
    "code": -32602,
    "message": "Unknown or invalid resource URI",
    "data": {
      "uri": "notes://missing"
    }
  }
}
```

That distinction lets a client separate absence from a valid empty document. It also prevents accidental fallback to a broader lookup.

### Resource templates

A resource template describes a family of parameterized URIs. Use one when listing every concrete item would be expensive or unbounded. For example, `notes://projects/{project}/decisions/{decision}` tells a client how to form a valid address without returning every decision.

A template does not weaken validation. Parse variables, apply authorization, enforce length and character limits, and construct storage queries with typed parameters. Never concatenate an arbitrary URI tail into a filesystem path or database statement.

### Content is not trusted instruction

Resource text may contain prompt injection, secrets, misleading commands, or malformed markup. The host should preserve provenance and treat resource content as data. The server should limit content size, return an accurate MIME type, redact fields the caller cannot access, and avoid returning unrelated records.

## Prompts Are User-Controlled Templates

MCP prompts are designed for explicit user selection. A host may render them as slash commands, menu items, or workflow buttons. The protocol does not require one UI.

`prompts/list` should be deterministic for the same request authorization. Each prompt needs a stable name, a useful description, and argument declarations that let the host collect input before `prompts/get`.

```json
{
  "resultType": "complete",
  "prompts": [
    {
      "name": "review_note",
      "title": "Review a note",
      "description": "Review one note for a named concern",
      "arguments": [
        {
          "name": "uri",
          "description": "The note resource URI",
          "required": true
        }
      ]
    }
  ],
  "ttlMs": 600000,
  "cacheScope": "public"
}
```

`prompts/get` resolves arguments into messages. It does not replace the host's system instructions. The host decides how returned messages enter model context and keeps its own trusted policy at higher priority.

Validate prompt arguments at the server boundary. A prompt URI should pass the same authorization check as a direct resource read. Do not make a prompt a side channel around resource access.

## Cache Hints Are Part of Correctness

`ttlMs` tells a client how long a result may be reused. `cacheScope` describes who may share that cached value.

| Scope | Meaning | Typical use |
|---|---|---|
| `public` | May be reused across users when authorization permits | Public prompt catalog |
| `private` | Bound to the requesting user or credential context | User-owned note content |

Choose a TTL from the data's change rate and the damage of staleness. Five minutes may suit a public prompt catalog. A private note read may use one minute.

MCP defines only `public` and `private` as `cacheScope` values. For a secret-bearing or rapidly changing result, return `cacheScope: "private"` with `ttlMs: 0`, then apply any stricter no-store rule in the host cache policy. `no-store` itself is not an MCP `cacheScope` value.

Cache hints never replace authorization. A cache key must include every request dimension that changes visibility, including tenant, user, scope, locale, and pagination cursor. If a shared cache cannot express those dimensions safely, use `private` with a zero TTL and a host-level no-store policy.

## Subscriptions Use a Client-Opened Response Stream

The modern subscription pattern replaces the former `resources/subscribe` RPC and the old HTTP GET event endpoint.

The client sends `subscriptions/listen` as a normal JSON-RPC request. Over Streamable HTTP this is a POST whose response remains open as an SSE stream. The `notifications` object is an allowlist. A server must not deliver notification types that were not requested.

```json
{
  "jsonrpc": "2.0",
  "id": 17,
  "method": "subscriptions/listen",
  "params": {
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientCapabilities": {},
      "io.modelcontextprotocol/clientInfo": {
        "name": "course-client",
        "version": "1.0.0"
      }
    },
    "notifications": {
      "resourcesListChanged": true,
      "promptsListChanged": true,
      "resourceSubscriptions": [
        "notes://note-1"
      ]
    }
  }
}
```

The request ID is the subscription ID. Before any requested event, the server sends `notifications/subscriptions/acknowledged`. Its filter contains only the subset the server accepted.

```json
{
  "jsonrpc": "2.0",
  "method": "notifications/subscriptions/acknowledged",
  "params": {
    "_meta": {
      "io.modelcontextprotocol/subscriptionId": 17
    },
    "notifications": {
      "resourcesListChanged": true,
      "resourceSubscriptions": [
        "notes://note-1"
      ]
    }
  }
}
```

Every later event on that stream carries the same metadata.

```json
{
  "jsonrpc": "2.0",
  "method": "notifications/resources/updated",
  "params": {
    "_meta": {
      "io.modelcontextprotocol/subscriptionId": 17
    },
    "uri": "notes://note-1"
  }
}
```

The notification says the resource changed. The client reads it again through `resources/read`, subject to current authorization. It does not assume the event contains the new document.

Several subscriptions can share one stdio channel. The subscription ID lets the client demultiplex them. Over HTTP, closing the response stream cancels the subscription. A server that ends the stream gracefully returns a final `resultType: "complete"` response correlated to the original request.

Do not use a subscription stream as a protocol session. A later read is still a complete request that can reach any healthy server instance.

```figure
t3-primitive-sort
```

## Interactive Lab

Use the figure to classify five capabilities from a project tracker: issue details, create issue, sprint review template, project policy, and close issue. Then decide which lists can be cached publicly, which reads must remain private, and which resources deserve update notifications.

For every classification, name the chooser. If the model performs an action, use a tool. If a host reads URI-addressed content, use a resource. If the user starts a prepared message workflow, use a prompt.

## Practice Lab

Run the simulator from the repository root:

```bash
cd phases/13-tools-and-protocols/10-mcp-resources-and-prompts/code
python3 main.py
python3 -m unittest discover tests -v
```

Inspect the transcript in this order:

1. Confirm `server/discover` advertises the current revision and both capabilities.
2. Confirm both list results are sorted and use `resultType: "complete"`.
3. Confirm the list and read results carry intentional cache hints.
4. Change the read URI to `notes://missing` and observe `-32602`.
5. Confirm the subscription acknowledgment precedes the resource event.
6. Confirm the event and graceful close both carry subscription ID `5`.

The Python model does not open a real HTTP connection. It represents the messages an SDK must place on the request-scoped response stream. Use an official SDK for framing and transport in production.

## Shipped Artifact

`outputs/skill-primitive-splitter.md` is a reusable design review for MCP primitive selection. It now checks deterministic discovery, cache scope, invalid URI behavior, and modern subscription filters.

The lesson also ships `assets/primitive-split.svg`, a static version of the primitive and subscription boundary for offline study.

## Verify It

```bash
cd phases/13-tools-and-protocols/10-mcp-resources-and-prompts/code
python3 main.py
python3 -m unittest discover tests -v
```

Expected result: the main program prints a JSON transcript and the test command reports at least twelve passing tests.

## Capstone Connection

Use this contract when your capstone server exposes addressable knowledge beside actions. Include one deterministic catalog snapshot, one authorized resource read, one prompt resolution, one invalid URI case, and one subscription transcript.

Your evidence should show that no list depends on connection history and that a subscription event never grants access to the underlying resource.

## Exercises

1. Add a `notes://projects/{project}/notes/{id}` resource template and validate both variables.
2. Add pagination to `resources/list` while preserving deterministic order.
3. Change one resource to `cacheScope: "private"` with `ttlMs: 0`, add a host-level no-store policy, and explain the threat that justifies both controls.
4. Add a prompt-list change subscription and prove no event is sent when the filter omits `promptsListChanged`.
5. Create two simultaneous subscriptions and prove each event carries the correct request ID.
6. Add an authorization subject to the read handler and prove a cache entry cannot cross subjects.

## Key Terms

- **Resource:** URI-addressed content exposed by an MCP server.
- **Prompt:** A user-controlled message template exposed by an MCP server.
- **Deterministic list:** A discovery result with stable membership and ordering for the same request inputs.
- **`ttlMs`:** Cache freshness duration in milliseconds.
- **`cacheScope`:** The sharing boundary for a cached result.
- **`subscriptions/listen`:** A long-lived request whose response stream delivers explicitly filtered notifications.
- **Subscription ID:** The original listen request ID, repeated in notification metadata.
- **Invalid parameters:** JSON-RPC error `-32602`, used for an invalid or unknown resource URI.
- **Unsupported protocol version:** JSON-RPC error `-32022`, including `supported` and `requested` revisions.
- **`server/discover`:** Mandatory server method that returns supported revisions, capabilities, identity, and optional cache hints.

## Further Reading

- [MCP 2026-07-28 Resources](https://modelcontextprotocol.io/specification/2026-07-28/server/resources)
- [MCP 2026-07-28 Prompts](https://modelcontextprotocol.io/specification/2026-07-28/server/prompts)
- [MCP 2026-07-28 Subscriptions](https://modelcontextprotocol.io/specification/2026-07-28/basic/patterns/subscriptions)
- [MCP 2026-07-28 Caching](https://modelcontextprotocol.io/specification/2026-07-28/basic/utilities/caching)
