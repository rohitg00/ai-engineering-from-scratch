---
id: nn-debugging
title: Debugging Neural Network Training
code: DN
subtitle: Find silent training bugs from the symptom. Checks, thresholds, init rules, clipping and AMP order, profilers.
hue: 12
sources: phases/03-deep-learning-core/08-weight-initialization, phases/03-deep-learning-core/13-debugging-neural-networks, phases/00-setup-and-tooling/12-debugging-and-profiling, phases/19-capstone-projects/45-gradient-clipping-amp
source_hash: af3f0a481904da40
---

## Symptom, cause, first fix
type: troubleshooting
from: phases/03-deep-learning-core/13-debugging-neural-networks/docs/en.md

| Symptom | Cause | Fix |
|---|---|---|
| Loss stuck at -log(1/num_classes) | Model predicts a uniform distribution | Check the data pipeline and the labels |
| Loss NaN after a few steps | Learning rate too high | Reduce LR by 10x |
| Loss NaN immediately | log(0) or division by zero | Add epsilon to log and division |
| Loss oscillates wildly | LR too high or batch too small | Reduce LR, increase batch size |
| Loss decreases, then plateaus | LR too high for the fine-tuning phase | Add a cosine or step decay schedule |
| Train acc high, test acc low | Overfitting | Add dropout, weight decay, more data |
| Train acc = test acc = chance | Model learns nothing | Run the overfit-one-batch test |
| Gradients all zero | Dead ReLUs or a detached graph | Switch to LeakyReLU, check `.requires_grad` |

## Common PyTorch bugs
type: troubleshooting
from: phases/03-deep-learning-core/13-debugging-neural-networks/docs/en.md, phases/00-setup-and-tooling/12-debugging-and-profiling/docs/en.md

| Symptom | Cause | Fix |
|---|---|---|
| Loss oscillates, gradients accumulate | No `optimizer.zero_grad()` | Call it before `loss.backward()` |
| Test accuracy varies between runs | No `model.eval()` at test time | Add `model.eval()` and `torch.no_grad()` |
| Wrong results, no error | Silent broadcasting of shapes | Print shapes after every operation |
| `RuntimeError: expected CUDA tensor` | CPU and GPU mismatch | Use `.to(device)` on model AND data |
| Graph grows forever, OOM | Tensors not detached | Use `.detach()` or `with torch.no_grad()` |
| `RuntimeError: modified by in-place operation` | In-place op breaks autograd | Replace `x += 1` with `x = x + 1` |
| Loss stuck at random-chance level | Inputs not normalized | Normalize inputs to mean=0, std=1 |
| Cross-entropy expects `Long`, got `Float` | Labels have the wrong dtype | Cast labels: `labels.long()` |

## Loss not decreasing: check in this order
type: flow
from: phases/03-deep-learning-core/13-debugging-neural-networks/docs/en.md

1. **Learning rate**: too high, loss oscillates or explodes. Too low, loss barely moves.
2. **Learning rate**: try 3 rates 10x apart, for example 1e-2, 1e-3, 1e-4.
3. **Gradients**: all zeros means dead ReLUs or vanishing gradients.
4. **Gradients**: NaN or Inf means exploding gradients.
5. **Data pipeline**: shuffled labels give random-chance accuracy.
6. **Data pipeline**: a preprocessing bug makes the model learn noise.
7. **Architecture**: too small underfits. Too deep is hard to optimize.

## Diagnostic functions
type: task-table
from: phases/00-setup-and-tooling/12-debugging-and-profiling/code/debug_tools.py, phases/03-deep-learning-core/13-debugging-neural-networks/code/debug_neural_nets.py

| Task | Code |
|---|---|
| Shape, dtype, device, NaN of a tensor | `debug_print(name, tensor)` |
| Map every layer shape | `check_shapes(model, sample_input)` |
| Find NaN or Inf gradients | `detect_nan(model, loss, step)` |
| Find tensors on another device | `check_devices(model, *tensors)` |
| Total norm, large or zero grads | `check_gradient_health(model)` |
| Prove the loop can learn | `overfit_one_batch(model, x_batch, y_batch, criterion)` |
| Sweep the learning rate | `find_learning_rate(model, x_data, y_data, criterion)` |
| Compare backprop to finite differences | `gradient_check(model, x, y, criterion, eps=1e-4)` |

## Hook a debugger into a model
type: annotated-code
lang: python
from: phases/03-deep-learning-core/13-debugging-neural-networks/code/debug_neural_nets.py, phases/03-deep-learning-core/13-debugging-neural-networks/docs/en.md

```python
debugger1 = NetworkDebugger(model1)        # hooks Linear, Conv2d, ReLU, LeakyReLU
debugger1.record_loss(loss.item())          # call once per step
debugger1.print_report()                    # loss, activation, gradient checks
debugger1.remove_hooks()
with torch.autograd.detect_anomaly():       # built-in NaN and Inf detection
    loss.backward()
```

## Thresholds the checks use
type: defaults
from: phases/03-deep-learning-core/13-debugging-neural-networks/code/debug_neural_nets.py, phases/03-deep-learning-core/13-debugging-neural-networks/docs/en.md, phases/00-setup-and-tooling/12-debugging-and-profiling/code/debug_tools.py

| Setting | Default | Note |
|---|---|---|
| `fraction_zero` | > 0.5 | Dead neurons. Use LeakyReLU or a lower LR |
| Activation `std` | < 1e-6 | Collapsed activations |
| Gradient `abs_mean` | < 1e-7 | Vanishing gradient in that layer |
| Gradient `abs_mean` | > 100 | Exploding gradient in that layer |
| First / last grad ratio | > 100 | Vanishing gradients through depth |
| `rel_diff` | < 1e-5 | Gradient check passes. > 1e-3 is a bug |
| Overfit `final_loss` | > 0.1 | FAIL: model or loop is broken |
| `start_lr` | 1e-7 | LR finder sweeps up to `end_lr=10` |

