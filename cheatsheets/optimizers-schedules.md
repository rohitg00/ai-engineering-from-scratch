---
id: optimizers-schedules
title: Optimizers and Learning Rate Schedules
code: OL
subtitle: Pick SGD, Adam or AdamW, shape the learning rate, then clip, scale and accumulate gradients safely.
hue: 28
sources: phases/03-deep-learning-core/06-optimizers, phases/03-deep-learning-core/09-learning-rate-schedules, phases/19-capstone-projects/44-cosine-lr-warmup, phases/19-capstone-projects/45-gradient-clipping-amp, phases/19-capstone-projects/46-gradient-accumulation
source_hash: 6af6a467fef2cb6e
---

## Optimizers side by side
type: comparison
span: 2
from: phases/03-deep-learning-core/06-optimizers/docs/en.md, phases/03-deep-learning-core/06-optimizers/code/main.py

| Optimizer | Defaults | Behaviour |
|---|---|---|
| `SGD` | `lr=0.01` | One rate for all weights. Oscillates across a valley |
| `SGDMomentum` | `lr=0.01, beta=0.9` | Keeps about the last 10 gradients. 3,000-5,000 steps, not 10,000 |
| RMSProp | `epsilon=1e-8` | Divides each gradient by the running RMS |
| `Adam` | `lr=0.001, beta1=0.9, beta2=0.999` | Momentum plus RMSProp plus bias correction |
| `AdamW` | `weight_decay=0.01` | Same as Adam. Decay is not scaled by the adaptive factor |

## Update rules
type: concepts
from: phases/03-deep-learning-core/06-optimizers/docs/en.md

- **SGD**: $w = w - \text{lr} \cdot g$
- **Momentum**: $m_t = \beta m_{t-1} + g$, then $w = w - \text{lr} \cdot m_t$
- **RMSProp**: $s_t = \beta s_{t-1} + (1 - \beta) g^2$, step $\text{lr} \cdot g / (\sqrt{s_t} + \epsilon)$
- **Adam moments**: $m_t = \beta_1 m_{t-1} + (1 - \beta_1) g$ and $v_t = \beta_2 v_{t-1} + (1 - \beta_2) g^2$
- **Bias correction**: $\hat{m} = m_t / (1 - \beta_1^t)$. It matters for the first ~10 steps.
- **Adam step**: $w = w - \text{lr} \cdot \hat{m} / (\sqrt{\hat{v}} + \epsilon)$
- **AdamW step**: the Adam step, then $- \text{lr} \cdot \lambda w$ on the weights.

## Use each optimizer when
type: tips
from: phases/03-deep-learning-core/06-optimizers/docs/en.md

- Use AdamW for a transformer or LLM: lr=1e-4, wd=0.01-0.1.
- Use SGD + Momentum for a CNN or ResNet: lr=0.1, momentum=0.9, weight_decay=1e-4.
- Use Adam for a GAN: lr=2e-4, beta1=0.5.
- Use AdamW for fine-tuning: lr=2e-5, wd=0.01.
- Use AdamW with lr=3e-4, wd=0.01 when you do not know yet.
- When the defaults fail, change lr first. Then $\beta_2$. Almost never change $\beta_1$ or $\epsilon$.

## Schedules side by side
type: command-table
span: 2
from: phases/03-deep-learning-core/09-learning-rate-schedules/docs/en.md, phases/03-deep-learning-core/09-learning-rate-schedules/code/main.py, phases/19-capstone-projects/44-cosine-lr-warmup/code/main.py

| Command | What it does |
|---|---|
| `constant_schedule(step, lr=0.01)` | Same rate every step. Use it for small models and debugging |
| `step_decay_schedule(step, lr=0.1, step_size=100, gamma=0.1)` | Cuts lr by gamma at fixed steps. Abrupt drops can spike the loss |
| `cosine_schedule(step, lr=0.01, total_steps=1000, lr_min=1e-5)` | Cosine from lr to lr_min. The safe default for a moderate budget |
| `warmup_cosine_schedule(step, lr=0.01, total_steps=1000, warmup_steps=100, lr_min=1e-5)` | Linear ramp, then cosine. Use it for a large budget |
| `one_cycle_schedule(step, lr=0.01, total_steps=1000)` | Up from lr/25, then down to lr/10000. Use it for a small budget |
| `CosineWithWarmup(warmup_steps, total_steps, lr_max, lr_min)` | Warmup plus cosine with checked boundaries. Pins at `lr_min` |
| `InverseSqrtWarmup(warmup_steps, lr_max)` | Linear warmup, then `lr_max * sqrt(warmup_steps / step)` |
| `LinearWarmupConstant(warmup_steps, lr_max)` | Linear warmup, then a flat `lr_max`. An ablation baseline |

## Pick a schedule
type: flow
from: phases/03-deep-learning-core/09-learning-rate-schedules/docs/en.md

1. **Total steps unknown**: use a constant LR with manual decay.
2. **Large budget, days or weeks**: use warmup plus cosine decay. Warmup = 1-5% of steps.
3. **Moderate budget**: use cosine annealing. Set lr_min = lr_max / 10.
4. **Small budget, hours**: use 1cycle. Find lr_max with the LR range test.
5. **Fine-tuning a Llama or GPT model**: use `get_cosine_schedule_with_warmup` with warmup = 3-5% of total steps.

## Cosine with linear warmup
type: annotated-code
lang: python
from: phases/19-capstone-projects/44-cosine-lr-warmup/code/main.py

