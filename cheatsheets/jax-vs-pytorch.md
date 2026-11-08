---
id: jax-vs-pytorch
title: JAX against PyTorch
code: JP
subtitle: Eager tape autograd against traced, compiled pure functions. The same MNIST MLP in both, with APIs and gotchas.
hue: 280
sources: phases/03-deep-learning-core/10-mini-framework, phases/03-deep-learning-core/11-intro-to-pytorch, phases/03-deep-learning-core/12-intro-to-jax
source_hash: 74354f7a9889b59d
---

## Side by side
type: comparison
from: phases/03-deep-learning-core/11-intro-to-pytorch/docs/en.md, phases/03-deep-learning-core/12-intro-to-jax/docs/en.md

| Factor | PyTorch | JAX |
|---|---|---|
| Autodiff | Tape-based autograd | Functional transforms |
| Execution | Eager (C++ kernels) | Traced + JIT compiled |
| Model | `nn.Module` | Pure function: `f(params, x) -> y` |
| TPU support | Community-maintained (torch_xla) | First-class |
| GPU support | Best-in-class (native CUDA) | Good (CUDA via XLA) |
| Debugging | Easy (eager, line-by-line) | Hard (tracing + compilation) |
| Speed (MNIST MLP) | ~0.5s/epoch | ~0.3s/epoch |
| Multi-device | `FSDP` | `jax.pmap(f)` |

## Same task, two APIs
type: comparison
from: phases/03-deep-learning-core/11-intro-to-pytorch/docs/en.md, phases/03-deep-learning-core/12-intro-to-jax/docs/en.md

| Task | PyTorch | JAX |
|---|---|---|
| Get gradients | `loss.backward()` | `jax.grad(loss_fn)(params, x, y)` |
| Clear gradients | `optimizer.zero_grad()` | Not needed. Grads are return values |
| Update params | `optimizer.step()` | `optax.apply_updates(params, updates)` |
| Adam | `torch.optim.Adam(model.parameters(), lr=1e-3)` | `optax.adam(learning_rate=1e-3)` |
| Batch over examples | `for x in batch:` | `jax.vmap(f)` |
| Hold params | `model.parameters()` | Immutable pytree of arrays |
| Seed randomness | `torch.manual_seed` | `jax.random.PRNGKey(42)` |
| Save weights | `torch.save(model.state_dict(), "model.pt")` | `checkpointer.save('/tmp/model', params)` |

## Two execution models
type: architecture
from: phases/03-deep-learning-core/11-intro-to-pytorch/docs/en.md, phases/03-deep-learning-core/12-intro-to-jax/docs/en.md

```arch
node | call | 1,1 | model(x) | runs now, eager | process
node | tape | 2,1 | Tape | records each op | store
node | bwd | 3,1 | loss.backward() | replays tape in reverse
node | step | 4,1 | optimizer.step() | mutates params
node | fn | 1,2 | Pure function | f(params, x) -> y
node | grad | 2,2 | jax.grad | returns a grad function
node | jit | 3,2 | jax.jit | traces on first call
node | xla | 4,2 | XLA | fused machine code | gpu
edge | call | tape | ops
edge | tape | bwd |
edge | bwd | step | .grad
edge | fn | grad |
edge | grad | jit |
edge | jit | xla | trace
```

## One JAX training step
type: flow
from: phases/03-deep-learning-core/12-intro-to-jax/docs/en.md, phases/03-deep-learning-core/12-intro-to-jax/code/jax_intro.py

1. **init_params**: `random.split(key, 3)` gives three keys. He scale is `jnp.sqrt(2.0 / 784)`.
2. **optimizer.init**: `opt_state = optimizer.init(params)` holds the Adam state.
3. **jax.value_and_grad**: returns the loss and the grads in one pass.
4. **optimizer.update**: turns the grads into updates and a new `opt_state`.
5. **optax.apply_updates**: returns new params. Nothing is mutated.
6. **First call**: JAX traces `train_step` and compiles it to XLA. The first epoch is slow.
7. **Later calls**: skip Python. Epochs 2-10 are fast. 10 epochs give ~97% test accuracy.

## PyTorch: MNIST MLP loop
type: annotated-code
lang: python
from: phases/03-deep-learning-core/11-intro-to-pytorch/docs/en.md, phases/03-deep-learning-core/11-intro-to-pytorch/code/pytorch_intro.py

```python
model = MNISTModel().to(device)                  # 784, 256, 128, 10
criterion = nn.CrossEntropyLoss()                # takes raw logits
optimizer = torch.optim.Adam(model.parameters(), lr=1e-3)
for epoch in range(10):
    model.train()                                # dropout on
    for images, labels in train_loader:
        images, labels = images.to(device), labels.to(device)
        optimizer.zero_grad()                    # grads accumulate
        outputs = model(images)
        loss = criterion(outputs, labels)
        loss.backward()                          # replays the tape
        optimizer.step()
torch.save(model.state_dict(), "mnist_mlp.pt")   # ~97.8% test accuracy
```

