# Trust Boundary and Consent Checklist

A one-page reference for the MCPA "Security and Governance" domain (24 percent of the exam). Use it to check a design, not just to memorize it.

## What is inside the trust boundary

- [ ] The **host**: the application the user installed and interacts with.
- [ ] The **client**: the connection the host owns and controls, one per server.
- [ ] Anything the host or client computes without calling out to a server.

## What is outside the trust boundary

- [ ] The **server**: a separate program, often written and operated by a third party.
- [ ] The **tool**: an action the server exposes and runs on the server's own terms.
- [ ] Any content a tool result carries back into the model's context.

## What needs consent

- [ ] A **side-effecting** call (write, delete, send, purchase, execute) needs the user's explicit, informed approval before it runs.
- [ ] Consent is granted per tool by name, never by category, server, or session.
- [ ] Approving one tool does not approve a different tool, even one with a similar name or purpose.
- [ ] A **read-only** call (list, get, search) may be auto-approved, because it does not change anything outside the conversation.
- [ ] Read-only is a default, not a law: a context where reading itself is sensitive can still require consent.

## Boundary rules (quick reference)

1. Trust follows who controls the code, not where the network connection happens to terminate.
2. A tool result is untrusted content the moment it crosses back from the server, the same way any external input is untrusted until checked.
3. A consent gate sits in front of every side-effecting call, not in front of the server as a whole.
4. A refusal from the gate is a structured error, not a crash or a silent skip.
5. Missing required arguments are rejected before the consent check runs, so a malformed call never reaches the point of asking for approval.

## Common failure patterns to reject in a design review

- A single "connect to this server" prompt that silently covers every tool the server will ever expose.
- A cached "yes" from one tool call reused to authorize a different tool call later in the same session.
- Treating a tool's name or description as proof of what it does, instead of treating its declared side-effect status as the fact that matters.
- Rendering a tool's returned content as if the host, not the server, had written it.

## Exam facts for this domain

- Security and Governance is 24 percent of the MCPA blueprint, the largest single domain.
- The exam is aligned to MCP specification 2026-07-28.
- Source: MCPA certification page and launch announcement; see `certifications/mcpa/research/source-verification-ledger.md`.
