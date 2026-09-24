# Trust Boundary Map

A one-page reference for the MCPA "Security and Governance" domain, aligned to MCP 2026-07-28.

## The five zones

| Zone | What it is | Default trust |
|------|------------|----------------|
| User and host | The person, and the application they run | Root of trust; every other zone earns trust from a choice made here |
| Client | The component inside the host that talks to one server | Fully trusted; the host owns and embeds it |
| Server | A separate program, often third party, local or remote | Untrusted by default, even over a local stdio pipe |
| Upstream systems | Whatever the server itself calls out to | Untrusted, and usually invisible to the client entirely |
| Model | The language model reading assembled context | Downstream of every zone; must treat server-origin content as data, not instruction |

## What crosses into the model untrusted

- Tool `name`, `description`, `icons`, and `annotations`
- `tools/call` result `content` blocks and `structuredContent`
- `resources/read` text and blob contents
- `server/discover` `instructions` text
- Anything embedded inside any of the above, including text that looks like an instruction

## Rules to apply

- **Self-reported identity**: `clientInfo` and `serverInfo` are for display, logging, and debugging only. A trust decision uses the host's own record of which server it connected, never the name the connection claims for itself.
- **Untrusted annotations**: treat `readOnlyHint`, `destructiveHint`, `idempotentHint`, and `openWorldHint` as untrusted unless the declaring server is on the host's trusted list. Fall back to the safe defaults (false, true, false, true) for any safety decision otherwise.
- **Icon safety**: accept only `https:` and `data:` icon URIs. Reject `javascript:`, `file:`, `ftp:`, and any other scheme. Fetch without credentials and treat SVG payloads as potentially executable.
- **Multi-server isolation**: an instruction embedded inside one server's content must never, by itself, justify a call to a different server's tool. Only a choice the model makes on its own may cross that boundary, and that choice still goes through the consent gate for a side-effecting call.
- **Local server consent (SEP-1024)**: a client offering one-click local server installation must show the exact command, unabridged, and require explicit user approval before running it.
- **DNS rebinding**: a local HTTP server validates the `Origin` header and rejects anything it does not recognize, rather than trusting any request that reaches `127.0.0.1`.
- **stdio credentials**: read credentials from the environment. Do not run the OAuth authorization flow over a stdio transport.

## Red flags checklist

- Tool result content contains an instruction naming a different server or tool
- An icon URI uses a scheme other than `https` or `data`
- A `destructiveHint: false` claim is trusted from a server that is not on the allow list
- A local launch command was read from returned content instead of the host's own configuration
- A local HTTP server accepts requests regardless of their `Origin` header
- `serverInfo.name` is used anywhere in an authorization or trust decision

## Remember for the exam

- `clientInfo` and `serverInfo` are never a security decision, only display.
- Tool annotations are hints, not guarantees, even from a server the host trusts a little.
- A local server compromise scenario traces back to SEP-1024's consent requirement.
- The fix for an embedded cross-server instruction is refusal at the host, not a JSON-RPC error; the wire exchange carrying it can be perfectly valid.

Source: `certifications/mcpa/research/mcp-2026-07-28-brief.md`, sections 3, 12, and 13.
