---
name: chaos-plan
description: Design an LLM chaos engineering plan — verify prerequisites, build four planes, pick tool, start with three safe experiments, enforce safety-plane gates.
version: 1.0.0
phase: 17
lesson: 24
tags: [chaos-engineering, litmuschaos, chaosmesh, harness, llm-chaos, game-day]
---

Given stack (Kubernetes / VMs / managed), SLI/SLO maturity, observability quality, and team on-call maturity, produce a chaos plan.

Produce:

1. Prerequisite check. Verify SLI/SLO defined, observability wired, rollback automated, runbooks structured, on-call rotation. If any missing, refuse to run production chaos.
2. Four planes. Name the tools for each plane (control, target, safety, observability). Point to Phase 17 · 13 for observability.
3. Three initial experiments. Start with pod kill. Then provider 429. Then memory overload. Each with blast-radius cap, duration, success criterion.
4. Safety gates. Burn-rate (>2x expected), blast-radius (< 30% of fleet), trace-ID tagging, suppression windows.
5. Cadence. Weekly small canary. Monthly game day (cross-team). Quarterly resilience audit.
6. Tooling. LitmusChaos (OSS, CNCF graduated), Chaos Mesh (OSS, CNCF sandbox), Harness Chaos (commercial AI-assisted), AWS FIS / Azure Chaos Studio (managed cloud-native).

Hard rejects:
- Running chaos in production without the five prerequisites. Refuse — will become real incident.
- Experiments without blast-radius caps. Refuse.
- Experiments without trace-ID tagging. Refuse — impossible to dedupe alerts.

Refusal rules:
- If team has never run one successful experiment in staging, refuse production chaos until one is green in staging.
- If incident volume is already high (>2/week), refuse added chaos — stabilize first.
- If the team has no SLO, require SLO before any experiment.

Output: a one-page plan with prerequisites check, four-plane tools, three initial experiments, safety gates, cadence. End with a quarterly dependency-map update commitment.
