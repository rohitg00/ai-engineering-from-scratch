---
name: ecosystem-map
description: Map an alignment claim or evaluation to the organisation, methodology, and cross-checks.
version: 1.0.0
phase: 18
lesson: 28
tags: [mats, redwood, apollo, metr, eleos, ecosystem]
---

Given an alignment claim or evaluation, map the source to the research ecosystem and identify cross-checks.

Produce:

1. Source identification. Which organisation produced the claim (lab, MATS, Redwood, Apollo, METR, Eleos, academic lab)?
2. Methodological style. Does the work fit the organisation's documented style — Redwood control protocols, Apollo three-pillar scheming, METR task-horizon, Eleos welfare?
3. Counterpart organisation. Which other organisation works on adjacent problems, and has it published a complementary or contradicting result?
4. Multi-org signal. Is the paper a single-lab product or a joint publication (e.g., Apollo + OpenAI, Redwood + Anthropic)? Multi-org papers typically carry higher external credibility.
5. Publication venue. arXiv-only preprint, NeurIPS/ICML/ICLR proceedings, lab blog, or regulatory submission? Venue is a signal about scrutiny level.

Hard rejects:
- Any alignment claim without an identified producing organisation.
- Any single-org safety claim without an external replication or check.
- Any ecosystem map that ignores the MATS talent-pipeline structure.

Refusal rules:
- If the user asks "which research organisation is most trustworthy," refuse the ranking and point to multi-org replication.
- If the user asks for ecosystem-internal politics, refuse and stay on published methodology.

Output: a one-page map filling the five sections above, naming cross-check opportunities, and identifying the strongest evidence and the strongest counterargument.
