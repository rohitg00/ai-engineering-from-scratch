---
id: distributed-training
title: DDP, FSDP, ZeRO and Pipeline Parallel
code: DF
subtitle: Pick a parallelism, size the memory, wire the collectives and fix the hangs. PyTorch gloo on CPU.
hue: 280
sources: phases/10-llms-from-scratch/05-scaling-distributed, phases/10-llms-from-scratch/19-dualpipe-parallelism, phases/19-capstone-projects/48-distributed-fsdp-ddp, phases/19-capstone-projects/76-collective-ops-from-scratch, phases/19-capstone-projects/77-data-parallel-ddp, phases/19-capstone-projects/78-zero-parameter-sharding, phases/19-capstone-projects/79-pipeline-parallel
source_hash: a601a24bdbc9c6e0
---

## Four strategies side by side
type: comparison
span: 2
from: phases/10-llms-from-scratch/05-scaling-distributed/docs/en.md, phases/19-capstone-projects/48-distributed-fsdp-ddp/docs/en.md

| Factor | DDP | FSDP or ZeRO-3 | Pipeline | Tensor parallel |
|---|---|---|---|---|
| Splits | the batch | params, grads, optimizer | the model by layers | each weight matrix |
| Per-GPU memory | full copy, no drop | 1/N of each state | one group of layers | a slice of each layer |
| Traffic | all-reduce of gradients | all-gather per layer, reduce-scatter | activations at layer boundaries | all-reduce after each matmul |
| Link | overlaps with compute | more than plain DP | low bandwidth, across nodes | NVLink inside a node |
| Main cost | memory | gather every forward pass | pipeline bubbles | latency after every layer |

## Use each one when
type: concepts
from: phases/19-capstone-projects/48-distributed-fsdp-ddp/docs/en.md, phases/19-capstone-projects/78-zero-parameter-sharding/docs/en.md, phases/10-llms-from-scratch/05-scaling-distributed/docs/en.md, phases/10-llms-from-scratch/19-dualpipe-parallelism/docs/en.md

- **DDP**: the model fits on one device. The dataset does not.
- **FSDP**: the model does not fit on one device either.
- **ZeRO-1**: the default. Same bandwidth as DDP, memory drop linear in N.
- **ZeRO-2 or ZeRO-3**: the parameter shard memory is also a problem.
- **Tensor parallel**: inside a node. It needs fast inter-GPU links.
- **Pipeline**: across nodes. Bandwidth needs are low.
- **DualPipe**: EP-heavy MoE at multi-thousand GPU scale.
- **DualPipeV**: dense or EP-light models. One parameter copy.

## ZeRO stages
type: comparison
span: 2
from: phases/19-capstone-projects/78-zero-parameter-sharding/docs/en.md, phases/10-llms-from-scratch/05-scaling-distributed/docs/en.md

| Factor | DDP | ZeRO-1 | ZeRO-2 | ZeRO-3 |
|---|---|---|---|---|
| Sharded | nothing | optimiser state | optim + grads | optim + grads + params |
| Memory per rank | params + grads + optim | params + grads + optim/N | params + grads/N + optim/N | params/N + grads/N + optim/N |
| Comm per step | 1x allreduce | 1x reduce_scatter + 1x allgather | 1x reduce_scatter + 1x allgather | allgather and reduce_scatter per layer |
| Savings | none | ~4x reduction | ~8x reduction | ~Nx reduction |
| PyTorch FSDP name | not listed | not listed | `ShardingStrategy.SHARD_GRAD_OP` | `FULL_SHARD` |

## Memory numbers
type: concepts
from: phases/10-llms-from-scratch/05-scaling-distributed/docs/en.md, phases/19-capstone-projects/78-zero-parameter-sharding/docs/en.md

- **Adam states**: m and v in FP32. 70B x 4 bytes x 2 = 560GB.
- **Vanilla, mixed precision**: 16P bytes per rank.
- **ZeRO-1**: 4P + 12P/N bytes. At N=8 that is 5.5P, a 65% drop.
- **FSDP, 70B on 8 GPUs**: 105 GB per GPU. Still over 80GB.
- **Mixed precision, 7B**: 112 GB to 84 GB. Optimizer stays FP32.
- **Effective batch size**: per_gpu_batch_size x N.

