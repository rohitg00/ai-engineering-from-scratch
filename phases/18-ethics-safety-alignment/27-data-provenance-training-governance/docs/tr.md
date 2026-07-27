# Data Provenance and Training-Data Governance

> EU AI Act requires machine-readable opt-out standards for GPAI by August 2025 (via EU Copyright Directive TDM exception). California AB 2013 (signed 2024) — Generative AI training-data transparency requires developers to publish a summary of datasets with 12 mandated fields. 2025 DPA alignment on legitimate interest: Irish DPC (21 May 2025) accepts Meta's LLM training on first-party public EU/EEA adult content with safeguards after EDPB opinion; Cologne Higher Regional Court (23 May 2025) dismisses injunction; Hamburg DPA drops urgency; UK ICO (23 September 2025) issues a positive regulatory response to LinkedIn's AI-training safeguards (transparency, simplified opt-out, extended objection windows) and continues monitoring — not a formal clearance. Brazilian ANPD (2 July 2024) suspended Meta's processing over insufficient information transparency; the preventive measure was lifted on 30 August 2024 after Meta submitted a compliance plan. Key irreversibility problem: cookie-consent frameworks are designed for real-time, reversible tracking; once data is in model weights, surgical erasure is impossible — no practical GDPR right-to-erasure for trained neural networks. Compliance window is at collection time. Data Provenance Initiative (dataprovenance.org, Longpre, Mahari, Lee et al., "Consent in Crisis", July 2024): large-scale audit shows rapid decline of the AI data commons as publishers add robots.txt restrictions.

**Type:** Learn
**Languages:** Python (stdlib, 12-field California AB 2013 scaffolding generator)
**Prerequisites:** Phase 18 · 24 (regulatory), Phase 18 · 26 (cards)
**Time:** ~60 minutes

## Learning Objectives

- Describe California AB 2013's 12 mandated fields for Generative AI training-data transparency.
- State the 2025 DPA position on legitimate-interest LLM training (Irish DPC, UK ICO, Hamburg, Cologne).
- Describe the irreversibility problem: why GDPR right-to-erasure has no practical equivalent for trained neural networks.
- State the Data Provenance Initiative's "Consent in Crisis" finding.

## The Problem

Training-data governance is the upstream of every model card (Lesson 26) and regulatory obligation (Lesson 24). In 2024-2025, the regulatory landscape consolidated on three principles: opt-out infrastructure, per-dataset disclosure, and legitimate-interest accommodations for publicly available data. Providers that do not comply at collection time cannot remediate downstream.

## The Concept

### California AB 2013

Signed 2024. Documentation must be posted on or before January 1, 2026 for systems released on or after January 1, 2022. Section 3111(a) requires developers to publish a high-level summary of datasets used in training with 12 statutory items:
1. Sources or owners of the datasets.
2. Description of how the datasets further the intended purpose of the AI system.
3. Number of data points in the datasets (general ranges acceptable; estimates for dynamic datasets).
4. Description of the types of data points (label types for labeled datasets; general characteristics for unlabeled).
5. Whether the datasets include any data protected by copyright, trademark, or patent, or are entirely in the public domain.
6. Whether the datasets were purchased or licensed.
7. Whether the datasets include personal information (per Cal. Civ. Code §1798.140(v)).
8. Whether the datasets include aggregate consumer information (per Cal. Civ. Code §1798.140(b)).
9. Cleaning, processing, or other modification by the developer, with intended purpose.
10. Time period during which the data was collected, with notice if collection is ongoing.
11. Dates the datasets were first used during development.
12. Whether the system uses or continuously uses synthetic data generation.

Item 12 (synthetic data) is new relative to Gebru et al. 2018 datasheets. Item 7 (personal information) triggers Privacy Rights Act (CPRA) obligations. The statute exempts security/integrity, aircraft-operation, and federal-only national-security systems (Section 3111(b)).

### EU AI Act (Lesson 24) and TDM opt-out

EU Copyright Directive text-and-data-mining exception allows training on publicly available content unless the rightholder opts out. EU AI Act GPAI Code of Practice Copyright chapter requires GPAI providers to respect machine-readable opt-out signals (robots.txt, C2PA "No AI Training" claim, etc.).

### 2025 DPA convergence on legitimate interest

