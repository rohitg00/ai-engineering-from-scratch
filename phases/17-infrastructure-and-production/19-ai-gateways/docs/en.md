# AI Gateways — LiteLLM, Portkey, Kong AI Gateway, Bifrost

> gateway は app と model providers の間に置かれる。中核機能は provider routing、fallback、retries、rate limiting、secret references、observability、guardrails である。2026年の市場分布: **LiteLLM** は MIT OSS で100+ providers、OpenAI-compatible。ただし published benchmark では約2000 RPS（8 GB memory、cascading failures）付近で崩れる。Python、<500 RPS、dev/prototyping に最適。**Portkey** は control-plane 位置付け（guardrails、PII redaction、jailbreak detection、audit trails）で、2026年3月に Apache 2.0 open-source 化された。latency overhead は20-40 ms、production tier は $49/mo。**Kong AI Gateway** は Kong Gateway 上に構築されている。Kong 自身の同一12 CPUs benchmark では Portkey より228%速く、LiteLLM より859%速い。pricing は $100/model/month（Plus tier では max 5）。既に Kong を使っている enterprise に合う。**Bifrost**（Maxim AI）は configurable backoff 付き automatic retries、OpenAI 429 時の Anthropic fallback を提供する。**Cloudflare / Vercel AI Gateways** は managed、zero-ops、basic retry。data residency が self-host decision を決める。Portkey と Kong は OSS + optional managed の中間に位置する。

**種別:** 学習
**言語:** Python (stdlib, toy gateway-routing simulator)
**前提条件:** Phase 17 · 01 (Managed LLM Platforms), Phase 17 · 16 (Model Routing)
**所要時間:** 約60分

## 学習目標

- 6つの gateway core features（routing、fallback、retries、rate limits、secrets、observability、guardrails）を列挙する。
- 2026年の4つの gateway（LiteLLM、Portkey、Kong AI、Bifrost）を scale ceiling と use case に対応づける。
- Kong benchmark（Portkey 比228%、LiteLLM 比859%）を引用し、>500 RPS でなぜ重要か説明する。
- data residency と ops budget に基づいて self-hosted vs managed を選ぶ。

## 課題

あなたの product は OpenAI、Anthropic、self-hosted Llama を呼び出している。provider ごとに SDK、error model、rate limit、auth scheme が違う。failover（OpenAI が 429 を返したら Anthropic を試す）、単一 credential store、unified observability、tenant ごとの rate limits が欲しい。

これを app layer で再発明すると、すべての service がすべての provider に結合する。gateway layer はそれを1つの process と1つの API（通常 OpenAI-compatible）に集約し、providers へ fan out する。

## コンセプト

### 6つの core features

1. **Provider routing** — OpenAI、Anthropic、Gemini、self-hosted などを1つの API の背後に置く。
2. **Fallback** — 429、5xx、quality failure 時に別 provider で retry する。
3. **Retries** — exponential backoff、bounded attempts。
4. **Rate limits** — per-tenant、per-key、per-model。
5. **Secret references** — runtime に vault から credentials を pull する（app に置かない）。
6. **Observability** — OTel + GenAI attributes（Phase 17 · 13）+ cost attribution。
7. **Guardrails** — PII redaction、jailbreak detection、allowed-topics filters。

### LiteLLM — MIT OSS, Python

- 100+ providers、OpenAI-compatible、router config、fallback、basic observability。
- Kong benchmark では約2000 RPS で崩れる。8 GB memory footprint、sustained load 下で cascading failures。
- best fit: Python app、<500 RPS、dev/staging gateways、experimental routing。
- cost: OSS は $0。cloud free tier あり。

### Portkey — control plane としての位置づけ

- 2026年3月時点で Apache 2.0 OSS。Guardrails、PII redaction、jailbreak detection、audit trails。
- per-request latency overhead は20-40 ms。
- retention + SLA 付き production tier は $49/mo。
- best fit: guardrails + observability を bundled で必要とする regulated industries。

### Kong AI Gateway — scale 重視の選択肢

- Kong Gateway（成熟した API gateway product、lua+OpenResty）上に構築。
- Kong 自身の 12-CPU equivalent benchmark: Portkey より228%速く、LiteLLM より859%速い。
- Pricing: $100/model/month、Plus tier は max 5。
- best fit: 既に Kong を使っている、>1000 RPS、license できる。

### Bifrost (Maxim AI)

- configurable backoff 付き automatic retries。
- OpenAI 429 で Anthropic に fallback するのが canonical recipe。
- 新しい entrant。commercial。

### Cloudflare AI Gateway / Vercel AI Gateway

