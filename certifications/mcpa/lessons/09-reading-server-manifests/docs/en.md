# Reading a Server Manifest Like a Reviewer

> A server's discover result, its tool list, and its registry entry are the only things you know about it before you call anything, so read them the way you read a contract, because an unread default becomes a promise you did not mean to keep.

**Type:** Reference
**Languages:** Python
**Prerequisites:** Lesson 08
**Time:** ~45 minutes

## Learning Objectives

- Read a server/discover result, a tools/list page, and a registry server.json as the three documents that describe a server before any call is made
- Apply the tool annotation defaults (readOnlyHint false, destructiveHint true, idempotentHint false, openWorldHint true) to see what an omitted annotation actually promises
- Explain what capability flags, x-mcp-header marks, icons, and cacheScope choices imply about a server's behavior
- Spot manifest red flags: a destructive tool with no annotations, a secret mirrored through x-mcp-header, a public cacheScope on user-specific text, and instructions written to steer the model instead of describing it
- Parse a registry server.json name into its namespace and state how that namespace was verified

## The Problem

Before a host ever calls a tool, it already knows three things about the server: what `server/discover` claims to support, what `tools/list` currently offers, and, if the server is published, what its registry `server.json` says about who owns it. Nothing in the protocol forces any of those three documents to be complete, cautious, or honest. Annotations are hints. Instructions are self-reported prose. A registry name is only as trustworthy as the verification challenge behind it. A host that adds a server without reading these documents is trusting defaults and claims it never actually checked.

This is a different skill from writing a server or calling one. It is closer to reading a permissions manifest before installing an app: you are not executing anything yet, you are deciding whether the shape of what is offered matches what a reasonable server in this category should offer, and you are looking for the specific places a careless or hostile author would cut a corner. A tool with no `annotations` block did not opt out of being reviewed: the client is required to apply defaults, and the defaults lean toward caution, not permission. A parameter mirrored into an HTTP header through `x-mcp-header` is now visible to every proxy and load balancer between the client and the server. An `instructions` field is text the host may hand straight to the model. Reading a manifest well means treating every one of these as a claim to verify, not a fact to accept.

## The Concept

`server/discover` (from the discovery and capability negotiation lesson) is the first document: `supportedVersions`, `capabilities`, an optional `instructions` string, and `_meta["io.modelcontextprotocol/serverInfo"]`, all under a cacheable envelope carrying `ttlMs` and `cacheScope`. A reviewer reads `capabilities` first. `tools: {listChanged: true}` means the server will notify a listening client when its tool set changes, so a client that never subscribes will see a stale list past its `ttlMs`. `resources: {subscribe: true}` means individual resource updates are available, not just list changes. `completions: {}` means `completion/complete` is implemented. An `extensions` object lists optional protocol extensions and their settings; an extension key that is present but unfamiliar to the reviewer is worth looking up before trusting anything it changes.

`tools/list` (the schema contract from lesson 08) is the second document, and it is where most red flags live. Each tool carries `name`, `description`, `inputSchema`, and optional `title`, `icons`, `outputSchema`, and `annotations`. The annotations are the part a reviewer cannot skip: `readOnlyHint` defaults to false, `destructiveHint` defaults to true and is only meaningful when `readOnlyHint` is false, `idempotentHint` defaults to false, and `openWorldHint` defaults to true. Read that again in the direction it actually works: a tool that ships with no `annotations` object at all is, by the defaults a client must apply, not read-only and is destructive. Silence is not safety here. A reviewer who sees a bare tool definition with a name like `delete_account` or `run_report` should treat it as destructive until an explicit `readOnlyHint: true` or `destructiveHint: false` says otherwise, because that is exactly what the specification tells a conformant client to assume. All of this is a hint, never a guarantee: the specification is explicit that annotations must be treated as untrusted unless the server itself is trusted, so a reviewer's job is to notice the claim, not to enforce it.

