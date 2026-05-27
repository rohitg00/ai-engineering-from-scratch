# Managed LLM Platforms — Bedrock, Vertex AI, Azure OpenAI

> Three hyperscalers, three distinct strategies. AWS Bedrock is a model marketplace — Claude, Llama, Titan, Stability, Cohere behind one API. Azure OpenAI is an exclusive OpenAI partnership plus Provisioned Throughput Units (PTUs) for dedicated capacity. Vertex AI is Gemini-first with the best long-context and multimodal story. In 2026 Artificial Analysis measures Azure OpenAI at ~50 ms median and Bedrock at ~75 ms on Llama 3.1 405B equivalents — PTUs explain the gap because dedicated capacity beats shared on-demand. The decision rule is not "which is fastest" but "which model catalog and FinOps surface match my product." This lesson teaches you to pick with the tradeoffs written down, not vibes.

**Type:** Learn
**Languages:** Python (stdlib, toy cost-and-latency comparator)
**Prerequisites:** Phase 11 (LLM Engineering), Phase 13 (Tools & Protocols)
**Time:** ~60 minutes

## Learning Objectives

- Name the three platform strategies (marketplace vs exclusive vs Gemini-first) and match each to a product use case.
- Explain what Provisioned Throughput Units (PTUs) buy you in Azure OpenAI and why on-demand Bedrock typically reads ~25 ms slower at the 405B scale.
- Diagram the FinOps attribution surface for each platform (Bedrock Application Inference Profiles vs Vertex project-per-team vs Azure scopes + PTU reservations).
- Write down a "two-provider minimum" policy and explain why single-vendor lock-in is the expensive mistake in 2026.

## The Problem

You picked Claude 3.7 Sonnet for your product. Now you need to serve it. You can call the Anthropic API directly, or you can call it through AWS Bedrock, or you can go through a gateway. The direct API is the simplest; Bedrock adds BAAs, VPC endpoints, IAM, and CloudWatch attribution. The gateway adds failover, unified billing, and rate limits across providers.

The deeper question is catalog. If you need Claude and Llama and Gemini in the same product, you cannot buy them all from one place unless that place is Bedrock plus Vertex plus Azure OpenAI simultaneously. The hyperscalers are not interchangeable — they each made a different bet on who owns the model layer.

This lesson maps the three bets, the latency gap, the FinOps gap, and the lock-in risk.

## The Concept

### Three strategies

**AWS Bedrock** — the marketplace. Claude (Anthropic), Llama (Meta), Titan (AWS first-party), Stability (image), Cohere (embeddings), Mistral, plus image and embedding sub-catalogs. One API, one IAM surface, one CloudWatch export. Bedrock's bet is that customers want optionality more than they want a single model.

**Azure OpenAI** — the exclusive partnership. You get GPT-4 / 4o / 5 / o-series, DALL·E, Whisper, and fine-tuning of OpenAI models in Azure datacenters. No non-OpenAI models in the "Azure OpenAI Service" catalog — those go to Azure AI Foundry (separate product). Azure's bet is that OpenAI remains the frontier and customers want enterprise controls on that specific relationship.

**Vertex AI** — Gemini first, everything else second. Gemini 1.5 / 2.0 / 2.5 Flash and Pro, plus Model Garden (third-party). Vertex's bet is multimodal long-context — 1M-token Gemini context is the differentiator.

### Latency gap at scale

Artificial Analysis runs continuous benchmarks. On equivalent Llama 3.1 405B deployments (shared on-demand), Azure OpenAI median first-token latency is around 50 ms; Bedrock is around 75 ms. The gap is not an AWS failure — it is a capacity model difference. Azure sells PTUs (Provisioned Throughput Units), which reserve GPU capacity for your tenant. Bedrock's equivalent (Provisioned Throughput) exists but starts around $21/hour per unit, and most customers stay on shared on-demand.

On-demand shared capacity competes with every other customer's traffic. Dedicated capacity does not. If your product SLA is TTFT < 100 ms at P99, you either buy PTUs on Azure, buy Bedrock Provisioned Throughput, or accept the default variance.

### Provisioned Throughput economics

Azure PTUs: a reserved block of inference compute. Up to ~70% savings vs on-demand for predictable workloads. Costs fixed per hour regardless of traffic — you pay for the reservation even when idle. The break-even is usually around 40-60% sustained utilization.

Bedrock Provisioned Throughput: $21-$50 per hour depending on model and region. Similar math — break-even is around half peak utilization. Monthly commitment required.

Vertex provisioned capacity is sold per Gemini SKU; pricing varies by model and region and is less publicly advertised.

### FinOps surface — the real differentiator

**Bedrock Application Inference Profiles** are the cleanest attribution in the marketplace. Tag a profile with `team`, `product`, `feature`; route all model invocations through it; CloudWatch breaks out cost per profile without post-processing. Added 2025, still the most granular hyperscaler native.

**Vertex** attribution is project-per-team plus labels-everywhere. You model each team as a GCP project, put labels on every resource, and use BigQuery Billing Export + DataStudio for rollups. More work, but BigQuery gives you arbitrary SQL on the cost data.

