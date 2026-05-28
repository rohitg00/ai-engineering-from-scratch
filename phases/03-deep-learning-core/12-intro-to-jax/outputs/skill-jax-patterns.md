---
name: skill-jax-patterns
description: JAX における functional programming patterns -- grad、jit、vmap、pmap をいつ、どう使うか
version: 1.0.0
phase: 3
lesson: 12
tags: [jax, functional-programming, autodiff, compilation, vectorization]
---

# JAX Functional Patterns

JAX は pure functions を transform します。以下のすべての pattern は 1 つの rule に従います。inputs を受け取り outputs を返し、side effects を持たない function を書く。その後、それを transform します。

## 4 つの Transforms

### grad -- function を微分する

```python
grads = jax.grad(loss_fn)(params, x, y)
loss, grads = jax.value_and_grad(loss_fn)(params, x, y)
```

使う場面: optimization のために gradients が必要なとき。
制約: function は scalar を返す必要があります。non-scalar outputs には `jax.jacobian` を使います。

### jit -- function を compile する

```python
fast_fn = jax.jit(f)
```

使う場面: 同じ shape の inputs で function を複数回呼ぶとき。
制約: traced values に依存する Python control flow は使えません。conditionals には `jax.lax.cond`、loops には `jax.lax.scan` を使います。

### vmap -- function を vectorize する

```python
batch_fn = jax.vmap(f, in_axes=(None, 0))
```

使う場面: 1 example 用の function を書いており、それを batches で動かしたいとき。
`in_axes` はどの argument axis に batch をかけるかを指定します。`None` は batch をかけない（broadcast）という意味です。

### pmap -- devices 全体に parallelize する

```python
parallel_fn = jax.pmap(f, axis_name='devices')
```

使う場面: 複数 GPUs/TPUs があり、data parallelism を使いたいとき。
function 内では、`jax.lax.pmean(x, 'devices')` が devices 全体で average を取ります。

## Composition Rules

transforms は compose できます。順序が重要です。

```python
per_example_grads = jax.jit(jax.vmap(jax.grad(loss_fn), in_axes=(None, 0, 0)))
```

右から左に読みます。loss_fn の gradient を取り、examples 方向に vectorize し、結果を compile します。

有効な compositions:
- `jit(grad(f))` -- compiled gradient computation
- `jit(vmap(f))` -- compiled batched computation
- `vmap(grad(f))` -- per-example gradients
- `pmap(jit(f))` -- parallel compiled computation
- `grad(jit(f))` -- compiled function の gradient（jit(grad(f)) と同じ）

## Parameter Management Pattern

JAX parameters は pytrees（arrays の nested dicts）です。

```python
params = {
    'layer1': {'w': jnp.zeros((784, 256)), 'b': jnp.zeros(256)},
    'layer2': {'w': jnp.zeros((256, 10)),  'b': jnp.zeros(10)},
}
```

すべての parameters を一度に更新します。
```python
params = jax.tree.map(lambda p, g: p - lr * g, params, grads)
```

parameters を数えます。
```python
n_params = sum(p.size for p in jax.tree.leaves(params))
```

## PRNG Key Management

JAX は explicit random keys を必要とします。

```python
key = jax.random.PRNGKey(0)
key, subkey = jax.random.split(key)
noise = jax.random.normal(subkey, shape)
```

複数の random operations では、一度に split します。
```python
keys = jax.random.split(key, n)
```

key を再利用してはいけません。使う前に必ず split してください。

## Common Mistakes

1. **jit 内で arrays を mutate する**: JAX arrays は immutable です。`x[i] = v` ではなく `x.at[i].set(v)` を使います。

2. **jit 内で Python print を使う**: `print` は execution ではなく tracing 中に実行されます。`jax.debug.print("{}", x)` を使います。

3. **jit 内で traced values に対して Python if/for を使う**: `jax.lax.cond`、`jax.lax.switch`、`jax.lax.scan`、`jax.lax.fori_loop` を使います。

4. **`.block_until_ready()` を忘れる**: JAX は async dispatch を使います。benchmarking では実際の完了を待つために `.block_until_ready()` を呼びます。

5. **PRNG keys を再利用する**: 同じ key を使った 2 つの operations は同じ「random」values を生成します。必ず split してください。

6. **jitted functions 内の global state**: global variables は trace time に capture されます。tracing 後の changes は見えません。すべて arguments として渡してください。

## Decision Checklist

1. function は複数回呼ばれますか？ `@jax.jit` を追加します。
2. gradients が必要ですか？ `jax.grad` または `jax.value_and_grad` で wrap します。
3. 1 example を処理する function だが batch がある？ `jax.vmap` で wrap します。
4. 複数 devices がありますか？ `jax.pmap` で wrap します。
5. randomness を使いますか？ PRNG keys を明示的に thread します。
6. array values に対する Python control flow がありますか？ `jax.lax` primitives に置き換えます。

## When to Use JAX

JAX を使う場面:
- per-example gradients が必要（differential privacy、Fisher information）
- TPUs で training している（JAX は native framework）
- higher-order derivatives（Hessians、Jacobians）が必要
- training step 全体を single kernel に compile したい
- team が Google DeepMind または Anthropic にいる

PyTorch を使う場面:
- 最大の ecosystem が欲しい（HuggingFace、torchvision、Lightning）
- raw speed より debugging ease を優先する
- NVIDIA GPUs へ TorchServe/Triton で deploy する
- hiring を考える（PyTorch developers のほうが多い）
- new architectures を速く iterate したい
