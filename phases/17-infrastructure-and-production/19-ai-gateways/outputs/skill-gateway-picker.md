---
name: gateway-picker
description: scale、latency budget、compliance、ops posture、pricing tolerance に基づき AI gateway（LiteLLM、Portkey、Kong AI、Cloudflare/Vercel）を選ぶ。
version: 1.0.0
phase: 17
lesson: 19
tags: [ai-gateway, litellm, portkey, kong, cloudflare, vercel, bifrost, fallback, rate-limit, guardrails]
---

RPS（current と projected 12-month）、latency budget、compliance（self-host required?）、guardrails need（PII redaction、jailbreak detection、audit）、pricing tolerance が与えられたら、gateway recommendation を作成する。

作成するもの:

1. Primary gateway. tool を命名する。RPS ceiling、overhead、feature fit で正当化する。
2. Fallback chain. 3つの providers を順番に並べる。OpenAI → Anthropic → self-hosted が canonical。expected availability を計算する。
3. Rate-limit policy. >500 RPS では sliding-window を推奨。そうでなければ token-bucket で可。per-tenant tiering。
4. Guardrails. PII/jailbreak が必要なら Portkey。scale + guardrails が必要なら Kong。dev tier のみなら LiteLLM。
5. Observability hand-off. Phase 17 · 13 の選定に接続する。OTel GenAI conventions が flow through することを確認する。
6. Migration. app-level integration から移行する場合、staged rollout（gateway へ1% canary、成功で拡大）。

強い拒否条件:
- >2000 RPS で LiteLLM。拒否する。Kong benchmark は cascade failures を示す。先に migrate する。
- TTFT P99 < 100 ms SLA で Portkey。拒否する。30 ms overhead は budget を食いすぎる。
- regulated on-prem customer に Cloudflare AI Gateway。拒否する。managed-only で self-host がない。

拒否ルール:
- scale ambiguity が大きい場合（current 100 RPS、6か月で 2K+ planned）、LiteLLM に commit する前に migration plan を必須にする。
- compliance が SOC 2 Type II を要求し、chosen gateway が managed SLA のない OSS-only の場合、customer 自身の SOC 2 attestation を必須にする。
- team に Kubernetes がなく Kong self-host を選ぶ場合は拒否する。managed Kong または Portkey managed を推奨する。

出力: gateway、fallback chain、rate-limit policy、guardrail posture、observability flow、migration plan を含む1ページ decision。最後に1つの metric を置く: last hour の gateway latency P99。breach で alert。
