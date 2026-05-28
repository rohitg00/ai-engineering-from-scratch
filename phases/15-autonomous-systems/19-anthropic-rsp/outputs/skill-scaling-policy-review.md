---
name: scaling-policy-review
description: Frontier-lab の scaling policy（Anthropic RSP、OpenAI Preparedness、DeepMind FSF、internal）を RSP v3.0 の参照形に照らしてレビューする。
version: 1.0.0
phase: 15
lesson: 19
tags: [rsp, scaling-policy, ai-rd-4, pause-commitment, saferai, governance]
---

公開済みまたは提案中の scaling policy が与えられたら、それを RSP v3.0 の参照形（AI R&D-4、affirmative case、two-tier mitigation、Frontier Safety Roadmap、Risk Report、independent review）と比較する構造化レビューを作成してください。

作成する内容:

1. **Two-tier inventory.** コミットメントを "lab-unilateral" と "industry-wide recommendation" に分けます。recommendation tier にあるコミットメントは advocacy であり、約束ではありません。比率を数えてください。ほとんどのコミットメントが recommendation tier にある policy は弱い policy です。
2. **Thresholds.** すべての capability threshold と、それが発火させる mitigation を列挙します。v2 では定量的だったものが定性的になっている threshold を指摘してください。policy がカバーすると主張する capability に threshold が欠けている場合も指摘してください。
3. **Pause commitment.** policy が特定の threshold で pause clause（training stop、deployment halt、または類似のもの）を名指ししているか確認します。v3.0 はこれを削除しました。同じ流れに従う policy はその後退を引き継ぎます。
4. **Standing artifacts.** policy が、宣言された cadence を持つ継続的な Frontier Safety Roadmap と Risk Report 文書を義務づけているか確認します。事後に公開される単発 artifact は該当しません。
5. **Independent review.** 外部レビュー機構を名指ししてください。内部レビューだけ（lab employees で構成される "Safety Advisory Group"）では independent oversight として認められません。

即時不合格:
- named capability threshold がない policy。
- mitigations がすべて industry-recommendation tier にある policy。
- 継続的な Roadmap / Risk Report artifact がない policy。
- independent review mechanism がない policy。
- 「real-world experience から学ぶ」と主張しながら、policy text がどう更新され、どの cadence で更新されるかを述べていない policy。

拒否ルール:
- policy document が governance ではなく marketing（具体的 commitment、threshold、cadence がない）である場合、scaling policy として評価することを拒否します。
- ユーザーが policy の存在を compliance と同一視する場合は拒否します。policy は commitment device です。compliance には証拠が必要です。
- ユーザーが古い policy version（例: 2023 Anthropic RSP）を current として引用している場合、拒否して current version を要求します。

出力形式:

次を含む policy review を返してください。
- **Two-tier ratio**（unilateral / recommendation / total count）
- **Threshold table**（name、type: quantitative / qualitative、trigger、mitigation）
- **Pause commitment**（present y/n、specific clause）
- **Standing artifacts**（Roadmap cadence、Risk Report cadence）
- **Independent review**（mechanism、reviewer identity、frequency）
- **Summary rating**（strong / moderate / weak、根拠つき）
