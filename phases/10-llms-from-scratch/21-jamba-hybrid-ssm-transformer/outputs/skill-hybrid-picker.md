---
name: hybrid-picker
description: 与えられた workload に対して、pure Transformer、Jamba-style hybrid、pure SSM のどれを選ぶべきか判断する。
version: 1.0.0
phase: 10
lesson: 21
tags: [jamba, mamba, ssm, hybrid, long-context, memory-budget, architecture]
---

Workload specification (context length profile p50/p99, task mix, memory budget per GPU, target throughput, quality-vs-speed priority) が与えられたら、pure Transformer (+MoE +MLA)、Jamba-style hybrid、pure Mamba model のどれを使うべきかを推奨してください。

出力するもの:

1. Context-length bucket。Short (under 16k)、medium (16k-64k)、long (64k-256k)、ultra-long (256k-plus) のいずれか。First-pass decision を決める軸です。
2. Architecture recommendation。Pure Transformer、1:7 hybrid、1:3 hybrid、1:15 hybrid、pure Mamba のいずれかを選びます。Context bucket と task の in-context-recall demands に基づいて理由を述べてください。
3. Memory budget check。Target context で KV cache + SSM state を計算してください。Weights と activation memory (通常は weights と KV cache に加えて 10-20 GB) を考慮した後、target accelerator に収まることを確認してください。
4. Quality tradeoff disclosure。選んだ sparsity level の quality cost を記録してください。1:7 ratio 未満の hybrids は in-context retrieval で measurable に劣化します。Pure Mamba は一部の state-tracking tasks で失敗します。
5. Inference stack compatibility。選んだ architecture が target stack (vLLM, TensorRT-LLM, SGLang, llama.cpp) でサポートされていることを確認してください。Hybrids は pure Transformers より tooling coverage が薄いです。

Hard rejects:
- Context が 16k 未満の Jamba-style hybrid。Architectural overhead が正当化されません。
- Reasoning-heavy または multi-document cross-reference tasks に対する pure Mamba。State-tracking limits が効きます。
- Sub-1:15 hybrid ratios。これより下では in-context recall が信頼できません。
- 指定された accelerator 上で、計算された memory budget に収まらない recommendation。

Refusal rules:
- Workload が本当に short context と long context の混在である場合は、hybrid recommendation を拒否し、pure Transformer (可能なら MLA 付き) を推奨してください。Hybrids が輝くのは long-context workloads に限られます。
- Accelerator が consumer-grade (24GB 以下) の場合は、hybrid-size models を拒否し、distilled small hybrid または quantized pure Transformer を推奨してください。
- Workload が latency-sensitive batch-1 generation で、model が新しく既存の deployment path がない場合は拒否し、より単純な path として speculative decoding (Phase 10 · 15) 付きの well-supported pure Transformer を推奨してください。

Output: context bucket、architecture choice、target context での KV cache、quality tradeoff disclosure、inference stack compatibility を列挙した 1 ページの recommendation。最後は "what to monitor" paragraph で締め、最初の 10k production requests で recommendation を確認するための specific long-context evaluation (RULER, LongBench, needle-in-haystack) を挙げてください。
