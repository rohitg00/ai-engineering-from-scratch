# Compliance — SOC 2, HIPAA, GDPR, PCI-DSS, EU AI Act, ISO 42001

> Multi-framework coverage is table stakes for 2026 enterprise deals. **EU AI Act**: in force since August 1, 2024. Most high-risk requirements enforce August 2, 2026. Fines up to €15M or 3% global annual turnover for high-risk-system obligations (Art. 99(4)); up to €35M or 7% for prohibited AI practices (Art. 99(3)). Applies globally if serving EU users. **Colorado AI Act**: effective June 30, 2026 (delayed from February 2026 by SB25B-004) — impact assessments for high-risk systems, right to appeal AI decisions. Virginia similar for credit/employment/housing/education. **SOC 2 Type II**: de facto B2B AI requirement (Type II, not Type I, for fintech). **GDPR**: largest documented AI-specific fine is €30.5M against Clearview AI (Dutch DPA, Sept 2024); Italy's Garante issued €15M against OpenAI in Dec 2024 (later overturned on appeal in March 2026). Real-time PII redaction at inference is the defensible standard; post-processing cleanup is not enough. **HIPAA**: healthcare bound — cannot send PHI to external AI services without BAA. **PCI-DSS**: AI-interaction-layer coverage requires configuration + contractual agreements, not automatic. **ISO 42001**: emerging AI governance standard, growing procurement requirement alongside ISO 27001. Reference profile: OpenAI maintains SOC 2 Type 2, ISO/IEC 27001:2022, ISO/IEC 27701:2019, GDPR/CCPA/HIPAA (BAA)/FERPA, PCI-DSS for ChatGPT payment components. Cross-framework mapping reduces audit fatigue: access controls map across ISO 27001 A.5.15-5.18, GDPR Art. 32, HIPAA §164.312(a).

**Type:** Learn
**Languages:** (Python optional — compliance is policy + process, not code)
**Prerequisites:** Phase 17 · 25 (Security), Phase 17 · 13 (Observability)
**Time:** ~60 minutes

## Learning Objectives

- Enumerate the seven 2026 frameworks relevant to LLM products and match each to a customer segment.
- Cite the EU AI Act enforcement timeline (in force August 2024; high-risk enforcement August 2026) and the two-tier fine ceiling (€15M / 3% for high-risk obligations, €35M / 7% for prohibited practices).
- Explain why post-processing PII cleanup is not enough for GDPR and name real-time inference-layer redaction as the defensible standard.
- Describe cross-framework control mapping (e.g., access control maps to ISO 27001 A.5.15-5.18 + GDPR Art. 32 + HIPAA §164.312(a)).

## The Problem

An enterprise customer's procurement asks for SOC 2 Type II, GDPR, HIPAA BAA, ISO 27001, and "EU AI Act compliance statement." Your team has SOC 2 Type I. You're six months from Type II and haven't started GDPR Article 30 records.

Multi-framework coverage is not an LLM problem — it's an enterprise-SaaS problem, with LLM-specific overlays. Procurement teams in 2026 want a matrix with a row per framework and a column per control, not a PDF.

## The Concept

### The seven frameworks

| Framework | Scope | LLM-specific requirement |
|-----------|-------|--------------------------|
| SOC 2 Type II | B2B SaaS baseline | Process controls audited over 6-12 months |
| HIPAA | US healthcare | BAA required; PHI cannot leave infrastructure without signed agreement |
| GDPR | EU users | Real-time PII redaction; data subject rights; Article 30 records |
| PCI-DSS | Payment data | Configuration + contracts for AI touching payment |
| EU AI Act | Serving EU users | Risk tier classification; high-risk systems: conformity assessment, documentation, logging |
| Colorado AI Act | Serving CO residents | Impact assessments; right to appeal |
| ISO 42001 | AI governance | Emerging; pairs with ISO 27001 |

### EU AI Act timeline

- August 1, 2024: in force.
- February 2, 2025: prohibited-AI practices enforced.
- August 2, 2026: high-risk systems enforced (conformity assessment, documentation, logging).
- August 2027: high-risk systems in products under harmonized legislation.

Risk tiers: Unacceptable (banned), High-risk (conformity + logging), Limited-risk (transparency), Minimal-risk (no constraint). Most B2B LLM SaaS is limited-risk; high-risk kicks in for employment, credit, education, law enforcement, migration, essential services.

Fines (Article 99): up to €15M or 3% global annual turnover for breaches of high-risk-system obligations (Art. 99(4)); up to €35M or 7% for prohibited AI practices (Art. 99(3)); whichever higher applies.

### GDPR — real-time redaction is the standard

Post-processing cleanup (redact PII after the LLM sees it) is not a defensible posture — the model already saw the data. Real-time inference-layer redaction is the 2026 standard:

- Entity recognition before the LLM call.
- Consistent tokenization (Mesh approach) preserves semantics.
- Store only redacted prompts + consented opt-in raw.

