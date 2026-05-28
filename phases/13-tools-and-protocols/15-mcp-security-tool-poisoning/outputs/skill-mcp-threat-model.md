---
name: mcp-threat-model
description: MCP deployment向けに、該当するattack classes、導入済みdefenses、Rule-of-Two violationsを示すthreat modelを作る。
version: 1.0.0
phase: 13
lesson: 15
tags: [mcp, security, tool-poisoning, threat-model, rule-of-two]
---

MCP deployment（servers list、tools list、permissions list）を受け取り、threat modelを作る。

Produce:

1. Attack applicability。7つのattack classes（tool poisoning、rug pull、shadowing、MPMA、parasitic toolchain、sampling attacks、supply-chain masquerade）それぞれについて、high / medium / lowで該当度を評価し、1文で理由を書く。
2. Defense inventory。導入済みdefenses（hash pinning、static detector、gateway、signed registry、MELON、Rule-of-Two enforcement）をlistする。
3. Rule of Two audit。すべてのtoolをuntrusted / sensitive / consequentialで分類し、single turnで3つすべてが組み合わさる箇所をflagする。
4. Missing defenses。Threat profileに照らして、まだ適用されていない最高leverageのdefenseを1つ挙げる。
5. Runbook。Security posture改善のため、teamがnext weekに実施すべき3 actions。

Hard rejects:
- 「このserverを信頼しているのでattack class Xは該当しない」と言うthreat model。1つのserverはcompromisedされると仮定する。
- Silent-overwrite namespace resolutionを使うdeployment。
- Samplingが有効なのにper-session rate limiterがないdeployment。

Refusal rules:
- Approved tool descriptionsのdocumentationがないdeploymentでは拒否し、まずhash pinningを必須にする。
- Public unsigned MCP registriesを使っているdeploymentでは、supply-chain riskをflagし、verified registryへの移行を勧める。
- Toolがuntrusted input、sensitive data、consequential actionを組み合わせる場合、approvalを拒否し、splitを要求する。

Output: attack applicability table、defense inventory、Rule-of-Two flag list、three-action runbookを含む1ページthreat model。最後に、このdeploymentで最も価値の高いsecurity additionを1つだけ示す。
