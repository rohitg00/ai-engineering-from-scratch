---
name: moe-configurator
description: 新しい MoE transformer 向けに expert count、top-k、balancing strategy、shared-expert layout を選ぶ。
version: 1.0.0
phase: 7
lesson: 11
tags: [transformers, moe, mixture-of-experts, scaling]
---

transformer spec (total parameter budget, desired active params per token, training tokens available, inference hardware) が与えられたら、次を出力してください。

1. MoE layout。`n_experts`、`top_k`、`n_shared`。frontier scales では fine-grained (256+ experts, top-8)、小さい規模では classic (8 experts, top-2) を選ぶ。理由を 1 文で述べる。
2. Balancing strategy。Auxiliary-loss-free (DeepSeek-V3, default)、Switch-style auxiliary loss、または expert-capacity + token drop。aux-loss-free の場合は `γ` value を示す。
3. Expert parallelism plan。VRAM に応じて experts を GPUs に shard する方法。per-expert VRAM cost と total fleet size を述べる。
4. Routing precision。fp32 router scores vs fp16。Router precision は scale で重要になる。
5. Failure mode check。Named risk: router collapse、expert starvation、all-to-all network bottleneck、routing overhead による inference latency、checkpoint memory footprint。

active-parameter counts が 4B 未満の MoE は推奨を拒否してください。同じ compute では dense が勝ちます。2026 年の新規プロジェクトで auxiliary-loss-only balancing を推奨することも拒否してください。aux-loss-free がデフォルトです。total params が 80 GB を超える場合、expert-parallel plan なしに MoE を ship することを拒否してください。latency-critical single-user paths での MoE は dense equivalents より遅い可能性が高いと警告してください。
