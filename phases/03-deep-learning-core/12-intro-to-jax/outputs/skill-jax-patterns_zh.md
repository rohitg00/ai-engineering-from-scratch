---
name: skill-jax-patterns
description: JAX中的函数式编程模式——何时以及如何使用grad、jit、vmap和pmap
version: 1.0.0
phase: 3
lesson: 12
tags: [jax, functional-programming, autodiff, compilation, vectorization]
---

# JAX函数式模式

JAX转换纯函数。下面每个模式遵循一个规则：编写一个接受输入并返回输出的函数，无副作用。然后转换它。

## 四种转换

### grad — 微分函数

```python
grads = jax.grad(loss_fn)(params, x, y)
loss, grads = jax.value_and_grad(loss_fn)(params, x, y)
```

使用时机：你需要梯度进行优化。
约束：函数必须返回标量。对于非标量输出，使用`jax.jacobian`。

### jit — 编译函数

```python
fast_fn = jax.jit(f)
```

使用时机：函数将被调用多次且输入形状相同。
约束：没有依赖于追踪值的Python控制流。条件用`jax.lax.cond`，循环用`jax.lax.scan`。

### vmap — 向量化函数

```python
batch_fn = jax.vmap(f, in_axes=(None, 0))
```

使用时机：你为单个样本写了函数，需要它处理批次。
`in_axes`指定哪个参数轴进行批处理。`None`表示不批处理（广播）。

### pmap — 跨设备并行化

```python
parallel_fn = jax.pmap(f, axis_name='devices')
```

使用时机：你有多个GPU/TPU且想要数据并行。
函数内部，`jax.lax.pmean(x, 'devices')`跨设备平均。

## 组合规则

转换可组合。顺序很重要：

```python
per_example_grads = jax.jit(jax.vmap(jax.grad(loss_fn), in_axes=(None, 0, 0)))
```

从右到左读：取loss_fn的梯度，跨样本向量化，编译结果。

有效组合：
- `jit(grad(f))` -- 编译梯度计算
- `jit(vmap(f))` -- 编译批处理计算
- `vmap(grad(f))` -- 每样本梯度
- `pmap(jit(f))` -- 并行编译计算
- `grad(jit(f))` -- 编译函数的梯度（与jit(grad(f))相同）

## 参数管理模式

JAX参数是pytrees（数组的嵌套字典）：

```python
params = {
    'layer1': {'w': jnp.zeros((784, 256)), 'b': jnp.zeros(256)},
    'layer2': {'w': jnp.zeros((256, 10)),  'b': jnp.zeros(10)},
}
```

一次性更新所有参数：
```python
params = jax.tree.map(lambda p, g: p - lr * g, params, grads)
```

计数参数：
```python
n_params = sum(p.size for p in jax.tree.leaves(params))
```

## PRNG密钥管理

JAX需要显式随机密钥：

```python
key = jax.random.PRNGKey(0)
key, subkey = jax.random.split(key)
noise = jax.random.normal(subkey, shape)
```

多个随机操作，一次性分裂：
```python
keys = jax.random.split(key, n)
```

永远不要重用密钥。使用前总是分裂。

## 常见错误

1. **在jit内修改数组**：JAX数组是不可变的。用`x.at[i].set(v)`代替`x[i] = v`。

2. **在jit内使用Python print**：`print`在追踪时运行，不是执行时。用`jax.debug.print("{}", x)`。

3. **在jit内对追踪值使用Python if/for**：用`jax.lax.cond`、`jax.lax.switch`、`jax.lax.scan`、`jax.lax.fori_loop`。

4. **忘记`.block_until_ready()`**：JAX使用异步调度。基准测试时调用`.block_until_ready()`等待实际完成。

5. **重用PRNG密钥**：相同密钥的两个操作产生相同的"随机"值。使用前总是分裂。

6. **jitted函数中的全局状态**：全局变量在追踪时被捕获。追踪后的更改不可见。将所有内容作为参数传递。

## 决策检查清单

1. 函数被调用多次吗？添加`@jax.jit`。
2. 它需要梯度吗？用`jax.grad`或`jax.value_and_grad`包装。
3. 它处理单个样本但你有批次吗？用`jax.vmap`包装。
4. 你有多个设备吗？用`jax.pmap`包装。
5. 它使用随机性吗？显式传递PRNG密钥。
6. 它有基于数组值的Python控制流吗？替换为`jax.lax`原语。

## 何时使用JAX

使用JAX当：
- 你需要每样本梯度（差分隐私、Fisher信息）
- 你在TPU上训练（JAX是原生框架）
- 你需要高阶导数（Hessians、Jacobians）
- 你想将整个训练步骤编译为单个内核
- 你的团队在Google DeepMind或Anthropic

使用PyTorch当：
- 你想要最大的生态系统（HuggingFace、torchvision、Lightning）
- 你优先考虑调试便利性而非原始速度
- 你部署到NVIDIA GPU，使用TorchServe/Triton
- 你在招聘（更多PyTorch开发者存在）
- 你想快速迭代新架构
