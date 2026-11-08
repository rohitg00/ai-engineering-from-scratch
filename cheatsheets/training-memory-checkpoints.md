---
id: training-memory-checkpoints
title: Training Memory, Accumulation and Checkpoints
code: TM
subtitle: Fix NaN steps, memory limits, accumulation scale and broken resumes. Clip, AMP, recompute, atomic checkpoints.
hue: 20
sources: phases/10-llms-from-scratch/34-gradient-checkpointing, phases/19-capstone-projects/45-gradient-clipping-amp, phases/19-capstone-projects/46-gradient-accumulation, phases/19-capstone-projects/47-checkpoint-save-resume, phases/19-capstone-projects/80-checkpoint-sharded-resume, phases/19-capstone-projects/81-end-to-end-distributed-train
source_hash: 0ea0fe65eca26d48
---

## Training symptoms
type: troubleshooting
from: phases/19-capstone-projects/45-gradient-clipping-amp/docs/en.md, phases/19-capstone-projects/46-gradient-accumulation/docs/en.md, phases/19-capstone-projects/47-checkpoint-save-resume/docs/en.md, phases/10-llms-from-scratch/34-gradient-checkpointing/docs/en.md

| Symptom | Cause | Fix |
|---|---|---|
| Loss goes vertical after one batch | Gradient norm spike, no clip | `clip_grad_norm_` at `max_norm = 1.0` |
| Every weight is NaN after a step | FP16 overflow gives Inf, then NaN | `torch.amp.GradScaler` skips the step |
| Scaling factor never changes | No `scaler.update()` on the skip path | Call `scaler.update()` every step |
| Clip acts on scaled gradients | Clip runs before unscale | Call `scaler.unscale_(optimizer)` first |
| Hundreds of skips per epoch | Model is past the FP16 range | Alert on a skip rate above 5 percent |
| Optimizer step 16 times too big | Micro-batch loss not divided | Divide the loss by `accum_steps` |
| Resumed loss curve differs | No RNG state in the checkpoint | Save `capture_rng_state()` output |
| Activations do not fit in memory | Backprop keeps every activation | `torch.utils.checkpoint.checkpoint(fn, input)` |

## Checkpoint load failures
type: troubleshooting
from: phases/19-capstone-projects/80-checkpoint-sharded-resume/docs/en.md, phases/19-capstone-projects/80-checkpoint-sharded-resume/code/main.py, phases/19-capstone-projects/47-checkpoint-save-resume/code/main.py, phases/19-capstone-projects/47-checkpoint-save-resume/docs/en.md

| Symptom | Cause | Fix |
|---|---|---|
| `world_size mismatch` | Resume on a different world size | Resume on the same world size |
| `sha256 mismatch on rank` | Shard truncated mid-flush | Write to .tmp, fsync, then rename |
| `shard file missing` | Fewer rank files than manifest shards | Enumerate shards, verify each exists |
| `unknown schema` | Payload schema does not start with ckpt | Branch migrations on the schema string |
| Loss goes to NaN 100 steps after resume | Partial shard behind a present manifest | Atomic write plus sha256 on load |
| Disk fills mid-run | No rotation | `rotate_checkpoints` keeps the last K |

## Safe AMP step
type: annotated-code
lang: python
from: phases/19-capstone-projects/45-gradient-clipping-amp/code/main.py, phases/19-capstone-projects/45-gradient-clipping-amp/docs/en.md

```python
optimizer.zero_grad(set_to_none=True)  # grads to None
with torch.amp.autocast(device_type="cuda"):  # FP16 forward
    loss = loss_fn(model(inputs), targets)
if not torch.isfinite(loss).all().item():  # check before backward
    return skip("non_finite_loss")  # no scaler.update here
scaler.scale(loss).backward()  # scaled backward
scaler.unscale_(optimizer)  # unscale before the clip
if has_non_finite_grad(model.parameters()):
    scaler.update()  # halves the factor
    return skip("non_finite_grad")
pre, post = clip_global_l2_norm(params, max_norm)
scaler.step(optimizer)
scaler.update()  # doubles or halves
```