## Initialization by activation
type: concepts
from: phases/03-deep-learning-core/08-weight-initialization/docs/en.md, phases/03-deep-learning-core/08-weight-initialization/code/main.py

- **Zero init**: all neurons stay identical. One effective neuron for any width.
- **Variance rule**: $\mathrm{Var}(z) = \text{fan}_{\text{in}} \cdot \mathrm{Var}(w) \cdot \mathrm{Var}(x)$
- **Xavier**: $\mathrm{Var}(w) = 2/(\text{fan}_{\text{in}} + \text{fan}_{\text{out}})$ for sigmoid and tanh.
- **Kaiming**: $\mathrm{Var}(w) = 2/\text{fan}_{\text{in}}$ for ReLU, Leaky ReLU, GELU and Swish.
- **Residual scaling**: scale residual layers by $1/\sqrt{2N}$ for $N$ layers.
- **Random N(0,1)**: explodes by layer 5. **N(0,0.01)**: vanishes by layer 10.
- **Check**: activation magnitudes stay between 0.5 and 2.0 through all layers.
- **PyTorch**: `nn.Linear(512, 256)` defaults to Kaiming uniform.

## Clip and scale step order
type: architecture
from: phases/19-capstone-projects/45-gradient-clipping-amp/docs/en.md

```arch
node | fwd | 1,1 | Forward in autocast | loss in FP32 | process
node | fin | 2,1 | isfinite loss? | no: skip step | process
node | bwd | 3,1 | scale(loss).backward | FP16 grads | gpu
node | uns | 4,1 | unscale_ optimizer | true gradients | process
node | nan | 4,2 | NaN or Inf grad? | yes: skip, update halves | process
node | clip | 3,2 | clip_grad_norm_ | max_norm 1.0 | process
node | step | 2,2 | scaler.step | optimizer step | process
node | upd | 1,2 | scaler.update | doubles or halves | store
edge | fwd | fin |
edge | fin | bwd | finite
edge | bwd | uns |
edge | uns | nan |
edge | nan | clip | clean
edge | clip | step |
edge | step | upd |
```

## One AMP training step
type: annotated-code
lang: python
from: phases/19-capstone-projects/45-gradient-clipping-amp/code/main.py, phases/19-capstone-projects/45-gradient-clipping-amp/docs/en.md

```python
self.optimizer.zero_grad(set_to_none=True)
with torch.amp.autocast(device_type=self.device_type, dtype=self.amp_dtype):
    loss = self._loss_fn(self.model(inputs), targets)
if not torch.isfinite(loss).all().item():   # skip, no scaler.update()
    ...
self.scaler.scale(loss).backward()
self.scaler.unscale_(self.optimizer)        # before the clip
if has_non_finite_grad(self.model.parameters()):
    self.scaler.update()                    # halves the scale
pre_clip, post_clip = clip_global_l2_norm(list(self.model.parameters()), self.max_norm)
self.scaler.step(self.optimizer)
self.scaler.update()                        # every step
scale = self.scaler.get_scale()             # log next to lr and norm
```

## Profile and inspect
type: command-table
from: phases/00-setup-and-tooling/12-debugging-and-profiling/docs/en.md, phases/19-capstone-projects/45-gradient-clipping-amp/docs/en.md

| Command | What it does |
|---|---|
| `python -m cProfile -s cumtime train.py` | Every function call, sorted by cumulative time |
| `kernprof -l -v train.py` | Line by line time for `@profile` functions |
| `python -m memory_profiler your_script.py` | Line by line memory use |
| `tracemalloc.take_snapshot()` | CPU memory by line after `tracemalloc.start()` |
| `torch.cuda.memory_summary()` | GPU memory allocated and cached |
| `tensorboard --logdir=runs` | Loss curves, weight and gradient histograms |
| `breakpoint()` | Stop in pdb. `p outputs.shape`, `c` continue, `q` quit |
| `python3 code/main.py` | Clip and AMP demo. At least one row is a `SKIP` |

## Numbers to watch
type: qa
from: phases/19-capstone-projects/45-gradient-clipping-amp/docs/en.md, phases/00-setup-and-tooling/12-debugging-and-profiling/docs/en.md, phases/03-deep-learning-core/13-debugging-neural-networks/docs/en.md

- **What does a healthy GradScaler scale do?** It climbs in powers of two to near `2^17` or `2^18`.
- **When is the skip rate an alert?** Above 5 percent over a 1,000-step rolling window.
- **The scale never changes?** The skip path forgets `scaler.update()`.
- **Data loading takes 60% of the time?** Set `num_workers > 0` in the DataLoader.
- **Out of memory?** Reduce the batch size first. Then use `torch.cuda.empty_cache()`.
- **Test accuracy is 99%?** Check for data leakage. Split first, preprocess second.
- **Train loss goes down and val loss goes up?** The model overfits.

## Checklist before full training
type: tips
from: phases/03-deep-learning-core/13-debugging-neural-networks/docs/en.md, phases/00-setup-and-tooling/12-debugging-and-profiling/docs/en.md

- Run the overfit-one-batch test. If it fails, stop.
- Print the model summary. Verify the parameter count.
- Run one forward pass with random data. Check the output shape.
- Train for 5 epochs. Verify that the loss decreases.
- Check activation statistics and gradient flow.
- Print 5 random samples with labels.
- Log loss, learning rate and gradient norms during training.
