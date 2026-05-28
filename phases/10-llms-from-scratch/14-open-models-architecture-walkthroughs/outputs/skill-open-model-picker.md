---
name: open-model-picker
description: deployment target に合わせて open LLM family、quantization、inference stack を選ぶ
version: 1.0.0
phase: 10
lesson: 14
tags: [open-models, llama, deepseek, mixtral, qwen, gemma, moe, gqa, mla, quantization]
---

deployment target (GPU type、GPU あたりの VRAM、GPU 数、target context length、target p50/p99 latency、peak concurrent requests) と task profile (chat、code、reasoning、long-context retrieval、tool use) が与えられたら、Lesson 14 の 6つの architectural knobs それぞれについて明示的に reasoning しながら、open model と serving stack を recommendation してください。

作成内容:

1. Model shortlist。3つの candidates。それぞれについて total params、active params (MoE-aware)、architecture flags (norm / activation / position / attention / MoE / context)、shortlist に入った single reason を示す。
2. Memory budget check。top candidate について、BF16 と chosen quantization での weight memory、target batch size における target context の KV cache、activation headroom を確認する。weights + KV cache + activations が available VRAM を超える場合は recommendation を halt する。
3. Quantization choice。GPTQ-4bit、AWQ-4bit、FP8、または BF16。task の accuracy sensitivity に照らして justify する (code / math / reasoning tasks は chat や retrieval より aggressive quantization の影響が大きい)。
4. Inference stack。vLLM、TensorRT-LLM、SGLang、または llama.cpp。continuous batching の必要性、speculative decoding support、quantization format compatibility、single-node vs multi-node topology に照らして justify する。
5. Throughput sanity check。GPU memory bandwidth (decode) と TFLOPs (prefill) に基づいて prefill tokens/sec と decode tokens/sec を estimate する。decode throughput が target の concurrent-user floor を下回る場合は recommendation を reject する。
6. Fallback。top candidate が VRAM または throughput budget を超える場合の second choice。必ず 1つ name する。

Hard reject 条件:
- offloading や aggressive quantization なしで、単一 24GB consumer GPU 上の 30B 超 dense models。
- expert-parallel support のない serving stack 上の MoE models。
- GQA または MLA のない architecture での long-context (128k+) (KV cache が explode する)。
- specific model revision を name しない recommendation (例: "Llama 3" ではなく "Llama 3 8B Instruct v3.1")。

出力: model、quantization、stack を list し、各 decision について numbered evidence を付けた 1ページの recommendation。最後に、choice を flip する specific capability または deployment parameter を挙げた "worth reconsidering if..." paragraph を付ける。