```python
def lr(self, step: int) -> float:
    if step < 0:
        raise ValueError(f"step must be non-negative, got {step}")
    if self.warmup_steps > 0 and step <= self.warmup_steps:
        return self.lr_max * (step / self.warmup_steps)   # 0 at step 0
    if step >= self.total_steps:
        return self.lr_min                                 # floor, no extrapolation
    decay_span = max(1, self.total_steps - self.warmup_steps)
    progress = (step - self.warmup_steps) / decay_span
    cosine = 0.5 * (1.0 + math.cos(math.pi * progress))
    return self.lr_min + (self.lr_max - self.lr_min) * cosine
```

## Clip and scale in one step
type: annotated-code
lang: python
from: phases/19-capstone-projects/45-gradient-clipping-amp/code/main.py, phases/19-capstone-projects/45-gradient-clipping-amp/docs/en.md

```python
self.optimizer.zero_grad(set_to_none=True)
with torch.amp.autocast(device_type=self.device_type, dtype=self.amp_dtype):
    predictions = self.model(inputs)
    loss = self._loss_fn(predictions, targets)
if not torch.isfinite(loss).all().item():   # skip, do not call update()
    return self._record_skip(...)
self.scaler.scale(loss).backward()
self.scaler.unscale_(self.optimizer)        # clip after unscale
if has_non_finite_grad(self.model.parameters()):
    self.scaler.update()                     # skip, the scaler halves
pre_clip, post_clip = clip_global_l2_norm(list(self.model.parameters()), self.max_norm)
self.scaler.step(self.optimizer)
self.scaler.update()                         # doubles or halves the factor
```

## Accumulate gradients
type: annotated-code
lang: python
from: phases/19-capstone-projects/46-gradient-accumulation/docs/en.md, phases/19-capstone-projects/46-gradient-accumulation/code/main.py

```python
accumulation_steps = effective_batch // (micro_batch * world_size)
for x, y in chunks(x_full, y_full, n):    # n micro-batches
    scaled = criterion(model(x), y) / n     # divide before backward
    scaled.backward()                       # grads sum in param.grad
opt.step()                                  # once per effective batch
with no_sync_context(model):                # all micro-batches but the last
    loss.backward()
```

## Numbers to know
type: defaults
from: phases/03-deep-learning-core/06-optimizers/docs/en.md, phases/03-deep-learning-core/09-learning-rate-schedules/docs/en.md, phases/19-capstone-projects/44-cosine-lr-warmup/docs/en.md, phases/19-capstone-projects/45-gradient-clipping-amp/docs/en.md, phases/19-capstone-projects/46-gradient-accumulation/docs/en.md

| Setting | Default | Note |
|---|---|---|
| Adam/AdamW lr | 1e-4 to 3e-4 | Fine-tuning uses 1e-5 to 5e-5 |
| Warmup | 1-5% | Lesson 44 says 1-3 percent of total steps |
| `lr_min` | 10 percent | Of `lr_max`. Zero leaves training unfinished |
| Step decay | $\gamma = 0.1$ | step_size = 30 drops lr 10x every 30 epochs |
| `max_norm` | 1.0 | The default for language-model training |
| Scaling factor | `2^17` | A healthy run saturates near `2^17` or `2^18` |
| Skip rate alert | 5 percent | Over a 1,000-step rolling window |
| Accumulation check | `max_abs_diff < 1e-4` | Full batch against micro-batches |

## Troubleshooting
type: troubleshooting
from: phases/03-deep-learning-core/06-optimizers/docs/en.md, phases/03-deep-learning-core/09-learning-rate-schedules/docs/en.md, phases/19-capstone-projects/44-cosine-lr-warmup/docs/en.md, phases/19-capstone-projects/45-gradient-clipping-amp/docs/en.md, phases/19-capstone-projects/46-gradient-accumulation/docs/en.md

| Symptom | Cause | Fix |
|---|---|---|
| Loss explodes, NaN weights | lr too high (lr > 0.01) | Lower lr. Add warmup |
| Loss decreases slowly | lr too low (lr < 0.00001) | Raise lr. Sweep `lr_max` first |
| Loss oscillates near a minimum | Constant lr is too large late | Decay with cosine or steps |
| Loss goes vertical on one batch | Gradient norm spike | Clip the global L2 norm to 1.0 |
| Scaling factor never changed | No `update()` on the skip path | Call `scaler.update()` every step |
| Optimizer step 16 times too big | Loss summed over micro-batches | Divide each loss by `accum_steps` |
| Subtle schedule bugs | `scheduler.step()` first | Call `optimizer.step()` first |
| Long warmup does not scale | Warmup set as an absolute count | Set warmup as a fraction of total steps |

## Questions
type: qa
from: phases/03-deep-learning-core/06-optimizers/docs/en.md, phases/03-deep-learning-core/09-learning-rate-schedules/docs/en.md, phases/19-capstone-projects/45-gradient-clipping-amp/docs/en.md, phases/19-capstone-projects/46-gradient-accumulation/docs/en.md

- **Why warmup for Adam?** Its moment estimates start at zero. Early steps use bad statistics.
- **Why AdamW over Adam plus L2?** Every parameter gets the same proportional shrinkage.
- **Why SGD for CNNs?** SGD finds flatter minima. They often generalize better.
- **What does 1cycle need?** The total number of steps in advance.
- **Does accumulation save time?** No. Doubling `accum_steps` doubles the wall time per optimizer step.
- **Does CPU autocast need loss scaling?** No. CPU autocast uses BF16 by default.
