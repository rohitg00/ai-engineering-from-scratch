# Capstone 05 — Autonomous Research Agent (AI-Scientist Class)

> Sakana の AI-Scientist-v2 は full paper を公開しました。Agent Laboratory は experiment を実行しました。Allen AI は trace を共有しました。2026年の形は、experiment 上の plan-execute-verify tree search、budgeted cost、sandboxed code execution、vision-feedback 付き LaTeX writer、自動 NeurIPS-style reviewer ensemble です。この capstone では、それを作り、paper あたり $30 以内で end to end に走らせ、Sakana が記録した sandbox-escape red team を生き残らせます。

**種別:** Capstone
**言語:** Python (agent + sandbox), LaTeX (output)
**前提条件:** Phase 2 (ML), Phase 3 (deep learning), Phase 7 (transformers), Phase 10 (LLMs from scratch), Phase 14 (agents), Phase 15 (autonomous), Phase 16 (multi-agent), Phase 18 (safety)
**Phases exercised:** P0 · P2 · P3 · P7 · P10 · P14 · P15 · P16 · P18
**所要時間:** 40時間

## 問題

autonomous research agent は2026年に一つの閾値を越えました。Sakana AI の AI-Scientist-v2 は、workshop peer review を通過した generated paper とともに Nature に掲載されました。ShinkaEvolve (ICLR 2026) は hypothesis evolution に拡張しました。AMD の Agent Laboratory は reproducible trace を提供しました。これらの agent は魔法ではありません。candidate experiment の tree 上で、cost cap、seed-bound sandbox、自動 review を備えた plan-execute-verify loop を回しています。craft は loop、budget、safety story にあります。

狭い domain の seed idea (例: 100M-parameter transformer の attention-sparsity ablation) に対して実装することで loop を学びます。最初の run で新発見をすることが価値ではありません。tree-search、experiment sandbox、writer-reviewer loop、red-team report という infrastructure を作ることが価値です。Sakana team は sandbox-escape failure を記録しています。あなたの agent は同じ red team を通過しなければなりません。

## コンセプト

agent は best-first tree search です。node は experiment specification (hypothesis, config, code, expected outcome) です。expand step は small edit (optimizer の swap、batch size の変更、component ablation) で child を提案します。各 child は hard resource cap を持つ fresh sandbox で実行されます。result は scoring function に戻り、(novelty × quality × remaining budget) で node を rank します。budget が尽きるまで tree を伸ばし、best branch を paper 化します。

writer は multimodal です。LaTeX draft を生成し、compile し、figure を render し、rendered PDF を Claude Opus 4.7 の vision mode に戻して layout、figure legibility、claim-evidence alignment を critique させます。5人の LLM judge から成る reviewer ensemble が NeurIPS-style score (novelty, rigor, clarity, reproducibility, impact) を出します。average が threshold 未満なら、paper は critique とともに writer に戻ります。

safety は load-bearing です。すべての experiment は E2B または Daytona sandbox で実行され、network egress はなく、wall-clock は bounded、resource limit は pin されています。code-generation step は sandbox を抜ける syscall を block する policy layer を通ります。red-team report は Sakana が記録した attack surface (fork bomb、filesystem escape、LLM-written network call) を再現します。

## Architecture

```
seed idea + domain
      |
      v
  literature search (Semantic Scholar + OpenAlex + FAISS cache)
      |
      v
  LangGraph plan-execute-verify tree
      |
      v
  +--- expand node ----+      per-node sandbox
  |                    |      (E2B / Daytona)
  v                    v      resource caps
  child_1           child_k   no network egress
  |                    |      deterministic seeds
  v                    v
  run experiment       run experiment
  |                    |
  v                    v
  score nodes by (novelty, quality, budget)
      |
      v
  best branch -> LaTeX writer
      |
      v
  compile + vision critique (Opus 4.7 vision)
      |
      v
  reviewer ensemble (5 LLM judges, NeurIPS rubric)
      |
      v
  paper.pdf + review.md + trace.json
```

## Stack

- Orchestration: checkpointing と human-approval gates 付き LangGraph
- Tree search: experiment node 上の custom best-first (Sakana v2 の AB-MCTS-style)
- Sandbox: experiment ごとの E2B、fallback は Docker-in-Docker。cgroups で resource caps
- Literature: Semantic Scholar Graph API + OpenAlex + abstract の local FAISS cache
- Writer: LaTeX template + figure critique / layout 用 Claude Opus 4.7 vision mode
- Reviewer: 5 judge ensemble (Opus 4.7, GPT-5.4, Gemini 3 Pro, DeepSeek R1, Qwen3-Max) と weighted aggregation
- Experiment framework: physical experiment 用 PyTorch 2.5、logging 用 W&B
- Observability: agent trace 用 Langfuse、paper あたり $30 hard budget

## 実装

1. **Seed and domain scoping.** seed idea (例: "investigate sparsity patterns in attention maps of sub-1B transformers") を受け取り、model、dataset、compute budget から search space を定義します。

2. **Literature pass.** Semantic Scholar + OpenAlex で関連度の高い被引用上位50本を query し、abstract を local cache し、1-page domain digest を生成します。

3. **Tree scaffolding.** root を seed hypothesis で初期化します。`expand(node) -> children` を small-edit proposal (child ごとに config change 1つ) として実装します。`score(node)` は weighted novelty × quality × budget term として実装します。

