# Evidence: cheatsheets/training-memory-checkpoints.md

Abbreviations: L34 = phases/10-llms-from-scratch/34-gradient-checkpointing, L45 = phases/19-capstone-projects/45-gradient-clipping-amp, L46 = phases/19-capstone-projects/46-gradient-accumulation, L47 = phases/19-capstone-projects/47-checkpoint-save-resume, L80 = phases/19-capstone-projects/80-checkpoint-sharded-resume, L81 = phases/19-capstone-projects/81-end-to-end-distributed-train, d = docs/en.md, c = code/main.py.

## Training symptoms (troubleshooting, 8)
- Loss vertical after one batch, clip at norm 1.0, `max_norm = 1.0`: L45/d:19, L45/d:89. `clip_grad_norm_`: L45/d:45
- FP16 overflow gives Inf then NaN weights, GradScaler skips the step: L45/d:21, L45/d:49
- Scaling factor never changes, forgot `update()` on skip path, runs every step: L45/d:93
- Clip before unscale acts on scaled gradients, order `scaler.unscale_(optimizer)` then clip: L45/d:23
- Hundreds of skips per epoch, alert above 5 percent: L45/d:87
- Optimizer step 16 times too big, divide loss by `accum_steps`: L46/d:21, L46/d:38
- Resumed loss curve differs without RNG state, `capture_rng_state`: L47/d:21, L47/d:93
- Backprop keeps every activation, `torch.utils.checkpoint.checkpoint(fn, input)`: L34/d:12, L34/d:97

## Checkpoint load failures (troubleshooting, 6)
- `world_size mismatch` on world-size change, fail loudly: L80/c:166-169, L80/d:61
- `sha256 mismatch on rank`, partial write, tmp then fsync then rename: L80/c:199-203, L80/d:55, L80/d:63
- `shard file missing`, fewer rank files than shards, verify every one exists: L80/c:196-197, L80/d:62
- `unknown schema`, schema must start with ckpt, migrations branch on schema: L47/c:202-203, L47/d:128
- NaN 100 steps after resume from partial shard with present manifest: L80/d:55, L80/d:65
- Disk fills mid-run without rotation, keep last K, `rotate_checkpoints`: L80/d:100, L80/c:212-213

## Safe AMP step (annotated-code, 13 lines)
- `zero_grad(set_to_none=True)`: L45/c:207, L45/d:101
- `torch.amp.autocast(device_type="cuda")`: L45/d:99, L45/c:209
- loss finiteness check before backward: L45/c:213, L45/d:55
- non_finite_loss skip without scaler.update: L45/c:214-221
- `scaler.scale(loss).backward()`: L45/c:224. `scaler.unscale_`: L45/c:227
- `has_non_finite_grad`, update halves, non_finite_grad: L45/c:229-239, L45/d:93
- `clip_global_l2_norm`: L45/c:255. `scaler.step`, `scaler.update`: L45/c:257-258. doubles or halves: L45/d:38

## Accumulate, sync on the last (annotated-code, 12 lines)
- accum_steps, zero_grads, enumerate, is_last: L46/c:109-113
- no_sync_until_last, no_sync_context skips all-reduce: L46/c:114-118, L46/c:141-147, L46/d:41
- loss_scaled_for_accum and backward on last micro-batch: L46/c:120-122. grads sum into param.grad: L46/d:38
- optimizer.step once per effective batch: L46/c:126, L46/d:39

## Tasks in code (task-table, 8)
- `clip_grad_norm_(parameters, max_norm)`: L45/d:45
- `scaler.get_scale()`: L45/d:59
- `loss_scaled_for_accum(logits, target, accum_steps, loss_fn)`: L46/c:91
- `checkpoint(fn, input)`: L34/d:97
- `save_checkpoint(model, optimizer, scheduler, state, out_path)`: L47/c:165-170
- `torch.load(path, map_location="cpu", weights_only=True)`: L47/c:201
- `save_sharded(per_rank_state, dest_dir, step)`: L80/c:105
- `load_sharded(src_dir, expected_world_size)`: L80/c:159