## JAX: MNIST MLP loop
type: annotated-code
lang: python
from: phases/03-deep-learning-core/12-intro-to-jax/code/jax_intro.py, phases/03-deep-learning-core/12-intro-to-jax/docs/en.md

```python
optimizer = optax.adam(learning_rate=1e-3)
@jax.jit                                           # compile to XLA
def train_step(params, opt_state, x, y):
    loss, grads = jax.value_and_grad(loss_fn)(params, x, y)
    updates, opt_state = optimizer.update(grads, opt_state, params)
    params = optax.apply_updates(params, updates)
    return params, opt_state, loss                 # new state out
key = random.PRNGKey(0)
params = init_params(key)                          # nested dict pytree
opt_state = optimizer.init(params)
for epoch in range(n_epochs):
    key, subkey = random.split(key)                # new key each epoch
    perm = random.permutation(subkey, len(X_train))
    params, opt_state, loss = train_step(params, opt_state, xb, yb)  # batch_size 128
```

## JAX transforms
type: task-table
span: 2
from: phases/03-deep-learning-core/12-intro-to-jax/docs/en.md

| Task | Code |
|---|---|
| Differentiate a function | `jax.grad(f)` |
| Second derivative | `jax.grad(jax.grad(f))` |
| Batch a one-example function | `jax.vmap(predict, in_axes=(None, 0))` |
| Per-example gradients | `jax.vmap(jax.grad(loss_fn), in_axes=(None, 0, 0))` |
| Split the batch over devices | `jax.pmap(train_step, axis_name='devices')` |
| Update every leaf | `jax.tree.map(lambda p, g: p - lr * g, params, grads)` |
| Set one element | `a = a.at[0].set(5)` |
| Clip, then Adam | `optax.chain(optax.clip_by_global_norm(1.0), optax.adam(1e-3))` |

## Install and run
type: command-table
from: phases/03-deep-learning-core/12-intro-to-jax/docs/en.md, phases/03-deep-learning-core/12-intro-to-jax/code/jax_intro.py, phases/03-deep-learning-core/11-intro-to-pytorch/docs/en.md

| Command | What it does |
|---|---|
| `pip install jax jaxlib optax flax` | Installs JAX, Optax and Flax |
| `pip install jax[cuda12]` | Installs JAX with GPU support |
| `pip install jax[tpu] -f <url>` | Installs JAX for TPU on Google Cloud |
| `XLA_PYTHON_CLIENT_PREALLOCATE=false` | Stops the 75% GPU memory preallocation |
| `jax.debug.print()` | Prints inside a jitted function |
| `fast_fn(x).block_until_ready()` | Waits for the result before you stop a timer |
| `torch.load("model.pt", weights_only=True)` | Loads a saved state dict |

## Gotchas
type: troubleshooting
from: phases/03-deep-learning-core/11-intro-to-pytorch/docs/en.md, phases/03-deep-learning-core/12-intro-to-jax/docs/en.md

| Symptom | Cause | Fix |
|---|---|---|
| `Expected all tensors to be on the same device` | Model and batch on different devices | Move both with `.to(device)` |
| Wrong gradients and no error | Softmax output into `CrossEntropyLoss` | Pass raw logits |
| First step is slow | JIT compiles on the first call | Warm up before you benchmark |
| `if x > 0` fails inside JIT | Control flow depends on a traced value | Use `jax.lax.cond` |
| Python loop inside JIT is slow | Loop over JAX arrays | Use `jax.lax.scan` or `jax.lax.fori_loop` |
| `a[0] = 5` fails | JAX arrays are immutable | Write `a = a.at[0].set(5)` |

## Use X when
type: tips
from: phases/03-deep-learning-core/12-intro-to-jax/docs/en.md, phases/03-deep-learning-core/11-intro-to-pytorch/docs/en.md

- Use PyTorch unless you have a specific reason to use JAX.
- Use PyTorch to debug line by line. `print()`, `pdb` and `breakpoint()` work.
- Use PyTorch to prototype fast and for the HuggingFace ecosystem.
- Use JAX when you have TPU access.
- Use JAX for per-example gradients.
- Use JAX for multi-device training at massive scale.

## Questions
type: qa
from: phases/03-deep-learning-core/10-mini-framework/docs/en.md, phases/03-deep-learning-core/11-intro-to-pytorch/docs/en.md, phases/03-deep-learning-core/12-intro-to-jax/docs/en.md

- **Why does JAX need pure functions?** JIT compilation requires them. Same inputs give the same outputs.
- **Why is there no `zero_grad` in JAX?** `jax.grad` returns grads as values. Tensors store no graph.
- **Why save `state_dict()`, not the model?** The model object uses pickle. Pickle breaks when you refactor.
- **Why `torch.no_grad()` in eval?** It disables autograd. Memory use goes down.
- **What maps from the mini framework?** `Sequential`, `Adam`, `zero_grad`, `backward`, `step`, `train`, `eval`.