4. **Sandbox wrapping.** すべての experiment は `docker run --network=none --memory=8g --cpus=2 --pids-limit=256 --read-only` (または equivalent E2B policy) で実行します。seed は sandbox に書き、output は read-only mount で外に戻します。

5. **Plan-execute-verify loop.** `plan` が child を提案します。`execute` が sandbox を走らせ、log と metrics を capture します。`verify` が metric の unit check (loss は下がったか、ablation は効果を isolate したか) を実行します。failed node には failure reason を tree に保存します。

6. **Writer.** budget 後、best branch を選びます。matplotlib で figure を render します。branch trace を context に入れて Claude Opus 4.7 で LaTeX draft を生成し、compile します。compiled PDF を Opus 4.7 vision に戻して critique し、iterate します。

7. **Reviewer ensemble.** 5人の judge が draft を novelty、rigor、clarity、reproducibility、impact で score します。mean < 4.0/5 なら critique とともに writer に戻します。3 rewrite で hard stop します。

8. **Red team.** sandbox を狙う adversarial task set を構築または統合します: fork bomb、network exfiltration attempt、filesystem escape、LLM-written shell metacharacter。すべて block されることを確認し、finding を書きます。

9. **Reproducibility.** すべての paper に tree-search trace JSON、seeds、W&B run links、sandbox configs、end to end で再現する README を同梱します。

## Use It

```
$ ai-scientist run --seed "attention sparsity in sub-1B transformers" --budget 30
[lit]    50 papers, digest in 12s
[tree]   expanded 8 nodes, budget 12/30
[exec]   node #3 sparsity=top-8, loss=2.83 (best so far)
[exec]   node #6 sparsity=top-4, loss=3.12 (worse)
[exec]   ...
[tree]   chose branch rooted at node #3 (novelty 0.62, quality 0.81)
[write]  LaTeX draft v1 complete
[vision] critique: figure 2 legend too small, claim-evidence ok
[write]  draft v2 after 3 edits
[review] mean 4.2/5 (novelty 3.9, rigor 4.3, clarity 4.1, repro 4.5, impact 4.2)
[done]   paper.pdf + review.md + trace.json     $28.40 spent
```

## Ship It

`outputs/skill-ai-scientist.md` が deliverable です。seed idea + domain + $30 budget を受け取り、full pipeline を走らせ、review 可能な paper と reproducibility bundle を出力します。

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | Paper quality | published workshop papers に対する blind rubric review |
| 20 | Experimental rigor | baseline、seed、ablation。すべての claim が results table の cell で裏付けられること |
| 20 | Cost and compute discipline | $30/paper ceiling が強制され、Langfuse-traced であること |
| 20 | Safety | sandbox red team 通過。network policy と kill-switch の検証 |
| 15 | Reproducibility | identical seeds で one-command rerun が paper を再現 |
| **100** | | |

## Exercises

1. 同じ domain で3つの異なる seed idea に対して pipeline を走らせます。tree-search のどの部分が重複するか比較し、duplicated wasted compute を特定します。

2. $5 を超えると推定される node の experiment execution 前に human-in-the-loop gate を追加します。total cost がどれだけ下がるか測ります。

3. reviewer ensemble を single judge に差し替えます。known-bad papers の held-out set で false-accept rate を測ります。

4. network-exfiltration red team test を導入します。agent が外部 address へ `curl` しようとする code を書きます。`--network=none` policy が block することを確認し、attempt を log します。

5. tree-search を flat random baseline (same budget、expansion strategy なし) と比較します。novelty × quality gain を報告します。

## Key Terms

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Tree search | 「AB-MCTS-style expansion」 | novelty×quality×budget score を持つ experiment node 上の best-first exploration |
| Sandbox | 「Experiment isolation」 | network なし、CPU/memory bounded、seed pinned、read-only inputs の container |
| Vision critique | 「Render-then-read」 | paper を PDF に compile し、VLM に戻して layout と claim-evidence を critique させること |
| Reviewer ensemble | 「Automated peer review」 | 複数 LLM judge が NeurIPS rubric で paper を score し、weighted aggregate が pipeline を gate する |
| Novelty score | 「Is this new?」 | 50-paper literature cache への近さを penalize する heuristic |
| Cost ceiling | 「$ budget」 | paper あたり total spend の hard cap。Langfuse counters + pre-run estimates |
| Red team | 「Sandbox-escape audit」 | policy が間違っていれば sandbox を抜ける adversarial task |

## 参考文献

- [Sakana AI-Scientist-v2 repository](https://github.com/SakanaAI/AI-Scientist-v2) — production research agent の reference
- [Sakana AI-Scientist-v1 paper (arXiv:2408.06292)](https://arxiv.org/abs/2408.06292) — original methodology
- [ShinkaEvolve (Sakana ICLR 2026)](https://sakana.ai) — evolutionary extension
- [Agent Laboratory (AMD)](https://github.com/SamuelSchmidgall/AgentLaboratory) — multi-role research-lab framework
- [LangGraph documentation](https://langchain-ai.github.io/langgraph/) — reference orchestration layer
- [Semantic Scholar Graph API](https://api.semanticscholar.org/) — literature search
- [E2B sandboxes](https://e2b.dev) — reference experiment isolation
- [NeurIPS reviewer guidelines](https://neurips.cc/Conferences/2026/Reviewer-Guidelines) — reviewer ensemble が encode する rubric
