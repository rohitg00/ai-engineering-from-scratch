---
name: provenance-check
description: Check a training dataset against California AB 2013 and EU TDM opt-out obligations.
version: 1.0.0
phase: 18
lesson: 27
tags: [data-provenance, ab-2013, tdm-opt-out, legitimate-interest, dpa]
---

Given a training dataset used by a deployment, check compliance against California AB 2013 and EU TDM opt-out.

Produce:

1. AB 2013 coverage. Fill the 12 fields. Flag any missing or placeholder-only fields. Note that the summary becomes binding once published.
2. Opt-out compliance. Does the dataset respect machine-readable opt-out signals (robots.txt, C2PA "No AI Training", TDM.Reservation)? Pre-collection filter must be in place.
3. DPA jurisdiction mapping. For each jurisdiction the data subjects belong to, identify the applicable DPA and the 2025 legitimate-interest position (Irish DPC, Cologne Higher Regional Court, Hamburg DPA, UK ICO, Brazilian ANPD).
4. Irreversibility audit. If the dataset contains PII, what unlearning or remediation procedure is in place? Acknowledge that no procedure fully remediates training data.
5. Provenance-chain completeness. Is there a signed chain from the data source to the training pipeline? If the dataset is derived (crawled + filtered), document the derivation.

Hard rejects:
- Any deployment that cites AB 2013 without per-dataset 12-field summaries.
- Any deployment that does not respect robots.txt or equivalent opt-out signals.
- Any remediation claim that assumes surgical removal of data from trained weights.

Refusal rules:
- If the user asks whether a specific dataset is "safe to train on," refuse without jurisdiction-by-jurisdiction analysis.
- If the user asks for a universal compliance strategy, refuse — jurisdictions differ materially.

Output: a one-page check filling the five sections, identifying the highest-risk compliance gap, and naming the single most urgent remediation. Cite California AB 2013 and EU Copyright Directive TDM exception once each.
