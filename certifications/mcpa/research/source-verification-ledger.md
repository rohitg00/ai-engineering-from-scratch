# MCPA Source Verification Ledger

Every exam fact in this curriculum maps to an official source with the date it was retrieved. Protocol facts map to the MCP specification. Lessons and questions are original. If a source changes, update the fact and the date here.

## Sources

- **PAGE**: MCPA certification page, https://training.linuxfoundation.org/certification/model-context-protocol-associate-mcpa/ (retrieved 2026-09-24; page last modified 2026-09-16).
- **PRESS**: MCPA launch announcement, https://www.linuxfoundation.org/press/agentic-ai-foundation-launches-mcpa-certification-to-validate-mcp-expertise (Linux Foundation, 14 September 2026).
- **SPEC**: Model Context Protocol specification 2026-07-28, https://modelcontextprotocol.io/specification/2026-07-28.

## Verified exam facts

| Fact | Value | Source | Notes |
|------|-------|--------|-------|
| Credential | Model Context Protocol Associate (MCPA) | PAGE, PRESS | First official MCP certification; first from the Agentic AI Foundation. |
| Provider | Agentic AI Foundation, via Linux Foundation Training and Certification | PAGE, PRESS | Vendor-neutral. |
| Level | Beginner / Foundational | PAGE | "Experience Level: Beginner". |
| Format | Online, proctored, multiple choice | PAGE, PRESS | |
| Time limit | 90 minutes | PAGE | The PAGE states "Duration of Exam 90 minutes". The PRESS states 120 minutes. This curriculum uses the certification page value of 90 and flags the discrepancy. Reverify before relying on either. |
| Fee | 250 USD, exam only | PAGE | Bundle with THRIVE-ONE annual subscription is 495 USD. |
| Validity | 2 years | PAGE | |
| Exam eligibility | 12 months | PAGE | |
| Retakes | One retake included | PAGE | |
| Aligned specification | MCP 2026-07-28 | PAGE, PRESS, SPEC | The exam is aligned to the latest MCP release. |
| Number of items | Not published | PAGE | The official page does not state an item count. This curriculum's full mock uses 60 questions as a practice size, not an official figure. |
| Passing score | Not published | PAGE | No scaled score or cut score is published. |
| Prerequisites | None required; recommended experience listed | PAGE | JSON-RPC, LLM APIs, agentic patterns, security basics, reading MCP manifests. |

## Verified domains and weights

Source: PAGE (Domains and Competencies), corroborated by PRESS.

| Domain | Weight | Sub-competencies (as published) |
|--------|--------|---------------------------------|
| MCP Fundamentals | 16% | MCP Purpose and Scope; Core MCP Concepts; Interoperability and Value |
| Architecture and Components | 14% | Schemas and Structured Data; MCP Hosts, Clients and Servers; Model Interaction Flow |
| Interactions and Execution | 26% | Interaction Patterns and Response Handling; Error Handling; Tool Invocation Lifecycle; Protocol Primitives |
| Security and Governance | 24% | Trust Boundaries; Permissions and Consent; Risk and Safety Controls; Auditability and Observability |
| Use Cases and Ecosystem | 20% | Roles, Responsibilities and Adoption; Operational Use Cases; Ecosystem and Portability |

Weights total 100 percent. The domain objectives in `tracks/mcpa-f.json` are original learning objectives derived from these published sub-competency names and the MCP 2026-07-28 specification; they are not copied exam objectives.
