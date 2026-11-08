# Evidence: cheatsheets/llm-routing-gateways.md

Abbreviations: R = phases/13-tools-and-protocols/21-llm-routing-layer, M = phases/17-infrastructure-and-production/16-model-routing, G = phases/17-infrastructure-and-production/19-ai-gateways, H = projects/hedged-request-lab. d = docs/en.md, py = code/main.py, ts = code/main.ts.

## AI gateways side by side (comparison)
- Code: LiteLLM MIT OSS Python G/d:35, Portkey Apache 2.0 OSS March 2026 G/d:44, Kong built on Kong Gateway G/d:51, Cloudflare/Vercel managed zero-ops G/d:64
- Overhead: 5-15 ms, 20-40 ms, 3-8 ms, 1-3 ms (edge advantage): G/d:74-77
- Scale: LiteLLM breaks ~2000 RPS, 8 GB G/d:38, 91; Portkey control plane G/d:42; Kong 228% faster than Portkey G/d:52; edge advantage G/d:77
- Rate limit: token-bucket, tiered, sliding-window G/d:83; Cloudflare limited on rate limits G/d:66
- Guardrails: LiteLLM optional, Portkey and Kong opinionated guardrails R/d:66; Portkey PII redaction G/d:44; Cloudflare limited G/d:66
- Price: $0 for OSS G/d:40, $49/mo production tier G/d:46, $100/model/month max 5 on Plus G/d:53, managed-only G/outputs/skill-gateway-picker.md:24
- Best fit: Python <500 RPS dev G/d:39, regulated industries G/d:47, already on Kong >1000 RPS G/d:54, edge JavaScript apps G/d:65

## Use X when (concepts)
- LiteLLM: SRE team, data sovereignty R/d:83; <500 RPS G/d:39
- OpenRouter: managed SaaS, 300+ providers, credits R/d:76-79; no infra R/d:83
- Portkey: guardrails and compliance out of the box R/d:83
- Kong: already on Kong, >1000 RPS G/d:54
- Cloudflare/Vercel: edge-serving JavaScript, zero-ops G/d:64-65
- Self-host: data residency, healthcare and finance default self-host G/d:70
- No gateway: single-model prototype, direct API calls simpler R/outputs/skill-routing-config-designer.md:26

## Routing patterns (comparison)
- How: classifier up front, cheap-first escalate, parallel for a sample M/d:37-41
- Latency: ~5-10ms, fastest overall M/d:37; ~1.2x median, ~2x escalated M/d:39; ensemble runs in parallel M/d:41
- Quality: pre-route depends on classifier M/py:107; best quality floor M/d:39; highest quality M/d:41
- Cost: pre-route cheap only for simple M/py:67-73; cascade adds frontier cost on escalation M/py:75-81; highest cost M/d:41
- Use when: accurate classifier M/py:107; quality floor M/py:108; critical A/B only M/d:41

## Gateway request path (architecture)
- Client presents key, AIGateway.handle: G/ts:253-261
- AuthService, 401 invalid api key: G/ts:35, 261
- TokenBucketLimiter, 429 rate limit exceeded: G/ts:73, 262-263
- callWithFallback tries chain in order: G/ts:221-239
- callWithRetry, backoff on retryable: G/ts:188-216
- Providers openai, anthropic, self-hosted: G/ts:390-402

## One request: route() (flow)
1. redact_pii SSN and 16-digit card to [REDACTED]: R/py:54-66, 85-90
2. ROUTES.get(alias, [alias]): R/py:91
3. OUTAGE raises simulated 5xx: R/py:33-34
4. RuntimeError, continue to next model: R/py:92-106
5. cost formula over 1_000_000: R/py:101-103
6. error "all providers failed": R/py:107

## Alias routing gateway in code (annotated-code)
- ROUTES smart and fast: R/py:48-51
- PRICES openai/gpt-4o (5.0, 15.0) per 1M: R/py:20-22
- route("smart", ...): R/py:117
- inv.chosen_model, inv.attempts, input/output tokens: R/py:118-120
- inv.cost_usd: R/py:121; formula R/py:102
- inv.redacted: R/py:89, 135
- inv.error: R/py:107, 142
- OUTAGE.add("openai/gpt-4o"): R/py:125

## Tasks in code (task-table)
- route(alias, messages): R/py:82
- redact_pii(text): R/py:60
- simulate pattern CASCADE: M/py:57, 74, 104-105
- router.pick(c.signals, c.policy): M/ts:407
- simulate_fallback(gateway, n=1000, seed=7): G/py:41
- callWithRetry(provider, prompt, cfg): G/ts:188-192
- callWithFallback(chain, prompt, cfg): G/ts:221-224
- Hedged(ctx, client, endpoints, delay): H/solution/main.go:112

## Run the labs (command-table)
- python code/main.py, four scenarios: R/py:8, 116-142
- --init work folder, starter fails: H/README.md:15, 20
- --stage 1 --path --strict: H/README.md:16
- --all --solution --strict: H/README.md:17
- go run . --samples 3 --delay-ms 10 --out /tmp/hedge-report.json in solution: H/README.md:25-26, 30
- --primary URL --secondary URL: H/README.md:32
- --all --path --strict --report completion evidence: H/README.md:38-41

## Defaults and limits (defaults)
- hardSetThreshold 0.88 pins frontier: M/ts:125, 155-161
- maxAttempts 2: G/ts:405
- free capacity 2, refillPerSec 0.5, third call 429: G/ts:384, 425
- --delay-ms 10, delay 0..1s: H/solution/main.go:243, 114
- --samples 3, 1..100: H/solution/main.go:244, 215
- --out /tmp/aiefs-hedge-report.json: H/solution/main.go:247
- two GET attempts, 64KiB, two-second ceiling, 100ms: H/README.md:34

## Troubleshooting (troubleshooting)
- LiteLLM >2000 RPS cascade failures, migrate first: G/outputs/skill-gateway-picker.md:22; G/d:38
- Portkey at TTFT P99 < 100 ms, Kong or Cloudflare: G/outputs/skill-gateway-picker.md:23; G/d:75, 79
- Escalation rate >30%, cheap model over-routed: M/d:66
- Silent quality drop, drift, online quality metrics: M/d:58-62
- One-provider chain, one failure domain: R/outputs/skill-routing-config-designer.md:22
- Retries count against a budget: R/d:52
- Fast error cannot win: H/project.json:64; HTTP 200 and nonempty value H/solution/main.go:72, 81
- Cancel does not prove saved work, fixtureWork: H/README.md:30; H/solution/main.go:190

## Numbers and questions (qa)
- 97%, 99.94%, 99.997%: G/py:89-91
- 20-60% at iso-quality: M/d:71
- 70/30 split, bill drops ~65%: M/d:19-21
- semantic caching 30 to 60 percent: R/d:56
- online gates: thumbs, LLM-judge 5%, escalation, refusal rate: M/d:64-67
- first alert fallback-use rate R/outputs/skill-routing-config-designer.md:30; gateway latency P99 G/outputs/skill-gateway-picker.md:31
