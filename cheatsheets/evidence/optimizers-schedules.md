# Evidence: cheatsheets/optimizers-schedules.md

Abbreviations: L06 = phases/03-deep-learning-core/06-optimizers, L09 = phases/03-deep-learning-core/09-learning-rate-schedules, L44 = phases/19-capstone-projects/44-cosine-lr-warmup, L45 = phases/19-capstone-projects/45-gradient-clipping-amp, L46 = phases/19-capstone-projects/46-gradient-accumulation. d = docs/en.md, c = code/main.py.

## Optimizers side by side (defaults, 5 rows)
- SGD lr=0.01, one rate for all weights, oscillates across a valley: L06/c:6, L06/d:21-25
- SGDMomentum lr=0.01, beta=0.9, about the last 10 gradients, 3,000-5,000 steps against 10,000: L06/c:15, L06/d:56, 60
- RMSProp divides by running RMS, epsilon 1e-8: L06/d:77, 452, L06/c:29
- Adam lr=0.001, beta1=0.9, beta2=0.999, momentum plus RMSProp plus bias correction: L06/c:29, L06/d:453
- AdamW weight_decay=0.01, decay not scaled by the adaptive factor: L06/c:56, L06/d:121

## Update rules (concepts, 7)
- SGD: L06/d:37-38
- Momentum: L06/d:49-54
- RMSProp: L06/d:66-71
- Adam moments: L06/d:83-88
- Bias correction, first ~10 steps: L06/d:92-99
- Adam step: L06/d:103-105
- AdamW step: L06/d:115-121

## Use each optimizer when (tips, 6)
- AdamW transformer lr=1e-4, wd=0.01-0.1: L06/d:168
- SGD + Momentum CNN lr=0.1, momentum=0.9, weight_decay=1e-4: L06/d:169, 426
- Adam GAN lr=2e-4, beta1=0.5: L06/d:170
- AdamW fine-tuning lr=2e-5, wd=0.01: L06/d:171
- AdamW lr=3e-4, wd=0.01 when unknown: L06/d:172
- Change lr first, then beta2: L06/d:107

## Schedules side by side (command-table, 8)
- constant_schedule, small models and debugging: L09/c:5, L09/d:37
- step_decay_schedule, abrupt drops spike the loss: L09/c:9, L09/d:49
- cosine_schedule, safe default for moderate budget: L09/c:13, L09/d:136
- warmup_cosine_schedule, large budget: L09/c:19, L09/d:134
- one_cycle_schedule lr/25 to lr/10000, small budget: L09/c:28-34, L09/d:98-99, 135
- CosineWithWarmup pins at lr_min: L44/c:40-52, L44/d:53
- InverseSqrtWarmup lr_max * sqrt(warmup_steps / step): L44/c:270-273
- LinearWarmupConstant ablation baseline: L44/c:242-247

## Pick a schedule (flow, 5)
1. Unknown total steps, constant LR with manual decay: L09/d:129-132
2. Large budget, warmup plus cosine, warmup 1-5%: L09/d:134, 138
3. Moderate budget, cosine, lr_min = lr_max / 10: L09/d:136, 140
4. Small budget, 1cycle, LR range test: L09/d:135, 139
5. Llama and GPT fine-tuning, get_cosine_schedule_with_warmup, 3-5%: L09/d:380-392

## Cosine with linear warmup (annotated-code, 11 lines)
- lr method body: L44/c:68-78
- step zero is exactly zero, floor past total_steps: L44/c:43-46, L44/d:53

## Clip and scale in one step (annotated-code, 13 lines)
- zero_grad(set_to_none=True): L45/c:207
- autocast block and loss: L45/c:209-211
- loss finiteness check, no update(): L45/c:213-221
- scaler.scale(loss).backward(): L45/c:224
- scaler.unscale_, clip after unscale: L45/c:227, L45/d:23
- has_non_finite_grad then scaler.update(), scaler halves: L45/c:229-231, L45/d:93
- clip_global_l2_norm: L45/c:255
- scaler.step and scaler.update, doubles or halves: L45/c:257-258, L45/d:93

## Accumulate gradients (annotated-code, 7 lines)
- accumulation_steps formula: L46/d:115
- chunks loop, divide by n, backward, opt.step once: L46/d:54-57, 38-39
- grads sum in param.grad: L46/d:38
- no_sync_context for non-final micro-batches: L46/c:114-118

## Numbers to know (defaults, 8)
- Adam/AdamW lr 1e-4 to 3e-4, fine-tuning 1e-5 to 5e-5: L06/d:145-146
- Warmup 1-5%: L09/d:75. 1-3 percent: L44/d:100
- lr_min 10 percent of lr_max, zero leaves training unfinished: L44/d:101
- Step decay gamma 0.1, step_size = 30: L09/d:47
- max_norm 1.0 default for language-model training: L45/d:89
- Scaling factor near 2^17 or 2^18: L45/d:59
- Skip rate alert 5 percent over 1,000-step window: L45/d:87
- max_abs_diff < 1e-4: L46/d:88

## Troubleshooting (8)
- lr > 0.01, loss explodes, NaN weights; fix lower lr, add warmup: L06/d:129, 133, L09/d:69
- lr < 0.00001, loss decreases slowly; sweep lr_max first: L06/d:131, 135, L44/d:99
- Constant lr oscillates near the minimum; decay with cosine or steps: L09/d:19, 37, L06/d:139
- Vertical loss from one batch, norm spike, clip to 1.0: L45/d:19
- Scaling factor never changed, missing update() on skip: L45/d:93
- Optimizer step 16 times too big, divide by accum_steps: L46/d:21, 38
- scheduler.step() before optimizer.step(): L06/d:424
- Warmup as absolute count does not scale: L44/d:100

## Questions (qa, 6)
- Warmup for Adam, zero-initialized estimates: L09/d:67-69
- AdamW same proportional shrinkage: L06/d:121
- SGD flatter minima: L06/d:426
- 1cycle needs total steps in advance: L09/d:102
- Doubling accum_steps doubles wall time: L46/d:76
- CPU autocast BF16 by default, no loss scaling: L45/d:51
