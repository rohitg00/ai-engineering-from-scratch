# Delivery Handoff Packet: Enterprise Research Assistant

## Executive Decision

Approve a six-week read-only pilot to reduce analyst cycle time from two days to
six hours while maintaining complete source support. Business owner: research
operations. Residual confidentiality risk requires security acceptance.

## ADR

Select a deterministic retrieve, rank, draft, validate, and human-approve
workflow. Rejected adaptive agent because the path is stable and tool authority
adds no measured value. Rejected one-call drafting because provenance failures
cannot be localized.

## Contract Index

Retrieval, claim, identity, structured error, evaluation, and trace contracts
each name a version rule, failure behavior, owner, and deterministic test.

## Operational Readiness

Freshness, P95 latency, task quality, and cost SLO dashboards are live. Every
alert has an owner and runbook. The support-platform owner completed a tabletop
stale-policy incident, disabled the route, and proved rollback to index `v17`.

## Ownership Map

Research operations owns outcome; knowledge operations owns source freshness;
identity owns permissions; quality owns labels and thresholds; SRE owns runtime;
security approves confidentiality controls; product owns user communication.

## Reversal Condition

Reversal is triggered if P95 exceeds 20 seconds for two windows, unsupported
claim rate exceeds 1 percent, reviewer load exceeds eight minutes per report, or
the workflow requires unmodeled discovery in more than 20 percent of tasks.
