---
name: skill-jax-patterns
description: Functional programming patterns in JAX -- when and how to use grad, jit, vmap, and pmap
version: 1.0.0
phase: 3
lesson: 12
tags: [jax, functional-programming, autodiff, compilation, vectorization]
---

# JAX Functional Patterns

JAX transforms pure functions. Every pattern below follows one rule: write a function that takes inputs and returns outputs, with no side effects. Then transform it.

## The Four Transforms

### grad -- Differentiate a function

```python
grads = jax.grad(loss_fn)(params, x, y)
loss, grads = jax.value_and_grad(loss_fn)(params, x, y)
```

Use when: you need gradients for optimization.
Constraint: the function must return a scalar. For non-scalar outputs, use `jax.jacobian`.

### jit -- Compile a function

```python
fast_fn = jax.jit(f)
```

Use when: the function will be called more than once with same-shaped inputs.
Constraint: no Python control flow that depends on traced values. Use `jax.lax.cond` for conditionals, `jax.lax.scan` for loops.

### vmap -- Vectorize a function

```python
batch_fn = jax.vmap(f, in_axes=(None, 0))
```

Use when: you wrote a function for one example and need it to work on batches.
`in_axes` specifies which argument axis to batch over. `None` means do not batch (broadcast).

### pmap -- Parallelize across devices

```python
parallel_fn = jax.pmap(f, axis_name='devices')
```

Use when: you have multiple GPUs/TPUs and want data parallelism.
Inside the function, `jax.lax.pmean(x, 'devices')` averages across devices.

## Composition Rules

Transforms compose. The order matters:

```python
per_example_grads = jax.jit(jax.vmap(jax.grad(loss_fn), in_axes=(None, 0, 0)))
```

Reading right to left: take gradient of loss_fn, vectorize over examples, compile the result.

Valid compositions:
- `jit(grad(f))` -- compiled gradient computation
- `jit(vmap(f))` -- compiled batched computation
- `vmap(grad(f))` -- per-example gradients
- `pmap(jit(f))` -- parallel compiled computation
- `grad(jit(f))` -- gradient of compiled function (same as jit(grad(f)))

## Parameter Management Pattern

JAX parameters are pytrees (nested dicts of arrays):

```python
params = {
    'layer1': {'w': jnp.zeros((784, 256)), 'b': jnp.zeros(256)},
    'layer2': {'w': jnp.zeros((256, 10)),  'b': jnp.zeros(10)},
}
```

Update all parameters at once:
```python
params = jax.tree.map(lambda p, g: p - lr * g, params, grads)
```

Count parameters:
```python
n_params = sum(p.size for p in jax.tree.leaves(params))
```

## PRNG Key Management

JAX requires explicit random keys:

```python
key = jax.random.PRNGKey(0)
key, subkey = jax.random.split(key)
noise = jax.random.normal(subkey, shape)
```

For multiple random operations, split once:
```python
keys = jax.random.split(key, n)
```

Never reuse a key. Always split before using.

## Common Mistakes

1. **Mutating arrays inside jit**: JAX arrays are immutable. Use `x.at[i].set(v)` instead of `x[i] = v`.

2. **Using Python print inside jit**: `print` runs during tracing, not execution. Use `jax.debug.print("{}", x)`.

3. **Python if/for inside jit on traced values**: Use `jax.lax.cond`, `jax.lax.switch`, `jax.lax.scan`, `jax.lax.fori_loop`.

4. **Forgetting `.block_until_ready()`**: JAX uses async dispatch. For benchmarking, call `.block_until_ready()` to wait for actual completion.

5. **Reusing PRNG keys**: Two operations with the same key produce the same "random" values. Always split.

6. **Global state in jitted functions**: Global variables are captured at trace time. Changes after tracing are invisible. Pass everything as arguments.

## Decision Checklist

1. Is the function called more than once? Add `@jax.jit`.
2. Does it need gradients? Wrap with `jax.grad` or `jax.value_and_grad`.
3. Does it process one example but you have a batch? Wrap with `jax.vmap`.
4. Do you have multiple devices? Wrap with `jax.pmap`.
5. Does it use randomness? Thread PRNG keys through explicitly.
6. Does it have Python control flow on array values? Replace with `jax.lax` primitives.

## When to Use JAX

Use JAX when:
- You need per-example gradients (differential privacy, Fisher information)
- You are training on TPUs (JAX is the native framework)
- You need higher-order derivatives (Hessians, Jacobians)
- You want to compile the entire training step to a single kernel
- Your team is at Google DeepMind or Anthropic

Use PyTorch when:
- You want the largest ecosystem (HuggingFace, torchvision, Lightning)
- You prioritize debugging ease over raw speed
- You are deploying to NVIDIA GPUs with TorchServe/Triton
- You are hiring (more PyTorch developers exist)
- You want to iterate fast on new architectures
