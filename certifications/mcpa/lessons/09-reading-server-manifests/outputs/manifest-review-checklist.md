# Manifest Review Checklist

A one-page reference for reviewing an unfamiliar MCP server before adding it, aligned to MCP 2026-07-28. Read all three documents before the first real call: the server/discover result, the tools/list result, and, if the server is published, its registry server.json.

## 1. server/discover

- `capabilities`: note which of tools, resources, prompts, completions, logging, and extensions are present. An unfamiliar extension key is worth looking up before trusting what it changes.
- `resources: {subscribe: true}` means individual resource updates are available; `listChanged: true` on any primitive means the server will notify a listening client when that list changes.
- `instructions`: should describe the server (what it does, when to prefer one tool over another). Treat commands aimed at the model itself as a red flag (see section 5).
- `ttlMs` and `cacheScope` must both be present on a complete result. Missing either fails the caching contract.

## 2. tools/list, one tool at a time

- `name`, `description`, `inputSchema` are required; `inputSchema` is never null.
- Read `annotations` against the defaults, not around them:

| Annotation | Default when omitted | Meaningful when |
|---|---|---|
| `readOnlyHint` | `false` | always |
| `destructiveHint` | `true` | `readOnlyHint` is `false` |
| `idempotentHint` | `false` | `readOnlyHint` is `false` |
| `openWorldHint` | `true` | always |

A tool with no `annotations` block at all is, by these defaults, not read-only and is destructive. Treat it that way until an explicit `readOnlyHint: true` or `destructiveHint: false` says otherwise. All of this is a hint: never trust annotations from a server you do not otherwise trust.

- `icons`: only `https:` or `data:` URIs, same origin as the server; treat SVG as executable content, not decoration.
- `outputSchema` and `structuredContent`: if an output schema is declared, the server must conform to it, and it should still return a text mirror for backward compatibility.

## 3. x-mcp-header, per property

- Value must be a non-empty, valid HTTP field-name token: no spaces, no control characters.
- Must be case-insensitively unique among every `x-mcp-header` value in that tool's schema.
- Only on primitive properties (string, integer, boolean); never on `number`.
- A client on Streamable HTTP must drop the whole tool from `tools/list` if any of the above fails, not silently ignore the annotation.
- Never on a parameter that reads like a password, API key, token, or credential: header values are visible to every network intermediary, not just the server.

## 4. cacheScope, read against the text it caches

- `public`: the same result may be served to a different caller's cache lookup. `private`: it may not cross an authorization boundary.
- `cacheScope` is never an access control by itself.
- Red flag: tool descriptions or instructions that read as user-specific ("your account," "your balance," "the current user") paired with `cacheScope: "public"`.

## 5. instructions, read as untrusted text

- Legitimate: describes the server, its units, or when to prefer one tool over another.
- Red flag: imperative language addressed to the model, such as telling it to ignore prior guidance, always call one tool first, or withhold something from the user. Treat it as a prompt-injection attempt, not guidance.
- `instructions` and `serverInfo` are both self-reported and unverified by the protocol; neither should drive a security decision.

## 6. Registry server.json

- `name` must be a reverse-DNS namespace, `io.github.user/server` or `com.example/server`. A name with no `/` has no verified owner behind it.
- `io.github.*` names are GitHub-verified; other namespaces are DNS- or HTTP-challenge-verified against a domain.
- `packages` (npm, PyPI, NuGet, Cargo, OCI, MCPB) and `remotes` (streamable-http, sse) describe how to run the server; each package type has its own ownership proof, such as `mcpName` in `package.json`.
- The registry does not scan server code for vulnerabilities; it delegates that to the underlying package registries and to downstream aggregators. Namespace verification is what the registry itself guarantees.

## Remember for the exam

- Omitted annotations are not neutral: the defaults make a bare tool destructive.
- `x-mcp-header` constraints are enforced by the client (drop the tool), not by the server.
- `cacheScope` controls sharing, not access.

Source: `certifications/mcpa/research/mcp-2026-07-28-brief.md`, sections 6, 10, and 15.