## Pipeline schedules
type: comparison
from: phases/10-llms-from-scratch/19-dualpipe-parallelism/docs/en.md, phases/10-llms-from-scratch/19-dualpipe-parallelism/code/main.py

| Factor | 1F1B | Zero Bubble | DualPipe | DualPipeV |
|---|---|---|---|---|
| Param copies | 1 | 1 | 2 | 1 |
| Bubble vs micro-batches | grows | grows | constant | small growth |
| Overlap | minimal | partial | full | partial |
| Simulator | `bubble_1f1b` | `bubble_zero_bubble` | `bubble_dualpipe` | `bubble_dualpipev` |

## Collectives
type: comparison
from: phases/19-capstone-projects/76-collective-ops-from-scratch/docs/en.md

| Factor | Ring allreduce | Tree allreduce | Allgather | Reduce_scatter |
|---|---|---|---|---|
| Per-rank bytes | 2T(N-1)/N | T log2(N) | T(N-1)/N | T(N-1)/N |
| Steps | 2(N-1) | 2 log2(N) | N-1 | N-1 |
| Use when | large T | small T, high latency | ZeRO unshard | ZeRO gradient sharding |
| Message size | above ~1 MB | below ~1 MB | any | any |

## Ring allreduce on a queue mesh
type: architecture
from: phases/19-capstone-projects/76-collective-ops-from-scratch/docs/en.md, phases/19-capstone-projects/76-collective-ops-from-scratch/code/main.py

```arch
node | r0 | 1,1 | rank 0 | owns chunk 0 | process
node | r1 | 2,1 | rank 1 | owns chunk 1 | process
node | r2 | 2,2 | rank 2 | owns chunk 2 | process
node | r3 | 1,2 | rank 3 | owns chunk 3 | process
edge | r0 | r1 | queue 0 to 1
edge | r1 | r2 | queue 1 to 2
edge | r2 | r3 | queue 2 to 3
edge | r3 | r0 | queue 3 to 0
```

## DDP worker loop
type: annotated-code
lang: python
from: phases/19-capstone-projects/77-data-parallel-ddp/code/main.py

```python
dist.init_process_group(
    backend="gloo",
    init_method=f"file://{init_file}",  # file rendezvous
    rank=rank,
    world_size=world_size,
)
torch.manual_seed(SEED)  # same init on every rank
ddp = DistributedDataParallel(model, world_size=world_size)  # broadcasts params
for step in range(steps):
    offset = step * world_size * batch + rank * batch  # own slice
    optim.zero_grad(set_to_none=True)
    loss.backward()
    ddp.sync_grads()  # all_reduce SUM, then div_ by world_size
    optim.step()
```

## Collective calls
type: task-table
span: 2
from: phases/19-capstone-projects/48-distributed-fsdp-ddp/docs/en.md, phases/19-capstone-projects/77-data-parallel-ddp/code/main.py, phases/19-capstone-projects/78-zero-parameter-sharding/code/main.py, phases/19-capstone-projects/79-pipeline-parallel/code/main.py, phases/19-capstone-projects/77-data-parallel-ddp/docs/en.md

| Task | Code |
|---|---|
| Set the rendezvous port | `os.environ["MASTER_PORT"] = str(port)` |
| Start a CPU group | `dist.init_process_group(backend="gloo", rank=rank, world_size=world_size)` |
| Same params on all ranks | `dist.broadcast(p.data, src=0)` |
| Sum gradients | `dist.all_reduce(p.grad.data, op=dist.ReduceOp.SUM)` |
| Mean gradients | `p.grad.data.div_(world_size)` |
| ZeRO-1 gradient shard | `dist.reduce_scatter(local_grad, chunks, op=dist.ReduceOp.SUM)` |
| ZeRO-1 params back | `dist.all_gather(gathered, self.master_shard)` |
| GPipe bubble | `bubble_fraction(num_stages, num_microbatches)` |

## Run the lessons
type: command-table
from: phases/19-capstone-projects/48-distributed-fsdp-ddp/docs/en.md, phases/19-capstone-projects/48-distributed-fsdp-ddp/code/main.py, phases/19-capstone-projects/76-collective-ops-from-scratch/docs/en.md, phases/19-capstone-projects/77-data-parallel-ddp/docs/en.md, phases/19-capstone-projects/78-zero-parameter-sharding/docs/en.md, phases/19-capstone-projects/79-pipeline-parallel/docs/en.md

