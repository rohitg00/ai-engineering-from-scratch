# LLM Routing Layer — LiteLLM, OpenRouter, Portkey

> Provider lock-in is expensive. Different tool-calling workloads suit different models. Routing gateways give one API surface, retries, failover, cost tracking, and guardrails. Three archetypes dominate 2026: LiteLLM (open-source self-hosted), OpenRouter (managed SaaS), Portkey (production-grade, open-sourced in March 2026). This lesson names the decision criteria and walks a stdlib routing gateway.

**Type:** Learn
**Languages:** Python (stdlib, routing + failover + cost tracker)
**Prerequisites:** Phase 13 · 02 (function calling), Phase 13 · 17 (gateways)
**Time:** ~45 minutes

## Learning Objectives

- Distinguish self-hosted, managed, and production-grade routing options.
- Implement a fallback chain that retries on provider failures in a defined priority order.
- Track per-request cost and token usage across providers.
- Decide between LiteLLM, OpenRouter, and Portkey for a given production constraint.

## The Problem

Scenarios where provider routing matters:

1. **Cost.** Claude Sonnet costs 3x what Haiku costs. For a triage task, Haiku is enough; for a synthesis task, Sonnet is worth it. Route per-request.

2. **Failover.** OpenAI has a bad hour. Every request fails. You want automatic fallback to Anthropic without redeploying.

3. **Latency.** A live chat UI needs fast time-to-first-token. A batch summarizer does not. Route by latency SLA.

4. **Compliance.** EU users must stay in EU regions. Route by region.

5. **Experimentation.** A/B two models on the same workload. Route by test bucket.

Hand-coding all of this per integration is repetitive. A routing gateway gives one OpenAI-compatible API and handles the rest.

## The Concept

### OpenAI-compatible proxy shape

Everyone speaks OpenAI-shape. The routing gateway exposes `/v1/chat/completions`, accepts the OpenAI schema, and internally proxies to Anthropic / Gemini / Cohere / Ollama / anything. The client does not care.

### Model aliases

Instead of `claude-3-5-sonnet-20251022`, your code says `our_smart_model`. The gateway maps aliases to real models. When Anthropic ships Claude 4, you change the alias server-side; your code does not touch a thing.

### Fallback chains

```
primary: openai/gpt-4o
on 5xx: anthropic/claude-3-5-sonnet
on 5xx: google/gemini-1.5-pro
on 5xx: refuse
```

Gateways define this in a config. Retries count against a budget so fallback cascades do not explode cost.

### Semantic caching

Identical-or-near-identical prompts hit a cache instead of the provider. Savings on repeated agent loops can be 30 to 60 percent. Keys are embedding-based; near-identical prompts share a cache slot.

### Guardrails

Gateway-level:

- **PII redaction.** Regex or ML-based pass before sending prompts.
- **Policy violations.** Reject prompts with prohibited content.
- **Output filters.** Scrub completions for leaks.

Portkey and Kong both ship opinionated guardrails. LiteLLM leaves them optional.

### Per-key rate limits

One API key = one team. Per-key budgets prevent one team from consuming the shared quota. Most gateways support this.

### Self-hosted vs managed trade-offs

| Factor | LiteLLM (self-hosted) | OpenRouter (managed) | Portkey (production) |
|--------|----------------------|----------------------|----------------------|
| Code | Open source, Python | Managed SaaS | Open source (Mar 2026) + managed |
| Setup | Deploy a proxy | Sign up | Either |
| Providers | 100+ | 300+ | 100+ |
| Billing | Your own keys | OpenRouter credits | Your own keys |
| Observability | OpenTelemetry | Dashboard | Full OTel + PII redaction |
| Best for | Teams that want full control | Rapid prototyping | Production with compliance |

LiteLLM wins when you have an SRE team and want data sovereignty. OpenRouter wins when you want a single subscription and no infra. Portkey wins when you need guardrails and compliance out of the box.

