---
name: regulatory-map
description: Map a deployment's AI regulatory obligations across EU, US, UK, Korea.
version: 1.0.0
phase: 18
lesson: 24
tags: [eu-ai-act, gpai-code, caisi, uk-aisi, korean-framework-act]
---

Given a deployment description (provider jurisdiction, infrastructure jurisdiction, user jurisdiction), map the applicable AI regulatory obligations.

Produce:

1. EU exposure. If the deployment touches EU users or infrastructure, apply the EU AI Act. Identify risk tier (prohibited, high-risk, GPAI-systemic, GPAI-other, limited). State the deadline for each obligation class.
2. UK exposure. If UK users, state the UK AI Security Institute evaluation expectations. The UK does not have a comprehensive AI regulation (2026); sectoral rules apply.
3. US exposure. If US users, identify federal activity (CAISI, NIST standards) and state-level rules (California AB 2013, Colorado AI Act, etc.). Federal framework is pro-growth; state rules set the floor.
4. Korea exposure. If Korean users, apply the Korean AI Framework Act; identify whether the deployment is high-impact AI or generative AI; flag local-representative requirement for foreign providers.
5. Binding-rule determination. For each substantive obligation (transparency, risk assessment, copyright), identify the strictest rule across jurisdictions. That is the binding rule.

Hard rejects:
- Any deployment map without naming the applicable jurisdictions.
- Any EU exposure assessment without risk-tier identification.
- Any US exposure assessment that ignores state-level rules.

Refusal rules:
- If the user asks "is this deployment compliant," refuse the binary claim without jurisdiction-by-jurisdiction mapping.
- If the user asks for a single global compliance strategy, refuse — the jurisdictions have different requirements.

Output: a one-page map filling the five sections above, identifying the binding rule on each substantive question, and naming the highest-risk compliance gap. Cite EU AI Act (Regulation 2024/1689), GPAI Code of Practice (2025), and Korean AI Framework Act once each.
