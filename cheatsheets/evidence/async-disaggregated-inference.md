# Evidence: cheatsheets/async-disaggregated-inference.md

Abbreviations: H = phases/10-llms-from-scratch/22-async-hogwild-inference, M = phases/17-infrastructure-and-production/11-multi-region-kv-locality, D = phases/17-infrastructure-and-production/17-disaggregated-prefill-decode, L = phases/17-infrastructure-and-production/18-vllm-production-stack-lmcache.

## Core ideas (concepts)
- Prefill compute-bound: D/docs/en.md:29
- Decode memory-bandwidth-bound, reads full weights: D/docs/en.md:31
- Hogwild! N workers, one shared cache: H/docs/en.md:27, 35
- Emergent coordination without fine-tuning: H/docs/en.md:50, 183
- RoPE rotations keep shared cache valid: H/docs/en.md:58, 60
- Disaggregation pools, KV transfer: D/docs/en.md:23
- Cache-aware routing on prefix-hash match: M/docs/en.md:31, 114
- KV offloading to CPU DRAM then disk: L/docs/en.md:3

## Four methods side by side (comparison)
- What it does row: H/docs/en.md:27 (Hogwild!), D/docs/en.md:23 (disaggregation), M/docs/en.md:31 (routing), L/docs/en.md:112 (LMCache)
- Wins when row: H/docs/en.md:84, D/docs/en.md:105, M/docs/en.md:45, L/docs/en.md:59
- Loses when row: H/docs/en.md:90, D/docs/en.md:86, M/docs/en.md:54, L/docs/en.md:71
- Number row: H/docs/en.md:78 (1.8x), D/docs/en.md:102 (~6x), M/docs/en.md:85 (80 ms vs 800 ms), L/docs/en.md:57 (3-5% overhead)
- Status row: H/docs/en.md:97 (research April 2026), D/docs/en.md:56 (Dynamo 1.0 GA), D/docs/en.md:67 (llm-d 0.5), M/docs/en.md:33 (vLLM Router), M/docs/en.md:35 (llm-d router), L/docs/en.md:43 (0.11.0 async)

## Disaggregated serving stack (architecture)
- Client node, request in and tokens out: D/docs/en.md:39, 49
- Router node, cache-aware and consumes KV events: L/docs/en.md:31, M/docs/en.md:33
- Prefill pool node, compute-heavy, gets prompt only: D/docs/en.md:42, 45
- Decode pool node, memory-heavy, receives KV over NIXL: D/docs/en.md:44-45
- LMCache node on CPU DRAM + Ceph/S3: L/docs/en.md:49. Unused KV lands in it: L/docs/en.md:76

## One Hogwild! step (flow)
- 1 shared prompt: H/docs/en.md:41
- 2 read the cache: H/docs/en.md:35, 132
- 3 pick a different sub-goal: H/docs/en.md:41, 133; H/code/main.py:61-63
- 4 write one token: H/docs/en.md:35, 134
- 5 order by write arrival, no per-worker index: H/docs/en.md:37
- 6 other workers see it immediately: H/docs/en.md:27

## Cost models in the code (annotated-code)
- expected_speedup: H/code/main.py:124-127
- Amdahl plus coordination: H/docs/en.md:67-68
- ms_disaggregated: D/code/main.py:25-31
- transfer tax: D/docs/en.md:52. faster decode pool: D/code/main.py:13

## Run the simulators (task-table)
- run_hogwild n_workers=1: H/code/main.py:139-140
- run_hogwild n_workers=2: H/code/main.py:150-151
- coordination sweep: H/code/main.py:163
- three routers: M/code/main.py:148
- ms_colocated: D/code/main.py:19, 46
- ms_disaggregated use_rdma=False: D/code/main.py:48
- offload configs: L/code/main.py:113

## Constants in the simulators (defaults)
- CACHE_HIT_MS 80: M/code/main.py:21
- CACHE_MISS_MS 800: M/code/main.py:22
- REPLICAS_PER_REGION 4: M/code/main.py:20. Three regions: M/code/main.py:19
- PREFILL_TOK_PER_MS 40.0 per GPU: D/code/main.py:11
- KV_BYTES_PER_TOKEN_70B_FP8 125_000: D/code/main.py:14
- NIXL_RDMA_GB_S 100: D/code/main.py:15
- NIXL_TCP_GB_S 10: D/code/main.py:16
- KV_BLOCK_TOKENS 16: L/code/main.py:21

## Troubleshooting (troubleshooting)
- 8% hit rate, round-robin ALB: M/docs/en.md:19. Fix cache-aware router: M/docs/en.md:31
- Replica refuses to start, missing tokenizer and quantization config: M/docs/en.md:23. Three-file manifest: M/docs/en.md:71-75
- Short prompts, transfer tax: D/docs/en.md:52, 85
- Same 2K prompt re-prefilled at 100% HBM: L/docs/en.md:19. Fix: L/docs/en.md:23, 47, 66
- 440 ms round-trip, keep regional: M/docs/en.md:54
- Residency: M/docs/en.md:81
- Speedup below 1 without coordination, non-reasoning models: H/docs/en.md:146, 92
- Under 1.3x revert: H/docs/en.md:156

## Use X when (tips)
- Dynamo for a managed stack-above orchestrator: D/docs/en.md:69
- llm-d for Kubernetes-native primitives: D/docs/en.md:69
- Native CPU offload when one engine has HBM pressure: L/docs/en.md:51
- LMCache when many engines share prefixes: L/docs/en.md:51
- Hogwild! on one node only, cross-node latency disaster: H/docs/en.md:93
- Push Hogwild! to N=4 only if two workers give over 1.5x: H/docs/en.md:157

## Q&A (qa)
- 20-80 ms for 4K-prompt KV on 70B FP8: D/docs/en.md:52, 106
- 3x spec decode and 1.8x Hogwild! give 5.4x: H/docs/en.md:159
- prefill_time + network_latency, 440 ms round-trip: M/docs/en.md:54
- 32% DR failures from missing tokenizer/quant configs: M/docs/en.md:64-67, 87
- 20-40% of GPU time wasted: D/docs/en.md:21

## Glossary (glossary)
- NIXL RDMA/InfiniBand or TCP fallback: D/docs/en.md:52, 133
- RTT 75 ms US-EU, 220 ms US-APAC: M/docs/en.md:121
- p parallelizable fraction: H/docs/en.md:185
- c coordination overhead per worker: H/docs/en.md:184
- UCCL llm-d 0.5 networking layer: D/docs/en.md:139
