---
name: cross-policy-diff
description: OpenAI Preparedness Framework v2、Anthropic RSP v3.0、DeepMind FSF v3 を参照として使い、特定 capability の cross-policy comparison を作成する。
version: 1.0.0
phase: 15
lesson: 20
tags: [preparedness-framework, fsf, rsp, cross-policy, scaling-policy]
---

特定の frontier capability（例: "long-range autonomy"、"autonomous replication and adaptation"、"R&D automation"）が与えられたら、3つの framework がその capability をどう分類し、どの mitigations を発火させるかを示す cross-policy diff を作成してください。

作成する内容:

1. **OpenAI PF v2 classification.** Tracked か Research か。Tracked なら Capabilities + Safeguards Report の triggers を名指しします。Research なら policy language が "potential" mitigations であることを記します。
2. **Anthropic RSP v3.0 classification.** どの threshold か（ASL-3、AI R&D-4、hardcoded prohibition）。どの mitigation か（affirmative case、security + deployment）。commitment が Anthropic-unilateral tier と industry-recommendation tier のどちらにあるか確認します。
3. **DeepMind FSF v3 classification.** どの domain か（Cyber、Bio、ML R&D、CBRN）。どの CCL または Tracked Capability Level か。deceptive alignment monitoring が呼び出されるか。
4. **Convergence summary.** 3つの policy は capability の severity について一致しているか、それとも意味のある不一致があるか。どの classification が最も厳密で、どれが最も弱いか。
5. **Measurement dependency.** すべての classification は capability measurement に依存します。その capability がどう測定され、どの eval provider（METR、Apollo、internal、third-party）がその measurement を担うかを名指しします。

即時不合格:
- announcement language の類似だけに基づく cross-policy alignment の主張で、document-level evidence がないもの。
- source document の specific clause を指せない classification。
- "Research Category"（OpenAI）を "Tracked Category" と同等に扱うこと。両者は operational consequence が異なります。

拒否ルール:
- ユーザーが各 classification について source document passages を提示できない場合、拒否して先に citations を要求します。
- ユーザーが policy-existence を mitigation-in-practice の証拠として扱う場合、拒否して specific mitigations が発火した証拠を要求します。
- capability が framework に「covered」されていると主張しているが、その単語が文書に現れない場合、拒否して concrete clause reference を要求します。

出力形式:

次を含む diff document を返してください。
- **Capability definition**（1文）
- **OpenAI PF v2 row**（classification、trigger、source clause）
- **Anthropic RSP v3.0 row**（classification、trigger、unilateral-vs-recommendation）
- **DeepMind FSF v3 row**（domain、CCL / TCL、deceptive-alignment involvement）
- **Convergence summary**（agreement + meaningful disagreement）
- **Measurement ownership**（eval provider、eval cadence）
- **Reader recommendation**（most rigorous、least rigorous、根拠つき）
