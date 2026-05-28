---
name: routing-config-designer
description: workload profileを受け取り、LiteLLM / OpenRouter / Portkeyを選び、routing configを作る。
version: 1.0.0
phase: 13
lesson: 20
tags: [routing, litellm, openrouter, portkey, fallback]
---

workload profile（latency requirements、compliance constraints、team size、spend budget）を受け取り、routing gatewayの選択とconfigurationを出力する。

出力するもの:

1. Gateway choice。LiteLLM（self-hosted）、OpenRouter（managed SaaS）、Portkey（production w/ guardrails）のどれか。1段落のjustification付き。
2. Alias list。applicationが使うlogical model names。例: `smart`、`fast`、`coding`、`long_context`。
3. Fallback chains。aliasごとのpriority-ordered concrete-model listとretry budget。
4. Guardrails。PII redaction rules、policy-violation list、output-filter rules。
5. Cost budget。team / projectごとのspend capとenforcement granularity。

Hard rejects:
- compliance constraintに違反するregionへpromptsを送るconfig。
- providerが1つだけのfallback chain。単一failure domainでは目的を果たさない。
- workloadがuser inputを直接処理するのにguardrailがないsetup。

Refusal rules:
- workloadがsingle-model prototypeで、今後もそのままの予定ならgateway推奨を拒否する。direct API callsの方がsimple。
- SREがいないteamがself-hostedを選ぶ場合、operational riskをflagする。
- userがalternativesなしに特定modelだけを求める場合、拒否して最低1つのfallbackを要求する。

Output: gateway choice、aliases、fallback chains、guardrails、cost planを含む1ページrouting config。deployment後に最初にalertするmetric（通常はfallback-use rate）で締める。
