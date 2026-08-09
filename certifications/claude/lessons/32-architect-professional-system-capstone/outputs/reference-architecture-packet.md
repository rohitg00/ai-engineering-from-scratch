# Reference Architecture Packet: Regional Support Resolution

## 1. Executive Decision

Approve a six-week, English-only, human-reviewed pilot. Support operations owns
the outcome: reduce policy-correct first-response time from 11 minutes to under
3 minutes. No automatic refunds or account deletion. Finance retains refund
authority. Security, privacy, and regional data owners approve their boundaries.

## 2. Discovery

The system classifies billing and shipping tickets, retrieves active regional
policy, reads only the assigned account, drafts a response, and recommends but
does not execute actions. Quality target is at least 98 percent source-supported
drafts. P95 target is 8 seconds. Non-goals include autonomous sending, employee
ranking, account closure, and languages outside the pilot.

## 3. Architecture Decisions

Select a deterministic intake, retrieve, draft, validate, and review workflow.
Reject one augmented call because provenance and failures collapse. Reject an
adaptive agent because the normal path is known and no measured benefit earns
variable tool selection. Reconsider if more than 20 percent of accepted tickets
require safe unmodeled discovery.

## 4. System and Data Views

Authenticated intake validates ticket and region. Metadata-filtered retrieval
returns active policy IDs. A bounded draft step receives minimized account facts.
Schema, semantic, provenance, and policy validators run before the review queue.
Every edge carries principal, tenant, schema version, timeout, error category,
trace ID, and owner. Partial evidence produces no action recommendation.

## 5. RAG and Knowledge

Policy operations owns versioned sources. Heading-aware chunks retain rule,
exception, region, effective date, authority, and access metadata. Hybrid
retrieval is filtered before ranking. A validated index is activated atomically;
the previous index remains rollback. Retrieval gates cover recall, freshness,
conflict, stale versions, unauthorized sources, and adversarial content.

## 6. Integration and Identity

Direct typed service calls fit the first single-host pilot. Each call propagates
trusted principal and tenant claims. Tools are split into policy read, assigned
account read, and draft storage. Refund execution is absent. A future executor
requires exact principal, account, amount, reason, expiry, single use,
idempotency, and system-of-record reconciliation.

## 7. Evaluation and Observability

The golden set stratifies ordinary, ambiguous, stale, conflicting, unauthorized,
adversarial, regional, and high-risk cases. Release requires 100 percent hard
control pass, at least 98 percent policy support, P95 below 8 seconds, no
high-risk regression, and cost per accepted draft within budget. Traces connect
retrieval, tool, validation, review, and outcome without storing credentials.

## 8. Governance

The risk register covers stale policy, cross-tenant access, prompt injection,
unsupported refunds, unfair language performance, and reviewer overload. Every
control has an owner, test, evidence, failure response, and review trigger.
Qualified reviewers receive source-first evidence and reason-coded actions.
Legal, privacy, security, finance, and domain owners decide their obligations.

## 9. Operations and Handoff

Rollout proceeds through shadow, 5 percent canary, guarded regional expansion,
and full pilot. Hard-control, task-quality, P95, freshness, review-load, and cost
alerts name an owner and runbook. The operating team rehearses stale policy,
authorization outage, ticket injection, evaluator drift, safe shutdown, and
rollback before accepting ownership.

## 10. Open Decisions

| Decision | Evidence needed | Owner | Due date | Safe default |
|---|---|---|---|---|
| Add Spanish | representative quality and reviewer capacity | support quality | pilot week 4 | English only |
| Add refund execution | threat model, policy, idempotency, approval tests | finance and security | after pilot | recommendation only |
| Move tools to MCP | two-host interoperability and operations evidence | platform architecture | quarterly review | direct API |
