---
name: deepseek-v3-reader
description: DeepSeek-family config を読み、component-by-component の architecture analysis を作成する。
version: 1.0.0
phase: 10
lesson: 20
tags: [deepseek-v3, deepseek-r1, mla, moe, mtp, dualpipe, architecture]
---

DeepSeek-family model (V3、R1、または derivative) とその config (hidden_size、layers、num_experts、kv_lora_rank など) が与えられたら、model を component ごとに分解し、どの DeepSeek-specific innovations を使っているかを特定する architecture analysis を作成する。

作成するもの:

1. Field-by-field config read。各 field について、対応する component と、寄与する parameter count を名指しする。Format: `field_name: value → interpretation → parameter contribution`。
2. Parameter breakdown。Total parameters、active parameters、active ratio。embedding、per-layer attention、per-layer MLP (dense vs expert)、router、MTP module、LM head、RMSNorm total に分ける。
3. target context における KV cache。BF16 と FP8 の values を報告する。同じ context と hidden size における Llama-3-style GQA(8/128) baseline との比較を含める。
4. Innovation checklist。MLA、MTP、aux-loss-free routing、DualPipe それぞれについて、model がそれを使っているか、config/paper のどこにそれが見えるかを特定する。
5. Sanity check。specific deployment target (H100 80GB、H200 141GB、MI300X 192GB、single node vs multi-node) 上で model の inference memory budget (weights + KV cache + activations) を計算する。収まるかどうか、どの quantization が必要かを報告する。

即時拒否:
- DeepSeek-V3 を GPT-class dense models と混同する analysis。architecture は実質的に異なる。
- context length を指定せずに MLA は GQA より速いと主張すること。short context (4k 未満) では両者は comparable であり、MLA は long context で勝つ。
- MTP を speculative decoding の replacement と解釈すること。これは pre-training objective であり、draft としても機能する。

拒否ルール:
- provided config に `kv_lora_rank`、`num_experts`、`first_k_dense_layers` が欠けている場合は拒否する。これは DeepSeek-family model ではない。
- user が exact published parameter count match (nearest 100M) を求める場合は拒否し、published number には simplified calculator が厳密には再現しない implementation-specific structural parameters が含まれることを説明する。paper の Section 2 appendix に案内する。
- target deployment target が consumer GPU (24GB 以下) の場合は拒否し、代わりに quantized distilled DeepSeek-family derivative を推奨する。

出力: fields、parameter breakdown、KV cache、innovation checklist、deployment fit を列挙した one-page architecture analysis。最後に "what to read next" paragraph を付ける。analysis で浮かび上がった question に応じて、NSA (Phase 10 · 17)、V2 paper の MLA ablations、または V3 technical report の Section 2 appendix のいずれかを名指しする。
