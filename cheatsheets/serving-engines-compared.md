---
id: serving-engines-compared
title: Serving Engines Compared
code: SN
subtitle: vLLM, SGLang, TRT-LLM and llama.cpp side by side. Schedulers, KV reuse, precision, offload and the pick.
hue: 262
sources: phases/17-infrastructure-and-production/04-vllm-serving-internals, phases/17-infrastructure-and-production/06-sglang-radixattention, phases/17-infrastructure-and-production/07-tensorrt-llm-blackwell, phases/17-infrastructure-and-production/18-vllm-production-stack-lmcache, phases/17-infrastructure-and-production/28-self-hosted-serving-selection
source_hash: b662bf5b651f8306
---

## Engines side by side
type: comparison
span: 2
from: phases/17-infrastructure-and-production/04-vllm-serving-internals, phases/17-infrastructure-and-production/06-sglang-radixattention, phases/17-infrastructure-and-production/07-tensorrt-llm-blackwell, phases/17-infrastructure-and-production/28-self-hosted-serving-selection

| Factor | vLLM | SGLang | TRT-LLM | llama.cpp |
|---|---|---|---|---|
| Core idea | PagedAttention, continuous batching, chunked prefill | RadixAttention, cache-aware scheduler | NVFP4 weights, FP8 KV, MTP | Fastest on CPU, widest model support |
| Scheduling | V1 scheduler, FCFS | Depth-first dispatch, branch-level LRU | Disaggregated prefill/decode | Full control over threading |
| Hardware | NVIDIA, AMD ROCm | NVIDIA, AMD | NVIDIA only, Blackwell | CPU, Apple Silicon Metal |
| Headline number | 2,200-2,400 tok/s, 70B FP8, H100 | ~16,200 vs ~12,500 tok/s on 8B | $0.012/M tokens on GB200 NVL72 | Ollama is 15-30% slower |
| Weight format | HF safetensors | HF safetensors | Compiled per GPU SKU | GGUF |
| Weak spot | Prefix-heavy traffic | Unique prompts, back to vLLM level | No AMD, no Intel, no ARM | Not the prod stage of the pipeline |

## Use each engine when
type: concepts
from: phases/17-infrastructure-and-production/28-self-hosted-serving-selection, phases/17-infrastructure-and-production/06-sglang-radixattention, phases/17-infrastructure-and-production/07-tensorrt-llm-blackwell, phases/17-infrastructure-and-production/18-vllm-production-stack-lmcache

- **vLLM**: general chat, 100+ users, AMD GPUs or mixed hardware.
- **SGLang**: agents, RAG and chat that share long prefixes.
- **TRT-LLM**: NVIDIA-only infra and cost-dominant work on Blackwell.
- **llama.cpp**: CPU, edge or Apple Silicon.
- **Ollama**: one user on a dev laptop. Not shared production.
- **TGI**: existing deployments only. Maintenance mode since Dec 11, 2025.
- **Native CPU offload**: one engine has HBM pressure.
- **LMCache**: several engines share prefixes, or preemption is heavy.

## The vLLM scheduler loop
type: annotated-code
lang: python
from: phases/17-infrastructure-and-production/04-vllm-serving-internals/docs/en.md

```python
while True:
    finished = [s for s in RUNNING if s.is_done()]
    for s in finished: release_blocks(s); RUNNING.remove(s)  # free blocks
    while WAITING and have_free_blocks_for(WAITING[0]):  # admit on free KV
        s = WAITING.pop(0)
        allocate_initial_blocks(s)
        RUNNING.append(s)
    batch = []
    for s in RUNNING:
        if s.in_prefill:
            batch.append(next_prefill_chunk(s))  # e.g. 512 tokens
        else:
            batch.append(decode_one_token(s))  # 1 token
    run_forward(batch)  # one fused GPU call
```

## One request in the radix tree
type: flow
from: phases/17-infrastructure-and-production/06-sglang-radixattention/docs/en.md

1. **Request**: system prompt plus "Context: <doc A>" plus "Question: Carol".
2. **Scheduler**: walks the tree. The system prefix matches, 124 blocks reused.
3. **Scheduler**: the doc A branch matches, 31 blocks reused.
4. **Allocator**: gives fresh blocks only to "Question: Carol", 4 blocks.
5. **Result**: prefill of 4 blocks, not 160. About 40x less prefill.
6. **Eviction**: removes whole branches from the shortest-used leaves.

## Production stack
type: architecture
from: phases/17-infrastructure-and-production/18-vllm-production-stack-lmcache/docs/en.md

```arch
node | client | 1,1 | Client | requests | client
node | router | 2,1 | Router | cache-aware, KV events | process
node | eng | 3,1 | vLLM engines | one per GPU or TP/PP group | gpu
node | conn | 3,2 | Connector API | v0.9.0+, async in 0.11.0 | process
node | lmc | 2,2 | LMCache server | CPU DRAM, shared | store
node | ceph | 1,2 | Ceph/S3 tier | disk below DRAM | store
node | obs | 3,3 | Observability | Prometheus, Grafana, OTel | process
edge | client | router | HTTP
edge | router | eng | route
edge | eng | conn | offload
edge | conn | lmc | store
edge | lmc | ceph | spill
edge | eng | obs | scrape
```