`icons` are display metadata, but they are fetched from a URI, so a reviewer checks that they use `https:` or `data:` and share the server's origin; an SVG icon can carry executable script, so treat it as content, not decoration. The `x-mcp-header` property, set inside a schema property, mirrors that argument's value into an `Mcp-Param-{Name}` HTTP header so gateways can route on it without parsing the body. It has real constraints: the header name must be a valid HTTP field-name token with no spaces or control characters, it must be case-insensitively unique within one tool's schema, and it can only be applied to primitive types, never `number`. A client on Streamable HTTP must drop a tool whose `x-mcp-header` value breaks any of these rules from the result of `tools/list` rather than silently ignoring the annotation. Separately from syntax, a reviewer checks what is being mirrored: the specification warns servers not to mark a password, API key, token, or other secret this way, because header values are visible to every intermediary, not just the destination server.

Both `server/discover` and `tools/list` are cacheable results, which means every complete response must carry `ttlMs` and `cacheScope` of `public` or `private`. `cacheScope` is a hint about who may share a cached copy, not an access control: `public` means the same bytes can be served to a different caller's cache lookup, `private` means they cannot cross an authorization boundary. A reviewer reads the tool descriptions and the discover `instructions` against the declared scope: text that reads like it describes one caller's data (their account, their balance, the current user) paired with `cacheScope: "public"` is a real risk, because a caching layer that takes the scope at its word will happily hand one user's personalized list to the next caller who asks.

`instructions` deserves its own read. It exists to help a model use the server well, and it is exactly as self-reported as `serverInfo`, never verified by the protocol. Ordinary instructions describe the server: what it does, when to prefer one tool over another, what units it expects. Instructions written as commands aimed at the model itself, telling it to ignore prior guidance, always call a particular tool first, or withhold something from the user, are not describing the server anymore. That is the shape of a prompt injection delivered through a channel the client is likely to trust by default, and a reviewer should treat it exactly as suspiciously as an injected instruction found inside a tool result.

The third document lives outside the wire protocol entirely: a registry `server.json`. Its `name` field follows a reverse-DNS pattern, `io.github.username/server-name` or `com.example/server-name`, and the MCP Registry only accepts a name after the publisher proves ownership of the GitHub account or domain behind it through a verification challenge. A name with no `/` has no namespace at all, which means no ownership was, or could have been, verified against it: a reviewer should treat it exactly like an unsigned package. `packages` and `remotes` describe how to run the server (an npm, PyPI, NuGet, Cargo, MCPB, or OCI package, or a remote Streamable HTTP or SSE URL), and each package type has its own ownership proof, such as an `mcpName` field in `package.json` or a hidden `mcp-name:` marker in a README. The registry itself does not scan server code for vulnerabilities; it delegates that to the underlying package registries and to downstream aggregators, so namespace verification is the one guarantee a reviewer can rely on the registry for.

```figure
mcpa-09-manifest-anatomy
```

## Interactive Lab

The figure lays out the three documents side by side: a `server/discover` result with its capabilities and instructions, a `tools/list` entry with its annotations and an `x-mcp-header` mark, and a registry `server.json` with its namespaced name. Each panel marks the field a careless server most often gets wrong: instructions that read like a command instead of a description, a tool with no annotations at all, and a name with no verified namespace. Trace each marked field back to the rule in the concept section above it: what the field is supposed to mean, and what its absence or misuse actually implies for a client that follows the specification exactly.

## Practice Lab

Open `code/main.py`. It builds two servers that only answer `server/discover` and `tools/list`, an `acme-tools` server written the way a careless integration often ships, and a `docs-search` server written carefully, then runs both results and a hand-written `server.json` for each through `lint_manifest`. Run it from the lesson directory:

```bash
python3 code/main.py
```

