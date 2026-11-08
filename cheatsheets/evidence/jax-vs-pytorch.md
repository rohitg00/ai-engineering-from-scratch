# Evidence: cheatsheets/jax-vs-pytorch.md

Abbreviations: P03 = phases/03-deep-learning-core. L10 = P03/10-mini-framework, L11 = P03/11-intro-to-pytorch, L12 = P03/12-intro-to-jax. d = docs/en.md. C11 = L11/code/pytorch_intro.py. C12 = L12/code/jax_intro.py.

## Side by side (defaults, 8 rows)
- Autodiff: Tape-based autograd, Functional transforms: L11/d:275
- Execution: Eager (C++ kernels), Traced + JIT compiled: L11/d:276
- Model: `nn.Module`, Pure function `f(params, x) -> y`: L12/d:35
- TPU support: Community-maintained (torch_xla), First-class: L12/d:216
- GPU support: Best-in-class (native CUDA), Good (CUDA via XLA): L12/d:217
- Debugging: Easy (eager, line-by-line), Hard (tracing + compilation): L12/d:218
- Speed MNIST MLP: ~0.5s/epoch, ~0.3s/epoch: L11/d:278
- Multi-device: `FSDP`, `jax.pmap(f)`: L12/d:39, 221

## Same task, two APIs (defaults, 8 rows)
- Get gradients: `loss.backward()`, `jax.grad(loss_fn)(params, x, y)`: L12/d:36
- Clear gradients: `optimizer.zero_grad()`, not needed in JAX: L11/d:116, L12/d:372
- Update params: `optimizer.step()`, `optax.apply_updates(params, updates)`: L11/d:212, L12/d:321
- Adam: `torch.optim.Adam(model.parameters(), lr=1e-3)`, `optax.adam(learning_rate=1e-3)`: L11/d:427, L12/d:336
- Batch over examples: `for x in batch:`, `jax.vmap(f)`: L12/d:38
- Hold params: `model.parameters()`, immutable pytree of arrays: L12/d:40
- Seed randomness: `torch.manual_seed`, `jax.random.PRNGKey(42)`: L12/d:233, 238
- Save weights: `torch.save(model.state_dict(), "model.pt")`, `checkpointer.save('/tmp/model', params)`: L11/d:475, L12/d:467

## Two execution models (architecture, 8 nodes, 6 edges)
- model(x) runs now, eager: L11/d:35
- Tape records each op: L11/d:103
- loss.backward() replays the tape in reverse: L11/d:103
- optimizer.step() updates params: L11/d:212
- Pure function f(params, x) -> y: L12/d:35
- jax.grad returns a grad function: L12/d:74
- jax.jit traces on the first call: L12/d:98
- XLA fused machine code: L12/d:98, 491
- edges .grad: L11/d:110, trace handed to XLA: L12/d:98

## One JAX training step (flow, 7 steps)
1. random.split(key, 3), jnp.sqrt(2.0 / 784): C12:18-19, L12/d:272-273, 293
2. opt_state = optimizer.init(params): C12:81, L12/d:344
3. jax.value_and_grad returns loss and grads in one pass: C12:59, L12/d:331
4. optimizer.update gives updates and opt_state: C12:60
5. optax.apply_updates returns new params: C12:61, L12/d:372
6. first call traces and compiles to XLA, first epoch slow: L12/d:98, 370
7. later calls skip Python, epochs 2-10 fast, ~97% test accuracy: L12/d:100, 370

## PyTorch: MNIST MLP loop (annotated-code, 13 lines)
- MNISTModel().to(device), 784 -> 256 -> 128 -> 10: L11/d:425, 337
- nn.CrossEntropyLoss() takes raw logits: L11/d:426, 169, 357
- torch.optim.Adam(model.parameters(), lr=1e-3): L11/d:427
- for epoch in range(10): L11/d:436
- model.train(), dropout layers: L11/d:367, 346
- loop body images.to(device), zero_grad, model, criterion, backward, step: L11/d:371-377
- zero_grad because grads accumulate: L11/d:116
- backward replays the tape: L11/d:103
- torch.save(model.state_dict(), "mnist_mlp.pt"), ~97.8%: L11/d:449, 454

## JAX: MNIST MLP loop (annotated-code, 14 lines)
- optax.adam(learning_rate=1e-3): C12:54
- @jax.jit train_step body: C12:57-62
- jit compiles to XLA: L12/d:331
- random.PRNGKey(0), init_params(key), optimizer.init(params): C12:79-81
- params is a nested dict pytree: L12/d:293
- for epoch in range(n_epochs), random.split, random.permutation: C12:86-88
- train_step call per batch, batch_size 128: C12:83, 98

## JAX transforms (task-table, 8 rows)
- jax.grad(f): L12/d:70
- jax.grad(jax.grad(f)): L12/d:79
- jax.vmap(predict, in_axes=(None, 0)): L12/d:126
- jax.vmap(jax.grad(loss_fn), in_axes=(None, 0, 0)): L12/d:134
- jax.pmap(train_step, axis_name='devices'): L12/d:142
- jax.tree.map(lambda p, g: p - lr * g, params, grads): L12/d:164
- a = a.at[0].set(5): L12/d:58
- optax.chain(optax.clip_by_global_norm(1.0), optax.adam(1e-3)): L12/d:485

## Install and run (command-table, 7 rows)
- pip install jax jaxlib optax flax: L12/d:439
- pip install jax[cuda12] for GPU: L12/d:442-445
- pip install jax[tpu] -f <url> for TPU on Google Cloud: L12/d:448-451
- XLA_PYTHON_CLIENT_PREALLOCATE=false, 75% preallocation: L12/d:460
- jax.debug.print() inside JIT: L12/d:458
- fast_fn(x).block_until_ready() before the timer stops: C12:163-166
- torch.load("model.pt", weights_only=True): L11/d:478

## Gotchas (troubleshooting, 6 rows)
- Expected all tensors to be on the same device, move to one device: L11/d:73
- softmax into CrossEntropyLoss gives wrong gradients silently, pass raw logits: L11/d:169
- first JIT call slow, warm up before benchmarking: L12/d:456
- if x > 0 on a traced array, use jax.lax.cond: L12/d:108, 112
- Python loops inside JIT, use jax.lax.scan or jax.lax.fori_loop: L12/d:457
- a[0] = 5 not allowed, a = a.at[0].set(5): L12/d:58

## Use X when (tips, 6 bullets)
- use PyTorch unless you have a specific reason to use JAX: L12/d:226
- print(), pdb, breakpoint() work in PyTorch: L11/d:280, 35
- prototyping faster (mutate and go), HuggingFace ecosystem: L12/d:222, 219
- JAX for TPU access: L12/d:226
- JAX for per-example gradients: L12/d:226
- JAX for multi-device training at massive scale: L12/d:226

## Questions (qa, 5 bullets)
- JIT compilation requires pure functions, same inputs give same outputs: L12/d:42
- jax.grad returns a function, no graph stored on tensors, no .zero_grad(): L12/d:74, 372
- save state_dict(), model object uses pickle which breaks on refactor: L11/d:482
- torch.no_grad() disables autograd and reduces memory: L11/d:402
- Sequential, Adam, zero_grad, backward, step, train, eval map one-to-one: L10/d:671
