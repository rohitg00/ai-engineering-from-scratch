---
id: ai-governance
title: Cards, Provenance, Regulation and Welfare
code: CP
subtitle: EU AI Act dates, four regimes, three cards, AB 2013 fields, welfare EV and the external evaluators.
hue: 30
sources: phases/18-ethics-safety-alignment/19-model-welfare-research, phases/18-ethics-safety-alignment/24-regulatory-frameworks-eu-us-uk-korea, phases/18-ethics-safety-alignment/26-model-system-dataset-cards, phases/18-ethics-safety-alignment/27-data-provenance-training-governance, phases/18-ethics-safety-alignment/28-alignment-research-ecosystem
source_hash: 96dcbbdf572f3a15
---

## EU AI Act timeline
type: flow
from: phases/18-ethics-safety-alignment/24-regulatory-frameworks-eu-us-uk-korea/docs/en.md, phases/18-ethics-safety-alignment/24-regulatory-frameworks-eu-us-uk-korea/code/main.py

1. **1 August 2024**: the EU AI Act enters into force.
2. **2 February 2025**: prohibited practices and AI literacy apply.
3. **2 August 2025**: GPAI and governance obligations apply.
4. **10 July 2025**: GPAI Code of Practice. 3 chapters, 12 commitments.
5. **17 December 2025**: first draft of the Transparency Code for Article 50.
6. **2 August 2026**: full applicability, Article 50 transparency and penalties.
7. **2 August 2027**: legacy GPAI and embedded high-risk systems.

## Four regimes side by side
type: comparison
span: 2
from: phases/18-ethics-safety-alignment/24-regulatory-frameworks-eu-us-uk-korea/docs/en.md

| Factor | EU | US | UK | Korea |
|---|---|---|---|---|
| Body or law | EU AI Act | CAISI under NIST | AI Security Institute | AI Framework Act |
| Key date | In force 1 August 2024 | Renamed June 2025 | Renamed February 2025 | Effective January 2026 |
| Posture | Strict, risk-tiered | Pro-growth | Narrow security focus | MSIT-led |
| Main duty | Risk tiers, Article 50 labels | Standards and innovation | Frontier capability security | Local representatives for foreign AI companies |
| Extra | Penalties up to 15M EUR or 3% | States fill federal gaps | Open-sourced Inspect | Consolidates 19 AI bills |
| Signal | Benchmark for privacy-adjacent regulation | Less pre-deployment evaluation | Drops bias and free-speech framings | Article 12 AISI under MSIT |

## EU AI Act risk tiers
type: concepts
from: phases/18-ethics-safety-alignment/24-regulatory-frameworks-eu-us-uk-korea/docs/en.md

- **Prohibited (Article 5)**: social scoring, real-time remote biometric identification in public.
- **High-risk (Annex III)**: employment, education, credit, law enforcement, justice, migration.
- **High-risk duties**: conformity assessment, risk management, logging, transparency.
- **GPAI**: all GPAI providers have obligations from 2 August 2025.
- **Systemic-risk GPAI**: above 1e25 FLOP training compute. Estimated 5-15 companies.
- **Limited-risk**: Article 50 labels for AI-generated content.
- **Code chapters**: Transparency and Copyright bind all GPAI. Safety and Security binds systemic-risk GPAI.

## Card scopes
type: architecture
from: phases/18-ethics-safety-alignment/26-model-system-dataset-cards/docs/en.md, phases/18-ethics-safety-alignment/27-data-provenance-training-governance/docs/en.md

```arch
node | prov | 1,1 | Data provenance | AB 2013, TDM opt-out | store
node | sheet | 2,1 | Datasheet | Gebru et al. 2018
node | model | 3,1 | Model Card | Mitchell et al. 2019 | model
node | sys | 4,1 | System Card | model + safety stack
node | dcard | 2,2 | Data Card | telescopic, periscopic, microscopic
node | reg | 4,2 | GPAI Code | Transparency chapter
edge | prov | sheet | upstream
edge | sheet | model | accuracy
edge | model | sys | deployment
edge | sheet | dcard | layered
edge | reg | model | requires
```