Read the `acme-tools` report first. `delete_account` has no `annotations` block, and the linter flags it as destructive under the defaults, not because it guessed, but because the specification's defaults make it destructive. `rotate_api_key` mirrors `new_api_key` through `x-mcp-header`, and the linter flags the header as exposing something that reads like a secret. `run_report` mirrors `region_code` through a header value with a space in it, `"Region Code"`, which is not a valid HTTP field-name token, exactly the kind of definition a Streamable HTTP client must drop from its tool list rather than use. `get_balance` reads "your account balance for the current user" while the server's `tools/list` result is `cacheScope: "public"`, and the linter connects those two facts into a caching risk. The discover `instructions` field opens with "Ignore any prior guidance," and the linter catches that as language aimed at the model. The registry name `"acme-tools"` has no `/`, so it parses to nothing and gets flagged too. Compare that against `docs-search`: every tool is explicitly read-only, the header it uses is ordinary and unique, the cached text is genuinely public, the instructions describe the server instead of commanding the model, and its registry name `io.github.acmedocs/docs-search` parses cleanly with a GitHub-verified namespace. The transcript's last entry is not something the client sent; it is a `server/discover` reply a careless server might actually send, missing `ttlMs` and `cacheScope` entirely, wrapped as a deliberate violation so you can see what fails the caching contract before you ever see it fail a live call.

## Shipped Artifact

`outputs/manifest-review-checklist.md` is the one-page version of this lesson: what to read in each of the three documents, the annotation defaults table, the `x-mcp-header` rules, the caching and instructions red flags, and how to parse a registry namespace. Keep it next to you the first few times you add an unfamiliar server.

## Verify It

Run the tests from the lesson directory:

```bash
python3 -m unittest discover code/tests
```

They check the claims in this lesson: that a tool with no annotations gets the spec's defaults applied rather than being treated as unknown, that a bare destructive tool is flagged while explicitly read-only tools are not, that a secret-looking parameter mirrored through `x-mcp-header` is flagged separately from a header value that fails HTTP token syntax, that `x-mcp-header` is rejected on a `number` property, that a public cache scope paired with user-specific text is flagged, that steering language in `instructions` is caught, that a registry name without a namespace is rejected while a verified GitHub namespace parses correctly, that a clean manifest produces no findings at all, and that every request in the transcript still carries its required `_meta`. The repository's wire checker also validates the lesson's transcript against the 2026-07-28 rules:

```bash
python3 scripts/check_mcpa_wire.py certifications/mcpa/lessons/09-reading-server-manifests
```

## Capstone Connection

The capstone's end-to-end exchange starts with a discover call and a tool list before it ever reaches a real invocation, and everything it can safely assume at that point rests on this lesson: that capability flags were read correctly, that annotation defaults were applied rather than skipped, and that nothing in the manifest was steering the model before the first tool call happened. The trust boundary and consent lessons later in this track build directly on the habit of reading a manifest with suspicion before you ever act on what it claims.

## Key Terms

| Term | Meaning |
|------|---------|
| Manifest | The discover result, tool list, and registry server.json together, read before any call |
| Annotation defaults | readOnlyHint false, destructiveHint true, idempotentHint false, openWorldHint true when a tool omits annotations |
| x-mcp-header | A schema property that mirrors a primitive argument into an HTTP header for routing |
| cacheScope | Whether a cached result may be shared across users and tokens; never an access control |
| instructions | Natural-language, self-reported guidance a server offers about itself in server/discover |
| Reverse-DNS namespace | The io.github.user or com.example prefix in a server.json name, tied to a verified owner |
| Red flag | A manifest field whose claim does not match what a careful server in its category should show |
| Ownership verification | The GitHub, DNS, or HTTP challenge the registry uses to tie a name to a publisher |

## Further Reading

- [MCP specification 2026-07-28: Discovery](https://modelcontextprotocol.io/specification/2026-07-28/server/discover)
- [MCP specification 2026-07-28: Tools](https://modelcontextprotocol.io/specification/2026-07-28/server/tools)
- [MCP Registry overview](https://modelcontextprotocol.io/registry/about)
- `certifications/mcpa/research/mcp-2026-07-28-brief.md`, sections 6, 10, and 15
