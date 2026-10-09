# Extensions, the gRPC binding, and the `tenant` field (A2A v1.0.1)

Research notes for three new manual sections. Pin: A2A tag `v1.0.1`, commit `3303592588e388e62e0f69f701af531d2f4e3991`, 2026-05-28. Written 2026-10-06.

Conventions:

- "spec §x.y" means `manuals/a2a-101/research/sources/specification.md`; "proto" means `.../sources/a2a.proto` (message name given); "docs <page>" means the page inside `.../sources/docs.md`. Quotes are copied character for character. A proto comment is quoted without its leading `//`, consecutive comment lines joined with one space (the convention `research/brief-spec.md` already uses). A docs quote that wraps across source lines is joined with one space.
- "tag page" means a page that exists at `v1.0.1` but is not in `docs.md`; copies are in `research/v2/data/tag/docs/topics/`. Permalink base for those: `https://github.com/a2aproject/A2A/blob/v1.0.1/docs/topics/`.
- Live upstream is for status and implementation evidence only. Every live claim carries a link with a tag or SHA. `main` of `a2aproject/A2A` was read at `679ab3afc6f95ef47bb969d511053d0f63bca2a2` (2026-10-05).
- SDK checkouts used: a2a-python `v1.2.2` (`2f9e44af243df5c7c7a3da361c8d095324bcd5e3`), a2a-js `v1.3.0` (`29417a5bb4038f804f310ce4fffd267a9375aa90`), a2a-go `v2.6.0` (`ebf17c56ef7e63c72883a45454a538bbc0df66b8`), a2a-java `v1.4.0.Final` (`6408194186cb708de9672b40a9e9e026563028f2`), a2a-dotnet `v1.0.0-preview2` (`87fd44843dd16339cdb59c2ff547fe374ac46736`) plus main `6894043111ec20e8546d446ee2a2e5a2a190518f`, a2a-rs commit `32c31f69cf3b2b7697de56d1528005bb3f10768f` (tags `a2a-server-lf-v0.5.1`, `a2a-grpc-v0.3.9`, `a2a-slimrpc-v0.2.11`). The per-SDK behavior notes are in `research/v2/notes/*.md`.
- Where the pinned sources say nothing, the text says so.

The manual's conflict register (`sections/r-6-sources.md`, D1 to D40) is referenced by ID where a known conflict touches these topics. New findings are numbered N1 onward in `research/v2/migration.md`.

---

## A. Extensions

### A.1 Rules from the pinned sources

#### A.1.1 Where the pinned sources talk about extensions

| Place | What it holds |
|---|---|
| spec §3.2.5 Metadata | extensions strongly type metadata |
| spec §3.2.6 Service Parameters | the `A2A-Extensions` service parameter |
| spec §3.3.2 Error Handling | `ExtensionSupportRequiredError` |
| spec §3.3.4 Capability Validation | the MUST for required extensions |
| spec §4.4.3, §4.4.4 | `AgentCapabilities`, `AgentExtension` (tables are rendered from the proto; the markdown holds only `{{ proto_to_table(...) }}` macros) |
| spec §4.6, §4.6.1, §4.6.2, §4.6.3 | the extensions chapter: declaration, extension points, versioning |
| spec §5.4 | error code mapping row |
| spec §9.2, §10.2, §11.2 | per-binding transmission of `A2A-Extensions` |
| spec §12.3 | custom bindings must document service parameters |
| spec §14.2.2 | IANA template for the `A2A-Extensions` header |
| proto `AgentExtension`, `AgentCapabilities.extensions`, `Message.extensions`, `Artifact.extensions` | the data model |
| docs extensions (`docs/topics/extensions.md`) | kinds, activation, required, dependencies, governance pointer, implementation guidance |
| docs whats-new-v1 | what changed for extensions in 1.0 |
| tag page `extension-and-binding-governance.md` | tiers, lifecycle, SDK support rules (not in `docs.md`) |

#### A.1.2 What an extension is

spec §4.6: "The A2A protocol supports extensions to provide additional functionality or data beyond the core specification while maintaining backward compatibility and interoperability. Extensions allow agents to declare additional capabilities such as protocol enhancements or vendor-specific features, maintain compatibility with clients that don't support specific extensions, enable innovation through experimental or domain-specific features without modifying the core protocol, and facilitate standardization by providing a pathway for community-developed features to become part of the core specification."

docs extensions: "Extensions allow for extending the A2A protocol with new data, requirements, RPC methods, and state machines. Agents declare their support for specific extensions in their Agent Card, and clients can then opt in to the behavior offered by an extension as part of requests they make to the agent. Extensions are identified by a URI and defined by their own specification. Anyone is able to define, publish, and implement an extension."

spec §3.2.5: "[`Extensions`](#46-extensions) can be used to strongly type metadata values for specific use cases."

#### A.1.3 `AgentExtension` and where it sits in the card

proto `AgentExtension` (comment: "A declaration of a protocol extension supported by an Agent."):

| Field | Number | Type | Proto comment, verbatim |
|---|---|---|---|
| `uri` | 1 | `string` | "The unique URI identifying the extension." |
| `description` | 2 | `string` | "A human-readable description of how this agent uses the extension." |
| `required` | 3 | `bool` | "If true, the client must understand and comply with the extension's requirements." |
| `params` | 4 | `google.protobuf.Struct` | "Optional. Extension-specific configuration parameters." |

None of the four fields carries `(google.api.field_behavior) = REQUIRED`.

Where it appears: proto `AgentCapabilities`, field `repeated AgentExtension extensions = 3;` with comment "A list of protocol extensions supported by the agent." So the JSON path is `capabilities.extensions`, not a top-level `extensions` on the card. The §4.6.1 sample card confirms the path (`"capabilities": { ..., "extensions": [ ... ] }`), and docs extensions says it plainly: "Agents declare their support for extensions in their Agent Card by including `AgentExtension` objects within their `AgentCapabilities` object."

Two pinned passages word it loosely:

- spec §4.6.1: "Agents declare their supported extensions in the [`AgentCard`](#441-agentcard) using the `extensions` field, which contains an array of [`AgentExtension`](#444-agentextension) objects." (the field is on `AgentCapabilities`; the sample under this sentence shows the correct path)
- docs whats-new-v1, snippet "#### 3. Extension Requirements": `const requiredExtensions = agentCard.extensions` (no such field; already flagged in `research/brief-docs.md` L1200, not in the register; see N2 in `migration.md`)

The docs extensions sample card (Magic 8-ball) shows `params` in use and carries a 0.3-shaped top-level `"url"` (flagged in brief-docs; fixed on main, see A.2.1).

#### A.1.4 The `extensions` fields on `Message` and `Artifact`

- proto `Message`, `repeated string extensions = 7;`, comment "The URIs of extensions that are present or contributed to this Message."
- proto `Artifact`, `repeated string extensions = 6;`, comment "The URIs of extensions that are present or contributed to this Artifact."
- docs whats-new-v1, Message object: "- ✅ `extensions[]`: Array of extension URIs applicable to this message"; Artifact object: "- ✅ `extensions[]`: Array of extension URIs"; Get Task: "- **✅ NEW:** Task object now includes `extensions[]` array in messages and artifacts"

`Task`, `TaskStatus`, `TaskStatusUpdateEvent`, `TaskArtifactUpdateEvent` and `Part` have no `extensions` field in the proto; they carry only `metadata`.

spec §4.6.2 names two extension points:

- "Extensions can be integrated into the A2A protocol at several well-defined extension points:"
- Message extensions: "Messages can be extended to allow clients to provide additional strongly typed context or parameters relevant to the message being sent, or TaskStatus Messages to include extra information about the task's progress."
- Artifact extensions: "Artifacts can include extension data to provide strongly typed context or metadata about the generated content."

The pattern in both §4.6.2 samples: the URI goes into `extensions`, and the payload goes into `metadata` under the same URI as key (`"metadata": { "https://example.com/extensions/geolocation/v1": { ... } }`). The spec never states this keying as a rule; it is shown only by example. docs extensions says, for what extensions may not do: "Extensions should place custom attributes in the `metadata` map present on core data structures."

#### A.1.5 How a client activates an extension

spec §3.2.6 defines the service parameter. Table row for `A2A-Extensions`: "Comma-separated list of extension URIs that the client wants to use for the request", example value `https://example.com/extensions/geolocation/v1,https://standards.org/extensions/citations/v1`. The paragraph before the table: "A key-value map for passing horizontally applicable context or parameters with case-insensitive string keys and case-sensitive string values. The transmission mechanism for these service parameter key-value pairs is defined by the specific protocol binding (e.g., HTTP headers for HTTP-based bindings, gRPC metadata for gRPC bindings). Custom protocol bindings **MUST** specify how service parameters are transmitted in their binding specification." And after it: "As service parameter names MAY need to co-exist with other parameters defined by the underlying transport protocol or infrastructure, all service parameters defined by this specification will be prefixed with `a2a-`."

spec §4.6.1: "Clients indicate their desire to opt into the use of specific extensions through binding-specific mechanisms such as HTTP headers, gRPC metadata, or JSON-RPC request parameters that identify the extension identifiers they wish to utilize during the interaction." (the "JSON-RPC request parameters" option is contradicted by §9.2, which requires headers: register D30)

Per binding:

- JSON-RPC, spec §9.2: "A2A service parameters defined in [Section 3.2.6](#326-service-parameters) **MUST** be transmitted using standard HTTP request headers, as JSON-RPC 2.0 operates over HTTP(S)." and "- Multiple values for the same service parameter (e.g., `A2A-Extensions`) **SHOULD** be comma-separated in a single header field"
- gRPC, spec §10.2: "A2A service parameters defined in [Section 3.2.6](#326-service-parameters) **MUST** be transmitted using gRPC metadata (headers)." and "- Multiple values for the same service parameter (e.g., `A2A-Extensions`) **SHOULD** be comma-separated in a single metadata entry". The §10.2 Go sample uses the lowercase key `"a2a-extensions"`.
- HTTP+JSON, spec §11.2: "A2A service parameters defined in [Section 3.2.6](#326-service-parameters) **MUST** be transmitted using standard HTTP request headers." and "- Service parameter keys are case-insensitive per HTTP specification (RFC 9110)"

The §4.6.1 HTTP sample sends `A2A-Extensions: https://example.com/extensions/geolocation/v1,https://standards.org/extensions/citations/v1` on `POST /message:send` and, in the body, lists one of them in `message.extensions` with its payload under `message.metadata` keyed by the URI. (That sample is in the invalid-JSON list, register D24: trailing comma in the card sample above it; the message sample itself parses.)

spec §14.2.2 (IANA template): "The A2A-Extensions header field contains a comma-separated list of extension URIs that the client wants to use for the request. Extensions allow agents to provide additional functionality beyond the core A2A specification while maintaining backward compatibility." Its "Specification document" line points to "Section 3.2.5", which is the metadata section; service parameters are §3.2.6 (register D17).

docs extensions, activation steps (verbatim, line breaks joined):

1. "**Client Request**: A client requests extension activation by including the `A2A-Extensions` header in the HTTP request to the agent. The value is a comma-separated list of extension URIs the client intends to activate."
2. "**Agent Processing**: Agents are responsible for identifying supported extensions in the request and performing the activation. Any requested extensions not supported by the agent can be ignored."
3. "**Response**: Once the agent has identified all activated extensions, the response SHOULD include the `A2A-Extensions` header, listing all extensions that were successfully activated for that request."

Also docs extensions: "Extensions default to being inactive, providing a baseline experience for extension-unaware clients. Clients and agents perform negotiation to determine which extensions are active for a specific request."

Dependencies (docs extensions): "It is the client's responsibility to activate an extension and all its required dependencies as listed in the extension's specification."

#### A.1.6 How a server reports the extensions it activated

The normative spec says nothing: no section of `specification.md` describes a response-side `A2A-Extensions` header, and §14.2.2 registers the header without saying which direction it travels. The only rule is the non-normative docs extensions step 3 quoted above ("the response SHOULD include the `A2A-Extensions` header, listing all extensions that were successfully activated for that request"), and its sample response `A2A-Extensions: https://example.com/ext/konami-code/v1`. For gRPC the pinned sources say nothing about response metadata; the SDKs that echo use response (initial or trailing) metadata under `a2a-extensions` (A.2.3).

#### A.1.7 When a required extension is not supported

- spec §3.3.4: "- **Extensions**: When a server requests use of an extension marked as `required: true` in the Agent Card but the client does not declare support for it, the agent **MUST** return [`ExtensionSupportRequiredError`](#332-error-handling)." And the closing sentence of §3.3.4: "Clients **SHOULD** validate capability support by examining the Agent Card before attempting operations that require optional capabilities."
- spec §3.3.2 table, `ExtensionSupportRequiredError`: "Server requested use of an extension marked as `required: true` in the Agent Card but the client did not declare support for it in the request."
- spec §5.4 table row: `ExtensionSupportRequiredError` | JSON-RPC `-32008` | gRPC `FAILED_PRECONDITION` | HTTP `400 Bad Request`.
- The `ErrorInfo.reason` for it follows the §10.6 and §11.6 rule ("The A2A error type in UPPER_SNAKE_CASE without the "Error" suffix"), so `EXTENSION_SUPPORT_REQUIRED` with `domain` `"a2a-protocol.org"`. The spec never writes that reason string out; it is derived.
- spec §4.6.3, the version-mismatch case: "If a client requests a versions of an extension that the agent does not support, the agent **SHOULD** ignore the extension for that interaction and proceed without it, unless the extension is marked as `required` in the AgentCard, in which case the agent **MUST** return an error indicating unsupported extension. It **MUST NOT** fall back to a previous version of the extension automatically."
- docs extensions, Required Extensions: "When an Agent Card declares an extension as `required: true`, it signals to clients that some aspect of the extension impacts how requests are structured or processed, and that the client must abide by it. Agents shouldn't mark data-only extensions as required. If a client does not request activation of a required extension, or fails to follow its protocol, the agent should reject the incoming request with an appropriate error."
- docs extensions, Security: "- **Scope of Required Extensions**: Be mindful when marking an extension as `required: true` in an Agent Card. This creates a hard dependency for all clients and should only be used for extensions fundamental to the agent's core function and security (for example, a message signing extension)."

The pinned sources say nothing about which operations the check applies to (all requests, or only `SendMessage`), nor whether the check runs before authentication. The §3.3.4 wording "When a server requests use of" reads oddly (it is the client that requests); the register does not list it.

#### A.1.8 The kinds of extension the docs describe

docs extensions, "Scope of Extensions" (verbatim bullet heads, bodies joined):

- "**Data-only Extensions**: Exposing new, structured information in the Agent Card that doesn't impact the request-response flow. For example, an extension could add structured data about an agent's GDPR compliance."
- "**Profile Extensions**: Overlaying additional structure and state change requirements on the core request-response messages. This type effectively acts as a profile on the core A2A protocol, narrowing the space of allowed values (for example, requiring all messages to use `DataParts` adhering to a specific schema). This can also include augmenting existing states in the task state machine by using metadata. For example, an extension could define a 'generating-image' substate when `TaskStatus.state` is 'working' and `TaskStatus.message.metadata["generating-image"]` is true."
- "**Method Extensions (Extended Skills)**: Adding entirely new RPC methods beyond the core set defined by the protocol. An Extended Skill refers to a capability or function an agent gains or exposes specifically through the implementation of an extension that defines new RPC methods. For example, a `task-history` extension might add a `tasks/search` RPC method to retrieve a list of previous tasks, effectively providing the agent with a new, extended skill."
- "**State Machine Extensions**: Adding new states or transitions to the task state machine."

Stale vocabulary inside these bullets (`DataParts`, lowercase `'working'`, 0.3-style `tasks/search`) is flagged in `research/brief-docs.md` L887 and L1219. The "State Machine Extensions" bullet conflicts with the page's own Limitations bullet "**Adding New Values to Enum Types**: Extensions should use existing enum values and annotate additional semantic meaning in the `metadata` field." (register D29). The other limitation: "**Changing the Definition of Core Data Structures**: For example, adding new fields or removing required fields to protocol-defined data structures. Extensions should place custom attributes in the `metadata` map present on core data structures."

Example extensions table (docs extensions): Secure Passport, Hello World or Timestamp, Traceability, Agent Gateway Protocol (AGP), all linking into `a2aproject/a2a-samples` (status in A.2.2).

What an extension specification must contain (docs extensions, "Extension Specification"): "- The specific URI(s) that identify the extension." ; "- The schema and meaning of objects specified in the `params` field of the `AgentExtension` object." ; "- Schemas of any additional data structures communicated between client and agent." ; "- Details of new request-response flows, additional endpoints, or any other logic required to implement the extension."

#### A.1.9 Versioning and URI rules

- spec §4.6.3: "Extensions **SHOULD** include version information in their URI identifier. This allows clients and agents to negotiate compatible versions of extensions during interactions. A new URI **MUST** be created for breaking changes to an extension."
- docs extensions, Implementation Considerations, Versioning: "**Recommendation**: Use the extension's URI as the primary version identifier, ideally including a version number (for example, `https://example.com/ext/my-extension/v1`)." ; "**Breaking Changes**: A new URI MUST be used when introducing a breaking change to an extension's logic, data structures, or required parameters." ; "Handling Mismatches: If a client requests a version not supported by the agent, the agent SHOULD ignore the activation request for that extension; it MUST NOT fall back to a different version."
- docs extensions, Discoverability: "**Specification Hosting**: The extension specification document **should** be hosted at the extension's URI." ; "**Permanent Identifiers**: Authors are encouraged to use a permanent identifier service, such as `w3id.org`, for their extension URIs to prevent broken links."
- docs extensions, Governance: "Official extensions use the `https://a2a-protocol.org/extensions/` URI prefix and are hosted under the `a2aproject` organization with the `ext-` repository prefix (experimental extensions use `experimental-ext-`)."
- tag page `extension-and-binding-governance.md` (not in `docs.md`), Tiers table: official repo prefix `ext-{name}`, experimental `experimental-ext-{name}`, official URI prefix `https://a2a-protocol.org/extensions/`. Official iteration: "- Breaking changes require a new identifier" and "- Breaking changes require TSC review". SDK support: "**Extensions**: A2A SDKs MAY implement extensions." and "- Extensions MUST be disabled by default and require explicit opt-in" and "- Extension support is not required for protocol conformance".

The pinned sources say nothing about the URI scheme (https vs other), about whether the URI must resolve, or about a registry. The main branch added that answer after the tag: "These URIs are identifiers, HTTP access is not expected." (A.2.1).

#### A.1.10 Every MUST, SHOULD and MAY about extensions

Normative (spec):