### Cost tracking

Every request carries `provider`, `model`, `input_tokens`, `output_tokens`. Multiply by per-model per-token prices (pulled from a pricing sheet the gateway maintains). Per-user / per-team / per-project aggregation.

### MCP plus routing

A gateway can route both LLM calls AND MCP sampling requests. When a sampling request's modelPreferences prefer a specific model, the gateway translates to the right backend. This is where Phase 13 · 17 (MCP gateway) and this lesson's routing gateway sometimes merge into one service.

### Routing strategies

- **Static priority.** First in list; fall back on error.
- **Load balancing.** Round-robin or weighted.
- **Cost-aware.** Pick the cheapest model meeting latency / quality.
- **Latency-aware.** Pick the fastest model in the last N minutes.
- **Task-aware.** Prompt classifier routes coding to one model, summarization to another.

## Use It

`code/main.py` implements a routing gateway in ~150 lines: accepts OpenAI-shaped requests, translates to per-provider stubs, runs a priority fallback chain, tracks per-request cost, and applies a PII redaction pass on inputs. Run it with three scenarios: normal request, primary-provider outage triggering fallback, PII leakage caught by redaction.

What to look at:

- `ROUTES` dict: alias -> priority-ordered list of concrete providers.
- Fallback loop retries on 5xx.
- Cost tracker multiplies token usage by per-model rates.
- PII redactor scrubs SSN-shaped patterns before forwarding.

## Ship It

This lesson produces `outputs/skill-routing-config-designer.md`. Given a workload profile (latency, cost, compliance), the skill picks LiteLLM / OpenRouter / Portkey and produces a routing config.

## Exercises

1. Run `code/main.py`. Trigger the outage scenario; confirm fallback lands on the second provider and cost is attributed correctly.

2. Add semantic caching: SHA256 of the prompt is a lookup key; cache hits return instantly. Measure cost savings on a repeated call.

3. Add a prompt classifier that routes "code ..." prompts to an alias favoring intelligence and "summarize ..." prompts to an alias favoring speed.

4. Design per-team budgets: each team has a monthly spend cap; gateway refuses requests once cap is hit. Pick an enforcement granularity (per-request or windowed).

5. Read LiteLLM, OpenRouter, and Portkey docs side by side. Name the one feature each ships that the other two do not.

## Key Terms

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Routing gateway | "LLM proxy" | One-API-surface layer in front of many providers |
| OpenAI-compatible | "Speaks the OpenAI schema" | Accepts `/v1/chat/completions` shape, translates to any backend |
| Model alias | "our_smart_model" | Name in your code that the gateway maps to a concrete model |
| Fallback chain | "Retry list" | Ordered list of providers attempted on failure |
| Semantic caching | "Prompt-embedding cache" | Key is embedding of the prompt; near-duplicates share a cache hit |
| Guardrails | "Input/output filters" | Redact PII, reject policy violations |
| Per-key rate limit | "Team budget" | Quota scoped to an API key |
| Cost tracking | "Per-request spend" | Aggregate token usage x price per model |
| LiteLLM | "The open proxy" | Self-hostable OSS routing gateway |
| OpenRouter | "The managed SaaS" | Hosted gateway with credit-based billing |
| Portkey | "The production option" | Open-source + managed with guardrails built in |

## Further Reading

- [LiteLLM — docs](https://docs.litellm.ai/) — self-hosted routing gateway
- [OpenRouter — quickstart](https://openrouter.ai/docs/quickstart) — managed routing SaaS
- [Portkey — docs](https://portkey.ai/docs) — production routing with guardrails
- [TrueFoundry — LiteLLM vs OpenRouter](https://www.truefoundry.com/blog/litellm-vs-openrouter) — decision guide
- [Relayplane — LLM gateway comparison 2026](https://relayplane.com/blog/llm-gateway-comparison-2026) — vendor survey
