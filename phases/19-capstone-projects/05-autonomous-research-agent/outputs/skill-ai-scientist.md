---
name: ai-scientist
description: experiment tree search を実行し、vision critique 付きで LaTeX paper を書き、sandbox-escape red team を通過する autonomous research agent を構築する。
version: 1.0.0
phase: 19
lesson: 05
tags: [capstone, autonomous-agent, ai-scientist, sakana, langgraph, sandbox, research]
---

seed idea、狭い domain、$30 の compute budget を受け取り、experiment tree search を実行し、review 可能な LaTeX paper を書き、reproducibility bundle を出力する agent を構築する。

構築計画:

1. literature pass: Semantic Scholar Graph API + OpenAlex。abstract を FAISS に cache し、1-page domain digest を生成する。
2. tree search: experiment node に対する best-first expansion を実装する。`expand(node) -> children` (child ごとに config edit 1つ) と `score(node) = novelty*0.4 + quality*0.5 + budget*0.1` を使う。
3. per-node sandbox: 各 experiment は `docker run --network=none --memory=8g --cpus=2 --pids-limit=256 --read-only` または E2B equivalent で実行する。deterministic seeds と resource cap を強制する。
4. plan-execute-verify: verify step は loss が収束したか、baseline が走ったか、ablation が claim を分離できたかを確認する。
5. writer: LaTeX を生成し、PDF に compile し、Claude Opus 4.7 vision mode に PDF を渡して layout と claim-evidence alignment を critique させ、最大3回 iterate する。
6. reviewer ensemble: 5人の judge (Opus 4.7, GPT-5.4, Gemini 3 Pro, DeepSeek R1, Qwen3-Max) が NeurIPS rubric (novelty, rigor, clarity, reproducibility, impact) で score する。mean < 4.0 なら writer に戻す。
7. red team: adversarial tasks (fork bomb, filesystem escape, LLM-written network call) を統合する。すべて block されることを確認し、`red_team.md` を出力する。
8. reproducibility bundle: paper.pdf + review.md + tree-search trace JSON + seeds + W&B run links + sandbox config + one-line rerun command。

評価 rubric:

| Weight | Criterion | Measurement |
|:-:|---|---|
| 25 | Paper quality | 同じ seed topic の published workshop papers に対する blind rubric review |
| 20 | Experimental rigor | baseline、seed、ablation。すべての claim が results table の cell に裏付けられること |
| 20 | Cost and compute discipline | paper あたり $30 ceiling を強制し、Langfuse で trace すること |
| 20 | Safety | sandbox red team を通過し、network policy と kill-switch が logged attempt で検証されること |
| 15 | Reproducibility | one-command rerun が同じ seed で paper を再現すること |

ハードリジェクト:

- sandbox 外で走る experiment。この capstone の主張は execution containment にある。
- compiled PDF を読み直さない writer step。vision critique は必須。
- baseline、seed、ablation section のない paper。
- hard ceiling ではなく post-hoc warning としてだけ強制される cost budget。

拒否ルール:

- reviewer mean が 4.0/5 未満の paper は、明示的な human override なしに publish しない。
- sandbox 内から network access を必要とする seed idea で実行しない。代わりに separate read-only dataset volume を追加する。
- red-team が実行・記録されていない paper の rerun を拒否する。

出力: tree-search engine、sandbox policy、writer/reviewer loop、reproducibility bundle 付きの3つの example run、red-team report、cost-ledger csv、Sakana v2 のどの failure mode を再現し、mitigation がどう働いたかを記す write-up を含むリポジトリ。
