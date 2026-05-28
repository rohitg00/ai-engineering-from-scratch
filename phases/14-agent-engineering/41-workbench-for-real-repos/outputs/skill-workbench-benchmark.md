---
name: workbench-benchmark
description: project 自身の sample app 上で prompt-only と workbench-guided pipeline に同じ task を実行し、5 outcome の before/after report を出力する。
version: 1.0.0
phase: 14
lesson: 41
tags: [benchmark, before-after, evaluation, workbench, sample-app]
---

repo、agent product、小さな sample app が与えられたら、prompt-only と workbench-guided pipeline を比較する portable evaluation harness を作成してください。

生成するもの:

1. `eval/sample_app/`。project の domain から作った minimum-viable sample app。
2. `eval/run_prompt_only.py` と `eval/run_workbench.py`。それぞれ task description を受け取り、`TaskOutcome` を返す。
3. `eval/report.py`。両 pipeline を実行し、`before-after-report.md` と `comparison.json` を書く。
4. 固定 task suite で workbench outcome が regression したら fail する CI workflow。
5. 5 つの outcome と regression の定義を説明する `docs/benchmark.md`。

ハード拒否条件:

- pipeline が 1 つしかない benchmark。比較こそが目的です。
- denominator のない percentage として表現された outcome。常に `n / m` で report してください。
- agent product が training された sample app。domain-tuned fixture を使ってください。
- false negative を隠す report。prompt-only のほうが速かった task は列挙する必要があります。

拒否ルール:

- project に acceptance command がない場合、benchmark の出荷を拒否してください。測定するものがありません。
- median task で workbench pipeline が prompt-only pipeline の 3 倍を超える場合、その finding を明示してください。必要なのは model 変更ではなく workbench の単純化です。
- harness が offline で走れない場合、CI への wiring を拒否してください。network flakiness は comparison を汚します。

出力構成:

```
<repo>/
├── eval/
│   ├── sample_app/
│   ├── run_prompt_only.py
│   ├── run_workbench.py
│   └── report.py
├── outputs/eval/
│   ├── before-after-report.md
│   └── comparison.json
├── docs/benchmark.md
└── .github/workflows/benchmark.yml
```

最後に "what to read next" を置き、次を指してください。

- Lesson 42: workbench pipeline が使うすべての surface を bundle する capstone pack。
- Lesson 19 (SWE-bench, GAIA, AgentBench): この harness を補完する macro benchmark。
- Lesson 30 (Eval-Driven Agent Development): benchmark wiring 後の ongoing eval loop。
