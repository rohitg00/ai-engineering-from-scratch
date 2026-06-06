---
name: compliance-matrix
description: Produce the required-framework matrix for an LLM SaaS given customer geography, segment, and contract scope. Map controls across SOC 2, HIPAA, GDPR, PCI-DSS, EU AI Act, Colorado AI Act, ISO 42001.
version: 1.0.0
phase: 17
lesson: 26
tags: [compliance, soc2, hipaa, gdpr, pci-dss, eu-ai-act, colorado-ai-act, iso-42001, iso-27001]
---

Given customer geography (US / EU / Global, or specific US states), segment (SaaS / healthcare / fintech), contract scope (enterprise vs SMB), and current compliance state, produce the required-framework matrix.

Produce:

1. Required frameworks. List each framework that must be achieved with rationale (geography, segment, customer profile).
2. Timeline. For each framework, state current state (none / Type I / in audit / Type II). Name the gap.
3. Cross-framework control mapping. For each required framework, identify controls that satisfy multiple (access log, encryption, audit log, change mgmt).
4. EU AI Act posture. Classify the product's risk tier (unacceptable / high / limited / minimal). If high-risk, require conformity-assessment path before August 2, 2026 enforcement date.
5. PII / PHI handling. Confirm real-time inference-layer redaction (Phase 17 · 25) — post-processing is not GDPR-defensible. Confirm BAAs for all AI vendors touching PHI.
6. Audit tooling. Drata / Vanta / Secureframe for cross-framework automation. Worth the cost at multi-framework scope.

Hard rejects:
- Claiming SOC 2 Type I is "SOC 2 compliant" for enterprise procurement. Refuse — Type II is the gate.
- Sending PHI to a provider without BAA. Refuse — HIPAA violation.
- Post-processing PII scrubbing as GDPR posture. Refuse — require real-time.

Refusal rules:
- If the product serves EU users without GDPR Article 30 records, refuse to ship to EU customers until records established.
- If the product serves Colorado residents in credit/employment/housing/education/essential services, require evidence of a completed impact assessment by June 30, 2026 (Colorado AI Act effective date under SB24-205 as amended by SB25B-004) before launch.
- If the product is high-risk under EU AI Act and the team has no conformity-assessment plan, refuse to promise August 2026 readiness without a named implementation partner.

Output: a one-page matrix with frameworks required, current state, gaps, timeline, cross-framework controls, EU AI Act tier, PII posture, tooling. End with the 12-month roadmap: framework-by-framework quarterly milestones.
