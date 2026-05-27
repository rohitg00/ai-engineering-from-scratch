---
name: societal-risk-review
description: Review a deployment for societal-scale-risk posture using the CAIS four-risk framework and CAISI / SB-53 regulatory context.
version: 1.0.0
phase: 15
lesson: 22
tags: [cais, caisi, four-risk-framework, organizational-risk, sb-53, societal-risk]
---

Given a proposed or operating AI deployment, produce a societal-scale-risk review that tags the deployment against the CAIS four-risk framework, inventories organizational-risk sub-levers, and names the regulatory surface.

Produce:

1. **Four-risk tagging.** For each of the four categories (malicious use, AI races, organizational risks, rogue AIs), state whether the deployment touches it and how. A deployment can touch multiple categories; "does not apply" must be justified in one sentence.
2. **Organizational-risk inventory.** Score the deployment against the four sub-levers: safety culture, audit rigor, multi-layered defenses, information security. Any lever scored "missing" is a flagged gap.
3. **Regulatory surface.** Name the applicable regulatory frameworks: EU AI Act (if in EU or serving EU users), California SB-53 (if signed and applicable), CAISI voluntary agreements (if the lab has signed one). Compliance is a deployment gate, not a deployment nice-to-have.
4. **External-evaluation posture.** Name the external evaluations the deployment or its base model has undergone (METR, CAISI, Apollo, Gray Swan, etc.). No external evaluation is a flagged gap for long-horizon autonomous deployments.
5. **Structural-force exposure.** Estimate how much competitive-deployment pressure the organization is under and how that trades against the organizational-risk levers. Teams under heavy race pressure de-prioritize audit first; this is the CAIS finding.

Hard rejects:
- Deployments touching harmful-capability categories without a hardcoded-prohibition layer (Lesson 17).
- Deployments in competitive-race conditions with no independent audit.
- Long-horizon autonomous deployments with no external capability evaluation.
- EU deployments with no Article 14 HITL (Lesson 15).
- California deployments with no incident-reporting process if SB-53 is signed.

Refusal rules:
- If the user cannot name the external evaluator for the base model, refuse and require identification first. Self-evaluation alone is insufficient.
- If the user treats "we have a scaling policy" as compliance with catastrophic-risk regulation, refuse and require specific regulatory-surface mapping.
- If the user proposes deploying under race pressure without audit, refuse and name the CAIS finding on organizational risk.

Output format:

Return a societal-risk review with:
- **Four-risk row table** (category, touched y/n, nature)
- **Organizational-risk scorecard** (safety culture / audit / defenses / infosec)
- **Regulatory surface** (applicable frameworks with compliance status)
- **External-evaluation posture** (evaluator, scope, cadence)
- **Structural-force exposure** (low / medium / high with rationale)
- **Deployment readiness** (production / staging / research-only)
