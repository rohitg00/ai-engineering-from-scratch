# MCPA Blueprint Cheat Sheet

A one-page reference for the MCPA exam blueprint: five domains, their published weights, their sub-competencies, and the exam facts that stay fixed regardless of which domain you are studying.

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

Weight each domain's practice accuracy by its blueprint share and sum, rather than averaging the five domains evenly. A domain with no attempted questions yet counts as zero in the estimate, which is deliberate: it surfaces a coverage gap instead of hiding it. Recompute this with your own practice tallies using `estimate_readiness` in `code/main.py`.

## Fixed exam facts

- Format: online, proctored, multiple choice.
- Aligned specification: Model Context Protocol 2026-07-28.
- Fee: 250 USD for the exam alone.
- Validity: 2 years.
- Retakes: one retake included.
- Item count: not published by the official guide.
- Passing score: not published by the official guide.

Source for every fact above, with retrieval date: `certifications/mcpa/research/source-verification-ledger.md` in this repository.
