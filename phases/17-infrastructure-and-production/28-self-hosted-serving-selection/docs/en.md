# Self-Hosted Serving Selection — llama.cpp, Ollama, TGI, vLLM, SGLang

> Four engines dominate self-hosted inference in 2026. Pick based on hardware, scale, and ecosystem. **llama.cpp** is fastest on CPU — widest model support, full control over quantization and threading. **Ollama** is the dev-laptop one-command install, ~15-30% slower than llama.cpp (Go + CGo + HTTP serialization), 3x throughput gap under prod-like load. **TGI entered maintenance mode December 11, 2025** — only bug fixes, ~10% slower raw throughput than vLLM but historically top observability and HF-ecosystem integration. That maintenance status makes it a risky long-term bet — SGLang or vLLM are safer defaults for new projects. **vLLM** is the general-purpose production default — v0.15.1 (February 2026) adds PyTorch 2.10, RTX Blackwell SM120, H200 optimization. **SGLang** is the agentic multi-turn / prefix-heavy specialist — 400,000+ GPUs in production (xAI, LinkedIn, Cursor, Oracle, GCP, Azure, AWS). Hardware constraints: CPU-only → llama.cpp only. AMD / non-NVIDIA → vLLM only (TRT-LLM is NVIDIA-locked). 2026 pipeline pattern: dev = Ollama, staging = llama.cpp, prod = vLLM or SGLang. Same GGUF/HF weights throughout.

**Type:** Learn
**Languages:** Python (stdlib, engine-decision tree walker)
**Prerequisites:** All Phase 17 lessons covering engines (04, 06, 07, 09, 18)
**Time:** ~45 minutes

## Learning Objectives

- Pick an engine given hardware (CPU / AMD / NVIDIA Hopper / Blackwell), scale (1 user / 100 / 10,000), and workload (general chat / agent / long-context).
- Name the 2026 TGI maintenance-mode status (December 11, 2025) and why it biases new projects toward vLLM or SGLang.
- Describe the dev/staging/prod pipeline using the same GGUF or HF weights throughout.
- Explain why "CPU only" forces llama.cpp and "AMD" excludes TRT-LLM.

## The Problem

Your team starts a new self-hosted LLM project. One engineer says Ollama, another says vLLM, a third says "doesn't TGI just work out of the box?" All three are right for different contexts. None is right for all.

In 2026 the choice tree matters: hardware first, scale second, workload third. And one specific 2025 event — TGI entering maintenance mode December 11 — changes the default for new projects.

## The Concept

### The five engines

| Engine | Best for | Notes |
|--------|----------|-------|
| **llama.cpp** | CPU / edge / minimal deps / widest model support | Fastest on CPU, full control |
| **Ollama** | Dev laptops, single user, one-command install | 15-30% slower than llama.cpp; 3x prod throughput gap |
| **TGI** | HF ecosystem, regulated industries | **Maintenance mode Dec 11, 2025** |
| **vLLM** | General-purpose production, 100+ users | Broad production default; v0.15.1 Feb 2026 |
| **SGLang** | Agentic multi-turn, prefix-heavy workloads | 400,000+ GPUs in production |

### Hardware-first decision

**CPU only** → llama.cpp. Ollama works too but is slower. No other engine is competitive on CPU.

**AMD GPU** → vLLM (AMD ROCm support). SGLang also works. TRT-LLM is NVIDIA-locked, so it's out.

**NVIDIA Hopper (H100 / H200)** → vLLM or SGLang or TRT-LLM. All three top-tier.

**NVIDIA Blackwell (B200 / GB200)** → TRT-LLM is the throughput leader (Phase 17 · 07). vLLM and SGLang follow close.

**Apple Silicon (M-series)** → llama.cpp (Metal). Ollama wraps this.

### Scale-second decision

**1 user / local dev** → Ollama. One command, first-token in seconds.

**10-100 users / small team** → vLLM single-GPU.

**100-10k users / production** → vLLM production-stack (Phase 17 · 18) or SGLang.

**10k+ users / enterprise** → vLLM production-stack + disaggregated (Phase 17 · 17) + LMCache (Phase 17 · 18).

### Workload-third decision

**General chat / Q&A** → vLLM wins on broad default.