## Accumulate, sync on the last
type: annotated-code
lang: python
from: phases/19-capstone-projects/46-gradient-accumulation/code/main.py, phases/19-capstone-projects/46-gradient-accumulation/docs/en.md

```python
accum_steps = len(micro_batches)
zero_grads(model)
for i, (x, y) in enumerate(micro_batches):
    is_last = i == accum_steps - 1
    if no_sync_until_last and not is_last:
        with no_sync_context(model):  # DDP skips the all-reduce
            loss = loss_scaled_for_accum(model(x), y, accum_steps, loss_fn)
            loss.backward()  # grads add into param.grad
    else:
        loss = loss_scaled_for_accum(model(x), y, accum_steps, loss_fn)
        loss.backward()  # one sync per effective step
optimizer.step()  # once per effective batch
```

## Tasks in code
type: task-table
span: 2
from: phases/19-capstone-projects/45-gradient-clipping-amp/docs/en.md, phases/19-capstone-projects/45-gradient-clipping-amp/code/main.py, phases/19-capstone-projects/46-gradient-accumulation/code/main.py, phases/10-llms-from-scratch/34-gradient-checkpointing/docs/en.md, phases/19-capstone-projects/47-checkpoint-save-resume/code/main.py, phases/19-capstone-projects/80-checkpoint-sharded-resume/code/main.py

| Task | Code |
|---|---|
| Clip to a global L2 norm | `clip_grad_norm_(parameters, max_norm)` |
| Log the scaling factor | `scaler.get_scale()` |
| Scale a micro-batch loss | `loss_scaled_for_accum(logits, target, accum_steps, loss_fn)` |
| Recompute a segment in backward | `checkpoint(fn, input)` |
| Save the full state atomically | `save_checkpoint(model, optimizer, scheduler, state, out_path)` |
| Load an untrusted file | `torch.load(path, map_location="cpu", weights_only=True)` |
| Save and load per-rank shards | `save_sharded(per_rank_state, dest_dir, step)` |
| Resume and verify every shard | `load_sharded(src_dir, expected_world_size)` |

## Sharded atomic save
type: architecture
from: phases/19-capstone-projects/80-checkpoint-sharded-resume/docs/en.md, phases/19-capstone-projects/80-checkpoint-sharded-resume/code/main.py

```arch
node | s0 | 1,1 | rank 0 state | param and optimiser shard | gpu
node | s1 | 1,2 | rank 1 state | one file per rank | gpu
node | t0 | 2,1 | rank0.bin.tmp | write, flush, fsync | store
node | t1 | 2,2 | rank1.bin.tmp | write, flush, fsync | store
node | man | 3,1 | manifest.json.tmp | world_size, step, shards | store
node | ren | 3,2 | os.replace | shards first, manifest last | process
node | load | 4,1 | load_sharded | sha256 check per shard | process
edge | s0 | t0 |
edge | s1 | t1 |
edge | t0 | man | sha256
edge | t1 | man | sha256
edge | man | ren |
edge | ren | load | resume
```

## Save and resume mid epoch
type: flow
from: phases/19-capstone-projects/47-checkpoint-save-resume/docs/en.md, phases/19-capstone-projects/47-checkpoint-save-resume/code/main.py

1. **save_checkpoint**: packs model, optimizer, scheduler, counters and RNG.
2. **atomic_save**: writes a temp file, then calls `os.replace`.
3. **load_checkpoint**: calls `torch.load` with `weights_only=True`.
4. **restore_rng_state**: restores Python, NumPy and torch RNG.
5. **Training loop**: continues from `batch_in_epoch`. Loss diff under 1e-4.

## Run the lessons
type: command-table
from: phases/19-capstone-projects/45-gradient-clipping-amp/docs/en.md, phases/19-capstone-projects/46-gradient-accumulation/docs/en.md, phases/19-capstone-projects/46-gradient-accumulation/code/main.py, phases/19-capstone-projects/47-checkpoint-save-resume/code/main.py, phases/19-capstone-projects/80-checkpoint-sharded-resume/docs/en.md, phases/19-capstone-projects/81-end-to-end-distributed-train/docs/en.md

