---
name: consensus-designer
description: multi-agent ensemble 向けに BFT-aware consensus protocol を設計する。clustering、weighting、threshold、escalation policy を選び、byzantine、sycophancy、monoculture pattern に対して attack-test する。
version: 1.0.0
phase: 16
lesson: 14
tags: [multi-agent, consensus, BFT, voting, confidence]
---

共通 question に答える N agents の ensemble を受け取り、3つの canonical LLM-agent attack (byzantine lie、sycophantic conformity、correlated-error monoculture) に robust な consensus protocol を設計する。

Produce:

1. **Clustering strategy.** answer をどう group 化するか。string canonicalization (lowercase + strip punct)、threshold 付き embedding similarity、explicit structural canonicalization (JSON schema)。expected cluster-granularity error rate を述べる。
2. **Weighting strategy.** plurality (counts)、confidence-probe weighted (CP-WBFT)、quality-plus-trust (WBFT)、geometric-median robustness を持つ score-based (DecentLLMs)。attack profile に基づいて選択理由を述べる。
3. **Threshold.** total weight の何割で acceptance を trigger するか。threshold 未満では retry、escalate、abstain のどれを行うか。
4. **Diversity requirement.** ensemble に必要な base model、prompt family、temperature setting はいくつか。monoculture は plurality が回復できない attack であり、diversity が構造的 mitigation である。
5. **Independent verifier.** ground truth (利用可能な場合) を fetch する、または rubric を適用する read-only agent はいるか。verifier の output はどこへ行くか。voting pool に再投入してはならない。
6. **Round bounding.** escalation までの max rounds。ほとんどの task では default 2-3。長い round は sycophancy を増幅する。
7. **Attack-test table.** (byzantine、sycophancy、monoculture) それぞれについて expected protocol behavior と residual risk を示す。protocol が known failure mode を認める場合、1文で述べる。

Hard rejects:

- single base model で plurality-only を行う design。monoculture により silent failure する。
- unbounded rounds または "keep debating until agreement" を持つ design。conformity に報酬を与える。
- verifier の output が voting pool に戻る design。verifier を poison する。
- BFT が disagreement を「解決する」と主張すること。BFT は output を揃える。correctness は別問題。

Refusal rules:

- task に ground truth がない場合 (opinion、synthesis、creative)、その旨を述べ、"consensus as advisory, human as decider" を推奨する。
- agent が3未満の場合、consensus は適用できない。single agent + verifier を推奨する。
- すべての agent が base model を共有し、user がこれを変更できない場合、monoculture ceiling を明示的に flag する。

Output: 1ページの design brief。single-sentence summary ("Confidence-weighted voting over 5 agents (3 base models), semantic-cluster threshold 0.55, independent verifier re-fetches sources, max 2 rounds.") で始め、上の7 section を続ける。最後に attack-test table で締める。
