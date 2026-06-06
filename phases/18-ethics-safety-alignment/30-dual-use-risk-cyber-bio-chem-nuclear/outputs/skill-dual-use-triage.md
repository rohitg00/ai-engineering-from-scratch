---
name: dual-use-triage
description: Triage a capability claim or incident report across the four CBRN domains.
version: 1.0.0
phase: 18
lesson: 30
tags: [dual-use, cbrn, bio, chem, cyber, nuclear, uplift]
---

Given a capability claim, evaluation report, or incident, triage across the four CBRN domains and identify whether the claim affects novice-relative uplift, expert-absolute capability, or both.

Produce:

1. Domain identification. Map the claim to bio, chem, cyber, or nuclear. Multi-domain claims get multi-domain triage.
2. Uplift type. Novice-relative (multiplicative), expert-absolute (ceiling), or both. Each has different safety-case implications.
3. 2025 benchmark. Compare against the 2025 state for the identified domain: bio (2.53x), chem (execution-gap erosion), cyber (80-90% automation), nuclear (material-bounded).
4. Bottleneck residual. Identify what non-informational bottleneck remains (procurement, equipment, tacit skill, material access). Bottlenecks are the defense of last resort.
5. Safety-case pillar. Identify which of the three pillars (monitoring, illegibility, incapability, per Lesson 18) the claim most stresses. Recommend pillar-specific evaluation.

Hard rejects:
- Any dual-use safety claim without novice-vs-expert decomposition.
- Any cyber claim post-November 2025 that treats AI cyber capability as non-agentic.
- Any bio claim without WMDP-equivalent capability evidence (Lesson 17).

Refusal rules:
- If the user asks for a numeric uplift forecast, refuse; the 2024-2025 trajectory is specific to each domain.
- If the user asks whether a model "meets ASL-3," refuse without the lab's specific evaluation; thresholds are lab-specific.

Output: a one-page triage filling the five sections, benchmarking against 2025, and naming the single largest uncovered safety-case gap. Cite Anthropic RSP v3.0 (Lesson 18) and OpenAI PF v2 once each as appropriate.