| Command | What it does |
|---|---|
| `python3 code/main.py` | Lesson 45: 20 steps, rows tagged STEP or SKIP |
| `--num-steps 100` | Lesson 46: longer sweep for the curve |
| `--accum-grid 1,2,4,8,16` | Lesson 46: accumulation steps to sweep |
| `--total-steps 24 --interrupt-at 10` | Lesson 47: resume demo window |
| `python3 code/main.py` | Lesson 80: 4 shards plus manifest, byte-equal reload |
| `python3 code/main.py` | Lesson 81: 20 steps, 4 ranks, RESUME VERIFIED |

## Defaults in the code
type: defaults
from: phases/19-capstone-projects/45-gradient-clipping-amp/code/main.py, phases/10-llms-from-scratch/34-gradient-checkpointing/code/main.py, phases/19-capstone-projects/80-checkpoint-sharded-resume/code/main.py, phases/19-capstone-projects/47-checkpoint-save-resume/code/main.py, phases/19-capstone-projects/81-end-to-end-distributed-train/code/main.py

| Setting | Default | Note |
|---|---|---|
| `DEFAULT_MAX_NORM` | 1.0 | Clip threshold of `AmpTrainState` |
| `amp_dtype` on cpu | `torch.bfloat16` | `torch.float16` on cuda |
| `window` | 1000 | Steps in `rolling_skip_rate` |
| `k` | 4 | Layers per checkpoint segment |
| `attention_fraction` | 0.15 | Recompute share, selective mode |
| `keep_last` | 5 | Checkpoints that `rotate_checkpoints` keeps |
| `CHECKPOINT_SCHEMA` | ckpt.v1 | Schema string in the payload |
| `CHECKPOINT_STEP` | 10 | Sharded save step of lesson 81 |

## Memory and cost numbers
type: concepts
from: phases/10-llms-from-scratch/34-gradient-checkpointing/docs/en.md, phases/19-capstone-projects/46-gradient-accumulation/docs/en.md, phases/19-capstone-projects/81-end-to-end-distributed-train/docs/en.md

- **Activations per layer**: about `12 * B * L * d` floats.
- **d=8192, L=8192, B=1**: about 1.6 GB per layer in BF16. 64 layers is about 103 GB.
- **Full checkpointing**: about 33% more FLOPs. A step is 4 units, not 3.
- **Selective checkpointing**: recompute attention only. About 5% overhead.
- **sqrt(L) rule**: one checkpoint every sqrt(L) layers. 8 checkpoints for L=64.
- **Effective batch**: `micro_batch * accum_steps`, times the data parallel world size.
- **ZeRO-1 optimiser memory**: 12P/N bytes per rank.

## Q&A
type: qa
from: phases/19-capstone-projects/45-gradient-clipping-amp/docs/en.md, phases/19-capstone-projects/46-gradient-accumulation/docs/en.md, phases/19-capstone-projects/47-checkpoint-save-resume/docs/en.md, phases/19-capstone-projects/80-checkpoint-sharded-resume/docs/en.md, phases/10-llms-from-scratch/34-gradient-checkpointing/docs/en.md

- **Why does the CPU GradScaler do nothing?** CPU autocast uses BF16. It does not need loss scaling.
- **When does the factor change?** It doubles after clean stretches. It halves on every skip.
- **Does accumulation save time?** No. Double `accum_steps` and the wall time per step doubles.
- **Why `weights_only=True`?** A `.pt` file is a pickle. Unpickling runs code. Use torch 2.6 or newer.
- **Why one file per rank?** Write bandwidth scales. 4 hours on one rank is 4 minutes on 64.

## Tips
type: tips
from: phases/19-capstone-projects/45-gradient-clipping-amp/docs/en.md, phases/19-capstone-projects/47-checkpoint-save-resume/docs/en.md, phases/19-capstone-projects/81-end-to-end-distributed-train/docs/en.md

- Match the autocast device to the optimizer device.
- Raise `ValueError`, not assert. `python -O` strips asserts.
- On a loss jump above 2x, roll back to the previous checkpoint.
