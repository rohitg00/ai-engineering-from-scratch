---
name: skill-llm-evaluation
description: task type、budget、requirements に基づいて適切な LLM evaluation strategy を選ぶための decision framework
version: 1.0.0
phase: 10
lesson: 10
tags: [evaluation, evals, benchmarks, llm-as-judge, elo, metrics]
---

# LLM Evaluation Strategy

LLM system を評価するときは、この decision framework を適用して適切な approach を選ぶ。

## 各 eval type をいつ使うか

**Benchmarks (MMLU, HumanEval, SWE-bench):** 初期の model selection をしている。10 個の candidate models を 3 個に絞りたい。benchmarks はゼロコストで粗い ranking を与える。final evaluation として benchmarks を使ってはならない。

**Custom evals:** production 向けに構築している。specific failure modes を持つ specific task がある。custom evals は real-world performance を予測する唯一の評価である。prototype では最低 50 test cases、production では 200+。

**LLM-as-judge:** task が open-ended (summarization, writing, conversation) である。exact match や token overlap metrics は硬すぎる。LLM-as-judge は judgment あたり約 $0.01 で、人間と約 80% の割合で一致する。曖昧な prompt ではなく、必ず rubric を使う。

**Human evals:** stakes が高く、automated metrics が一致しない。human eval は ground truth だが、judgment あたり $0.10-$2.00 かかる。ambiguous cases と automated metrics の定期 calibration に限定する。

**ELO from pairwise comparisons:** 同じ task で複数 models を比較している。humans と LLM judges は relative judgments のほうが得意なため、pairwise は absolute scoring より信頼できる。

## Scoring function selection

- **Exact match**: classification、entity extraction、known answers を持つ structured outputs
- **Token F1**: partial credit が重要な extraction tasks
- **ROUGE-L**: summarization、translation
- **BLEU**: machine translation
- **LLM-as-judge**: open-ended generation、conversational quality、helpfulness
- **Execution-based**: code generation (code を実行し、tests に通るか確認する)
- **Schema compliance**: structured outputs (JSON が schema に一致するか)

## Eval design の red flags

- Eval set が 50 cases 未満: results は統計的に意味を持たない
- Edge cases がない: happy-path performance を測っているだけで、これは常に real-world より高い
- Single metric: metrics ごとに異なる story があるため、少なくとも 2 つ使う
- Versioning がない: versioned eval sets なしでは improvement を追跡できない
- Eval set contamination: eval examples を fine-tuning data や few-shot prompts に絶対に含めない
- 1 つの model だけをテストしている: comparison のための baseline が必要。単純な heuristic でもよい

## Eval pipeline checklist

1. task を正確に定義する ("answer questions" ではなく "classify support tickets into 5 categories")
2. happy path、edge cases、known regressions にまたがる test cases を作る
3. task type に適した 2-3 個の scoring functions を選ぶ
4. production requirements に基づいて pass/fail thresholds を設定する
5. execution を自動化する。1 コマンドで full suite が走る
6. すべてを version 管理する: test cases、scoring functions、prompts、model versions
7. すべての change で実行する: prompt updates、model swaps、code deployments
8. trends を追跡する。single score は noise、trendline は signal
9. 四半期ごとに human judgment と calibration する
10. production failure が見つかるたびに regression cases を追加する