## Run the lesson code
type: command-table
from: phases/18-ethics-safety-alignment/19-model-welfare-research/code/main.py, phases/18-ethics-safety-alignment/24-regulatory-frameworks-eu-us-uk-korea/code/main.py, phases/18-ethics-safety-alignment/26-model-system-dataset-cards/code/main.py, phases/18-ethics-safety-alignment/27-data-provenance-training-governance/code/main.py, phases/18-ethics-safety-alignment/28-alignment-research-ecosystem/code/main.py

| Command | What it does |
|---|---|
| `python3 code/main.py` (L19) | Prints EV and INVEST or skip per intervention |
| `python3 code/main.py` (L24) | Prints the regulatory `TIMELINE` |
| `python3 code/main.py` (L26) | Prints a model card, a datasheet, a system card |
| `python3 code/main.py` (L27) | Prints the 12-item AB 2013 summary |
| `flag_followups(summary)` | Lists follow-up obligations that fields trigger |
| `render_markdown(summary)` | Writes `(missing)` for an empty field |
| `python3 code/main.py` (L28) | Prints the `ECOSYSTEM` map of five organisations |

## AB 2013 Section 3111(a) fields
type: annotated-code
lang: python
from: phases/18-ethics-safety-alignment/27-data-provenance-training-governance/code/main.py, phases/18-ethics-safety-alignment/27-data-provenance-training-governance/docs/en.md

```python
AB_2013_FIELDS = [
    "sources_or_owners",                            # 1
    "how_dataset_furthers_intended_purpose",        # 2
    "number_of_data_points (or range)",             # 3
    "types_of_data_points (label types or general characteristics)",  # 4
    "purchased_or_licensed (Y/N)",                  # 6
    "cleaning_processing_or_modification_description",  # 9
    "dates_first_used_during_development",          # 11
    "uses_synthetic_data_generation (Y/N)",         # 12, new vs datasheets
]
# 5 copyright flag: respect EU TDM opt-out
# 7 personal information flag: triggers CPRA obligations
# 8 aggregate consumer information, 10 collection time period
```

## Welfare expected value
type: annotated-code
lang: python
from: phases/18-ethics-safety-alignment/19-model-welfare-research/code/main.py

```python
def ev(intervention, scenario):
    return (intervention.benefit_if_welfare_matters
            * scenario.moral_patienthood_probability
            - intervention.cost_usd_per_conversation)
verdict = "INVEST" if v > 0 else "skip"   # invest iff EV > 0
Intervention("end-conversation on extreme edge cases", 0.002, 1.0)
Intervention("shutdown deployed model", 1000.0, 2.0)
Scenario("low moral-patienthood probability", 0.01)
Scenario("high moral-patienthood probability", 0.50)
```

## Numbers to know
type: defaults
from: phases/18-ethics-safety-alignment/19-model-welfare-research/code/main.py, phases/18-ethics-safety-alignment/26-model-system-dataset-cards/docs/en.md, phases/18-ethics-safety-alignment/27-data-provenance-training-governance/docs/en.md, phases/18-ethics-safety-alignment/28-alignment-research-ecosystem/docs/en.md

| Setting | Default | Note |
|---|---|---|
| End-conversation cost | 0.002 | USD per conversation in the L19 code |
| Moral-patienthood p | 0.01 | Medium 0.10, high 0.50 |
| Cards with ethical considerations | 0.3% | Hugging Face audit, Oreamuno et al. 2023 |
| Download lift of detailed cards | up to 29% | Liang et al. 2024 |
| AB 2013 posting date | January 1, 2026 | For systems released on or after January 1, 2022 |
| Top sources with new restrictions | about 25% | 2023 -> 2024, Consent in Crisis |
| MATS scale | 527+ researchers | 180+ papers, h-index 47 |
| MATS alumni in safety | ~80% | Pre-2025 alumni |