| Level | Rule | Where |
|---|---|---|
| MUST | custom bindings specify how service parameters (so `A2A-Extensions`) travel | §3.2.6, §12.3 |
| MUST | return `ExtensionSupportRequiredError` when a `required: true` extension is not declared by the client | §3.3.4 |
| MUST | transmit service parameters as HTTP headers (JSON-RPC, HTTP+JSON) / gRPC metadata keys (gRPC) | §9.2, §11.2, §10.2 |
| MUST | gRPC implementations extract service parameters from metadata | §10.2 |
| MUST | create a new URI for a breaking change to an extension | §4.6.3 |
| MUST | return an error for an unsupported version of a `required` extension | §4.6.3 |
| MUST NOT | fall back to a previous version of an extension automatically | §4.6.3 |
| SHOULD | include version information in the extension URI | §4.6.3 |
| SHOULD | ignore an unsupported, non-required extension and proceed | §4.6.3 |
| SHOULD | comma-separate multiple values in one header field / metadata entry | §9.2, §10.2, §11.2 |
| SHOULD | clients check the card before using optional capabilities | §3.3.4 |
| MAY | service parameter names co-exist with transport parameters, hence the `a2a-` prefix | §3.2.6 |

Non-normative (docs extensions, governance page):

| Level | Rule | Where |
|---|---|---|
| SHOULD | response includes `A2A-Extensions` listing activated extensions | docs extensions, Activation step 3 |
| MUST | new URI for a breaking change | docs extensions, Versioning |
| SHOULD / MUST NOT | ignore unsupported version / never fall back | docs extensions, Versioning |
| should | host the specification at the URI | docs extensions, Discoverability |
| MUST | validate all extension input; treat it as untrusted | docs extensions, Security |
| MUST | extension methods get the same authentication and authorization checks | docs extensions, Security |
| MUST NOT | an extension bypasses the agent's primary security controls | docs extensions, Security |
| MAY | SDKs implement extensions | governance, SDK Support |
| MUST | SDK extensions disabled by default, explicit opt-in | governance, SDK Support |
| SHOULD | SDK documentation lists supported extensions | governance, SDK Support |
| MUST | official extensions: RFC 2119 language, Apache 2.0, one reference implementation | governance, Official |
| SHOULD | official extensions have documentation on the A2A website | governance, Official |

#### A.1.11 Docs pages to add to `docs.md`

