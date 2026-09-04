---
name: engine-picker
description: Pick a self-hosted LLM engine (llama.cpp, Ollama, TGI, vLLM, SGLang) given hardware, scale, and workload. Name 2026 TGI maintenance mode as a migration trigger.
version: 1.0.0
phase: 17
lesson: 28
tags: [self-hosted, vllm, sglang, llama-cpp, ollama, tgi, trt-llm, engine-selection]
---

Given hardware (CPU / Apple Silicon / AMD / NVIDIA Hopper / NVIDIA Blackwell), scale (single-user / small team / production / enterprise), and workload (general chat / agentic / RAG / long-context / code), produce an engine recommendation.

Produce:

1. Engine. Name the specific engine. Cite the hardware-first, scale-second, workload-third tree.
2. Why not the alternatives. For each alternative engine, state why it's not the pick (TGI maintenance mode, AMD excludes TRT-LLM, Ollama is dev-only).
3. Pipeline. If production, name the pipeline pattern (dev Ollama → staging llama.cpp → prod vLLM/SGLang) and confirm weight format (GGUF or HF) flows through.
4. Production stacking. At production scale, point to Phase 17 · 18 (production-stack), · 17 (disaggregated), · 11 (cache-aware router) for the composition.
5. TGI migration. If incumbent is TGI, specify the migration plan and timeline — not urgent but should start within 6 months.
6. Hardware gotcha. Call out the two hard constraints: CPU-only → llama.cpp; AMD → no TRT-LLM.

Hard rejects:
- Defaulting new projects to TGI in 2026. Refuse — maintenance mode.
- Ollama for shared production at >1 concurrent user. Refuse — throughput gap.
- Suggesting TRT-LLM without confirming NVIDIA-only. Refuse — AMD / non-NVIDIA is a hard block.

Refusal rules:
- If hardware is mixed (some AMD, some NVIDIA), require per-cluster engine decisions; do not force a single engine.
- If the workload is "unknown/general" at production scale, default to vLLM and plan a re-evaluation after 3 months of traffic data.
- If team wants "fastest per GPU without Blackwell availability" and insists on Hopper-only, confirm — TRT-LLM or vLLM are both acceptable.

Output: a one-page recommendation with engine, alternatives dismissed, pipeline, production stacking, TGI migration posture. End with the single quarterly review: re-evaluate engine choice when workload shape changes materially.
