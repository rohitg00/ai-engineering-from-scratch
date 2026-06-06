# Model, System, and Dataset Cards

> Three documentation formats structure AI transparency. Model Cards (Mitchell et al. 2019) — nutrition labels for models: training data, quantitative disaggregated analyses, ethical considerations, caveats; only 0.3% of Hugging Face model cards document ethical considerations (Oreamuno et al. 2023). Datasheets for Datasets (Gebru et al. 2018, CACM) — motivation, composition, collection process, labeling, distribution, maintenance; electronics-datasheet analogy. Data Cards (Pushkarna et al., Google 2022) — modular layered detail (telescopic, periscopic, microscopic) as boundary objects for diverse readers. 2024-2025 developments: automated generation via LLMs (CardGen, Liu et al. 2024); model-card detail correlates with up to 29% download increase on HF (Liang et al. 2024); verifiable attestations (Laminator, Duddu et al. 2024); sustainability reporting additions for carbon/water (Jouneaux et al. July 2025); EU/ISO regulatory cards emerging. System Cards (Sidhpurwala 2024; Meta system-level transparency; "Blueprints of Trust" arXiv:2509.20394) — end-to-end AI system documentation covering security capabilities, prompt-injection protection, data-exfiltration detection, alignment with human values.

**Type:** Build
**Languages:** Python (stdlib, model-card + datasheet + system-card generator)
**Prerequisites:** Phase 18 · 18 (safety frameworks), Phase 18 · 24 (regulatory)
**Time:** ~60 minutes

## Learning Objectives

- Describe the original Mitchell et al. 2019 model card and the Gebru et al. 2018 datasheet.
- Describe Data Cards' telescopic/periscopic/microscopic layering.
- Describe System Cards and their end-to-end coverage.
- State three 2024-2025 developments (automated generation, verifiable attestations, sustainability reporting).

## The Problem

Regulatory frameworks (Lesson 24) and lab safety policies (Lesson 18) both require documentation. Documentation formats evolved from model-specific (model cards) to dataset-specific (datasheets) to system-specific (system cards). Each addresses a different scope of transparency. The 2024-2025 automation and verifiable-attestation work addresses the long-standing adoption problem.

## The Concept

### Model Cards (Mitchell et al. 2019)

Sections:
- Model details.
- Intended use.
- Factors (relevant demographic or environmental factors for evaluation).
- Metrics.
- Evaluation data.
- Training data.
- Quantitative analyses (disaggregated by factors).
- Ethical considerations.
- Caveats and recommendations.

Adoption problem: Oreamuno et al. 2023 audit of Hugging Face model cards found only 0.3% document ethical considerations.

### Datasheets for Datasets (Gebru et al. 2018)

Electronics-datasheet analogy. Sections:
- Motivation (why was the dataset created).
- Composition (what is in it).
- Collection process (how was it assembled).
- Labeling (if applicable).
- Uses (intended, prohibited, risks).
- Distribution.
- Maintenance.

Published in CACM 2021. The datasheet is the upstream documentation; the model card depends on the datasheet being accurate.

### Data Cards (Pushkarna et al., Google 2022)

Modular layered detail. Three zoom levels:
- **Telescopic.** High-level summary for non-experts.
- **Periscopic.** Middle-level overview for ML practitioners.
- **Microscopic.** Detailed feature-level documentation for auditors.

Boundary-object framing: different readers extract different information from the same document.

### System Cards

Scope: end-to-end AI system including model + safety stack + deployment context. Sections typically include:
- Security capabilities.
- Prompt-injection protection.
- Data-exfiltration detection.
- Alignment with stated human values.
- Incident response.

Sidhpurwala 2024 and Meta system-level transparency work. "Blueprints of Trust" (arXiv:2509.20394) formalizes the System Card as the deployment-layer complement to Model Cards.

### 2024-2025 developments

- **CardGen (Liu et al. 2024).** Automated model-card generation via LLMs; reports higher objectivity than many human-authored cards on the standardized Mitchell 2019 fields.
- **Download correlation (Liang et al. 2024).** Detailed model cards correlate with up to 29% higher download rates on HF — adoption pressure is now market-driven, not only compliance-driven.
- **Laminator (Duddu et al. 2024).** Verifiable attestations via hardware TEE / cryptographic signatures — allows the model card to carry a proof-of-claim, not just a claim.
- **Sustainability (Jouneaux et al. July 2025).** Additions for carbon, water, and compute-energy footprint; emerging ISO standards.
- **Regulatory cards.** EU AI Act (Lesson 24) GPAI Code of Practice Transparency chapter requires model cards as a compliance artifact.

### Where this fits in Phase 18

Lessons 24-25 are regulatory and CVE layers. Lesson 26 is the documentation layer. Lesson 27 is training-data governance, which is the datasheet's upstream. Lesson 28 is the research ecosystem that produces evaluations referenced in cards.

## Use It

`code/main.py` generates a minimal model card, datasheet, and system card for a toy deployment. Each follows the canonical section structure. You can inspect the format and compare the three scopes.

## Ship It

This lesson produces `outputs/skill-card-audit.md`. Given a model card, datasheet, or system card, it audits section coverage, numerical disaggregation, and whether verifiable attestations are present.

## Exercises

1. Run `code/main.py`. Inspect the generated cards. Identify sections that are weak (placeholder-only) and specify what evidence would strengthen them.

2. Extend the model card with a quantitative disaggregated analysis across two demographic groups (Lesson 20).

3. Read Oreamuno et al. 2023 on the 0.3% adoption rate. Propose one structural change to the model card specification that would increase ethical-considerations adoption.

4. Laminator (Duddu et al. 2024) uses TEEs for verifiable attestations. Design a model-card field that carries a cryptographic attestation of an evaluation result and describe the verifier's role.

5. Write a System Card (System Card, not Model Card) for one of your past projects or a hypothetical deployment. Identify the highest-value section for third-party auditors.

## Key Terms

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Model Card | "the Mitchell card" | Mitchell et al. 2019 standard documentation for ML models |
| Datasheet | "the Gebru datasheet" | Gebru et al. 2018 standard documentation for datasets |
| Data Card | "the Pushkarna card" | Google 2022 modular layered data documentation |
| System Card | "the deployment card" | End-to-end AI system documentation including safety stack |
| Boundary object | "different readers, one doc" | Data Cards framing: same document serves diverse audiences |
| Verifiable attestation | "the Laminator attestation" | Cryptographic or TEE proof attached to a documentation claim |
| Sustainability field | "carbon / water footprint" | Emerging 2025 addition for environmental accounting |

## Further Reading

- [Mitchell et al. — Model Cards for Model Reporting (arXiv:1810.03993, FAT* 2019)](https://arxiv.org/abs/1810.03993) — the canonical model card
- [Gebru et al. — Datasheets for Datasets (CACM 2021, arXiv:1803.09010)](https://arxiv.org/abs/1803.09010) — datasheet paper
- [Pushkarna et al. — Data Cards (Google 2022)](https://arxiv.org/abs/2204.01075) — layered data documentation
- [Sidhpurwala et al. — Blueprints of Trust (arXiv:2509.20394)](https://arxiv.org/abs/2509.20394) — System Card formalization
