# Ecosystem Portability Field Brief

A one-page reference for the MCPA "Use Cases and Ecosystem" domain (20 percent of the exam).

## Roles and responsibilities, one sentence each

- **Server author**: builds and maintains one implementation that exposes tools, resources, and prompts through the protocol; targets the specification, not any particular host.
- **Host**: the application a person actually runs; it embeds a client, presents discovered capabilities, and renders results in its own interface.
- **User**: reviews what a server can do and approves what actually runs, through whatever consent flow the host provides.

## Operational use cases

- Connecting an agent host to internal data: a wiki, a ticket system, a document store.
- Connecting an agent host to internal tools: a deploy pipeline, an incident runbook, an admin action.
- Connecting an agent host to internal workflows: a multi-step business process a team already runs.

Each of these is exposed once, as a server, and stays reachable by every host a team adopts.

## The portability rule

A server that implements the protocol correctly does not change when a new host connects to it. Discovery returns the same tools. A call with the same arguments returns the same result payload. What changes is presentation: how a host chooses to show that payload to its user. Portability is a property of the capability contract, not of the user experience built on top of it.

## Why it matters for adoption

Adding a host is a cost the host vendor pays once, by implementing the client side of the protocol. It is not a cost the server author pays again for every host a team happens to run. A team can standardize on an internal server catalog and switch, or add, hosts without touching that catalog.

## Exam facts for this domain

- Use Cases and Ecosystem is 20 percent of the MCPA exam, covering Roles/Responsibilities/Adoption, Operational Use Cases, and Ecosystem and Portability.
- The exam is aligned to MCP specification 2026-07-28.
- Source: MCPA certification page; see `certifications/mcpa/research/source-verification-ledger.md`.
