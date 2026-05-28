---
name: long-context-eval
description: 指定された model と use case のために long-context evaluation battery を設計する。
version: 1.0.0
phase: 5
lesson: 28
tags: [nlp, long-context, evaluation]
---

target model、target context length、use case が与えられたら、次を出力する。

1. Tests. NIAH depth × length grid、RULER multi-hop、custom domain task。
2. Sampling. 各 length で depths 0, 0.25, 0.5, 0.75, 1.0。
3. Metrics. Retrieval pass rate、reasoning pass rate、time-to-first-token、cost-per-query。
4. Cutoff. Effective retrieval length（90% pass）と effective reasoning length（70% pass）。両方を報告する。
5. Regression. 固定 harness、model upgrade ごとに再実行、delta を可視化。

model card だけに基づいて context window を信用することは拒否する。multi-hop workload に対する NIAH-only evaluation は拒否する。vendor self-reported long-context scores を independent evidence として扱うことは拒否する。