`docs/topics/extension-and-binding-governance.md` exists at the tag (added 2026-04-07 in #1619, in the mkdocs nav at `v1.0.1`) and is cross-referenced by docs extensions. Recommend adding the tag copy. Main differs from the tag by a new "URI namespaces" subsection (2026-07-09, #2015) and one RFC link change (2026-09-29); see A.2.1 for the diff.

### A.2 Upstream and SDK status

#### A.2.1 The A2A repository after the tag

- Topic pages: `docs/topics/extensions.md` changed on main (diff tag..main, 22 lines): a `!!! note "URI Namespaces"` block ("The `https://a2a-protocol.org/extensions/` prefix is a canonical namespace for globally unique extension identifiers ... These URIs are identifiers, HTTP access is not expected."), the Magic 8-ball sample card now uses `supportedInterfaces` instead of top-level `url`, and the flow image got descriptive alt text. `extension-and-binding-governance.md` gained a "### URI namespaces" section with the same statement and the `{name}/v1` pattern (`https://a2a-protocol.org/extensions/{name}/v1`, `https://a2a-protocol.org/bindings/{name}/v1`). The example-extensions table is unchanged. Links: tag `https://github.com/a2aproject/A2A/blob/v1.0.1/docs/topics/extensions.md`, main `https://github.com/a2aproject/A2A/blob/679ab3afc6f95ef47bb969d511053d0f63bca2a2/docs/topics/extensions.md`.
- Spec on main: §4.6 unchanged. New §7.6.4 "In-Task Authorization Scope" (relevant to the OID4VP extension): "The meaning and scope of any resulting authorization decision or credential MUST be defined by the agent's implementation, by the credential issuer, or by an A2A extension." Link: `https://github.com/a2aproject/A2A/blob/679ab3afc6f95ef47bb969d511053d0f63bca2a2/docs/specification.md`.

#### A.2.2 Official and experimental extensions in the `a2aproject` org

`gh repo list a2aproject` on 2026-10-06 returns 18 repositories. None is named `ext-*`: there is no official extension yet. One experimental extension and one experimental binding exist:

| Repo | Status | Latest commit | Identifier | Notes |
|---|---|---|---|---|
| [experimental-ext-oid4vp-auth](https://github.com/a2aproject/experimental-ext-oid4vp-auth/tree/e86356d4a330ede795eb5b458fd2a838ffea0064) | Experimental ("v1 Draft"); README: "breaking changes are possible" | `e86356d` 2026-08-05 ("Update wording for Authorization Request data structure"); repo created 2026-05-14, before the tag | `https://github.com/a2aproject/experimental-ext-oid4vp-auth/tree/main/v1` (spec `v1/spec.md` L3 and the sample card at L57) | "OID4VP In-Task Authorization Extension": the agent moves the task to `TASK_STATE_AUTH_REQUIRED` (spec §7.6) and places an OID4VP authorization request under `metadata[<extension URI>].authorizationRequest` with `client_id` and `request_uri` or `request` (`v1/spec.md` L66-L75); the client invokes an OID4VP wallet. Sample implementation in `sample/` (TypeScript, pnpm; upgraded to "A2A SDK 1.x" on 2026-08-04). Does not use the official `https://a2a-protocol.org/extensions/` prefix. |
| [experimental-cpb-slimrpc](https://github.com/a2aproject/experimental-cpb-slimrpc/tree/1328426d3226326f86dd21f1d9853083e91bc4bc) | Experimental binding (see B.2.2) | `1328426` 2026-09-29 | `https://a2a-protocol.org/bindings/experimental-slimrpc/v1` | custom protocol binding, not an extension; its latest commit also adds "A2A collaborative task extension and SLIMRPC profile" (`spec/v1/slimrpc-broadcast-live.md`) |

Example extensions in `a2aproject/a2a-samples` (checkout `6603ba3f2c31a7ef33e70b9d8b5b5f8be42ac9a3`, 2026-08-04), the four the docs page lists:

| Sample | Path | URI used in the sample |
|---|---|---|
| Timestamp | [extensions/timestamp](https://github.com/a2aproject/a2a-samples/tree/6603ba3f2c31a7ef33e70b9d8b5b5f8be42ac9a3/extensions/timestamp) | `https://github.com/a2aproject/a2a-samples/samples/extensions/timestamp/v1` |
| Traceability | [extensions/traceability](https://github.com/a2aproject/a2a-samples/tree/6603ba3f2c31a7ef33e70b9d8b5b5f8be42ac9a3/extensions/traceability) | `https://github.com/a2aproject/a2a-samples/extensions/traceability/v1` |
| Secure Passport | [extensions/secure-passport](https://github.com/a2aproject/a2a-samples/tree/6603ba3f2c31a7ef33e70b9d8b5b5f8be42ac9a3/extensions/secure-passport) | links to `samples/python/extensions/secure-passport` (no `.../v1` URI string found by grep) |
| AGP | [extensions/agp](https://github.com/a2aproject/a2a-samples/tree/6603ba3f2c31a7ef33e70b9d8b5b5f8be42ac9a3/extensions/agp) | repo-tree links only |

These are samples, not governed artifacts; none sits in an `ext-` or `experimental-ext-` repo.

The TCK (`a2aproject/a2a-tck`, `1.0.0.alpha2`, `29063fe95e903cddac5d8ff811ab94df1ad6ef86`) references `A2A-Extensions` in `tests/compatibility/core_operations/test_transport_behavior.py` and in `tck/requirements/binding_grpc.py`, `binding_http_json.py`; it has no dedicated extension-activation suite that I found.

#### A2.3 How each SDK supports extensions

| SDK (tag) | Parse `A2A-Extensions` on the server | Expose to the agent | Echo activated extensions | Required-extension check | Client helper | Error mapping |
|---|---|---|---|---|---|---|
| a2a-python 1.2.2 | yes: `ServerCallContext.requested_extensions` from the header (REST/JSON-RPC) and from gRPC metadata | `RequestContext.requested_extensions` | no (no response writer of the header in `src/a2a`; grep) | none built in (`ExtensionSupportRequiredError` appears only in error tables) | `with_a2a_extensions([...])` merges URIs into the `A2A-Extensions` service parameter | -32008, gRPC `FAILED_PRECONDITION` |
| a2a-js 1.3.0 | yes, all three bindings | `ServerCallContext.requestedExtensions` | yes: `A2A-Extensions` on JSON-RPC and REST responses, `a2a-extensions` gRPC metadata; 0.3 path echoes `X-A2A-Extensions` | not located | `Extensions.parseServiceParameter` / `toServiceParameter` | yes |
| a2a-go 2.6.0 | yes (`a2a.SvcParamExtensions`) | `a2asrv.ExtensionsFrom(ctx)`: `Requested`, `Activate`, `ActivatedURIs` | gRPC: response metadata `a2a-extensions` (v1) / `x-a2a-extensions` (v0); HTTP echo not located by grep | not located | `a2aext` propagator forwards `A2A-Extensions` and matching metadata downstream | yes |
| a2a-java 1.4.0.Final | yes (JSON-RPC, REST, gRPC) | `ServerCallContext` | gRPC via `A2AExtensionsInterceptor`; HTTP not located | yes: `A2AExtensions.validateRequiredExtensions` throws `ExtensionSupportRequiredError` | gRPC client sends `a2a-extensions` metadata from call headers | yes |
| a2a-dotnet 1.0.0-preview2 (and main) | no handling of `A2A-Extensions` in `src` (grep, tag and main) | model classes only (`AgentExtension`, `AgentCapabilities.Extensions`) | no | no | no | n/a |
| a2a-rs (server 0.5.1) | no: the constant exists, nothing in `a2a-server/src` reads the header | no | no | no | no | code `EXTENSION_SUPPORT_REQUIRED` mapped to `FailedPrecondition` and REST 400 |

Evidence:

a2a-python 1.2.2

- [src/a2a/extensions/common.py#L4-L18](https://github.com/a2aproject/a2a-python/blob/v1.2.2/src/a2a/extensions/common.py#L4-L18): `HTTP_EXTENSION_HEADER = 'A2A-Extensions'`; `get_requested_extensions` splits each header value on commas and strips. [#L21-L26](https://github.com/a2aproject/a2a-python/blob/v1.2.2/src/a2a/extensions/common.py#L21-L26): `find_extension_by_uri` searches `card.capabilities.extensions`.
- [src/a2a/server/context.py#L24-L25](https://github.com/a2aproject/a2a-python/blob/v1.2.2/src/a2a/server/context.py#L24-L25): `tenant: str = Field(default='')` and `requested_extensions: set[str] = Field(default_factory=set)`.
- [src/a2a/server/routes/common.py#L116-L122](https://github.com/a2aproject/a2a-python/blob/v1.2.2/src/a2a/server/routes/common.py#L116-L122): `DefaultServerCallContextBuilder.build` fills `requested_extensions` from `request.headers.getlist(HTTP_EXTENSION_HEADER)` (Starlette, so JSON-RPC and REST).
- [src/a2a/server/request_handlers/grpc_handler.py#L53-L62](https://github.com/a2aproject/a2a-python/blob/v1.2.2/src/a2a/server/request_handlers/grpc_handler.py#L53-L62) and [#L69-L81](https://github.com/a2aproject/a2a-python/blob/v1.2.2/src/a2a/server/request_handlers/grpc_handler.py#L69-L81): gRPC reads the same key from invocation metadata, matched case-insensitively.
- [src/a2a/server/agent_execution/context.py#L163-L166](https://github.com/a2aproject/a2a-python/blob/v1.2.2/src/a2a/server/agent_execution/context.py#L163-L166): `RequestContext.requested_extensions` property.
- [src/a2a/client/service_parameters.py#L49-L64](https://github.com/a2aproject/a2a-python/blob/v1.2.2/src/a2a/client/service_parameters.py#L49-L64): `with_a2a_extensions` unions, sorts and joins with `,`.
- [src/a2a/utils/errors.py#L145](https://github.com/a2aproject/a2a-python/blob/v1.2.2/src/a2a/utils/errors.py#L145): `ExtensionSupportRequiredError: -32008`; [grpc_handler.py#L96](https://github.com/a2aproject/a2a-python/blob/v1.2.2/src/a2a/server/request_handlers/grpc_handler.py#L96): `FAILED_PRECONDITION`.
- No echo: `grep -rn activated src/a2a` returns nothing outside the 0.3 compat module; the only writers of `HTTP_EXTENSION_HEADER` are the client helper and the compat alias. The 0.3 compat module maps the old header: [src/a2a/compat/v0_3/extension_headers.py#L12](https://github.com/a2aproject/a2a-python/blob/v1.2.2/src/a2a/compat/v0_3/extension_headers.py#L12) `LEGACY_HTTP_EXTENSION_HEADER = f'X-{HTTP_EXTENSION_HEADER}'`.

a2a-js 1.3.0

- [src/constants.ts#L7](https://github.com/a2aproject/a2a-js/blob/v1.3.0/src/constants.ts#L7): `export const HTTP_EXTENSION_HEADER = 'A2A-Extensions';`
- [src/extensions.ts#L1-L44](https://github.com/a2aproject/a2a-js/blob/v1.3.0/src/extensions.ts#L1-L44): `Extensions.createFrom`, `parseServiceParameter` (split on `,`, trim, dedupe), `toServiceParameter` (join with `,`), both citing spec §3.2.6.
- [src/server/context.ts#L89-L149](https://github.com/a2aproject/a2a-js/blob/v1.3.0/src/server/context.ts#L89-L149): `ServerCallContext` holds `_requestedExtensions`, `_activatedExtensions`, `tenant`, `requestedVersion`; `activateExtension` appends a URI.
- Echo: [src/server/express/json_rpc_handler.ts#L100-L106](https://github.com/a2aproject/a2a-js/blob/v1.3.0/src/server/express/json_rpc_handler.ts#L100-L106) ("Legacy path responds with the v0.3 `X-A2A-Extensions` spelling; v1.0 path responds with `A2A-Extensions`."), [src/server/express/rest_handler.ts#L164-L165](https://github.com/a2aproject/a2a-js/blob/v1.3.0/src/server/express/rest_handler.ts#L164-L165), [src/server/grpc/grpc_service.ts#L271-L272](https://github.com/a2aproject/a2a-js/blob/v1.3.0/src/server/grpc/grpc_service.ts#L271-L272) (`metadata.set(HTTP_EXTENSION_HEADER, context.activatedExtensions.join(','))`), request side [#L240](https://github.com/a2aproject/a2a-js/blob/v1.3.0/src/server/grpc/grpc_service.ts#L240).

a2a-go 2.6.0

- [a2a/svcparams.go#L23](https://github.com/a2aproject/a2a-go/blob/v2.6.0/a2a/svcparams.go#L23): `const SvcParamExtensions = "A2A-Extensions"`.
- [a2asrv/extensions.go#L24-L70](https://github.com/a2aproject/a2a-go/blob/v2.6.0/a2asrv/extensions.go#L24-L70): `Extensions.Active`, `Activate`, `ActivatedURIs`, `Requested`, `RequestedURIs` (read from `ServiceParams().Get(a2a.SvcParamExtensions)`); comment at L44-L45: "A list of activated extensions might be attached as response metadata by a transport implementation."
- [a2agrpc/v1/handler.go#L314-L318](https://github.com/a2aproject/a2a-go/blob/v2.6.0/a2agrpc/v1/handler.go#L314-L318): gRPC response metadata `strings.ToLower(a2a.SvcParamExtensions)`; the 0.3 gRPC handler uses `"X-" + a2a.SvcParamExtensions` ([a2agrpc/v0/handler.go#L315-L319](https://github.com/a2aproject/a2a-go/blob/v2.6.0/a2agrpc/v0/handler.go#L315-L319)).
- [a2aext/propagator.go#L35-L60](https://github.com/a2aproject/a2a-go/blob/v2.6.0/a2aext/propagator.go#L35-L60): client and server propagators that forward `A2A-Extensions` header values and matching metadata keys to downstream agents.

a2a-java 1.4.0.Final

- [server-common/src/main/java/org/a2aproject/sdk/server/extensions/A2AExtensions.java#L13-L61](https://github.com/a2aproject/a2a-java/blob/v1.4.0.Final/server-common/src/main/java/org/a2aproject/sdk/server/extensions/A2AExtensions.java#L13-L61): `getRequestedExtensions` (comma split), `findExtensionByUri` (`card.capabilities().extensions()`), `validateRequiredExtensions` ("@throws ExtensionSupportRequiredError if a required extension is not requested").
- [transport/grpc/.../context/GrpcContextKeys.java#L57-L58](https://github.com/a2aproject/a2a-java/blob/v1.4.0.Final/transport/grpc/src/main/java/org/a2aproject/sdk/transport/grpc/context/GrpcContextKeys.java#L57-L58): `EXTENSIONS_HEADER_KEY` is the lowercased `A2A-Extensions`.
- [reference/grpc/.../A2AExtensionsInterceptor.java#L64](https://github.com/a2aproject/a2a-java/blob/v1.4.0.Final/reference/grpc/src/main/java/org/a2aproject/sdk/server/grpc/quarkus/A2AExtensionsInterceptor.java#L64); HTTP readers at [reference/jsonrpc/.../A2AServerRoutes.java#L650](https://github.com/a2aproject/a2a-java/blob/v1.4.0.Final/reference/jsonrpc/src/main/java/org/a2aproject/sdk/server/apps/quarkus/A2AServerRoutes.java#L650) and [reference/rest/.../A2AServerRoutes.java#L945](https://github.com/a2aproject/a2a-java/blob/v1.4.0.Final/reference/rest/src/main/java/org/a2aproject/sdk/server/rest/quarkus/A2AServerRoutes.java#L945).
- Client gRPC: [client/transport/grpc/.../GrpcTransport.java#L66](https://github.com/a2aproject/a2a-java/blob/v1.4.0.Final/client/transport/grpc/src/main/java/org/a2aproject/sdk/client/transport/grpc/GrpcTransport.java#L66) and [#L401](https://github.com/a2aproject/a2a-java/blob/v1.4.0.Final/client/transport/grpc/src/main/java/org/a2aproject/sdk/client/transport/grpc/GrpcTransport.java#L401).

a2a-dotnet 1.0.0-preview2

- [src/A2A/Models/AgentExtension.cs#L7](https://github.com/a2aproject/a2a-dotnet/blob/v1.0.0-preview2/src/A2A/Models/AgentExtension.cs#L7), [src/A2A/Models/AgentCapabilities.cs#L15](https://github.com/a2aproject/a2a-dotnet/blob/v1.0.0-preview2/src/A2A/Models/AgentCapabilities.cs#L15): data model only. `grep -rn 'A2A-Extensions' src --include='*.cs'` is empty at the tag and at main `6894043`.

a2a-rs

- [a2a/src/lib.rs#L27](https://github.com/a2aproject/a2a-rs/blob/a2a-server-lf-v0.5.1/a2a/src/lib.rs#L27): `pub const SVC_PARAM_EXTENSIONS: &str = "A2A-Extensions";` with no reader in `a2a-server/src` or `a2a-client/src` (grep for `SVC_PARAM_EXTENSIONS`, `requested_extensions`, `activated` finds only the constant). Error mapping: [a2a-grpc/src/errors.rs#L20](https://github.com/a2aproject/a2a-rs/blob/a2a-server-lf-v0.5.1/a2a-grpc/src/errors.rs#L20), [#L120-L121](https://github.com/a2aproject/a2a-rs/blob/a2a-server-lf-v0.5.1/a2a-grpc/src/errors.rs#L120-L121), [a2a-server/src/rest.rs#L517](https://github.com/a2aproject/a2a-rs/blob/a2a-server-lf-v0.5.1/a2a-server/src/rest.rs#L517).

Read-across for the writer: only the JS SDK fully implements the docs page's three-step negotiation (parse, activate, echo) on every binding; the governance rule "disabled by default, explicit opt-in" is met trivially because no SDK ships a bundled extension.

---

## B. The gRPC binding

### B.1 Rules from the pinned sources

#### B.1.1 The binding section

spec §10 opens: "The gRPC Protocol Binding provides a high-performance, strongly-typed interface using Protocol Buffers over HTTP/2. The gRPC Protocol Binding leverages the [API guidelines](https://google.aip.dev/general) to simplify gRPC to HTTP mapping."

spec §10.1 Protocol Requirements, all four bullets verbatim:

- "- **Protocol:** gRPC over HTTP/2 with TLS"
- "- **Definition:** Use the normative Protocol Buffers definition in `specification/a2a.proto`"
- "- **Serialization:** Protocol Buffers version 3"
- "- **Service:** Implement the `A2AService` gRPC service"

(§1.4 gives the proto path as `spec/a2a.proto`; §10.1 and the repository say `specification/a2a.proto`: register D15.)

spec §10.3 is only `{{ proto_service_to_table("A2AService") }}`; §10.4.1 to §10.4.11 hold `{{ proto_to_table(...) }}` macros plus one-line descriptions. The service itself is in the proto, `package lf.a2a.v1;`, `service A2AService` with comment "Provides operations for interacting with agents using the A2A protocol."

#### B.1.2 The service and its RPCs, mapped to the abstract operations

From proto `A2AService` (request and response types, streaming, HTTP annotation) joined with spec §3.1 (abstract operation) and §5.3 (method mapping table):

| gRPC RPC (proto) | Request | Response | Stream | `google.api.http` (proto) | Abstract operation (spec §3.1) | §10.4 note |
|---|---|---|---|---|---|---|
| `SendMessage` | `SendMessageRequest` | `SendMessageResponse` | unary | `post: "/message:send"`, `body: "*"` | §3.1.1 Send Message | "Sends a message to an agent." |
| `SendStreamingMessage` | `SendMessageRequest` | `stream StreamResponse` | server streaming | `post: "/message:stream"`, `body: "*"` | §3.1.2 Send Streaming Message | "Sends a message with streaming updates." |
| `GetTask` | `GetTaskRequest` | `Task` | unary | `get: "/tasks/{id=*}"`; `method_signature = "id"` | §3.1.3 Get Task | "Retrieves task status." |
| `ListTasks` | `ListTasksRequest` | `ListTasksResponse` | unary | `get: "/tasks"` | §3.1.4 List Tasks | "Lists tasks with filtering." |
| `CancelTask` | `CancelTaskRequest` | `Task` | unary | `post: "/tasks/{id=*}:cancel"`, `body: "*"` | §3.1.5 Cancel Task | "Cancels a running task." |
| `SubscribeToTask` | `SubscribeToTaskRequest` | `stream StreamResponse` | server streaming | `get: "/tasks/{id=*}:subscribe"` | §3.1.6 Subscribe to Task | "Subscribe to task updates via streaming. Returns `UnsupportedOperationError` if the task is in a terminal state." |
| `CreateTaskPushNotificationConfig` | `TaskPushNotificationConfig` | `TaskPushNotificationConfig` | unary | `post: "/tasks/{task_id=*}/pushNotificationConfigs"`, `body: "*"`; `method_signature = "task_id,config"` | §3.1.7 | "Creates a push notification configuration for a task." |
| `GetTaskPushNotificationConfig` | `GetTaskPushNotificationConfigRequest` | `TaskPushNotificationConfig` | unary | `get: "/tasks/{task_id=*}/pushNotificationConfigs/{id=*}"`; `method_signature = "task_id,id"` | §3.1.8 | "Retrieves an existing push notification configuration for a task." |
| `ListTaskPushNotificationConfigs` | `ListTaskPushNotificationConfigsRequest` | `ListTaskPushNotificationConfigsResponse` | unary | `get: "/tasks/{task_id=*}/pushNotificationConfigs"`; `method_signature = "task_id"` | §3.1.9 | "Lists all push notification configurations for a task." |
| `DeleteTaskPushNotificationConfig` | `DeleteTaskPushNotificationConfigRequest` | `google.protobuf.Empty` | unary | `delete: "/tasks/{task_id=*}/pushNotificationConfigs/{id=*}"`; `method_signature = "task_id,id"` | §3.1.10 | "Removes a push notification configuration for a task." ; "**Response:** `google.protobuf.Empty`" |
| `GetExtendedAgentCard` | `GetExtendedAgentCardRequest` | `AgentCard` | unary | `get: "/extendedAgentCard"` | §3.1.11 Get Extended Agent Card | "Retrieves the agent's extended capability card after authentication." |

Every RPC also carries an `additional_bindings` block with the same path under a `/{tenant}` prefix (listed in C.1.3). The proto comment on `SubscribeToTask`: "Subscribes to task updates for tasks not in a terminal state. Returns `UnsupportedOperationError` if the task is already in a terminal state (completed, failed, canceled, rejected)."

Prose that disagrees with the proto in this table:

- §10.4.7 says the request is `{{ proto_to_table("CreateTaskPushNotificationConfigRequest") }}`; the proto has no such message, the RPC takes `TaskPushNotificationConfig` (register D5). Main replaced that line with "**Request:** See [`TaskPushNotificationConfig`](#431-taskpushnotificationconfig) object definition."
- §10.4.7 and §10.4.8 say "**Response:** See [`PushNotificationConfig`](#431-pushnotificationconfig) object definition."; the proto type is `TaskPushNotificationConfig` (register D4). Main renamed §4.3.1 and these references.
- §5.3 and §11.3.2 give the REST subscribe route as `POST /tasks/{id}:subscribe`; the annotation is `get:` (register D1).

spec §10.5.1 on `TaskPushNotificationConfig`: "Resource wrapper for push notification configurations. This is a gRPC-specific type used in resource-oriented operations to provide the full resource name along with the configuration data." (The type is not gRPC-specific in the proto: it is the wire shape for all bindings; the prose is a 0.3 leftover. Not in the register; listed as N19 in `migration.md`.)

#### B.1.3 Which RPCs stream

Exactly two: `SendStreamingMessage` and `SubscribeToTask`, both `returns (stream StreamResponse)`. spec §10.7: "gRPC streaming uses server streaming RPCs for real-time updates. The `StreamResponse` message provides a union of possible streaming events:" followed by the `StreamResponse` table macro. proto `StreamResponse` is `oneof payload { Task task = 1; Message message = 2; TaskStatusUpdateEvent status_update = 3; TaskArtifactUpdateEvent artifact_update = 4; }` (comment: "A wrapper object used in streaming operations to encapsulate different types of response data."). §10.4.2 and §10.4.6: "**Response:** Server streaming [`StreamResponse`](#stream-response) objects." There is no client-streaming or bidirectional RPC.

#### B.1.4 Metadata keys for the version and for extensions

spec §10.2, verbatim:

- "A2A service parameters defined in [Section 3.2.6](#326-service-parameters) **MUST** be transmitted using gRPC metadata (headers)."
- "- Service parameter names **MUST** be transmitted as gRPC metadata keys"
- "- Metadata keys are case-insensitive and automatically converted to lowercase by gRPC"
- "- Multiple values for the same service parameter (e.g., `A2A-Extensions`) **SHOULD** be comma-separated in a single metadata entry"
- "- Implementations **MUST** extract A2A service parameters from gRPC metadata for processing"
- "- Servers **SHOULD** validate required service parameters (e.g., `A2A-Version`) from metadata"
- "- Service parameter keys in metadata are normalized to lowercase per gRPC conventions"

The §10.2 Go sample sends `"a2a-version", "0.3"` and `"a2a-extensions", "https://example.com/extensions/geolocation/v1,https://standards.org/extensions/citations/v1"` (the `0.3` value is the §3.2.6 example value; the manual sends `1.0`, register D39 covers §9.2, §11.2, §14.2.1 and should cover §10.2 too: N8 in `migration.md`). So the keys are `a2a-version` and `a2a-extensions`; the spec never writes a rule that metadata keys must be lowercase at send time, only that gRPC lowercases them.

The pinned sources say nothing about response metadata (echoing activated extensions) for gRPC.

#### B.1.5 The error model

spec §10.6, verbatim:

- "gRPC error responses use the standard [gRPC status](https://grpc.io/docs/guides/error/) structure with [google.rpc.Status](https://github.com/googleapis/googleapis/blob/master/google/rpc/status.proto), which maps to the generic A2A error model defined in [Section 3.3.2](#332-error-handling) as follows:"
- "- **Error Code**: Mapped to `status.code` (gRPC status code enum)"
- "- **Error Message**: Mapped to `status.message` (human-readable string)"
- "- **Error Details**: Mapped to `status.details` (repeated google.protobuf.Any messages)"
- "For A2A-specific errors, implementations **MUST** include a `google.rpc.ErrorInfo` message in the `status.details` array with:"
- "- `reason`: The A2A error type in UPPER_SNAKE_CASE without the "Error" suffix (e.g., `TASK_NOT_FOUND`)"
- "- `domain`: Set to `"a2a-protocol.org"`"
- "- `metadata`: Optional map of additional error context"

Two samples follow: a `BadRequest` detail with `field_violations` for `INVALID_ARGUMENT`, and an `ErrorInfo` with `reason: "TASK_NOT_FOUND"`, `domain: "a2a-protocol.org"`, metadata `task_id`, `timestamp` for `NOT_FOUND`.

spec §5.4 gRPC column (every A2A error):

| A2A error | gRPC status | `reason` (derived by the §10.6 rule) |
|---|---|---|
| `TaskNotFoundError` | `NOT_FOUND` | `TASK_NOT_FOUND` |
| `TaskNotCancelableError` | `FAILED_PRECONDITION` | `TASK_NOT_CANCELABLE` |
| `PushNotificationNotSupportedError` | `FAILED_PRECONDITION` | `PUSH_NOTIFICATION_NOT_SUPPORTED` |
| `UnsupportedOperationError` | `FAILED_PRECONDITION` | `UNSUPPORTED_OPERATION` |
| `ContentTypeNotSupportedError` | `INVALID_ARGUMENT` | `CONTENT_TYPE_NOT_SUPPORTED` |
| `InvalidAgentResponseError` | `INTERNAL` | `INVALID_AGENT_RESPONSE` |
| `ExtendedAgentCardNotConfiguredError` | `FAILED_PRECONDITION` | `EXTENDED_AGENT_CARD_NOT_CONFIGURED` |
| `ExtensionSupportRequiredError` | `FAILED_PRECONDITION` | `EXTENSION_SUPPORT_REQUIRED` |
| `VersionNotSupportedError` | `FAILED_PRECONDITION` | `VERSION_NOT_SUPPORTED` |

Generic categories, spec §3.3.2: authentication "gRPC `UNAUTHENTICATED`", authorization "gRPC `PERMISSION_DENIED`", validation "gRPC `INVALID_ARGUMENT`", resource "gRPC `NOT_FOUND`", system "gRPC `INTERNAL` or `UNAVAILABLE`". Only the `TASK_NOT_FOUND` reason string is written out in the spec; the rest are derived.

#### B.1.6 The `google.api.http` annotations and the HTTP+JSON routes

The proto imports `google/api/annotations.proto`, `google/api/client.proto`, `google/api/field_behavior.proto`. Each RPC's `option (google.api.http)` is the source of the §11.3 route list and the §5.3 REST column (B.1.2 table). spec §10 says the binding "leverages the [API guidelines](https://google.aip.dev/general) to simplify gRPC to HTTP mapping", and §11.5 derives the GET/DELETE query-parameter names from the proto fields ("HTTP methods that do not support request bodies (GET, DELETE) **MUST** transmit operation request parameters as path parameters or query parameters."). Points to note:

- The annotation path variables use proto field names (`{task_id=*}`); §11.3 writes them as `{id}` and `{configId}`; same route, different placeholder names.
- The annotations define the `/{tenant}/...` alternates that §11.3 and §5.3 never mention (C.1.3).
- `body: "*"` on the POST routes means the whole request message is the JSON body; §11.4 shows that shape.
- Three `method_signature` options exist for client-library generation; the one on `CreateTaskPushNotificationConfig` is `"task_id,config"`, and the proto comment above it says "method_signature preserved for backwards compatibility" (there is no `config` field in `TaskPushNotificationConfig`; the signature is a 0.3 leftover, informational only).

#### B.1.7 The `protocolBinding` value for gRPC

proto `AgentInterface.protocol_binding` (field 2, REQUIRED), comment: "The protocol binding supported at this URL. This is an open form string, to be easily extended for other protocol bindings. The core ones officially supported are `JSONRPC`, `GRPC` and `HTTP+JSON`." So the card value is `"GRPC"`. The spec prose never lists the three strings together; §5.8 says custom bindings "**SHOULD** be a URI".

The `url` for a gRPC interface: proto comment on `AgentInterface.url` at the tag: "The URL where this interface is available. Must be a valid absolute HTTPS URL in production. Example: "https://api.example.com/a2a/v1", "https://grpc.example.com/a2a"". gRPC dials host and port, so this is register D34 ("No rule at the tag"). Status: main changed the comment to "The URL or address where this interface is available. For HTTP-based transports, must be a valid absolute HTTPS URL in production. For gRPC, the address should be in the format "hostname:port". Example: "https://api.example.com/a2a/v1", "grpc.example.com:443"" ([proto on main](https://github.com/a2aproject/A2A/blob/679ab3afc6f95ef47bb969d511053d0f63bca2a2/specification/a2a.proto)). That is the only proto change between the tag and main (5 lines, comment only).

#### B.1.8 Everything else the spec says about gRPC

- §3.2.6: service parameters travel as "gRPC metadata for gRPC bindings".
- §5.1: all bindings MUST give "Identical Functionality", "Consistent Behavior", "Same Error Handling", "Equivalent Authentication".
- §5.5: JSON serializations use camelCase and ProtoJSON enum names; the gRPC binding itself carries protobuf binary, so none of §5.5 to §5.7 changes anything on the wire for gRPC except field presence semantics (`optional` fields in the proto: `history_length`, `page_size`, `include_artifacts`, `documentation_url`, `icon_url`, `streaming`, `push_notifications`, `extended_agent_card`).
- §7.1 to §7.5 (authentication) are binding-neutral; the pinned sources say nothing gRPC-specific about credentials beyond the `"authorization", "Bearer token"` metadata pair in the §10.2 sample.
- docs whats-new-v1: "- Elevate a2a.proto from being a gRPC-specific implementation file to the universal, normative source of truth" and "#### ✅ Google API Design Guidelines" "- **Usage:** gRPC binding design patterns".

### B.2 Upstream and SDK status

#### B.2.1 Which SDKs implement gRPC, and how to enable it

| SDK | Server | Client | Enable | Version metadata behavior on gRPC (from notes B7) |
|---|---|---|---|---|
| a2a-python 1.2.2 | `GrpcHandler` (`a2a.server.request_handlers.grpc_handler`) implementing `a2a_pb2_grpc.A2AServiceServicer` | `GrpcTransport` (`a2a.client.transports.grpc`) | `pip install a2a-sdk[grpc]` (extra: `grpcio`, `grpcio-tools`, `grpcio_reflection`); server: `a2a_pb2_grpc.add_A2AServiceServicer_to_server(GrpcHandler(request_handler), server)`; client: `ClientFactory` registers `TransportProtocol.GRPC` when the config lists it | client sends metadata `a2a-version: 1.0` plus lowercased service parameters on every call; the gRPC server has no `validate_version` decorator (only the REST and JSON-RPC dispatchers do), so a missing or wrong version is accepted on gRPC |
| a2a-js 1.3.0 | `grpcService(options)` (`@grpc/grpc-js`, Node only) | `GrpcTransport` via `GrpcTransportFactory` | not in `ClientFactoryOptions.default`; add `new GrpcTransportFactory()` | server: metadata `a2a-version`, missing = `0.3`, rejected unless the card lists it; `FAILED_PRECONDITION` |
| a2a-go 2.6.0 | `a2agrpc/v1.NewHandler(requestHandler)`, service `lf.a2a.v1.A2AService` | `a2agrpc/v1.WithGRPCTransport` | not registered by default (`defaultOptions` has JSON-RPC and REST only) | server never reads `A2A-Version` on any binding; client sends `1.0` |
| a2a-java 1.4.0.Final | `transport/grpc` + Quarkus `reference/grpc` | `client/transport/grpc` | Maven modules | missing = 0.3 and rejected; gRPC `UNIMPLEMENTED` (not `FAILED_PRECONDITION`); metadata key `a2a-version` |
| a2a-dotnet 1.0.0-preview2 | none at the tag (`ProtocolBindingNames.Grpc = "GRPC"` constant only) | none | main `6894043` adds `A2A.Grpc.AspNetCore` (`AddA2AGrpc`, `MapGrpcA2A`) and `A2A.Grpc` (`A2AGrpcClient`), unreleased (`1.0.0-preview3`) | main: only exactly `"1.0"` accepted, absent accepted, `0.3` rejected with `FAILED_PRECONDITION` and reason `VERSION_NOT_SUPPORTED` |
| a2a-rs (`a2a-grpc` 0.3.9) | `a2a_grpc::GrpcHandler` (tonic) | `GrpcTransport` in `a2a-grpc` | `A2AClientFactory` registers JSON-RPC and REST only; the caller registers gRPC | gRPC server ignores the version header |

Evidence:

- a2a-python: [pyproject.toml#L39](https://github.com/a2aproject/a2a-python/blob/v1.2.2/pyproject.toml#L39) `grpc = ["grpcio>=1.60", "grpcio-tools>=1.60", "grpcio_reflection>=1.7.0"]`; [grpc_handler.py#L9-L17](https://github.com/a2aproject/a2a-python/blob/v1.2.2/src/a2a/server/request_handlers/grpc_handler.py#L9-L17) import guard "'pip install a2a-sdk[grpc]'"; [#L104-L105](https://github.com/a2aproject/a2a-python/blob/v1.2.2/src/a2a/server/request_handlers/grpc_handler.py#L104-L105) `class GrpcHandler(a2a_grpc.A2AServiceServicer)`; [#L84-L98](https://github.com/a2aproject/a2a-python/blob/v1.2.2/src/a2a/server/request_handlers/grpc_handler.py#L84-L98) `_ERROR_CODE_MAP` (matches §5.4 for all nine A2A errors; adds `InvalidRequestError`/`InvalidParamsError` to `INVALID_ARGUMENT`, `MethodNotFoundError` to `NOT_FOUND`, `InternalError` to `INTERNAL`); registration in tests [tests/integration/test_end_to_end.py#L291](https://github.com/a2aproject/a2a-python/blob/v1.2.2/tests/integration/test_end_to_end.py#L291); client metadata [src/a2a/client/transports/grpc.py#L299-L308](https://github.com/a2aproject/a2a-python/blob/v1.2.2/src/a2a/client/transports/grpc.py#L299-L308); factory [src/a2a/client/client_factory.py#L172-L173](https://github.com/a2aproject/a2a-python/blob/v1.2.2/src/a2a/client/client_factory.py#L172-L173). Version check absent on gRPC: `grep -rn validate_version src/a2a/server` hits only `rest_dispatcher.py` and `jsonrpc_dispatcher.py`.
- a2a-js: [src/server/grpc/grpc_service.ts#L59](https://github.com/a2aproject/a2a-js/blob/v1.3.0/src/server/grpc/grpc_service.ts#L59); [src/client/factory.ts#L33-L35](https://github.com/a2aproject/a2a-js/blob/v1.3.0/src/client/factory.ts#L33-L35).
- a2a-go: [README.md#L61](https://github.com/a2aproject/a2a-go/blob/v2.6.0/README.md#L61) `grpcHandler := a2agrpc.NewHandler(requestHandler)`; [a2aclient/factory.go#L64](https://github.com/a2aproject/a2a-go/blob/v2.6.0/a2aclient/factory.go#L64); [a2apb/v1/a2av1_grpc.pb.go#L30](https://github.com/a2aproject/a2a-go/blob/v2.6.0/a2apb/v1/a2av1_grpc.pb.go#L30) `"/lf.a2a.v1.A2AService/SubscribeToTask"`.
- a2a-java: [README.md#L14](https://github.com/a2aproject/a2a-java/blob/v1.4.0.Final/README.md#L14); [spec-grpc/src/main/proto/a2a.proto#L3](https://github.com/a2aproject/a2a-java/blob/v1.4.0.Final/spec-grpc/src/main/proto/a2a.proto#L3) `package lf.a2a.v1;` (file marked "From tag v1.0.0").
- a2a-dotnet: [src/A2A/Client/ProtocolBindingNames.cs#L12-L13](https://github.com/a2aproject/a2a-dotnet/blob/v1.0.0-preview2/src/A2A/Client/ProtocolBindingNames.cs#L12-L13); main `src/A2A.Grpc/Protos/a2a.proto` (package `lf.a2a.v1`, annotations stripped) per `notes/dotnet.md`.
- a2a-rs: [README.md#L41-L43](https://github.com/a2aproject/a2a-rs/blob/a2a-server-lf-v0.5.1/README.md#L41-L43) binding table; [a2a-client/src/factory.rs#L201-L206](https://github.com/a2aproject/a2a-rs/blob/a2a-server-lf-v0.5.1/a2a-client/src/factory.rs#L201-L206); [a2a-pb/proto/a2a.proto#L3](https://github.com/a2aproject/a2a-rs/blob/a2a-server-lf-v0.5.1/a2a-pb/proto/a2a.proto#L3).

Proto package across versions (the pinned sources say nothing about 0.3): the 0.3 service is `package a2a.v1;` ([A2A v0.3.0 `specification/grpc/a2a.proto#L3`](https://github.com/a2aproject/A2A/blob/v0.3.0/specification/grpc/a2a.proto#L3)); 1.0 is `lf.a2a.v1`. Java and Python dispatch 0.3 vs 1.0 gRPC by package, not by metadata (`notes/java.md` SDK facts; a2a-python `src/a2a/compat/v0_3/README.md`: "It is generated into the `a2a.v1` package namespace."). Details in `migration.md` D.4.

#### B.2.2 The experimental SLIMRPC binding

- Repo: [a2aproject/experimental-cpb-slimrpc](https://github.com/a2aproject/experimental-cpb-slimrpc/tree/1328426d3226326f86dd21f1d9853083e91bc4bc), HEAD `1328426` 2026-09-29. History: initialized 2026-05-14, spec added 2026-05-20 (#1), multicast spec 2026-05-27 (#2), versioned `spec/v1/` folder 2026-06-11 (#4), collaborative-task extension and broadcast-live profile 2026-09-29 (#5). So it predates the tag but was never part of the A2A repo.
- Status: README "**Status: Experimental** — This is a community-contributed custom protocol binding for A2A. It is not part of the core A2A specification." Governance tier: experimental (`experimental-cpb-` prefix). Not an `a2aproject` SDK deliverable; A2A SDKs "SHOULD implement official custom protocol bindings" only once official.
- What it is: Protobuf RPC over SLIM (Secure Low-Latency Interactive Messaging, `agntcy/slim`), "Like gRPC is Protobuf RPC over HTTP/2, SLIMRPC is Protobuf RPC over SLIM"; adds name-based addressing, MLS end-to-end encryption, multicast groups.
- Binding identifier (card `protocolBinding`): `https://a2a-protocol.org/bindings/experimental-slimrpc/v1` ([spec/v1/slimrpc.md L17](https://github.com/a2aproject/experimental-cpb-slimrpc/blob/1328426d3226326f86dd21f1d9853083e91bc4bc/spec/v1/slimrpc.md)). `url` holds a SLIM name (`domain/namespace/service`), not a URL (L37). Errors reuse `google.rpc.Code` values (L208-L233); streams close at terminal and interrupted states (L254-L255).
- Reference implementations (README table): `agntcy/slim-a2a-go` and `agntcy/slim-a2a-python` (both "v0.3.0, v1.0.0"), and `a2aproject/a2a-rs` crate `a2a-slimrpc` ([a2a-slimrpc/README.md](https://github.com/a2aproject/a2a-rs/blob/a2a-slimrpc-v0.2.11/a2a-slimrpc/README.md)): "`Transport` implementation for A2A over SLIMRPC", accepts `org/namespace/app`, `slim://...`, `slimrpc://...` targets. That README says the factory matches cards that "advertise `SLIMRPC`", a bare token rather than the URI the binding spec mandates; not verified in code.

---

## C. The `tenant` field and multi-tenancy

### C.1 Rules from the pinned sources

#### C.1.1 Every `tenant` field in the proto

Ten request messages carry the same comment, verbatim: "Optional. Opaque routing identifier. Must match the `tenant` value from the selected `AgentInterface` in the Agent Card when that field is set."

| Message | Field | Number | Note |
|---|---|---|---|
| `SendMessageRequest` | `string tenant` | 1 | |
| `GetTaskRequest` | `string tenant` | 1 | |
| `ListTasksRequest` | `string tenant` | 1 | |
| `CancelTaskRequest` | `string tenant` | 1 | |
| `SubscribeToTaskRequest` | `string tenant` | 1 | |
| `TaskPushNotificationConfig` | `string tenant` | 1 | the create request and the stored config share this type, so the stored config carries `tenant` too |
| `GetTaskPushNotificationConfigRequest` | `string tenant` | 1 | |
| `ListTaskPushNotificationConfigsRequest` | `string tenant` | 4 | the only one not numbered 1 (`task_id = 1`, `page_size = 2`, `page_token = 3`); irrelevant to JSON, visible on the gRPC wire |
| `DeleteTaskPushNotificationConfigRequest` | `string tenant` | 1 | |
| `GetExtendedAgentCardRequest` | `string tenant` | 1 | the only field of that message |

Plus the declaration side, proto `AgentInterface`, `string tenant = 3;` with comment: "Optional. An opaque string used for routing requests to a specific agent or tenant when multiple agents are served behind a single A2A endpoint. When set, clients MUST include this value in the `tenant` field of all request messages sent to this interface. The server is responsible for interpreting the value and routing requests accordingly; the protocol does not define its format or semantics."

No `tenant` on `Task`, `Message`, `Artifact`, the events, `AgentCard`, or the responses. None of the `tenant` fields is annotated REQUIRED.

#### C.1.2 The spec text about tenants

The word appears twice in `specification.md`:

- §8.3.2 Client Protocol Selection, rule 4 (after "Clients **MUST** follow these rules:"): "4. Set the `tenant` field in every request message to exactly the value declared in the selected `AgentInterface` entry (omit the field if `tenant` is not set in that entry)"
- §13.1 Data Access and Authorization Scoping, under "Authorization models are agent-defined and **MAY** be based on:": "    - Organizational or tenant boundaries (multi-tenant authorization)"

That is all. The spec has no section on multi-tenancy, no definition of the value's format (the proto says "the protocol does not define its format or semantics"), no server-side MUST for validating a mismatched `tenant`, no error for it, and no statement about `tenant` in JSON-RPC (where it is simply a member of `params`) or gRPC (a message field). The pinned sources say nothing about what a server does when a client sends a `tenant` the card did not declare.

docs whats-new-v1, "### NEW: Multi-Tenancy Support":

- v0.3.0: "- No native multi-tenancy support in protocol" ; "- Tenants handled implicitly via authentication or URL paths"
- v1.0: "- **✅ NEW:** `tenant` field added to all request messages" ; "- **✅ NEW:** `tenant` field added to `AgentInterface` to specify default tenant" ; "- **✅ CLARIFIED:** Tenant provided per-request, inherited from AgentInterface" ; "- **✅ USE CASE:** Enables to serve multiple agents from a single endpoint"
- Themes list: "- **Multi-tenancy support** - Native tenant scoping in gRPC requests" (understates: see N3)

docs announcing-1.0: "- **Multi-tenancy support** allows a single endpoint to securely host many agents."

#### C.1.3 The `/{tenant}/...` routes in HTTP+JSON

Only the proto defines them, as `additional_bindings` on every RPC:

| RPC | Primary route | Tenant route |
|---|---|---|
| `SendMessage` | `post: "/message:send"` | `post: "/{tenant}/message:send"` |
| `SendStreamingMessage` | `post: "/message:stream"` | `post: "/{tenant}/message:stream"` |
| `GetTask` | `get: "/tasks/{id=*}"` | `get: "/{tenant}/tasks/{id=*}"` |
| `ListTasks` | `get: "/tasks"` | `get: "/{tenant}/tasks"` |
| `CancelTask` | `post: "/tasks/{id=*}:cancel"` | `post: "/{tenant}/tasks/{id=*}:cancel"` |
| `SubscribeToTask` | `get: "/tasks/{id=*}:subscribe"` | `get: "/{tenant}/tasks/{id=*}:subscribe"` |
| `CreateTaskPushNotificationConfig` | `post: "/tasks/{task_id=*}/pushNotificationConfigs"` | `post: "/{tenant}/tasks/{task_id=*}/pushNotificationConfigs"` |
| `GetTaskPushNotificationConfig` | `get: "/tasks/{task_id=*}/pushNotificationConfigs/{id=*}"` | `get: "/{tenant}/tasks/{task_id=*}/pushNotificationConfigs/{id=*}"` |
| `ListTaskPushNotificationConfigs` | `get: "/tasks/{task_id=*}/pushNotificationConfigs"` | `get: "/{tenant}/tasks/{task_id=*}/pushNotificationConfigs"` |
| `GetExtendedAgentCard` | `get: "/extendedAgentCard"` | `get: "/{tenant}/extendedAgentCard"` |
| `DeleteTaskPushNotificationConfig` | `delete: "/tasks/{task_id=*}/pushNotificationConfigs/{id=*}"` | `delete: "/{tenant}/tasks/{task_id=*}/pushNotificationConfigs/{id=*}"` |

In the HTTP+JSON binding the path segment is the `tenant` field (transcoding binds `{tenant}` to the message field), so a client puts the value in the URL, not in the JSON body. The prose never says so: spec §5.3, §11.3 and §11.5 list only the un-prefixed routes (N12). In JSON-RPC the value is `params.tenant`; in gRPC it is the message field. The pinned sources say nothing about whether a REST server must also accept `tenant` in a POST body, or what happens when the path tenant and a body tenant differ.

#### C.1.4 How a client learns which tenant to use

From the card: `AgentInterface.tenant` on the selected `supportedInterfaces` entry (proto comment in C.1.1), applied by §8.3.2 rule 4. The tag page multi-tenancy says the same and is the only prose on it (C.2).

### C.2 `multi-tenancy.md` at the tag and at main

- Path `docs/topics/multi-tenancy.md`, added 2026-05-26 by #1848 "docs: add multi-tenancy guide and clarify tenant field semantics" (two days before the tag), in the mkdocs nav at `v1.0.1` under "Multi-Tenancy". Tag copy: [v1.0.1/docs/topics/multi-tenancy.md](https://github.com/a2aproject/A2A/blob/v1.0.1/docs/topics/multi-tenancy.md). Main (`679ab3a`) is byte-identical to the tag (`diff` empty).
- Opening: "A single A2A endpoint can serve multiple agents or tenants. The A2A protocol does not prescribe a specific routing implementation — operators are free to choose the approach that best fits their infrastructure."
- Three approaches ("Three complementary approaches are available:"): "### 1. URL-Based Routing (Sub-Path)" (each agent has its own `url` in `supportedInterfaces`), "### 2. Authentication Header-Based Routing" (the gateway routes on the credential), "### 3. Body-Based Routing Using the `tenant` Field".
- On the field: "Every A2A request message contains an optional `tenant` field. This is an **opaque string** whose value is defined entirely by the server operator; the protocol does not impose any format or semantics on it. A gateway or agent implementation can inspect this field and forward the request to the appropriate backend."
- "The `tenant` value that a client should use for a particular agent is advertised in the `AgentInterface` entry inside `supportedInterfaces`:" with a sample `"tenant": "billing"`.
- "**Client requirement**: The client **MUST** always echo the `tenant` value from the selected `AgentInterface` entry back in every request message. If the `AgentInterface` does not set `tenant`, the field **MUST** be omitted from the request." followed by a pointer to "Section 8.3.2 ... of the specification for the normative rule."
- "A server MAY use the `tenant` field to represent any routing key that suits its deployment — agent identifiers, workspace slugs, organization IDs, or any other opaque discriminator."
- Combining: "The three approaches are not mutually exclusive."
- Discovery: "When multiple agents are deployed behind a shared domain, each agent **SHOULD** have its own Agent Card published at an appropriate location".
- Stale name on the page: approach 2 says credentials are declared "in the Agent Card's `securitySchemes` and `security` fields"; the 1.0 field is `securityRequirements` (same family as register D6).
- The page does not mention the `/{tenant}/` REST routes either; it calls approach 3 "Body-Based".

Recommendation: add `multi-tenancy.md` (tag copy, identical on main) to `docs.md`; it is the only prose that explains the field. Also add `custom-protocol-bindings.md` (tag copy; main adds a 9-line "URI Namespaces" note on 2026-07-09) and `extension-and-binding-governance.md` (tag copy; main adds the "URI namespaces" section and swaps one RFC link). All three are in the nav at the tag and are cross-referenced by pages already in `docs.md`.

### C.3 How a2a-python 1.2.2 handles `tenant`

Server:

- `ServerCallContext.tenant` defaults to `''` ([src/a2a/server/context.py#L24](https://github.com/a2aproject/a2a-python/blob/v1.2.2/src/a2a/server/context.py#L24)); the agent reads it as `RequestContext.tenant` ([src/a2a/server/agent_execution/context.py#L158-L161](https://github.com/a2aproject/a2a-python/blob/v1.2.2/src/a2a/server/agent_execution/context.py#L158-L161)).
- REST: `create_rest_routes` mounts every base route a second time under `/{tenant}`: [src/a2a/server/routes/rest_routes.py#L123](https://github.com/a2aproject/a2a-python/blob/v1.2.2/src/a2a/server/routes/rest_routes.py#L123) `routes.append(Mount(path='/{tenant}', routes=base_route_objects))`; the dispatcher copies the path parameter into the context: [src/a2a/server/routes/rest_dispatcher.py#L107-L111](https://github.com/a2aproject/a2a-python/blob/v1.2.2/src/a2a/server/routes/rest_dispatcher.py#L107-L111).
- JSON-RPC: `call_context.tenant = getattr(specific_request, 'tenant', '')` from the parsed `params` ([src/a2a/server/routes/jsonrpc_dispatcher.py#L311](https://github.com/a2aproject/a2a-python/blob/v1.2.2/src/a2a/server/routes/jsonrpc_dispatcher.py#L311)).
- gRPC: `server_context.tenant = getattr(request, 'tenant', '')` ([src/a2a/server/request_handlers/grpc_handler.py#L421-L428](https://github.com/a2aproject/a2a-python/blob/v1.2.2/src/a2a/server/request_handlers/grpc_handler.py#L421-L428)).
- The 0.3 compat adapter also fills it ([src/a2a/compat/v0_3/jsonrpc_adapter.py#L128-L131](https://github.com/a2aproject/a2a-python/blob/v1.2.2/src/a2a/compat/v0_3/jsonrpc_adapter.py#L128-L131)).
- No validation: nothing compares the incoming value with the card's `AgentInterface.tenant` (grep for `tenant` in `src/a2a/server` shows only the three assignments above). The server does not route by tenant; it hands the string to the agent.

Client:

- `ClientFactory.create` wraps the transport in `TenantTransportDecorator` when the selected interface declares a tenant ([src/a2a/client/client_factory.py#L354-L357](https://github.com/a2aproject/a2a-python/blob/v1.2.2/src/a2a/client/client_factory.py#L354-L357)); the decorator sets `request.tenant = tenant or self._tenant` on every request type ([src/a2a/client/transports/tenant_decorator.py#L25-L48](https://github.com/a2aproject/a2a-python/blob/v1.2.2/src/a2a/client/transports/tenant_decorator.py#L25-L48)), which satisfies §8.3.2 rule 4 for JSON-RPC and gRPC (the value rides in the message).
- REST transport: builds the path as `f'/{tenant}{base_path}' if tenant else base_path` ([src/a2a/client/transports/rest.py#L336-L338](https://github.com/a2aproject/a2a-python/blob/v1.2.2/src/a2a/client/transports/rest.py#L336-L338)) and removes `tenant` from the query parameters on GET/DELETE calls (for example [#L153-L154](https://github.com/a2aproject/a2a-python/blob/v1.2.2/src/a2a/client/transports/rest.py#L153-L154)); the extended card call is `'GET', '/extendedAgentCard', request.tenant` ([#L327](https://github.com/a2aproject/a2a-python/blob/v1.2.2/src/a2a/client/transports/rest.py#L327)).
- The card printer shows `tenant=<value>` next to each interface ([src/a2a/helpers/agent_card.py#L33-L42](https://github.com/a2aproject/a2a-python/blob/v1.2.2/src/a2a/helpers/agent_card.py#L33-L42)).

Other SDKs, from the notes: a2a-go has `a2asrv.NewTenantRESTHandler` next to `NewRESTHandler` (`notes/go.md` SDK facts, bindings bullet); a2a-js `ServerCallContext.tenant` with `setTenant` set by the transport ([src/server/context.ts#L105-L121](https://github.com/a2aproject/a2a-js/blob/v1.3.0/src/server/context.ts#L105-L121)). Tenant handling in Java, .NET and Rust was not examined.
