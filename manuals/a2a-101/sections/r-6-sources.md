# Sources

> The manual rests on one pinned release, one reference SDK, five more SDKs, one test kit, and one capture kit, and it names every place where those sources disagree.

[How to read this manual](#s-front) ranks the sources and describes the kit. This page pins their versions, lists the conflicts between them, and records what the project changed after the tag.

## The pin

| Item | Value |
|---|---|
| Release | A2A 1.0.1, tag `v1.0.1` of [github.com/a2aproject/A2A](https://github.com/a2aproject/A2A), commit `3303592588e388e62e0f69f701af531d2f4e3991`, tagged 2026-05-28 |
| Protocol version | `1.0` in every request and card. Facts verified 2026-10-06. |
| Main branch | Commit `679ab3a` of 2026-10-05, read for changes after the tag, and quoted only for rules the tag lacks |
| Reference SDK | `a2a-sdk` 1.2.2, tag `v1.2.2` of [github.com/a2aproject/a2a-python](https://github.com/a2aproject/a2a-python), commit `2f9e44af243df5c7c7a3da361c8d095324bcd5e3`, Apache License 2.0 |
| Capture kit | `manuals/a2a-101/capture/`, standard library only, described in [the kit README](manuals/a2a-101/capture/README.md) |

The changelog dates the release 2026-05-26, and the spec banner still names 1.0.0 as the latest release ([conflict D16](#s-ref-sources-the-conflict-register)). The manual cites the reference SDK as `sdk` and a path under `src/a2a/`, and never quotes it.

## Vendored files

The files in `research/sources/` are copied from the tag under the Apache License 2.0 in [LICENSE](manuals/a2a-101/research/sources/LICENSE). The audit checks every quote of 24 characters or more against them.

| File | Upstream | Cited as |
|---|---|---|
| a2a.proto | `specification/a2a.proto`, 811 lines, normative | `proto` and a message or enum name |
| specification.md | `docs/specification.md`, 3610 lines | `spec` and a section number |
| specification-main.md | `docs/specification.md` on main at `679ab3a`, 3618 lines, unreleased | `spec-main` and a section number, only for rules added after the tag |
| docs.md | Fourteen project pages in 3019 lines, not normative. This edition adds `multi-tenancy`, `custom-protocol-bindings`, and `extension-and-binding-governance`. | `docs` and a page name |

Section 1.4 of the spec gives the proto path as `spec/a2a.proto`, which is wrong ([conflict D15](#s-ref-sources-the-conflict-register)). Two briefs index these files by line: `research/brief-spec.md`, with 40 findings and the register below, and `research/brief-docs.md`, which flags stale pages.

## The SDKs and the test kit

Body sections compare six official SDKs and the official test kit, each read at one tag. The manual cites the reference SDK as `sdk`, and the others as `sdk-go`, `sdk-java`, `sdk-js`, `sdk-dotnet`, and `sdk-rust`, with a file path and the tag. It paraphrases them and never quotes them.

| Repository | Cited as | Tag | Commit | Date |
|---|---|---|---|---|
| [a2a-python](https://github.com/a2aproject/a2a-python) | `sdk` | `v1.2.2` | `2f9e44a` | 2026-10-05 |
| [a2a-go](https://github.com/a2aproject/a2a-go) | `sdk-go` | `v2.6.0` | `ebf17c5` | 2026-09-25 |
| [a2a-java](https://github.com/a2aproject/a2a-java) | `sdk-java` | `v1.4.0.Final` | `6408194` | 2026-09-28 |
| [a2a-js](https://github.com/a2aproject/a2a-js) | `sdk-js` | `v1.3.0` | `29417a5` | 2026-09-29 |
| [a2a-dotnet](https://github.com/a2aproject/a2a-dotnet) | `sdk-dotnet` | `v1.0.0-preview2` | `87fd448` | 2026-04-09 |
| [a2a-rs](https://github.com/a2aproject/a2a-rs) | `sdk-rust` | `a2a-server-lf-v0.5.1` | `32c31f6` | 2026-09-30 |
| [a2a-tck](https://github.com/a2aproject/a2a-tck) | `a2a-tck` and a file path | `1.0.0.alpha2` | `29063fe` | 2026-05-27 |

## The conflict register

This table condenses section 12.2 of `research/brief-spec.md`, and D36 to D40 were found while writing the manual. The last column says what the A2A repository did about each one after the tag, checked on 2026-10-06. Fixed on main means merged and unreleased. Partly fixed means that a residual remains on main.

| ID | The sources say | The manual follows | Discussed in | Upstream |
|---|---|---|---|---|
| D1 | **Subscribe verb.** Proto `GET`. §5.3 and §11.3.2 `POST`. | The proto. Accept both. | [front](#s-front), [4.5](#s-streaming-and-subscribe-to-task), [5.2](#s-http-json), [R.1](#s-ref-operations-by-binding) | open [PR #2068](https://github.com/a2aproject/A2A/pull/2068) |
| D2 | **Blocking.** §3.1.1 returns at once. §3.2.2 and the proto wait. | §3.2.2 and the proto | [front](#s-front), [4.1](#s-send-message), [7.1](#s-a-client) | open [issue #2135](https://github.com/a2aproject/A2A/issues/2135) |
| D3 | **Streams at interrupted states.** §3.1.2 and §3.1.6 close at terminal states. §11.7 and the streaming guide also close at interrupted ones. §7.6.1 keeps auth streams open. | Close at terminal states, and expect either at interrupted ones | [front](#s-front), [1.2](#s-one-task-request-by-request), [4.2](#s-input-required-and-auth-required), [4.5](#s-streaming-and-subscribe-to-task), [R.3](#s-ref-task-states) | open [PR #2270](https://github.com/a2aproject/A2A/pull/2270) |
| D4 | **Push configuration name.** Prose `PushNotificationConfig`. Proto `TaskPushNotificationConfig`. | The proto name | [4.6](#s-push-notification-configs), [R.2](#s-ref-objects-and-fields) | partly fixed on main ([PR #1981](https://github.com/a2aproject/A2A/pull/1981)) |
| D5 | **Create request.** Prose and Appendix A `CreateTaskPushNotificationConfigRequest`. Proto `TaskPushNotificationConfig`. | The proto | [4.6](#s-push-notification-configs), [R.1](#s-ref-operations-by-binding) | partly fixed on main ([PR #1981](https://github.com/a2aproject/A2A/pull/1981)) |
| D6 | **Card security field.** §3.1.11, §13.3, and the §8.5 sample `security`. Proto `securityRequirements`. | The proto | [front](#s-front), [2.1](#s-agentcard-fields), [2.3](#s-extended-cards-and-signatures), [6.1](#s-security-schemes-and-in-task-authorization), [R.2](#s-ref-objects-and-fields) | partly fixed on main ([PR #2046](https://github.com/a2aproject/A2A/pull/2046)) |
| D7 | **Extended card flag number.** Appendix A.2.2 field 5. Proto field 4. | The proto | [2.3](#s-extended-cards-and-signatures) | no activity |
| D8 | **Protocol version.** Appendix A.2.1 `protocolVersions` on the card. Proto `protocolVersion` per interface. | One per interface | [2.1](#s-agentcard-fields) | fixed on main, unreleased ([PR #2165](https://github.com/a2aproject/A2A/pull/2165)) |
| D9 | **Stream event names.** Migration guide `taskStatusUpdate`, `taskArtifactUpdate`. Proto `statusUpdate`, `artifactUpdate`. | The proto | [4.5](#s-streaming-and-subscribe-to-task), [7.4](#s-from-0-3-to-1-0) | fixed on main, unreleased ([PR #2056](https://github.com/a2aproject/A2A/pull/2056)) |
| D10 | **Fields the proto lacks.** Migration guide `Task.createdAt`, `Task.lastModified`, `configId`, `TaskArtifactUpdateEvent.index`. | Do not send them | [R.2](#s-ref-objects-and-fields), [7.4](#s-from-0-3-to-1-0) | partly fixed on main ([PR #2056](https://github.com/a2aproject/A2A/pull/2056)) |
| D11 | **Deprecated OAuth flows.** Migration guide: implicit and password removed. Proto: kept, deprecated. | Present, never used | [6.1](#s-security-schemes-and-in-task-authorization) | no activity |
| D12 | **Pagination names.** Migration guide `cursor`, `limit`, `nextCursor`. Proto `pageToken`, `pageSize`, `nextPageToken`. | The proto | [4.3](#s-get-task-and-list-tasks) | fixed on main, unreleased ([PR #2165](https://github.com/a2aproject/A2A/pull/2165)) |
| D13 | **Error body.** §6.4 and §6.5 samples `application/problem+json`. Migration guide `application/json`. §11.6 `google.rpc.Status`. | §11.6 | [5.5](#s-errors) | open [PR #1641](https://github.com/a2aproject/A2A/pull/1641) and [PR #1689](https://github.com/a2aproject/A2A/pull/1689) |
| D14 | **JSON-RPC method template.** §9.3 `category/action`. §9.1 and §9.4 PascalCase. | PascalCase | [5.1](#s-json-rpc) | no activity |
| D15 | **Proto path.** §1.4 `spec/a2a.proto`. §5.7, §10.1, and the repository `specification/a2a.proto`. | The repository | [1.1](#s-what-a2a-standardizes), [Vendored files](#s-ref-sources-vendored-files) | no activity |
| D16 | **Release and date.** Banner: 1.0.0 is latest. Changelog 2026-05-26. Tag message 2026-04-23. Tag commit 2026-05-28. | 1.0.1, tagged 2026-05-28 | [The pin](#s-ref-sources-the-pin) | open [PR #2072](https://github.com/a2aproject/A2A/pull/2072) |
| D17 | **Header registrations.** §14.2.1 and §14.2.2 cite Section 3.2.5. Service parameters are §3.2.6. | §3.2.6 | [5.4](#s-version-and-extension-headers) | open [issue #2305](https://github.com/a2aproject/A2A/issues/2305) |
| D18 | **TLS version.** Spec 1.3 or later. Enterprise guide 1.2 or later. | The spec | [6.1](#s-security-schemes-and-in-task-authorization) | no activity |
| D19 | **Empty required arrays.** §5.7 wants one element at least. The §8.4.1 example has empty `skills`, and empty `tasks` is legitimate. | Empty `tasks` for no results, a skill on every real card | [2.1](#s-agentcard-fields), [R.2](#s-ref-objects-and-fields) | open [issue #2122](https://github.com/a2aproject/A2A/issues/2122) |
| D20 | **The typ header.** §8.4.2 lists `typ` among the MUST fields and words it as SHOULD. | Send `alg`, `kid`, and `typ` set to `JOSE` | [2.3](#s-extended-cards-and-signatures) | no activity |
| D21 | **Signing steps.** §8.4.2 and §8.4.3 remove default values. §8.4.1 keeps REQUIRED and set optional fields. | §8.4.1 | [2.3](#s-extended-cards-and-signatures) | open [issue #2249](https://github.com/a2aproject/A2A/issues/2249) |
| D22 | **JSON naming example.** §5.5 `push_notification_config`. Proto `task_push_notification_config`. | The proto | [R.2](#s-ref-objects-and-fields) | no activity |
| D23 | **Samples that break REQUIRED.** Some omit `messageId`, `artifactId`, or an event's `contextId`. | Never copy a sample as it is | [3.1](#s-message), [6.2](#s-extensions) | partly fixed on main ([PR #2083](https://github.com/a2aproject/A2A/pull/2083)) |
| D24 | **Invalid JSON.** The samples in §4.6.1, §6.7, and §9.4.1. | Never copy a sample as it is | [3.2](#s-part), [6.2](#s-extensions) | open [PR #1657](https://github.com/a2aproject/A2A/pull/1657) |
| D25 | **Layer 2 diagram.** §1.3 shows Get Agent Card. §3.1 defines only Get Extended Agent Card. | The diagram is informal | [1.1](#s-what-a2a-standardizes) | no activity |
| D26 | **Mandatory operations.** §3.1 requires them all. §3.3.4 lets flags decline streaming, push, and the extended card. | The capability flags | [2.2](#s-discovery-and-supported-interfaces) | no activity |
| D27 | **Transport in a guide.** Core Concepts: JSON-RPC 2.0 for everything. Spec: three bindings. | The spec | [5.1](#s-json-rpc) | no activity |
| D28 | **Who creates the context id.** Core Concepts: the server. Spec: a client can propose one. | The spec | [3.5](#s-context-id) | open [issue #1317](https://github.com/a2aproject/A2A/issues/1317) |
| D29 | **States from extensions.** The extensions guide lists extensions that add states, and forbids new enum values. | Neither is normative. Add no states. | [3.4](#s-task-and-task-state), [6.2](#s-extensions) | no activity |
| D30 | **Extension activation.** §4.6.1 JSON-RPC parameters. §9.2 HTTP headers. | The header | [5.4](#s-version-and-extension-headers) | no activity |
| D31 | **Version as a parameter.** §3.6.1 allows a request parameter. §9.2 and §11.2 require headers. | The header | [5.4](#s-version-and-extension-headers) | open [issue #2184](https://github.com/a2aproject/A2A/issues/2184) |
| D32 | **Old endpoint names.** The what-is-a2a diagram: `POST /sendMessage`, `/.well-known/agent-card`. | `message:send`, `agent-card.json` | [2.2](#s-discovery-and-supported-interfaces) | fixed on main, unreleased ([PR #2261](https://github.com/a2aproject/A2A/pull/2261)) |
| D33 | **Stream type in a guide.** Streaming guide `SendStreamingMessageResponse`. Spec `StreamResponse`. | The spec | [4.5](#s-streaming-and-subscribe-to-task) | no activity |
| D34 | **gRPC interface URL.** Proto: an absolute HTTPS URL. gRPC dials a host and a port. | No rule at the tag | [2.1](#s-agentcard-fields), [5.3](#s-grpc) | fixed on main, unreleased ([PR #1997](https://github.com/a2aproject/A2A/pull/1997)) |
| D35 | **Role spelling.** §2.2 user and agent. Proto and §5.5 `ROLE_USER`, `ROLE_AGENT`. | The enum names | [3.1](#s-message) | no activity |
| D36 | **Another client's task.** §3.3.2 calls it an authorization error and forbids revealing that it exists. | `TaskNotFoundError` | [6.1](#s-security-schemes-and-in-task-authorization) | no activity |
| D37 | **A 0.3 state name.** §3.4.3 `input-required`. Proto `TASK_STATE_INPUT_REQUIRED`. | The proto name | [3.4](#s-task-and-task-state) | open [PR #2155](https://github.com/a2aproject/A2A/pull/2155) |
| D38 | **Cancel transitions.** Migration guide: clarified in 1.0. Spec: no transition table. | Transitions are implementation behavior | [3.4](#s-task-and-task-state) | open [issue #1992](https://github.com/a2aproject/A2A/issues/1992) |
| D39 | **Version in samples.** §9.2, §11.2, and §14.2.1 send `A2A-Version: 0.3`. | Send `1.0` | [5.4](#s-version-and-extension-headers) | no activity |
| D40 | **Old extended card flag.** Appendix A.2.2 `supportsExtendedAgentCard`. Migration guide and SDK `supportsAuthenticatedExtendedCard`. | `extendedAgentCard` in `capabilities` | [2.3](#s-extended-cards-and-signatures), [7.4](#s-from-0-3-to-1-0) | no activity |

## Discrepancies found after the register

Research for this edition found twenty more places where a docs page, an appendix, or a sample disagrees with the proto or the spec. None changes what the manual follows. The last column says whether main still has the text, as checked on 2026-10-06.

| ID | The sources say | The manual follows | Discussed in | On main |
|---|---|---|---|---|
| N1 | **Stream event kind in the guide.** Migration guide, for 0.3: `kind` values `taskStatusUpdate` and `taskArtifactUpdate`. Appendix A.2.1 and the 0.3 schema: `status-update` and `artifact-update`. | Appendix A.2.1 | R.6 only | fixed |
| N2 | **Extensions path.** Migration guide `agentCard.extensions`. Proto `capabilities.extensions`. | The proto | [6.2](#s-extensions), [R.2](#s-ref-objects-and-fields) | unchanged |
| N3 | **Tenant scope.** Migration guide: tenant scoping in gRPC requests. Proto: `tenant` on every request message, and a `/{tenant}` route for every rpc. | The proto | [5.2](#s-http-json) | unchanged |
| N4 | **ListTasks in 0.3.** Migration guide: not available in 0.3. The 0.3 prose lists `tasks/list`, and the 0.3 proto and schema do not. | The guide, read as not in the 0.3 schema | R.6 only | no change needed |
| N5 | **Upgrade headings.** Appendix A.2.1 says `pre-0.3.x` under the heading about the 1.0 change. | Read as pre-1.0 | R.6 only | unchanged |
| N6 | **Removal timeline.** Appendix A sets removal at 0.5.0 or later for names that 1.0 renamed, and calls the timeline an example. | §1.4: the next major release | R.6 only | unchanged |
| N7 | **Removed card field name.** Appendix A.2.2 `supports_extended_agent_card`, field 13. The 0.3 proto `supports_authenticated_extended_card`, field 13. | The 0.3 proto | R.6 only | unchanged |
| N8 | **Version in the §10.2 sample.** The gRPC sample sends `a2a-version` `0.3`, which D39 does not list. | Send `1.0` | [5.3](#s-grpc) | unchanged |
| N9 | **Config id name.** Migration guide `config_id`. Proto `id`. | The proto | [R.2](#s-ref-objects-and-fields) | fixed |
| N10 | **Extension lists as new fields.** Migration guide adds `Message.extensions` and `Artifact.extensions` in 1.0. Both exist in the 0.3 proto. | Not new | R.6 only | unchanged |
| N11 | **Mutual TLS as new.** Migration guide adds mutual TLS in 1.0. The 0.3 proto has `mtls_security_scheme`. | Not new | R.6 only | unchanged |
| N12 | **Tenant routes.** §5.3, §11.3, and §11.5 list no `/{tenant}` route. The proto adds one to every rpc. | The proto | [5.2](#s-http-json), [R.1](#s-ref-operations-by-binding) | unchanged |
| N13 | **Tenant field number.** `ListTaskPushNotificationConfigsRequest.tenant` is field 4. Every other request has field 1. | No conflict. Visible in gRPC only. | R.6 only | unchanged |
| N14 | **filename on any part.** Migration guide: `filename` on every part. Proto comment: for the file. | The proto allows it on any part. Use it for files. | [3.2](#s-part) | unchanged |
| N15 | **Create request in Appendix A.** The table names `CreateTaskPushNotificationConfigRequest` as current. It is the 0.3 type. | The proto, as D5 | [4.6](#s-push-notification-configs) | unchanged |
| N16 | **Operation aliases.** Migration guide: aliases during the transition. The proto and the method set define none. SDK compatibility layers do. | The spec. Name the SDK layer. | R.6 only | unchanged |
| N17 | **The flipped default.** Migration guide shows `returnImmediately` as new. 0.3 `blocking` defaulted to false, no wait. 1.0 `returnImmediately` defaults to false, a wait. | §3.2.2 and the proto | [4.1](#s-send-message) | unchanged |
| N18 | **Card sample in the extensions guide.** A top-level `url`, the 0.3 shape. | `supportedInterfaces` | R.6 only | fixed |
| N19 | **A gRPC-specific wrapper.** §10.5.1 calls `TaskPushNotificationConfig` a gRPC resource type. The proto uses it in every binding. | The proto | R.6 only | unchanged |
| N20 | **Security in the tenancy guide.** The multi-tenancy page `securitySchemes` and `security`. Proto `securityRequirements`. | The proto, as D6 | R.6 only | unchanged |

## After v1.0.1

The manual checked `main` of the A2A repository at commit `679ab3a`, dated 2026-10-05, and found 73 commits after the tag. One changes the proto: [PR #1997](https://github.com/a2aproject/A2A/pull/1997) lets a gRPC interface `url` be a `hostname:port` address, which settles D34. It is the only entry in the pending 1.0.2 release, [PR #2072](https://github.com/a2aproject/A2A/pull/2072), still open.

[PR #2081](https://github.com/a2aproject/A2A/pull/2081) added §7.6.4, In-Task Authorization Scope, which the manual quotes with the key `spec-main`. Branch `dev-1.1`, at commit `db39eb5` of 2026-09-22, holds the 1.1 work: a `generation` field and a task timeline. The approved fixes for D1 and D3 target that branch and are still open. No tag newer than `v1.0.1` existed on 2026-10-06.

Sources: manual.json pin, sources and quoteSources; research/sources/README.md and LICENSE; spec §1.4, §3.6, §5.7, §10.1 (research/sources/specification.md); research/sources/specification-main.md §7.6.4 (main at 679ab3a); research/brief-spec.md sections 1.1, 12.2 and 14; research/brief-docs.md; research/conflicts-upstream.md, research/migration.md section D.6, research/sdk-splits.md section 1, research/conformance-tools.md (research of 2026-10-06); a2aproject/A2A main at 679ab3a, branch dev-1.1 at db39eb5, and the PRs and issues in the Upstream column, checked 2026-10-06; the a2a-python checkout at tag v1.2.2 (pyproject.toml, LICENSE); the SDK and a2a-tck repositories at the tags in the SDK table; manuals/a2a-101/capture/README.md, capture/run.py
