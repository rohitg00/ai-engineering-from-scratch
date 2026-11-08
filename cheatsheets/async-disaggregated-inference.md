---
id: async-disaggregated-inference
title: Async, Hogwild and Disaggregated Inference
code: AD
subtitle: Share, split, route and offload the KV cache. Formulas, crossover numbers and the cases where each method loses.
hue: 170
sources: phases/10-llms-from-scratch/22-async-hogwild-inference, phases/17-infrastructure-and-production/11-multi-region-kv-locality, phases/17-infrastructure-and-production/17-disaggregated-prefill-decode, phases/17-infrastructure-and-production/18-vllm-production-stack-lmcache
source_hash: 72cc74e8fb23f65f
---

## Core ideas
type: concepts
from: phases/10-llms-from-scratch/22-async-hogwild-inference/docs/en.md, phases/17-infrastructure-and-production/17-disaggregated-prefill-decode/docs/en.md, phases/17-infrastructure-and-production/11-multi-region-kv-locality/docs/en.md, phases/17-infrastructure-and-production/18-vllm-production-stack-lmcache/docs/en.md

- **Prefill**: one forward over the full prompt. Compute-bound.
- **Decode**: one token at a time. Reads all weights. Memory-bandwidth-bound.
- **Hogwild!**: N copies of one LLM write to one shared KV cache.
- **Emergent coordination**: reasoning models divide the work with no fine-tuning.
- **RoPE**: positions are rotations, so shared cache entries stay valid.
- **Disaggregation**: prefill pool and decode pool. KV moves between them.
- **Cache-aware routing**: send the request to the replica that holds its prefix.
- **KV offloading**: KV cache leaves the GPU for CPU DRAM, then disk.

## Four methods side by side
type: comparison
span: 2
from: phases/10-llms-from-scratch/22-async-hogwild-inference/docs/en.md, phases/17-infrastructure-and-production/17-disaggregated-prefill-decode/docs/en.md, phases/17-infrastructure-and-production/11-multi-region-kv-locality/docs/en.md, phases/17-infrastructure-and-production/18-vllm-production-stack-lmcache/docs/en.md

| Factor | Hogwild! | Disaggregation | Cache-aware routing | LMCache |
|---|---|---|---|---|
| What it does | N workers, one shared KV cache | Prefill and decode on separate pools | Route on prefix-hash match | Cross-engine KV on CPU DRAM + disk |
| Wins when | Long reasoning, high p | Prompts >512 tokens + outputs >200 tokens | Prefixes repeat across replicas | KV exceeds HBM |
| Loses when | Short interactive chat | Small cluster (< 4 GPUs) | Cross-region RTT beats saved prefill | Short contexts (<1K tokens) |
| Number | 1.8x at p = 0.7, N = 4 | ~6x DeepSeek-R1 on GB200 NVL72 | ~80 ms hit vs ~800 ms miss | 3-5% overhead at low pressure |
| Status | Research, April 2026 | Dynamo 1.0 GA, llm-d 0.5 | vLLM Router, llm-d router | vLLM 0.11.0 async path |

## Disaggregated serving stack
type: architecture
from: phases/17-infrastructure-and-production/17-disaggregated-prefill-decode/docs/en.md, phases/17-infrastructure-and-production/18-vllm-production-stack-lmcache/docs/en.md, phases/17-infrastructure-and-production/11-multi-region-kv-locality/docs/en.md

```arch
node | client | 1,1 | Client | request | client
node | router | 2,1 | Router | cache-aware, KV events | process
node | prefill | 3,1 | Prefill pool | compute-heavy | gpu
node | decode | 3,2 | Decode pool | memory-heavy | gpu
node | lmc | 2,2 | LMCache | CPU DRAM + Ceph/S3 | store
edge | client | router | prompt
edge | router | prefill | prompt only
edge | prefill | decode | KV over NIXL
edge | decode | lmc | unused KV
edge | decode | client | tokens
```

## One Hogwild! step
type: flow
from: phases/10-llms-from-scratch/22-async-hogwild-inference/docs/en.md, phases/10-llms-from-scratch/22-async-hogwild-inference/code/main.py

1. **Prompt**: tells each worker it is one of N instances and to avoid redundant work.
2. **Worker**: reads the whole shared cache, including tokens of other workers.
3. **Worker**: sees work already done and picks a different sub-goal.
4. **Worker**: writes one token at the next cache position.
5. **Cache**: order comes from write arrival time. There is no per-worker index.
6. **Other workers**: see the token at once on their next step.

## Cost models in the code
type: annotated-code
lang: python
from: phases/10-llms-from-scratch/22-async-hogwild-inference/code/main.py, phases/17-infrastructure-and-production/17-disaggregated-prefill-decode/code/main.py

```python
def expected_speedup(T_serial: int, p: float, c: int, N: int,
                     steps_per_worker: int) -> float:
    parallel = T_serial * ((1 - p) + p / N) + c * N  # Amdahl plus coordination
    return T_serial / parallel

def ms_disaggregated(prompt: int, output: int, use_rdma: bool = True) -> float:
    prefill_ms = prompt / PREFILL_TOK_PER_MS
    kv_bytes = prompt * KV_BYTES_PER_TOKEN_70B_FP8
    transport = NIXL_RDMA_GB_S if use_rdma else NIXL_TCP_GB_S
    transfer_ms = (kv_bytes / 1e9) / transport * 1000  # the transfer tax
    decode_ms = output / DECODE_TOK_PER_MS_DECODE_GPU  # faster decode pool
    return prefill_ms + transfer_ms + decode_ms
```

