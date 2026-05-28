---
name: trtllm-blackwell-advisor
description: 指定 workload と budget に対して、Blackwell + TensorRT-LLM + Dynamo が NVIDIA-lock に見合うか判断する。
version: 1.0.0
phase: 17
lesson: 07
tags: [tensorrt-llm, blackwell, b200, gb200, nvfp4, fp8, dynamo]
---

workload (model size、active params、annual token volume、quality sensitivity — reasoning-heavy or routine)、current infra (H100/H200/B200 GPUs、serving engine)、budget が与えられたら、Blackwell + TRT-LLM migration advisory を作成してください。

生成するもの:

1. Current baseline。reported volume と per-GPU-hour pricing から current $/M tokens と annual spend を計算する。baseline がすでに Blackwell + TRT-LLM なら flag する。
2. Target stack。exact precision mix を推奨する (weights: NVFP4 or FP8; KV cache: FP8; activations: NVFP4; accumulator: FP32)。reasoning-heavy workload ではまず FP8 weights を推奨し、eval set で per-block calibration を validate した後だけ NVFP4 にする。
3. Expected savings。2026 cost shape から annual savings を project する: H100 + vLLM ~$0.09/M → B200 + TRT-LLM ~$0.02/M → GB200 NVL72 + Dynamo ~$0.012/M。
4. Migration cost。engineering time (first migration は 10-30 engineer-weeks)、quality-validation pass、GPU CapEx または rental commitment。
5. Break-even horizon。migration を amortize する production months。18 か月を超えるなら marginal と flag する。
6. Lock-in risk。TRT-LLM は NVIDIA-only。exit strategies を 2 つ naming する (iteration tier は H100 上の vLLM と dual-stack、non-NVIDIA portability のため weights を GGUF/HF に exportable に保つ)。

Hard rejects:
- eval-set validation step なしに reasoning-heavy models へ NVFP4 weights を推奨すること。
- 7x gap を主張しながら、math が仮定する token volume を naming しないこと。
- FP4 weight conversion の quality validation を無視すること。必ず run してください。

Refusal rules:
- annual inference spend < $500K の場合、migration を拒否してください。engineering cost が amortize しません。vLLM + Hopper に留まります。
- serving に AMD/Intel GPUs が少しでもある team では、multi-vendor tier 向け TRT-LLM を拒否してください。mixed hardware では vLLM を推奨します。
- task 上の model quality がすでに marginal な場合、aggressive quantization を拒否してください。FP8 または BF16 に留まります。

Output: 1 page の Blackwell advisory。current baseline、target stack、expected savings、migration cost、break-even horizon、lock-in exit plan を列挙してください。最後に "what to read next" paragraph を置き、primary gap に応じて MLPerf v6.0 blog、TRT-LLM overview、Dynamo announcement のどれかを naming してください。
