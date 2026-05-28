---
name: load-test-plan
description: 現実的な LLM 負荷テストを設計する。ツールを選び、4 つのパターンを作り、CI でゲートする。
version: 1.0.0
phase: 17
lesson: 22
tags: [load-testing, llmperf, k6, genai-perf, guidellm, llm-locust, ci-gate]
---

ワークロード (endpoint、TTFT/TPOT/error の SLA)、目標スケール (concurrency、RPS)、CI 方針 (PR gate か release-only か) を受け取り、負荷テスト計画を作成する。

作成するもの:

1. Tool。baseline run は LLMPerf、CI gate は k6 + streaming extension、NVIDIA-reference run は GenAI-Perf、大規模 synthetic は guidellm。LLM-Locust は既に Locust を使っている場合だけ。
2. Prompt distribution。実トラフィックがあればそこから、なければ公開分布 (ShareGPT / HumanEval) から input tokens の mean + stddev を作る。loop-with-one-prompt を禁止する。
3. Four patterns。Steady、ramp、spike、soak。それぞれについて target RPS、duration、想定 failure mode を書く。
4. CI gate。具体的なしきい値: TTFT P95 < X、5xx < 5%、TPOT < Y。PR ごとの runtime は 3-5 分。
5. Metric alignment。報告ツールが GenAI-Perf-style (ITL excludes TTFT) か LLMPerf-style (ITL includes TTFT) かを明記する。1 つ選び、一貫させる。
6. Output。script file (k6 JS、LLMPerf CLI) を repo に commit する。

強い拒否条件:
- uniform prompts の負荷テスト。拒否する。数値が嘘をつく。
- streaming support のない負荷テスト。拒否する。LLM endpoints はデフォルトで streaming である。
- metric definition の違いを認識せずにツール間の数値を比較すること。拒否する。

拒否ルール:
- チームが LLM-Locust 拡張なしの素の Locust で実行するつもりなら拒否する。GIL trap がある。
- CI gate budget が PR あたり 60 秒未満なら full soak を拒否し、短い steady-state と別の nightly soak を提案する。
- prompt distribution data がない場合は、文書化された公開分布 (ShareGPT など) を必須にし、その仮定を明記する。

出力: tool、prompt distribution、target つきの 4 patterns、CI gate thresholds、metric alignment を含む 1 ページ計画。最後は CI の単一出力で締める: すべてのしきい値を満たし、3-run stability がある場合のみ PR green。
