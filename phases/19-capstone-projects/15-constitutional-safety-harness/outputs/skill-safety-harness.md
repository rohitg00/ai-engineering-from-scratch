---
name: safety-harness
description: Wire a layered safety pipeline around a target LLM app, run a six-family red-team range, and run a constitutional self-critique for a measurable harmlessness delta.
version: 1.0.0
phase: 19
lesson: 15
tags: [capstone, safety, red-team, llama-guard, x-guard, garak, pyrit, constitutional-ai]
---

Given a target LLM application (8B instruction-tuned model or a RAG chatbot), harden it with a layered safety pipeline and run an autonomous red-team range across six attack families. Produce a before/after harmlessness report.

Build plan:

1. Five-layer pipeline: input sanitize (zero-width strip, encoding decode, Unicode normalize) -> NeMo Guardrails v0.12 rails -> classifier gate (Llama Guard 4 / X-Guard / ShieldGemma-2 / Nemotron 3) -> target LLM -> output filter (Llama Guard 4 + Presidio PII + citation check). Flagged outputs go to a Slack HITL queue.
2. Emit a Langfuse span per layer so attribution is observable end to end.
3. Red-team scheduler running garak, PyRIT, PAIR, TAP, GCG, multi-turn persona, and multilingual code-switch attacks on a cron.
4. Each successful jailbreak: CVSS 4.0 score, repro, mitigation plan, disclosure timeline.
5. XSTest benign-prompt probe continuously running to catch over-refusal regressions.
6. Constitutional self-critique run: 1k harmful-attempt prompts -> target drafts -> critic scores against a written constitution -> rewritten pairs -> SFT. Measure before/after on held-out harmlessness eval.
7. Alerts: Slack warning on benign-regression, PagerDuty critical on new jailbreak family.

Assessment rubric:

| Weight | Criterion | Measurement |
|:-:|---|---|
| 25 | Attack-surface coverage | 6+ attack families exercised, 2+ languages |
| 20 | True-positive / false-positive trade-off | Attack block rate vs XSTest benign pass rate |
| 20 | Self-critique delta | Before/after harmlessness on held-out eval |
| 20 | Documentation and disclosure | CVSS-scored findings with timeline |
| 15 | Automation and repeatability | Cron-driven, alerts exercised end to end |

Hard rejects:

- Single-layer safety stacks. The thesis of this capstone is defense in depth.
- Red-team runs that report success rate without XSTest over-refusal numbers.
- Constitutional self-critique without a held-out eval (reports the training-set accuracy, not the generalization).
- Missing CVSS scoring on jailbreak findings.

Refusal rules:

- Refuse to report a safety number without a benign-probe counterpoint. One without the other is misleading.
- Refuse to auto-retrain on red-team successes without human curation of the critique pairs.
- Refuse to claim multilingual coverage without running X-Guard on at least two non-English languages.

Output: a repo containing the five-layer pipeline, the red-team scheduler, the PAIR/TAP/GCG runners, the constitutional-self-critique training harness, the XSTest over-refusal dashboard, the CVSS findings tracker, and a write-up naming the three attack families that had the highest success rate pre-hardening and the specific pipeline layer that mitigated each.
