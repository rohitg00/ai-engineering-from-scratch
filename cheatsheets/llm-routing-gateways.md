---
id: llm-routing-gateways
title: LLM Routing and AI Gateways Compared
code: LR
subtitle: Pick a gateway, set aliases and fallback chains, route cheap or frontier, and hedge slow safe reads.
hue: 28
sources: phases/13-tools-and-protocols/21-llm-routing-layer, phases/17-infrastructure-and-production/16-model-routing, phases/17-infrastructure-and-production/19-ai-gateways, projects/hedged-request-lab
source_hash: a1945e8a5b44ac60
---

## AI gateways side by side
type: comparison
span: 2
from: phases/17-infrastructure-and-production/19-ai-gateways/docs/en.md, phases/13-tools-and-protocols/21-llm-routing-layer/docs/en.md, phases/17-infrastructure-and-production/19-ai-gateways/outputs/skill-gateway-picker.md

| Factor | LiteLLM | Portkey | Kong AI Gateway | Cloudflare / Vercel |
|---|---|---|---|---|
| Code | MIT OSS, Python | Apache 2.0 OSS since March 2026 | Built on Kong Gateway | Managed, zero-ops |
| Overhead | 5-15 ms | 20-40 ms | 3-8 ms | 1-3 ms at the edge |
| Scale | Breaks at ~2000 RPS, 8 GB | Control plane | 228% faster than Portkey | Edge advantage |
| Rate limit | Token-bucket | Tiered | Sliding-window | Limited |
| Guardrails | Optional | Opinionated guardrails, PII redaction | Opinionated guardrails | Limited |
| Price | $0 for OSS | $49/mo production tier | $100/model/month, max 5 on Plus | Managed only |
| Best fit | Python, <500 RPS, dev | Regulated industries | Already on Kong, >1000 RPS | Edge JavaScript apps |

## Use X when
type: concepts
from: phases/13-tools-and-protocols/21-llm-routing-layer/docs/en.md, phases/17-infrastructure-and-production/19-ai-gateways/docs/en.md, phases/17-infrastructure-and-production/19-ai-gateways/outputs/skill-gateway-picker.md, phases/13-tools-and-protocols/21-llm-routing-layer/outputs/skill-routing-config-designer.md

- **LiteLLM**: you have an SRE team, want data sovereignty and stay below 500 RPS.
- **OpenRouter**: managed SaaS, 300+ providers, credits. You want no infra.
- **Portkey**: you need guardrails and compliance out of the box.
- **Kong AI Gateway**: you already run Kong and need more than 1000 RPS.
- **Cloudflare / Vercel**: you serve JavaScript at the edge and need zero ops.
- **Self-host**: data residency forces it. Healthcare and finance default to self-host.
- **No gateway**: a single-model prototype. Direct API calls are simpler.

## Routing patterns
type: comparison
from: phases/17-infrastructure-and-production/16-model-routing/docs/en.md, phases/17-infrastructure-and-production/16-model-routing/code/main.py

| Factor | Pre-route | Cascade | Ensemble |
|---|---|---|---|
| How | Classifier up front | Cheap first, escalate | Cheap and frontier in parallel |
| Latency | ~5-10ms added, fastest | ~1.2x median, ~2x escalated | Parallel runs |
| Quality | Depends on classifier | Best quality floor | Highest |
| Cost | Cheap for simple only | Cheap plus frontier on escalation | Highest cost |
| Use when | Classifier is accurate | Quality floor matters | Critical A/B only |

## Gateway request path
type: architecture
from: phases/17-infrastructure-and-production/19-ai-gateways/code/main.ts

```arch
node | client | 1,1 | Client | presented API key | client
node | auth | 2,1 | AuthService | 401 invalid api key | process
node | limit | 3,1 | TokenBucketLimiter | 429 rate limit exceeded | process
node | fb | 3,2 | callWithFallback | chain in order | process
node | retry | 2,2 | callWithRetry | backoff on retryable | process
node | prov | 1,2 | Providers | openai, anthropic, self-hosted | model
edge | client | auth | handle
edge | auth | limit | tenant
edge | limit | fb | allowed
edge | fb | retry | each provider
edge | retry | prov | call
```

## One request: route()
type: flow
from: phases/13-tools-and-protocols/21-llm-routing-layer/code/main.py

1. **redact_pii**: SSN and 16-digit card patterns become `[REDACTED]`.
2. **route**: `ROUTES.get(alias, [alias])` gives the fallback chain.
3. **provider_call**: a model in `OUTAGE` raises a simulated 5xx.
4. **route**: on `RuntimeError` it tries the next model in the chain.
5. **Cost**: `prompt_tokens` times `in_rate` plus `completion_tokens` times `out_rate`, over `1_000_000`.
6. **route**: when every model fails, `error` is "all providers failed".

## Alias routing gateway in code
type: annotated-code
lang: python
from: phases/13-tools-and-protocols/21-llm-routing-layer/code/main.py

```python
ROUTES = {"smart": [...], "fast": [...]}  # alias to fallback chain
PRICES = {"openai/gpt-4o": (5.0, 15.0)}   # per 1M tokens, in and out
inv = route("smart", [{"role": "user", "content": "<prompt>"}])
inv.chosen_model                          # first model that answered
inv.attempts                              # every model tried, in order
inv.input_tokens, inv.output_tokens       # from usage
inv.cost_usd                              # tokens times PRICES
inv.redacted                              # True when PII matched
inv.error                                 # "all providers failed"
OUTAGE.add("openai/gpt-4o")               # simulate a primary outage
```

