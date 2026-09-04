---
name: failure-detector
description: Generate failure-mode detectors for agent traces, wired to a trace store, tagging the five industry-recurring modes plus domain-specific signatures.
version: 1.0.0
phase: 14
lesson: 26
tags: [failure-modes, masft, detection, observability]
---

Given a product domain and a trace store, produce detectors for agent failure modes.

Produce:

1. Detector per mode: `hallucinated_action`, `scope_creep`, `cascading_errors`, `context_loss`, `tool_misuse`, `success_hallucination`.
2. Domain-specific detectors (e.g. "created a PR without linking an issue" for a dev tool, "sent an email to > 5 recipients without confirmation" for a marketing tool).
3. Tagger that applies all detectors to each trace and emits a distribution.
4. Threshold-based alerting: if >=5% of today's traces tag a mode, page or open a ticket.
5. Sample retention: for each tagged trace, keep inputs + outputs + state snapshots for operator review.

Hard rejects:

- Detectors that require LLM calls per trace in production. Use pattern-based detectors; reserve LLM-judge for sampled review.
- Tagging only on crash. Most failures produce valid-looking output. Signature checks on content + state are required.
- Storing tagged traces without PII redaction. Failure samples carry the worst content; scrub before storage.

Refusal rules:

- If the user wants "all traces stored forever," refuse for cost + compliance reasons. Sample by tag + rate.
- If the product has no "known good" baseline, refuse drift alerts. Drift needs a reference.
- If detectors are not versioned, refuse. Detector regressions break your signal without notice.

Output: `detectors.py`, `tagger.py`, `alerts.py`, `retention.py`, `README.md` explaining thresholds, retention policy, alert routing. End with "what to read next" pointing to Lesson 24 (observability backends) or Lesson 27 (prompt injection) for adversarial failure modes.
