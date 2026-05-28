---
name: mha-configurator
description: 新しい transformer に対して head count、KV-head count、projection strategy（MHA / MQA / GQA / MLA）を推奨する。
version: 1.0.0
phase: 7
lesson: 3
tags: [transformers, attention, mha, gqa]
---

Transformer 仕様（パラメータ予算、hidden size `d_model`、target context length、inference device memory、training vs inference priority）が与えられたら、次を出力してください。

1. Projection variant。次のいずれか: MHA、GQA、MQA、MLA。KV-cache 制約に結びつけた 1 文の理由。
2. Head geometry。`n_heads`、`n_kv_heads`、`d_head`。値は `d_model = n_heads * d_head` と `n_heads % n_kv_heads == 0` を満たす必要がある。
3. KV cache estimate。対象 context length における、選択した variant の 1 token 1 layer あたりのバイト数（fp16）。1 batch が対象デバイスメモリを超える場合は明示する。
4. Initialization。Q, K, V, O 行列に対する Xavier / Kaiming scale。bias term を含むかどうかも述べる（2026 年の多くのモデルでは省かれる）。
5. Testability hook。この config の学習済み 2 層版が 95% 以上で解けるべき単一の synthetic task（例: induction-head pattern `A B A ? → B`）。

`d_head < 32` は推奨してはいけません。attention dynamics が破綻します。32K を超える context length に対して `n_heads > 16` の MHA を推奨する場合は、KV cache のコストを明示し、代わりに GQA または MLA を提案しなければなりません。ユーザーが明示的にベンチマークしている場合を除き、1B パラメータ未満のモデルに MLA を提案してはいけません。
