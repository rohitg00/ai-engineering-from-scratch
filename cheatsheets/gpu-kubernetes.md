---
id: gpu-kubernetes
title: GPU Autoscaling on Kubernetes
code: GP
subtitle: Nodes with Karpenter, gangs with KAI Scheduler, replicas on queue depth, cache-aware routing, event storyboards.
hue: 212
sources: phases/17-infrastructure-and-production/03-gpu-autoscaling-kubernetes, phases/17-infrastructure-and-production/10-cold-start-mitigation, phases/17-infrastructure-and-production/11-multi-region-kv-locality, projects/kubernetes-event-storyboard
source_hash: 70134a16f41f0991
---

## Tasks
type: task-table
from: phases/17-infrastructure-and-production/03-gpu-autoscaling-kubernetes, phases/17-infrastructure-and-production/10-cold-start-mitigation, phases/17-infrastructure-and-production/11-multi-region-kv-locality

| Task | Code |
|---|---|
| Stop GPU job eviction | `consolidationPolicy: WhenEmpty` |
| Consolidate empty nodes after an hour | `consolidateAfter: 1h` |
| Avoid the eviction default | not `WhenEmptyOrUnderutilized` |
| Do not scale on duty cycle | not `DCGM_FI_DEV_GPU_UTIL` |
| Keep one replica ready | `min_workers=1` |
| Boot nodes with weights on NVMe | snapshot ID in `EC2NodeClass` |
| Route on cached prefix | `kv.cache.block_added` |
| Compare the three scalers | `simulate(strategy, reqs)` |

## Safe disruption for GPU pools
type: annotated-code
lang: yaml
from: phases/17-infrastructure-and-production/03-gpu-autoscaling-kubernetes/docs/en.md

```yaml
# Karpenter NodePool, GPU pool
disruption:
  consolidationPolicy: WhenEmpty  # never evict a running job
  consolidateAfter: 1h  # consolidate empty nodes after an hour
```

## Three autoscaling layers
type: architecture
from: phases/17-infrastructure-and-production/03-gpu-autoscaling-kubernetes

```arch
node | pend | 1,1 | Pending pods | need 8 H100s | client
node | karp | 2,1 | Karpenter | NodePool, ~45-60s | process
node | node | 3,1 | GPU node | NVLink domain | gpu
node | kai | 2,2 | KAI Scheduler | gang, topology, queues | process
node | app | 1,3 | Dynamo Planner / llm-d WVA | replicas | process
node | sig | 2,3 | Signals | queue depth, KV utilization | queue
node | vllm | 3,3 | vLLM replicas | serve requests | model
edge | pend | karp | provision
edge | karp | node | add node
edge | pend | kai | all or nothing
edge | kai | node | place
edge | sig | app | consume
edge | app | vllm | scale
edge | vllm | sig | publish
```

## Scaling strategies in main.py
type: comparison
span: 2
from: phases/17-infrastructure-and-production/03-gpu-autoscaling-kubernetes/code/main.py, phases/17-infrastructure-and-production/03-gpu-autoscaling-kubernetes/docs/en.md

| Factor | DUTY_CYCLE | QUEUE_DEPTH | KAI_GANG |
|---|---|---|---|
| Signal | `DCGM_FI_DEV_GPU_UTIL` | `len(queue)` | `len(queue)` |
| Scale up when | `util > TARGET_GPU_UTIL` | `qd > 5` | `qd > 3` |
| Step up | `replicas_target += 1` | `max(1, qd // 5)` | `max(2, qd // 3)` |
| Scale down when | `util < 20` | `qd == 0` | `qd == 0` |
| Result | Drops requests | Reacts to the backlog | Avoids partial-alloc stalls |

## Simulator constants
type: defaults
from: phases/17-infrastructure-and-production/03-gpu-autoscaling-kubernetes/code/main.py, phases/17-infrastructure-and-production/11-multi-region-kv-locality/code/main.py

| Setting | Default | Note |
|---|---|---|
| `NODE_PROVISION_SEC` | 50 | Karpenter ~45-60s |
| `CLUSTER_AUTOSCALER_SEC` | 110 | Slower comparison |
| `MODEL_LOAD_SEC` | 45 | 70B weights plus engine init |
| `HPA_TICK_SEC` | 15 | Control loop interval |
| `TARGET_GPU_UTIL` | 70 | Duty-cycle target |
| `MAX_REPLICAS` | 16 | Replica ceiling |
| `CACHE_HIT_MS` | 80 | TTFT with prefix resident |
| `CACHE_MISS_MS` | 800 | TTFT on cold prefill |

## Cache-aware routing
type: flow
from: phases/17-infrastructure-and-production/11-multi-region-kv-locality

1. **Router**: hashes the prefix, for example the first 512 tokens.
2. **Replicas**: publish KV-cache events as they allocate and evict blocks.
3. **vLLM Router**: indexes `kv.cache.block_added` into prefix hash to replica.
4. **Router**: sends the request to the replica with the match.
5. **Router**: with no match, picks the least queue depth.
6. **Global router**: adds RTT to the hit cost. It stays local when cost passes `CACHE_MISS_MS`.
7. **Residency**: partition routers by residency boundary before cache.