**Azure** relies on subscription/resource-group scopes plus tags, with PTU reservations as a first-class cost object. Tags are inherited from resource groups, not requests, so per-request attribution requires Application Insights custom metrics or a gateway that stamps headers.

The pattern: Bedrock is cleanest native, Vertex is most flexible via BigQuery, Azure is most opaque unless you instrument.

### Lock-in is the 2026 risk

Single-hyperscaler commitment was fine when one model dominated. In 2026 the frontier moves monthly — Claude 3.7 one quarter, Gemini 2.5 the next, GPT-5 the quarter after. Locking to one platform locks you out of two-thirds of the frontier.

The pattern working teams adopt: two-provider minimum for any product-critical LLM call. Bedrock plus Azure OpenAI is the common pair — Claude from one, GPT from the other, failover between them, same gateway. Cost uplift is negligible because gateway routes optimal; availability uplift during outages (like the Azure OpenAI January 2025 incident, the AWS us-east-1 outage) is decisive.

### Data residency, BAAs, and regulated industries

Bedrock: BAAs in most regions; VPC endpoints; guardrails. Common fintech default.
Azure OpenAI: HIPAA, SOC 2, ISO 27001; EU data residency; the enterprise-regulated default.
Vertex: HIPAA, GDPR, data residency per region; Google Cloud's compliance stack.

All three meet the basic checkbox. The differences are in data retention policies, how logs are handled, and whether abuse-monitoring reads your traffic (default opt-in on most; opt-out available for enterprise).

### Numbers you should remember

- Azure OpenAI median TTFT on Llama 3.1 405B equivalents: ~50 ms (with PTUs).
- Bedrock median TTFT on-demand: ~75 ms.
- Bedrock Provisioned Throughput: $21-$50/hr per unit.
- Azure PTU break-even: ~40-60% sustained utilization.
- PTU savings vs on-demand at high utilization: up to 70%.

## Use It

`code/main.py` compares the three platforms on a synthetic workload — it models on-demand vs PTU economics, TTFT variance, and cost attribution fidelity. Run it to see where PTUs pay off and where the marketplace's model breadth outweighs a TTFT gap.

## Ship It

This lesson produces `outputs/skill-managed-platform-picker.md`. Given a workload profile (models needed, TTFT SLA, daily volume, compliance requirements), it recommends a primary platform, a fallback, and a FinOps instrumentation plan.

## Exercises

1. Run `code/main.py`. At what sustained utilization does Azure PTU beat on-demand for a 70B class model? Compute the break-even and compare to the advertised 40-60% band.
2. Your product needs Claude 3.7 Sonnet and GPT-4o. Design a two-provider deployment — which goes to which hyperscaler, what gateway sits in front, what is the failover policy?
3. A regulated healthcare customer requires BAAs, US-East data residency, and sub-100ms P99 TTFT. Pick a platform and justify with three specific features.
4. You discover your Bedrock bill is up 4x this month with no traffic change. Without Application Inference Profiles, how would you find the culprit? With profiles, how long does it take?
5. Read the Azure OpenAI and Bedrock pricing pages. For a 100M-token/month Claude workload, which is cheaper — direct Anthropic API, Bedrock on-demand, or Bedrock Provisioned Throughput?

## Key Terms

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Bedrock | "AWS LLM service" | Model marketplace across Claude, Llama, Titan, Mistral, Cohere |
| Azure OpenAI | "Azure's ChatGPT" | Exclusive OpenAI models in Azure datacenters with enterprise controls |
| Vertex AI | "Google's LLM" | Gemini-first platform with Model Garden for third-party models |
| PTU | "dedicated capacity" | Provisioned Throughput Unit — reserved inference GPUs, priced per hour |
| Application Inference Profile | "Bedrock tagging" | Per-product cost/usage profile with tags, CloudWatch-native |
| Model Garden | "Vertex catalog" | Vertex AI's third-party model section, separate from Gemini |
| Two-provider minimum | "LLM redundancy" | Policy of running every critical LLM path across ≥2 hyperscalers |
| BAA | "HIPAA paperwork" | Business Associate Agreement; required for PHI; provided by all three |
| Abuse monitoring | "the log watcher" | Provider-side safety scan on prompts/outputs; opt-out in enterprise |

## Further Reading

- [AWS Bedrock Pricing](https://aws.amazon.com/bedrock/pricing/) — authoritative rate card and Provisioned Throughput pricing.
- [Azure OpenAI Service Pricing](https://azure.microsoft.com/en-us/pricing/details/cognitive-services/openai-service/) — PTU economics and rate cards.
- [Vertex AI Generative AI Pricing](https://cloud.google.com/vertex-ai/generative-ai/pricing) — Gemini tiers and Model Garden surcharges.
- [Artificial Analysis LLM Leaderboard](https://artificialanalysis.ai/) — continuous latency and throughput benchmarks across providers.
- [The AI Journal — AWS Bedrock vs Azure OpenAI CTO Guide 2026](https://theaijournal.co/2026/03/aws-bedrock-vs-azure-openai/) — enterprise decision framework.
- [Finout — Bedrock vs Vertex vs Azure FinOps](https://www.finout.io/blog/bedrock-vs.-vertex-vs.-azure-cognitive-a-finops-comparison-for-ai-spend) — attribution mechanics side-by-side.