## Tasks in code
type: task-table
from: phases/13-tools-and-protocols/21-llm-routing-layer/code/main.py, phases/17-infrastructure-and-production/16-model-routing/code/main.py, phases/17-infrastructure-and-production/16-model-routing/code/main.ts, phases/17-infrastructure-and-production/19-ai-gateways/code/main.py, phases/17-infrastructure-and-production/19-ai-gateways/code/main.ts, projects/hedged-request-lab/solution/main.go

| Task | Code |
|---|---|
| Route an alias | `route(alias, messages)` |
| Scrub PII before dispatch | `redact_pii(text)` |
| Compare routing patterns | `simulate("CASCADE", reqs)` |
| Pick a model by policy | `router.pick(c.signals, c.policy)` |
| Gateway fallback simulator | `simulate_fallback(gateway, n=1000, seed=7)` |
| Retry one provider | `callWithRetry(provider, prompt, cfg)` |
| Try providers in order | `callWithFallback(chain, prompt, cfg)` |
| Hedge a safe read | `Hedged(ctx, client, endpoints, delay)` |

## Run the labs
type: command-table
span: 2
from: phases/13-tools-and-protocols/21-llm-routing-layer/code/main.py, projects/hedged-request-lab/README.md, projects/hedged-request-lab/solution/main.go

| Command | What it does |
|---|---|
| `python code/main.py` | Routing gateway: normal, outage, PII and all-down scenarios |
| `python3 scripts/project_test.py hedged-request-lab --init <dir>` | Creates a work folder. The starter fails until you implement it |
| `python3 scripts/project_test.py hedged-request-lab --stage 1 --path <dir> --strict` | Grades one stage |
| `python3 scripts/project_test.py hedged-request-lab --all --solution --strict` | Grades the reference solution |
| `go run . --samples 3 --delay-ms 10 --out /tmp/hedge-report.json` | In `solution`: baseline against hedged on loopback |
| `go run . --primary <url> --secondary <url>` | Hedges your own two safe read endpoints |
| `python3 scripts/project_test.py hedged-request-lab --all --path <dir> --strict --report <file>` | Writes the completion evidence |

## Defaults and limits
type: defaults
from: phases/17-infrastructure-and-production/16-model-routing/code/main.ts, phases/17-infrastructure-and-production/19-ai-gateways/code/main.ts, projects/hedged-request-lab/README.md, projects/hedged-request-lab/solution/main.go

| Setting | Default | Note |
|---|---|---|
| `hardSetThreshold` | 0.88 | At or above it, the router pins frontier |
| `maxAttempts` | 2 | Demo retry budget per provider |
| Free tier bucket | `capacity: 2` | `refillPerSec: 0.5`, third call gets 429 |
| `--delay-ms` | 10 | Hedge delay, allowed 0 to 1s |
| `--samples` | 3 | Samples per policy, 1 to 100 |
| `--out` | `/tmp/aiefs-hedge-report.json` | Receipt file |
| GET attempts | 2 | Body 64KiB, two-second ceiling, 100ms grace |

## Troubleshooting
type: troubleshooting
from: phases/17-infrastructure-and-production/19-ai-gateways/docs/en.md, phases/17-infrastructure-and-production/19-ai-gateways/outputs/skill-gateway-picker.md, phases/17-infrastructure-and-production/16-model-routing/docs/en.md, phases/13-tools-and-protocols/21-llm-routing-layer/outputs/skill-routing-config-designer.md, projects/hedged-request-lab/README.md, projects/hedged-request-lab/project.json, projects/hedged-request-lab/solution/main.go

| Symptom | Cause | Fix |
|---|---|---|
| Cascading failures near 2000 RPS | LiteLLM at its ceiling | Migrate to Kong first |
| TTFT P99 over a 100 ms SLA | Portkey adds 20-40 ms | Use Kong or Cloudflare |
| Escalation rate over 30% | Cheap model is over-routed | Route less traffic to the cheap model |
| Quality drops with no alarm | Cheap-model drift | Gate routes by online quality metrics |
| Outage takes the alias down | Chain has one provider | Add a second failure domain |
| Fallback cascades raise cost | Retries without a budget | Count retries against a budget |
| A fast error wins the hedge | Winner not validated | Require HTTP 200 and nonempty `value` |
| Cancel shows no saved work | Server keeps working | Read `fixtureWork` counts |

## Numbers and questions
type: qa
from: phases/17-infrastructure-and-production/19-ai-gateways/code/main.py, phases/17-infrastructure-and-production/16-model-routing/docs/en.md, phases/13-tools-and-protocols/21-llm-routing-layer/docs/en.md, phases/17-infrastructure-and-production/19-ai-gateways/outputs/skill-gateway-picker.md, phases/13-tools-and-protocols/21-llm-routing-layer/outputs/skill-routing-config-designer.md

- **What does fallback buy?** One provider at 3% error gives 97%. Two give 99.94%. Three give 99.997%.
- **What does routing save?** 20-60% at iso-quality in case studies.
- **What does a 70/30 split do?** The bill drops ~65% at the same product quality.
- **What does semantic caching save?** 30 to 60 percent on repeated agent loops.
- **Which online gates catch drift?** Thumbs per route, LLM-judge on a 5% sample, escalation and refusal rate.
- **Which metric to alert on first?** Fallback-use rate, then gateway latency P99.
