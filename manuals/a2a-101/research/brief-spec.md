# A2A 101 fact brief: Agent2Agent (A2A) protocol, specification v1.0.1

Source-of-truth brief for the technical manual "A2A 101". Built on 2026-10-06 from a local clone of `github.com/a2aproject/A2A`, pinned at git tag `v1.0.1` (commit `3303592588e388e62e0f69f701af531d2f4e3991`). Every fact below was read from the files at that tag, except the items marked `main`, which were read from commit 679ab3a. Where the specification is silent the brief says `SPEC SILENT`. Where two sources disagree the brief says so and gives both citations. Changes that exist only on `main` after the tag are collected in section 14; where a v1.0.1 defect was already fixed on `main` the discrepancy register (12.2) says so explicitly and the fix is never presented as part of v1.0.1.

## 0. How to read this brief

Citation key. Every bullet and every table row ends with one or more bracketed citations. Line numbers are 1-based line numbers of the file as it exists at the tag (or at `main` where the key says `main`).

```text
[spec §N, La-Lb]       docs/specification.md at v1.0.1 (3610 lines). §N is the numbered heading that encloses line La.
                       "§0" means the line sits above the first numbered heading (the banner at the top of the file).
[proto La-Lb]          specification/a2a.proto at v1.0.1 (811 lines). Normative for data objects and messages.
[doc FILE, La-Lb]      other files at v1.0.1 (non-normative guides): topics/*.md, whats-new-v1.md, announcing-1.0.md, roadmap.md, json-README.md.
[adr-001, La-Lb]       adrs/adr-001-protojson-serialization.md at v1.0.1.
[changelog, La-Lb]     CHANGELOG.md at v1.0.1.
[macros, La-Lb]        .mkdocs/macros.py at v1.0.1 (the doc-build macros that expand {{ proto_to_table(...) }} in the spec).
[main spec §N, La-Lb]  docs/specification.md at main (commit 679ab3a, 2026-10-05). Only used in section 14 and in discrepancy notes.
[main proto La-Lb]     specification/a2a.proto at main (commit 679ab3a).
[git commit 3303592]   metadata of the tag commit itself (author, date, message). No line numbers.
```

Reliability ranking used when sources disagree: (1) `a2a.proto` for data objects, field names, field presence and the `google.api.http` URL annotations; (2) `specification.md` prose for behavior; (3) the topic guides under `docs/topics/`; (4) `whats-new-v1.md` and the tutorials. Section 12.2 lists every disagreement found. Quoted text is verbatim from the cited lines (whitespace and markdown emphasis normalised). Text marked "Derived" is an inference from cited lines and is not stated by the spec in those words. Text marked "Constructed" is an example assembled strictly from proto field names and is not a spec example.

### 0.1 Map of the specification (numbered headings and the line where each starts)

| section | title | starts at line | cite |
|---|---|---|---|
| §1 | Introduction | L13 | [spec §1, L13] |
| §1.1 | Key Goals of A2A | L24 | [spec §1.1, L24] |
| §1.2 | Guiding Principles | L33 | [spec §1.2, L33] |
| §1.3 | Specification Structure | L43 | [spec §1.3, L43] |
| §1.4 | Normative Content | L105 | [spec §1.4, L105] |
| §2 | Terminology | L125 | [spec §2, L125] |
| §2.1 | Requirements Language | L127 | [spec §2.1, L127] |
| §2.2 | Core Concepts | L131 | [spec §2.2, L131] |
| §3 | A2A Protocol Operations | L147 | [spec §3, L147] |
| §3.1 | Core Operations | L151 | [spec §3.1, L151] |
| §3.1.1 | Send Message | L159 | [spec §3.1.1, L159] |
| §3.1.2 | Send Streaming Message | L182 | [spec §3.1.2, L182] |
| §3.1.3 | Get Task | L214 | [spec §3.1.3, L214] |
| §3.1.4 | List Tasks | L232 | [spec §3.1.4, L232] |
| §3.1.5 | Cancel Task | L264 | [spec §3.1.5, L264] |
| §3.1.6 | Subscribe to Task | L285 | [spec §3.1.6, L285] |
| §3.1.7 | Create Push Notification Config | L313 | [spec §3.1.7, L313] |
| §3.1.8 | Get Push Notification Config | L339 | [spec §3.1.8, L339] |
| §3.1.9 | List Push Notification Configs | L362 | [spec §3.1.9, L362] |
| §3.1.10 | Delete Push Notification Config | L383 | [spec §3.1.10, L383] |
| §3.1.11 | Get Extended Agent Card | L404 | [spec §3.1.11, L404] |
| §3.2 | Operation Parameter Objects | L430 | [spec §3.2, L430] |
| §3.2.1 | SendMessageRequest | L434 | [spec §3.2.1, L434] |
| §3.2.2 | SendMessageConfiguration | L438 | [spec §3.2.2, L438] |
| §3.2.3 | Stream Response | L456 | [spec §3.2.3, L456] |
| §3.2.4 | History Length Semantics | L465 | [spec §3.2.4, L465] |
| §3.2.5 | Metadata | L473 | [spec §3.2.5, L473] |
| §3.2.6 | Service Parameters | L477 | [spec §3.2.6, L477] |
| §3.3 | Operation Semantics | L490 | [spec §3.3, L490] |
| §3.3.1 | Idempotency | L492 | [spec §3.3.1, L492] |
| §3.3.2 | Error Handling | L498 | [spec §3.3.2, L498] |
| §3.3.3 | Asynchronous Processing | L565 | [spec §3.3.3, L565] |
| §3.3.4 | Capability Validation | L569 | [spec §3.3.4, L569] |
| §3.4 | Multi-Turn Interactions | L580 | [spec §3.4, L580] |
| §3.4.1 | Context Identifier Semantics | L584 | [spec §3.4.1, L584] |
| §3.4.2 | Task Identifier Semantics | L604 | [spec §3.4.2, L604] |
| §3.4.3 | Multi-Turn Conversation Patterns | L617 | [spec §3.4.3, L617] |
| §3.5 | Task Update Delivery Mechanisms | L646 | [spec §3.5, L646] |
| §3.5.1 | Overview of Update Mechanisms | L650 | [spec §3.5.1, L650] |
| §3.5.2 | Streaming Event Delivery | L679 | [spec §3.5.2, L679] |
| §3.5.3 | Push Notification Delivery | L702 | [spec §3.5.3, L702] |
| §3.6 | Versioning | L706 | [spec §3.6, L706] |
| §3.6.1 | Client Responsibilities | L710 | [spec §3.6.1, L710] |
| §3.6.2 | Server Responsibilities | L735 | [spec §3.6.2, L735] |
| §3.6.3 | Tooling support | L743 | [spec §3.6.3, L743] |
| §3.7 | Messages and Artifacts | L747 | [spec §3.7, L747] |
| §4 | Protocol Data Model | L766 | [spec §4, L766] |
| §4.1 | Core Objects | L770 | [spec §4.1, L770] |
| §4.1.1 | Task | L774 | [spec §4.1.1, L774] |
| §4.1.2 | TaskStatus | L780 | [spec §4.1.2, L780] |
| §4.1.3 | TaskState | L786 | [spec §4.1.3, L786] |
| §4.1.4 | Message | L792 | [spec §4.1.4, L792] |
| §4.1.5 | Role | L798 | [spec §4.1.5, L798] |
| §4.1.6 | Part | L804 | [spec §4.1.6, L804] |
| §4.1.7 | Artifact | L810 | [spec §4.1.7, L810] |
| §4.2 | Streaming Events | L814 | [spec §4.2, L814] |
| §4.2.1 | TaskStatusUpdateEvent | L818 | [spec §4.2.1, L818] |
| §4.2.2 | TaskArtifactUpdateEvent | L824 | [spec §4.2.2, L824] |
| §4.3 | Push Notification Objects | L828 | [spec §4.3, L828] |
| §4.3.1 | PushNotificationConfig | L832 | [spec §4.3.1, L832] |
| §4.3.2 | AuthenticationInfo | L838 | [spec §4.3.2, L838] |
| §4.3.3 | Push Notification Payload | L842 | [spec §4.3.3, L842] |
| §4.4 | Agent Discovery Objects | L891 | [spec §4.4, L891] |
| §4.4.1 | AgentCard | L895 | [spec §4.4.1, L895] |
| §4.4.2 | AgentProvider | L901 | [spec §4.4.2, L901] |
| §4.4.3 | AgentCapabilities | L907 | [spec §4.4.3, L907] |
| §4.4.4 | AgentExtension | L913 | [spec §4.4.4, L913] |
| §4.4.5 | AgentSkill | L919 | [spec §4.4.5, L919] |
| §4.4.6 | AgentInterface | L925 | [spec §4.4.6, L925] |
| §4.4.7 | AgentCardSignature | L931 | [spec §4.4.7, L931] |
| §4.5 | Security Objects | L935 | [spec §4.5, L935] |
| §4.5.1 | SecurityScheme | L940 | [spec §4.5.1, L940] |
| §4.5.2 | APIKeySecurityScheme | L946 | [spec §4.5.2, L946] |
| §4.5.3 | HTTPAuthSecurityScheme | L952 | [spec §4.5.3, L952] |
| §4.5.4 | OAuth2SecurityScheme | L958 | [spec §4.5.4, L958] |
| §4.5.5 | OpenIdConnectSecurityScheme | L964 | [spec §4.5.5, L964] |
| §4.5.6 | MutualTlsSecurityScheme | L970 | [spec §4.5.6, L970] |
| §4.5.7 | OAuthFlows | L976 | [spec §4.5.7, L976] |
| §4.5.8 | AuthorizationCodeOAuthFlow | L982 | [spec §4.5.8, L982] |
| §4.5.9 | ClientCredentialsOAuthFlow | L988 | [spec §4.5.9, L988] |
| §4.5.10 | DeviceCodeOAuthFlow | L994 | [spec §4.5.10, L994] |
| §4.6 | Extensions | L998 | [spec §4.6, L998] |
| §4.6.1 | Extension Declaration | L1002 | [spec §4.6.1, L1002] |
| §4.6.2 | Extensions Points | L1077 | [spec §4.6.2, L1077] |
| §4.6.3 | Extension Versioning and Compatibility | L1137 | [spec §4.6.3, L1137] |
| §5 | Protocol Binding Requirements and Interoperability | L1143 | [spec §5, L1143] |
| §5.1 | Functional Equivalence Requirements | L1145 | [spec §5.1, L1145] |
| §5.2 | Protocol Selection and Negotiation | L1154 | [spec §5.2, L1154] |
| §5.3 | Method Mapping Reference | L1160 | [spec §5.3, L1160] |
| §5.4 | Error Code Mappings | L1176 | [spec §5.4, L1176] |
| §5.5 | JSON Field Naming Convention | L1202 | [spec §5.5, L1202] |
| §5.6 | Data Type Conventions | L1224 | [spec §5.6, L1224] |
| §5.6.1 | Timestamps | L1228 | [spec §5.6.1, L1228] |
| §5.7 | Field Presence and Optionality | L1257 | [spec §5.7, L1257] |
| §5.8 | Custom Binding Identification | L1277 | [spec §5.8, L1277] |
| §6 | Common Workflows & Examples | L1304 | [spec §6, L1304] |
| §6.1 | Basic Task Execution | L1308 | [spec §6.1, L1308] |
| §6.2 | Streaming Task Execution | L1349 | [spec §6.2, L1349] |
| §6.3 | Multi-Turn Interaction | L1383 | [spec §6.3, L1383] |
| §6.4 | Version Negotiation Error | L1442 | [spec §6.4, L1442] |
| §6.5 | Task Listing and Management | L1479 | [spec §6.5, L1479] |
| §6.6 | Push Notification Setup and Usage | L1620 | [spec §6.6, L1620] |
| §6.7 | File Exchange (Upload and Download) | L1692 | [spec §6.7, L1692] |
| §6.8 | Structured Data Exchange | L1753 | [spec §6.8, L1753] |
| §6.9 | Fetching Authenticated Extended Agent Card | L1819 | [spec §6.9, L1819] |
| §7 | Authentication and Authorization | L1871 | [spec §7, L1871] |
| §7.1 | Protocol Security | L1877 | [spec §7.1, L1877] |
| §7.2 | Server Identity Verification | L1881 | [spec §7.2, L1881] |
| §7.3 | Client Authentication Process | L1885 | [spec §7.3, L1885] |
| §7.4 | Server Authentication Responsibilities | L1891 | [spec §7.4, L1891] |
| §7.5 | Server Authorization Responsibilities | L1899 | [spec §7.5, L1899] |
| §7.6 | In-Task Authorization | L1908 | [spec §7.6, L1908] |
| §7.6.1 | In-Task Authorization Agent Responsibilities | L1921 | [spec §7.6.1, L1921] |
| §7.6.2 | In-Task Authorization Client Responsibilities | L1935 | [spec §7.6.2, L1935] |
| §7.6.3 | In-Task Authorization Security Considerations | L1953 | [spec §7.6.3, L1953] |
| §8 | Agent Discovery: The Agent Card | L1964 | [spec §8, L1964] |
| §8.1 | Purpose | L1968 | [spec §8.1, L1968] |
| §8.2 | Discovery Mechanisms | L1974 | [spec §8.2, L1974] |
| §8.3 | Protocol Declaration Requirements | L1982 | [spec §8.3, L1982] |
| §8.3.1 | Supported Interfaces Declaration | L1986 | [spec §8.3.1, L1986] |
| §8.3.2 | Client Protocol Selection | L1993 | [spec §8.3.2, L1993] |
| §8.4 | Agent Card Signing | L2002 | [spec §8.4, L2002] |
| §8.4.1 | Canonicalization Requirements | L2006 | [spec §8.4.1, L2006] |
| §8.4.2 | Signature Format | L2058 | [spec §8.4.2, L2058] |
| §8.4.3 | Signature Verification | L2117 | [spec §8.4.3, L2117] |
| §8.5 | Sample Agent Card | L2136 | [spec §8.5, L2136] |
| §8.6 | Caching | L2213 | [spec §8.6, L2213] |
| §8.6.1 | Server Requirements | L2217 | [spec §8.6.1, L2217] |
| §8.6.2 | Client Requirements | L2223 | [spec §8.6.2, L2223] |
| §9 | JSON-RPC Protocol Binding | L2229 | [spec §9, L2229] |
| §9.1 | Protocol Requirements | L2233 | [spec §9.1, L2233] |
| §9.2 | Service Parameter Transmission | L2240 | [spec §9.2, L2240] |
| §9.3 | Base Request Structure | L2268 | [spec §9.3, L2268] |
| §9.4 | Core Methods | L2281 | [spec §9.4, L2281] |
| §9.4.1 | `SendMessage` | L2283 | [spec §9.4.1, L2283] |
| §9.4.2 | `SendStreamingMessage` | L2316 | [spec §9.4.2, L2316] |
| §9.4.3 | `GetTask` | L2332 | [spec §9.4.3, L2332] |
| §9.4.4 | `ListTasks` | L2350 | [spec §9.4.4, L2350] |
| §9.4.5 | `CancelTask` | L2370 | [spec §9.4.5, L2370] |
| §9.4.6 | `SubscribeToTask` | L2387 | [spec §9.4.6, L2387] |
| §9.4.7 | Push Notification Configuration Methods | L2410 | [spec §9.4.7, L2410] |
| §9.4.8 | `GetExtendedAgentCard` | L2417 | [spec §9.4.8, L2417] |
| §9.5 | Error Handling | L2431 | [spec §9.5, L2431] |
| §10 | gRPC Protocol Binding | L2505 | [spec §10, L2505] |
| §10.1 | Protocol Requirements | L2509 | [spec §10.1, L2509] |
| §10.2 | Service Parameter Transmission | L2516 | [spec §10.2, L2516] |
| §10.3 | Service Definition | L2547 | [spec §10.3, L2547] |
| §10.4 | Core Methods | L2551 | [spec §10.4, L2551] |
| §10.4.1 | SendMessage | L2553 | [spec §10.4.1, L2553] |
| §10.4.2 | SendStreamingMessage | L2565 | [spec §10.4.2, L2565] |
| §10.4.3 | GetTask | L2575 | [spec §10.4.3, L2575] |
| §10.4.4 | ListTasks | L2585 | [spec §10.4.4, L2585] |
| §10.4.5 | CancelTask | L2597 | [spec §10.4.5, L2597] |
| §10.4.6 | SubscribeToTask | L2607 | [spec §10.4.6, L2607] |
| §10.4.7 | CreateTaskPushNotificationConfig | L2617 | [spec §10.4.7, L2617] |
| §10.4.8 | GetTaskPushNotificationConfig | L2627 | [spec §10.4.8, L2627] |
| §10.4.9 | ListTaskPushNotificationConfigs | L2637 | [spec §10.4.9, L2637] |
| §10.4.10 | DeleteTaskPushNotificationConfig | L2649 | [spec §10.4.10, L2649] |
| §10.4.11 | GetExtendedAgentCard | L2659 | [spec §10.4.11, L2659] |
| §10.5 | gRPC-Specific Data Types | L2669 | [spec §10.5, L2669] |
| §10.5.1 | TaskPushNotificationConfig | L2671 | [spec §10.5.1, L2671] |
| §10.6 | Error Handling | L2677 | [spec §10.6, L2677] |
| §10.7 | Streaming | L2737 | [spec §10.7, L2737] |
| §11 | HTTP+JSON/REST Protocol Binding | L2743 | [spec §11, L2743] |
| §11.1 | Protocol Requirements | L2747 | [spec §11.1, L2747] |
| §11.2 | Service Parameter Transmission | L2755 | [spec §11.2, L2755] |
| §11.3 | URL Patterns and HTTP Methods | L2783 | [spec §11.3, L2783] |
| §11.3.1 | Message Operations | L2785 | [spec §11.3.1, L2785] |
| §11.3.2 | Task Operations | L2790 | [spec §11.3.2, L2790] |
| §11.3.3 | Push Notification Configuration | L2797 | [spec §11.3.3, L2797] |
| §11.3.4 | Agent Card | L2804 | [spec §11.3.4, L2804] |
| §11.4 | Request/Response Format | L2808 | [spec §11.4, L2808] |
| §11.5 | Query Parameter Naming for Request Parameters | L2851 | [spec §11.5, L2851] |
| §11.6 | Error Handling | L2896 | [spec §11.6, L2896] |
| §11.7 | Streaming | L2946 | [spec §11.7, L2946] |
| §12 | Custom Binding Guidelines | L2975 | [spec §12, L2975] |
| §12.1 | Binding Requirements | L2979 | [spec §12.1, L2979] |
| §12.2 | Data Type Mappings | L2988 | [spec §12.2, L2988] |
| §12.3 | Service Parameter Transmission | L2997 | [spec §12.3, L2997] |
| §12.4 | Error Mapping | L3011 | [spec §12.4, L3011] |
| §12.5 | Streaming Support | L3020 | [spec §12.5, L3020] |
| §12.6 | Authentication and Authorization | L3031 | [spec §12.6, L3031] |
| §12.7 | Agent Card Declaration | L3040 | [spec §12.7, L3040] |
| §12.8 | Interoperability Testing | L3060 | [spec §12.8, L3060] |
| §13 | Security Considerations | L3069 | [spec §13, L3069] |
| §13.1 | Data Access and Authorization Scoping | L3073 | [spec §13.1, L3073] |
| §13.2 | Push Notification Security | L3103 | [spec §13.2, L3103] |
| §13.3 | Extended Agent Card Access Control | L3136 | [spec §13.3, L3136] |
| §13.4 | General Security Best Practices | L3169 | [spec §13.4, L3169] |
| §14 | IANA Considerations | L3220 | [spec §14, L3220] |
| §14.1 | Media Type Registration | L3224 | [spec §14.1, L3224] |
| §14.1.1 | application/a2a+json | L3226 | [spec §14.1.1, L3226] |
| §14.2 | HTTP Header Field Registrations | L3280 | [spec §14.2, L3280] |
| §14.2.1 | A2A-Version Header | L3284 | [spec §14.2.1, L3284] |
| §14.2.2 | A2A-Extensions Header | L3305 | [spec §14.2.2, L3305] |
| §14.3 | Well-Known URI Registration | L3326 | [spec §14.3, L3326] |
| §A | Migration & Legacy Compatibility | L3355 | [spec §A, L3355] |
| §A.1 | Legacy Documentation Anchors | L3374 | [spec §A.1, L3374] |
| §A.2 | Migration Guidance | L3419 | [spec §A.2, L3419] |
| §A.2.1 | Breaking Change: Kind Discriminator Removed | L3432 | [spec §A.2.1, L3432] |
| §A.2.2 | Breaking Change: Extended Agent Card Field Relocated | L3529 | [spec §A.2.2, L3529] |
| §A.3 | Future Automation | L3594 | [spec §A.3, L3594] |
| §B | Relationship to MCP (Model Context Protocol) | L3598 | [spec §B, L3598] |

### 0.2 Numbers worth memorizing (all counted from the pinned files)

- `TaskState` has 9 values (including `TASK_STATE_UNSPECIFIED`): 2 active, 4 terminal, 2 interrupted. [proto L187-L208]
- `A2AService` has 11 RPCs: 6 message and task operations, 4 push-configuration operations, 1 extended-card operation. [proto L19-L139]
- There are 3 standard bindings (`JSONRPC`, `GRPC`, `HTTP+JSON`), 2 standard service parameters (`A2A-Version`, `A2A-Extensions`) and 9 A2A-specific errors (JSON-RPC `-32001` to `-32009`). [proto L340-L343] [spec §3.2.6, L483-L486] [spec §5.4, L1182-L1190]
- A `StreamResponse` has 4 payload kinds (`task`, `message`, `statusUpdate`, `artifactUpdate`); a `Part` has 4 content kinds (`text`, `raw`, `url`, `data`); a `SecurityScheme` has 5 variants; `OAuthFlows` has 5 flows, 2 of them deprecated. [proto L789-L802] [proto L224-L234] [proto L503-L516] [proto L567-L580]
- `ListTasks` defaults to 50 results per page, with a minimum of 1 and a maximum of 100. [proto L683-L687]
- The prose spec is 3610 lines and the proto is 811 lines at the tag. [spec §0, L1] [proto L1]

## 1. Pin and conformance

### 1.1 Which release this brief describes