## Run the simulators
type: task-table
span: 2
from: phases/10-llms-from-scratch/22-async-hogwild-inference/code/main.py, phases/17-infrastructure-and-production/11-multi-region-kv-locality/code/main.py, phases/17-infrastructure-and-production/17-disaggregated-prefill-decode/code/main.py, phases/17-infrastructure-and-production/18-vllm-production-stack-lmcache/code/main.py

| Task | Code |
|---|---|
| Hogwild! baseline, one worker | `run_hogwild(n_workers=1, step_budget=200, target_per_category=100, coordination_weight=0.8)` |
| Hogwild! with two workers | `run_hogwild(n_workers=2, step_budget=200, target_per_category=100, coordination_weight=0.8)` |
| Sweep coordination | `for cw in (0.0, 0.2, 0.5, 0.8, 1.0):` |
| Compare three routers | `for strategy in ("ROUND_ROBIN", "REGIONAL", "GLOBAL"):` |
| Colocated request time | `ms_colocated(prompt, output)` |
| Disaggregated over TCP | `ms_disaggregated(prompt, output, use_rdma=False)` |
| Compare offload configs | `for cfg in ("NATIVE_ONLY", "CPU_OFFLOAD", "LMCACHE"):` |

## Constants in the simulators
type: defaults
from: phases/17-infrastructure-and-production/11-multi-region-kv-locality/code/main.py, phases/17-infrastructure-and-production/17-disaggregated-prefill-decode/code/main.py, phases/17-infrastructure-and-production/18-vllm-production-stack-lmcache/code/main.py

| Setting | Default | Note |
|---|---|---|
| `CACHE_HIT_MS` | 80 | TTFT with the prefix resident |
| `CACHE_MISS_MS` | 800 | TTFT with a cold prefill |
| `REPLICAS_PER_REGION` | 4 | Three regions |
| `PREFILL_TOK_PER_MS` | 40.0 | Per GPU |
| `KV_BYTES_PER_TOKEN_70B_FP8` | 125_000 | KV size per token |
| `NIXL_RDMA_GB_S` | 100 | RDMA transfer rate |
| `NIXL_TCP_GB_S` | 10 | TCP fallback rate |
| `KV_BLOCK_TOKENS` | 16 | Tokens per KV block |

## Troubleshooting
type: troubleshooting
from: phases/17-infrastructure-and-production/11-multi-region-kv-locality/docs/en.md, phases/17-infrastructure-and-production/17-disaggregated-prefill-decode/docs/en.md, phases/17-infrastructure-and-production/18-vllm-production-stack-lmcache/docs/en.md, phases/10-llms-from-scratch/22-async-hogwild-inference/docs/en.md

| Symptom | Cause | Fix |
|---|---|---|
| Prefix hit rate drops to 8% | Round-robin ALB | Cache-aware router on prefix hash |
| Replica refuses to start after failover | No tokenizer or quantization config | Three-file DR manifest |
| Disaggregated is slower | Short prompts, transfer tax | Colocate prompts < 512 tokens |
| Same 2K prompt re-prefilled | Preemption at 100% HBM | LMCache or native CPU offload |
| Cross-region route raises TTFT | 440 ms round-trip | Keep routing regional |
| EU request served in us-east-1 | Router ignores residency | Partition routers by residency |
| Hogwild! speedup below 1 | Workers duplicate work | Use a reasoning model |
| Hogwild! gain under 1.3x | Coordination dominates | Revert to single-worker |

## Use X when
type: tips
from: phases/17-infrastructure-and-production/17-disaggregated-prefill-decode/docs/en.md, phases/17-infrastructure-and-production/18-vllm-production-stack-lmcache/docs/en.md, phases/10-llms-from-scratch/22-async-hogwild-inference/docs/en.md

- Use Dynamo for a managed stack-above orchestrator.
- Use llm-d for Kubernetes-native primitives.
- Use native CPU offload when one engine has HBM pressure.
- Use LMCache when many engines share prefixes.
- Use Hogwild! on one node only. Cross-node is a latency disaster.
- Push Hogwild! to N=4 only if two workers give over 1.5x.

## Q&A
type: qa
from: phases/10-llms-from-scratch/22-async-hogwild-inference/docs/en.md, phases/17-infrastructure-and-production/17-disaggregated-prefill-decode/docs/en.md, phases/17-infrastructure-and-production/11-multi-region-kv-locality/docs/en.md

- **KV transfer cost?** 20-80 ms for 4K-prompt KV on 70B FP8 over NIXL.
- **Hogwild! with spec decode?** The speedups multiply. 3x and 1.8x give 5.4x.
- **Why minimize prefill plus network?** A cross-region route adds a 440 ms round-trip to the request. Compare it with the prefill that a cache hit saves.
- **What breaks DR in 32% of cases?** Missing tokenizer or quantization configs.
- **Colocation waste?** 20-40% of GPU time on the wrong resource.

## Glossary
type: glossary
from: phases/17-infrastructure-and-production/17-disaggregated-prefill-decode/docs/en.md, phases/17-infrastructure-and-production/11-multi-region-kv-locality/docs/en.md, phases/10-llms-from-scratch/22-async-hogwild-inference/docs/en.md

- **NIXL**: Dynamo transport for KV. RDMA/InfiniBand or TCP fallback.
- **RTT**: round-trip time. ~75 ms US-EU, ~220 ms US-APAC.
- **p**: the fraction of the work that can run in parallel.
- **c**: coordination overhead in tokens for each worker.
- **UCCL**: llm-d 0.5 networking layer.
