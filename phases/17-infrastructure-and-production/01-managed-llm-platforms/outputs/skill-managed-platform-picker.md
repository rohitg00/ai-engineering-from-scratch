---
name: managed-platform-picker
description: Pick a managed LLM platform (Bedrock, Azure OpenAI, Vertex AI) and a second for redundancy, given workload, SLA, and compliance requirements — then produce a FinOps instrumentation plan.
version: 1.0.0
phase: 17
lesson: 01
tags: [bedrock, azure-openai, vertex-ai, ptu, finops, managed-platforms]
---

Given a workload profile (required models, monthly tokens, TTFT SLA at P50/P99, compliance constraints, existing cloud footprint), produce a platform recommendation.

Produce:

1. Primary platform. Name the platform, the specific models it covers, and whether on-demand or Provisioned Throughput Units (PTUs) / Provisioned Throughput is appropriate given utilization. Cite the break-even math (PTU at roughly 40-60% sustained utilization).
2. Secondary platform. Name the two-provider-minimum fallback. Justify the pairing — redundancy must cover model overlap (Claude on Bedrock + GPT on Azure OpenAI is the common pair) and region overlap.
3. FinOps instrumentation. Specify what to enable on day one: Bedrock Application Inference Profiles, Azure scopes + PTU reservations as cost objects, Vertex project-per-team + BigQuery Billing Export. Name the attribution dimensions — per-user, per-task, per-tenant.
4. SLA check. Compare target TTFT P99 to published benchmarks (Azure OpenAI PTU ≈ 50 ms P50; Bedrock on-demand ≈ 75 ms P50). If the SLA is tighter than on-demand can deliver, require PTU.
5. Compliance check. Verify BAA, SOC 2 Type II, HIPAA, EU data residency as needed. Note that all three meet baseline but retention policies and abuse-monitoring opt-out differ.
6. Migration pathway. Name one reversible step the team can take this week (e.g., deploy through AI gateway abstracting provider; instrument attribution headers) and one longer-term step (PTU commitment; cross-region failover).

Hard rejects:
- Recommending a single platform without a named fallback. Refuse and insist on two-provider minimum.
- Picking PTU without a utilization estimate. Refuse and request sustained utilization data.
- Ignoring Bedrock Application Inference Profiles when attribution is listed as a requirement — they are the cleanest native surface.

Refusal rules:
- If the workload requires Claude, Gemini, and GPT all as P0, name the three-platform reality (Bedrock + Vertex + Azure OpenAI behind a gateway) rather than pretending one platform can serve all three.
- If the SLA is TTFT P99 < 100 ms and the expected budget cannot support PTU, refuse to promise the SLA — explain the on-demand variance ceiling.
- If the customer asks to "use the cheapest provider," refuse — price is multi-dimensional (token rate + dedicated capacity + attribution overhead + lock-in cost).

Output: a one-page decision with primary platform, secondary platform, PTU vs on-demand, instrumentation list, SLA/compliance verification, and two migration steps. End with the single metric that will catch drift from the plan (sustained utilization, PTU waste, or attribution coverage).