## Sharded atomic save (architecture, 7 nodes, 6 edges)
- rank 0 state, param and optimiser shard: L80/d:21, L80/d:27
- rank 1 state, one file per rank: L80/d:28-30
- rank0.bin.tmp, write, flush, fsync: L80/d:27, L80/c:123-128
- rank1.bin.tmp, write, flush, fsync: L80/d:28, L80/c:123-128
- manifest.json.tmp with world_size, step, shards: L80/d:31, L80/d:38-48, L80/c:140-148
- os.replace shards first, manifest last: L80/c:151-154, L80/d:32
- load_sharded sha256 per shard: L80/c:159, L80/c:198-203
- sha256 per shard recorded in manifest: L80/c:121, L80/d:51

## Save and resume mid epoch (flow, 5)
1. save_checkpoint packs model, optimizer, scheduler, counters, RNG: L47/c:174-188, L47/d:101
2. atomic_save temp file then os.replace: L47/c:110-122, L47/d:97
3. load_checkpoint torch.load weights_only=True: L47/c:201, L47/d:103
4. restore_rng_state Python, NumPy, torch: L47/c:89-101
5. continue from batch_in_epoch, diff under 1e-4: L47/d:81, L47/d:119

## Run the lessons (command-table, 6)
- Lesson 45 `python3 code/main.py`, 20 steps, STEP or SKIP: L45/d:73, L45/d:78-81
- Lesson 46 `--num-steps 100`: L46/d:129, L46/c:315
- Lesson 46 `--accum-grid 1,2,4,8,16`: L46/c:314
- Lesson 47 `--total-steps 24 --interrupt-at 10`: L47/c:451-452
- Lesson 80 4 shard files plus manifest, byte-equal: L80/d:87-90
- Lesson 81 20 steps, 4 ranks, RESUME VERIFIED: L81/d:3, L81/d:75-78

## Defaults in the code (defaults, 8)
- DEFAULT_MAX_NORM 1.0, used by AmpTrainState: L45/c:34, L45/c:144
- amp_dtype torch.bfloat16 on cpu, torch.float16 on cuda: L45/c:164
- window 1000 in rolling_skip_rate: L45/c:306
- k 4: L34/c:49
- attention_fraction 0.15, selective: L34/c:76-79
- keep_last 5 in rotate_checkpoints: L80/c:212
- CHECKPOINT_SCHEMA ckpt.v1: L47/c:34
- CHECKPOINT_STEP 10: L81/c:37

## Memory and cost numbers (concepts, 7)
- `12 * B * L * d` floats per layer: L34/d:12
- d=8192, L=8192, B=1: 1.6 GB/layer BF16, 64 layers 103 GB: L34/d:14
- Full checkpointing 33%, 4 units vs 3: L34/d:38, L34/d:69
- Selective 5% overhead, attention only: L34/d:46, L34/d:72-76
- sqrt(L) rule, 8 checkpoints for L=64: L34/d:40
- Effective batch micro_batch * accum_steps, times world size: L46/d:12, L46/d:141
- ZeRO-1 12P/N bytes per rank: L81/d:21

## Q&A (qa, 5)
- CPU GradScaler stub, BF16 needs no loss scaling: L45/d:51
- Factor doubles after clean stretches, halves on skip: L45/d:123
- Doubling accum_steps doubles wall time per step: L46/d:76
- weights_only=True, .pt is a pickle, torch 2.6 or newer: L47/d:103
- Per-rank files, 4 hours on one rank, 4 minutes on 64: L80/d:21

## Tips (tips, 3)
- Autocast device matches optimizer device: L45/d:99
- ValueError not assert, python -O strips asserts: L47/d:103
- Loss jump more than 2x, roll back to previous checkpoint: L81/d:86
