# Regulatory Frameworks — EU, US, UK, Korea

> Four primary regulatory regimes define the 2026 AI governance landscape. EU AI Act (in force 1 August 2024) — prohibited practices and AI literacy from 2 February 2025; GPAI obligations from 2 August 2025; full applicability and Article 50 transparency 2 August 2026; legacy GPAI and embedded high-risk systems 2 August 2027; penalties up to 15M EUR or 3% of global turnover. GPAI Code of Practice (10 July 2025): three chapters — Transparency, Copyright, Safety and Security — 12 commitments; enforcement begins August 2026. UK AISI -> AI Security Institute (February 2025): rename signals narrower scope. US AISI -> CAISI (June 2025): Center for AI Standards and Innovation under NIST; shift toward pro-growth posture. Korean AI Framework Act (passed December 2024, effective January 2026): Article 12 establishes AISI under MSIT; mandates local representatives for foreign AI companies, risk assessment, safety measures for high-impact and generative AI.

**Type:** Learn
**Languages:** none
**Prerequisites:** Phase 18 · 18 (frontier frameworks), Phase 18 · 27 (data governance)
**Time:** ~75 minutes

## Learning Objectives

- Describe the EU AI Act risk tiers (prohibited, high-risk, general-purpose, limited-risk) and the August 2025 / August 2026 / August 2027 timeline.
- Describe the three chapters of the GPAI Code of Practice and which providers each binds.
- Describe the 2025 rebrands: UK AISI -> AI Security Institute; US AISI -> CAISI; what each rebrand implies about policy direction.
- State the core provision of Korea's AI Framework Act.

## The Problem

Lab frameworks (Lesson 18) are voluntary. Regulatory frameworks are compulsory. The 2024-2026 period saw the first wave of comprehensive AI regulation enter force. Deployers must map technical controls to regulatory obligations; the mapping differs by jurisdiction.

## The Concept

### EU AI Act

**In force 1 August 2024.** Risk-tier structure:

- **Prohibited practices** (Article 5). Social scoring, real-time remote biometric identification in public (with law-enforcement exceptions), exploitative manipulation of vulnerable groups. Applied 2 February 2025.
- **High-risk systems** (Annex III). Employment, education, credit, law enforcement, justice, migration. Require conformity assessment, risk management, logging, transparency.
- **General-Purpose AI (GPAI) models**. Applied 2 August 2025. All GPAI providers have obligations; systemic-risk GPAI (>1e25 FLOP training compute) have additional obligations.
- **Limited-risk systems**. Transparency obligations under Article 50 (AI-generated content labelling). Applied 2 August 2026.

Timeline:
- 2 Feb 2025: prohibited practices + AI literacy.
- 2 Aug 2025: GPAI + governance.
- 2 Aug 2026: full applicability + Article 50 transparency + penalties up to 15M EUR / 3% global turnover.
- 2 Aug 2027: legacy GPAI + embedded high-risk.

Commission proposed adjusting the high-risk timeline to 16 months in late 2025.

### GPAI Code of Practice

Published 10 July 2025. Three chapters:

- **Transparency.** All GPAI providers.
- **Copyright.** All GPAI providers.
- **Safety and Security.** Systemic-risk GPAI providers (estimated 5-15 companies).

12 commitments total. A Signatory Taskforce chaired by the AI Office manages implementation. Enforcement begins 2 August 2026; until then, good-faith compliance is accepted.

### Transparency Code for Article 50

First draft 17 December 2025. Second draft March 2026. Final version June 2026. Covers AI-generated content labelling including deepfakes — the regulatory layer that requires Lesson 23's watermarking technology.

### UK AI Security Institute (February 2025)

Renamed from AI Safety Institute. The rebrand narrows scope: drops algorithmic bias and free-speech framings; focuses on frontier capability security. Open-sourced the Inspect evaluation tool (May 2024). Collaborates with Redwood (Lesson 10) on control safety cases.

### US CAISI (June 2025)

