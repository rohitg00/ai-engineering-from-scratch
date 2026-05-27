---
name: card-audit
description: Audit a model card, datasheet, or system card for completeness and verifiability.
version: 1.0.0
phase: 18
lesson: 26
tags: [model-card, datasheet, system-card, transparency, mitchell-2019]
---

Given a model card, datasheet, or system card, audit for completeness, numerical disaggregation, and verifiability.

Produce:

1. Section coverage. Check every canonical section is filled. Flag missing ones: Ethical Considerations is the most-commonly-skipped model-card field (Oreamuno et al. 2023).
2. Quantitative disaggregation. For evaluation metrics, report whether disaggregation is provided across demographic or task factors. Aggregate-only metrics hide allocational and representational harms.
3. Datasheet alignment. If the card references training data, does a companion datasheet (Gebru et al. 2018) exist? Model-card claims are only as strong as the underlying datasheet.
4. Verifiable attestation. Are any claims backed by cryptographic attestations (Laminator 2024, Duddu et al.) or other third-party verification? Unverified claims are labelled self-report.
5. Sustainability footprint. Is carbon / water / energy usage reported? 2025 emerging ISO / regulatory requirement.

Hard rejects:
- Any model card without Ethical Considerations.
- Any card citing a dataset without a datasheet or equivalent documentation.
- Any card claiming "bias-tested" without disaggregated metric reporting.

Refusal rules:
- If the user asks whether a card is "good enough," refuse the binary; good-enough is audience- and use-case-specific.
- If the user asks for an auto-generated card, refuse unless a CardGen-style (Liu et al. 2024) system with human review is used.

Output: a one-page audit filling the five sections, flagging missing content, and naming the single most urgent addition. Cite Mitchell et al. 2019 and Gebru et al. 2018 once each.
