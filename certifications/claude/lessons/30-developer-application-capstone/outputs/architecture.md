# Order Status Assistant Architecture Record

## Decision

Use a bounded Claude-assisted workflow with one read-only in-process tool, deterministic policy, strict output validation, and explicit escalation.

## Context

The user needs a verified order status from an exact public order ID. The path is known and the cost of a fabricated action is high. One application owns the capability today.

## Components

1. Input validator extracts the public ID format.
2. Trust boundary labels user and retrieved content as untrusted.
3. Claude may propose `lookup_order` through a typed tool contract.
4. Policy gate allows only the read-only call with one argument.
5. Trusted integration code binds authenticated user and tenant identity.
6. Order service returns a minimized verified status.
7. Claude produces a structured final response.
8. Application validates schema, evidence, routing state, and trace.

## Decisions and Tradeoffs

### Workflow over autonomous agent

The sequence is known. A general agent would add tool-selection and loop risk without improving the core user outcome.

### Direct tool over MCP

One host uses one capability. A direct typed handler has fewer operational boundaries. Migrate to MCP when two or more approved hosts need shared discovery and governance.

### Read-only automatic capability

Lookup may run automatically after schema and policy checks. Refund, cancellation, address change, and external messages require separate tools, external approval, idempotency, and new evals.

### Structured output plus local validation

Provider-constrained generation reduces syntax errors. Local schema, semantic, and authorization checks remain mandatory.

### No extended thinking by default

The workflow is a direct lookup. Added reasoning budget requires measured quality improvement before adoption.

## Rejected Alternatives

- Free-form shell or database tool: excessive authority and difficult validation.
- One broad `manage_order` tool: mixes read and mutation permissions.
- Conversation text as approval: unauthenticated and vulnerable to injection.
- Unlimited retries: creates cost and side-effect ambiguity.
- MCP in the first version: interoperability benefit does not yet justify server operations.

## Security Boundary

- Credentials remain in trusted integration code.
- Model arguments never establish identity or tenant.
- Untrusted content cannot grant capability.
- Unknown tools and argument fields fail closed.
- Tool results are minimized before model context.
- Traces contain typed summaries, versions, and fingerprints rather than secrets.

## Verification

- Unit tests cover validation, policy, tool behavior, contract shape, and escalation.
- Behavioral evals cover known, unknown, missing-input, and injection cases.
- A production deployment must add live API serialization tests, authenticated ownership checks, rate-limit handling, and canary evaluation.

## Product Detail Notice

Model IDs, SDK methods, structured-output fields, stop reasons, and configuration surfaces must be checked against current official documentation during implementation and upgrades.