Trump administration transforms NIST's AI Safety Institute into the Center for AI Standards and Innovation. Shift toward "pro-growth AI policies" per VP Vance's Paris AI Action Summit remarks. Reduced emphasis on pre-deployment evaluation; emphasis on standards and innovation support. Domestic counterweight to EU AI Act's regulatory posture.

### Korean AI Framework Act

Passed December 2024. Enacted January 2025. Effective January 2026. Consolidates 19 separate AI bills.

Article 12 establishes an AISI under the Ministry of Science and ICT (MSIT). Mandates:
- Local representatives for foreign AI companies operating in Korea.
- Risk assessment for "high-impact" AI systems.
- Safety measures for generative AI and high-impact AI.

First Asian jurisdiction with a comprehensive horizontal AI regulation.

### Cross-jurisdiction dynamics

- EU: strict, risk-tiered, heavy penalties. Benchmark for privacy-adjacent regulation.
- US: innovation-favouring, decentralized, states (e.g., California AB 2013 — Lesson 27) fill federal gaps.
- UK: narrow security focus, strong evaluation infrastructure.
- Korea: MSIT-led, foreign-provider-focused.

Competing regulatory philosophies. Deployers in multiple jurisdictions have to comply with the strictest, which in 2026 is typically the EU AI Act.

### Where this fits in Phase 18

Lesson 18 is lab-voluntary governance; Lesson 24 is regulatory; Lesson 25 is an emerging class of CVEs for AI systems; Lessons 26-27 cover documentation (cards) and training-data governance.

## Use It

No code. Read the EU AI Act primary sources: the regulation text, the GPAI Code of Practice, the UK AISI Inspect framework. Map your deployment to the applicable obligations for each jurisdiction.

## Ship It

This lesson produces `outputs/skill-regulatory-map.md`. Given a deployment description, it maps the applicable jurisdictions, the tier classifications in each, the per-jurisdiction obligations, and the deadline structure.

## Exercises

1. Read the EU AI Act (regulation 2024/1689) and the GPAI Code of Practice (10 July 2025). Identify three obligations that apply to every GPAI provider and three that apply only to systemic-risk GPAI.

2. A deployment is made by a US company, runs on EU infrastructure, and serves Korean users. Which three jurisdictions' rules apply, and which rule binds on each substantive question?

3. The UK AI Security Institute's rename narrows scope. Argue for and against the narrower framing. Identify the policy assumption each position depends on.

4. CAISI's "pro-growth" framing is a departure from the 2022-2024 AI safety institute model. Identify two measurable policy shifts that would follow from this framing.

5. Korea's AI Framework Act requires local representatives for foreign providers. Describe the operational implications for a Bay Area company serving Korean users.

## Key Terms

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| EU AI Act | "the regulation" | Risk-tier-based horizontal AI regulation; in force Aug 2024 |
| GPAI | "general-purpose AI" | Large foundation models; systemic-risk subset has additional obligations |
| Article 50 | "transparency obligations" | AI-generated content labelling; applies Aug 2026 |
| UK AISI | "AI Security Institute" | Renamed Feb 2025; narrower frontier-security focus |
| CAISI | "US center for AI standards" | Renamed Jun 2025 from AI Safety Institute; pro-growth posture |
| Korean AI Framework Act | "MSIT horizontal regulation" | First Asian comprehensive AI law; effective Jan 2026 |
| Systemic-risk GPAI | "the 1e25 FLOP threshold" | Additional obligations tier; estimated 5-15 companies bound |

## Further Reading

- [EU AI Act text (Regulation 2024/1689)](https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai) — the regulation and timeline
- [GPAI Code of Practice (10 July 2025)](https://digital-strategy.ec.europa.eu/en/library/final-version-general-purpose-ai-code-practice) — three-chapter code
- [UK AI Security Institute (renamed Feb 2025)](https://www.gov.uk/government/organisations/ai-security-institute) — official page
- [CSET — South Korea AI Framework Act Analysis (2025)](https://cset.georgetown.edu/publication/south-korea-ai-law-2025/) — Korean framework analysis
