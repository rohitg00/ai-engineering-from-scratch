# マルチエージェント討論と協調

> Du et al. (ICML 2024, "Society of Minds") は、N 個のモデルインスタンスに独立して回答案を出させ、その後 R ラウンドにわたって互いに批評させ、収束させる。事実性、ルール遵守、推論を改善する。スパーストポロジーは、トークンコストの面でフルメッシュより有利。

**種類:** 学習 + 構築
**言語:** Python (stdlib)
**前提:** Phase 14 · 12 (Workflow Patterns), Phase 14 · 05 (Self-Refine and CRITIC)
**時間:** 約60分

## 学習目標

- 討論プロトコルを説明する: N 人の提案者、R ラウンド、共有回答への収束。
- 討論が事実性、ルール遵守、推論を改善する理由を説明する。
- スパーストポロジーを説明する: すべての討論者が全員を見る必要はない。
- スクリプト化された LLM 上で stdlib による討論を実装し、フルメッシュ版とスパース版でトークンコストと精度を測定する。

## 問題

Self-Refine (Lesson 05) は、1 つのモデルが自分自身を批評するため、集団思考のリスクがある。CRITIC (Lesson 05) は外部ツールに基づいて批評するが、常に使えるとは限らない。討論は第三のモードを導入する。複数のインスタンス、相互批評、不一致による収束である。

## コンセプト

### Society of Minds (Du et al., ICML 2024)

- N 個のモデルインスタンスが、同じ質問に対して独立に回答案を出す。
- R ラウンドにわたり、各モデルが他者の提案を読み、批評する。
- モデルは批評に基づいて自分の回答を更新する。
- R ラウンド後、収束した回答を返す。

元の実験ではコストのため N=3、R=2 が使われた。難しい問題 (MMLU, GSM8K, Chess Move Validity, biography generation) では、エージェント数とラウンド数を増やすほど精度が向上する。

異なるモデルの組み合わせは、単一モデル同士の討論を上回る。ChatGPT + Bard の組み合わせは、それぞれ単独より強い。

### スパーストポロジー

"Improving Multi-Agent Debate with Sparse Communication Topology" (arXiv:2406.11776, 2024-2025) は、フルメッシュ討論が常に最適ではないことを示した。スパーストポロジー (star, ring, hub-and-spoke) は、より低いトークンコストで同等の精度を出せる場合がある。各討論者はピアの一部だけを見る。

含意:

- フルメッシュ N=5, R=3 = 5 × 3 = 15 提案、各提案が 4 人のピアを読む = 60 批評 op。
- Star N=5, R=3 (1 つの hub + 4 つの spoke) = 15 提案、spoke は hub だけを読む = 12 批評 op。

### 討論が効く場合

- **事実性。** N 個の独立提案があり、クロスチェックで幻覚を減らす。
- **ルール遵守。** Chess move validity では、1 つのモデルが見落としたルールを他のモデルが捕まえる。
- **オープンエンドな推論。** 複数の捉え方が、正しい回答に向けて絞り込まれていく。

### 討論が悪化させる場合

- **レイテンシ重視の UX。** N × R の直列ラウンドは、許容できない遅延になることがある。
- **コスト重視のスケール。** 質問ごとに N × R のトークンが必要。
- **単純な事実検索。** 1 回の lookup のほうが、5 人で討論するより安い。

### 2026 年時点の実用的な具体化

- **Anthropic orchestrator-workers** (Lesson 12) — 合成ステップを持つ討論の一種。
- **LangGraph supervisor** (Lesson 13) — 中央 router + specialist agents は、討論をノードとして実装できる。
- **OpenAI Agents SDK** (Lesson 16) — agents が反復批評のために handoff し合う。
- **Multi-agent evals** — eval シグナルのために、debate と evaluator-optimizer を組み合わせる。

### このパターンが失敗するところ

- **収束崩壊。** すべての agents が最初の誤答に収束する。必須の不一致ラウンドで緩和する。
- **Hub failure。** Star topology では、不良 hub が全員を汚染する。hub をローテーションするか複数使う。
- **Prompt homogenization。** 全 agents が同じ prompt を使うと、同じ回答を出す。多様な prompts や models を使う。

## 構築

`code/main.py` は stdlib の討論を実装する。

- `Debater` class (討論者ごとの意見ドリフトを持つ scripted LLM)。
- `FullMeshDebate` と `SparseDebate` runner。
- 3 つの質問: 事実問題、ルールベース問題、推論問題。
- Metrics: 収束回答、収束までのラウンド数、総批評 op。

実行:

```
python3 code/main.py
```

出力: protocol ごとの精度とコスト。sparse は 3 問中 2 問で、より低コストに full mesh と同等。

## 利用

- 単純な 2-3 worker の討論には **Anthropic orchestrator-workers**。
- checkpointing を伴う状態付き multi-round debate には **LangGraph**。
- 研究や特化した正しさ保証には **Custom**。

## 出荷

`outputs/skill-debate.md` は、設定可能な topology、N、R、convergence rule を持つ multi-agent debate を scaffolding する。

## 演習

1. 「強制不一致」ルールを実装する。round 1 では、各討論者が異なる提案を出さなければならない。収束速度への影響を測る。
2. confidence-weighted aggregation を追加する。討論者が (answer, confidence) を返し、aggregator が confidence で重み付けする。効果はあるか。
3. 1 つの「agent」を、異なる意見を持つ別の scripted LLM に差し替える。異質性は精度を上げるか。
4. 3 つの質問で full mesh と sparse の token cost を測る。cost vs accuracy をプロットする。
5. Society of Minds paper を読む。toy を N=5, R=3 に移植する。何が壊れるか。何が良くなるか。

## 重要用語

| 用語 | よく言われる表現 | 実際の意味 |
|------|----------------|------------|
| Debate | "Multi-agent critique" | N 人の提案者、R ラウンドの相互批評、収束 |
| Full mesh | "Everyone reads everyone" | 各ラウンドで全討論者が全ピアを読む |
| Sparse topology | "Limited peer view" | 討論者がピアの一部だけを読む |
| Hub-and-spoke | "Star topology" | 1 人の中心討論者と、hub だけを読む N-1 の spoke |
| Convergence | "Agreement" | 討論者が共有回答に収束すること |
| Society of Minds | "Du et al. debate paper" | ICML 2024 の multi-agent debate method |

## 参考文献

- [Du et al., Society of Minds (arXiv:2305.14325)](https://arxiv.org/abs/2305.14325) — 標準的な multi-agent debate
- [Sparse Communication Topology (arXiv:2406.11776)](https://arxiv.org/abs/2406.11776) — sparse topology の結果
- [Anthropic, Building Effective Agents](https://www.anthropic.com/research/building-effective-agents) — debate variant としての orchestrator-workers
- [Madaan et al., Self-Refine (arXiv:2303.17651)](https://arxiv.org/abs/2303.17651) — 単一モデル自己批評の対応物