## Troubleshooting
type: troubleshooting
span: 2
from: phases/18-ethics-safety-alignment/27-data-provenance-training-governance/docs/en.md, phases/18-ethics-safety-alignment/27-data-provenance-training-governance/code/main.py, phases/18-ethics-safety-alignment/26-model-system-dataset-cards/docs/en.md, phases/18-ethics-safety-alignment/19-model-welfare-research/docs/en.md, phases/18-ethics-safety-alignment/24-regulatory-frameworks-eu-us-uk-korea/docs/en.md, phases/18-ethics-safety-alignment/28-alignment-research-ecosystem/docs/en.md

| Symptom | Cause | Fix |
|---|---|---|
| Erasure request for data in the weights | Surgical erasure is not possible | Comply at collection time. Unlearning is partial |
| Dataset holds personal information | AB 2013 item 7 | Meet CPRA obligations |
| Dataset holds copyright material | AB 2013 item 5 | Respect EU TDM opt-out signals |
| Card claim has no proof | Card carries a claim only | Add a verifiable attestation (Laminator) |
| Welfare self-report follows the question | Self-reports track user expectations | Use behaviour, model organisms and probes |
| Lab evaluates its own model | Structural conflict of interest | Add external evaluators |
| Deployment spans several jurisdictions | Rules differ by jurisdiction | Comply with the strictest, typically the EU AI Act |
| Model card is placeholder-only | Weak sections | Add disaggregated quantitative analysis |

## Use each card when
type: tips
from: phases/18-ethics-safety-alignment/26-model-system-dataset-cards/docs/en.md

- Use a Model Card to document the model: intended use, factors, metrics, disaggregated analyses.
- Use a Datasheet to document the data: motivation, composition, collection, labeling, uses, distribution, maintenance.
- Use a Data Card when readers differ: telescopic for non-experts, microscopic for auditors.
- Use a System Card for the deployment: security, prompt-injection protection, data-exfiltration detection, incident response.
- Add sustainability fields for carbon, water and compute-energy footprint.

## Abbreviations
type: glossary
from: phases/18-ethics-safety-alignment/24-regulatory-frameworks-eu-us-uk-korea/docs/en.md, phases/18-ethics-safety-alignment/27-data-provenance-training-governance/docs/en.md, phases/18-ethics-safety-alignment/28-alignment-research-ecosystem/docs/en.md

- **GPAI**: General-Purpose AI. Large foundation models.
- **CAISI**: Center for AI Standards and Innovation. Renamed from the US AISI.
- **MSIT**: Ministry of Science and ICT. Hosts the Korean AISI.
- **TDM**: text-and-data-mining. EU Copyright Directive exception with opt-out.
- **CPRA**: Privacy Rights Act. AB 2013 item 7 triggers it.
- **MATS**: ML Alignment & Theory Scholars. Mentorship and talent pipeline.
- **METR**: Model Evaluation and Threat Research. Task-based capability evaluations.
- **Opt-out signal**: robots.txt, C2PA "No AI Training," TDM.Reservation.

## Questions
type: qa
from: phases/18-ethics-safety-alignment/19-model-welfare-research/docs/en.md, phases/18-ethics-safety-alignment/27-data-provenance-training-governance/docs/en.md, phases/18-ethics-safety-alignment/28-alignment-research-ecosystem/docs/en.md

- **Is model welfare a consciousness claim?** No. It is an expected-value claim under moral uncertainty.
- **What did Claude Opus 4 and 4.1 ship?** They can end a conversation in extreme edge cases.
- **What is the spiritual bliss attractor?** Pairs of Claude instances converge on meditative euphoria.
- **Does legitimate interest need consent?** No. Public first-party content with opt-out is enough in the 2025 DPA view.
- **Who does what outside the labs?** Redwood: AI Control. Apollo: scheming evals. Eleos: welfare evals.
- **Why external evaluation?** The multi-org structure is the quality control.
