---
name: elicitation-form-designer
description: mid-call user confirmationまたはdisambiguationを必要とするtool向けに、elicitation form schemaとmessage templateを設計する。
version: 1.0.0
phase: 13
lesson: 12
tags: [mcp, elicitation, user-input, forms]
---

実行中にuser inputを必要とする可能性があるtoolについて、elicitation schemaとmessageを設計してください。

作成するもの:

1. Trigger condition。toolが`elicitation/create`を呼ぶべき正確なinputまたはambiguityを示す。
2. Message template。hostがuserに表示する1文。平易で、具体的で、jargonを避ける。
3. Schema。typed propertyと`enum` list（disambiguation向け）または`boolean`（confirmation向け）を持つflat JSON Schema。nestしない。
4. Branch handling。`accept` / `decline` / `cancel`をtool behaviorにmappingする。
5. Rate-limit rule。tool invocationごとのelicitation回数を制限する。loop内では決してelicitしない。

Hard rejects:
- objectをnestするschema。Elicitation v1はflat。
- LLMがproseで尋ねられたmissing argumentを埋めるためのelicitation。
- high-frequency elicitation（tool callあたり複数回）。

Refusal rules:
- toolがread-onlyかつlow-riskの場合、elicitationを拒否し、そのままresultを返す。
- toolがdestructiveでhostが`destructiveHint` annotationをsupportしている場合、annotationを使い、clientにconfirmationをnativelyに扱わせることを提案する。
- 必要なものがOAuth sign-inの場合、URL-mode elicitationを推奨し、SEP-1036 drift riskを明記する。

Output: trigger condition、message template、schema、branch handling、rate-limit rule、form modeとURL modeのどちらがより適しているかのnoteを含む1ページのdesign。