- The pinned source is git tag `v1.0.1`, a lightweight tag (it resolves directly to a commit) pointing at commit `3303592588e388e62e0f69f701af531d2f4e3991`, subject "chore(main): release 1.0.1 (#1749)", author "Agent2Agent (A2A) Bot", commit date 2026-05-28 06:34:16 -0500. [git commit 3303592]
- Release-date metadata is inconsistent inside the tag: the CHANGELOG heading for 1.0.1 says (2026-05-26), the tag commit message body says (2026-04-23), and the commit itself is dated 2026-05-28. The tag commit message is a release-bot template (it opens with `Add release notes for A2A - Python SDK v1.0.1`, lists only the first two fixes below and carries the 2026-04-23 date), so it is the weakest of the three. Use the wording `v1.0.1, tagged 2026-05-28` and do not claim a single authoritative release date. [changelog, L3] [git commit 3303592]
- The previous release, 1.0.0, is dated 2026-03-12 in the CHANGELOG and is the first release of the `1.x` line. [changelog, L12]
- The CHANGELOG lists exactly three fixes for 1.0.1: "prefer application/a2a+json in HTTP binding" (#1753), "recent transcoding-related error changes" (#1627) and "TaskStatus values in the specification" (#1801). [changelog, L6-L10]
- The prose spec still carries a banner naming `1.0.0` as the "Latest Released Version", so the banner was not updated when the file was tagged 1.0.1. [spec §0, L3]
- The spec file does not declare a version number for the protocol text itself. The version identifiers it defines are the `A2A-Version` header value, which "MUST be in the format `Major.Minor`", and the per-interface `protocolVersion` field whose proto examples are "0.3" and "1.0". [spec §14.2.1, L3297] [proto L351-L354]
- Protocol versions are identified by `Major.Minor` only. The spec says "Patch version numbers SHOULD NOT be used in requests, responses and Agent Cards, and MUST not be considered when clients and servers negotiate protocol versions." So v1.0.0 and v1.0.1 are both protocol version `1.0`. [spec §3.6, L708]
- The proto declares `syntax = "proto3";` and `package lf.a2a.v1;` and carries the comment "Older protoc compilers don't understand edition yet." The `lf` prefix was added in 1.0.0. [proto L1-L3] [changelog, L20]
- The proto defines one gRPC service, `A2AService`, in package `lf.a2a.v1`. Derived: by ordinary gRPC naming the fully qualified method names are `/lf.a2a.v1.A2AService/SendMessage` and so on. The spec only says to "Implement the `A2AService` gRPC service". [proto L3] [proto L19] [spec §10.1, L2514]
- Language options in the proto: `csharp_namespace "Lf.A2a.V1"`, `go_package "google.golang.org/lf/a2a/v1"`, `java_package "com.google.lf.a2a.v1"`, `java_outer_classname "A2A"`. [proto L12-L16]
- The proto imports `google/api/annotations.proto`, `google/api/client.proto`, `google/api/field_behavior.proto`, `google/protobuf/empty.proto`, `google/protobuf/struct.proto` and `google/protobuf/timestamp.proto`. Implementers need the Google API annotation protos to compile it. [proto L5-L10]
- The release is announced as "the first stable, production-ready version of the open standard", governed by a technical steering committee with representatives from AWS, Cisco, Google, IBM Research, Microsoft, Salesforce, SAP and ServiceNow. [doc announcing-1.0.md, L3] [doc announcing-1.0.md, L51]
- The announcement says an Agent Card "now allows agents to advertise support for both existing v0.3 protocol behavior and v1.0 simultaneously", which is the migration path for clients. [doc announcing-1.0.md, L36]

### 1.2 Which file is normative

- The prose spec makes the proto the normative source: "the file `spec/a2a.proto` is the single authoritative normative definition of all protocol data objects and request/response messages." [spec §1.4, L107]
- The path in that sentence is wrong. The repository path is `specification/a2a.proto`, which is what §5.7 and §10.1 use. [spec §1.4, L107] [spec §5.7, L1259] [spec §10.1, L2512]
- The JSON Schema artifact is not normative: it is "produced at build time and not committed" and MAY be published "for convenience to tooling and the website". It is generated by `scripts/proto_to_json_schema.sh` using `protoc-gen-jsonschema` and is described as a "non-normative build artifact". Therefore at the tag there is no committed JSON Schema to validate against. [spec §1.4, L107] [doc json-README.md, L3-L9]
- Derived artifacts are not hand edited: "SDK language bindings, schemas, and any other derived forms MUST be regenerated from the proto (directly or via code generation) rather than edited manually." [spec §1.4, L107]
- Rename and deprecation policy: when a proto message or field is renamed "the new name is added while existing published names remain available, but marked deprecated, until the next major release". A deprecated name "SHOULD NOT be removed earlier than the next major version after introduction of its replacement." [spec §1.4, L111] [spec §1.4, L115]
- The spec states its own rationale for centering the proto: "Centering the proto file as the normative source ensures protocol neutrality, reduces specification drift, and provides a deterministic evolution path for the ecosystem." [spec §1.4, L123]
- The prose spec carries requirements the proto cannot express ("In addition to the protocol requirements defined in this document"). So a conformant implementation must satisfy both files, and the proto wins only for "protocol data objects and request/response messages". [spec §1.4, L107]
- SPEC SILENT: there is no stated precedence rule for behavior (as opposed to data objects) when the proto and the prose disagree. The one concrete case at v1.0.1 is the HTTP verb for `SubscribeToTask` (proto `get`, prose `POST`), listed in section 12.2. [spec §1.4, L107-L119] [proto L76-L82]
- The ProtoJSON decision is recorded in ADR-001 (status Accepted, 2025-11-18, decision makers: Technical Steering Committee). It makes ProtoJSON "the normative approach to serializing JSON based on the proto definition referenced by the specification". [adr-001, L3-L7] [adr-001, L34]
- The ADR records its costs: enum values become SCREAMING_SNAKE_CASE, unknown values cannot be round-tripped through JSON, and "Certain field names need to have less than optimal names to avoid conflicts with proto keywords. e.g. message." [adr-001, L52-L58]

### 1.3 The spec's own layering

- The spec "is organized into three distinct layers": Layer 1 canonical data model, Layer 2 abstract operations, Layer 3 protocol bindings. [spec §1.3, L45]
- Layer 1: "Canonical Data Model defines the core data structures and message formats that all A2A implementations must understand. These are protocol agnostic definitions expressed as Protocol Buffer messages." In the document this layer is §4 "Protocol Data Model" (plus the JSON conventions in §5.5 to §5.7). [spec §1.3, L92] [spec §4, L766]
- Layer 2: "Abstract Operations describes the fundamental capabilities and behaviors that A2A agents must support, independent of how they are exposed over specific protocols." In the document this layer is §3 "A2A Protocol Operations". [spec §1.3, L94] [spec §3, L147]
- Layer 3: "Protocol Bindings provides concrete mappings of the abstract operations and data structures to specific protocol bindings (JSON-RPC, gRPC, HTTP/REST), including method names, endpoint patterns, and protocol-specific behaviors." In the document the three standard bindings are §9 JSON-RPC, §10 gRPC and §11 HTTP+JSON/REST, governed by the common rules in §5 and extended by §12 "Custom Binding Guidelines". [spec §1.3, L96] [spec §9, L2229] [spec §10, L2505] [spec §11, L2743] [spec §12, L2975]
- The stated purpose of layering: "Core semantics remain consistent across all protocol bindings", "New protocol bindings can be added without changing the fundamental data model", and "Interoperability is maintained through shared understanding of the canonical data model". [spec §1.3, L100-L103]
- The Layer 2 diagram lists the operations Send Message, Send Streaming Message, Get Task, List Tasks, Cancel Task and "Get Agent Card". §3.1 defines no "Get Agent Card" operation (only "Get Extended Agent Card", §3.1.11) and the proto service has no public-card RPC, so the diagram is loose. The public card is fetched by plain HTTP GET (section 8). [spec §1.3, L54-L57] [spec §3.1.11, L404-L406] [proto L19-L140]
- The diagram also omits Subscribe to Task and the four push-config operations, which §3.1 does define. [spec §1.3, L54-L57] [spec §3.1.6, L285-L289] [spec §3.1.7, L313-L318]
- All bindings carry the same model: "All protocol bindings **MUST** provide functionally equivalent representations of these data structures." [spec §4, L768]
- An agent that offers several bindings must keep them equivalent: "Identical Functionality", "Consistent Behavior", "Same Error Handling" and "Equivalent Authentication" are each a MUST for "all supported protocols". [spec §5.1, L1147-L1152]
- §3.1 says the core operations are "fundamental capabilities that all A2A implementations must support", yet streaming, push notifications and the extended card are optional capabilities that an agent can decline with a defined error (section 3.3.4). Treat §3.1 as meaning that all operations exist in the protocol, and treat capability flags as the opt-out. [spec §3, L149] [spec §3.3.4, L571-L578]

### 1.4 How the spec uses MUST and SHOULD

- Normative language is defined once, in one sentence: the keywords “MUST”, “MUST NOT”, “REQUIRED”, “SHALL”, “SHALL NOT”, “SHOULD”, “SHOULD NOT”, “RECOMMENDED”, “MAY”, and “OPTIONAL” "in this document are to be interpreted as described in" RFC 2119. [spec §2.1, L129]
- The prose uses the keywords both in bold (`**MUST**`) and in plain capitals (inference: no semantic difference is intended). Lowercase wording in prose, for example "Clients should check for an empty string", is not written as a requirement keyword, so read it as guidance (convention only; the spec does not say). [spec §3.1.4, L246]
- Required fields are normative through an annotation, not through the word REQUIRED in a comment: "Fields marked with `[(google.api.field_behavior) = REQUIRED]` indicate that the field **MUST** be present and set in valid messages. Implementations **SHOULD** validate these requirements and reject messages with missing required fields. Arrays marked as required **MUST** contain at least one element." [spec §5.7, L1263]
- Inside `a2a.proto` comments both capitalised keywords and lowercase `must` occur. Capitalised examples: "Agents SHOULD use this to tailor their output.", "The server MUST NOT" and "clients MUST include this value in the `tenant` field of all request messages sent to this interface." [proto L145] [proto L152-L153] [proto L346-L347]
- Lowercase proto examples: "It must be unique within a task.", "Must contain at least one part.", "Must be a valid absolute HTTPS URL in production." and "For server messages, `context_id` must be provided". [proto L281] [proto L287] [proto L337] [proto L255-L256]
- SPEC SILENT: whether a lowercase `must` in proto comments binds like RFC 2119 MUST. §2.1 scopes the keyword definition to the sentence "in this document" (the prose file). Treat the proto lowercase `must` statements as requirements anyway, because §1.4 makes the proto "the single authoritative normative definition of all protocol data objects and request/response messages". [spec §2.1, L129] [spec §1.4, L107]
- Some MUST sentences are generated at documentation build time and do not appear in the `specification.md` source. The macro `proto_to_table` appends a note saying the message "MUST contain exactly one of the following" members under any message that has a `oneof` with more than one member. In the built site this affects `Part`, `SecurityScheme`, `OAuthFlows`, `SendMessageResponse` and `StreamResponse`. [macros, L112-L120]
- The same macro renders the table column "Required" as `Yes` when the field has `field_behavior = REQUIRED`, `Optional (OneOf)` for `oneof` members and `No` otherwise, and derives the JSON name by converting snake_case to camelCase. [macros, L303-L319]
- Non-normative guides use the keywords too (for example in `extensions.md` and `streaming-and-async.md`), but they sit under `docs/topics/` and are not the spec. Citations below mark them with the `doc` prefix. [doc topics/streaming-and-async.md, L83-L90]

### 1.5 Conformance

- SPEC SILENT: the specification defines no conformance classes, profiles or test-suite requirement. The closest statements are the field-validation rule in §5.7 and the equivalence rules in §5.1. [spec §5.7, L1263] [spec §5.1, L1145-L1152]
- Optional capabilities are declared in the Agent Card and gate operations: a missing or false flag obliges the agent to return a specific error (streaming, push notifications, extended card, required extensions). [spec §3.3.4, L569-L578]
- Extensions and custom bindings are optional for conformance: "Extension support is not required for protocol conformance" and "Custom protocol binding support is not required for protocol conformance". [doc topics/extension-and-binding-governance.md, L152] [doc topics/extension-and-binding-governance.md, L161]
- A protocol compatibility kit exists outside the spec: the roadmap names "A2A Inspector" and the "A2A Protocol Technology Compatibility Kit" (TCK) as validation tools. The spec itself does not reference them. [doc roadmap.md, L22]
- Wire-level strictness: unknown JSON fields are tolerated ("Implementations **SHOULD** ignore unrecognized fields in messages"), while `REQUIRED` fields must be present. [spec §5.7, L1275] [spec §5.7, L1263]


### 1.6 Terminology (section 2.2, verbatim)

- "A2A Client: An application or agent that initiates requests to an A2A Server on behalf of a user or another system." [spec §2.2, L135]
- "A2A Server (Remote Agent): An agent or agentic system that exposes an A2A-compliant endpoint, processing tasks and providing responses." [spec §2.2, L136]
- "Agent Card: A JSON metadata document published by an A2A Server, describing its identity, capabilities, skills, service endpoint, and authentication requirements." [spec §2.2, L137]
- "Message: A communication turn between a client and a remote agent, having a `role` (“user” or “agent”) and containing one or more `Parts`." [spec §2.2, L138]
- Note: §2.2 describes the `role` of a Message as "user" or "agent", but the v1.0 wire values are the enum identifiers `ROLE_USER` and `ROLE_AGENT`. [spec §2.2, L138] [proto L244-L252]
- "Task: The fundamental unit of work managed by A2A, identified by a unique ID. Tasks are stateful and progress through a defined lifecycle." [spec §2.2, L139]
- "Part: The smallest unit of content within a Message or Artifact. Parts can contain text, file references, or structured data." [spec §2.2, L140]
- "Artifact: An output (e.g., a document, image, structured data) generated by the agent as a result of a task, composed of `Parts`." [spec §2.2, L141]
- "Streaming: Real-time, incremental updates for tasks (status changes, artifact chunks) delivered via protocol-specific streaming mechanisms." [spec §2.2, L142]
- "Push Notifications: Asynchronous task updates delivered via server-initiated HTTP POST requests to a client-provided webhook URL, for long-running or disconnected scenarios." [spec §2.2, L143]
- "Context: An optional identifier to logically group related tasks and messages." [spec §2.2, L144]
- "Extension: A mechanism for agents to provide additional functionality or data beyond the core A2A specification." [spec §2.2, L145]

### 1.7 Goals and guiding principles (sections 1.1 and 1.2, verbatim)

- "Interoperability: Bridge the communication gap between disparate agentic systems." [spec §1.1, L26]
- "Collaboration: Enable agents to delegate tasks, exchange context, and work together on complex user requests." [spec §1.1, L27]
- "Discovery: Allow agents to dynamically find and understand the capabilities of other agents." [spec §1.1, L28]
- "Flexibility: Support various interaction modes including synchronous request/response, streaming for real-time updates, and asynchronous push notifications for long-running tasks." [spec §1.1, L29]
- "Security: Facilitate secure communication patterns suitable for enterprise environments, relying on standard web security practices." [spec §1.1, L30]
- "Asynchronicity: Natively support long-running tasks and interactions that may involve human-in-the-loop scenarios." [spec §1.1, L31]
- "Simple: Reuse existing, well-understood standards (HTTP, JSON-RPC 2.0, Server-Sent Events)." [spec §1.2, L35]
- "Enterprise Ready: Address authentication, authorization, security, privacy, tracing, and monitoring by aligning with established enterprise practices." [spec §1.2, L36]
- "Async First: Designed for (potentially very) long-running tasks and human-in-the-loop interactions." [spec §1.2, L37]
- "Modality Agnostic: Support exchange of diverse content types including text, audio/video (via file references), structured data/forms, and potentially embedded UI components (e.g., iframes referenced in parts)." [spec §1.2, L38]
- "Opaque Execution: Agents collaborate based on declared capabilities and exchanged information, without needing to share their internal thoughts, plans, or tool implementations." [spec §1.2, L39]
- The introduction states the central promise: A2A lets agents securely exchange information "without needing access to each other's internal state, memory, or tools." [spec §1, L22]


## 2. Data model

The data model is the proto file. The tables below are generated mechanically from `a2a.proto` at the tag (field name, field number, type, presence annotation, proto comment, line range) and the JSON name is the lowerCamelCase conversion that §5.5 requires. Section 2.0 states the serialization rules first, then 2.1 to 2.7 give every message and enum, and 2.8 lists the RPC-to-message mapping and the names that do not exist at v1.0.1.

### 2.0 Serialization and presence rules that apply to every object

- JSON names: "All JSON serializations of the A2A protocol data model MUST use camelCase naming for field names, not the snake_case convention used in Protocol Buffer definitions." [spec §5.5, L1204]
- The spec's own examples of the conversion are `protocol_version` to `protocolVersion`, `context_id` to `contextId`, `default_input_modes` to `defaultInputModes` and `push_notification_config` to `pushNotificationConfig`. The last one is stale: no field named `push_notification_config` exists at v1.0.1 (the field is `task_push_notification_config`). [spec §5.5, L1208-L1211] [proto L149]
- Enum values: "Enum values MUST be represented according to the" ProtoJSON specification, "which serializes enums as their string names as defined in the Protocol Buffer definition (typically SCREAMING_SNAKE_CASE)". Examples given: `TASK_STATE_INPUT_REQUIRED` becomes the JSON string `"TASK_STATE_INPUT_REQUIRED"` and `ROLE_USER` becomes `"ROLE_USER"`. [spec §5.5, L1215] [spec §5.5, L1219-L1220]
- So the exact JSON spellings are the proto enum identifiers verbatim, including the `TASK_STATE_` and `ROLE_` prefixes and the `_UNSPECIFIED` zero values (see the enum tables below). The v0.3 spellings (`"completed"`, `"input-required"`, `"user"`, `"agent"`) are invalid in v1.0. [proto L187-L208] [proto L244-L252] [doc whats-new-v1.md, L745-L754]
- ADR-001 is the decision record behind this: "Breaking change: This decision will result in breaking changes to existing JSON payloads, specifically relating to the casing of enum values (ProtoJSON uses SCREAMING_SNAKE_CASE for enums)". [adr-001, L52] [spec §5.5, L1222]
- Polymorphic objects have no `kind` discriminator any more: "The member name acts as the discriminator, and the value structure depends on the specific type". The legacy `kind` field "is no longer part of the protocol and should not be emitted". This applies to `Part` (member `text`, `raw`, `url` or `data`) and to stream events (member `task`, `message`, `statusUpdate` or `artifactUpdate`). [spec §A.2.1, L3462] [spec §A.2.1, L3515]
- Binary data: `Part.raw` is `bytes` and "In JSON serialization, this is encoded as a base64 string." [proto L228-L229]
- Free-form data: `google.protobuf.Struct` fields (every `metadata`, `params`, `header`) are JSON objects. `Part.data` is `google.protobuf.Value`, "Arbitrary structured `data` as a JSON value (object, array, string, number, boolean, or null)". [proto L232-L233] [proto L235-L236]
- Metadata keys are strings and "values can be any valid value that can be represented in JSON"; extensions "can be used to strongly type metadata values". [spec §3.2.5, L475]
- Timestamps (`google.protobuf.Timestamp`) "MUST be represented as ISO 8601 formatted strings in UTC timezone". Pattern `YYYY-MM-DDTHH:mm:ss.sssZ`; "Millisecond precision SHOULD be used where available"; "Timestamps MUST NOT include timezone offsets other than 'Z' (all times are UTC)". [spec §5.6.1, L1230] [spec §5.6.1, L1236-L1237] [spec §5.6.1, L1255]
- The spec's own examples are looser than its pattern: `TaskStatus.timestamp` is documented with the example "2023-10-27T10:00:00Z" (no fractional part) and a streaming sample shows microseconds (`2025-04-17T17:47:09.680794Z`). Emit milliseconds, accept any fractional length. [proto L216-L218] [spec §6.8, L1803]
- Field presence: "Fields marked with `[(google.api.field_behavior) = REQUIRED]` indicate that the field MUST be present and set in valid messages." [spec §5.7, L1263]
- The proto `optional` keyword exists to distinguish "explicitly set" from "omitted". The spec names two uses: fields with non-implicit defaults, and Agent Card canonicalization for signatures. [spec §5.7, L1267-L1271]
- Unknown fields: "Implementations **SHOULD** ignore unrecognized fields in messages, allowing for forward compatibility". ADR-001 adds that ProtoJSON "doesn't support preserving unknown fields", so unknown values are not round-tripped. [spec §5.7, L1275] [adr-001, L53]
- Identifier formats: the proto comments say "(e.g. UUID)" for `Task.id`, `Task.context_id`, `Message.message_id`, `Artifact.artifact_id` and the push config `id`, but the format is not mandated. IDs are plain strings, not resource names: v1.0 made "All IDs are now simple literals" (no `tasks/{id}` compound names). [proto L168] [proto L261] [proto L281] [proto L474] [doc whats-new-v1.md, L187]
- Derived hazard (the first sentence is ProtoJSON behavior outside this spec and is not restated by it): a stock ProtoJSON serializer omits fields that hold their default value. The spec nevertheless requires some default-valued fields on the wire: "The `nextPageToken` field MUST always be present in the response" (empty string at the end of the list) and `REQUIRED` fields "MUST always be present, even if the field value matches the default" for Agent Card signing. Configure the serializer to always emit `REQUIRED` fields. [spec §3.1.4, L246] [spec §8.4.1, L2015]
- Derived hazard: §5.7 says arrays marked `REQUIRED` "MUST contain at least one element". Read literally this makes an empty `ListTasksResponse.tasks` or an Agent Card with `skills: []` invalid, yet the §8.4.1 canonicalization example keeps `"skills": []` as a REQUIRED field. The spec does not reconcile the two. [spec §5.7, L1263] [spec §8.4.1, L2050] [proto L704-L705]

### 2.1 Task, TaskState, TaskStatus

- Proto message `Task` comment: "`Task` is the core unit of action for A2A. It has a current status and when results are created for the task they are stored in the artifact. If there are multiple turns for a task, these are stored in history." [proto L163-L167]

| proto field (#) | JSON name | type | presence | meaning (proto comment) | cite |
|---|---|---|---|---|---|
| `id` (#1) | `id` | `string` | REQUIRED | Unique identifier (e.g. UUID) for the task, generated by the server for a new task. | [proto L168-L170] |
| `context_id` (#2) | `contextId` | `string` | not annotated REQUIRED | Unique identifier (e.g. UUID) for the contextual collection of interactions (tasks and messages). | [proto L171-L173] |
| `status` (#3) | `status` | `TaskStatus` | REQUIRED | The current status of a `Task`, including `state` and a `message`. | [proto L174-L175] |
| `artifacts` (#4) | `artifacts` | `repeated Artifact` | not annotated REQUIRED | A set of output artifacts for a `Task`. | [proto L176-L177] |
| `history` (#5) | `history` | `repeated Message` | not annotated REQUIRED | The history of interactions from a `Task`. | [proto L178-L180] |
| `metadata` (#6) | `metadata` | `google.protobuf.Struct` | not annotated REQUIRED | A key/value object to store custom metadata about a task. | [proto L181-L183] |

- `Task.id` is "generated by the server for a new task". The spec repeats this: "Task IDs are server-generated when a new task is created in response to a Message". [proto L168-L169] [spec §3.4.2, L610]
- `Task.context_id` carries no `REQUIRED` annotation, but `TaskStatusUpdateEvent.context_id` and `TaskArtifactUpdateEvent.context_id` do. Derived: any task that is streamed needs a `contextId` on every event, so a server that streams must always assign one. [proto L171-L173] [proto L299-L300] [proto L311-L312]
- `Task.history` holds `Message` objects; its length is capped by `historyLength` (section 3.2.4). The spec warns that "not all Messages are guaranteed to be persisted in the Task history" and that "The agent is responsible to determine which Messages are persisted in the Task History." [proto L178-L180] [spec §3.7, L760]
- In `ListTasks` responses the `artifacts` member "MUST be omitted entirely" unless `includeArtifacts` is true. [spec §3.1.4, L240]
- Constructed example of a minimal completed task (field names from the proto): `{"id": "task-1", "contextId": "ctx-1", "status": {"state": "TASK_STATE_COMPLETED"}}`. The spec's own version is the `task` member in its basic example. [proto L167-L184] [spec §6.1, L1336-L1345]

- Proto enum `TaskState` comment: "Defines the possible lifecycle states of a `Task`." [proto L186-L187]

| enum value (#) | JSON string | meaning (proto comment) | cite |
|---|---|---|---|
| `TASK_STATE_UNSPECIFIED` (#0) | `TASK_STATE_UNSPECIFIED` | The task is in an unknown or indeterminate state. | [proto L188-L189] |
| `TASK_STATE_SUBMITTED` (#1) | `TASK_STATE_SUBMITTED` | Indicates that a task has been successfully submitted and acknowledged. | [proto L190-L191] |
| `TASK_STATE_WORKING` (#2) | `TASK_STATE_WORKING` | Indicates that a task is actively being processed by the agent. | [proto L192-L193] |
| `TASK_STATE_COMPLETED` (#3) | `TASK_STATE_COMPLETED` | Indicates that a task has finished successfully. This is a terminal state. | [proto L194-L195] |
| `TASK_STATE_FAILED` (#4) | `TASK_STATE_FAILED` | Indicates that a task has finished with an error. This is a terminal state. | [proto L196-L197] |
| `TASK_STATE_CANCELED` (#5) | `TASK_STATE_CANCELED` | Indicates that a task was canceled before completion. This is a terminal state. | [proto L198-L199] |
| `TASK_STATE_INPUT_REQUIRED` (#6) | `TASK_STATE_INPUT_REQUIRED` | Indicates that the agent requires additional user input to proceed. This is an interrupted state. | [proto L200-L201] |
| `TASK_STATE_REJECTED` (#7) | `TASK_STATE_REJECTED` | Indicates that the agent has decided to not perform the task. This may be done during initial task creation or later once an agent has determined it can't or won't proceed. This is a terminal state. | [proto L202-L205] |
| `TASK_STATE_AUTH_REQUIRED` (#8) | `TASK_STATE_AUTH_REQUIRED` | Indicates that authentication is required to proceed. This is an interrupted state. | [proto L206-L207] |

- Terminal states: the proto marks COMPLETED, FAILED, CANCELED and REJECTED with "This is a terminal state." The prose lists the same four every time it says "terminal". [proto L194-L205] [spec §3.1.2, L210]
- Interrupted states: INPUT_REQUIRED and AUTH_REQUIRED are marked "This is an interrupted state." SUBMITTED and WORKING are neither terminal nor interrupted (the proto says nothing about them beyond their definitions). [proto L200-L201] [proto L206-L207] [proto L190-L193]
- Spelling is American: `CANCELED` with one L, per the 1.0.0 change “Standardize spelling of “canceled” to use American Spelling throughout” (the quotes around canceled are in the CHANGELOG line itself). [proto L198-L199] [changelog, L22]
- SPEC SILENT: whether a server may ever emit `TASK_STATE_UNSPECIFIED` ("unknown or indeterminate"), and what `ListTasksRequest.status = TASK_STATE_UNSPECIFIED` means (no filter is the natural reading). [proto L188-L189] [proto L681-L682]

- Proto message `TaskStatus` comment: "A container for the status of a task" [proto L210-L211]

| proto field (#) | JSON name | type | presence | meaning (proto comment) | cite |
|---|---|---|---|---|---|
| `state` (#1) | `state` | `TaskState` | REQUIRED | The current state of this task. | [proto L212-L213] |
| `message` (#2) | `message` | `Message` | not annotated REQUIRED | A message associated with the status. | [proto L214-L215] |
| `timestamp` (#3) | `timestamp` | `google.protobuf.Timestamp` | not annotated REQUIRED | ISO 8601 Timestamp when the status was recorded. Example: "2023-10-27T10:00:00Z" | [proto L216-L218] |

- `TaskStatus.message` is where an agent explains an interrupted state: "Status Messages: Agents attach Messages to status update events to inform clients about task progress, request additional input, or provide informational updates." [spec §3.7, L755]
- `TaskStatus.timestamp` is "ISO 8601 Timestamp when the status was recorded." It is also the sort key for `ListTasks`: "Implementations MUST return tasks sorted by their status timestamp time in descending order". [proto L216-L218] [spec §3.1.4, L262]

### 2.2 Message, Role, Part, Artifact

- Proto message `Message` comment: "`Message` is one unit of communication between client and server. It can be associated with a context and/or a task. For server messages, `context_id` must be provided, and `task_id` only if a task was created. For client messages, both fields are optional, with the caveat that if both are provided, they have to match (the `context_id` has to be the one that is set on the task). If only `task_id` is provided, the server will infer `context_id` from it." [proto L254-L260]

| proto field (#) | JSON name | type | presence | meaning (proto comment) | cite |
|---|---|---|---|---|---|
| `message_id` (#1) | `messageId` | `string` | REQUIRED | The unique identifier (e.g. UUID) of the message. This is created by the message creator. | [proto L261-L262] |
| `context_id` (#2) | `contextId` | `string` | not annotated REQUIRED | Optional. The context id of the message. If set, the message will be associated with the given context. | [proto L263-L264] |
| `task_id` (#3) | `taskId` | `string` | not annotated REQUIRED | Optional. The task id of the message. If set, the message will be associated with the given task. | [proto L265-L266] |
| `role` (#4) | `role` | `Role` | REQUIRED | Identifies the sender of the message. | [proto L267-L268] |
| `parts` (#5) | `parts` | `repeated Part` | REQUIRED | Parts is the container of the message content. | [proto L269-L270] |
| `metadata` (#6) | `metadata` | `google.protobuf.Struct` | not annotated REQUIRED | Optional. Any metadata to provide along with the message. | [proto L271-L272] |
| `extensions` (#7) | `extensions` | `repeated string` | not annotated REQUIRED | The URIs of extensions that are present or contributed to this Message. | [proto L273-L274] |
| `reference_task_ids` (#8) | `referenceTaskIds` | `repeated string` | not annotated REQUIRED | A list of task IDs that this message references for additional context. | [proto L275-L276] |

- Who sets which id (the proto comment on `Message` is the rule): "For server messages, `context_id` must be provided, and `task_id` only if a task was created. For client messages, both fields are optional, with the caveat that if both are provided, they have to match (the `context_id` has to be the one that is set on the task). If only `task_id` is provided, the server will infer `context_id` from it." [proto L254-L259]
- `messageId` is REQUIRED and is "created by the message creator", so (derived) a client generates the id for its own messages and an agent generates the id for its own messages. §3.3.1 lets agents use `messageId` "to detect duplicate messages". [proto L261-L262] [spec §3.3.1, L495]
- `parts` is REQUIRED and, per §5.7, must hold at least one element. [proto L269-L270] [spec §5.7, L1263]
- `extensions` lists extension URIs "present or contributed to this Message"; `referenceTaskIds` lists "task IDs that this message references for additional context". [proto L273-L276]
- Messages carry conversation, not deliverables: "Messages SHOULD NOT be used to deliver task outputs. Results SHOULD BE returned using Artifacts associated with a Task." [spec §3.7, L758]
- Roles of a Message in the protocol: task initiation, clarification, status messages, task interaction (four bullets in §3.7). [spec §3.7, L751-L756]

- Proto enum `Role` comment: "Defines the sender of a message in A2A protocol communication." [proto L244-L245]

| enum value (#) | JSON string | meaning (proto comment) | cite |
|---|---|---|---|
| `ROLE_UNSPECIFIED` (#0) | `ROLE_UNSPECIFIED` | The role is unspecified. | [proto L246-L247] |
| `ROLE_USER` (#1) | `ROLE_USER` | The message is from the client to the server. | [proto L248-L249] |
| `ROLE_AGENT` (#2) | `ROLE_AGENT` | The message is from the server to the client. | [proto L250-L251] |

- Direction semantics: `ROLE_USER` is "from the client to the server" and `ROLE_AGENT` is "from the server to the client", independent of whether the client is a human or another agent. [proto L248-L251]

- Proto message `Part` comment: "`Part` represents a container for a section of communication content. Parts can be purely textual, some sort of file (image, video, etc) or a structured data blob (i.e. JSON)." [proto L221-L224]

| proto field (#) | JSON name | type | presence | meaning (proto comment) | cite |
|---|---|---|---|---|---|
| `text` (#1) | `text` | `string` | oneof `content` member | The string content of the `text` part. | [proto L226-L227] |
| `raw` (#2) | `raw` | `bytes` | oneof `content` member | The `raw` byte content of a file. In JSON serialization, this is encoded as a base64 string. | [proto L228-L229] |
| `url` (#3) | `url` | `string` | oneof `content` member | A `url` pointing to the file's content. | [proto L230-L231] |
| `data` (#4) | `data` | `google.protobuf.Value` | oneof `content` member | Arbitrary structured `data` as a JSON value (object, array, string, number, boolean, or null). | [proto L232-L233] |
| `metadata` (#5) | `metadata` | `google.protobuf.Struct` | not annotated REQUIRED | Optional. metadata associated with this part. | [proto L235-L236] |
| `filename` (#6) | `filename` | `string` | not annotated REQUIRED | An optional `filename` for the file (e.g., "document.pdf"). | [proto L237-L238] |
| `media_type` (#7) | `mediaType` | `string` | not annotated REQUIRED | The `media_type` (MIME type) of the part content (e.g., "text/plain", "application/json", "image/png"). This field is available for all part types. | [proto L239-L241] |

- A `Part` carries exactly one content member. The macro-generated note in the built spec says "MUST contain exactly one of the following" (`text`, `raw`, `url`, `data`), and the Core Concepts guide says the same: "A Part must contain exactly one of the following content fields". [macros, L112-L120] [doc topics/key-concepts.md, L70]
- Which member is present is the type discriminator. Appendix A shows the current JSON: a text part is `{ "text": "Hello, world!" }`, a file part is `{ "raw": "iVBORw0KGgo...", "filename": "diagram.png", "mediaType": "image/png" }` "(or `url` instead of `raw`)", and a data part is `{ "data": {...}, "mediaType": "application/json" }`. [spec §A.2.1, L3464-L3480] [spec §A.2.1, L3490-L3493]
- `mediaType`, `filename` and `metadata` are siblings of the content member and "This field is available for all part types." None of them is annotated REQUIRED. SPEC SILENT on a default `mediaType` for a text part. [proto L239-L241] [proto L235-L238]
- File content is sent inline (`raw`, base64 in JSON) or by reference (`url`). The spec's SSRF warning about file references is in §14.1.1: "File references within A2A messages MUST be validated to prevent server-side request forgery (SSRF)". [proto L228-L231] [spec §14.1.1, L3245]
- The spec's structured-data example puts a JSON Schema into the part `metadata` (`"mediaType": "application/json"`, `"schema": {...}`) and returns the JSON as a serialized string inside a `text` part. These keys are examples, not defined protocol fields. [spec §6.8, L1769-L1784] [spec §6.8, L1810]

- Proto message `Artifact` comment: "Artifacts represent task outputs." [proto L279-L280]

| proto field (#) | JSON name | type | presence | meaning (proto comment) | cite |
|---|---|---|---|---|---|
| `artifact_id` (#1) | `artifactId` | `string` | REQUIRED | Unique identifier (e.g. UUID) for the artifact. It must be unique within a task. | [proto L281-L282] |
| `name` (#2) | `name` | `string` | not annotated REQUIRED | A human readable name for the artifact. | [proto L283-L284] |
| `description` (#3) | `description` | `string` | not annotated REQUIRED | Optional. A human readable description of the artifact. | [proto L285-L286] |
| `parts` (#4) | `parts` | `repeated Part` | REQUIRED | The content of the artifact. Must contain at least one part. | [proto L287-L288] |
| `metadata` (#5) | `metadata` | `google.protobuf.Struct` | not annotated REQUIRED | Optional. Metadata included with the artifact. | [proto L289-L290] |
| `extensions` (#6) | `extensions` | `repeated string` | not annotated REQUIRED | The URIs of extensions that are present or contributed to this Artifact. | [proto L291-L292] |

- `artifactId` "must be unique within a task", which matters for streaming because `append` chunks are matched by artifact id (section 5). [proto L281-L282] [proto L315-L317]
- An artifact "Must contain at least one part." and its `extensions` list is parallel to `Message.extensions`. [proto L287-L288] [proto L291-L292]

### 2.3 Streaming event objects

- Proto message `TaskStatusUpdateEvent` comment: "An event sent by the agent to notify the client of a change in a task's status." [proto L295-L296]

| proto field (#) | JSON name | type | presence | meaning (proto comment) | cite |
|---|---|---|---|---|---|
| `task_id` (#1) | `taskId` | `string` | REQUIRED | The ID of the task that has changed. | [proto L297-L298] |
| `context_id` (#2) | `contextId` | `string` | REQUIRED | The ID of the context that the task belongs to. | [proto L299-L300] |
| `status` (#3) | `status` | `TaskStatus` | REQUIRED | The new status of the task. | [proto L301-L302] |
| `metadata` (#4) | `metadata` | `google.protobuf.Struct` | not annotated REQUIRED | Optional. Metadata associated with the task update. | [proto L303-L304] |

- v1.0 removed the `final` boolean that v0.3 used to mark the last event. The migration guide says "`final` boolean field removed from TaskStatusUpdateEvent. Leverage protocol binding specific stream closure mechanism instead." [changelog, L24] [doc whats-new-v1.md, L72]
- Derived: all three of `taskId`, `contextId` and `status` are REQUIRED, so a status event cannot be sent for a task whose context id is unknown. [proto L297-L302]

- Proto message `TaskArtifactUpdateEvent` comment: "A task delta where an artifact has been generated." [proto L307-L308]

| proto field (#) | JSON name | type | presence | meaning (proto comment) | cite |
|---|---|---|---|---|---|
| `task_id` (#1) | `taskId` | `string` | REQUIRED | The ID of the task for this artifact. | [proto L309-L310] |
| `context_id` (#2) | `contextId` | `string` | REQUIRED | The ID of the context that this task belongs to. | [proto L311-L312] |
| `artifact` (#3) | `artifact` | `Artifact` | REQUIRED | The artifact that was generated or updated. | [proto L313-L314] |
| `append` (#4) | `append` | `bool` | not annotated REQUIRED | If true, the content of this artifact should be appended to a previously sent artifact with the same ID. | [proto L315-L317] |
| `last_chunk` (#5) | `lastChunk` | `bool` | not annotated REQUIRED | If true, this is the final chunk of the artifact. | [proto L318-L319] |
| `metadata` (#6) | `metadata` | `google.protobuf.Struct` | not annotated REQUIRED | Optional. Metadata associated with the artifact update. | [proto L320-L321] |

- Chunking contract in the proto is only two sentences: `append` is "If true, the content of this artifact should be appended to a previously sent artifact with the same ID." and `lastChunk` is "If true, this is the final chunk of the artifact." SPEC SILENT on first-chunk behavior, on what `append: false` replaces, and on ordering of `parts` inside appended chunks. [proto L315-L319]
- The migration guide mentions an `index` field on `TaskArtifactUpdateEvent`. It does not exist in the proto at v1.0.1, so do not emit it. [doc whats-new-v1.md, L504] [proto L307-L322]

- Proto message `StreamResponse` comment: "A wrapper object used in streaming operations to encapsulate different types of response data." [proto L789-L790]

| proto field (#) | JSON name | type | presence | meaning (proto comment) | cite |
|---|---|---|---|---|---|
| `task` (#1) | `task` | `Task` | oneof `payload` member | A Task object containing the current state of the task. | [proto L793-L794] |
| `message` (#2) | `message` | `Message` | oneof `payload` member | A Message object containing a message from the agent. | [proto L795-L796] |
| `status_update` (#3) | `statusUpdate` | `TaskStatusUpdateEvent` | oneof `payload` member | An event indicating a task status update. | [proto L797-L798] |
| `artifact_update` (#4) | `artifactUpdate` | `TaskArtifactUpdateEvent` | oneof `payload` member | An event indicating a task artifact update. | [proto L799-L800] |

- JSON shape: a `StreamResponse` is an object with exactly one member. The push-notification section spells it out: the webhook payload is a `StreamResponse` "object containing exactly one of the following": `task`, `message`, `statusUpdate`, `artifactUpdate`. [spec §4.3.3, L864-L869] [proto L789-L802]
- Wrapper member names come from the proto field names: `status_update` becomes `statusUpdate` and `artifact_update` becomes `artifactUpdate`. The v1.0.1 migration guide shows `taskStatusUpdate` and `taskArtifactUpdate` as the v1.0 wrapper names, which is wrong. [proto L797-L800] [doc whats-new-v1.md, L459] [doc whats-new-v1.md, L491]

### 2.4 Push notification objects

- Proto message `AuthenticationInfo` comment: "Defines authentication details, used for push notifications." [proto L324-L325]

| proto field (#) | JSON name | type | presence | meaning (proto comment) | cite |
|---|---|---|---|---|---|
| `scheme` (#1) | `scheme` | `string` | REQUIRED | HTTP Authentication Scheme from the [IANA registry](https://www.iana.org/assignments/http-authschemes/). Examples: `Bearer`, `Basic`, `Digest`. Scheme names are case-insensitive per [RFC 9110 Section 11.1](https://www.rfc-editor.org/rfc/rfc9110#section-11.1). | [proto L326-L329] |
| `credentials` (#2) | `credentials` | `string` | not annotated REQUIRED | Push Notification credentials. Format depends on the scheme (e.g., token for Bearer). | [proto L330-L331] |

- `AuthenticationInfo` is only used for push notification delivery: "Defines authentication details, used for push notifications." The scheme is matched case-insensitively. [proto L324-L329]

- Proto message `TaskPushNotificationConfig` comment: "A container associating a push notification configuration with a specific task." [proto L468-L469]

| proto field (#) | JSON name | type | presence | meaning (proto comment) | cite |
|---|---|---|---|---|---|
| `tenant` (#1) | `tenant` | `string` | not annotated REQUIRED | Optional. Opaque routing identifier. Must match the `tenant` value from the selected `AgentInterface` in the Agent Card when that field is set. | [proto L470-L472] |
| `id` (#2) | `id` | `string` | not annotated REQUIRED | The push notification configuration details. A unique identifier (e.g. UUID) for this push notification configuration. | [proto L473-L475] |
| `task_id` (#3) | `taskId` | `string` | not annotated REQUIRED | The ID of the task this configuration is associated with. | [proto L476-L477] |
| `url` (#4) | `url` | `string` | REQUIRED | The URL where the notification should be sent. | [proto L478-L479] |
| `token` (#5) | `token` | `string` | not annotated REQUIRED | A token unique for this task or session. | [proto L480-L481] |
| `authentication` (#6) | `authentication` | `AuthenticationInfo` | not annotated REQUIRED | Authentication information required to send the notification. | [proto L482-L483] |

- At v1.0.1 there is one push-configuration message, `TaskPushNotificationConfig`. It is both the request body for create and the stored resource. The standalone `PushNotificationConfig` named in prose §3.1.7, §3.1.8, §4.3.1, §13.2 and the gRPC section does not exist in the proto. [proto L90] [proto L468-L484] [spec §4.3.1, L832-L834] [changelog, L17]
- The `id` field's proto comment is garbled (two comments fused: "The push notification configuration details. A unique identifier (e.g. UUID) for this push notification configuration."). Read it as: `id` is the configuration's own identifier. §3.1.7 says the created configuration comes back "with assigned ID", so the server assigns the id. SPEC SILENT on whether a client-supplied `id` is honored on create. [proto L473-L475] [spec §3.1.7, L326]
- `token` is "A token unique for this task or session." SPEC SILENT on how the token is delivered to the webhook (no header name or body field is defined). Only `authentication` has a delivery rule (section 6). [proto L480-L481] [spec §4.3.3, L871-L873]

### 2.5 Agent Card objects

- Proto message `AgentCard` comment: "A self-describing manifest for an agent. It provides essential metadata including the agent's identity, capabilities, skills, supported communication methods, and security requirements." [proto L357-L361]

| proto field (#) | JSON name | type | presence | meaning (proto comment) | cite |
|---|---|---|---|---|---|
| `name` (#1) | `name` | `string` | REQUIRED | A human readable name for the agent. Example: "Recipe Agent" | [proto L362-L364] |
| `description` (#2) | `description` | `string` | REQUIRED | A human-readable description of the agent, assisting users and other agents in understanding its purpose. Example: "Agent that helps users with recipes and cooking." | [proto L365-L368] |
| `supported_interfaces` (#3) | `supportedInterfaces` | `repeated AgentInterface` | REQUIRED | Ordered list of supported interfaces. The first entry is preferred. | [proto L369-L370] |
| `provider` (#4) | `provider` | `AgentProvider` | not annotated REQUIRED | The service provider of the agent. | [proto L371-L372] |
| `version` (#5) | `version` | `string` | REQUIRED | The version of the agent. Example: "1.0.0" | [proto L373-L375] |
| `documentation_url` (#6) | `documentationUrl` | `string` | optional (explicit presence) | A URL providing additional documentation about the agent. | [proto L376-L377] |
| `capabilities` (#7) | `capabilities` | `AgentCapabilities` | REQUIRED | A2A Capability set supported by the agent. | [proto L378-L379] |
| `security_schemes` (#8) | `securitySchemes` | `map<string, SecurityScheme>` | not annotated REQUIRED | The security scheme details used for authenticating with this agent. | [proto L380-L381] |
| `security_requirements` (#9) | `securityRequirements` | `repeated SecurityRequirement` | not annotated REQUIRED | Security requirements for contacting the agent. | [proto L382-L383] |
| `default_input_modes` (#10) | `defaultInputModes` | `repeated string` | REQUIRED | The set of interaction modes that the agent supports across all skills. This can be overridden per skill. Defined as media types. | [proto L384-L387] |
| `default_output_modes` (#11) | `defaultOutputModes` | `repeated string` | REQUIRED | The media types supported as outputs from this agent. | [proto L388-L389] |
| `skills` (#12) | `skills` | `repeated AgentSkill` | REQUIRED | Skills represent the abilities of an agent. It is largely a descriptive concept but represents a more focused set of behaviors that the agent is likely to succeed at. | [proto L390-L393] |
| `signatures` (#13) | `signatures` | `repeated AgentCardSignature` | not annotated REQUIRED | JSON Web Signatures computed for this `AgentCard`. | [proto L394-L395] |
| `icon_url` (#14) | `iconUrl` | `string` | optional (explicit presence) | Optional. A URL to an icon for the agent. | [proto L396-L397] |

- Required members: `name`, `description`, `supportedInterfaces`, `version`, `capabilities`, `defaultInputModes`, `defaultOutputModes`, `skills`. Everything else (`provider`, `documentationUrl`, `securitySchemes`, `securityRequirements`, `signatures`, `iconUrl`) is optional. [proto L362-L397]
- `documentationUrl` and `iconUrl` are proto `optional`, so for card signing fields "that were not explicitly set MUST be omitted from the JSON object". [proto L376-L377] [proto L396-L397] [spec §8.4.1, L2013]
- The security fields on the card are named `securitySchemes` and `securityRequirements`. The prose and its sample use the old name `security` in several places, and the sample puts the old OpenAPI-style array shape under it. [proto L380-L383] [spec §8.5, L2166] [spec §13.3, L3143]
- Constructed minimal card (every REQUIRED member present, field names from the proto, not a spec example): [proto L357-L398]

```json
{
  "name": "Recipe Agent",
  "description": "Agent that helps users with recipes and cooking.",
  "supportedInterfaces": [
    {"url": "https://agent.example.com/a2a", "protocolBinding": "JSONRPC", "protocolVersion": "1.0"}
  ],
  "version": "1.0.0",
  "capabilities": {"streaming": true, "pushNotifications": false},
  "defaultInputModes": ["text/plain"],
  "defaultOutputModes": ["text/plain"],
  "skills": [
    {"id": "recipes", "name": "Recipe search", "description": "Finds recipes.", "tags": ["cooking"]}
  ]
}
```

- Proto message `AgentInterface` comment: "Declares a combination of a target URL, transport and protocol version for interacting with the agent. This allows agents to expose the same functionality over multiple protocol binding mechanisms." [proto L334-L336]

| proto field (#) | JSON name | type | presence | meaning (proto comment) | cite |
|---|---|---|---|---|---|
| `url` (#1) | `url` | `string` | REQUIRED | The URL where this interface is available. Must be a valid absolute HTTPS URL in production. Example: "https://api.example.com/a2a/v1", "https://grpc.example.com/a2a" | [proto L337-L339] |
| `protocol_binding` (#2) | `protocolBinding` | `string` | REQUIRED | The protocol binding supported at this URL. This is an open form string, to be easily extended for other protocol bindings. The core ones officially supported are `JSONRPC`, `GRPC` and `HTTP+JSON`. | [proto L340-L343] |
| `tenant` (#3) | `tenant` | `string` | not annotated REQUIRED | Optional. An opaque string used for routing requests to a specific agent or tenant when multiple agents are served behind a single A2A endpoint. When set, clients MUST include this value in the `tenant` field of all request messages sent to this interface. The server is responsible for interpreting the value and routing requests accordingly; the protocol does not define its format or semantics. | [proto L344-L350] |
| `protocol_version` (#4) | `protocolVersion` | `string` | REQUIRED | The version of the A2A protocol this interface exposes. Use the latest supported minor version per major version. Examples: "0.3", "1.0" | [proto L351-L354] |

- The `protocolBinding` strings the spec names are `JSONRPC`, `GRPC` and `HTTP+JSON`; the field is "an open form string", so a custom binding uses a URI (section 8.3). [proto L340-L343] [spec §5.8, L1279-L1283]
- `url` "Must be a valid absolute HTTPS URL in production." The only gRPC example in the comment is `https://grpc.example.com/a2a`, a URL form, and the spec gives no separate rule for a gRPC dial target (`host:port`); main rewrites the comment to cover it (section 14). [proto L337-L339]

- Proto message `AgentProvider` comment: "Represents the service provider of an agent." [proto L400-L401]

| proto field (#) | JSON name | type | presence | meaning (proto comment) | cite |
|---|---|---|---|---|---|
| `url` (#1) | `url` | `string` | REQUIRED | A URL for the agent provider's website or relevant documentation. Example: "https://ai.google.dev" | [proto L402-L404] |
| `organization` (#2) | `organization` | `string` | REQUIRED | The name of the agent provider's organization. Example: "Google" | [proto L405-L407] |

- Proto message `AgentCapabilities` comment: "Defines optional capabilities supported by an agent." [proto L410-L411]

| proto field (#) | JSON name | type | presence | meaning (proto comment) | cite |
|---|---|---|---|---|---|
| `streaming` (#1) | `streaming` | `bool` | optional (explicit presence) | Indicates if the agent supports streaming responses. | [proto L412-L413] |
| `push_notifications` (#2) | `pushNotifications` | `bool` | optional (explicit presence) | Indicates if the agent supports sending push notifications for asynchronous task updates. | [proto L414-L415] |
| `extensions` (#3) | `extensions` | `repeated AgentExtension` | not annotated REQUIRED | A list of protocol extensions supported by the agent. | [proto L416-L417] |
| `extended_agent_card` (#4) | `extendedAgentCard` | `bool` | optional (explicit presence) | Indicates if the agent supports providing an extended agent card when authenticated. | [proto L418-L419] |

- All three booleans are proto `optional`: absent and `false` are distinguishable on the wire, but the capability checks in §3.3.4 treat "`false` or not present" identically. [proto L411-L419] [spec §3.3.4, L573-L575]
- `extendedAgentCard` moved here in v1.0 from a top-level `supportsAuthenticatedExtendedCard` field. Appendix A.2.2 says the new proto field number is 5, but the proto assigns it field number 4, and old field 13 is now `signatures`. The proto is normative. [proto L418-L419] [spec §A.2.2, L3555-L3558]

- Proto message `AgentExtension` comment: "A declaration of a protocol extension supported by an Agent." [proto L422-L423]

| proto field (#) | JSON name | type | presence | meaning (proto comment) | cite |
|---|---|---|---|---|---|
| `uri` (#1) | `uri` | `string` | not annotated REQUIRED | The unique URI identifying the extension. | [proto L424-L425] |
| `description` (#2) | `description` | `string` | not annotated REQUIRED | A human-readable description of how this agent uses the extension. | [proto L426-L427] |
| `required` (#3) | `required` | `bool` | not annotated REQUIRED | If true, the client must understand and comply with the extension's requirements. | [proto L428-L429] |
| `params` (#4) | `params` | `google.protobuf.Struct` | not annotated REQUIRED | Optional. Extension-specific configuration parameters. | [proto L430-L431] |

- No `AgentExtension` field is annotated REQUIRED, including `uri`. The `required` boolean means "the client must understand and comply with the extension's requirements" (section 11). [proto L423-L432]

- Proto message `AgentSkill` comment: "Represents a distinct capability or function that an agent can perform." [proto L434-L435]

| proto field (#) | JSON name | type | presence | meaning (proto comment) | cite |
|---|---|---|---|---|---|
| `id` (#1) | `id` | `string` | REQUIRED | A unique identifier for the agent's skill. | [proto L436-L437] |
| `name` (#2) | `name` | `string` | REQUIRED | A human-readable name for the skill. | [proto L438-L439] |
| `description` (#3) | `description` | `string` | REQUIRED | A detailed description of the skill. | [proto L440-L441] |
| `tags` (#4) | `tags` | `repeated string` | REQUIRED | A set of keywords describing the skill's capabilities. | [proto L442-L443] |
| `examples` (#5) | `examples` | `repeated string` | not annotated REQUIRED | Example prompts or scenarios that this skill can handle. | [proto L444-L445] |
| `input_modes` (#6) | `inputModes` | `repeated string` | not annotated REQUIRED | The set of supported input media types for this skill, overriding the agent's defaults. | [proto L446-L447] |
| `output_modes` (#7) | `outputModes` | `repeated string` | not annotated REQUIRED | The set of supported output media types for this skill, overriding the agent's defaults. | [proto L448-L449] |
| `security_requirements` (#8) | `securityRequirements` | `repeated SecurityRequirement` | not annotated REQUIRED | Security schemes necessary for this skill. | [proto L450-L451] |

- `skills` entries need `id`, `name`, `description` and a non-empty `tags` list. `examples`, per-skill `inputModes`/`outputModes` (override the card defaults) and per-skill `securityRequirements` are optional. [proto L436-L451]

- Proto message `AgentCardSignature` comment: "AgentCardSignature represents a JWS signature of an AgentCard. This follows the JSON format of an RFC 7515 JSON Web Signature (JWS)." [proto L454-L456]

| proto field (#) | JSON name | type | presence | meaning (proto comment) | cite |
|---|---|---|---|---|---|
| `protected` (#1) | `protected` | `string` | REQUIRED | Required. The protected JWS header for the signature. This is always a base64url-encoded JSON object. | [proto L457-L461] |
| `signature` (#2) | `signature` | `string` | REQUIRED | Required. The computed signature, base64url-encoded. | [proto L462-L463] |
| `header` (#3) | `header` | `google.protobuf.Struct` | not annotated REQUIRED | The unprotected JWS header values. | [proto L464-L465] |

- This is the JWS JSON serialization split into three members: `protected` (base64url of the protected header), `signature` (base64url) and the optional unprotected `header`. The payload is not carried inside the signature object (it is the canonicalized card itself; see section 8.4). [proto L454-L466] [spec §8.4.2, L2060-L2064]

### 2.6 Security objects

- Proto message `SecurityScheme` comment: "Defines a security scheme that can be used to secure an agent's endpoints. This is a discriminated union type based on the OpenAPI 3.2 Security Scheme Object. See: https://spec.openapis.org/oas/v3.2.0.html#security-scheme-object" [proto L500-L503]

| proto field (#) | JSON name | type | presence | meaning (proto comment) | cite |
|---|---|---|---|---|---|
| `api_key_security_scheme` (#1) | `apiKeySecurityScheme` | `APIKeySecurityScheme` | oneof `scheme` member | API key-based authentication. | [proto L505-L506] |
| `http_auth_security_scheme` (#2) | `httpAuthSecurityScheme` | `HTTPAuthSecurityScheme` | oneof `scheme` member | HTTP authentication (Basic, Bearer, etc.). | [proto L507-L508] |
| `oauth2_security_scheme` (#3) | `oauth2SecurityScheme` | `OAuth2SecurityScheme` | oneof `scheme` member | OAuth 2.0 authentication. | [proto L509-L510] |
| `open_id_connect_security_scheme` (#4) | `openIdConnectSecurityScheme` | `OpenIdConnectSecurityScheme` | oneof `scheme` member | OpenID Connect authentication. | [proto L511-L512] |
| `mtls_security_scheme` (#5) | `mtlsSecurityScheme` | `MutualTlsSecurityScheme` | oneof `scheme` member | Mutual TLS authentication. | [proto L513-L514] |

- JSON shape: a security scheme is an object with exactly one member naming the variant, for example `{"openIdConnectSecurityScheme": {"openIdConnectUrl": "https://accounts.google.com/.well-known/openid-configuration"}}`. This is the shape the spec's sample card uses. [spec §8.5, L2159-L2165] [proto L503-L516]
- The scheme is "a discriminated union type based on the OpenAPI 3.2 Security Scheme Object." [proto L500-L502]

- Proto message `SecurityRequirement` comment: "Defines the security requirements for an agent." [proto L494-L495]

| proto field (#) | JSON name | type | presence | meaning (proto comment) | cite |
|---|---|---|---|---|---|
| `schemes` (#1) | `schemes` | `map<string, StringList>` | not annotated REQUIRED | A map of security schemes to the required scopes. | [proto L496-L497] |

- Proto message `StringList` comment: "A list of strings." [proto L486-L488]

| proto field (#) | JSON name | type | presence | meaning (proto comment) | cite |
|---|---|---|---|---|---|
| `list` (#1) | `list` | `repeated string` | not annotated REQUIRED | The individual string values. | [proto L489-L490] |

- Derived JSON shape of a requirement, from `map<string, StringList>` and `StringList.list`: `{"schemes": {"google": {"list": ["openid", "profile", "email"]}}}`, and `securityRequirements` is an array of those. The corrected sample on main uses exactly this shape; the v1.0.1 sample (`"security": [{ "google": [...] }]`) is wrong. [proto L488-L498] [main spec §8.5, L2176]

- Proto message `APIKeySecurityScheme` comment: "Defines a security scheme using an API key." [proto L518-L519]

| proto field (#) | JSON name | type | presence | meaning (proto comment) | cite |
|---|---|---|---|---|---|
| `description` (#1) | `description` | `string` | not annotated REQUIRED | An optional description for the security scheme. | [proto L520-L521] |
| `location` (#2) | `location` | `string` | REQUIRED | The location of the API key. Valid values are "query", "header", or "cookie". | [proto L522-L523] |
| `name` (#3) | `name` | `string` | REQUIRED | The name of the header, query, or cookie parameter to be used. | [proto L524-L525] |

- Proto message `HTTPAuthSecurityScheme` comment: "Defines a security scheme using HTTP authentication." [proto L528-L529]

| proto field (#) | JSON name | type | presence | meaning (proto comment) | cite |
|---|---|---|---|---|---|
| `description` (#1) | `description` | `string` | not annotated REQUIRED | An optional description for the security scheme. | [proto L530-L531] |
| `scheme` (#2) | `scheme` | `string` | REQUIRED | The name of the HTTP Authentication scheme to be used in the Authorization header, as defined in RFC7235 (e.g., "Bearer"). This value should be registered in the IANA Authentication Scheme registry. | [proto L532-L535] |
| `bearer_format` (#3) | `bearerFormat` | `string` | not annotated REQUIRED | A hint to the client to identify how the bearer token is formatted (e.g., "JWT"). Primarily for documentation purposes. | [proto L536-L538] |

- Proto message `OAuth2SecurityScheme` comment: "Defines a security scheme using OAuth 2.0." [proto L541-L542]

| proto field (#) | JSON name | type | presence | meaning (proto comment) | cite |
|---|---|---|---|---|---|
| `description` (#1) | `description` | `string` | not annotated REQUIRED | An optional description for the security scheme. | [proto L543-L544] |
| `flows` (#2) | `flows` | `OAuthFlows` | REQUIRED | An object containing configuration information for the supported OAuth 2.0 flows. | [proto L545-L546] |
| `oauth2_metadata_url` (#3) | `oauth2MetadataUrl` | `string` | not annotated REQUIRED | URL to the OAuth2 authorization server metadata [RFC 8414](https://datatracker.ietf.org/doc/html/rfc8414). TLS is required. | [proto L547-L549] |

- Proto message `OpenIdConnectSecurityScheme` comment: "Defines a security scheme using OpenID Connect." [proto L552-L553]

| proto field (#) | JSON name | type | presence | meaning (proto comment) | cite |
|---|---|---|---|---|---|
| `description` (#1) | `description` | `string` | not annotated REQUIRED | An optional description for the security scheme. | [proto L554-L555] |
| `open_id_connect_url` (#2) | `openIdConnectUrl` | `string` | REQUIRED | The [OpenID Connect Discovery URL](https://openid.net/specs/openid-connect-discovery-1_0.html) for the OIDC provider's metadata. | [proto L556-L557] |

- Proto message `MutualTlsSecurityScheme` comment: "Defines a security scheme using mTLS authentication." [proto L560-L561]

| proto field (#) | JSON name | type | presence | meaning (proto comment) | cite |
|---|---|---|---|---|---|
| `description` (#1) | `description` | `string` | not annotated REQUIRED | An optional description for the security scheme. | [proto L562-L563] |

- Proto message `OAuthFlows` comment: "Defines the configuration for the supported OAuth 2.0 flows." [proto L566-L567]

| proto field (#) | JSON name | type | presence | meaning (proto comment) | cite |
|---|---|---|---|---|---|
| `authorization_code` (#1) | `authorizationCode` | `AuthorizationCodeOAuthFlow` | oneof `flow` member | Configuration for the OAuth Authorization Code flow. | [proto L569-L570] |
| `client_credentials` (#2) | `clientCredentials` | `ClientCredentialsOAuthFlow` | oneof `flow` member | Configuration for the OAuth Client Credentials flow. | [proto L571-L572] |
| `implicit` (#3) | `implicit` | `ImplicitOAuthFlow` | oneof `flow` member (deprecated) | Deprecated: Use Authorization Code + PKCE instead. | [proto L573-L574] |
| `password` (#4) | `password` | `PasswordOAuthFlow` | oneof `flow` member (deprecated) | Deprecated: Use Authorization Code + PKCE or Device Code. | [proto L575-L576] |
| `device_code` (#5) | `deviceCode` | `DeviceCodeOAuthFlow` | oneof `flow` member | Configuration for the OAuth Device Code flow. | [proto L577-L578] |

- `ImplicitOAuthFlow` and `PasswordOAuthFlow` still exist in the v1.0.1 proto, marked `deprecated = true` ("Deprecated: Use Authorization Code + PKCE instead." and "Deprecated: Use Authorization Code + PKCE or Device Code."). The migration guide says they were "Removed"; the proto, which is normative, keeps them. Do not offer them in new cards. [proto L573-L576] [proto L607-L631] [doc whats-new-v1.md, L510-L513]

- Proto message `AuthorizationCodeOAuthFlow` comment: "Defines configuration details for the OAuth 2.0 Authorization Code flow." [proto L582-L583]

| proto field (#) | JSON name | type | presence | meaning (proto comment) | cite |
|---|---|---|---|---|---|
| `authorization_url` (#1) | `authorizationUrl` | `string` | REQUIRED | The authorization URL to be used for this flow. | [proto L584-L585] |
| `token_url` (#2) | `tokenUrl` | `string` | REQUIRED | The token URL to be used for this flow. | [proto L586-L587] |
| `refresh_url` (#3) | `refreshUrl` | `string` | not annotated REQUIRED | The URL to be used for obtaining refresh tokens. | [proto L588-L589] |
| `scopes` (#4) | `scopes` | `map<string, string>` | REQUIRED | The available scopes for the OAuth2 security scheme. | [proto L590-L591] |
| `pkce_required` (#5) | `pkceRequired` | `bool` | not annotated REQUIRED | Indicates if PKCE (RFC 7636) is required for this flow. PKCE should always be used for public clients and is recommended for all clients. | [proto L592-L594] |

- Proto message `ClientCredentialsOAuthFlow` comment: "Defines configuration details for the OAuth 2.0 Client Credentials flow." [proto L597-L598]

| proto field (#) | JSON name | type | presence | meaning (proto comment) | cite |
|---|---|---|---|---|---|
| `token_url` (#1) | `tokenUrl` | `string` | REQUIRED | The token URL to be used for this flow. | [proto L599-L600] |
| `refresh_url` (#2) | `refreshUrl` | `string` | not annotated REQUIRED | The URL to be used for obtaining refresh tokens. | [proto L601-L602] |
| `scopes` (#3) | `scopes` | `map<string, string>` | REQUIRED | The available scopes for the OAuth2 security scheme. | [proto L603-L604] |

- Proto message `DeviceCodeOAuthFlow` comment: "Defines configuration details for the OAuth 2.0 Device Code flow (RFC 8628). This flow is designed for input-constrained devices such as IoT devices, and CLI tools where the user authenticates on a separate device." [proto L633-L636]

| proto field (#) | JSON name | type | presence | meaning (proto comment) | cite |
|---|---|---|---|---|---|
| `device_authorization_url` (#1) | `deviceAuthorizationUrl` | `string` | REQUIRED | The device authorization endpoint URL. | [proto L637-L638] |
| `token_url` (#2) | `tokenUrl` | `string` | REQUIRED | The token URL to be used for this flow. | [proto L639-L640] |
| `refresh_url` (#3) | `refreshUrl` | `string` | not annotated REQUIRED | The URL to be used for obtaining refresh tokens. | [proto L641-L642] |
| `scopes` (#4) | `scopes` | `map<string, string>` | REQUIRED | The available scopes for the OAuth2 security scheme. | [proto L643-L644] |

- Proto message `ImplicitOAuthFlow` comment: "Deprecated: Use Authorization Code + PKCE instead." [proto L607-L608]

| proto field (#) | JSON name | type | presence | meaning (proto comment) | cite |
|---|---|---|---|---|---|
| `authorization_url` (#1) | `authorizationUrl` | `string` | not annotated REQUIRED | The authorization URL to be used for this flow. This MUST be in the form of a URL. The OAuth2 standard requires the use of TLS | [proto L609-L611] |
| `refresh_url` (#2) | `refreshUrl` | `string` | not annotated REQUIRED | The URL to be used for obtaining refresh tokens. This MUST be in the form of a URL. The OAuth2 standard requires the use of TLS. | [proto L612-L614] |
| `scopes` (#3) | `scopes` | `map<string, string>` | not annotated REQUIRED | The available scopes for the OAuth2 security scheme. A map between the scope name and a short description for it. The map MAY be empty. | [proto L615-L617] |

- Proto message `PasswordOAuthFlow` comment: "Deprecated: Use Authorization Code + PKCE or Device Code." [proto L620-L621]

| proto field (#) | JSON name | type | presence | meaning (proto comment) | cite |
|---|---|---|---|---|---|
| `token_url` (#1) | `tokenUrl` | `string` | not annotated REQUIRED | The token URL to be used for this flow. This MUST be in the form of a URL. The OAuth2 standard requires the use of TLS. | [proto L622-L624] |
| `refresh_url` (#2) | `refreshUrl` | `string` | not annotated REQUIRED | The URL to be used for obtaining refresh tokens. This MUST be in the form of a URL. The OAuth2 standard requires the use of TLS. | [proto L625-L627] |
| `scopes` (#3) | `scopes` | `map<string, string>` | not annotated REQUIRED | The available scopes for the OAuth2 security scheme. A map between the scope name and a short description for it. The map MAY be empty. | [proto L628-L630] |

### 2.7 Request and response messages

- Proto message `SendMessageConfiguration` comment: "Configuration of a send message request." [proto L142-L143]

| proto field (#) | JSON name | type | presence | meaning (proto comment) | cite |
|---|---|---|---|---|---|
| `accepted_output_modes` (#1) | `acceptedOutputModes` | `repeated string` | not annotated REQUIRED | A list of media types the client is prepared to accept for response parts. Agents SHOULD use this to tailor their output. | [proto L144-L146] |
| `task_push_notification_config` (#2) | `taskPushNotificationConfig` | `TaskPushNotificationConfig` | not annotated REQUIRED | Configuration for the agent to send push notifications for task updates. Task id should be empty when sending this configuration in a `SendMessage` request. | [proto L147-L149] |
| `history_length` (#3) | `historyLength` | `int32` | optional (explicit presence) | The maximum number of most recent messages from the task's history to retrieve in the response. An unset value means the client does not impose any limit. A value of zero is a request to not include any messages. The server MUST NOT return more messages than the provided value, but MAY apply a lower limit. | [proto L150-L154] |
| `return_immediately` (#4) | `returnImmediately` | `bool` | not annotated REQUIRED | If `true`, the operation returns immediately after creating the task, even if processing is still in progress. If `false` (default), the operation MUST wait until the task reaches a terminal (`COMPLETED`, `FAILED`, `CANCELED`, `REJECTED`) or interrupted (`INPUT_REQUIRED`, `AUTH_REQUIRED`) state before returning. | [proto L155-L160] |

- Proto message `SendMessageRequest` comment: "Represents a request for the `SendMessage` method." [proto L647-L648]

| proto field (#) | JSON name | type | presence | meaning (proto comment) | cite |
|---|---|---|---|---|---|
| `tenant` (#1) | `tenant` | `string` | not annotated REQUIRED | Optional. Opaque routing identifier. Must match the `tenant` value from the selected `AgentInterface` in the Agent Card when that field is set. | [proto L649-L651] |
| `message` (#2) | `message` | `Message` | REQUIRED | The message to send to the agent. | [proto L652-L653] |
| `configuration` (#3) | `configuration` | `SendMessageConfiguration` | not annotated REQUIRED | Configuration for the send request. | [proto L654-L655] |
| `metadata` (#4) | `metadata` | `google.protobuf.Struct` | not annotated REQUIRED | A flexible key-value map for passing additional context or parameters. | [proto L656-L657] |

- Proto message `SendMessageResponse` comment: "Represents the response for the `SendMessage` method." [proto L778-L779]

| proto field (#) | JSON name | type | presence | meaning (proto comment) | cite |
|---|---|---|---|---|---|
| `task` (#1) | `task` | `Task` | oneof `payload` member | The task created or updated by the message. | [proto L782-L783] |
| `message` (#2) | `message` | `Message` | oneof `payload` member | A message from the agent. | [proto L784-L785] |

- Every request message carries an optional `tenant` string (for the create-config RPC the request is `TaskPushNotificationConfig`, which has its own `tenant` field). The proto comment is identical each time: "Optional. Opaque routing identifier. Must match the `tenant` value from the selected `AgentInterface` in the Agent Card when that field is set." [proto L649-L651] [proto L662-L664] [proto L676-L678] [proto L716-L718]

- Proto message `GetTaskRequest` comment: "Represents a request for the `GetTask` method." [proto L660-L661]

| proto field (#) | JSON name | type | presence | meaning (proto comment) | cite |
|---|---|---|---|---|---|
| `tenant` (#1) | `tenant` | `string` | not annotated REQUIRED | Optional. Opaque routing identifier. Must match the `tenant` value from the selected `AgentInterface` in the Agent Card when that field is set. | [proto L662-L664] |
| `id` (#2) | `id` | `string` | REQUIRED | The resource ID of the task to retrieve. | [proto L665-L666] |
| `history_length` (#3) | `historyLength` | `int32` | optional (explicit presence) | The maximum number of most recent messages from the task's history to retrieve. An unset value means the client does not impose any limit. A value of zero is a request to not include any messages. The server MUST NOT return more messages than the provided value, but MAY apply a lower limit. | [proto L667-L671] |

- Proto message `ListTasksRequest` comment: "Parameters for listing tasks with optional filtering criteria." [proto L674-L675]

| proto field (#) | JSON name | type | presence | meaning (proto comment) | cite |
|---|---|---|---|---|---|
| `tenant` (#1) | `tenant` | `string` | not annotated REQUIRED | Optional. Opaque routing identifier. Must match the `tenant` value from the selected `AgentInterface` in the Agent Card when that field is set. | [proto L676-L678] |
| `context_id` (#2) | `contextId` | `string` | not annotated REQUIRED | Filter tasks by context ID to get tasks from a specific conversation or session. | [proto L679-L680] |
| `status` (#3) | `status` | `TaskState` | not annotated REQUIRED | Filter tasks by their current status state. | [proto L681-L682] |
| `page_size` (#4) | `pageSize` | `int32` | optional (explicit presence) | The maximum number of tasks to return. The service may return fewer than this value. If unspecified, at most 50 tasks will be returned. The minimum value is 1. The maximum value is 100. | [proto L683-L687] |
| `page_token` (#5) | `pageToken` | `string` | not annotated REQUIRED | A page token, received from a previous `ListTasks` call. `ListTasksResponse.next_page_token`. Provide this to retrieve the subsequent page. | [proto L688-L691] |
| `history_length` (#6) | `historyLength` | `int32` | optional (explicit presence) | The maximum number of messages to include in each task's history. | [proto L692-L693] |
| `status_timestamp_after` (#7) | `statusTimestampAfter` | `google.protobuf.Timestamp` | not annotated REQUIRED | Filter tasks which have a status updated after the provided timestamp in ISO 8601 format (e.g., "2023-10-27T10:00:00Z"). Only tasks with a status timestamp time greater than or equal to this value will be returned. | [proto L694-L696] |
| `include_artifacts` (#8) | `includeArtifacts` | `bool` | optional (explicit presence) | Whether to include artifacts in the returned tasks. Defaults to false to reduce payload size. | [proto L697-L699] |

- `ListTasksRequest.page_size` has defaults and bounds only in the comment: "If unspecified, at most 50 tasks will be returned. The minimum value is 1. The maximum value is 100." [proto L683-L687]
- `statusTimestampAfter` is named `after` but the proto comment makes the bound inclusive: "Only tasks with a status timestamp time greater than or equal to this value will be returned." [proto L694-L696]

- Proto message `ListTasksResponse` comment: "Result object for `ListTasks` method containing an array of tasks and pagination information." [proto L702-L703]

| proto field (#) | JSON name | type | presence | meaning (proto comment) | cite |
|---|---|---|---|---|---|
| `tasks` (#1) | `tasks` | `repeated Task` | REQUIRED | Array of tasks matching the specified criteria. | [proto L704-L705] |
| `next_page_token` (#2) | `nextPageToken` | `string` | REQUIRED | A token to retrieve the next page of results, or empty if there are no more results in the list. | [proto L706-L707] |
| `page_size` (#3) | `pageSize` | `int32` | REQUIRED | The page size used for this response. | [proto L708-L709] |
| `total_size` (#4) | `totalSize` | `int32` | REQUIRED | Total number of tasks available (before pagination). | [proto L710-L711] |

- All four members are REQUIRED, including `nextPageToken` (empty string on the last page), `pageSize` ("The page size used for this response.") and `totalSize` ("Total number of tasks available (before pagination)."). [proto L704-L711] [spec §3.1.4, L246]

- Proto message `CancelTaskRequest` comment: "Represents a request for the `CancelTask` method." [proto L714-L715]

| proto field (#) | JSON name | type | presence | meaning (proto comment) | cite |
|---|---|---|---|---|---|
| `tenant` (#1) | `tenant` | `string` | not annotated REQUIRED | Optional. Opaque routing identifier. Must match the `tenant` value from the selected `AgentInterface` in the Agent Card when that field is set. | [proto L716-L718] |
| `id` (#2) | `id` | `string` | REQUIRED | The resource ID of the task to cancel. | [proto L719-L720] |
| `metadata` (#3) | `metadata` | `google.protobuf.Struct` | not annotated REQUIRED | A flexible key-value map for passing additional context or parameters. | [proto L721-L722] |

- Proto message `SubscribeToTaskRequest` comment: "Represents a request for the `SubscribeToTask` method." [proto L747-L748]

| proto field (#) | JSON name | type | presence | meaning (proto comment) | cite |
|---|---|---|---|---|---|
| `tenant` (#1) | `tenant` | `string` | not annotated REQUIRED | Optional. Opaque routing identifier. Must match the `tenant` value from the selected `AgentInterface` in the Agent Card when that field is set. | [proto L749-L751] |
| `id` (#2) | `id` | `string` | REQUIRED | The resource ID of the task to subscribe to. | [proto L752-L753] |

- Proto message `GetTaskPushNotificationConfigRequest` comment: "Represents a request for the `GetTaskPushNotificationConfig` method." [proto L725-L726]

| proto field (#) | JSON name | type | presence | meaning (proto comment) | cite |
|---|---|---|---|---|---|
| `tenant` (#1) | `tenant` | `string` | not annotated REQUIRED | Optional. Opaque routing identifier. Must match the `tenant` value from the selected `AgentInterface` in the Agent Card when that field is set. | [proto L727-L729] |
| `task_id` (#2) | `taskId` | `string` | REQUIRED | The parent task resource ID. | [proto L730-L731] |
| `id` (#3) | `id` | `string` | REQUIRED | The resource ID of the configuration to retrieve. | [proto L732-L733] |

- Proto message `DeleteTaskPushNotificationConfigRequest` comment: "Represents a request for the `DeleteTaskPushNotificationConfig` method." [proto L736-L737]

| proto field (#) | JSON name | type | presence | meaning (proto comment) | cite |
|---|---|---|---|---|---|
| `tenant` (#1) | `tenant` | `string` | not annotated REQUIRED | Optional. Opaque routing identifier. Must match the `tenant` value from the selected `AgentInterface` in the Agent Card when that field is set. | [proto L738-L740] |
| `task_id` (#2) | `taskId` | `string` | REQUIRED | The parent task resource ID. | [proto L741-L742] |
| `id` (#3) | `id` | `string` | REQUIRED | The resource ID of the configuration to delete. | [proto L743-L744] |

- Proto message `ListTaskPushNotificationConfigsRequest` comment: "Represents a request for the `ListTaskPushNotificationConfigs` method." [proto L756-L757]

| proto field (#) | JSON name | type | presence | meaning (proto comment) | cite |
|---|---|---|---|---|---|
| `tenant` (#4) | `tenant` | `string` | not annotated REQUIRED | Optional. Opaque routing identifier. Must match the `tenant` value from the selected `AgentInterface` in the Agent Card when that field is set. | [proto L758-L760] |
| `task_id` (#1) | `taskId` | `string` | REQUIRED | The parent task resource ID. | [proto L761-L762] |
| `page_size` (#2) | `pageSize` | `int32` | not annotated REQUIRED | The maximum number of configurations to return. | [proto L764-L765] |
| `page_token` (#3) | `pageToken` | `string` | not annotated REQUIRED | A page token received from a previous `ListTaskPushNotificationConfigsRequest` call. | [proto L767-L768] |

- Wire-compatibility oddity: in this request `tenant` is field number 4 (it is number 1 in every other request message), while `task_id` is 1, `page_size` is 2 and `page_token` is 3. A related CHANGELOG entry covers a different message: "Adjust field number for `ListTasksRequest.tenant` to prevent missing number". [proto L756-L769] [changelog, L63]
- `ListTaskPushNotificationConfigsRequest.page_size` is a plain `int32` (no `optional`, no stated default or maximum), unlike `ListTasksRequest.page_size`. [proto L764-L765] [proto L683-L687]

- Proto message `ListTaskPushNotificationConfigsResponse` comment: "Represents a successful response for the `ListTaskPushNotificationConfigs` method." [proto L804-L806]

| proto field (#) | JSON name | type | presence | meaning (proto comment) | cite |
|---|---|---|---|---|---|
| `configs` (#1) | `configs` | `repeated TaskPushNotificationConfig` | not annotated REQUIRED | The list of push notification configurations. | [proto L807-L808] |
| `next_page_token` (#2) | `nextPageToken` | `string` | not annotated REQUIRED | A token to retrieve the next page of results, or empty if there are no more results in the list. | [proto L809-L810] |

- Unlike `ListTasksResponse`, the list-configs response marks nothing REQUIRED: `configs` and `nextPageToken` are both unannotated. [proto L806-L811]

- Proto message `GetExtendedAgentCardRequest` comment: "Represents a request for the `GetExtendedAgentCard` method." [proto L771-L772]

| proto field (#) | JSON name | type | presence | meaning (proto comment) | cite |
|---|---|---|---|---|---|
| `tenant` (#1) | `tenant` | `string` | not annotated REQUIRED | Optional. Opaque routing identifier. Must match the `tenant` value from the selected `AgentInterface` in the Agent Card when that field is set. | [proto L773-L775] |

### 2.8 RPC to message mapping, and names that do not exist at v1.0.1

| RPC (`A2AService`) | request message | response message | streaming | cite |
|---|---|---|---|---|
| `SendMessage` | `SendMessageRequest` | `SendMessageResponse` | unary | [proto L21] |
| `SendStreamingMessage` | `SendMessageRequest` | `StreamResponse` | server streaming | [proto L33] |
| `GetTask` | `GetTaskRequest` | `Task` | unary | [proto L45] |
| `ListTasks` | `ListTasksRequest` | `ListTasksResponse` | unary | [proto L55] |
| `CancelTask` | `CancelTaskRequest` | `Task` | unary | [proto L64] |
| `SubscribeToTask` | `SubscribeToTaskRequest` | `StreamResponse` | server streaming | [proto L76] |
| `CreateTaskPushNotificationConfig` | `TaskPushNotificationConfig` | `TaskPushNotificationConfig` | unary | [proto L90] |
| `GetTaskPushNotificationConfig` | `GetTaskPushNotificationConfigRequest` | `TaskPushNotificationConfig` | unary | [proto L102] |
| `ListTaskPushNotificationConfigs` | `ListTaskPushNotificationConfigsRequest` | `ListTaskPushNotificationConfigsResponse` | unary | [proto L112] |
| `GetExtendedAgentCard` | `GetExtendedAgentCardRequest` | `AgentCard` | unary | [proto L122] |
| `DeleteTaskPushNotificationConfig` | `DeleteTaskPushNotificationConfigRequest` | `google.protobuf.Empty` | unary | [proto L131] |

- The create RPC takes the resource message directly; there is no `CreateTaskPushNotificationConfigRequest` message in the proto, although prose §10.4.7 and Appendix A name one. The prose macro for it prints an error in the built doc. [proto L90] [spec §10.4.7, L2623] [spec §A, L3364] [macros, L71-L73]
- Names that appear in prose, guides or older material but do not exist as proto types or fields at v1.0.1 (do not use them in the manual): `PushNotificationConfig`, `CreateTaskPushNotificationConfigRequest`, `TextPart`, `FilePart`, `DataPart`, the `kind` discriminator, `TaskStatusUpdateEvent.final`, `Task.createdAt`, `Task.lastModified`, `TaskArtifactUpdateEvent.index`, `AgentCard.url`, `AgentCard.protocolVersion`, `AgentCard.preferredTransport`, `AgentCard.additionalInterfaces`, `AgentCard.supportsAuthenticatedExtendedCard`, `AgentCard.security`. [proto L142-L811] [doc whats-new-v1.md, L384-L388] [doc whats-new-v1.md, L86]
- Legacy to current renames the spec lists in Appendix A: `MessageSendParams` to `SendMessageRequest`, `SendMessageSuccessResponse` to `SendMessageResponse`, `SendStreamingMessageSuccessResponse` to `StreamResponse`, `SetTaskPushNotificationConfigRequest` to `CreateTaskPushNotificationConfigRequest`, `ListTaskPushNotificationConfigSuccessResponse` to `ListTaskPushNotificationConfigsResponse`, `GetAuthenticatedExtendedCardRequest` to `GetExtendedAgentCardRequest`. [spec §A, L3359-L3366]


## 3. Operations

The operations are defined binding-independently in §3 and mapped to the three standard bindings in §9 (JSON-RPC), §10 (gRPC) and §11 (HTTP+JSON/REST). There are eleven operations: six message and task operations (send, send streaming, get, list, cancel, subscribe), four push-configuration operations (create, get, list, delete) and one extended-card operation. There is no separate "get public Agent Card" operation: the public card is a plain HTTP GET (section 8). Note the spec's own caution that every call is subject to authorization: "Servers **MUST** implement authorization checks on every A2A Protocol Operations request". [proto L19-L140] [spec §13.1, L3079]

### 3.0 Exact operation names in each binding

| Operation | JSON-RPC `method` | gRPC `rpc` (service `A2AService`) | HTTP+JSON per the proto `google.api.http` (normative) | HTTP+JSON per the prose (§5.3, §11.3) | cite |
|---|---|---|---|---|---|
| Send message | `SendMessage` | `SendMessage` | `POST /message:send`, body `*`; also `POST /{tenant}/message:send` | `POST /message:send` | [spec §5.3, L1164] [proto L21-L30] [spec §11.3.1, L2787] |
| Send streaming message | `SendStreamingMessage` | `SendStreamingMessage` (server streaming) | `POST /message:stream`, body `*`; also `POST /{tenant}/message:stream` | `POST /message:stream` | [spec §5.3, L1165] [proto L33-L42] [spec §11.3.1, L2788] |
| Get task | `GetTask` | `GetTask` | `GET /tasks/{id=*}`; also `GET /{tenant}/tasks/{id=*}` | `GET /tasks/{id}` | [spec §5.3, L1166] [proto L45-L53] [spec §11.3.2, L2792] |
| List tasks | `ListTasks` | `ListTasks` | `GET /tasks`; also `GET /{tenant}/tasks` | `GET /tasks` | [spec §5.3, L1167] [proto L55-L62] [spec §11.3.2, L2793] |
| Cancel task | `CancelTask` | `CancelTask` | `POST /tasks/{id=*}:cancel`, body `*`; also `POST /{tenant}/tasks/{id=*}:cancel` | `POST /tasks/{id}:cancel` | [spec §5.3, L1168] [proto L64-L73] [spec §11.3.2, L2794] |
| Subscribe to task | `SubscribeToTask` | `SubscribeToTask` (server streaming) | **`GET /tasks/{id=*}:subscribe`**; also `GET /{tenant}/tasks/{id=*}:subscribe` | **`POST /tasks/{id}:subscribe`** | [spec §5.3, L1169] [proto L76-L83] [spec §11.3.2, L2795] |
| Create push notification config | `CreateTaskPushNotificationConfig` | `CreateTaskPushNotificationConfig` | `POST /tasks/{task_id=*}/pushNotificationConfigs`, body `*`; also with `/{tenant}` prefix | `POST /tasks/{id}/pushNotificationConfigs` | [spec §5.3, L1170] [proto L90-L100] [spec §11.3.3, L2799] |
| Get push notification config | `GetTaskPushNotificationConfig` | `GetTaskPushNotificationConfig` | `GET /tasks/{task_id=*}/pushNotificationConfigs/{id=*}`; also with `/{tenant}` prefix | `GET /tasks/{id}/pushNotificationConfigs/{configId}` | [spec §5.3, L1171] [proto L102-L110] [spec §11.3.3, L2800] |
| List push notification configs | `ListTaskPushNotificationConfigs` | `ListTaskPushNotificationConfigs` | `GET /tasks/{task_id=*}/pushNotificationConfigs`; also with `/{tenant}` prefix | `GET /tasks/{id}/pushNotificationConfigs` | [spec §5.3, L1172] [proto L112-L120] [spec §11.3.3, L2801] |
| Delete push notification config | `DeleteTaskPushNotificationConfig` | `DeleteTaskPushNotificationConfig` | `DELETE /tasks/{task_id=*}/pushNotificationConfigs/{id=*}`; also with `/{tenant}` prefix | `DELETE /tasks/{id}/pushNotificationConfigs/{configId}` | [spec §5.3, L1173] [proto L131-L139] [spec §11.3.3, L2802] |
| Get extended agent card | `GetExtendedAgentCard` | `GetExtendedAgentCard` | `GET /extendedAgentCard`; also `GET /{tenant}/extendedAgentCard` | `GET /extendedAgentCard` | [spec §5.3, L1174] [proto L122-L129] [spec §11.3.4, L2806] |

- JSON-RPC method names are the gRPC names: "Method Naming: PascalCase method names matching gRPC conventions (e.g., `SendMessage`, `GetTask`)". The v0.3 slash names (`message/send`, `tasks/get`, `tasks/resubscribe`, `agent/getAuthenticatedExtendedCard`) are gone. The §9.3 template still shows `"method": "category/action"`, which is a stale placeholder. [spec §9.1, L2237] [spec §9.3, L2276] [doc whats-new-v1.md, L48-L132]
- The HTTP+JSON mapping has two independent descriptions. The proto `google.api.http` annotations are the only place that defines the `/{tenant}/...` variants, and they say `SubscribeToTask` is a `GET`. The prose in §5.3 and §11.3.2 says `POST /tasks/{id}:subscribe` and never mentions tenant-prefixed paths. For a v1.0.1 implementation, follow the proto for the path set and flag the Subscribe verb as an unresolved spec defect; a tolerant server can accept both verbs. [proto L76-L83] [spec §5.3, L1169] [spec §11.3.2, L2795]
- Path variable names differ between the two descriptions: the proto binds the task id on task routes as `{id=*}` but as `{task_id=*}` on push-config routes, and the config id as `{id=*}`; the prose uses `{id}` for the task and `{configId}` for the config. Both describe the same URL shapes. [proto L47] [proto L92] [proto L104] [spec §11.3.3, L2799-L2802]
- The v1.0 URL paths have no `/v1` prefix: "Removed `/v1` prefix from HTTP+JSON URL paths", "Version can be part of the base url if required by agent owner". [doc whats-new-v1.md, L201-L203]
- Custom verbs use a colon suffix (`:send`, `:stream`, `:cancel`, `:subscribe`) in the proto routes. The spec says the gRPC binding uses the API guidelines "to simplify gRPC to HTTP mapping". [proto L22-L29] [spec §10, L2507]
- The abstract spec states which operations also exist as methods in each binding: all eleven are required in every standard binding (derived from §5.1 and the §5.3 table), and a custom binding must "Implement All Core Operations". [spec §5.3, L1162-L1174] [spec §12.1, L2983]
- For GET and DELETE routes, request parameters travel as path or query parameters named in camelCase (`contextId`, `pageSize`, `pageToken`, `historyLength`, `taskId`), booleans as `true`/`false`, enums by their string value, timestamps as ISO 8601; "Nested Objects: Not supported in query parameters". [spec §11.5, L2853-L2894]
- JSON-RPC requests are POSTs of a JSON-RPC 2.0 envelope with `jsonrpc`, `id`, `method`, `params`; `params` is the proto request message (for example `{"id": "task-uuid", "historyLength": 10}` for `GetTask`) and `GetExtendedAgentCard` is sent without `params`. [spec §9.3, L2270-L2279] [spec §9.4.3, L2338-L2347] [spec §9.4.8, L2423-L2428]
- The JSON-RPC binding says nothing about JSON-RPC batch requests or notifications (requests without `id`). SPEC SILENT. [spec §9.3, L2268-L2279]

### 3.1 SendMessage

- Purpose: "The primary operation for initiating agent interactions. Clients send a message to an agent and receive either a task that tracks the processing or a direct response message." [spec §3.1.1, L161]
- Input: `SendMessageRequest` (`message` REQUIRED; optional `configuration`, `metadata`, `tenant`). Output: `SendMessageResponse`, a `oneof` of `task` or `message`, so on the wire `{"task": {...}}` or `{"message": {...}}`. [spec §3.1.1, L163-L170] [proto L648-L658] [proto L779-L787] [spec §9.4.1, L2306-L2311]
- Errors the operation lists: `ContentTypeNotSupportedError` (a media type in the request parts is not supported), `UnsupportedOperationError` (message sent to a task in a terminal state) and `TaskNotFoundError` (the task id does not exist or is not accessible). Version and extension errors apply too (sections 7 and 9). [spec §3.1.1, L172-L176]
- Task or Message is the agent's choice, with no selection rule: "The agent MAY create a new `Task` to process the provided message asynchronously or MAY return a direct `Message` response for simple interactions." [spec §3.1.1, L180]
- The same paragraph also says "The operation MUST return immediately with either task information or response message." That contradicts the blocking default stated in §3.2.2 and in the proto. Judgment: the proto and §3.2.2 agree that the default is to wait, and the CHANGELOG records a fix about blocking calls ("Clarify blocking calls return on interrupted states"), so treat the §3.1.1 sentence as stale. [spec §3.1.1, L180] [spec §3.2.2, L446] [proto L155-L160] [changelog, L47]
- Blocking (default, `returnImmediately` false or unset): "The operation MUST wait until the task reaches a terminal state (`TASK_STATE_COMPLETED`, `TASK_STATE_FAILED`, `TASK_STATE_CANCELED`, `TASK_STATE_REJECTED`) or an interrupted state (`TASK_STATE_INPUT_REQUIRED`, `TASK_STATE_AUTH_REQUIRED`) before returning. The response MUST include the latest task state with all artifacts and status information." [spec §3.2.2, L446]
- Interrupted-state return behavior: a blocking call returns as soon as the task is `TASK_STATE_INPUT_REQUIRED` or `TASK_STATE_AUTH_REQUIRED`; it does not keep waiting for a human. The client then continues by sending another message with the same `taskId` (and `contextId`). The proto comment says the same: "MUST wait until the task reaches a terminal (`COMPLETED`, `FAILED`, `CANCELED`, `REJECTED`) or interrupted (`INPUT_REQUIRED`, `AUTH_REQUIRED`) state before returning." [spec §3.2.2, L446] [spec §3.4.3, L632-L633] [proto L157-L159]
- Non-blocking (`returnImmediately: true`): "The operation MUST return immediately after creating the task, even if processing is still in progress. The returned task will have an in-progress state (e.g., `TASK_STATE_WORKING`, `TASK_STATE_INPUT_REQUIRED`)." The caller must then poll, subscribe or use push notifications. [spec §3.2.2, L448]
- `returnImmediately` "has no effect" when the agent answers with a direct `Message`, for streaming operations, or on configured push notification configs. [spec §3.2.2, L450-L454]
- SendMessage may be idempotent: "Send Message operations MAY be idempotent. Agents may utilize the messageId to detect duplicate messages." [spec §3.3.1, L495]
- Continuing work: a `taskId` in the message "MUST reference an existing task", otherwise `TaskNotFoundError`; a message to a terminal task is `UnsupportedOperationError`. Details in section 4. [spec §3.4.2, L613-L614] [spec §3.1.1, L175]
- `acceptedOutputModes` is advisory: "A list of media types the client is prepared to accept for response parts. Agents SHOULD use this to tailor their output." A request part the agent cannot handle is `ContentTypeNotSupportedError`. [proto L144-L146] [spec §3.1.1, L174]
- `configuration.taskPushNotificationConfig` registers a webhook in the same call; its `taskId` "should be empty when sending this configuration in a `SendMessage` request". [proto L147-L149] [spec §6.6, L1642-L1650]
- `configuration.historyLength` limits history in the returned task (section 3.12). [proto L150-L154]

### 3.2 SendStreamingMessage

- Purpose: "Similar to Send Message but with real-time streaming of updates during processing." Same input (`SendMessageRequest`); output is a stream of `StreamResponse` objects. [spec §3.1.2, L184-L195] [proto L33]
- Errors: `UnsupportedOperationError` when streaming is unsupported or the target task is terminal, `ContentTypeNotSupportedError`, `TaskNotFoundError`. [spec §3.1.2, L197-L202]
- Stream shape rule: "The operation MUST establish a streaming connection for real-time updates. The stream MUST follow one of these patterns:" a Message-only stream ("exactly one `Message` object and then close immediately") or a Task lifecycle stream ("MUST begin with the Task object, followed by zero or more" status or artifact update events). [spec §3.1.2, L206-L210]
- "The implementation MUST provide immediate feedback on progress and intermediate results." [spec §3.1.2, L212]
- Requires `capabilities.streaming`; otherwise `UnsupportedOperationError`. Section 5 covers stream termination, which the spec states inconsistently. [spec §3.3.4, L574]

### 3.3 GetTask

- Purpose: retrieve "the current state (including status, artifacts, and optionally history) of a previously initiated task", typically for polling, "or for fetching the final state of a task after being notified via a push notification or after a stream has ended". [spec §3.1.3, L216]
- Input `GetTaskRequest`: `id` REQUIRED, optional `historyLength` and `tenant`. Output: `Task`. Error: `TaskNotFoundError` ("The task ID does not exist or is not accessible."). [spec §3.1.3, L218-L230] [proto L661-L672]
- REST form: `GET /tasks/{id}?historyLength=10`. JSON-RPC form: `{"method": "GetTask", "params": {"id": "task-uuid", "historyLength": 10}}`. [spec §11.5, L2879] [spec §9.4.3, L2338-L2347]
- Authorization: the server "MUST verify the authenticated client has access to the requested task". [spec §13.1, L3092]

### 3.4 ListTasks

- Purpose: "Retrieves a list of tasks with optional filtering and pagination capabilities." Input `ListTasksRequest` (`contextId`, `status`, `pageSize`, `pageToken`, `historyLength`, `statusTimestampAfter`, `includeArtifacts`, `tenant`); output `ListTasksResponse`; "None specific to this operation beyond standard protocol errors." [spec §3.1.4, L234-L250] [proto L675-L712]
- Artifacts: "When `includeArtifacts` is false (the default), the artifacts field MUST be omitted entirely from each Task object in the response. The field should not be present as an empty array or null value." [spec §3.1.4, L240]
- Pagination: "The `nextPageToken` field MUST always be present in the response. When there are no more results to retrieve (i.e., this is the final page), the field MUST be set to an empty string (\"\")." [spec §3.1.4, L246]
- "The operation MUST return only tasks visible to the authenticated client and MUST use cursor-based pagination for performance and consistency. Tasks MUST be sorted by last update time in descending order." The ordering key is restated as the status timestamp: "Implementations MUST return tasks sorted by their status timestamp time in descending order (most recently updated tasks first)." [spec §3.1.4, L254] [spec §3.1.4, L262]
- The spec chose cursor over offset pagination on purpose ("Cursor-based pagination avoids the \"deep pagination problem\""), and tokens are opaque to the client (the sample token is the string `base64-encoded-cursor-token`). [spec §3.1.4, L258] [spec §6.5, L1563]
- Page size: default 50, minimum 1, maximum 100 (proto comment). The spec's validation example returns an error for `pageSize=150` with the message "Must be between 1 and 100 inclusive, got 150". [proto L683-L687] [spec §6.5, L1606]
- Authorization scoping applies even without filters: "Even when `contextId` or other filter parameters are not specified in requests, implementations **MUST** scope results to the caller's authorized access boundaries". [spec §13.1, L3081]

### 3.5 CancelTask

- Purpose: "Requests the cancellation of an ongoing task. The server will attempt to cancel the task, but success is not guaranteed (e.g., the task might have already completed or failed, or cancellation might not be supported at its current stage)." [spec §3.1.5, L266]
- Input `CancelTaskRequest` (`id` REQUIRED, optional `metadata`, `tenant`). Output: the updated `Task` "with cancellation status". [spec §3.1.5, L268-L274] [proto L715-L723]
- Errors: `TaskNotCancelableError` ("The task is not in a cancelable state (e.g., already completed, failed, or canceled).") and `TaskNotFoundError`. [spec §3.1.5, L276-L279]
- Behavior sentence: "The operation attempts to cancel the specified task and returns its updated state." SPEC SILENT on which non-terminal states are cancelable (for example whether `TASK_STATE_INPUT_REQUIRED` is) and on whether the returned task is already `TASK_STATE_CANCELED`. [spec §3.1.5, L283]
- Idempotency statement and its caveat: "Cancel Task operations are idempotent - multiple cancellation requests have the same effect. A duplicate cancellation request MAY return `TaskNotFoundError` if the task has already been canceled and purged." This sits awkwardly beside `TaskNotCancelableError` listing "canceled" as a not-cancelable state; the spec does not say which error a repeat cancel of a `CANCELED` task gets. [spec §3.3.1, L496] [spec §3.1.5, L278]

### 3.6 SubscribeToTask

- Purpose: "Establishes a streaming connection to receive updates for an existing task." Input `SubscribeToTaskRequest` (`id` REQUIRED, `tenant`). Output: a stream whose first event is the current `Task`, followed by status and artifact update events. [spec §3.1.6, L289-L299] [proto L748-L754]
- First event rule: "The operation MUST return a `Task` object as the first event in the stream, representing the current state of the task at the time of subscription. This prevents a potential loss of information between a call to `GetTask` and calling `SubscribeToTask`." [spec §3.1.6, L311]
- Termination: "The stream MUST terminate when the task reaches a terminal state (`TASK_STATE_COMPLETED`, `TASK_STATE_FAILED`, `TASK_STATE_CANCELED`, `TASK_STATE_REJECTED`)." [spec §3.1.6, L309]
- Errors: `UnsupportedOperationError` if streaming is unsupported, `TaskNotFoundError`, and `UnsupportedOperationError` "if the task is already in a terminal state" (the proto and §9.4.6 and §10.4.6 repeat this). So subscribing to a finished task is an error, not an empty stream. [spec §3.1.6, L301-L305] [proto L74-L75] [spec §9.4.6, L2408] [spec §10.4.6, L2609]
- It is the v1.0 replacement for v0.3 `tasks/resubscribe`. Use it for reconnects, and use `GetTask` when the stream is already closed. [doc whats-new-v1.md, L132-L144]
- Multiple concurrent subscriptions to one task are allowed (section 5.3). [spec §3.5.2, L687-L694]

### 3.7 CreateTaskPushNotificationConfig

- Purpose: "Creates a push notification configuration for a task to receive asynchronous updates via webhook." Input is the `TaskPushNotificationConfig` message itself; output is the created configuration "with assigned ID". [spec §3.1.7, L318-L326] [proto L90]
- Errors: `PushNotificationNotSupportedError` and `TaskNotFoundError`. [spec §3.1.7, L328-L331]
- Rules: "The operation MUST establish a webhook endpoint for task update notifications." Updates are sent as HTTP POSTs with `StreamResponse` payloads. "The configuration MUST persist until task completion or explicit deletion." [spec §3.1.7, L335]
- Gated by `capabilities.pushNotifications`. [spec §3.3.4, L573]

### 3.8 GetTaskPushNotificationConfig

- Input `GetTaskPushNotificationConfigRequest` (`taskId` and `id` both REQUIRED); output `TaskPushNotificationConfig`. [spec §3.1.8, L343-L351] [proto L726-L734]
- Errors: `PushNotificationNotSupportedError`, and `TaskNotFoundError` for "The push notification configuration does not exist." (there is no separate configuration-not-found error). [spec §3.1.8, L353-L356]
- "The operation MUST return configuration details including webhook URL and notification settings. The operation MUST fail if the configuration does not exist or the client lacks access." [spec §3.1.8, L360]

### 3.9 ListTaskPushNotificationConfigs

- Input `ListTaskPushNotificationConfigsRequest` (`taskId` REQUIRED, `pageSize`, `pageToken`); output `ListTaskPushNotificationConfigsResponse` (`configs`, `nextPageToken`). [spec §3.1.9, L364-L372] [proto L757-L769] [proto L806-L811]
- "The operation MUST return all active push notification configurations for the specified task and MAY support pagination for tasks with many configurations." [spec §3.1.9, L381]
- Errors: `PushNotificationNotSupportedError`, `TaskNotFoundError`. [spec §3.1.9, L374-L377]

### 3.10 DeleteTaskPushNotificationConfig

- Input `DeleteTaskPushNotificationConfigRequest` (`taskId` and `id` REQUIRED); output "Confirmation of deletion (implementation-specific)", which is `google.protobuf.Empty` in gRPC. [spec §3.1.10, L385-L393] [proto L131]
- "The operation MUST permanently remove the specified push notification configuration. No further notifications will be sent to the configured webhook after deletion. This operation MUST be idempotent - multiple deletions of the same config have the same effect." [spec §3.1.10, L402]
- Errors: `PushNotificationNotSupportedError`, `TaskNotFoundError` ("The task ID does not exist."). [spec §3.1.10, L395-L398]
- SPEC SILENT on the JSON-RPC result body and the REST response body of a delete (gRPC returns `Empty`). [spec §9.4.7, L2410-L2415]

### 3.11 GetExtendedAgentCard

- Purpose: "Retrieves a potentially more detailed version of the Agent Card after the client has authenticated. This endpoint is available only if `AgentCard.capabilities.extendedAgentCard` is `true`." Input `GetExtendedAgentCardRequest` (only `tenant`); output a full `AgentCard`. [spec §3.1.11, L406-L414] [proto L772-L776]
- Errors: `UnsupportedOperationError` ("The agent does not support authenticated extended cards") and `ExtendedAgentCardNotConfiguredError` ("The agent declares support but does not have an extended agent card configured."). [spec §3.1.11, L416-L419]
- Authentication: "The client MUST authenticate the request using one of the schemes declared in the public `AgentCard.securitySchemes` and `AgentCard.security` fields." The second field name is wrong (the proto field is `securityRequirements`). [spec §3.1.11, L423] [proto L380-L383]
- "Card Replacement: Clients retrieving this extended card SHOULD replace their cached public Agent Card with the content received from this endpoint for the duration of their authenticated session or until the card's version changes." [spec §3.1.11, L425]
- The extended card "MAY return different details based on client authentication level, including additional skills, capabilities, or configuration not available in the public Agent Card." [spec §3.1.11, L424]
- Worked example in the spec: fetch the public card from `GET /.well-known/agent-card.json`, see `capabilities.extendedAgentCard: true`, obtain credentials out of band, then `GET /extendedAgentCard` with `Authorization: Bearer ...`. [spec §6.9, L1823-L1857]

### 3.12 Parameters shared by several operations

- `historyLength` semantics (§3.2.4): "Unset/undefined: No limit imposed; server returns its default amount of history (implementation-defined, may be all history)"; "0: No history should be returned; the `history` field SHOULD be omitted"; "> 0: Return at most this many recent messages from the task's history". [spec §3.2.4, L469-L471]
- The proto states the same cap on the server: "The server MUST NOT return more messages than the provided value, but MAY apply a lower limit." and "An unset value means the client does not impose any limit." (`GetTaskRequest.history_length`, `SendMessageConfiguration.history_length`, `ListTasksRequest.history_length` which only says "The maximum number of messages to include in each task's history."). [proto L150-L154] [proto L667-L671] [proto L692-L693]
- REST example of an invalid value: the spec's validation sample rejects `historyLength=-5` with "Must be non-negative integer, got -5". [spec §6.5, L1610]
- `metadata`: "A flexible key-value map for passing additional context or parameters with operations." It exists on `SendMessageRequest` and `CancelTaskRequest` (not on `GetTaskRequest` or `ListTasksRequest`). [spec §3.2.5, L475] [proto L656-L657] [proto L721-L722]
- Service parameters (`A2A-Version`, `A2A-Extensions`) are request-scoped key-value pairs carried by the binding, covered in section 9. [spec §3.2.6, L479]
- Capability gating of operations: push-config operations need `pushNotifications`; `SendStreamingMessage` and `SubscribeToTask` need `streaming`; `GetExtendedAgentCard` needs `extendedAgentCard`. The error to return in each case is in section 7. [spec §3.3.4, L573-L575]
- All task operations require access checks: "Task-related operations (Cancel, Subscribe, Push Notification Config): **MUST** verify the client has appropriate access rights according to the agent's authorization model". [spec §13.1, L3093]
- Asynchronous model: "Operations return immediately with either" `Task` or `Message` objects, "and when a Task is returned, processing continues in the background." This sentence is also inconsistent with the blocking default (see 3.1) unless `returnImmediately` is set. [spec §3.3.3, L567]

### 3.13 Constructed wire examples (v1.0 shapes, all REQUIRED members present)

The spec's own samples omit REQUIRED members and contain JSON errors in places (section 12.2 D23 and D24), so the examples below are assembled from the proto field names, the JSON naming rule and the binding rules above. They are constructed, not quoted. Ids and tokens are placeholders.

- HTTP+JSON blocking send (default execution mode) and its completed-task response. [proto L648-L658] [spec §3.2.2, L446] [spec §11.1, L2750]

```http
POST /message:send HTTP/1.1
Host: agent.example.com
Content-Type: application/a2a+json
A2A-Version: 1.0
Authorization: Bearer <token>

{"message": {"messageId": "m-1", "role": "ROLE_USER", "parts": [{"text": "What is the weather today?"}]}}
```

```http
HTTP/1.1 200 OK
Content-Type: application/a2a+json

{"task": {"id": "t-1", "contextId": "c-1", "status": {"state": "TASK_STATE_COMPLETED"},
  "artifacts": [{"artifactId": "a-1", "parts": [{"text": "Sunny, 75F"}]}]}}
```

- JSON-RPC non-blocking send: the `params` object is the `SendMessageRequest`, the method name is `SendMessage`, the content type is `application/json`, and the version goes in a header. [spec §9.2, L2242-L2266] [spec §9.1, L2236] [spec §3.2.2, L448]

```http
POST /a2a HTTP/1.1
Host: agent.example.com
Content-Type: application/json
A2A-Version: 1.0
Authorization: Bearer <token>

{"jsonrpc": "2.0", "id": 1, "method": "SendMessage",
 "params": {"message": {"messageId": "m-2", "role": "ROLE_USER", "parts": [{"text": "Run the report"}]},
            "configuration": {"returnImmediately": true, "historyLength": 0}}}
```

- Continue an interrupted task: same call with the server-issued `taskId` (and `contextId`, or omit it and let the server infer it). [spec §3.4.3, L625-L633] [proto L254-L259]

```json
{"message": {"messageId": "m-3", "taskId": "t-1", "contextId": "c-1", "role": "ROLE_USER",
             "parts": [{"text": "From San Francisco to New York"}]}}
```

- Streaming over HTTP+JSON: `POST /message:stream` returns `text/event-stream`; every `data:` line is a bare `StreamResponse`; the first item is the `Task`; status and artifact events carry `taskId` and `contextId`; the stream closes after the terminal state. The `append` and `lastChunk` values below follow the proto comments, and the spec is silent on first-chunk conventions. [spec §3.1.2, L210] [spec §11.7, L2950-L2970] [proto L296-L322]

```text
data: {"task": {"id": "t-1", "contextId": "c-1", "status": {"state": "TASK_STATE_WORKING"}}}

data: {"artifactUpdate": {"taskId": "t-1", "contextId": "c-1", "artifact": {"artifactId": "a-1", "parts": [{"text": "Part one. "}]}}}

data: {"artifactUpdate": {"taskId": "t-1", "contextId": "c-1", "artifact": {"artifactId": "a-1", "parts": [{"text": "Part two."}]}, "append": true, "lastChunk": true}}

data: {"statusUpdate": {"taskId": "t-1", "contextId": "c-1", "status": {"state": "TASK_STATE_COMPLETED"}}}
```

- The same stream over JSON-RPC wraps each item: `data: {"jsonrpc": "2.0", "id": 1, "result": {"statusUpdate": {...}}}`. [spec §9.4.2, L2322-L2328]
- Registering a webhook in the first call, and the notification the server later POSTs (the header is `Authorization: <scheme> <credentials>` taken from `authentication`). [proto L147-L149] [spec §4.3.3, L848-L860]

```json
{"message": {"messageId": "m-4", "role": "ROLE_USER", "parts": [{"text": "Generate the Q1 sales report"}]},
 "configuration": {"taskPushNotificationConfig": {"url": "https://client.example.com/webhook/a2a",
                   "authentication": {"scheme": "Bearer", "credentials": "<secret-for-this-task>"}}}}
```

```http
POST /webhook/a2a HTTP/1.1
Host: client.example.com
Authorization: Bearer <secret-for-this-task>
Content-Type: application/a2a+json

{"statusUpdate": {"taskId": "t-9", "contextId": "c-9", "status": {"state": "TASK_STATE_COMPLETED"}}}
```

- A not-found error over HTTP+JSON: `google.rpc.Status` JSON in an `error` object with an `ErrorInfo` detail. The JSON-RPC form is the same information in `error.code` `-32001`, `error.message` and `error.data` (an array). [spec §11.6, L2898-L2942] [spec §9.5, L2481-L2503]

```http
HTTP/1.1 404 Not Found
Content-Type: application/a2a+json

{"error": {"code": 404, "status": "NOT_FOUND", "message": "Task not found",
  "details": [{"@type": "type.googleapis.com/google.rpc.ErrorInfo", "reason": "TASK_NOT_FOUND",
               "domain": "a2a-protocol.org", "metadata": {"taskId": "t-404"}}]}}
```


## 4. Task lifecycle

### 4.1 States, terminal versus interrupted

| `TaskState` (JSON string) | number | class | what the spec says | cite |
|---|---|---|---|---|
| `TASK_STATE_UNSPECIFIED` | 0 | none | "The task is in an unknown or indeterminate state." | [proto L188-L189] |
| `TASK_STATE_SUBMITTED` | 1 | active | "successfully submitted and acknowledged" | [proto L190-L191] |
| `TASK_STATE_WORKING` | 2 | active | "actively being processed by the agent" | [proto L192-L193] |
| `TASK_STATE_COMPLETED` | 3 | terminal | "finished successfully" | [proto L194-L195] |
| `TASK_STATE_FAILED` | 4 | terminal | "finished with an error" | [proto L196-L197] |
| `TASK_STATE_CANCELED` | 5 | terminal | "canceled before completion" | [proto L198-L199] |
| `TASK_STATE_INPUT_REQUIRED` | 6 | interrupted | "requires additional user input to proceed" | [proto L200-L201] |
| `TASK_STATE_REJECTED` | 7 | terminal | "decided to not perform the task", at creation or later | [proto L202-L205] |
| `TASK_STATE_AUTH_REQUIRED` | 8 | interrupted | "authentication is required to proceed" | [proto L206-L207] |

- Terminal set (four states): `TASK_STATE_COMPLETED`, `TASK_STATE_FAILED`, `TASK_STATE_CANCELED`, `TASK_STATE_REJECTED`. The prose repeats this exact list wherever it needs "terminal". [spec §3.1.2, L210] [spec §3.1.6, L309] [spec §3.2.2, L446]
- Interrupted set (two states): `TASK_STATE_INPUT_REQUIRED`, `TASK_STATE_AUTH_REQUIRED`. Blocking `SendMessage` returns when a task reaches a terminal or an interrupted state. [proto L200-L201] [proto L206-L207] [spec §3.2.2, L446]
- `TASK_STATE_REJECTED` is distinct from `TASK_STATE_FAILED`: rejected means the agent "has decided to not perform the task", which "may be done during initial task creation or later once an agent has determined it can't or won't proceed." [proto L202-L205]
- Terminal and interrupted classifications live in the proto comments and in prose lists; there is no machine-readable flag. A client should hard-code the two sets above. [proto L186-L208]
- The v0.3 to v1.0 spelling changes (non-normative migration table): `submitted` to `TASK_STATE_SUBMITTED`, `working` to `TASK_STATE_WORKING`, `completed` to `TASK_STATE_COMPLETED`, `failed` to `TASK_STATE_FAILED`, `canceled` to `TASK_STATE_CANCELED`, `rejected` to `TASK_STATE_REJECTED`, `input-required` to `TASK_STATE_INPUT_REQUIRED`, `auth-required` to `TASK_STATE_AUTH_REQUIRED`. [doc whats-new-v1.md, L745-L752]
- The spec's own ListTasks validation sample enumerates the legal `status` filter values and omits `TASK_STATE_UNSPECIFIED`: "Must be one of: TASK_STATE_SUBMITTED, TASK_STATE_WORKING, TASK_STATE_COMPLETED, TASK_STATE_FAILED, TASK_STATE_CANCELED, TASK_STATE_REJECTED, TASK_STATE_INPUT_REQUIRED, TASK_STATE_AUTH_REQUIRED". [spec §6.5, L1614]

### 4.2 Transitions

- SPEC SILENT: neither the prose nor the proto contains a state-machine diagram, transition table or list of allowed next states. The word "transition" appears only in three behavioral sentences (below) and in migration text. Do not present a full transition graph as normative. [spec §3.4.3, L632] [spec §7.6.1, L1926]
- Sentence 1 (input): "Agents can request additional input mid-processing by transitioning a task to the `input-required` state" and "The client continues the interaction by sending a new message with the same `taskId` and `contextId`". [spec §3.4.3, L632-L633]
- Sentence 2 (authorization): to request in-task authorization the agent "MUST use a Task to track the operation", "MUST transition the TaskState to `TASK_STATE_AUTH_REQUIRED`" and "MUST include a TaskStatus message explaining the required authorization, unless the details of the authorization have been negotiated out-of-band or via an extension". [spec §7.6.1, L1925-L1927]
- After an out-of-band credential arrives, the agent "MAY immediately continue Task processing after receiving the credential, without a requirement that clients send a follow-up message." So `TASK_STATE_AUTH_REQUIRED` back to an active state without a client message is allowed. [spec §7.6.1, L1931]
- A client that is itself an A2A agent may pass the authorization request upstream "by transitioning its own Task to `TASK_STATE_AUTH_REQUIRED`", forming "a chain of Tasks in `TASK_STATE_AUTH_REQUIRED`". [spec §7.6.2, L1945]
- Terminal states are final: see 4.3. Extensions may not add enum values (the extensions guide says "Extensions should use existing enum values and annotate additional semantic meaning in the `metadata` field"), although the same guide lists "State Machine Extensions" that add "new states or transitions". The guides contradict each other and neither is the spec. [doc topics/extensions.md, L76-L78] [doc topics/extensions.md, L42-L43]
- Typical observed orders in spec examples (illustrations only): `TASK_STATE_SUBMITTED` returned immediately and later a webhook with `TASK_STATE_COMPLETED`; a stream of `TASK_STATE_WORKING` then artifact then `TASK_STATE_COMPLETED`; a blocking call returning `TASK_STATE_INPUT_REQUIRED` with an agent message. [spec §6.6, L1665] [spec §6.6, L1685] [spec §6.2, L1376-L1380] [spec §6.3, L1414-L1418]
- The non-normative request-lifecycle diagram shows a stream "Task (Submitted)", "TaskStatusUpdateEvent (Working)", two `TaskArtifactUpdateEvent`s, then "TaskStatusUpdateEvent (Completed)". It also uses stale endpoint names (`/sendMessage`, `/sendMessageStream`, "GET agent card eg: (/.well-known/agent-card)") that are not v1.0 names. [doc topics/what-is-a2a.md, L208-L212] [doc topics/what-is-a2a.md, L184] [doc topics/what-is-a2a.md, L200-L207]

### 4.3 Terminal tasks are immutable; what happens on a message to one

- A message addressed to a terminal task is an error, not a new task and not a resume: `UnsupportedOperationError`: "Messages sent to Tasks that are in a terminal state (`TASK_STATE_COMPLETED`, `TASK_STATE_FAILED`, `TASK_STATE_CANCELED`, `TASK_STATE_REJECTED`) cannot accept further messages." The same error is listed for `SendStreamingMessage`. Wire form: JSON-RPC `-32004`, HTTP `400 Bad Request`, gRPC `FAILED_PRECONDITION`. [spec §3.1.1, L175] [spec §3.1.2, L200] [spec §5.4, L1185]
- Task immutability principle (guide): "Once a task reaches a terminal state (completed, canceled, rejected, or failed), it cannot restart. Any subsequent interaction related to that task, such as a refinement, must initiate a new task within the same `contextId`." [doc topics/life-of-a-task.md, L83-L85]
- Therefore a refinement is a new message with the same `contextId` and, as a hint, `referenceTaskIds` pointing at the finished task: "Clients further hint the agent by providing references to the original task using `referenceTaskIds` in the `Message` object." The agent answers with a new `Task` or a `Message`. [doc topics/life-of-a-task.md, L74-L79] [spec §3.4.3, L638]
- Other operations on a terminal task: `SubscribeToTask` returns `UnsupportedOperationError` (not an empty stream); `CancelTask` returns `TaskNotCancelableError` (JSON-RPC `-32002`, HTTP `400`, gRPC `FAILED_PRECONDITION`); `GetTask` still works because it is "for fetching the final state of a task". [spec §3.1.6, L305] [spec §3.1.5, L278] [spec §5.4, L1183] [spec §3.1.3, L216]
- Data retention is not specified. The spec mentions tasks that are "already completed and purged" and "deleted", and a duplicate cancel "MAY return `TaskNotFoundError` if the task has already been canceled and purged", but gives no retention period or purge rule. SPEC SILENT. [spec §3.3.2, L555] [spec §3.3.2, L529] [spec §3.3.1, L496]
- Hybrid-agent guidance (guide): "Once a task is created, the agent will only return `Task` objects in response to messages sent, and once a task is complete, no more messages can be sent." This is the non-normative restatement of the rule above. [doc topics/life-of-a-task.md, L65-L67]
- Accepting extra messages on live tasks is optional: "Agents MAY accept additional messages for tasks in non-terminal states to enable multi-turn interactions". SPEC SILENT on the error for an agent that does not. [spec §3.3.3, L567]

### 4.4 Identifier rules

- `taskId` is always server-generated. "Task IDs are **server-generated** when a new task is created in response to a Message"; "Agents **MUST** generate a unique `taskId` for each new task they create"; the generated id "**MUST** be included in the Task object returned to the client". [spec §3.4.2, L610-L612]
- A client may not choose the id of a new task: "Client-provided `taskId` values for creating new tasks is **NOT** supported". A `taskId` the client does send "**MUST** reference an existing task", and the agent "**MUST** return a TaskNotFoundError if the provided `taskId` does not correspond to an existing task". [spec §3.4.2, L613-L615]
- `contextId` is optional on the client side and generated, if at all, by the server: "Agents **MAY** generate a new `contextId` when processing a Message that does not include a `contextId` field". If it does, "it **MUST** be included in the response (either Task or Message)". [spec §3.4.1, L590-L591]
- Client-supplied contextIds: "Agents **MAY** accept and preserve client-provided `contextId` values"; "If an agent cannot accept a client-provided `contextId`, it **MUST** reject the request with an error and **MUST NOT** generate a new `contextId` for the response"; "Clients **SHOULD NOT** provide a client-generated `contextId` to a server unless they understand how the server will process that `contextId`"; and "Server-generated `contextId` values **SHOULD** be treated as opaque identifiers by clients". [spec §3.4.1, L592-L595]
- SPEC SILENT on which error a rejected client `contextId` produces. Derived from the generic categories: a validation failure, so JSON-RPC `-32602`, HTTP `400`, gRPC `INVALID_ARGUMENT`. [spec §3.3.2, L518-L523]
- Both ids on one message must agree: "Agents **MUST** infer `contextId` from the task if only `taskId` is provided" and "Agents **MUST** reject messages containing mismatching `contextId` and `taskId` (i.e., the provided `contextId` is different from that of the referenced Task)." SPEC SILENT on the error type (same derivation as above). [spec §3.4.3, L627-L628]
- What a `contextId` means: it "logically groups multiple Task objects and Message objects"; "All tasks and messages with the same `contextId` **SHOULD** be treated as part of the same conversational session"; agents "**MAY** implement context expiration or cleanup policies and **SHOULD** document any such policies". [spec §3.4.1, L599-L602]
- Server messages must carry the context: "For server messages, `context_id` must be provided, and `task_id` only if a task was created." A stateless agent that answers with a bare `Message` therefore still returns a `contextId` (the proto comment is stronger than the "MAY generate" wording above). [proto L254-L256] [spec §3.4.1, L590]
- The Core Concepts guide calls `contextId` "A server-generated identifier", which is stricter than the spec text (clients may propose one). [doc topics/key-concepts.md, L100] [spec §3.4.1, L592]
- Other ids: `messageId` is "created by the message creator" (REQUIRED); `artifactId` "must be unique within a task"; the push config `id` is assigned by the server ("Created configuration with assigned ID"). SPEC SILENT on who mints `artifactId` (the agent, since agents produce artifacts). [proto L261] [proto L281] [spec §3.1.7, L326]

### 4.5 How a client continues a task, step by step

- Start: send `SendMessage` (or `SendStreamingMessage`) with a `message` that has no `taskId`. The agent replies with a `Task` (server-minted `id` and `contextId`) or a `Message`. [spec §3.1.1, L180] [spec §3.4.2, L610]
- Continue the same task (for example after `TASK_STATE_INPUT_REQUIRED`): send a new message carrying that `taskId` (and the same `contextId`, or omit it and let the server infer it). [spec §3.4.3, L633] [spec §3.4.3, L625-L627]
- Start a new task inside the same conversation: send a message with the `contextId` but no `taskId`: "Clients **MAY** use `contextId` without `taskId` to start a new task within an existing conversation context". [spec §3.4.3, L626]
- Refine or follow up on earlier work: "Clients **SHOULD** use the `referenceTaskIds` field in Message to explicitly reference related tasks", and "Agents **SHOULD** use referenced tasks to understand the context and intent of follow-up requests". [spec §3.4.3, L638-L639]
- Respond to `TASK_STATE_AUTH_REQUIRED`: send a message on the same task to "negotiate, correct, or reject the authorization request", or satisfy the request out of band; to avoid missing updates "a client SHOULD" subscribe, register a webhook or poll. [spec §7.6.2, L1941] [spec §7.6.2, L1947-L1951]
- Parallel work: "A2A supports parallel work by enabling agents to create distinct, parallel tasks for each follow-up message sent within the same `contextId`." (guide). [doc topics/life-of-a-task.md, L100-L103]
- Artifact lineage across refinements is not part of the protocol: "this linkage is not part of the A2A protocol specification. Clients should maintain this version history on their end". [doc topics/life-of-a-task.md, L125]

## 5. Streaming

### 5.1 Mechanism per binding

| Binding | how events travel | framing of one event | operations | cite |
|---|---|---|---|---|
| JSON-RPC | HTTP 200, `Content-Type: text/event-stream` (Server-Sent Events) | `data: {"jsonrpc": "2.0", "id": 1, "result": <StreamResponse>}`, one complete JSON-RPC response per event, same `id` as the request | `SendStreamingMessage`, `SubscribeToTask` | [spec §9.4.2, L2322-L2328] [spec §9.4.6, L2406] |
| HTTP+JSON | HTTP 200, `Content-Type: text/event-stream` (Server-Sent Events) | `data: <StreamResponse JSON>` | `POST /message:stream`, `SubscribeToTask` route | [spec §11.7, L2950-L2970] [spec §11.3.1, L2788] |
| gRPC | server-streaming RPC | each message is a `StreamResponse` | `SendStreamingMessage`, `SubscribeToTask` | [spec §10.4.2, L2573] [spec §10.7, L2739] [proto L33] [proto L76] |

- "gRPC streaming uses server streaming RPCs for real-time updates. The `StreamResponse` message provides a union of possible streaming events". [spec §10.7, L2739]
- REST: "REST streaming uses Server-Sent Events with the `data` field containing JSON serializations of the protocol data objects". [spec §11.7, L2950]
- JSON-RPC: "Sends a message and subscribes to real-time updates via Server-Sent Events." The `SubscribeToTask` stream uses the "same format as `SendStreamingMessage`". [spec §9.4.2, L2318] [spec §9.4.6, L2406]
- SPEC SILENT on every SSE detail beyond `data:` lines and the media type: no `event:` names, no `id:` values, no `retry:`, no keep-alive or heartbeat comments, no `Last-Event-ID` resume, no required `Accept` request header, no compression guidance. Clients must not depend on any of them. [spec §11.7, L2946-L2973]
- The request that opens the stream (`POST /message:stream`) uses `Content-Type: application/a2a+json`; the stream response uses `text/event-stream` (JSON-RPC requests use `application/json`). [spec §11.7, L2953-L2955] [spec §9.1, L2236]
- A stream is available only if the agent declares it: `AgentCard.capabilities.streaming` must be `true`. [spec §3.5.1, L666] [spec §3.3.4, L574]

### 5.2 The event wrapper and its members

- Every stream item is a `StreamResponse`: "A wrapper object used in streaming operations to encapsulate different types of response data." Exactly one of `task`, `message`, `statusUpdate`, `artifactUpdate`. [proto L789-L802] [spec §3.2.3, L463]
- "This wrapper allows streaming endpoints to return different types of updates through a single response stream while maintaining type safety." [spec §3.2.3, L463]
- Initial event: a `Task` or a `Message`. After a `Task`, "Subsequent events following a `Task` MAY include stream of" `TaskStatusUpdateEvent` and `TaskArtifactUpdateEvent` objects. [spec §3.1.2, L192-L194]
- Derived: the proto lets a `StreamResponse` carry a `message` at any point, but the §3.1.2 patterns allow a `Message` only as the sole item of a message-only stream; after a `Task`, agent text travels in `TaskStatus.message` inside status events. [proto L795-L796] [spec §3.1.2, L208-L210] [spec §3.7, L755]
- JSON samples from the spec (REST binding): `data: {"task": {"id": "task-uuid", "status": {"state": "TASK_STATE_WORKING"}}}`, then an `artifactUpdate`, then a `statusUpdate` with `TASK_STATE_COMPLETED`. Those samples omit required members (`contextId`, `artifactId`), so do not copy them as valid payloads. [spec §6.2, L1376-L1380]

### 5.3 Ordering and multiple streams

- Ordering: "All implementations MUST deliver events in the order they were generated. Events MUST NOT be reordered during transmission, regardless of protocol binding." [spec §3.5.2, L683]
- Several streams per task are legal: "An agent MAY serve multiple concurrent streams to one or more clients for the same task." When several are open: "Events MUST be broadcast to all active streams for that task", "Each stream MUST receive the same events in the same order", "Closing one stream MUST NOT affect other active streams for the same task", and "The task lifecycle is independent of any individual stream's lifecycle". [spec §3.5.2, L687-L694]
- Intended uses named by the spec: team members watching one task, "A client reconnecting to a task after a network interruption by opening a new stream", and dashboards. [spec §3.5.2, L696-L700]
- The REST section softens ordering to "Implementations SHOULD avoid re-ordering events and MAY optionally resend a final `Task` snapshot before closing." The binding-independent MUST in §3.5.2 governs. [spec §11.7, L2973] [spec §3.5.2, L683]

### 5.4 When the stream ends (the rule after `final` was removed)

- The `final` boolean of `TaskStatusUpdateEvent` no longer exists. The 1.0.0 CHANGELOG lists "Remove redundant `final` field from `TaskStatusUpdateEvent`" as a breaking change and the migration guide says to "Leverage protocol binding specific stream closure mechanism instead." The end of the stream is the only completion signal. [changelog, L24] [doc whats-new-v1.md, L72] [doc whats-new-v1.md, L470-L472]
- Rule for a Message result: "If the agent returns a Message, the stream MUST contain exactly one `Message` object and then close immediately. No task tracking or updates are provided." [spec §3.1.2, L208]
- Rule for a Task result: "If the agent returns a Task, the stream MUST begin with the Task object, followed by zero or more TaskStatusUpdateEvent or TaskArtifactUpdateEvent objects. The stream MUST close when the task reaches a terminal state (`TASK_STATE_COMPLETED`, `TASK_STATE_FAILED`, `TASK_STATE_CANCELED`, `TASK_STATE_REJECTED`)." [spec §3.1.2, L210]
- Rule for `SubscribeToTask`: "The stream MUST terminate when the task reaches a terminal state". [spec §3.1.6, L309]
- Conflict about interrupted states. Four places disagree. (a) §3.1.2 and §3.1.6 make only the four terminal states a MUST for closing. (b) The REST binding prose describes closing "until the task reaches a terminal or interrupted state, at which point the stream closes". (c) The streaming guide says "When a task reaches a terminal or interrupted state (e.g., `COMPLETED`, `FAILED`, `CANCELED`, `REJECTED`, or `INPUT_REQUIRED`), the server closes the stream and sends no further updates." (d) The in-task authorization section says the agent "SHOULD maintain any active response streams with the client after setting the TaskState to `TASK_STATE_AUTH_REQUIRED`". [spec §3.1.2, L210] [spec §3.1.6, L309] [spec §11.7, L2973] [doc topics/streaming-and-async.md, L23] [spec §7.6.1, L1931]
- Derived reading that satisfies every MUST: close on terminal states (required); do not rely on a stream staying open at `TASK_STATE_INPUT_REQUIRED` or `TASK_STATE_AUTH_REQUIRED` (some servers will close there); after any unexpected end, call `GetTask`, and if the task is not terminal call `SubscribeToTask` to resume watching. Servers that keep the stream open at `TASK_STATE_AUTH_REQUIRED` satisfy the §7.6.1 SHOULD. [spec §3.1.2, L210] [spec §7.6.1, L1931] [spec §3.1.6, L311]
- The §3.1.2 output list still names a "Final completion indicator", a leftover from the removed flag; the only defined indicator is stream closure. [spec §3.1.2, L195]
- Which errors end a stream (an error mid-stream) is not specified. SPEC SILENT on mid-stream error framing for SSE; gRPC would use a status on the stream, JSON-RPC an error object, but the spec does not describe either. [spec §9.5, L2431-L2437] [spec §10.6, L2679-L2683]

### 5.5 Reconnect and subscribe semantics

- A dropped stream does not stop the task: "The task lifecycle is independent of any individual stream's lifecycle". [spec §3.5.2, L694]
- Resume by calling `SubscribeToTask` on a non-terminal task. The first event is always the current `Task`, "representing the current state of the task at the time of subscription", so state is never lost between a `GetTask` and the subscription. [spec §3.1.6, L311]
- Events emitted while the client was disconnected are not replayed. The spec warns: "Clients using streaming to retrieve task updates MAY not receive all status update messages if the client is disconnected and then reconnects. Messages MUST NOT be considered a reliable delivery mechanism for critical information." SPEC SILENT on any event replay or cursor. [spec §3.7, L762]
- If the task finished while the client was away, `SubscribeToTask` fails with `UnsupportedOperationError`; read the final state with `GetTask` instead. [spec §3.1.6, L305] [spec §3.1.3, L216]
- Derived: `SendStreamingMessage` cannot be resumed by itself, because it is a request that creates or continues work. After a break use `SubscribeToTask` (needs the `taskId`, which the first stream event, a `Task`, carries). [spec §3.1.2, L210] [spec §3.1.6, L289]
- Persisting important content: "Agents MAY choose to persist all Messages that contain important information in the Task history to ensure clients can retrieve it later. However, clients MUST NOT rely on this behavior unless negotiated out-of-band." [spec §3.7, L764]

### 5.6 Artifact chunking (`append`, `lastChunk`)

- Fields on `TaskArtifactUpdateEvent`: `artifact` (REQUIRED, "The artifact that was generated or updated."), `append`, `lastChunk`. [proto L313-L319]
- `append` "If true, the content of this artifact should be appended to a previously sent artifact with the same ID." The match key is `Artifact.artifactId`, "unique within a task". [proto L315-L317] [proto L281]
- `lastChunk` "If true, this is the final chunk of the artifact." It marks the end of one artifact, not of the stream or the task. [proto L318-L319]
- The streaming guide describes the purpose: events are "used to stream large files or data structures in chunks, with fields like `append` and `lastChunk` to help reassemble." [doc topics/streaming-and-async.md, L21]
- SPEC SILENT: how a receiver handles `append: true` for an unseen `artifactId`; whether `append` is `false` for the first chunk; whether chunk `parts` are concatenated per part or per artifact; whether metadata of later chunks merge or replace; and whether the final `Task` snapshot must contain the fully assembled artifact. Pick a documented behavior and test against the SDKs you target. [proto L307-L322]

### 5.7 Streaming errors and gating

- `SendStreamingMessage` and `SubscribeToTask` both return `UnsupportedOperationError` when `capabilities.streaming` is false or absent, and `SubscribeToTask` also returns it for terminal tasks. [spec §3.3.4, L574] [spec §3.1.6, L303-L305]
- `returnImmediately` is ignored for streaming: "for streaming operations, which always return updates in real-time." [spec §3.2.2, L453]
- Webhooks are a separate delivery channel with their own capability flag; a client may use streaming and push at once. [spec §3.5.1, L668-L677] [spec §3.2.2, L454]


## 6. Push notifications

### 6.1 Configuration

- Push notifications are the third update channel, meant for long-running or disconnected scenarios. Definition: "Asynchronous task updates delivered via server-initiated HTTP POST requests to a client-provided webhook URL, for long-running or disconnected scenarios." [spec §2.2, L143]
- The configuration object is `TaskPushNotificationConfig` with members `tenant`, `id`, `taskId`, `url` (REQUIRED), `token`, `authentication` (`AuthenticationInfo` with `scheme` REQUIRED and `credentials`). Full table in section 2.4. [proto L468-L484] [proto L325-L332]
- Two ways to register: (1) inline in the first call as `SendMessageRequest.configuration.taskPushNotificationConfig` (its `taskId` stays empty), or (2) later with `CreateTaskPushNotificationConfig` for an existing task. [proto L147-L149] [spec §3.1.7, L318-L322] [spec §6.6, L1642-L1650]
- Management operations: create, get, list, delete (section 3.7 to 3.10). A task may have several configurations because list returns "all active push notification configurations for the specified task" with optional pagination. [spec §3.1.9, L381]
- Capability gate: when `AgentCard.capabilities.pushNotifications` is false or absent, all four configuration operations "MUST return `PushNotificationNotSupportedError`". [spec §3.3.4, L573]
- Lifetime: "The configuration MUST persist until task completion or explicit deletion." Deleting one means "No further notifications will be sent to the configured webhook after deletion." [spec §3.1.7, L335] [spec §3.1.10, L402]
- The `url` has no schema restriction in the proto, but the spec says "Webhook URLs SHOULD use HTTPS to protect payload confidentiality in transit". [proto L478-L479] [spec §13.2, L3129]

### 6.2 What the server sends

- Trigger: "When a task update occurs, the agent sends an HTTP POST request to the configured webhook URL." [spec §4.3.3, L844]
- Body: "The payload uses the same `StreamResponse` format as streaming operations, allowing push notifications to deliver the same event types as real-time streams." So the body is an object with exactly one of `task`, `message`, `statusUpdate`, `artifactUpdate`. [spec §4.3.3, L844] [spec §4.3.3, L864-L869]
- Request format given by the spec: `POST {webhook_url}` with headers `Authorization: {authentication_scheme} {credentials}` and `Content-Type: application/a2a+json`, then the JSON body. [spec §4.3.3, L848-L860]
- Regardless of the agent's own binding the webhook format is the HTTP+JSON one: "Regardless of the protocol binding being used by the agent, WebHook calls use plain HTTP and the JSON payloads as defined in the HTTP protocol binding". A JSON-RPC-only or gRPC-only agent still posts plain JSON, not a JSON-RPC envelope. [spec §3.5.1, L677]
- Worked example in the spec: a client sends `message` plus `configuration.taskPushNotificationConfig` (`url`, `authentication.scheme` `Bearer`, `authentication.credentials`); the response is a `task` in `TASK_STATE_SUBMITTED`; later the server POSTs a `statusUpdate` with `TASK_STATE_COMPLETED` carrying `Authorization: Bearer secure-client-token-for-task-aaa`. [spec §6.6, L1626-L1690]
- Which updates trigger a webhook is not specified. SPEC SILENT on whether every status and artifact event, only terminal and interrupted states, or only a final `Task` snapshot is posted. The streaming guide says "The A2A Server decides when to send a push notification, typically when a task reaches a significant state change". [spec §4.3.3, L842-L844] [doc topics/streaming-and-async.md, L54]
- After a notification the guide says the client "typically uses the `GetTask` RPC method with the `taskId` from the notification to retrieve the complete, updated `Task` object". [doc topics/streaming-and-async.md, L56]
- No ordering guarantee is stated for webhook deliveries (the ordering MUST in §3.5.2 is about streams). SPEC SILENT. [spec §3.5.2, L681-L683] [spec §4.3.3, L882-L887]

### 6.3 How the server authenticates to the webhook

- "The agent MUST include authentication credentials in the request headers as specified in the `PushNotificationConfig.authentication` field. The format follows standard HTTP authentication patterns (Bearer tokens, Basic auth, etc.)." (The named type is stale: the field is `TaskPushNotificationConfig.authentication`.) [spec §4.3.3, L873] [proto L482-L483]
- Mapping: `authentication.scheme` is an HTTP authentication scheme name "from the IANA registry" (for example `Bearer`, `Basic`, `Digest`), compared case-insensitively; `authentication.credentials` is the value whose "Format depends on the scheme (e.g., token for Bearer)". The header is `Authorization: <scheme> <credentials>`. [proto L326-L331] [spec §4.3.3, L850]
- The receiver must check that credential: "Clients MUST validate webhook authenticity using the provided authentication credentials". [spec §13.2, L3120]
- `token` ("A token unique for this task or session.") has no stated transport. SPEC SILENT on a header or body location for `token`, so the spec gives a receiver no standard way to read it. No header or body field for the token is named anywhere in the v1.0.1 spec or guides (a search of the spec and guides for the string `notification-token` finds nothing). [proto L480-L481]
- The streaming guide describes a JWT plus JWKS pattern (server signs a JWT with claims such as `iss`, `aud`, `iat`, `exp`, `jti`, `taskId`; client fetches the key by `kid`) as an example only. [doc topics/streaming-and-async.md, L96-L109]

### 6.4 Delivery guarantees and what the receiver must do

- Receiver duties: "Clients MUST respond with HTTP 2xx status codes to acknowledge successful receipt", "Clients SHOULD process notifications idempotently, as duplicate deliveries may occur", "Clients MUST validate the task ID matches an expected task", "Clients SHOULD implement appropriate security measures to verify the notification source". [spec §4.3.3, L877-L880]
- Sender duties: "Agents MUST attempt delivery at least once for each configured webhook" (so duplicates are possible); "Agents MAY implement retry logic with exponential backoff for failed deliveries"; "Agents SHOULD include a reasonable timeout for webhook requests (recommended: 10-30 seconds)"; "Agents MAY stop attempting delivery after a configured number of consecutive failures". [spec §4.3.3, L884-L887]
- SPEC SILENT: retry schedule, maximum attempts, a delivery-id or idempotency header, signature headers, size limits, and what a non-2xx response should do beyond "retry logic" being optional. [spec §4.3.3, L882-L887]
- Section 13.2 repeats and extends these (timeouts, backoff, rate limiting, unique single-purpose tokens); see section 10.4 for the full quoted list. [spec §13.2, L3103-L3134]

### 6.5 Security guidance specific to push

- SSRF: "Agents SHOULD validate webhook URLs to prevent SSRF (Server-Side Request Forgery) attacks": reject the private ranges `127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, reject localhost and link-local addresses, and "Implement URL allowlists where appropriate". [spec §13.2, L3113-L3116]
- Secrets: "Authentication tokens in `PushNotificationConfig` SHOULD be treated as secrets and rotated periodically"; "Agents SHOULD securely store push notification configurations and credentials"; "Clients SHOULD use unique, single-purpose tokens for each push notification configuration". [spec §13.2, L3130-L3132]
- Receiver hardening: "Clients SHOULD implement rate limiting to prevent webhook flooding" and "Clients SHOULD use HTTPS endpoints for webhook URLs to ensure confidentiality". [spec §13.2, L3124-L3125]

### 6.6 Relationship to streaming and polling

- The protocol offers "three complementary mechanisms": polling with `GetTask`, streaming (`SendStreamingMessage`, `SubscribeToTask`; needs `capabilities.streaming`), and push notifications (create/get/list/delete; needs `capabilities.pushNotifications`). They are independent: `returnImmediately` has "no effect" on configured push notification configurations, "which operates independently of execution mode". [spec §3.5, L648] [spec §3.5.1, L666] [spec §3.5.1, L676] [spec §3.2.2, L450-L454]
- Push is the choice for clients that cannot hold a connection: "Client does not maintain persistent connection" and "client must be reachable via HTTP". [spec §3.5.1, L671-L672]
- For `TASK_STATE_AUTH_REQUIRED` a client that has no open stream should subscribe, register a webhook or poll, "To avoid" missing updates after an out-of-band credential arrives. [spec §7.6.2, L1947-L1951]
- Delivery semantics are defined in §4.3 ("The delivery semantics and reliability guarantees are defined in Section 4.3"). [spec §3.5.3, L704]

## 7. Errors

### 7.1 The A2A-specific errors (complete list: nine)

| Error name | JSON-RPC `error.code` | HTTP status | gRPC status | `ErrorInfo.reason` (derived) | meaning (spec text) | cite |
|---|---|---|---|---|---|---|
| `TaskNotFoundError` | `-32001` | `404 Not Found` | `NOT_FOUND` | `TASK_NOT_FOUND` | "The specified task ID does not correspond to an existing or accessible task. It might be invalid, expired, or already completed and purged." | [spec §5.4, L1182] [spec §3.3.2, L555] |
| `TaskNotCancelableError` | `-32002` | `400 Bad Request` | `FAILED_PRECONDITION` | `TASK_NOT_CANCELABLE` | "An attempt was made to cancel a task that is not in a cancelable state" | [spec §5.4, L1183] [spec §3.3.2, L556] |
| `PushNotificationNotSupportedError` | `-32003` | `400 Bad Request` | `FAILED_PRECONDITION` | `PUSH_NOTIFICATION_NOT_SUPPORTED` | "Client attempted to use push notification features but the server agent does not support them" | [spec §5.4, L1184] [spec §3.3.2, L557] |
| `UnsupportedOperationError` | `-32004` | `400 Bad Request` | `FAILED_PRECONDITION` | `UNSUPPORTED_OPERATION` | "The requested operation or a specific aspect of it is not supported by this server agent implementation." | [spec §5.4, L1185] [spec §3.3.2, L558] |
| `ContentTypeNotSupportedError` | `-32005` | `400 Bad Request` | `INVALID_ARGUMENT` | `CONTENT_TYPE_NOT_SUPPORTED` | "A Media Type provided in the request's message parts or implied for an artifact is not supported by the agent or the specific skill being invoked." | [spec §5.4, L1186] [spec §3.3.2, L559] |
| `InvalidAgentResponseError` | `-32006` | `500 Internal Server Error` | `INTERNAL` | `INVALID_AGENT_RESPONSE` | "An agent returned a response that does not conform to the specification for the current method." | [spec §5.4, L1187] [spec §3.3.2, L560] |
| `ExtendedAgentCardNotConfiguredError` | `-32007` | `400 Bad Request` | `FAILED_PRECONDITION` | `EXTENDED_AGENT_CARD_NOT_CONFIGURED` | "The agent does not have an extended agent card configured when one is required for the requested operation." | [spec §5.4, L1188] [spec §3.3.2, L561] |
| `ExtensionSupportRequiredError` | `-32008` | `400 Bad Request` | `FAILED_PRECONDITION` | `EXTENSION_SUPPORT_REQUIRED` | "Server requested use of an extension marked as `required: true` in the Agent Card but the client did not declare support for it in the request." | [spec §5.4, L1189] [spec §3.3.2, L562] |
| `VersionNotSupportedError` | `-32009` | `400 Bad Request` | `FAILED_PRECONDITION` | `VERSION_NOT_SUPPORTED` | "The A2A protocol version specified in the request (via `A2A-Version` service parameter) is not supported by the agent." | [spec §5.4, L1190] [spec §3.3.2, L563] |

- The authoritative mapping table is §5.4, titled "Error Code Mappings" (rows L1182-L1190); the descriptive table is the "A2A-Specific Errors" list in §3.3.2 (L553-L563). The rule that binds them: "All A2A-specific errors defined in Section 3.3.2 **MUST** be mapped to binding-specific error representations." [spec §5.4, L1176-L1178] [spec §3.3.2, L551-L553]
- JSON-RPC reserves the A2A band: "A2A-specific errors use codes in the range `-32001` to `-32099`." Only `-32001` to `-32009` are assigned at v1.0.1. [spec §9.5, L2451]
- The `ErrorInfo.reason` column is derived from the spec's rule "The A2A error type in UPPER_SNAKE_CASE without the \"Error\" suffix (e.g., `TASK_NOT_FOUND`, `TASK_NOT_CANCELABLE`)". The spec spells out only `TASK_NOT_FOUND` and `TASK_NOT_CANCELABLE`; the other seven are mechanical applications of that rule. [spec §11.6, L2913] [spec §10.6, L2689]
- Overloaded error: `UnsupportedOperationError` is used for three unrelated situations (streaming not declared, a terminal-state task, and extended card not declared), all with the same code `-32004`, HTTP `400` and `reason` `UNSUPPORTED_OPERATION`. Clients can only tell them apart by `message` and `metadata`. [spec §3.1.1, L175] [spec §3.3.4, L574-L575] [spec §3.1.6, L305]
- `TaskNotFoundError` doubles as the error for a missing push configuration in `GetTaskPushNotificationConfig`; the spec defines no separate configuration-not-found error. [spec §3.1.8, L356]
- HTTP `400` is shared by seven A2A errors, which is why the spec adds the requirement: "Since multiple A2A error types may map to the same HTTP status code (e.g., `TaskNotCancelableError` and `PushNotificationNotSupportedError` both map to `400 Bad Request`), implementations **MUST** include a `google.rpc.ErrorInfo` object in the `details` array for A2A-specific errors". [spec §11.6, L2910]

### 7.2 Standard JSON-RPC errors the spec references

| code | name | standard message | meaning | cite |
|---|---|---|---|---|
| `-32700` | `JSONParseError` | "Invalid JSON payload" | The server received invalid JSON | [spec §9.5, L2443] |
| `-32600` | `InvalidRequestError` | "Request payload validation error" | The JSON sent is not a valid Request object | [spec §9.5, L2444] |
| `-32601` | `MethodNotFoundError` | "Method not found" | The requested method does not exist or is not available | [spec §9.5, L2445] |
| `-32602` | `InvalidParamsError` | "Invalid parameters" | The method parameters are invalid | [spec §9.5, L2446] |
| `-32603` | `InternalError` | "Internal error" | An internal error occurred on the server | [spec §9.5, L2447] |

- The generic categories also name `-32602 Invalid params` for validation errors and `-32603 Internal error` for system errors; authentication and authorization failures map to "JSON-RPC custom error" (no code assigned). [spec §3.3.2, L522] [spec §3.3.2, L535] [spec §3.3.2, L508] [spec §3.3.2, L515]

### 7.3 Generic error categories and server duties (§3.3.2)

- Authentication: "Servers **MUST** reject requests with invalid or missing authentication credentials"; SHOULD include challenge information and say which scheme is required. Examples: HTTP `401 Unauthorized`, gRPC `UNAUTHENTICATED`. [spec §3.3.2, L505-L508]
- Authorization: "Servers **MUST** return an authorization error when the authenticated client lacks required permissions" and "Servers **MUST NOT** reveal the existence of resources the client is not authorized to access". Examples: HTTP `403 Forbidden`, gRPC `PERMISSION_DENIED`. [spec §3.3.2, L512-L515]
- Validation: "Servers **MUST** validate all input parameters before processing"; examples HTTP `400 Bad Request`, gRPC `INVALID_ARGUMENT`, JSON-RPC `-32602 Invalid params`. [spec §3.3.2, L519-L522]
- Resource: "Servers **MUST** return a not found error when a requested resource does not exist or is not accessible to the authenticated client" and "Servers **SHOULD NOT** distinguish between \"does not exist\" and \"not authorized\" to prevent information leakage". Examples: HTTP `404 Not Found`, gRPC `NOT_FOUND`. [spec §3.3.2, L526-L528]
- System: SHOULD return different codes for temporary and permanent failures; MAY include retry guidance such as a `Retry-After` header; examples HTTP `500` or `503`, gRPC `INTERNAL` or `UNAVAILABLE`, JSON-RPC `-32603`. Rate-limit exceeded is listed under system errors. [spec §3.3.2, L532-L536]
- Every error, in every binding, "**MUST** convey" three things: an error code, an error message and optional error details; "Protocol bindings **MUST** map these elements to their native error representations while preserving semantic meaning." [spec §3.3.2, L540-L549]

### 7.4 Error payload shape in each binding

- Error details are an array of typed objects: "Each object in the array **MUST** include a `@type` key that identifies the object's type (using ProtoJSON `Any` representation)", and "Well-known types from the `google.rpc` error model (e.g., `ErrorInfo`, `BadRequest`) **SHOULD** be used where applicable." [spec §3.3.2, L544]
- JSON-RPC: the standard error object, with `error.code` the numeric code, `error.message` the string and `error.data` "array of objects, each containing a `@type` key". Note `data` is an array, not an object (v0.3 used an object). Example: `{"code": -32001, "message": "Task not found", "data": [{"@type": "type.googleapis.com/google.rpc.ErrorInfo", "reason": "TASK_NOT_FOUND", "domain": "a2a-protocol.org", "metadata": {"taskId": "nonexistent-task-id", "timestamp": "2025-11-09T10:30:00.000Z"}}]}`. [spec §9.5, L2433-L2437] [spec §9.5, L2483-L2503] [doc whats-new-v1.md, L775-L793]
- gRPC: `google.rpc.Status` with `status.code`, `status.message` and `status.details`. "For A2A-specific errors, implementations **MUST** include a `google.rpc.ErrorInfo` message in the `status.details` array with" `reason` ("The A2A error type in UPPER_SNAKE_CASE without the \"Error\" suffix"), `domain` set to `"a2a-protocol.org"` and optional `metadata`. [spec §10.6, L2679-L2691]
- HTTP+JSON: the JSON form of `google.rpc.Status`, wrapped in an `error` object: `{"error": {"code": 404, "status": "NOT_FOUND", "message": "...", "details": [{"@type": "type.googleapis.com/google.rpc.ErrorInfo", "reason": "TASK_NOT_FOUND", "domain": "a2a-protocol.org", "metadata": {...}}]}}`, sent with `Content-Type: application/a2a+json`. The `ErrorInfo` object MUST have `@type` `type.googleapis.com/google.rpc.ErrorInfo`, `reason` and `domain`. [spec §11.6, L2898-L2916] [spec §11.6, L2920-L2942]
- Validation errors should attach `google.rpc.BadRequest` with `fieldViolations` (`field`, `description`), for example field `message.parts` with "At least one part is required". [spec §9.5, L2455] [spec §9.5, L2466-L2477]
- The error `metadata` examples use `taskId` and `timestamp` in JSON-RPC and HTTP (camelCase) and `task_id` in the gRPC example; metadata keys are free-form. [spec §9.5, L2496] [spec §10.6, L2729] [spec §11.6, L2944]
- Stale material: the version-negotiation and validation examples in §6.4 and §6.5 still show RFC 9457 `application/problem+json` bodies (`type`, `title`, `status`, `detail`, `supportedVersions`), which contradict §11.6; the migration guide says HTTP errors changed from `application/problem+json` to `application/json`, while the §11.6 sample uses `application/a2a+json`. Follow §11.6. [spec §6.4, L1466-L1477] [spec §6.5, L1596-L1617] [doc whats-new-v1.md, L767] [spec §11.6, L2922]

### 7.5 Which operation can raise which A2A error (from §3.1 and §3.3.4)

| Operation | errors listed by the spec | cite |
|---|---|---|
| `SendMessage` | `ContentTypeNotSupportedError`, `UnsupportedOperationError` (terminal task), `TaskNotFoundError` | [spec §3.1.1, L174-L176] |
| `SendStreamingMessage` | `UnsupportedOperationError` (streaming unsupported), `UnsupportedOperationError` (terminal task), `ContentTypeNotSupportedError`, `TaskNotFoundError` | [spec §3.1.2, L199-L202] |
| `GetTask` | `TaskNotFoundError` | [spec §3.1.3, L230] |
| `ListTasks` | none specific | [spec §3.1.4, L250] |
| `CancelTask` | `TaskNotCancelableError`, `TaskNotFoundError` | [spec §3.1.5, L278-L279] |
| `SubscribeToTask` | `UnsupportedOperationError` (streaming unsupported), `TaskNotFoundError`, `UnsupportedOperationError` (terminal task) | [spec §3.1.6, L303-L305] |
| `CreateTaskPushNotificationConfig` | `PushNotificationNotSupportedError`, `TaskNotFoundError` | [spec §3.1.7, L330-L331] |
| `GetTaskPushNotificationConfig` | `PushNotificationNotSupportedError`, `TaskNotFoundError` (configuration missing) | [spec §3.1.8, L355-L356] |
| `ListTaskPushNotificationConfigs` | `PushNotificationNotSupportedError`, `TaskNotFoundError` | [spec §3.1.9, L376-L377] |
| `DeleteTaskPushNotificationConfig` | `PushNotificationNotSupportedError`, `TaskNotFoundError` | [spec §3.1.10, L397-L398] |
| `GetExtendedAgentCard` | `UnsupportedOperationError` (capability off), `ExtendedAgentCardNotConfiguredError` | [spec §3.1.11, L418-L419] |
| any operation | `VersionNotSupportedError` (bad `A2A-Version`), `ExtensionSupportRequiredError` (required extension not requested), authentication and authorization errors | [spec §3.6.2, L737] [spec §3.3.4, L576] |

## 8. Agent Card and discovery

### 8.1 Obligation and purpose

- "A2A Servers **MUST** make an Agent Card available. The Agent Card describes the server's identity, capabilities, skills, and interaction requirements." The spec does not mandate one location: the discovery mechanisms below are alternatives. [spec §8.1, L1970]
- Definition: "A JSON metadata document published by an A2A Server, describing its identity, capabilities, skills, service endpoint, and authentication requirements." [spec §2.2, L137]

### 8.2 Where the card lives and how clients find it

- Well-known URI, exact: "Accessing `https://{server_domain}/.well-known/agent-card.json`". The file name is `agent-card.json`. The path is also given in the IANA template ("URI suffix: agent-card.json", status Permanent) and in the worked example `GET /.well-known/agent-card.json HTTP/1.1`. [spec §8.2, L1978] [spec §14.3, L3328] [spec §14.3, L3337] [spec §6.9, L1826]
- What the URI must return: "The resource at this URI MUST return an AgentCard object as defined in Section 4.4.1 of the A2A specification." [spec §14.3, L3335]
- The three mechanisms named by the spec: "Well-Known URI", "Registries/Catalogs: Querying curated catalogs of agents", and "Direct Configuration: Pre-configured Agent Card URLs or content". [spec §8.2, L1976-L1980]
- The discovery guide adds detail and a limit: registries offer "Centralized management and governance." and "The current A2A specification does not prescribe a standard API for curated registries." Direct configuration is for "tightly coupled systems, private agents, or development purposes". [doc topics/agent-discovery.md, L52-L53] [doc topics/agent-discovery.md, L59] [doc topics/agent-discovery.md, L63]
- Media type of the public card response: SPEC SILENT. The only A2A media type the spec defines is `application/a2a+json` (an IANA registration template, meant for the HTTP+JSON binding), and the §6.9 sample shows no `Content-Type` for the public card. Serve valid JSON and let clients ignore the media type. The guide only says the server "returns it as a JSON response". The extended card, an ordinary HTTP+JSON operation, is shown with `Content-Type: application/a2a+json`. [spec §14.1.1, L3250] [spec §6.9, L1823-L1845] [spec §6.9, L1859-L1861] [doc topics/agent-discovery.md, L30]
- HTTPS: "Implementations SHOULD support HTTPS to ensure authenticity and integrity of the Agent Card" and the card "SHOULD NOT include sensitive credentials or internal implementation details". [spec §14.3, L3341-L3342]
- Access control on the card endpoint: the guide says a card with sensitive data "must be protected with authentication and authorization mechanisms" and recommends authenticated extended cards for sensitive details. [doc topics/agent-discovery.md, L84] [doc topics/agent-discovery.md, L92]

### 8.3 Declaring bindings: `supportedInterfaces`

- The field is REQUIRED and ordered: "Ordered list of supported interfaces. The first entry is preferred." [proto L369-L370]
- Server rules: "The `supportedInterfaces` field **SHOULD** declare all supported protocol combinations in preference order", "The first entry in `supportedInterfaces` represents the preferred interface", "Each interface **MUST** accurately declare its transport protocol and URL", and "URLs **MAY** be reused if multiple transports are available at the same endpoint". [spec §8.3.1, L1988-L1991]
- Whole card: "The AgentCard **MUST** properly declare supported protocols" and agents "**MUST** declare all supported protocols in their AgentCard". [spec §8.3, L1984] [spec §5.2, L1156]
- Client rules (all MUST): "Parse `supportedInterfaces` if present, and select the first supported transport"; "Prefer earlier entries in the ordered list when multiple options are supported"; "Use the correct URL for the selected transport"; "Set the `tenant` field in every request message to exactly the value declared in the selected `AgentInterface` entry (omit the field if `tenant` is not set in that entry)". [spec §8.3.2, L1995-L2000]
- Clients may pick any declared binding ("Clients **MAY** choose any protocol declared by the agent") and "**SHOULD** implement fallback logic for alternative protocols". [spec §5.2, L1157-L1158]
- Each `AgentInterface` has `url`, `protocolBinding`, `protocolVersion` (all REQUIRED) and optional `tenant`. The same card can list the same binding several times with different versions: "Agents CAN expose multiple interfaces for the same transport with different versions under the same or different URLs." [proto L334-L355] [spec §3.6.2, L741]
- Standard `protocolBinding` strings: `JSONRPC`, `GRPC`, `HTTP+JSON`; the sample card lists all three at different URLs with `protocolVersion` `1.0`. [proto L340-L343] [spec §8.5, L2142-L2146]
- Custom bindings: "The `protocolBinding` field in the Agent Card's `supportedInterfaces` entry **SHOULD** be a URI" (for example `https://example.com/bindings/websocket/v1`), and "When a breaking change is introduced to a binding, a new URI **MUST** be used". Official A2A bindings use the prefix `https://a2a-protocol.org/bindings/`. [spec §5.8, L1281-L1283] [spec §5.8, L1297] [doc topics/custom-protocol-bindings.md, L127-L129]
- Removed v0.3 fields: top-level `url`, `protocolVersion`, `preferredTransport`, `additionalInterfaces` are gone; the primary endpoint is `supportedInterfaces[0].url`. [doc whats-new-v1.md, L382-L388] [doc whats-new-v1.md, L406-L414]

### 8.4 Capabilities, skills, modes

- `capabilities` (REQUIRED object) holds `streaming`, `pushNotifications`, `extensions[]` and `extendedAgentCard`. A capability that is false or absent obliges the agent to refuse the related operation with the errors in section 7. [proto L411-L419] [spec §3.3.4, L571-L576]
- `skills` (REQUIRED) are descriptive: "It is largely a descriptive concept but represents a more focused set of behaviors that the agent is likely to succeed at." Each skill: `id`, `name`, `description`, `tags` REQUIRED; `examples`, `inputModes`, `outputModes`, `securityRequirements` optional. [proto L390-L393] [proto L435-L452]
- `defaultInputModes` and `defaultOutputModes` (REQUIRED, media types) apply across all skills; each skill's `inputModes`/`outputModes` override them. [proto L384-L389] [proto L446-L449]
- Other card members: `provider` (`organization`, `url`), `version` (the agent's own version string), `documentationUrl`, `iconUrl`. [proto L371-L377] [proto L396-L408]
- The extended-card flag is `capabilities.extendedAgentCard` (v0.3: top-level `supportsAuthenticatedExtendedCard`). [proto L418-L419] [spec §A.2.2, L3529-L3553]

### 8.5 Security schemes and requirements on the card

- `securitySchemes` is a map from a scheme name to a `SecurityScheme`; `securityRequirements` lists which named schemes (with scopes) are needed. Per-skill `securityRequirements` can narrow this. [proto L380-L383] [proto L450-L451]
- `SecurityScheme` variants (exactly one per object): `apiKeySecurityScheme`, `httpAuthSecurityScheme`, `oauth2SecurityScheme`, `openIdConnectSecurityScheme`, `mtlsSecurityScheme`. [proto L503-L516]
- Variant fields: API key (`location` one of query, header, cookie; `name`); HTTP auth (`scheme`, optional `bearerFormat`); OAuth2 (`flows`, optional `oauth2MetadataUrl`); OpenID Connect (`openIdConnectUrl`); mTLS (only `description`). OAuth flow kinds: `authorizationCode` (with `pkceRequired`), `clientCredentials`, `deviceCode`, plus deprecated `implicit` and `password`. [proto L518-L564] [proto L566-L645]
- PKCE: "Indicates if PKCE (RFC 7636) is required for this flow. PKCE should always be used for public clients and is recommended for all clients." [proto L592-L594]
- Transport of credentials is described in section 10. A client discovers requirements from the card: "The client discovers the server's required authentication schemes via the `securitySchemes` field in the AgentCard." [spec §7.3, L1887]
- SPEC SILENT on the AND/OR semantics of multiple requirement entries or multiple schemes inside one requirement. The proto says only that the type follows the OpenAPI 3.2 Security Scheme Object, so OpenAPI semantics are the natural reference. [proto L500-L502] [proto L494-L498]
- The §8.5 sample card uses `"security": [{ "google": ["openid", "profile", "email"] }]`, which is wrong for v1.0.1 (the field is `securityRequirements` and each entry is `{"schemes": {"google": {"list": [...]}}}`). Main corrects the sample (section 14). [spec §8.5, L2166] [main spec §8.5, L2176]

### 8.6 Agent Card signatures (JWS)

- Signing is optional: "Agent Cards **MAY** be digitally signed using JSON Web Signature (JWS) as defined in RFC 7515 to ensure authenticity and integrity." [spec §8.4, L2004]
- Canonicalization is mandatory before signing: "Before signing, the Agent Card content **MUST** be canonicalized using the JSON Canonicalization Scheme (JCS) as defined in RFC 8785." [spec §8.4.1, L2008]
- Rule 1, field presence: before canonicalization the JSON "**MUST** respect Protocol Buffer field presence semantics". Optional fields not explicitly set "**MUST** be omitted"; optional fields explicitly set to a value, even a default, "**MUST** be included"; "Fields marked with `REQUIRED` **MUST** always be present, even if the field value matches the default."; "Fields with default values **MUST** be omitted unless the field is marked as `REQUIRED` or has the `optional` keyword." [spec §8.4.1, L2012-L2016]
- Rule 2, RFC 8785: predictable (lexicographic) property ordering, consistent number and string representation, no insignificant whitespace. [spec §8.4.1, L2018-L2021]
- Rule 3: "The `signatures` field itself **MUST** be excluded from the content being signed to avoid circular dependencies." [spec §8.4.1, L2023]
- Worked canonicalization example: the fragment with `streaming: false` and `pushNotifications: false` keeps both (explicitly set optional fields), drops the empty repeated `extensions`, keeps the REQUIRED empty `description` and `skills`, and canonicalizes to `{"capabilities":{"pushNotifications":false,"streaming":false},"description":"","name":"Example Agent","skills":[]}`. [spec §8.4.1, L2025-L2056]
- Signature object: `protected` (required, base64url JSON header), `signature` (required, base64url), `header` (optional, unprotected header as a JSON object, not base64url). [spec §8.4.2, L2060-L2064]
- Protected header: "The protected header **MUST** include" `alg` (for example `ES256`, `RS256`), `typ` ("**SHOULD** be set to \"JOSE\" for JWS") and `kid`; it "**MAY** include" `jku` (JWKS URL). The `typ` line is listed under MUST but worded SHOULD, so treat `typ` as expected but tolerate its absence only if your verifier is lenient. [spec §8.4.2, L2068-L2076]
- Generation steps: (1) remove default-valued properties, exclude `signatures`, canonicalize with RFC 8785 to get the payload; (2) build and base64url-encode the protected header; (3) sign the JWS Signing Input `ASCII(BASE64URL(UTF8(JWS Protected Header)) || '.' || BASE64URL(JWS Payload))` with the `alg` key and base64url the signature; (4) assemble `AgentCardSignature`. The payload is never stored in the signature object, so verification recomputes it from the received card. [spec §8.4.2, L2078-L2098]
- Step 1 says to "Remove properties with default values", which is a looser statement than rule 1 (explicitly set optional fields and REQUIRED fields stay). Rule 1 is the precise one. [spec §8.4.2, L2081] [spec §8.4.1, L2012-L2016]
- Verification, all MUST: extract the signature from the `signatures` array; retrieve the public key "using the `kid` and `jku` (or from a trusted key store)"; remove default-valued properties; exclude `signatures`; canonicalize with RFC 8785; verify against the canonical payload. [spec §8.4.3, L2119-L2126]
- Trust rules: "Clients **SHOULD** verify at least one signature before trusting an Agent Card"; "Public keys **SHOULD** be retrieved over secure channels (HTTPS)"; "Clients **MAY** maintain a trusted key store for known agent providers"; "Expired or revoked keys **MUST NOT** be used for verification"; "Multiple signatures **MAY** be present to support key rotation". [spec §8.4.3, L2130-L2134]
- SPEC SILENT: whether the extended card (section 8.8) is signed; how a client chooses between multiple signatures; key discovery beyond `jku`/`kid`; and which algorithms are acceptable (only `ES256` and `RS256` appear as examples). [spec §8.4.2, L2070]
- The spec's own signature sample is a placeholder (`ES256`, `kid` `key-1`, `jku` `https://example.com/agent/jwks.json`) and not a verifiable test vector. [spec §8.4.2, L2104-L2115]

### 8.7 Sample card in the spec (what it shows and what is wrong)

- The §8.5 sample is a "GeoSpatial Route Planner Agent" with three `supportedInterfaces` (JSONRPC, GRPC, HTTP+JSON, all `protocolVersion` `1.0`), `provider`, `iconUrl`, `version`, `documentationUrl`, `capabilities` (`streaming`, `pushNotifications`, `extendedAgentCard` true), one OpenID Connect scheme named `google`, two skills and a `signatures` array. [spec §8.5, L2138-L2210]
- Defects to avoid copying: the sample uses the old `security` member, and its `signatures` entry is a placeholder. The card example in §4.6.1 declares `"protocolVersion": "0.3"` for an `HTTP+JSON` interface of a v1.0 card, with a trailing comma that makes the JSON invalid. [spec §8.5, L2166] [spec §4.6.1, L1013-L1018]

### 8.8 Extended Agent Card

- Flag: `AgentCard.capabilities.extendedAgentCard` ("Indicates if the agent supports providing an extended agent card when authenticated."). Operation: `GetExtendedAgentCard`; REST `GET /extendedAgentCard`. [proto L418-L419] [spec §3.1.11, L406] [spec §11.3.4, L2806]
- Access control: the operation "**MUST** require authentication" using "one of the schemes declared in the public `AgentCard.securitySchemes` and `AgentCard.security` fields" (field name stale, see 3.11). [spec §13.3, L3142-L3143]
- Content: "Agents **MAY** return different extended card content based on the authenticated client's identity or authorization level"; extended cards "**MAY** include additional skills not present in the public card", "**MAY** expose more detailed capability information (e.g., rate limits, quotas)" and "**SHOULD NOT** include sensitive information that could be exploited if leaked (e.g., internal service URLs, unmasked credentials)". [spec §13.3, L3144] [spec §13.3, L3149-L3150] [spec §13.3, L3156]
- Caching and replacement: clients "**SHOULD** replace their cached public Agent Card with the extended version for the duration of their authenticated session"; agents "**SHOULD** implement appropriate caching headers to control client-side caching of extended cards" and "**SHOULD** version extended cards appropriately and honor client cache invalidation". [spec §13.3, L3158] [spec §13.3, L3145] [spec §13.3, L3159]
- Errors: flag false or absent gives `UnsupportedOperationError`; flag true but no card configured gives `ExtendedAgentCardNotConfiguredError`. [spec §13.3, L3164-L3165]

### 8.9 Card caching

- "Servers and clients **SHOULD** use standard HTTP caching mechanisms to reduce unnecessary network overhead." [spec §8.6, L2215]
- Server side: `Cache-Control` with `max-age`; an `ETag` "derived from the Agent Card's `version` field or a hash of the card content"; optional `Last-Modified`. [spec §8.6.1, L2219-L2221]
- Client side: honor RFC 9111; when expired use conditional requests ("`If-None-Match` with the stored `ETag`, or `If-Modified-Since`"); with no caching headers clients "**MAY** apply an implementation-specific default cache duration". [spec §8.6.2, L2225-L2227]

### 8.10 Multi-agent hosting and discovery

- Several agents behind one host each "SHOULD have its own Agent Card published at an appropriate location", and clients use that card's `supportedInterfaces`, including any `tenant`. The spec does not standardize multi-card URL layouts beyond the single well-known path. [doc topics/multi-tenancy.md, L119-L123] [spec §8.2, L1978]


## 9. Protocol version negotiation and headers

### 9.1 Service parameters and how each binding carries them

- Definition: "A key-value map for passing horizontally applicable context or parameters with case-insensitive string keys and case-sensitive string values." The transport is binding-specific and "Custom protocol bindings **MUST** specify how service parameters are transmitted in their binding specification." [spec §3.2.6, L479]
- The standard service parameters are exactly two: `A2A-Extensions` ("Comma-separated list of extension URIs that the client wants to use for the request") and `A2A-Version` ("The A2A protocol version that the client is using"). [spec §3.2.6, L483-L486]
- Naming rule: "all service parameters defined by this specification will be prefixed with `a2a-`". [spec §3.2.6, L488]
- JSON-RPC binding: service parameters "MUST be transmitted using standard HTTP request headers". Names are HTTP header fields, case-insensitive, and multiple values "SHOULD be comma-separated in a single header field". [spec §9.2, L2242-L2248]
- HTTP+JSON binding: the same rule ("MUST be transmitted using standard HTTP request headers"). [spec §11.2, L2757-L2763]
- gRPC binding: "MUST be transmitted using gRPC metadata (headers)". Keys are "automatically converted to lowercase by gRPC", so on the wire they are `a2a-version` and `a2a-extensions`; implementations "MUST extract A2A service parameters from gRPC metadata" and servers "SHOULD validate required service parameters (e.g., `A2A-Version`) from metadata". [spec §10.2, L2518-L2545]
- `A2A-Version` may also be sent as a request parameter: "Clients MAY provide the `A2A-Version` as a request parameter instead of a header", shown as `GET /tasks/task-123?A2A-Version=1.0`. This conflicts with the JSON-RPC and HTTP+JSON rules that service parameters "MUST" travel in headers; send the header. [spec §3.6.1, L724-L733] [spec §9.2, L2242]
- Custom bindings must document: transmission mechanism, value constraints, reserved names and a fallback "when the protocol lacks native header support (e.g., passing service parameters in metadata)", for example a request metadata field `a2a-service-parameters`. [spec §12.3, L2999-L3009]

### 9.2 `A2A-Version`

- Format: "The value MUST be in the format `Major.Minor` (e.g., “0.3”)." Only the two leading components are used; patch numbers "SHOULD NOT be used in requests, responses and Agent Cards". [spec §14.2.1, L3297] [spec §3.6, L708]
- Client duty: "Clients MUST send the `A2A-Version` header with each request to maintain compatibility after an agent upgrades to a new version of the protocol (except for 0.3 Clients - 0.3 will be assumed for empty header)." The stated reason is also visibility: sending it "provides visibility to agents about version usage in the ecosystem". [spec §3.6.1, L712]
- Server duty: "Agents MUST process requests using the semantics of the requested `A2A-Version` (matching `Major.Minor`). If the version is not supported by the interface, agents MUST return a `VersionNotSupportedError`." [spec §3.6.2, L737]
- Empty or missing header: "Agents MUST interpret empty value as 0.3 version." So a v1.0 client that forgets the header is served v0.3 semantics, not an error. [spec §3.6.2, L739]
- Multiple versions: "Agents CAN expose multiple interfaces for the same transport with different versions under the same or different URLs." A client picks the interface whose `protocolVersion` it speaks and sends that value in `A2A-Version`. [spec §3.6.2, L741] [proto L351-L354]
- Error: `VersionNotSupportedError`, JSON-RPC `-32009`, HTTP `400 Bad Request`, gRPC `FAILED_PRECONDITION`. [spec §5.4, L1190]
- SDK and client policy: tooling "MUST provide mechanisms to help clients manage protocol versioning, such as negotiation of the transport and protocol version used", and clients that need the latest features "should be configured to request specific versions and avoid automatic fallback to older versions, to prevent silently losing functionality." [spec §3.6.3, L745]
- Several spec examples copy `A2A-Version: 0.3` into v1.0 requests (the JSON-RPC, gRPC, REST service-parameter samples and the IANA sample), and the service-parameter table lists `0.3` as the example value. A v1.0 client must send `1.0` (the §3.6.1 GET example does). [spec §3.2.6, L486] [spec §9.2, L2257] [spec §10.2, L2532] [spec §11.2, L2772] [spec §14.2.1, L3302] [spec §3.6.1, L719]
- SPEC SILENT on how a server lists the versions it supports inside the error (the stale §6.4 sample used a `supportedVersions` array; `ErrorInfo.metadata` is free-form), on whether a missing header should be warned about, and on negotiating down automatically. [spec §6.4, L1466-L1477] [spec §11.6, L2910-L2914]
- Interfaces carry the version, not the card: v1.0 moved `protocolVersion` from the top of the card into every `AgentInterface`, and the proto asks for "the latest supported minor version per major version". [doc whats-new-v1.md, L128] [proto L351-L353]

### 9.3 `A2A-Extensions`

- Value: "Comma-separated list of extension URIs that the client wants to use for the request", for example `https://example.com/extensions/geolocation/v1,https://standards.org/extensions/citations/v1`. [spec §3.2.6, L485]
- IANA template: "The A2A-Extensions header field contains a comma-separated list of extension URIs that the client wants to use for the request." [spec §14.2.2, L3318]
- Server echo of activated extensions is not in the normative spec; the extensions guide says "the response SHOULD include the `A2A-Extensions` header, listing all extensions that were successfully activated for that request." [doc topics/extensions.md, L168-L170]
- Activation and `required` handling are in section 11; the spec says clients opt in through binding-specific mechanisms. [spec §4.6.1, L1051]

### 9.4 Content types and media types

| Context | media type | strength | cite |
|---|---|---|---|
| JSON-RPC request and response | `application/json` | stated as the content type for both | [spec §9.1, L2236] |
| JSON-RPC streaming | `text/event-stream` | Server-Sent Events | [spec §9.1, L2238] [spec §9.4.2, L2322] |
| HTTP+JSON request and response | `application/a2a+json` | "SHOULD be used" | [spec §11.1, L2750] |
| HTTP+JSON streaming | `text/event-stream` | SSE response | [spec §11.7, L2965] |
| HTTP+JSON error response | `application/a2a+json` (sample) | example only | [spec §11.6, L2922] |
| Push notification POST | `application/a2a+json` | in the specified request format | [spec §4.3.3, L851] |
| gRPC | protobuf over HTTP/2 with TLS | "Serialization: Protocol Buffers version 3" | [spec §10.1, L2511-L2513] |
| Agent Card (public, at the well-known URI) | not specified | SPEC SILENT | [spec §8.2, L1978] |
| Extended Agent Card response (REST sample) | `application/a2a+json` | example only | [spec §6.9, L1859-L1861] |

- Registration text: §14.1.1 is an IANA registration template for `application/a2a+json` (type `application`, subtype `a2a+json`, "UTF-8 encoding MUST be used for JSON text", file extension `.a2a.json`). The template is "intended for submission" to IANA and uses a placeholder contact address, so do not claim the type is already registered. [spec §14.1.1, L3226-L3278] [spec §14, L3222]
- The registration says the type "is intended for the HTTP+JSON/REST binding", which is why JSON-RPC stays on `application/json`. [spec §14.1.1, L3250]
- v1.0.1 changed this area: the CHANGELOG entry is "prefer application/a2a+json in HTTP binding" (#1753). The wording is now SHOULD, not MUST, so (derived advice) a server should be tolerant of `application/json` on HTTP+JSON requests; the spec does not say so explicitly. SPEC SILENT on whether a server must accept `application/json` or must send `application/a2a+json`. [changelog, L8] [spec §11.1, L2750]
- The HTTP examples in the spec use `Content-Type: application/a2a+json` for requests and responses, and `Accept: application/json` on one GET example. [spec §6.1, L1317-L1333] [spec §3.6.1, L721]

### 9.5 Multi-tenancy (`tenant`)

- Purpose and rule, from the proto comment on `AgentInterface.tenant`: "An opaque string used for routing requests to a specific agent or tenant when multiple agents are served behind a single A2A endpoint. When set, clients MUST include this value in the `tenant` field of all request messages sent to this interface. The server is responsible for interpreting the value and routing requests accordingly; the protocol does not define its format or semantics." [proto L344-L350]
- The same rule as a client protocol-selection MUST: "Set the `tenant` field in every request message to exactly the value declared in the selected `AgentInterface` entry (omit the field if `tenant` is not set in that entry)". [spec §8.3.2, L2000]
- Every request message has the optional field: its comment says "Optional. Opaque routing identifier. Must match the `tenant` value from the selected `AgentInterface` in the Agent Card when that field is set." That includes `TaskPushNotificationConfig` (used as the create request). [proto L649-L651] [proto L470-L472]
- HTTP+JSON: the proto defines a second route for every operation with a leading `/{tenant}` path segment (for example `POST /{tenant}/message:send`, `GET /{tenant}/tasks/{id=*}`, `GET /{tenant}/extendedAgentCard`). The prose never mentions these routes. SPEC SILENT on how a body `tenant` and a path `{tenant}` interact when both are present. [proto L26] [proto L49] [proto L126] [spec §11.3.1, L2785-L2788]
- Derived: gRPC and JSON-RPC carry `tenant` as a normal field of the request message (for JSON-RPC, a member of `params`). The 1.0.0 change was "Natively Support Multi-tenancy on gRPC through an additional scope field on the request". [changelog, L38] [spec §8.3.2, L2000]
- SPEC SILENT on server behavior when `tenant` is missing or does not match a known tenant (error type, status). Derived advice: use the validation category (`INVALID_ARGUMENT`, `400`, `-32602`) or the not-found rule if the tenant is unknown, and avoid leaking tenant existence. [spec §3.3.2, L518-L528]
- Three routing styles are documented in the multi-tenancy guide: URL sub-path routing via each card's own `url`, authentication-header routing, and body routing with `tenant`. They "are not mutually exclusive". [doc topics/multi-tenancy.md, L16-L21] [doc topics/multi-tenancy.md, L109-L111]
- Client requirement restated in the guide: "The client **MUST** always echo the `tenant` value from the selected `AgentInterface` entry back in every request message." [doc topics/multi-tenancy.md, L98-L101]
- Multi-tenancy is also an authorization concern: authorization models may be based on "Organizational or tenant boundaries (multi-tenant authorization)". [spec §13.1, L3086]


### 9.6 What each standard binding requires (sections 9.1, 10.1 and 11.1, verbatim)

- "Protocol: JSON-RPC 2.0 over HTTP(S)" [spec §9.1, L2235]
- "Content-Type: `application/json` for requests and responses" [spec §9.1, L2236]
- "Method Naming: PascalCase method names matching gRPC conventions (e.g., `SendMessage`, `GetTask`)" [spec §9.1, L2237]
- "Streaming: Server-Sent Events (`text/event-stream`)" [spec §9.1, L2238]
- "Protocol: gRPC over HTTP/2 with TLS" [spec §10.1, L2511]
- "Definition: Use the normative Protocol Buffers definition in `specification/a2a.proto`" [spec §10.1, L2512]
- "Serialization: Protocol Buffers version 3" [spec §10.1, L2513]
- "Service: Implement the `A2AService` gRPC service" [spec §10.1, L2514]
- "Protocol: HTTP(S) with JSON payloads" [spec §11.1, L2749]
- "Content-Type: application/a2a+json SHOULD be used for requests and responses" [spec §11.1, L2750]
- "Methods: Standard HTTP verbs (GET, POST, PUT, DELETE)" [spec §11.1, L2751]
- "URL Patterns: RESTful resource-based URLs" [spec §11.1, L2752]
- "Streaming: Server-Sent Events for real-time updates" [spec §11.1, L2753]

### 9.7 Functional equivalence and protocol selection (sections 5.1 and 5.2, verbatim)

- "When an agent supports multiple protocols, all supported protocols MUST:" [spec §5.1, L1147]
- "Identical Functionality: Provide the same set of operations and capabilities" [spec §5.1, L1149]
- "Consistent Behavior: Return semantically equivalent results for the same requests" [spec §5.1, L1150]
- "Same Error Handling: Map errors consistently using appropriate protocol-specific codes" [spec §5.1, L1151]
- "Equivalent Authentication: Support the same authentication schemes declared in the AgentCard" [spec §5.1, L1152]
- "Agent Declaration: Agents MUST declare all supported protocols in their AgentCard" [spec §5.2, L1156]
- "Client Choice: Clients MAY choose any protocol declared by the agent" [spec §5.2, L1157]
- "Fallback Behavior: Clients SHOULD implement fallback logic for alternative protocols" [spec §5.2, L1158]

### 9.8 Custom protocol bindings (sections 5.8 and 12, verbatim)

- "Custom protocol bindings SHOULD be identified by a URI. Using a URI as the identifier provides globally unique identification across all implementers. The `protocolBinding` field in the Agent Card's `supportedInterfaces` entry SHOULD be a URI:" [spec §5.8, L1279-L1283]
- "When a breaking change is introduced to a binding, a new URI MUST be used" [spec §5.8, L1297]
- "While the A2A protocol provides three standard bindings (JSON-RPC, gRPC, and HTTP+JSON/REST), implementers MAY create custom protocol bindings to support additional transport mechanisms or communication patterns. Custom bindings MUST comply with all requirements defined in Section 5 (Protocol Binding Requirements and Interoperability). This section provides additional guidelines specific to developing custom bindings." [spec §12, L2977]
- "Custom protocol bindings MUST:" [spec §12.1, L2981]
- "Implement All Core Operations: Support all operations defined in Section 3 (A2A Protocol Operations)" [spec §12.1, L2983]
- "Preserve Data Model: Use data structures functionally equivalent to those defined in Section 4 (Protocol Data Model)" [spec §12.1, L2984]
- "Maintain Semantics: Ensure operations behave consistently with the abstract operation definitions" [spec §12.1, L2985]
- "Document Completely: Provide comprehensive documentation of the binding specification" [spec §12.1, L2986]
- "Custom bindings MUST provide clear mappings for:" [spec §12.2, L2990]
- "Protocol Buffer Types: Define how each Protocol Buffer message type is represented" [spec §12.2, L2992]
- "Timestamps: Follow the conventions in Section 5.6.1 (Timestamps)" [spec §12.2, L2993]
- "Binary Data: Specify encoding for binary content (e.g., base64 for text-based protocols)" [spec §12.2, L2994]
- "Enumerations: Define representation of enum values (e.g., strings, integers)" [spec §12.2, L2995]
- "As specified in Section 3.2.6 (Service Parameters), custom protocol bindings MUST document how service parameters are transmitted. The binding specification MUST address:" [spec §12.3, L2999]
- "Transmission Mechanism: The protocol-specific method for transmitting service parameter key-value pairs" [spec §12.3, L3001]
- "Value Constraints: Any limitations on service parameter values (e.g., character encoding, size limits)" [spec §12.3, L3002]
- "Reserved Names: Any service parameter names reserved by the binding itself" [spec §12.3, L3003]
- "Fallback Strategy: What happens when the protocol lacks native header support (e.g., passing service parameters in metadata)" [spec §12.3, L3004]
- "Custom bindings MUST:" [spec §12.4, L3013]
- "Map Standard Errors: Provide mappings for all A2A-specific error types defined in Section 3.2.2 (Error Handling)" [spec §12.4, L3015]
- "Preserve Error Information: Ensure error details are accessible to clients" [spec §12.4, L3016]
- "Use Appropriate Codes: Map to protocol-native error codes where applicable" [spec §12.4, L3017]
- "Document Error Format: Specify the structure of error responses" [spec §12.4, L3018]
- "If the binding supports streaming operations:" [spec §12.5, L3022]
- "Define Stream Mechanism: Document how streaming is implemented (e.g., WebSockets, long-polling, chunked encoding)" [spec §12.5, L3024]
- "Event Ordering: Specify ordering guarantees for streaming events" [spec §12.5, L3025]
- "Reconnection: Define behavior for connection interruption and resumption" [spec §12.5, L3026]
- "Stream Termination: Specify how stream completion is signaled" [spec §12.5, L3027]
- "If streaming is not supported, the binding MUST clearly document this limitation in the Agent Card." [spec §12.5, L3029]
- "Custom bindings MUST be declared in the Agent Card:" [spec §12.7, L3042]
- "Transport Identifier: Use a URI to identify the binding (see Section 5.8)" [spec §12.7, L3044]
- "Endpoint URL: Provide the full URL where the binding is available" [spec §12.7, L3045]
- "Custom binding implementers SHOULD:" [spec §12.8, L3062]
- "Test Against Reference: Verify behavior matches standard bindings" [spec §12.8, L3064]
- "Document Differences: Clearly note any deviations from standard binding behavior" [spec §12.8, L3065]
- "Provide Examples: Include sample requests and responses" [spec §12.8, L3066]
- "Test Edge Cases: Verify handling of error conditions, large payloads, and long-running tasks" [spec §12.8, L3067]
- Official custom binding URIs use `https://a2a-protocol.org/bindings/` and official repositories use the `cpb-` prefix (experimental: `experimental-cpb-`); SDKs "SHOULD implement official custom protocol bindings" and must keep them disabled by default. [doc topics/extension-and-binding-governance.md, L17-L21] [doc topics/extension-and-binding-governance.md, L154-L158]


## 10. Security considerations

This section quotes every RFC 2119 statement the spec makes about security, grouped by topic. Each bullet is a verbatim quote (markdown emphasis and link targets removed, inner quotation marks shown as curly quotes) with its exact location, so a manual can cite requirements without paraphrase. The spec's own consolidated security chapter is §13, with §7 (authentication and authorization), §3.3.2 (error duties) and the IANA security notes in §14 adding more. Statements from non-normative guides are marked `doc`.

- The security model in one sentence: A2A "treats agents as standard enterprise applications, relying on established web security practices. Identity information is handled at the protocol layer, not within A2A semantics." [spec §7, L1873]

### 10.1 Transport security

- "Production deployments MUST use encrypted communication (HTTPS for HTTP-based bindings, TLS for gRPC). Implementations SHOULD use modern TLS configurations (TLS 1.3+ recommended) with strong cipher suites." [spec §7.1, L1879]
- "A2A Clients SHOULD verify the A2A Server's identity by validating its TLS certificate against trusted certificate authorities (CAs) during the TLS handshake." [spec §7.2, L1883]
- "Production deployments MUST use encrypted communication (HTTPS for HTTP-based bindings, TLS for gRPC)" [spec §13.4, L3173]
- "Implementations SHOULD use modern TLS configurations (TLS 1.3+ recommended) with strong cipher suites" [spec §13.4, L3174]
- "Agents SHOULD enforce HSTS (HTTP Strict Transport Security) headers when using HTTP-based bindings" [spec §13.4, L3175]
- "Implementations SHOULD disable support for deprecated SSL/TLS versions (SSLv3, TLS 1.0, TLS 1.1)" [spec §13.4, L3176]
- "Implementations SHOULD support HTTPS to ensure authenticity and integrity of the Agent Card" [spec §14.3, L3342]
- "Credentials SHOULD be transmitted only over encrypted connections" [spec §13.4, L3188]
- "The URL where this interface is available. Must be a valid absolute HTTPS URL in production. Example: “https://api.example.com/a2a/v1”, “https://grpc.example.com/a2a”" [proto L337-L338]
- "URL to the OAuth2 authorization server metadata RFC 8414. TLS is required." [proto L547-L548]
- "The authorization URL to be used for this flow. This MUST be in the form of a URL. The OAuth2 standard requires the use of TLS" [proto L609-L610]
- gRPC runs "over HTTP/2 with TLS" and the three standard bindings are all covered by the HTTPS rule above; the guide adds that "TLS 1.2 or higher is recommended", which is weaker than the spec's "TLS 1.3+ recommended". Follow the spec. [spec §10.1, L2511] [spec §7.1, L1879] [doc topics/enterprise-ready.md, L22-L24]

### 10.2 Authentication

- "Discovery of Requirements: The client discovers the server's required authentication schemes via the `securitySchemes` field in the AgentCard." [spec §7.3, L1887]
- "Credential Acquisition (Out-of-Band): The client obtains the necessary credentials through an out-of-band process specific to the required authentication scheme." [spec §7.3, L1888]
- "Credential Transmission: The client includes these credentials in protocol-appropriate headers or metadata for every A2A request." [spec §7.3, L1889]
- "MUST authenticate every incoming request based on the provided credentials and its declared authentication requirements." [spec §7.4, L1895]
- "SHOULD use appropriate binding-specific error codes for authentication challenges or rejections." [spec §7.4, L1896]
- "SHOULD provide relevant authentication challenge information with error responses." [spec §7.4, L1897]
- "Servers MUST reject requests with invalid or missing authentication credentials" [spec §3.3.2, L505]
- "Servers SHOULD include authentication challenge information in the error response" [spec §3.3.2, L506]
- "Servers SHOULD specify which authentication scheme is required" [spec §3.3.2, L507]
- "Equivalent Authentication: Support the same authentication schemes declared in the AgentCard" [spec §5.1, L1152]
- "Server-Side Validation: The A2A server must authenticate every incoming request using the credentials provided in the HTTP headers." [doc topics/enterprise-ready.md, L47-L48]
- "`401 Unauthorized`: If the credentials are missing or invalid. This response should include a `WWW-Authenticate` header to inform the client about the supported authentication methods." [doc topics/enterprise-ready.md, L51-L53]
- "API keys, tokens, and other credentials MUST be treated as secrets" [spec §13.4, L3186]
- "Credentials SHOULD be rotated periodically" [spec §13.4, L3187]
- "Agents SHOULD implement credential revocation mechanisms" [spec §13.4, L3189]
- "Agents SHOULD log authentication failures and implement rate limiting to prevent brute-force attacks" [spec §13.4, L3190]
- The guide states that payloads carry no identity: "A2A protocol payloads, such as `JSON-RPC` messages, don't carry user or client identity information directly. Identity is established at the transport/HTTP layer." [doc topics/enterprise-ready.md, L36-L38]

### 10.3 Authorization and data scoping

- "Once authenticated, the A2A Server authorizes requests based on the authenticated identity and its own policies. Authorization logic is implementation-specific and MAY consider:" [spec §7.5, L1901]
- "Servers MUST return an authorization error when the authenticated client lacks required permissions" [spec §3.3.2, L512]
- "Servers SHOULD indicate what permission or scope is missing (without leaking sensitive information about resources the client cannot access)" [spec §3.3.2, L513]
- "Servers MUST NOT reveal the existence of resources the client is not authorized to access" [spec §3.3.2, L514]
- "Servers MUST return a not found error when a requested resource does not exist or is not accessible to the authenticated client" [spec §3.3.2, L526]
- "Servers SHOULD NOT distinguish between “does not exist” and “not authorized” to prevent information leakage" [spec §3.3.2, L527]
- "The operation MUST return only tasks visible to the authenticated client and MUST use cursor-based pagination for performance and consistency. Tasks MUST be sorted by last update time in descending order. Implementations MUST implement appropriate authorization scoping to ensure clients can only access authorized tasks. See Section 13.1 Data Access and Authorization Scoping for detailed security requirements." [spec §3.1.4, L254]
- "Implementations MUST ensure appropriate scope limitation based on the authenticated caller's authorization boundaries. This applies to all operations that access or list tasks and other resources." [spec §13.1, L3075]
- "Servers MUST implement authorization checks on every A2A Protocol Operations request" [spec §13.1, L3079]
- "Implementations MUST scope results to the caller's authorized access boundaries as defined by the agent's authorization model" [spec §13.1, L3080]
- "Even when `contextId` or other filter parameters are not specified in requests, implementations MUST scope results to the caller's authorized access boundaries" [spec §13.1, L3081]
- "`List Tasks`: MUST only return tasks visible to the authenticated client according to the agent's authorization model" [spec §13.1, L3091]
- "`Get Task`: MUST verify the authenticated client has access to the requested task according to the agent's authorization model" [spec §13.1, L3092]
- "Task-related operations (Cancel, Subscribe, Push Notification Config): MUST verify the client has appropriate access rights according to the agent's authorization model" [spec §13.1, L3093]
- "Authorization checks MUST occur before any database queries or operations that could leak information about the existence of resources outside the caller's authorization scope" [spec §13.1, L3098]
- "Agents SHOULD document their authorization model and access control policies" [spec §13.1, L3099]
- "Data and Action-Level Authorization: Agents that interact with backend systems, databases, or tools must enforce appropriate authorization before performing sensitive actions or accessing sensitive data through those underlying resources. The agent acts as a gatekeeper." [doc topics/enterprise-ready.md, L77-L80]
- "Principle of Least Privilege: Agents must grant only the necessary permissions required for a client or user to perform their intended operations through the A2A interface." [doc topics/enterprise-ready.md, L81-L83]

### 10.4 Push notification security

- "The agent MUST include authentication credentials in the request headers as specified in the `PushNotificationConfig.authentication` field. The format follows standard HTTP authentication patterns (Bearer tokens, Basic auth, etc.)." [spec §4.3.3, L873]
- "The operation MUST return configuration details including webhook URL and notification settings. The operation MUST fail if the configuration does not exist or the client lacks access." [spec §3.1.8, L360]
- "Clients MUST respond with HTTP 2xx status codes to acknowledge successful receipt" [spec §4.3.3, L877]
- "Clients SHOULD process notifications idempotently, as duplicate deliveries may occur" [spec §4.3.3, L878]
- "Clients MUST validate the task ID matches an expected task" [spec §4.3.3, L879]
- "Clients SHOULD implement appropriate security measures to verify the notification source" [spec §4.3.3, L880]
- "Agents MUST attempt delivery at least once for each configured webhook" [spec §4.3.3, L884]
- "Agents MAY implement retry logic with exponential backoff for failed deliveries" [spec §4.3.3, L885]
- "Agents SHOULD include a reasonable timeout for webhook requests (recommended: 10-30 seconds)" [spec §4.3.3, L886]
- "Agents MAY stop attempting delivery after a configured number of consecutive failures" [spec §4.3.3, L887]
- "Agents MUST include authentication credentials in webhook requests as specified in `PushNotificationConfig.authentication`" [spec §13.2, L3109]
- "Agents SHOULD implement reasonable timeout values for webhook requests (recommended: 10-30 seconds)" [spec §13.2, L3110]
- "Agents SHOULD implement retry logic with exponential backoff for failed deliveries" [spec §13.2, L3111]
- "Agents MAY stop attempting delivery after a configured number of consecutive failures" [spec §13.2, L3112]
- "Agents SHOULD validate webhook URLs to prevent SSRF (Server-Side Request Forgery) attacks:" [spec §13.2, L3113]
- "Reject private IP ranges (127.0.0.0/8, 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16)" [spec §13.2, L3114]
- "Reject localhost and link-local addresses" [spec §13.2, L3115]
- "Implement URL allowlists where appropriate" [spec §13.2, L3116]
- "Clients MUST validate webhook authenticity using the provided authentication credentials" [spec §13.2, L3120]
- "Clients SHOULD verify the task ID in the payload matches an expected task they created" [spec §13.2, L3121]
- "Clients MUST respond with HTTP 2xx status codes to acknowledge successful receipt" [spec §13.2, L3122]
- "Clients SHOULD process notifications idempotently, as duplicate deliveries may occur" [spec §13.2, L3123]
- "Clients SHOULD implement rate limiting to prevent webhook flooding" [spec §13.2, L3124]
- "Clients SHOULD use HTTPS endpoints for webhook URLs to ensure confidentiality" [spec §13.2, L3125]
- "Webhook URLs SHOULD use HTTPS to protect payload confidentiality in transit" [spec §13.2, L3129]
- "Authentication tokens in `PushNotificationConfig` SHOULD be treated as secrets and rotated periodically" [spec §13.2, L3130]
- "Agents SHOULD securely store push notification configurations and credentials" [spec §13.2, L3131]
- "Clients SHOULD use unique, single-purpose tokens for each push notification configuration" [spec §13.2, L3132]
- "Webhook URL Validation: Servers SHOULD NOT blindly trust and send POST requests to any URL provided by a client. Malicious clients could provide URLs pointing to internal services or unrelated third-party systems, leading to Server-Side Request Forgery (SSRF) attacks or acting as Distributed Denial of Service (DDoS) amplifiers." [doc topics/streaming-and-async.md, L83]
- "Authenticating to the Client's Webhook: The A2A Server MUST authenticate itself to the client's webhook URL according to the scheme specified in `PushNotificationConfig.authentication`. Common schemes include Bearer Tokens (OAuth 2.0), API keys, HMAC signatures, or mutual TLS (mTLS)." [doc topics/streaming-and-async.md, L85]
- "Authenticating the A2A Server: The webhook endpoint MUST rigorously verify the authenticity of incoming notification requests to ensure they originate from the legitimate A2A Server and not an imposter." [doc topics/streaming-and-async.md, L89]
- "Timestamps: Notifications SHOULD include a timestamp. The webhook SHOULD reject notifications that are too old." [doc topics/streaming-and-async.md, L92]

### 10.5 Extended Agent Card access control

- "Authentication: The client MUST authenticate the request using one of the schemes declared in the public `AgentCard.securitySchemes` and `AgentCard.security` fields." [spec §3.1.11, L423]
- "Card Replacement: Clients retrieving this extended card SHOULD replace their cached public Agent Card with the content received from this endpoint for the duration of their authenticated session or until the card's version changes." [spec §3.1.11, L425]
- "The `Get Extended Agent Card` operation MUST require authentication" [spec §13.3, L3142]
- "Agents MUST authenticate requests using one of the schemes declared in the public `AgentCard.securitySchemes` and `AgentCard.security` fields" [spec §13.3, L3143]
- "Agents MAY return different extended card content based on the authenticated client's identity or authorization level" [spec §13.3, L3144]
- "Agents SHOULD implement appropriate caching headers to control client-side caching of extended cards" [spec §13.3, L3145]
- "Extended cards SHOULD NOT include sensitive information that could be exploited if leaked (e.g., internal service URLs, unmasked credentials)" [spec §13.3, L3156]
- "Agents MUST validate that clients have appropriate permissions before returning privileged information in extended cards" [spec §13.3, L3157]
- "Clients retrieving extended cards SHOULD replace their cached public Agent Card with the extended version for the duration of their authenticated session" [spec §13.3, L3158]
- "Agents SHOULD version extended cards appropriately and honor client cache invalidation" [spec §13.3, L3159]
- "When `capabilities.extendedAgentCard` is `false` or not present, the operation MUST return `UnsupportedOperationError`" [spec §13.3, L3164]
- "When support is declared but no extended card is configured, the operation MUST return `ExtendedAgentCardNotConfiguredError`" [spec §13.3, L3165]

### 10.6 Agent Card integrity (signatures) and card content

- "Agent Cards MAY be digitally signed using JSON Web Signature (JWS) as defined in RFC 7515 to ensure authenticity and integrity. Signatures allow clients to verify that an Agent Card has not been tampered with and originates from the claimed provider." [spec §8.4, L2004]
- "Before signing, the Agent Card content MUST be canonicalized using the JSON Canonicalization Scheme (JCS) as defined in RFC 8785. This ensures consistent signature generation and verification across different JSON implementations." [spec §8.4.1, L2008]
- "Signature Field Exclusion: The `signatures` field itself MUST be excluded from the content being signed to avoid circular dependencies." [spec §8.4.1, L2023]
- "Clients verifying Agent Card signatures MUST:" [spec §8.4.3, L2119]
- "Extract the signature from the `signatures` array" [spec §8.4.3, L2121]
- "Retrieve the public key using the `kid` and `jku` (or from a trusted key store)" [spec §8.4.3, L2122]
- "Remove properties with default values from the received Agent Card" [spec §8.4.3, L2123]
- "Exclude the `signatures` field" [spec §8.4.3, L2124]
- "Canonicalize the resulting JSON using RFC 8785" [spec §8.4.3, L2125]
- "Verify the signature against the canonicalized payload" [spec §8.4.3, L2126]
- "Clients SHOULD verify at least one signature before trusting an Agent Card" [spec §8.4.3, L2130]
- "Public keys SHOULD be retrieved over secure channels (HTTPS)" [spec §8.4.3, L2131]
- "Expired or revoked keys MUST NOT be used for verification" [spec §8.4.3, L2133]
- "The Agent Card MAY contain public information about an agent's capabilities and SHOULD NOT include sensitive credentials or internal implementation details" [spec §14.3, L3341]
- "Clients SHOULD verify signatures when present to ensure the Agent Card has not been tampered with" [spec §14.3, L3344]
- "Extended Agent Cards retrieved via authenticated endpoints (Section 3.1.11) MAY contain additional information and MUST enforce appropriate access controls" [spec §14.3, L3345]

### 10.7 In-task authorization (`TASK_STATE_AUTH_REQUIRED`)

- "To request that a client fulfills an authorization request, the agent:" [spec §7.6.1, L1923]
- "MUST use a Task to track the operation it is performing" [spec §7.6.1, L1925]
- "MUST transition the TaskState to `TASK_STATE_AUTH_REQUIRED`" [spec §7.6.1, L1926]
- "MUST include a TaskStatus message explaining the required authorization, unless the details of the authorization have been negotiated out-of-band or via an extension" [spec §7.6.1, L1927]
- "Agents MUST arrange to receive credentials via an out-of-band means, unless an in-band mechanism has been negotiated out-of-band or via an extension." [spec §7.6.1, L1929]
- "If the credential is received out-of-band, the agent SHOULD maintain any active response streams with the client after setting the TaskState to `TASK_STATE_AUTH_REQUIRED`. The agent MAY immediately continue Task processing after receiving the credential, without a requirement that clients send a follow-up message." [spec §7.6.1, L1931]
- "Agents SHOULD support receiving messages directed to the Task while the Task remains in `TASK_STATE_AUTH_REQUIRED`. This enables clients to negotiate, correct, or reject an authorization request." [spec §7.6.1, L1933]
- "If the client is itself an A2A agent actively processing a Task, the client may further delegate the authorization request to its client by transitioning its own Task to `TASK_STATE_AUTH_REQUIRED`. The client SHOULD follow all In-Task Authorization Agent Responsibilities. This enables forming a chain of Tasks in `TASK_STATE_AUTH_REQUIRED`." [spec §7.6.2, L1945]
- "Clients may not be aware of when the agent receives credentials out-of-band and subsequently continues Task processing. If a client does not have an active response stream open with the agent, the client risks missing Task updates. To avoid this, a client SHOULD perform one of the following:" [spec §7.6.2, L1947]
- "Agents SHOULD receive credentials for in-task authorization requests out of band via a secure channel, such as HTTPS. This ensures that credentials are provided directly to the agent." [spec §7.6.3, L1955]
- "In-band credential exchange may be negotiated via out-of-band means or by using extensions. In-band credential exchange can allow credentials to be passed across chains of multiple A2A agents, exposing those credentials to each agent participating in the chain." [spec §7.6.3, L1957]
- "Credentials SHOULD be bound to the agent which originated the request, such that only this agent is able to use the credentials. This ensures that credentials propagating through a chain of A2A requests are only usable by the requesting agent." [spec §7.6.3, L1961]
- "Credentials containing sensitive information SHOULD be only readable by the agent which originated the request, such as by encrypting the credential." [spec §7.6.3, L1962]

### 10.8 Input validation, limits and file or URL content

- "Servers MUST validate all input parameters before processing" [spec §3.3.2, L519]
- "Agents MUST validate all input parameters before processing" [spec §13.4, L3180]
- "Agents SHOULD implement appropriate limits on message sizes, file sizes, and request complexity" [spec §13.4, L3181]
- "Agents SHOULD sanitize or validate file content types and reject unexpected media types" [spec §13.4, L3182]
- "Content MUST be validated against the A2A protocol schema before processing" [spec §14.1.1, L3243]
- "Implementations MUST sanitize user-provided content to prevent injection attacks" [spec §14.1.1, L3244]
- "File references within A2A messages MUST be validated to prevent server-side request forgery (SSRF)" [spec §14.1.1, L3245]
- "Encoding considerations: Binary (UTF-8 encoding MUST be used for JSON text)" [spec §14.1.1, L3238]
- "The `raw` byte content of a file. In JSON serialization, this is encoded as a base64 string." [proto L228]
- "A `url` pointing to the file's content." [proto L230]

### 10.9 Credentials, logging, audit, rate limiting, privacy

- "Agents SHOULD log security-relevant events (authentication failures, authorization denials, suspicious requests)" [spec §13.4, L3194]
- "Agents SHOULD implement monitoring for unusual patterns (rapid task creation, excessive cancellations)" [spec §13.4, L3195]
- "Agents SHOULD provide audit trails for sensitive operations" [spec §13.4, L3196]
- "Logs MUST NOT include sensitive information (credentials, personal data) unless required and properly protected" [spec §13.4, L3197]
- "Agents SHOULD implement rate limiting on all operations" [spec §13.4, L3201]
- "Agents SHOULD return appropriate error responses when rate limits are exceeded" [spec §13.4, L3202]
- "Agents MAY implement different rate limits for different operations or user tiers" [spec §13.4, L3203]
- "Agents MUST comply with applicable data protection regulations" [spec §13.4, L3207]
- "Agents SHOULD provide mechanisms for users to request deletion of their data" [spec §13.4, L3208]
- "Agents SHOULD implement appropriate data retention policies" [spec §13.4, L3209]
- "Agents SHOULD minimize logging of sensitive or personal information" [spec §13.4, L3210]

### 10.10 Messages, history and artifacts as a data-protection surface

- "Messages SHOULD NOT be used to deliver task outputs. Results SHOULD BE returned using Artifacts associated with a Task. This separation allows for a clear distinction between communication (Messages) and data output (Artifacts)." [spec §3.7, L758]
- "The Task History field contains Messages exchanged during task execution. However, not all Messages are guaranteed to be persisted in the Task history; for example, transient informational messages may not be stored. Messages exchanged prior to task creation may not be stored in Task history. The agent is responsible to determine which Messages are persisted in the Task History." [spec §3.7, L760]
- "Clients using streaming to retrieve task updates MAY not receive all status update messages if the client is disconnected and then reconnects. Messages MUST NOT be considered a reliable delivery mechanism for critical information." [spec §3.7, L762]
- "Agents MAY choose to persist all Messages that contain important information in the Task history to ensure clients can retrieve it later. However, clients MUST NOT rely on this behavior unless negotiated out-of-band." [spec §3.7, L764]
- "Sensitive information in task history and artifacts MUST be protected according to applicable data protection regulations" [spec §14.1.1, L3247]
- "Sensitivity Awareness: Implementers must be acutely aware of the sensitivity of data exchanged in Message and Artifact parts of A2A interactions." [doc topics/enterprise-ready.md, L90-L92]
- "Compliance: Ensure compliance with relevant data privacy regulations such as GDPR, CCPA, and HIPAA, based on the domain and data involved." [doc topics/enterprise-ready.md, L93-L94]
- "Data Minimization: Avoid including or requesting unnecessarily sensitive information in A2A exchanges." [doc topics/enterprise-ready.md, L95-L96]
- "Secure Handling: Protect data both in transit, using TLS as mandated, and at rest if persisted by agents, according to enterprise data security policies and regulatory requirements." [doc topics/enterprise-ready.md, L97-L99]

### 10.11 Custom bindings and extensions

- "Custom protocol bindings MUST address security considerations in their specification" [spec §13.4, L3214]
- "Custom bindings SHOULD follow the same security principles as standard bindings" [spec §13.4, L3215]
- "Custom bindings MUST document authentication integration and credential transmission" [spec §13.4, L3216]
- "Custom bindings MUST:" [spec §12.6, L3033]
- "Support Standard Schemes: Implement authentication schemes declared in the Agent Card" [spec §12.6, L3035]
- "Document Integration: Specify how credentials are transmitted in the protocol" [spec §12.6, L3036]
- "Handle Challenges: Define how authentication challenges are communicated" [spec §12.6, L3037]
- "Maintain Security: Follow security best practices for the transport protocol" [spec §12.6, L3038]
- "Input Validation: Any new data fields, parameters, or methods introduced by an extension MUST be rigorously validated. Treat all extension-related data from an external party as untrusted input." [doc topics/extensions.md, L267-L269]
- "Scope of Required Extensions: Be mindful when marking an extension as `required: true` in an Agent Card. This creates a hard dependency for all clients and should only be used for extensions fundamental to the agent's core function and security (for example, a message signing extension)." [doc topics/extensions.md, L270-L274]
- "Authentication and Authorization: If an extension adds new methods, the implementation MUST ensure these methods are subject to the same authentication and authorization checks as the core A2A methods. An extension MUST NOT provide a way to bypass the agent's primary security controls." [doc topics/extensions.md, L275-L279]


## 11. Extensions

### 11.1 What an extension is

- Spec definition: "A mechanism for agents to provide additional functionality or data beyond the core A2A specification." Extensions are for "additional functionality or data beyond the core specification while maintaining backward compatibility and interoperability". [spec §2.2, L145] [spec §4.6, L1000]
- Stated goals: let agents declare "protocol enhancements or vendor-specific features", keep compatibility with clients that do not support a given extension, enable "innovation through experimental or domain-specific features without modifying the core protocol", and give community features a path into the core. [spec §4.6, L1000]
- The extensions guide: "Extensions are identified by a URI and defined by their own specification. Anyone is able to define, publish, and implement an extension." [doc topics/extensions.md, L12-L13]

### 11.2 Declaration (Agent Card)

- Agents declare support in the card: "Agents declare their supported extensions in the AgentCard using the `extensions` field, which contains an array of AgentExtension objects." In the v1.0 model that array is `capabilities.extensions`, as the spec's own example shows. [spec §4.6.1, L1004] [spec §4.6.1, L1019-L1034] [proto L416-L417]
- Each `AgentExtension` has `uri` ("The unique URI identifying the extension."), `description` ("A human-readable description of how this agent uses the extension."), `required` ("If true, the client must understand and comply with the extension's requirements.") and `params` ("Optional. Extension-specific configuration parameters." a JSON object). None is annotated REQUIRED. [proto L423-L432]
- The extensions guide shows `params` carrying extension data inside the declaration, for example a `hints` array. Its example card still uses a top-level `"url"`; the card must use `supportedInterfaces` (fixed on main). [doc topics/extensions.md, L96-L108] [doc topics/extensions.md, L93]
- URI conventions: official extensions use the prefix `https://a2a-protocol.org/extensions/` and live in repositories prefixed `ext-` (experimental: `experimental-ext-`); third parties use their own URIs. [doc topics/extensions.md, L56-L60] [doc topics/extension-and-binding-governance.md, L17-L21]
- Versioning in the URI: "Extensions **SHOULD** include version information in their URI identifier. This allows clients and agents to negotiate compatible versions of extensions during interactions. A new URI **MUST** be created for breaking changes to an extension." [spec §4.6.3, L1139]

### 11.3 Activation per request

- The client opts in on each request: "Clients indicate their desire to opt into the use of specific extensions through binding-specific mechanisms such as HTTP headers, gRPC metadata, or JSON-RPC request parameters that identify the extension identifiers they wish to utilize during the interaction." [spec §4.6.1, L1051]
- The concrete mechanism is the `A2A-Extensions` service parameter: an HTTP header (JSON-RPC and HTTP+JSON bindings) or lowercase gRPC metadata key `a2a-extensions`, with a comma-separated list of URIs. (Despite the §4.6.1 wording, §9.2 puts JSON-RPC service parameters in HTTP headers, not in `params`.) [spec §3.2.6, L485] [spec §9.2, L2242-L2248] [spec §10.2, L2518-L2524]
- Example from the spec: `POST /message:send` with `A2A-Extensions: https://example.com/extensions/geolocation/v1,https://standards.org/extensions/citations/v1`, and a message whose `extensions` array and `metadata` map are keyed by the extension URI. [spec §4.6.1, L1055-L1075]
- Two separate lists exist: the request-level `A2A-Extensions` header (what the client activates for this call) and the object-level `extensions` arrays on `Message` and `Artifact` (which extensions are "present or contributed to" that object). Their relationship is not spelled out; the spec's example sets both. [proto L273-L274] [proto L291-L292] [spec §4.6.1, L1060-L1066]
- Default state (guide): "Extensions default to being inactive, providing a baseline experience for extension-unaware clients." The agent identifies supported extensions in the request and performs the activation; "Any requested extensions not supported by the agent can be ignored." [doc topics/extensions.md, L158-L167]
- Response echo (guide, not spec): "the response SHOULD include the `A2A-Extensions` header, listing all extensions that were successfully activated for that request." The normative spec does not define a response header. [doc topics/extensions.md, L168-L170]

### 11.4 Where extension data goes (extension points)

- Message extensions: "Messages can be extended to allow clients to provide additional strongly typed context or parameters relevant to the message being sent, or TaskStatus Messages to include extra information about the task's progress." The pattern is `extensions: [uri]` plus `metadata: { "<uri>": {...} }`. [spec §4.6.2, L1083] [spec §4.6.2, L1087-L1103]
- Artifact extensions: "Artifacts can include extension data to provide strongly typed context or metadata about the generated content." [spec §4.6.2, L1107] [spec §4.6.2, L1111-L1135]
- Request-level `metadata` on `SendMessageRequest` and `CancelTaskRequest`, and `metadata` on Task, Message, Part, Artifact and the stream events, are the free-form slots; the guide says extensions "should place custom attributes in the `metadata` map present on core data structures". [proto L656-L657] [proto L721-L722] [doc topics/extensions.md, L72-L75]
- Guide-listed scopes of extensions (non-normative): data-only, profile, method (new RPC methods), and state-machine extensions. [doc topics/extensions.md, L24-L43]
- Guide-listed limits: extensions may not change "the Definition of Core Data Structures" and may not add new enum values ("Extensions should use existing enum values and annotate additional semantic meaning in the `metadata` field"). That conflicts with the same guide's "State Machine Extensions" bullet. [doc topics/extensions.md, L69-L78] [doc topics/extensions.md, L42-L43]

### 11.5 `required: true`

- Meaning in the proto: "If true, the client must understand and comply with the extension's requirements." [proto L428-L429]
- Server duty when the client did not opt in: "When a server requests use of an extension marked as `required: true` in the Agent Card but the client does not declare support for it, the agent **MUST** return `ExtensionSupportRequiredError`." Wire form: JSON-RPC `-32008`, HTTP `400 Bad Request`, gRPC `FAILED_PRECONDITION`, `ErrorInfo.reason` `EXTENSION_SUPPORT_REQUIRED` (derived). [spec §3.3.4, L576] [spec §5.4, L1189]
- Version mismatch rule: "If a client requests a versions of an extension that the agent does not support, the agent **SHOULD** ignore the extension for that interaction and proceed without it, unless the extension is marked as `required` in the AgentCard, in which case the agent **MUST** return an error indicating unsupported extension. It **MUST NOT** fall back to a previous version of the extension automatically." [spec §4.6.3, L1141]
- The phrase `declares support` is not defined precisely. Derived: the only per-request declaration channel the spec defines is the `A2A-Extensions` service parameter, so a client satisfies `required` by listing the URI there. [spec §3.2.6, L485] [spec §3.3.4, L576]
- Guidance on use (guide): "Agents shouldn't mark data-only extensions as required"; marking one required "creates a hard dependency for all clients and should only be used for extensions fundamental to the agent's core function and security (for example, a message signing extension)". [doc topics/extensions.md, L129] [doc topics/extensions.md, L270-L274]
- Clients should read the card before calling: "Clients **SHOULD** validate capability support by examining the Agent Card before attempting operations that require optional capabilities." [spec §3.3.4, L578]

### 11.6 Governance and SDK behavior

- Tiers: official (`ext-*`, URI prefix `https://a2a-protocol.org/extensions/`) and experimental (`experimental-ext-*`). Official extension specifications "MUST use the same language as the core specification" (RFC 2119), be Apache 2.0, and have at least one reference implementation. [doc topics/extension-and-binding-governance.md, L17-L35]
- SDKs: "Extensions MUST be disabled by default and require explicit opt-in", and "Extension support is not required for protocol conformance". [doc topics/extension-and-binding-governance.md, L149] [doc topics/extension-and-binding-governance.md, L152]
- Breaking changes need a new identifier: "Breaking changes require a new identifier". [doc topics/extension-and-binding-governance.md, L126]
- Extension specification contents (guide): the URIs, the schema of `params`, schemas of added data structures, and new flows or endpoints; extensions can depend on other extensions and "It is the client's responsibility to activate an extension and all its required dependencies". [doc topics/extensions.md, L135-L154]
- Extension security (guide): "Any new data fields, parameters, or methods introduced by an extension MUST be rigorously validated", and "An extension MUST NOT provide a way to bypass the agent's primary security controls." [doc topics/extensions.md, L267-L269] [doc topics/extensions.md, L275-L279]

### 11.7 Extensions versus custom protocol bindings

- Extensions change behavior on an existing transport; custom bindings change the transport itself: "Extensions modify the *behavior* of protocol interactions by adding new data, methods, or state transitions on top of an existing transport. Custom protocol bindings change the *transport layer* itself". [doc topics/custom-protocol-bindings.md, L8-L12]
- A custom binding is declared in `supportedInterfaces` with a URI as `protocolBinding`; all core operations, the data model, error mapping, streaming rules and service-parameter transmission must be specified (section 12 of the spec). [spec §5.8, L1279-L1283] [spec §12, L2977] [spec §12.1, L2981-L2986]


## 12. Sharp edges

### 12.1 Rules a builder can break silently (40)

Each item gives the rule, then what goes wrong if it is missed. Items marked "unresolved" are spec defects where the sources disagree (full register in 12.2).

1. **Task ids are server-minted.** "Client-provided `taskId` values for creating new tasks is **NOT** supported", and a `taskId` in a message "**MUST** reference an existing task" or the agent returns `TaskNotFoundError`. Breaks: clients that pre-generate task ids and expect the server to adopt them get errors; servers that adopt them become non-interoperable. [spec §3.4.2, L613-L615]
2. **A rejected `contextId` must not be replaced.** "If an agent cannot accept a client-provided `contextId`, it **MUST** reject the request with an error and **MUST NOT** generate a new `contextId` for the response". Breaks: servers that quietly start a new context, silently splitting a conversation. [spec §3.4.1, L593]
3. **`taskId` and `contextId` must agree.** "Agents **MUST** infer `contextId` from the task if only `taskId` is provided" and "**MUST** reject messages containing mismatching `contextId` and `taskId`". Breaks: servers that trust whichever id they read first. The error type is unspecified. [spec §3.4.3, L627-L628]
4. **`messageId` is REQUIRED and minted by the sender.** "The unique identifier (e.g. UUID) of the message. This is created by the message creator." Several spec examples omit it; do not copy them. Breaks: servers that generate message ids for client messages, which defeats the duplicate detection §3.3.1 allows. [proto L261-L262] [spec §3.3.1, L495]
5. **Server messages and stream events carry `contextId`.** The `Message` comment says "For server messages, `context_id` must be provided", and both stream event messages mark `context_id` REQUIRED, while `Task.context_id` is not annotated. Breaks: stateless agents that answer with a bare `Message` and no `contextId`, and servers that cannot stream a task for lack of a context id. [proto L254-L256] [proto L299-L300] [proto L311-L312]
6. **Terminal tasks are immutable.** Messages to `TASK_STATE_COMPLETED`, `FAILED`, `CANCELED` or `REJECTED` tasks "cannot accept further messages" and yield `UnsupportedOperationError`; the guide adds that a refinement "must initiate a new task within the same `contextId`". Breaks: servers that reopen a finished task, clients that retry on the same task id. [spec §3.1.1, L175] [doc topics/life-of-a-task.md, L83-L85]
7. **Subscribing to a finished task is an error.** `SubscribeToTask` returns `UnsupportedOperationError` for terminal tasks rather than an empty stream. Breaks: reconnect loops that never fall back to `GetTask`. [spec §3.1.6, L305] [proto L74-L75]
8. **Cancel has two statements that do not line up.** `CancelTask` on a terminal task is `TaskNotCancelableError`, yet "Cancel Task operations are idempotent" and a repeat "MAY return `TaskNotFoundError` if the task has already been canceled and purged". Breaks: clients that treat a second cancel as success, or as failure. Unresolved. [spec §3.1.5, L278] [spec §3.3.1, L496]
9. **Know the two sets: terminal (4) and interrupted (2).** Terminal: COMPLETED, FAILED, CANCELED, REJECTED. Interrupted: INPUT_REQUIRED, AUTH_REQUIRED. `REJECTED` is the one most often forgotten and is terminal. Breaks: clients that poll forever on a rejected task. [proto L194-L207] [spec §3.1.2, L210]
10. **`SendMessage` blocks by default.** With `returnImmediately` false or unset the operation "MUST wait until the task reaches a terminal state" (or "an interrupted state") before returning, and the response "MUST include the latest task state with all artifacts and status information". Breaks: clients that assume an immediate `Task`; servers that return `TASK_STATE_SUBMITTED` by default. §3.1.1 contradicts this (see 12.2 D2). [spec §3.2.2, L446] [proto L155-L160]
11. **Blocking returns at interrupted states too, and `returnImmediately` has limited reach.** A blocking call returns as soon as the task is `TASK_STATE_INPUT_REQUIRED` or `TASK_STATE_AUTH_REQUIRED`. The flag has "no effect" when the reply is a `Message`, for streaming, or on push configs. Breaks: clients that wait for COMPLETED and never send the follow-up the agent asked for. [spec §3.2.2, L446] [spec §3.2.2, L450-L454]
12. **Message or Task is the agent's choice; there is no rule.** "The agent MAY create a new `Task` to process the provided message asynchronously or MAY return a direct `Message` response for simple interactions". Clients must handle both result shapes on every send. Breaks: clients that always dereference `result.task`. [spec §3.1.1, L180] [proto L778-L787]
13. **Streams end on terminal states; there is no `final` flag.** "The stream MUST close when the task reaches a terminal state". Whether a stream also closes at an interrupted state is stated inconsistently (REST text and the guide say yes, §7.6.1 says SHOULD keep it open for `TASK_STATE_AUTH_REQUIRED`). Breaks: clients that wait for a `final: true` event, or that treat any close as completion. Unresolved. [spec §3.1.2, L210] [spec §11.7, L2973] [spec §7.6.1, L1931] [changelog, L24]
14. **`SubscribeToTask` starts with a `Task` snapshot and does not replay.** "The operation MUST return a `Task` object as the first event in the stream"; missed events are not re-sent ("MAY not receive all status update messages"). Breaks: clients that expect a replay cursor or that treat the first event as an update. [spec §3.1.6, L311] [spec §3.7, L762]
15. **A message-only stream has exactly one item.** "the stream MUST contain exactly one `Message` object and then close immediately." Breaks: servers that keep the stream open after a direct reply, and clients that wait for a `Task` that never comes. [spec §3.1.2, L208]
16. **Events keep order, and every stream sees every event.** "Events MUST NOT be reordered", "Each stream MUST receive the same events in the same order", and closing one stream must not affect others. Breaks: servers that fan out through lossy queues or that cancel a task when one watcher disconnects. [spec §3.5.2, L683] [spec §3.5.2, L691-L694]
17. **Artifact chunk handling is only half specified.** `append` means "should be appended to a previously sent artifact with the same ID"; `lastChunk` ends one artifact, not the stream. Behavior on first chunk, unknown id and metadata merge is unspecified. Breaks: receivers that overwrite on every chunk, or that treat `lastChunk` as end of task. [proto L315-L319]
18. **SSE framing is minimal and JSON-RPC wraps every event.** Streams are `text/event-stream` with `data:` lines; on JSON-RPC each `data:` payload is a full JSON-RPC response (`jsonrpc`, `id`, `result`), on REST it is the bare `StreamResponse`. No `event:`, `id:` or keep-alive rules exist. Breaks: parsers that expect the REST shape on JSON-RPC streams or rely on `Last-Event-ID`. [spec §9.4.2, L2322-L2328] [spec §11.7, L2950-L2970]
19. **Streaming capability gates two operations.** With `capabilities.streaming` false or absent both `SendStreamingMessage` and `SubscribeToTask` "MUST return `UnsupportedOperationError`". Breaks: servers that gate only the send call. [spec §3.3.4, L574]
20. **Webhook bodies are wrapped `StreamResponse` objects in HTTP+JSON form for every agent.** A push body is `{"statusUpdate": {...}}` (or `task`, `message`, `artifactUpdate`) sent with `Content-Type: application/a2a+json`, "Regardless of the protocol binding being used by the agent". Breaks: JSON-RPC agents that post a JSON-RPC envelope, receivers that expect a bare `Task`. [spec §4.3.3, L848-L860] [spec §3.5.1, L677]
21. **Push authentication is `Authorization: <scheme> <credentials>`, and `token` has no transport.** "The agent MUST include authentication credentials in the request headers as specified in" the `authentication` field. The separate `token` field has no defined header or body slot. Breaks: receivers that wait for a token header that the spec never defines. [spec §4.3.3, L850] [spec §4.3.3, L873] [proto L480-L481]
22. **Webhook delivery is at least once.** "Agents MUST attempt delivery at least once", so duplicates occur; receivers "MUST respond with HTTP 2xx", "MUST validate the task ID matches an expected task" and should be idempotent. Breaks: receivers that act twice, or that return 3xx or 4xx for acknowledgements and trigger endless retries. [spec §4.3.3, L877-L879] [spec §4.3.3, L884]
23. **Validate webhook URLs (SSRF).** Agents "SHOULD validate webhook URLs to prevent SSRF" by rejecting private ranges (`127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), localhost and link-local addresses; webhook URLs "SHOULD use HTTPS". Breaks: servers that post to any URL a client supplies. [spec §13.2, L3113-L3116] [spec §13.2, L3129]
24. **Push configuration rules are easy to under-implement.** All four config operations need `capabilities.pushNotifications` ("MUST return `PushNotificationNotSupportedError`"), a missing configuration is reported as `TaskNotFoundError`, the config "MUST persist until task completion or explicit deletion", and delete "MUST be idempotent". Breaks: servers that return a custom not-found, or that fail the second delete. [spec §3.3.4, L573] [spec §3.1.8, L356] [spec §3.1.7, L335] [spec §3.1.10, L402]
25. **Pick the interface from the ordered list and echo its `tenant`.** `supportedInterfaces` is ordered with the first entry preferred; clients "select the first supported transport" and must "Set the `tenant` field in every request message to exactly the value declared in the selected `AgentInterface` entry". Breaks: clients that read a top-level `url` (removed in v1.0) or that omit the tenant. [proto L369-L370] [spec §8.3.2, L1997-L2000]
26. **Card security fields have new names and shapes.** The members are `securitySchemes` and `securityRequirements`; a requirement is `{"schemes": {"<name>": {"list": [scopes]}}}`. The v1.0.1 sample and two prose sentences still say `security` with the old array-of-arrays shape. Breaks: cards that clients cannot parse, or clients that never find requirements. [proto L380-L383] [proto L488-L498] [spec §8.5, L2166]
27. **Card signing is easy to get subtly wrong.** The card must be canonicalized with RFC 8785 after applying field-presence rules: REQUIRED fields always present even at default, explicitly set `optional` fields present, everything else at default omitted, and `signatures` excluded. `kid` and `alg` MUST be in the protected header. Breaks: signing a stock-serializer dump that emits defaults, so every verifier fails. [spec §8.4.1, L2012-L2023] [spec §8.4.2, L2068-L2071]
28. **The well-known path is `/.well-known/agent-card.json`.** The spec defines no media type for the card response. Breaks: clients that probe a different file name or insist on a particular `Content-Type`. [spec §8.2, L1978] [spec §14.3, L3328]
29. **The extended card is a flag plus an authenticated operation.** `capabilities.extendedAgentCard` true is required; the call needs credentials for a scheme declared in the public card; clients should replace their cached card for the session. Breaks: calling it unauthenticated or looking for the old top-level flag. [spec §3.1.11, L406] [spec §3.1.11, L425] [spec §A.2.2, L3531]
30. **Clients MUST send `A2A-Version`; empty means 0.3.** "Clients MUST send the `A2A-Version` header with each request" and "Agents MUST interpret empty value as 0.3 version." Breaks: v1.0 clients that omit the header and get v0.3 behavior (not an error), servers that treat a missing header as latest. Several spec samples send `0.3`. [spec §3.6.1, L712] [spec §3.6.2, L739]
31. **Content types differ by binding.** JSON-RPC uses `application/json`; HTTP+JSON "SHOULD" use `application/a2a+json` (v1.0.1 changed the preference); SSE is `text/event-stream`; errors are not `application/problem+json` any more. Breaks: JSON-RPC servers demanding `application/a2a+json`, REST servers rejecting `application/json`, clients parsing problem+json. [spec §9.1, L2236] [spec §11.1, L2750] [changelog, L8]
32. **Names and routes are mechanical but have one live conflict.** JSON-RPC methods are PascalCase (`SendMessage`); REST has no `/v1`; tenant-prefixed routes exist only in the proto; and the proto says `SubscribeToTask` is `GET` while the prose says `POST`. Breaks: clients using `message/send`, `/v1/message:send`, or only one Subscribe verb. Unresolved. [spec §9.1, L2237] [doc whats-new-v1.md, L201] [proto L78] [spec §11.3.2, L2795]
33. **Enums are the proto identifiers as strings.** `TASK_STATE_COMPLETED`, `ROLE_USER`, and so on; lowercase v0.3 values are invalid and numeric enum values are not what the spec asks for. Breaks: parsers that accept only the old spellings. [spec §5.5, L1215-L1220]
34. **A `Part` is exactly one of `text`, `raw`, `url`, `data`.** There is no `kind`, no nested `file`, `raw` is base64, `data` is any JSON value, and `mediaType` and `filename` apply to every variant. Breaks: encoders that send two content members or still emit `kind`. [macros, L112-L120] [spec §A.2.1, L3515] [proto L224-L242]
35. **REQUIRED fields are present even at their default, and formats are strict.** REQUIRED fields "MUST be present and set"; list responses always carry `nextPageToken` (empty string on the last page); timestamps are UTC with a `Z` suffix and no offsets. Breaks: default-omitting serializers that drop `nextPageToken: ""`, or servers that emit `+02:00`. [spec §5.7, L1263] [spec §3.1.4, L246] [spec §5.6.1, L1255]
36. **`ListTasks` has several exact rules.** `artifacts` is omitted entirely unless `includeArtifacts` is true; results sort by status timestamp descending; the default page size is 50 with a maximum of 100; and `statusTimestampAfter` is inclusive despite its name. Breaks: empty `artifacts: []` on every task, unstable pagination, off-by-one filters. [spec §3.1.4, L240] [spec §3.1.4, L262] [proto L683-L687] [proto L694-L696]
37. **`historyLength` has three regimes.** Unset means the server default (possibly all history), `0` means omit history (the field SHOULD be omitted), and `N > 0` means at most N most recent messages; the server "MUST NOT return more messages than the provided value". Breaks: treating `0` as unset, or returning full history to a client that asked for three messages. [spec §3.2.4, L469-L471] [proto L150-L154]
38. **Errors carry typed details.** HTTP and gRPC A2A errors MUST include a `google.rpc.ErrorInfo` with `reason` (UPPER_SNAKE without the "Error" suffix) and `domain` `a2a-protocol.org`; JSON-RPC `error.data` is an array of `@type` objects, not an object. Breaks: clients that cannot tell the seven errors that share HTTP `400` apart. [spec §11.6, L2910-L2914] [spec §10.6, L2687-L2691] [spec §9.5, L2437]
39. **`UnsupportedOperationError` is overloaded.** It covers streaming unsupported, terminal-state tasks and extended card unsupported, with identical codes. Breaks: retry logic keyed only on the code. [spec §3.1.1, L175] [spec §3.3.4, L574-L575] [spec §5.4, L1185]
40. **Unauthorized and missing are indistinguishable, and authorization runs first.** Servers "MUST NOT reveal the existence of resources the client is not authorized to access" and authorization checks "MUST occur before any database queries or operations that could leak information". Breaks: 403 versus 404 oracles, and `ListTasks` that returns other users' tasks when no filter is given. [spec §3.3.2, L514] [spec §13.1, L3098] [spec §13.1, L3081]

### 12.2 Discrepancy register (spec versus proto, spec versus itself, spec versus guides)

| ID | topic | one side says | other side says | use this | cites |
|---|---|---|---|---|---|
| D1 | HTTP verb for `SubscribeToTask` | proto: `get: "/tasks/{id=*}:subscribe"` | prose: `POST /tasks/{id}:subscribe` in §5.3 and §11.3.2 | follow the proto; accept both verbs on a server (unchanged on main) | [proto L76-L83] [spec §5.3, L1169] [spec §11.3.2, L2795] |
| D2 | does `SendMessage` block? | §3.1.1: "The operation MUST return immediately" | §3.2.2 and proto: default waits for terminal or interrupted state | follow §3.2.2 and the proto | [spec §3.1.1, L180] [spec §3.2.2, L446] [proto L157-L159] |
| D3 | stream closure at interrupted states | §3.1.2 and §3.1.6: close on terminal states | REST text and streaming guide: close on terminal or interrupted; §7.6.1: keep streams for `TASK_STATE_AUTH_REQUIRED` | close on terminal; be tolerant on interrupted | [spec §3.1.2, L210] [spec §11.7, L2973] [doc topics/streaming-and-async.md, L23] [spec §7.6.1, L1931] |
| D4 | push config type name | prose: `PushNotificationConfig` (§3.1.7, §3.1.8, §4.3.1, §13.2, §10.4.8) | proto: only `TaskPushNotificationConfig`; the §4.3.1 macro prints an error in the built doc | use `TaskPushNotificationConfig` (renamed on main, one stale mention remains) | [spec §4.3.1, L832-L834] [proto L468-L484] [macros, L71-L73] [main spec §13.2, L3117] |
| D5 | create-config request message | prose and Appendix A: `CreateTaskPushNotificationConfigRequest` | proto: create takes `TaskPushNotificationConfig` directly | use the proto | [spec §10.4.7, L2623] [spec §A, L3364] [proto L90] |
| D6 | card security member name | §3.1.11, §13.3 and §8.5 sample: `security` (old shape) | proto: `securityRequirements` of `SecurityRequirement{schemes}` | use the proto (sample fixed on main; prose still stale there) | [spec §3.1.11, L423] [spec §13.3, L3143] [spec §8.5, L2166] [proto L382-L383] [main spec §3.1.11, L423] |
| D7 | proto field number of `extended_agent_card` | Appendix A.2.2: field 5 | proto: field 4 (and old field 13 now `signatures`) | proto is normative (still wrong on main) | [spec §A.2.2, L3557-L3558] [proto L418-L419] [proto L394-L395] [main spec §A.2.2, L3566] |
| D8 | per-card or per-interface protocol version | Appendix A.2.1 steps: `protocolVersions` on the card | proto: `protocolVersion` on each `AgentInterface` | per interface (fixed on main) | [spec §A.2.1, L3509] [spec §A.2.1, L3517] [proto L351-L354] [main spec §A.2.1, L3517] |
| D9 | stream event member names | migration guide: `taskStatusUpdate`, `taskArtifactUpdate` | proto and §4.3.3: `statusUpdate`, `artifactUpdate` | proto names (fixed on main) | [doc whats-new-v1.md, L459] [doc whats-new-v1.md, L491] [proto L797-L800] [spec §4.3.3, L857-L858] |
| D10 | phantom fields in the migration guide | `Task.createdAt`, `Task.lastModified`, `PushNotificationConfig.configId`, `createdAt`, `TaskArtifactUpdateEvent.index` | none exist in the proto | do not use them (most removed on main; `index` remains in the guide) | [doc whats-new-v1.md, L86] [doc whats-new-v1.md, L432-L433] [doc whats-new-v1.md, L504] [proto L296-L322] |
| D11 | deprecated OAuth flows | guide: implicit and password flows "Removed" | proto keeps both with `deprecated = true` | proto: still present, do not use | [doc whats-new-v1.md, L510-L513] [proto L573-L576] |
| D12 | pagination names | guide: `cursor`, `limit`, `nextCursor` | proto: `pageToken`, `pageSize`, `nextPageToken` | proto (fixed on main) | [doc whats-new-v1.md, L711-L714] [proto L683-L691] [proto L706-L707] |
| D13 | error body format and media type | §6.4 and §6.5 samples: RFC 9457 `application/problem+json`; guide: `application/json` | §11.6: `google.rpc.Status` JSON, sample `application/a2a+json` | follow §11.6 | [spec §6.4, L1466-L1477] [spec §6.5, L1596-L1617] [doc whats-new-v1.md, L767] [spec §11.6, L2898-L2922] |
| D14 | JSON-RPC method template | §9.3: `"method": "category/action"` | §9.1 and §9.4: PascalCase names | PascalCase | [spec §9.3, L2276] [spec §9.1, L2237] |
| D15 | normative file path | §1.4: `spec/a2a.proto` | §5.7, §10.1 and the repo: `specification/a2a.proto` | `specification/a2a.proto` | [spec §1.4, L107] [spec §5.7, L1259] [spec §10.1, L2512] |
| D16 | which version and date | banner: latest `1.0.0`; CHANGELOG: 1.0.1 on 2026-05-26 | tag commit date 2026-05-28; commit message body 2026-04-23 | say v1.0.1 tagged 2026-05-28 | [spec §0, L3] [changelog, L3] [git commit 3303592] |
| D17 | IANA header registrations cite the wrong section | "Section 3.2.5 of the A2A Protocol Specification" | service parameters are §3.2.6 | cite §3.2.6 (still wrong on main) | [spec §14.2.1, L3294] [spec §14.2.2, L3315] [spec §3.2.6, L477] |
| D18 | recommended TLS version | spec: TLS 1.3+ recommended | enterprise guide: TLS 1.2 or higher recommended | follow the spec | [spec §7.1, L1879] [doc topics/enterprise-ready.md, L22-L24] |
| D19 | empty REQUIRED arrays | §5.7: REQUIRED arrays MUST have at least one element | §8.4.1 example keeps `"skills": []`; `ListTasksResponse.tasks` is REQUIRED yet legitimately empty | emit empty `tasks` for empty results; require at least one skill on real cards | [spec §5.7, L1263] [spec §8.4.1, L2050] [proto L704-L705] |
| D20 | `typ` in the JWS header | listed under "MUST include" | worded "SHOULD be set to" JOSE | always include `alg`, `kid` and `typ: JOSE` | [spec §8.4.2, L2068-L2071] |
| D21 | signing step wording | §8.4.2 and §8.4.3: "Remove properties with default values" | §8.4.1 rule 1: REQUIRED and explicitly set optional fields stay | apply rule 1 | [spec §8.4.2, L2081] [spec §8.4.3, L2123] [spec §8.4.1, L2012-L2016] |
| D22 | JSON naming example | §5.5 example field `push_notification_config` | proto field `task_push_notification_config` | proto name | [spec §5.5, L1211] [proto L149] |
| D23 | samples that break REQUIRED rules | `Message` without `messageId` (§4.6.1, §11.2, §6.3 status message); `artifactUpdate` without `artifactId` (§6.2) | `messageId`, `artifactId`, and event `contextId` are REQUIRED | never copy samples verbatim | [spec §4.6.1, L1062-L1074] [spec §11.2, L2775-L2780] [spec §6.3, L1415-L1418] [spec §6.2, L1378] [proto L262] [proto L282] |
| D24 | invalid JSON in samples | trailing comma in the §4.6.1 card; missing comma and trailing comma in the §6.7 file part; unclosed object in §9.4.1 | JSON syntax | never copy samples verbatim | [spec §4.6.1, L1016] [spec §6.7, L1712-L1715] [spec §9.4.1, L2302-L2312] |
| D25 | Layer 2 diagram | lists "Get Agent Card" as an operation | §3.1 defines only Get Extended Agent Card; the public card is plain HTTP | treat the diagram as informal | [spec §1.3, L56] [spec §3.1.11, L404-L406] |
| D26 | which operations are mandatory | §3.1: operations "all A2A implementations must support" | §3.3.4: streaming, push and extended card may be declined by capability | capabilities decide | [spec §3, L149] [spec §3.3.4, L571-L576] |
| D27 | transport statement in the Core Concepts guide | "JSON-RPC 2.0 is used as the payload format for all requests and responses" | spec: three standard bindings | spec wins | [doc topics/key-concepts.md, L101] [spec §1.3, L96] |
| D28 | who creates `contextId` | guide: "A server-generated identifier" | spec: server MAY generate; client MAY propose; server may reject | spec wins | [doc topics/key-concepts.md, L100] [spec §3.4.1, L590-L592] |
| D29 | extension state machines versus enum rule | guide: "State Machine Extensions" add new states | same guide: extensions may not add enum values | not normative; avoid new states | [doc topics/extensions.md, L42-L43] [doc topics/extensions.md, L76-L78] |
| D30 | activation channel for JSON-RPC | §4.6.1: "JSON-RPC request parameters" | §9.2: HTTP headers for JSON-RPC service parameters | use the header | [spec §4.6.1, L1051] [spec §9.2, L2242] |
| D31 | `A2A-Version` as parameter or header | §3.6.1: may be sent "as a request parameter instead of a header" | §9.2 and §11.2: service parameters MUST be HTTP headers | send the header | [spec §3.6.1, L724] [spec §9.2, L2242] [spec §11.2, L2757] |
| D32 | stale endpoint names in a guide | what-is-a2a diagram: `POST /sendMessage`, `POST /sendMessageStream`, `/.well-known/agent-card` | v1.0: `message:send`, `message:stream`, `agent-card.json` | spec names | [doc topics/what-is-a2a.md, L184] [doc topics/what-is-a2a.md, L200] [doc topics/what-is-a2a.md, L207] [spec §5.3, L1164-L1165] |
| D33 | guide still describes JSON-RPC-only streaming types | streaming guide: events are `SendStreamingMessageResponse` JSON-RPC objects | spec: `StreamResponse` per binding | spec names | [doc topics/streaming-and-async.md, L17] [spec §3.2.3, L463] |
| D34 | `AgentInterface.url` for gRPC | proto at the tag: "valid absolute HTTPS URL" (example `https://grpc.example.com/a2a`) | gRPC dials host:port | on main: `hostname:port`; at the tag the spec is silent | [proto L337-L339] [main proto L337-L339] |
| D35 | Message role spelling in the glossary | §2.2: a `role` ("user" or "agent") | proto and §5.5: `ROLE_USER`, `ROLE_AGENT` | wire values are the enum identifiers | [spec §2.2, L138] [proto L244-L252] [spec §5.5, L1220] |

## 13. Non-goals / out of scope

- Opacity is a goal and implies what A2A does not do: agents collaborate "without needing access to each other's internal state, memory, or tools", and "Opaque Execution: Agents collaborate based on declared capabilities and exchanged information, without needing to share their internal thoughts, plans, or tool implementations." So there is no protocol for inspecting an agent's reasoning, memory or tools. [spec §1, L22] [spec §1.2, L39]
- Identity is not an A2A concept: "Identity information is handled at the protocol layer, not within A2A semantics." Credentials are obtained out of band ("The client obtains the necessary credentials through an out-of-band process specific to the required authentication scheme."). [spec §7, L1873] [spec §7.3, L1888]
- Authorization policy is not prescribed: "Authorization logic is implementation-specific", and "Authorization boundaries are defined by each agent's authorization model, not prescribed by the protocol". [spec §7.5, L1901] [spec §13.1, L3097]
- The meaning of an authorization obtained through `TASK_STATE_AUTH_REQUIRED` is left to implementations. At v1.0.1 the spec says only that agents use that state; the explicit non-goal text ("The A2A protocol does not define the scope, representation, validity, or revocation semantics of the authorization decision or credential") exists only on main. [spec §7.6, L1908-L1919] [main spec §7.6.4, L1966]
- Tenant identifiers have no format: "the protocol does not define its format or semantics." [proto L348-L349]
- Context lifetime is not standardized: agents "MAY implement context expiration or cleanup policies and SHOULD document any such policies". Task retention and purge are likewise unspecified. [spec §3.4.1, L602]
- History is not a guaranteed log: "The agent is responsible to determine which Messages are persisted in the Task History." "Messages MUST NOT be considered a reliable delivery mechanism for critical information". [spec §3.7, L760] [spec §3.7, L762]
- No standard registry API: "The current A2A specification does not prescribe a standard API for curated registries." [doc topics/agent-discovery.md, L59]
- Artifact version lineage is out of scope: "this linkage is not part of the A2A protocol specification. Clients should maintain this version history on their end". [doc topics/life-of-a-task.md, L125]
- Clients cannot choose task ids: "Client-provided `taskId` values for creating new tasks is **NOT** supported". [spec §3.4.2, L615]
- Pagination is cursor-based only: the spec uses cursor-based pagination "rather than offset-based pagination". [spec §3.1.4, L258]
- Skills are descriptive, not a contract: "It is largely a descriptive concept". [proto L391-L392]
- Extension internals are free: "While the exact format is not mandated" for extension specifications, and extension support "is not required for protocol conformance". [doc topics/extensions.md, L135-L137] [doc topics/extension-and-binding-governance.md, L152]
- Relationship to MCP: A2A and MCP "are complementary protocols designed for different aspects of agentic systems". MCP standardizes how agents use tools and resources; A2A standardizes how agents collaborate as peers. A2A does not define tool invocation. [spec §B, L3600-L3603]
- Webhook policy details are not fixed: retries and failure thresholds are optional (MAY), and the 10-30 second timeout is only recommended. [spec §4.3.3, L885-L887]
- The spec states no performance, rate-limit or size numbers (only that agents "SHOULD implement appropriate limits on message sizes, file sizes, and request complexity" and rate limiting). [spec §13.4, L3181] [spec §13.4, L3201]

## 14. Unreleased changes on main after v1.0.1

Comparison: `git diff v1.0.1 HEAD -- docs/specification.md specification/a2a.proto` at `HEAD` = commit 679ab3afc6f95ef47bb969d511053d0f63bca2a2 (2026-10-05). The diff has one hunk in the proto and 27 hunks in the prose spec (`git diff --shortstat`: 2 files changed, 39 insertions, 30 deletions). The local clone is shallow, so the 10 commits that touch these two files since 2026-07-21 are visible, but commits before the shallow boundary (2026-07-16) are not; hunk attribution below uses the visible commits. None of these changes is released, and the only new normative MUST statements are in the new §7.6.4. [git diff --stat v1.0.1 HEAD]

- Proto, `AgentInterface.url` comment (commit cfc9d34, 2026-07-21, correcting the gRPC URL example): the comment now reads "The URL or address where this interface is available. For HTTP-based transports, must be a valid absolute HTTPS URL in production. For gRPC, the address should be in the format “hostname:port”." and the gRPC example becomes `grpc.example.com:443`. This resolves the v1.0.1 silence on how a gRPC target is written. Field names and numbers are unchanged. [main proto L337-L339] [proto L337-L339]
- New §7.6.4 "In-Task Authorization Scope" (commit 6550d34, 2026-07-30, clarifying in-task authorization scope): "The A2A protocol does not define the scope, representation, validity, or revocation semantics of the authorization decision or credential obtained in response to this state." plus "Agents MUST NOT treat the `TASK_STATE_AUTH_REQUIRED` state transition, by itself, as authorization for any particular operation." and "A credential or authorization decision obtained while a Task is in `TASK_STATE_AUTH_REQUIRED` MUST NOT be assumed to authorize subsequent messages on the Task unless that behavior is explicitly defined by the implementation, credential issuer, or extension." This inserts 10 lines and shifts later line numbers by 10 on main. [main spec §7.6.4, L1964-L1973]
- Agent Card sample fixed (dfe216a, 2026-07-22): `"security": [{ "google": [...] }]` becomes `"securityRequirements": [{ "schemes": { "google": { "list": ["openid", "profile", "email"] } } }]`, matching the proto. The prose still says `AgentCard.security` in §3.1.11 and §13.3. [main spec §8.5, L2176] [spec §8.5, L2166] [main spec §3.1.11, L423]
- `PushNotificationConfig` renamed to `TaskPushNotificationConfig` in prose (f63dbb4, 2026-08-28): §3.1.7 and §3.1.8 outputs, the §4.3.1 heading, anchor and macro, the §4.3.3 authentication sentence, §10.4.7, §10.4.8 and a §13.2 sentence. The broken `CreateTaskPushNotificationConfigRequest` macro in §10.4.7 is replaced by "See `TaskPushNotificationConfig` object definition." for both request and response. One bare `PushNotificationConfig.authentication` reference remains in §13.2. [main spec §3.1.7, L326] [main spec §3.1.8, L351] [main spec §4.3.1, L832-L834] [main spec §4.3.3, L873] [main spec §10.4.7, L2631-L2633] [main spec §13.2, L3117]
- Streaming example fixed (84ba07f, 2026-08-11): the three SSE `data:` lines in §6.2 now include `"contextId": "context-uuid"`. They still omit `artifactId` inside the artifact. [main spec §6.2, L1376-L1380] [spec §6.2, L1376-L1380]
- Metadata sentence corrected (1eb4aa0, 2026-08-14; also 7608bd0): "Metadata keys must be strings, and values can be any valid JSON value." replaces the ungrammatical v1.0.1 text. [main spec §3.2.5, L475] [spec §3.2.5, L475]
- Migration steps aligned with the proto (aa042ec, 2026-08-28): Appendix A.2.1 step 3 for clients becomes "Implement version detection based on `protocolVersion` in the agent's `supportedInterfaces` entries" and step 4 for servers becomes "Ensure each `AgentInterface` in the `AgentCard` declares the correct `protocolVersion` (e.g., "1.0" or later)", replacing the nonexistent `protocolVersions` card field. [main spec §A.2.1, L3517] [main spec §A.2.1, L3525] [spec §A.2.1, L3509] [spec §A.2.1, L3517]
- Anchor and link repairs (0a43195, 2026-08-12): the Get-config operation link in §3.5.1 becomes `#318-get-push-notification-config`, and the two `StreamResponse` links in §10.4.2 and §10.4.6 become `#323-stream-response`. [main spec §3.5.1, L674] [main spec §10.4.2, L2583] [main spec §10.4.6, L2625]
- Link-checker URL changes (1ae57a6, 2026-09-29): RFC links move to `datatracker.ietf.org/doc/html/...` (RFC 2119 in §2.1, RFC 7515 and RFC 8785 in §8.4, RFC 9111 in §8.6.2) and the ProtoJSON link gains a trailing slash in §3.3.2. No wording change. [main spec §2.1, L129] [main spec §8.4, L2014] [main spec §8.4.1, L2018] [main spec §8.6.2, L2235] [main spec §3.3.2, L544]
- Not changed on main (still defective at HEAD): the `SubscribeToTask` verb conflict (prose POST, proto GET); `AgentCard.security` in §3.1.11 and §13.3; "field 5" in Appendix A.2.2; `application/problem+json` samples in §6.4 and §6.5; `"method": "category/action"` in §9.3; "Section 3.2.5" in the IANA header registrations; and `PushNotificationConfig.authentication` in §13.2. [main spec §5.3, L1169] [main spec §11.3.2, L2803] [main spec §A.2.2, L3566] [main spec §6.4, L1468] [main spec §9.3, L2286] [main spec §14.2.1, L3302]
- Non-spec files also changed on main (migration guide `whats-new-v1.md` loses the phantom `createdAt`, `lastModified`, `configId` and renames wrapper members to `statusUpdate` and `artifactUpdate` and pagination names to `pageToken`, `pageSize`, `nextPageToken`; topic guides add URI-namespace notes and updated examples). These are not part of the pinned spec. [doc whats-new-v1.md, L86] [doc whats-new-v1.md, L459] [doc whats-new-v1.md, L711-L714]
- No change on main to: any message or field number in the proto other than the `AgentInterface.url` comment, any RPC, any `google.api.http` route, any enum, the error table in §5.4, the capability-validation rules, or the stream-closing rules. [main proto L19-L140] [main spec §5.4, L1180-L1190]