Recent enforcement: €30.5M against Clearview AI (Dutch DPA, Sept 2024) is the largest documented AI-specific GDPR fine to date; €15M against OpenAI (Italy's Garante, Dec 2024) is the largest LLM-specific fine, though it was overturned on appeal in March 2026 and the ruling remains under further review. Post-processing claims have failed at audit.

### HIPAA — BAA is not optional

You cannot send PHI to external AI services without a signed Business Associate Agreement. All three hyperscaler LLM platforms (Bedrock, Azure OpenAI, Vertex) offer BAAs. OpenAI direct API offers BAA. Anthropic direct API offers BAA. Confirm before sending PHI.

### SOC 2 Type II

Type I: controls designed and documented.
Type II: controls operate effectively over 6-12 months.

B2B procurement in 2026 defaults to Type II. Type I is a starter; Type II is the gate.

Common audit drivers: access logs (who saw what), change management (how was it deployed), risk assessments (quarterly), incident response (tested?). Audit log from Phase 17 · 25 is directly reusable.

### Cross-framework mapping

One access control policy satisfies multiple framework controls:

| Control | Frameworks |
|---------|-----------|
| Access logging | ISO 27001 A.5.15-5.18, GDPR Art. 32, HIPAA §164.312(a) |
| Change management | ISO 27001 A.8.32, PCI DSS Req. 6, HIPAA breach-notification scope |
| Encryption in transit | ISO 27001 A.8.24, GDPR Art. 32, HIPAA §164.312(e) |
| Secrets management | ISO 27001 A.8.19, PCI DSS Req. 8, SOC 2 CC6.1 |

Compliance tools (Drata, Vanta, Secureframe) automate this mapping. Worth the cost at scale.

### ISO 42001 — emerging

Published late 2023. Growing procurement requirement alongside ISO 27001. Framework for AI governance including risk management, data quality, transparency, human oversight.

### OpenAI's reference profile

OpenAI maintains SOC 2 Type 2, ISO/IEC 27001:2022, ISO/IEC 27701:2019, GDPR/CCPA/HIPAA (BAA)/FERPA, PCI-DSS for ChatGPT payment components. That is roughly the enterprise table stakes in 2026.

### Numbers you should remember

- EU AI Act fines: up to €15M / 3% (high-risk obligations, Art. 99(4)); up to €35M / 7% (prohibited practices, Art. 99(3)).
- EU AI Act high-risk enforcement: August 2, 2026.
- Largest documented AI-specific GDPR fine: €30.5M, Clearview AI (Dutch DPA, Sept 2024).
- Largest LLM-specific GDPR fine: €15M, OpenAI (Italy's Garante, Dec 2024; overturned on appeal March 2026).
- SOC 2 Type II window: 6-12 months of operated controls.
- Colorado AI Act effective date: June 30, 2026 (delayed from February 2026 by SB25B-004).

## Use It

`code/main.py` is a compliance-mapping spreadsheet in Python — given a control, lists frameworks it satisfies.

## Ship It

This lesson produces `outputs/skill-compliance-matrix.md`. Given customer segment and geography, specifies required frameworks and controls.

## Exercises

1. Your first enterprise customer requires SOC 2 Type II, HIPAA BAA, EU AI Act statement. What is the minimum viable compliance posture to win the deal?
2. Classify three hypothetical LLM products under EU AI Act risk tiers. What changes at high-risk?
3. You accidentally sent PHI to a provider without BAA. Walk through the incident response.
4. Argue whether ISO 42001 is "necessary in 2026" for a mid-market AI vendor.
5. Map your LLM audit log fields (Phase 17 · 25) to at least three framework controls.

## Key Terms

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| SOC 2 Type II | "audited controls" | Controls operating over 6-12 months, independently attested |
| HIPAA BAA | "healthcare contract" | Business Associate Agreement; required for PHI |
| GDPR | "EU privacy" | Real-time PII redaction is the defensible 2026 standard |
| EU AI Act | "EU AI rules" | High-risk enforcement August 2026; €15M / 3% (high-risk obligations) — €35M / 7% (prohibited practices) |
| Colorado AI Act | "US AI state law" | June 30, 2026 effective (delayed by SB25B-004); impact assessments |
| ISO 42001 | "AI governance" | Emerging framework for AI risk + transparency |
| ISO 27001 | "security ISMS" | Information Security Management System baseline |
| Conformity assessment | "EU AI doc package" | High-risk requirement: docs, testing, logging |
| Cross-framework mapping | "one control, many frames" | Single policy satisfies multiple framework controls |

## Further Reading

- [OpenAI Security and Privacy](https://openai.com/security-and-privacy/) — reference compliance profile.
- [GuardionAI — LLM Compliance 2026: ISO 42001, EU AI Act, SOC 2, GDPR](https://guardion.ai/blog/llm-compliance-guide-iso-42001-eu-ai-act-soc2-gdpr-2026)
- [Dsalta — SOC 2 Type 2 Audit Guide 2026: 10 AI Controls](https://www.dsalta.com/resources/ai-compliance/soc-2-type-2-audit-guide-2026-10-ai-powered-controls-every-saas-team-needs)
- [EU AI Act official text](https://eur-lex.europa.eu/eli/reg/2024/1689/oj) — primary source.
- [Colorado AI Act](https://leg.colorado.gov/bills/sb24-205) — primary source.
- [ISO/IEC 42001:2023](https://www.iso.org/standard/81230.html) — AI management system standard.
