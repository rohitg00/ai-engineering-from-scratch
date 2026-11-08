# Evidence: cheatsheets/serving-engines-compared.md

Abbreviations: P17 = phases/17-infrastructure-and-production. L04 = P17/04-vllm-serving-internals, L06 = P17/06-sglang-radixattention, L07 = P17/07-tensorrt-llm-blackwell, L18 = P17/18-vllm-production-stack-lmcache, L28 = P17/28-self-hosted-serving-selection. d = docs/en.md, c = code/main.py.

## Engines side by side (comparison)
- Core idea vLLM three defaults: L04/d:3. SGLang RadixAttention, cache-aware scheduler: L06/d:3, 113-115. TRT-LLM NVFP4 weights, FP8 KV, MTP: L07/d:3, 35-37. llama.cpp fastest on CPU, widest support: L28/d:3, 29
- Scheduling V1 scheduler: L04/d:45. FCFS as vLLM schedules: L06/d:3. Depth-first, branch-level LRU: L06/d:48-49. Disaggregated prefill/decode: L07/d:44. Full control over threading: L28/d:3
- Hardware vLLM AMD ROCm: L28/d:39. SGLang also works on AMD: L28/d:39. TRT-LLM NVIDIA only: L28/d:123, L07/d:65. Apple Silicon Metal: L28/d:45
- 2,200-2,400 tok/s: L04/d:65. ~16,200 vs ~12,500: L06/d:55. $0.012/M on GB200 NVL72: L07/d:51. Ollama 15-30% slower: L28/d:30
- HF safetensors, GGUF: L28/d:77. Compiled per GPU SKU: L07/d:65
- Weak spots: prefix-heavy default to SGLang: L06/d:87. Unique prompts back to vLLM level: L06/d:77-79. No AMD, no Intel, no ARM: L07/d:65. Prod stage is vLLM: L28/d:77

## Use each engine when (concepts)
- vLLM general chat, 100+ users: L28/d:32, 59. AMD or mixed hardware: L28/d:39, L07/d:65
- SGLang agents, RAG, long system prompts: L06/d:71-74, L28/d:61-63
- TRT-LLM NVIDIA-only, cost-dominant on Blackwell: L07/d:65, 69
- llama.cpp CPU, edge, Apple Silicon: L28/d:29, 37, 45
- Ollama dev laptop, not shared production: L28/d:30, 81
- TGI maintenance mode Dec 11, 2025, existing deployments: L28/d:71-73
- Native CPU offload, one engine with HBM pressure: L18/d:51
- LMCache, several engines share prefixes: L18/d:51. Preemption-heavy: L18/d:66

## The vLLM scheduler loop (annotated-code)
- loop lines: L04/d:74-91 (blank line and full-line comment at L04/d:83 left out)
- 512 tokens, 1 token, one fused GPU call comments: L04/d:87, 89, 91

## One request in the radix tree (flow)
1. system prompt plus doc A plus Question: Carol: L06/d:42
2. 124 blocks reused: L06/d:42
3. 31 blocks reused: L06/d:42
4. 4 blocks for Question: Carol: L06/d:42
5. 160 blocks, ~40x savings: L06/d:42
6. evict whole branches from shortest-used leaves: L06/d:49

## Production stack (architecture, 7 nodes, 6 edges)
- Client node, requests into the stack (closest line, request path): L18/d:3
- Router cache-aware, KV events: L18/d:31
- Engines one per GPU or TP/PP group: L18/d:32
- Connector API v0.9.0+, async 0.11.0: L18/d:41, 43
- LMCache server, CPU DRAM, shared: L18/d:49
- Ceph/S3 tier, disk below DRAM: L18/d:49, 116
- Observability Prometheus, Grafana, OTel: L18/d:34

## Precision and stack economics in main.py (comparison)
- HBM per GB row (80, 80, 192, 192): L07/c:22, 32-36
- HBM bandwidth TB/s row (3.35, 3.35, 8.00, 8.00): L07/c:23, 32-36
- Weight bits row (16, 8, 4, 4): L07/c:24, 32-36
- KV cache bits row (16, 8, 8, 8): L07/c:25, 32-36
- MTP factor row (1.0, 1.0, 1.8, 1.8): L07/c:26, 32-36
- Disaggregation factor row (1.0, 1.0, 1.6, 2.5): L07/c:27, 32-36
- Price per GPU hour row (2.50, 2.50, 4.80, 6.20): L07/c:28, 32-36

## Run the simulators (task-table)
- simulate_static(reqs, batch=16): L04/c:98
- simulate_continuous(reqs, chunked: bool): L04/c:124
- simulate(requests, scheduler), CACHE_AWARE: L06/c:87, 90
- workload_scrambled(n=80, docs=4): L06/c:132
- hbm_footprint_gb(params_b, active_b, seq_len, stack): L07/c:40
- cost_per_million_tokens(active_b, stack): L07/c:60
- simulate(config, reqs), LMCACHE: L18/c:41, 69
- pick_engine(hardware, scale, workload): L28/c:9

## Troubleshooting (troubleshooting)
- long prompt freezes decode, chunked prefill, P99 ITL ~50 to ~15 ms: L04/d:49-51, 69
- 7% to 74% by moving dynamic content: L06/d:65-67, L06/c:170
- 6.4x needs consistent template order: L06/d:63
- HBM 100% with preemptions, re-prefill: L18/d:19. Native offload or LMCache: L18/d:47-51
- ~3-5% overhead at low footprint, do not enable: L18/d:57, 70, 83
- FP4 weights degrade reasoning, FP8 weights plus FP4 activations: L07/d:59
- KV to FP4 collapses attention, KV in FP8: L07/d:29, 37
- compatibility matrix per version: L04/d:61

## Q&A (qa)
- FCFS evicts the long branch: L06/d:25, 51
- chunked prefill protects TTFT tail: L04/d:14, 47
- 7x from bandwidth, NVFP4, MTP, disaggregation: L07/c:93-97
- under 1K tokens transfer > re-prefill: L18/d:71
- no flag, only allocator: L04/d:33
- vLLM --enable-prefix-caching, SGLang radix-first: L06/d:87

## Glossary (glossary)
- ITL: L04/d:132
- TTFT: L04/d:131
- FCFS: L06/d:117
- NVFP4: L07/d:100
- MTP: L07/d:103
- MXFP8: L07/d:101
- Connector API: L18/d:110
- Preemption: L18/d:114