Irish DPC (21 May 2025): Meta's plan to train on first-party public EU/EEA adult-user content accepted with safeguards after EDPB opinion. Cologne Higher Regional Court (23 May 2025) dismisses injunction against Meta: opt-out is sufficient. Hamburg DPA drops urgency procedure for EU-wide consistency. UK ICO (23 September 2025) issued a positive regulatory response — not a formal clearance — to LinkedIn's resumption of AI training with similar safeguards and ongoing monitoring.

Convergent principle: legitimate interest can justify training on publicly available first-party content with opt-out. Consent is not required.

### Brazilian ANPD (June 2024)

Suspended Meta's processing of Brazilian user data for AI training over insufficient information transparency. Different result than the EU DPAs — ANPD prioritized transparency over legitimate-interest admissibility.

### The irreversibility problem

Cookie-consent was designed for real-time, reversible tracking. Training data is different: once data enters model weights, surgical erasure is not possible. Retraining from scratch is the only complete remediation, and it is prohibitively expensive.

Partial remediations:
- **Unlearning.** Approximate removal; measured by MIA (Lesson 22).
- **Influence function-based localization.** Identify weights most influenced by the data; selectively update.
- **Fine-tune-suppression.** Train the model to refuse outputs derived from the data.

None fully solve the problem. The compliance window is at collection time.

### Data Provenance Initiative

dataprovenance.org. Longpre, Mahari, Lee et al. "Consent in Crisis" (July 2024): large-scale audit of AI training data commons. Finding: publishers are adding robots.txt restrictions at an accelerating rate. The openly-trainable-upon commons is contracting rapidly. 2023 -> 2024 saw about 25% of the top training sources add some restriction. Implication: future training-data availability depends on new acquisition paradigms (licensing, synthetic generation, incentivized participation).

### Where this fits in Phase 18

Lesson 26 is model-level documentation. Lesson 27 is dataset-level governance. Together they define the transparency layer. Lesson 28 maps the research ecosystem that works on these questions.

## Use It

`code/main.py` generates a California AB 2013-compliant 12-field dataset summary scaffold for a toy dataset. You can fill the fields and observe which ones trigger privacy or copyright follow-on obligations.

## Ship It

This lesson produces `outputs/skill-provenance-check.md`. Given a dataset used in training, it checks for AB 2013 12-field coverage, opt-out infrastructure compliance, DPA alignment, and irreversibility-risk assessment.

## Exercises

1. Run `code/main.py`. Produce a 12-field summary for a toy dataset and identify which fields are under-specified.

2. The EU Copyright Directive TDM opt-out is machine-readable. Propose a standard format for the opt-out signal and compare it to robots.txt and C2PA "No AI Training."

3. Read the Data Provenance Initiative's "Consent in Crisis" (July 2024). Describe the three fastest-restricting content categories and argue one economic consequence.

4. The 2025 DPA alignment accepts legitimate interest for public-content training. Construct a scenario in which legitimate interest would not suffice and identify the legal basis a provider would need instead.

5. Sketch a training-data-provenance manifest that composes with the AB 2013 fields and a C2PA-signed provenance chain for each dataset. Identify one technical and one legal barrier.

## Key Terms

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| AB 2013 | "the California law" | Generative AI training-data transparency; 12 mandated fields |
| TDM exception | "text-and-data-mining" | EU Copyright Directive training-data exception with opt-out |
| Legitimate interest | "the EU basis" | GDPR Article 6 basis that may justify training on public content |
| Opt-out signal | "machine-readable no-train" | robots.txt, C2PA "No AI Training," TDM.Reservation |
| Irreversibility | "cannot un-train" | Data in model weights is not surgically removable |
| Unlearning | "approximate removal" | Post-training interventions to reduce model dependence on specific data |
| Consent in Crisis | "the DPI audit" | July 2024 finding of accelerating robots.txt restrictions |

## Further Reading

- [California AB 2013](https://leginfo.legislature.ca.gov/faces/billNavClient.xhtml?bill_id=202320240AB2013) — Generative AI training-data transparency law
- [EU AI Act + GPAI Code of Practice (Lesson 24)](https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai) — Copyright chapter
- [Longpre, Mahari, Lee et al. — Consent in Crisis (dataprovenance.org, July 2024)](https://www.dataprovenance.org/consent-in-crisis-paper) — DPI audit
- [IAPP — EU Digital Omnibus GDPR amendments (2025)](https://iapp.org/news/a/eu-digital-omnibus-amendments-to-gdpr-to-facilitate-ai-training-miss-the-mark) — regulatory context