| Command | What it does |
|---|---|
| `python3 code/main.py` | Lesson 48: two gloo ranks, writes `outputs/ddp-demo.json` |
| `--world-size 4` | Lesson 48: four ranks. Param spread stays under 1e-3 |
| `--no-write` | Lesson 48: skip the JSON file |
| `python3 code/main.py` | Lesson 76: queue mesh against gloo, byte counter |
| `python3 code/main.py` | Lesson 77: single process against DDP on 4 ranks |
| `python3 code/main.py` | Lesson 78: loss and the ZeRO-1 memory table |
| `python3 code/main.py` | Lesson 79: Gantt chart and bubble percentage |

## Defaults in the code
type: defaults
from: phases/19-capstone-projects/48-distributed-fsdp-ddp/code/main.py, phases/19-capstone-projects/48-distributed-fsdp-ddp/docs/en.md, phases/19-capstone-projects/76-collective-ops-from-scratch/code/main.py, phases/19-capstone-projects/76-collective-ops-from-scratch/docs/en.md, phases/19-capstone-projects/79-pipeline-parallel/code/main.py

| Setting | Default | Note |
|---|---|---|
| `--world-size` | 2 | Lesson 48 ranks |
| `--backend` | `gloo` | Use `nccl` on GPUs |
| `--num-steps` | 6 | Lesson 48 training steps |
| `--batch-size` | 8 | Per rank |
| `RECV_TIMEOUT_S` | 30.0 | Queue mesh receive deadline |
| DDP bucket size | 25 MB | One allreduce per bucket |
| `NUM_STAGES` | 4 | Lesson 79 pipeline |
| `NUM_MICROBATCHES` | 8 | Lesson 79 pipeline |

## Troubleshooting
type: troubleshooting
from: phases/19-capstone-projects/48-distributed-fsdp-ddp/docs/en.md, phases/19-capstone-projects/77-data-parallel-ddp/docs/en.md, phases/19-capstone-projects/79-pipeline-parallel/docs/en.md, phases/10-llms-from-scratch/05-scaling-distributed/docs/en.md

| Symptom | Cause | Fix |
|---|---|---|
| Ranks diverge from step one | Each rank uses its own init | `dist.broadcast(tensor, src=0)` at construction |
| All ranks see the same batches | One shared seed for shuffling | `torch.manual_seed(seed + rank)` for shuffling |
| Allreduce deadlocks | Skipped params have no gradient | `find_unused_parameters=True` |
| Accumulation is slow | Allreduce on every microbatch | Wrap microbatches in `no_sync()` |
| LR breaks when N changes | SUM without the division | Divide by world_size |
| Pipeline hangs on the wire | Every stage sends before receive | Even ranks send first, odd ranks receive first |
| One stage gates every cycle | Stages split by parameter count | Equalise FLOPs per stage |
| 70B FSDP over 80GB on 8 GPUs | 105 GB per GPU | 16 GPUs or activation checkpointing |

## Q&A
type: qa
from: phases/19-capstone-projects/77-data-parallel-ddp/docs/en.md, phases/10-llms-from-scratch/05-scaling-distributed/docs/en.md, phases/19-capstone-projects/79-pipeline-parallel/docs/en.md, phases/19-capstone-projects/78-zero-parameter-sharding/docs/en.md, phases/10-llms-from-scratch/19-dualpipe-parallelism/docs/en.md

- **Why mean and not sum?** An LR tuned at one rank then works at four ranks.
- **Does mixed precision halve memory?** No. It saves about 25%.
- **GPipe bubble at M=8, N=4?** 27%. At M=64, N=4 it is 4.5%.
- **GPipe or 1F1B?** Same bubble. 1F1B bounds activation memory.
- **Why reduce_scatter in ZeRO?** Each rank gets only its own shard sum.
- **Is ZeRO-3 the same as FSDP?** Yes. The mechanism is the same.
- **DualPipe under 1k GPUs?** Overkill. Bubbles are a small share of cost.