## Precision and stack economics in main.py
type: comparison
span: 2
from: phases/17-infrastructure-and-production/07-tensorrt-llm-blackwell

| Factor | H100 + BF16 + vLLM | H100 + FP8 + vLLM | B200 + NVFP4 + FP8 + TRT-LLM | GB200 NVL72 + TRT-LLM + Dyn |
|---|---|---|---|---|
| HBM per GPU, GB | 80 | 80 | 192 | 192 |
| HBM bandwidth, TB/s | 3.35 | 3.35 | 8.00 | 8.00 |
| Weight bits | 16 | 8 | 4 | 4 |
| KV cache bits | 16 | 8 | 8 | 8 |
| MTP factor | 1.0 | 1.0 | 1.8 | 1.8 |
| Disaggregation factor | 1.0 | 1.0 | 1.6 | 2.5 |
| Price per GPU hour | 2.50 | 2.50 | 4.80 | 6.20 |

## Run the simulators
type: task-table
from: phases/17-infrastructure-and-production/04-vllm-serving-internals/code/main.py, phases/17-infrastructure-and-production/06-sglang-radixattention/code/main.py, phases/17-infrastructure-and-production/07-tensorrt-llm-blackwell/code/main.py, phases/17-infrastructure-and-production/18-vllm-production-stack-lmcache/code/main.py, phases/17-infrastructure-and-production/28-self-hosted-serving-selection/code/main.py

| Task | Code |
|---|---|
| Static batching | `simulate_static(reqs, batch=16)` |
| Continuous plus chunked | `simulate_continuous(reqs, chunked=True)` |
| Cache-aware radix order | `simulate(requests, "CACHE_AWARE")` |
| Scrambled prefix order | `workload_scrambled(n=80, docs=4)` |
| HBM footprint per stack | `hbm_footprint_gb(params_b, active_b, seq_len, stack)` |
| Cost per million tokens | `cost_per_million_tokens(active_b, stack)` |
| LMCache under HBM pressure | `simulate("LMCACHE", reqs)` |
| Engine for your constraints | `pick_engine(hardware, scale, workload)` |

## Troubleshooting
type: troubleshooting
from: phases/17-infrastructure-and-production/04-vllm-serving-internals, phases/17-infrastructure-and-production/06-sglang-radixattention, phases/17-infrastructure-and-production/07-tensorrt-llm-blackwell, phases/17-infrastructure-and-production/18-vllm-production-stack-lmcache

| Symptom | Cause | Fix |
|---|---|---|
| Decode stalls during a long prompt | Prefill freezes decode | Chunked prefill. P99 ITL ~50 ms to ~15 ms |
| Hit rate 7% on shared prompts | Dynamic content in the prefix | Immutable parts first. 7% to 74% |
| 6.4x gain gone | Template order changes per request | Fix one component order |
| HBM 100%, same prompt prefilled again | Preemption evicts KV | Native CPU offload or LMCache |
| 3-5% slower with LMCache | Small HBM pressure | Turn LMCache off |
| Accuracy drops after NVFP4 | FP4 weights on reasoning tasks | FP8 weights plus FP4 activations |
| Attention collapses at FP4 KV | KV needs dynamic range | Keep KV cache in FP8 |
| Features break together | Combination not in the matrix | Check the matrix for your version |

## Q&A
type: qa
from: phases/17-infrastructure-and-production/04-vllm-serving-internals, phases/17-infrastructure-and-production/06-sglang-radixattention, phases/17-infrastructure-and-production/07-tensorrt-llm-blackwell, phases/17-infrastructure-and-production/18-vllm-production-stack-lmcache

- **Why is FCFS wrong for prefix traffic?** It evicts the hot branch to admit a short-prefix request.
- **What does chunked prefill protect?** The TTFT tail and ITL, not mean throughput.
- **Where does the 7x TRT-LLM gap come from?** HBM bandwidth, NVFP4 weights, MTP and disaggregation.
- **LMCache for prompts under 1K tokens?** No. Transfer time is more than re-prefill.
- **Do you enable PagedAttention?** No flag. It is the only allocator vLLM ships.
- **Does vLLM reuse prefixes?** Yes, with `--enable-prefix-caching`. SGLang is radix-first.

## Glossary
type: glossary
from: phases/17-infrastructure-and-production/04-vllm-serving-internals, phases/17-infrastructure-and-production/06-sglang-radixattention, phases/17-infrastructure-and-production/07-tensorrt-llm-blackwell, phases/17-infrastructure-and-production/18-vllm-production-stack-lmcache

- **ITL**: inter-token latency. Time between two decode tokens.
- **TTFT**: first token time. Prefill plus queue plus network.
- **FCFS**: first-come first-served. Breaks prefix locality.
- **NVFP4**: NVIDIA 4-bit microscaling format for weights and activations.
- **MTP**: multi-token prediction. TRT-LLM integrated draft.
- **MXFP8**: microscaling FP8 variant on Blackwell Tensor Cores.
- **Connector API**: vLLM 0.9.0+ pluggable KV store interface.
- **Preemption**: KV cache shuffle when HBM is full.
