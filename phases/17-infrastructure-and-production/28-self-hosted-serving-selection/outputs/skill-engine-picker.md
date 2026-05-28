---
name: engine-picker
description: hardware、scale、workload に基づき self-hosted LLM engine を選ぶ。2026 年の TGI maintenance mode を migration trigger として扱う。
version: 1.0.0
phase: 17
lesson: 28
tags: [self-hosted, vllm, sglang, llama-cpp, ollama, tgi, trt-llm, engine-selection]
---

hardware (CPU / Apple Silicon / AMD / NVIDIA Hopper / NVIDIA Blackwell)、scale (single-user / small team / production / enterprise)、workload (general chat / agentic / RAG / long-context / code) を受け取り、engine recommendation を作成する。

作成するもの:

1. Engine。specific engine を挙げる。hardware-first、scale-second、workload-third tree を引用する。
2. Why not the alternatives。各 alternative engine について、選ばない理由を述べる (TGI maintenance mode、AMD excludes TRT-LLM、Ollama is dev-only)。
3. Pipeline。production の場合、pipeline pattern (dev Ollama → staging llama.cpp → prod vLLM/SGLang) を挙げ、weight format (GGUF または HF) が流用できることを確認する。
4. Production stacking。production scale では、composition として Phase 17 · 18 (production-stack)、· 17 (disaggregated)、· 11 (cache-aware router) を指す。
5. TGI migration。incumbent が TGI なら、migration plan と timeline を指定する。urgent ではないが、6 か月以内に始めるべき。
6. Hardware gotcha。2 つの hard constraints を明示する: CPU-only → llama.cpp、AMD → no TRT-LLM。

強い拒否条件:
- 2026 年の new projects で TGI を default にすること。拒否する。maintenance mode。
- >1 concurrent user の shared production に Ollama を使うこと。拒否する。throughput gap がある。
- NVIDIA-only を確認せず TRT-LLM を提案すること。拒否する。AMD / non-NVIDIA は hard block。

拒否ルール:
- hardware が mixed (AMD と NVIDIA が混在) の場合、per-cluster engine decisions を必須にする。単一 engine を強制しない。
- workload が production scale で「unknown/general」の場合、vLLM を default にし、3 か月の traffic data 後に re-evaluation を計画する。
- team が「Blackwell availability なしで fastest per GPU」を望み、Hopper-only にこだわる場合は確認する。TRT-LLM と vLLM はどちらも acceptable。

出力: engine、alternatives dismissed、pipeline、production stacking、TGI migration posture を含む 1 ページ recommendation。最後は single quarterly review で締める: workload shape が大きく変わったら engine choice を re-evaluate する。