## Troubleshooting
type: troubleshooting
from: phases/17-infrastructure-and-production/03-gpu-autoscaling-kubernetes, phases/17-infrastructure-and-production/11-multi-region-kv-locality, phases/17-infrastructure-and-production/10-cold-start-mitigation

| Symptom | Cause | Fix |
|---|---|---|
| HPA never scales at 100% | Duty cycle hides 10 or 100 requests | Scale on queue depth or KV utilization |
| Memory HPA never scales down | vLLM pre-allocates KV cache | Drop memory as a signal |
| 7 of 8 pods wait and burn money | No gang scheduling | KAI Scheduler, all or nothing |
| Running inference evicted | `WhenEmptyOrUnderutilized` | `WhenEmpty` plus `consolidateAfter: 1h` |
| Request times out at 2 a.m. | Node provisioning took 3 minutes | Karpenter plus a warm pool |
| Cache hit rate drops to 8% | Round-robin load balancer | Cache-aware router |
| Replica refuses to start in DR | Tokenizer or quant config not synced | Back up the three-file DR manifest |
| One HPA for prefill and decode | Two pod classes, two triggers | Per-role HPA on separate `Services` |

## Event storyboard project
type: annotated-code
lang: bash
span: 2
from: projects/kubernetes-event-storyboard/README.md, projects/kubernetes-event-storyboard/stages/01-parse-snapshots/docs/en.md

```bash
python3 scripts/project_test.py kubernetes-event-storyboard --init /tmp/kubernetes-event-storyboard-work
python3 scripts/project_test.py kubernetes-event-storyboard --stage 1 --path /tmp/kubernetes-event-storyboard-work --strict
python3 scripts/project_test.py kubernetes-event-storyboard --all --solution --strict
cd projects/kubernetes-event-storyboard/solution
go run . --input fixtures/rollout.json --out /tmp/context-pack.json  # Go pack
node --experimental-strip-types cli.ts /tmp/context-pack.json /tmp/timeline.html  # HTML
kubectl get events -A -o json  # export your own snapshot
```

## Storyboard stages
type: flow
from: projects/kubernetes-event-storyboard/solution/main.go, projects/kubernetes-event-storyboard/solution/main.ts, projects/kubernetes-event-storyboard/stages

1. **Parse**: `Parse([]byte)(Bundle,error)` checks `observedAt` and both items arrays.
2. **Group**: `Group(Bundle)([]Row,error)` keeps max count per event UID, then sums.
3. **Connect**: walks ownerReferences to `deployment.kubernetes.io/revision`.
4. **Export**: `Export(Bundle)(Pack,error)` writes `schemaVersion` 1 with redactions.
5. **parsePack**: `parsePack(text)` checks version, counts and time order.
6. **timeline**: `timeline(pack)` returns escaped HTML with a Warning filter.

## Storyboard errors
type: command-table
from: projects/kubernetes-event-storyboard/solution/main.go, projects/kubernetes-event-storyboard/solution/main.ts

| Command | What it does |
|---|---|
| `bundle exceeds one MiB` | Input is over 1<<20 bytes |
| `trailing JSON` | Extra data after the bundle |
| `observedAt must be RFC3339` | Bad capture timestamp |
| `invalid occurrence range or count` | Last before first, or count below 1 |
| `event UID changed identity` | UID reused for another object or reason |
| `invalid or duplicate workload UID` | Empty or repeated workload UID |
| `invalid context pack` | TypeScript rejects the Go pack |

## Q&A
type: qa
from: phases/17-infrastructure-and-production/03-gpu-autoscaling-kubernetes, phases/17-infrastructure-and-production/11-multi-region-kv-locality, projects/kubernetes-event-storyboard/stages

- **Karpenter or Cluster Autoscaler?** Karpenter is ~45-60s. Cluster Autoscaler is ~90-120s for GPU nodes.
- **Which signal for prefill pods?** Queue depth. Decode pods scale on KV cache pressure.
- **Route across regions?** Rarely. 440 ms round trip beats the 800 to 80 ms saving.
- **What does round-robin cost?** Cache hit is ~80 ms, miss is ~800 ms. A 10x gap.
- **Two snapshots with counts 2 and 4?** One series. The count is 4, not 6.
- **Two revisions found?** The revision stays unknown. Never guess from names.

## Tips
type: tips
from: phases/17-infrastructure-and-production/11-multi-region-kv-locality, phases/17-infrastructure-and-production/03-gpu-autoscaling-kubernetes, phases/17-infrastructure-and-production/10-cold-start-mitigation

- Back up `tokenizer.json` or `tokenizer.model` with the weights.
- Back up `quantize_config.json` and `vllm_config.yaml`.
- Run a DR drill quarterly.
- Run KAI as a secondary scheduler. Annotate workloads to use it.
- Keep a tensor-parallel workload on one NVLink domain.
- Give `min_workers=1-2` to live chat and voice paths only.