- Managed、zero-ops。basic retry と observability。
- best fit: Cloudflare/Vercel 上の Edge-serving JavaScript apps。
- guardrails と rate limits は Kong/Portkey より限定的。

### self-hosted vs managed

data residency が forcing function になる。healthcare と finance は self-host（LiteLLM、Portkey OSS、Kong）を default にする。consumer products は managed（Cloudflare AI Gateway）または middle-tier（Portkey managed）を default にする。hybrid: regulated tenant は self-hosted、その他は managed。

### latency budget

- LiteLLM: typical overhead 5-15 ms。
- Portkey: overhead 20-40 ms。
- Kong: overhead 3-8 ms。
- Cloudflare/Vercel: overhead 1-3 ms（edge advantage）。

Gateway latency は TTFT に直接加算される。TTFT P99 < 100 ms SLA なら Kong または Cloudflare。P99 < 500 ms ならどれでもよい。

### rate-limit semantics は重要

simple token-bucket は moderate scale まで機能する。multi-tenant には sliding-window + burst allowance + per-tenant tiering が必要。LiteLLM は token-bucket、Kong は sliding-window、Portkey は tiered を提供する。

### Gateway + observability + routing の組み合わせ

Phase 17 · 13（observability）+ 16（model routing）+ 19（gateways）は本番では同じ layer である。3つすべてを覆う tool を選ぶか、慎重に接続する。2026年の deployment の多くは split roles として Helicone（observability）または Portkey（guardrails）と Kong（scale）を組み合わせる。

### 覚えておくべき数字

- LiteLLM: 約2000 RPS、8 GB memory で破綻。
- Portkey: overhead 20-40 ms。2026年3月から Apache 2.0。
- Kong: Portkey より228%速く、LiteLLM より859%速い。
- Kong pricing: $100/model/month、Plus tier は max 5。
- Cloudflare/Vercel: edge で overhead 1-3 ms。

## 使ってみる

`code/main.py` は3 providers をまたぐ gateway routing with fallback を、429/5xx injection 下で simulate する。latency、retry rate、fallback hit rate を report する。

## 成果物

この lesson は `outputs/skill-gateway-picker.md` を生成する。scale、ops posture、compliance、latency budget を受け取り gateway を選ぶ。

## 演習

1. `code/main.py` を実行する。OpenAI→Anthropic→self-hosted の fallback を構成する。provider error rate 5% で expected hit rate はいくつか。
2. SLA が 300 ms baseline 上の TTFT P99 < 200 ms である。どの gateway が budget 内に残るか。
3. healthcare customer が self-hosted + PII redaction + audit を要求する。Portkey OSS か Kong を選ぶ。
4. LiteLLM vs Kong を比較する。どの RPS ceiling で team は migrate すべきか。
5. multi-tenant SaaS の rate-limit policy を設計する。free tier、trial tier、paid tier。token-bucket か sliding-window か。

## 重要用語

| 用語 | よく言われること | 実際の意味 |
|------|----------------|------------------------|
| Gateway | "API broker" | apps と providers の間にある process |
| LiteLLM | "the MIT one" | Python OSS、100+ providers、2K RPS で破綻 |
| Portkey | "guardrails gateway" | control plane + observability、Apache 2.0 |
| Kong AI Gateway | "the scale one" | Kong Gateway 上に構築された benchmark leader |
| Bifrost | "Maxim's gateway" | retries + Anthropic fallback recipe |
| Cloudflare AI Gateway | "edge managed" | edge-deployed managed gateway、zero-ops |
| PII redaction | "data scrub" | model 送信前に regex + NER で mask |
| Jailbreak detection | "prompt injection guard" | user input 上の classifier |
| Audit trail | "regulated log" | すべての LLM call の immutable record |
| Token-bucket | "simple rate limit" | refill-based rate limiter |
| Sliding-window | "precise rate limit" | time-windowed rate limiter。fairness が高い |

## 参考資料

- [Kong AI Gateway Benchmark](https://konghq.com/blog/engineering/ai-gateway-benchmark-kong-ai-gateway-portkey-litellm)
- [TrueFoundry — AI Gateways 2026 Comparison](https://www.truefoundry.com/blog/a-definitive-guide-to-ai-gateways-in-2026-competitive-landscape-comparison)
- [Techsy — Top LLM Gateway Tools 2026](https://techsy.io/en/blog/best-llm-gateway-tools)
- [LiteLLM GitHub](https://github.com/BerriAI/litellm)
- [Portkey GitHub](https://github.com/Portkey-AI/gateway)
- [Kong AI Gateway docs](https://docs.konghq.com/gateway/latest/ai-gateway/)
