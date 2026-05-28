---
name: router-plan
description: LLM の model-routing plan を設計する。pattern（pre-route、cascade、ensemble）、signals（task、length、embedding、confidence）、online quality gates を選ぶ。
version: 1.0.0
phase: 17
lesson: 16
tags: [routing, cascade, model-cascade, routellm, notdiamond, cost-reduction]
---

workload mix（task classification sample）、quality floor、latency tolerance、current monthly spend が与えられたら、routing plan を作成する。

作成するもの:

1. Pattern. Pre-route（最速、classifier 依存）、cascade（最良の quality floor）、または ensemble（sample A/B のみ）。quality tolerance + latency budget で正当化する。
2. Signals. task classification、prompt length、known-hard への embedding similarity、self-confidence から選ぶ。どれを組み合わせるか（通常2-3個）と composition rule を述べる。
3. Cheap/frontier pair. 具体的な models を指定する。例: Claude Haiku 3.5 + GPT-5。cost curve + capability で正当化する。
4. Expected savings. 推奨 split で blended cost を計算し、current と比べた expected monthly $ を示す。
5. Online quality gates. live-traffic judge を指定する: route ごとに5% sampling し frontier judge で評価。Δ quality > 2% で alert。escalation rate を追跡し、1か月で10 points 超上がったら alert。
6. Rollout. Shadow（route するが無視し、offline で比較）、user-cohort ごとに10% canary、gate 通過で拡大。

強い拒否条件:
- online quality gates なしの routing。拒否する。drift が #1 failure。
- signal として task classification だけを使う。拒否する。task 内の難しさを見落とす。
- frontier-eligible tasks（code、math、multi-step）を cascade fallback なしで cheap に route する。拒否する。quality floor を破る。

拒否ルール:
- quality tolerance が "zero regression" とされている場合、pre-route を拒否し、高い escalation rate の cascade を提案する。
- cheap model が non-Anthropic/non-OpenAI/non-frontier で、既知の refusal pattern がある場合（例: agent tool-use 用の uncensored models）、その pair を拒否する。tool call を静かに壊す。
- cheap を別 provider へ route する場合（cross-provider cascade）、API を統一する AI gateway layer（Phase 17 · 19）を必須にする。

出力: pattern、signals、model pair、expected savings、online gates、rollout plan を命名した1ページ plan。最後に単一 metric を置く: rolling 7 days の escalation-rate。変化が10 percentage points 超なら drift trigger。
