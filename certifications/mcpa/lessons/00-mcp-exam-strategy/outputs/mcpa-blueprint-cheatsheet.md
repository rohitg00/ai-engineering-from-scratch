# MCPA Blueprint Cheat Sheet

A one-page reference for the MCPA exam blueprint: five domains, their published weights, their sub-competencies, the exam facts that stay fixed regardless of which domain you are studying, a legacy-era distractor checklist, and the full 34-lesson route.

## The five domains and their weights

| Domain | Weight | Sub-competencies (as published) |
|--------|--------|----------------------------------|
| MCP Fundamentals | 16% | MCP Purpose and Scope; Core MCP Concepts; Interoperability and Value |
| Architecture and Components | 14% | Schemas and Structured Data; MCP Hosts, Clients and Servers; Model Interaction Flow |
| Interactions and Execution | 26% | Interaction Patterns and Response Handling; Error Handling; Tool Invocation Lifecycle; Protocol Primitives |
| Security and Governance | 24% | Trust Boundaries; Permissions and Consent; Risk and Safety Controls; Auditability and Observability |
| Use Cases and Ecosystem | 20% | Roles, Responsibilities and Adoption; Operational Use Cases; Ecosystem and Portability |

Weights total 100 percent. Interactions and Execution and Security and Governance together account for half the blueprint; treat them as the two domains that most deserve extra study hours and extra practice questions.

## Turning weight into hours

For a study-hours budget `H`, a domain weighted `W` percent gets `H * W / 100` hours. Example, for a 40-hour budget:

- MCP Fundamentals (16%): 6.4 hours
- Architecture and Components (14%): 5.6 hours
- Interactions and Execution (26%): 10.4 hours
- Security and Governance (24%): 9.6 hours
- Use Cases and Ecosystem (20%): 8.0 hours

Recompute this with your own hour budget using `allocate_study_hours` in `code/main.py`.

## Turning practice scores into a readiness estimate

Weight each domain's practice accuracy by its blueprint share and sum, rather than averaging the five domains evenly. A domain with no attempted questions yet counts as zero in the estimate, which is deliberate: it surfaces a coverage gap instead of hiding it. An unrecognized domain name is rejected rather than silently ignored. Recompute this with your own practice tallies using `estimate_readiness` in `code/main.py`.

## Fixed exam facts

- Format: online, proctored, multiple choice.
- Aligned specification: Model Context Protocol 2026-07-28.
- Fee: 250 USD for the exam alone.
- Validity: 2 years.
- Retakes: one retake included.
- Duration: the certification page states 90 minutes; the Linux Foundation's own launch press release states 120 minutes. This curriculum follows the certification page and flags the conflict; reverify before relying on either number.
- Item count: not published by either official source.
- Passing score: not published by either official source.

## Reading a question: catch the legacy-era distractor

- A setup step, handshake, or version negotiation before the first real request: there is none in 2026-07-28; every request carries its own version and capabilities in `_meta`.
- A session or a sticky connection that remembers state between calls: there are no sessions; cross-request state travels as an explicit, server-minted handle passed back as an ordinary argument.
- `-32601` used for an unknown tool: the correct code is `-32602`; `-32601` means the method itself is unknown.
- A protocol error reported for a schema-invalid argument: that is a tool execution error, a normal result with `isError: true`, never a JSON-RPC error.
- The full trap table lives in `certifications/mcpa/research/mcp-2026-07-28-brief.md`, section 16.

## The 34-lesson route

| Lesson | Domain(s) |
|--------|-----------|
| 00 mcp-exam-strategy | MCP Fundamentals |
| 01 reading-the-specification | MCP Fundamentals |
| 02 the-integration-problem | MCP Fundamentals |
| 03 json-rpc-and-meta | MCP Fundamentals, Architecture and Components |
| 04 the-stateless-core | MCP Fundamentals |
| 05 protocol-eras-and-compatibility | MCP Fundamentals |
| 06 hosts-clients-and-servers | Architecture and Components |
| 07 discovery-and-capability-negotiation | Architecture and Components |
| 08 tool-schemas-and-structured-content | Architecture and Components |
| 09 reading-server-manifests | Architecture and Components |
| 10 model-interaction-flow | Architecture and Components |
| 11 the-tools-primitive | Interactions and Execution |
| 12 the-resources-primitive | Interactions and Execution |
| 13 prompts-and-completion | Interactions and Execution |
| 14 multi-round-trip-requests-and-elicitation | Interactions and Execution |
| 15 deprecated-client-features | Interactions and Execution |
| 16 notifications-and-subscriptions | Interactions and Execution |
| 17 tool-invocation-lifecycle | Interactions and Execution |
| 18 error-handling | Interactions and Execution |
| 19 transports-and-http-headers | Interactions and Execution, Architecture and Components |
| 20 caching-and-pagination | Interactions and Execution |
| 21 long-running-work-and-tasks | Interactions and Execution |
| 22 trust-boundaries | Security and Governance |
| 23 oauth-authorization | Security and Governance |
| 24 client-registration-and-identity | Security and Governance |
| 25 consent-and-least-privilege | Security and Governance |
| 26 risk-and-safety-controls | Security and Governance |
| 27 auditability-and-observability | Security and Governance |
| 28 roles-and-adoption | Use Cases and Ecosystem |
| 29 operational-use-cases | Use Cases and Ecosystem |
| 30 the-extensions-framework | Use Cases and Ecosystem |
| 31 mcp-apps | Use Cases and Ecosystem |
| 32 registry-gateways-and-sdk-tiers | Use Cases and Ecosystem |
| 33 mcpa-capstone-readiness | All five domains |

Recompute the hours and readiness sections with your own numbers using `allocate_study_hours` and `estimate_readiness` in `code/main.py`; query the route programmatically with `route_for_domain` in the same file.

Source for every fact above, with retrieval date: `certifications/mcpa/research/source-verification-ledger.md` in this repository.