**Agentic multi-turn (tools, planning, memory)** → SGLang's RadixAttention (Phase 17 · 06) dominates.

**RAG with heavy prefix reuse** → SGLang.

**Code generation** → vLLM fine; SGLang slightly better on cache.

**Long context (128K+)** → vLLM + chunked prefill; SGLang + tiered KV.

### The TGI maintenance trap

Hugging Face TGI entered maintenance mode December 11, 2025 — only bug fixes going forward. Historically: top-tier observability, best-in-class HF-ecosystem integration (model cards, safety tools), slightly behind vLLM on raw throughput.

For new projects in 2026: default away from TGI. Existing TGI deployments can continue but should migrate eventually. SGLang and vLLM are the safer defaults.

### The pipeline pattern

Dev (Ollama) → staging (llama.cpp) → prod (vLLM). Same GGUF or HF weights throughout. Engineers iterate quickly on laptops; staging mirrors production quantization; prod is the serving target.

### Ollama caveat

Ollama is great for dev. It is not great for shared production: Go HTTP serialization adds overhead, concurrency management is simpler than vLLM, OpenTelemetry support lags. Use Ollama where it shines — one user, one command — and switch to vLLM for shared.

### Self-hosted vs managed is a separate decision

Phase 17 · 01 (managed hyperscalers), · 02 (inference platforms) cover managed. This lesson assumes you've already decided to self-host. Reasons to self-host: data residency, custom fine-tune, total cost ownership at scale, domain model not available on hosted.

### Numbers you should remember

- TGI maintenance mode: December 11, 2025.
- vLLM v0.15.1: February 2026; PyTorch 2.10; Blackwell SM120 support.
- SGLang production footprint: 400,000+ GPUs.
- Ollama throughput gap vs llama.cpp: 15-30% slower; 3x under prod load.

## Use It

`code/main.py` is a decision-tree walker: given hardware + scale + workload, picks an engine and explains why.

## Ship It

This lesson produces `outputs/skill-engine-picker.md`. Given constraints, picks an engine and writes the migration plan.

## Exercises

1. Run `code/main.py` with your hardware / scale / workload. Does the output match your intuition?
2. Your infra is 12 H100s and 8 MI300X AMD. What engine? Why is TRT-LLM off the table?
3. A team wants to use TGI in 2026 because "it's what we know." Argue the migration case.
4. Ollama dev to vLLM prod: what changes in quantization, configuration, and observability?
5. RAG product with P99 prefix length 8K and high reuse across tenants. Pick an engine and stack it with Phase 17 · 11 + 18.

## Key Terms

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| llama.cpp | "the CPU one" | Widest model support, fastest on CPU |
| Ollama | "the laptop one" | One-command install, dev-grade throughput |
| TGI | "HF's serving" | Maintenance mode since Dec 2025 |
| vLLM | "the default" | Broad production baseline 2026 |
| SGLang | "the agentic one" | Prefix-heavy, RadixAttention |
| TRT-LLM | "NVIDIA-locked" | Blackwell throughput leader, NVIDIA only |
| GGUF | "llama.cpp format" | Bundled K-quant variants |
| Production-stack | "vLLM K8s" | Phase 17 · 18 reference deployment |
| Pipeline pattern | "dev→stage→prod" | Ollama → llama.cpp → vLLM on same weights |

## Further Reading

- [AI Made Tools — vLLM vs Ollama vs llama.cpp vs TGI 2026](https://www.aimadetools.com/blog/vllm-vs-ollama-vs-llamacpp-vs-tgi/)
- [Morph — llama.cpp vs Ollama 2026](https://www.morphllm.com/comparisons/llama-cpp-vs-ollama)
- [n1n.ai — Comprehensive LLM Inference Engine Comparison](https://explore.n1n.ai/blog/llm-inference-engine-comparison-vllm-tgi-tensorrt-sglang-2026-03-13)
- [PremAI — 10 Best vLLM Alternatives 2026](https://blog.premai.io/10-best-vllm-alternatives-for-llm-inference-in-production-2026/)
- [TGI maintenance announcement](https://github.com/huggingface/text-generation-inference) — release notes.
- [vLLM v0.15.1 release notes](https://github.com/vllm-project/vllm/releases)
