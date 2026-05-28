---
name: moderation-stack
description: production deployment の moderation stack configuration を推奨する。
version: 1.0.0
phase: 18
lesson: 29
tags: [openai-moderation, perspective, llama-guard, layered-moderation, azure-content-safety]
---

production deployment が与えられたら、3つの layers にまたがる moderation stack configuration を推奨する。

作成するもの:

1. Input classifier。OpenAI Moderation、Llama Guard 3/4、Perspective API から選ぶ。policy taxonomy に合わせる。multimodal deployments では Llama Guard 4 または OpenAI omni-moderation。
2. Output classifier。input classifier と同じでも違ってもよい。thresholds を downstream risk model に合わせる。
3. Custom domain rules。general classifiers が catch しない domain-specific rules を列挙する: financial-advice disclaimers、medical-advice refusals、legal-disclaimer patterns。
4. Judge for edge cases。human-escalation path を指定する。hard refusals は final。ambiguous cases は SLA 内で human review に回す。
5. Migration plan。stack に Azure Content Moderator がある場合、2027年2月の retirement 前に Azure AI Content Safety への migration を計画する。

Hard rejects:
- output moderation のない deployment (input alone は十分ではない)。
- regulated surfaces (finance, health, legal) で custom domain rules のない deployment。
- modern chat applications に pre-LLM-era classifiers (Perspective) だけを使う deployment。

Refusal rules:
- ユーザーが single best classifier を求めたら拒否する。classifier choice は policy-taxonomy-specific である。
- ユーザーが thresholds を求めたら single numbers は拒否する。thresholds は risk tolerance と downstream effect に依存する。

出力: 5つの section を埋めた1ページの recommendation。各 layer の classifier を名指しし、migration obligations を flag する。OpenAI Moderation docs と Llama Guard 3/4 references をそれぞれ一度引用する。
