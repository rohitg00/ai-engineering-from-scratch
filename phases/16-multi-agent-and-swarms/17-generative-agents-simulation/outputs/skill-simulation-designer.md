---
name: simulation-designer
description: 指定シナリオ向けに、Smallville 形式の generative-agent simulation を設計する。memory schema、reflection cadence、plan horizon、空間・社会制約、評価指標を定義する。
version: 1.0.0
phase: 16
lesson: 17
tags: [multi-agent, simulation, generative-agents, emergence, memory]
---

エージェント集団から創発的な振る舞いが必要なシナリオ（社会シミュレーション、ゲーム NPC、政策リハーサル、市場ダイナミクス）が与えられたら、そのシミュレーションを設計する。

作成するもの:

1. **集団サイズと異質性。** N 体のエージェント。どれが同じ base model を共有し、どれが異なるか。prompt family、役割分布。Smallville は個別 persona を持つ 25 体の同質エージェントを使った。より大きな集団では異質性が効く。
2. **Memory schema。** 各 entry の field: `(ts, kind, content, importance, embedding_ref, source_ids)`。recency decay 定数、importance 採点手順、relevance metric（embedding model X との cosine）。compaction の retention policy。
3. **Reflection cadence。** trigger: 未処理 memory の importance 合計 > threshold、N observations ごと、または periodic tick。trigger ごとの reflection 数。reflection prompt template。
4. **Plan horizon。** day / hour / action レベル。必須と任意を分ける。revision trigger: active plan と矛盾する importance > threshold の新 observation。
5. **World model。** spatial grid、social graph、resource constraints。observation と見なすもの（line-of-sight、conversation、notification）。アーキテクチャが学習しないため明示的にエンコードすべき normative constraints（capacity limit、closed hours、private spaces）。
6. **Seed goals。** どのエージェントにどの priority を seed するか。競合し得る重複 goal、共存すべき非競合 goal。
7. **Budget。** agent ごとの per-tick LLM calls（observe + retrieve + reflect + plan + act）。agent ごとの tick あたり期待 token。T ticks の総 simulation cost。
8. **Evaluation metric。** Believability（human-rater）、goal achievement rate、coordination event 数、failure signal としての spatial-norm violations。

Hard rejects:

- 明示的な spatial / social norm encoding がない設計。アーキテクチャはそれらを破る（Park 2023 の closed-store、single-bathroom failure）。
- mutable memory を持つ設計。memory は append-only でなければならず、correction は新しい entry として追加する。
- 毎 tick reflection を実行する設計。budget 非効率である。reflection は高価なので threshold-based trigger にする。
- memory-compaction strategy なしの large N（> 50）simulation。stream length とともに retrieval cost が増える。

Refusal rules:

- シナリオが創発的な *social behavior* ではなく創発的な *task execution* を必要とする場合は、代わりに supervisor / roles / primitives pattern を推奨する（Phase 16 · 05-08）。Smallville は social simulation 向け。
- budget が tick あたり total 100 LLM calls 未満なら、大きな集団ではなく N = 3-5 の dense interaction を推奨する。
- シナリオが emergence の恩恵を受けない（tightly-scripted task）なら、single-agent + tools を推奨する。

Output: 1 ページの design brief。1 文の summary（「Smallville-style simulation: 15 heterogeneous agents, reflection at importance sum > 120, 3-level plan horizon, spatial grid with capacity constraints, measured by believability + coordination events.」）から始め、その後に上記 8 sections を続ける。最後に期待される emergent behaviors と、最初に監視すべき 3 つの failure modes を書く。
