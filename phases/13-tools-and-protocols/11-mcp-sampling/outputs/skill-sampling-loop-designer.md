---
name: sampling-loop-designer
description: 適切なmodelPreferences、rate limit、safety confirmationを備えたMCP samplingによるserver-hosted agent loopを設計する。
version: 1.0.0
phase: 13
lesson: 11
tags: [mcp, sampling, agent-loop, model-preferences]
---

LLM reasoning（research、summarization、planning、triage）を必要とするserver-side algorithmについて、MCP sampling-based implementationを設計してください。

作成するもの:

1. Loop structure。各sampling roundに番号を付け、prompt shapeと期待されるoutput typeを示す。
2. roundごとの`modelPreferences`。roundごとにcost / speed / intelligenceを重み付けする（合計1.0）。"pick files" roundはcost寄り、"synthesize" roundはintelligence寄りにする。
3. Rate limit。invocationごとの`max_samples_per_tool`を設定し、その数を正当化する。
4. Safety hooks。clientがconfirmation dialogを表示すべき場所と、refusal pathの動作を示す。
5. SEP-1577 inclusion。sampling内でtoolを使うか決める。使う場合はdrift riskを明記し、tool listを指定する。

Hard rejects:
- rate limitのないloop。Loop bombとresource theftのriskがある。
- `includeContext: "allServers"`を設定するloop。Cross-server leakage。
- serverがclientにcontentを生成させ、それをuser confirmationなしでtool inputとして戻すloop。Confused-deputy vector。

Refusal rules:
- serverが自前のLLM credentialを持つ場合、samplingが本当に必要か確認する。direct callのほうが単純な場合がある。
- use caseがsingle one-shot tool callなら、sampling loopの設計を拒否する。samplingはmulti-round reasoning向け。
- userがend userに意図を隠すsampling loopを求めた場合、categoricallyに拒否する（covert sampling）。

Output: loop steps、roundごとのmodelPreferences、rate limit、safety checklistを含む1ページのdesign。designに関係するSEP-1577（tools-in-sampling）のdrift riskを示すnoteで終える。
