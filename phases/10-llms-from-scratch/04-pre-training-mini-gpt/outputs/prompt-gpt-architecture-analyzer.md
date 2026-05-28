---
name: prompt-gpt-architecture-analyzer
description: 任意の GPT 風 transformer モデルにおけるアーキテクチャ選択を分析する
version: 1.0.0
phase: 10
lesson: 4
tags: [gpt, transformer, architecture, attention, kv-cache, scaling, pre-training]
---

# GPT アーキテクチャ分析ガイド

technical report、model card、training log から GPT 風モデルを評価するときは、このフレームワークを使ってアーキテクチャを分解し、設計上のトレードオフを特定してください。

## 分析プロトコル

### 1. パラメータ配分の内訳

各 component の正確なパラメータ数を計算します。

- **Token embeddings**: vocab_size x embed_dim
- **Position embeddings**: max_seq_len x embed_dim
- **Per-block attention**: 4 x embed_dim x embed_dim (Q, K, V, output projections)
- **Per-block FFN**: 2 x embed_dim x ff_dim + embed_dim + ff_dim (two linear layers + biases)
- **Per-block LayerNorm**: 4 x embed_dim (two norms, each with scale + bias)
- **Final LayerNorm**: 2 x embed_dim
- **Output head**: vocab_size x embed_dim (token embeddings と weight-tied している場合は 0)

単一 component が総パラメータの 40% を超える場合はフラグを立てます。小規模モデルでは embedding matrix が支配的です。大規模モデルでは attention と FFN が支配的です。

### 2. Attention 設計の分析

attention configuration を評価します。

- **Head dimension**: embed_dim / num_heads。標準は 64 (GPT-2) または 128 (Llama 3) です。32 未満では head ごとの表現力が制限されます。128 を超えると、利点が少ない割に計算を浪費します。
- **Heads per layer**: head が多いほど多様な attention pattern を持てますが、KV cache のメモリも増えます。
- **Grouped Query Attention (GQA)**: 複数の Q heads で K/V heads を共有していますか？Llama 3 は 32 Q heads に対して 8 KV heads の GQA を使います。これにより KV cache は 4 分の 1 になります。
- **Context length**: 最大 position embeddings。RoPE は訓練長を超える外挿を可能にします。absolute position embeddings は外挿できません。

### 3. メモリ予算

モデルの最大コンテキスト長で推論する場合について計算します。

- **Weights (FP16)**: total_params x 2 bytes
- **KV Cache (FP16)**: 2 x num_layers x num_kv_heads x head_dim x max_seq_len x 2 bytes
- **Activations**: batch_size x seq_len x embed_dim x 2 bytes x num_layers (概算)

KV cache が weight memory を超える場合はフラグを立てます。これは長コンテキストモデル (128K+) で起こり、decode 中にモデルがメモリ律速であることを示します。

### 4. 計算プロファイル

- **Prefill FLOPS per token**: およそ 2 x total_params (parameter ごとに 1 回の matmul、forward pass)
- **Decode FLOPS per token**: prefill と同じですが、単一トークンに対して行います
- **Prefill bottleneck**: 計算律速 (GPU TFLOPS)
- **Decode bottleneck**: メモリ律速 (GPU memory bandwidth)
- **Arithmetic intensity**: アクセスしたメモリ 1 byte あたりの FLOPS。100 未満ならメモリ律速です。

### 5. スケーリング判断

既知の scaling laws と照らして評価します。

- **Chinchilla optimal**: 与えられた計算予算 C に対して、最適なモデルサイズ N とトークン数 D は N ~ D (おおむね同程度のスケーリング) を満たします。7B モデルには約 140B tokens が必要です。
- **Llama 3 overtrained**: Meta は Llama 3 8B を 15T tokens で訓練しました (Chinchilla optimal の 100 倍)。小規模モデルをより多くのデータで過剰訓練すると、token あたりの推論コストが良くなります。
- **Width vs depth**: 同じパラメータ数では、一般に深いモデル (layers が多い) の方が、広いモデル (embed_dim が大きい) より sample-efficient です。

## 危険信号

- **FFN ratio not 4x**: 標準は ff_dim = 4 x embed_dim です。Llama は SwiGLU で 8/3 x embed_dim を使います。逸脱には根拠が必要です。
- **No weight tying**: vocab_size が embed_dim に比べて非常に大きい場合を除き、output head は token embeddings と重みを共有するべきです。
- **No GQA above 13B**: 13B を超えるモデルで grouped-query attention がない場合、KV cache が過剰に大きくなります。
- **No RoPE for long context**: absolute position embeddings は訓練長を超えて外挿できません。32K+ context を狙うモデルでは rotary embeddings を使うべきです。
- **Learning rate too high for model size**: 大規模モデルほど低い peak learning rate が必要です。GPT-2 Small は 6e-4、Llama 3 405B は 8e-5 を使います。

## 出力形式

1. **Parameter Table**: component ごとのパラメータ数と割合
2. **Memory Budget**: 最大コンテキスト長での weights、KV cache、activation memory
3. **Compute Profile**: A100/H100 における prefill と decode のスループット見積もり
4. **Design Assessment**: モデルが正しく選んでいる点と、標準から外れている点
5. **Scaling Verdict**: モデルサイズが訓練データ量に対して適切かどうか
