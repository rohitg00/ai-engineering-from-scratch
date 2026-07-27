---
name: skill-jax-patterns
description: JAX中的函数式编程模式——何时以及如何使用grad、jit、vmap和pmap
version: 1.0.0
phase: 3
lesson: 12
tags: [jax, 函数式编程, 自动微分, 编译, 向量化]
---

# JAX函数式模式

JAX变换纯函数。下面的每个模式都遵循一个规则：编写一个接收输入并返回输出的函数，没有副作用。然后对它进行变换。

## 四种变换

### grad —— 对函数求导

```python
grads = jax.grad(loss_fn)(params, x, y)
loss, grads = jax.value_and_grad(loss_fn)(params, x, y)
```

使用时：你需要梯度进行优化。
约束：函数必须返回标量。对于非标量输出，使用`jax.jacobian`。

### jit —— 编译函数

```python
fast_fn = jax.jit(f)
```

使用时：函数将被多次调用，且输入形状相同。
约束：不能有依赖于追踪值的Python控制流。条件判断使用`jax.lax.cond`，循环使用`jax.lax.scan`。

### vmap —— 向量化函数

```python
batch_fn = jax.vmap(f, in_axes=(None, 0))
```

使用时：你为单个样本编写了一个函数，需要它在批处理上工作。
`in_axes`指定要对哪个参数轴进行批处理。`None`表示不批处理（广播）。

### pmap —— 跨设备并行化

```python
parallel_fn = jax.pmap(f, axis_name='devices')
```

使用时：你有多个GPU/TPU且想要数据并行。
在函数内部，`jax.lax.pmean(x, 'devices')`跨设备平均。

## 组合规则

变换可以组合。顺序很重要：

```python
per_example_grads = jax.jit(jax.vmap(jax.grad(loss_fn), in_axes=(None, 0, 0)))
```

从右到左阅读：对loss_fn求梯度，跨样本向量化，编译结果。

有效的组合：
- `jit(grad(f))` —— 编译的梯度计算
- `jit(vmap(f))` —— 编译的批处理计算
- `vmap(grad(f))` —— 每个样本的梯度
- `pmap(jit(f))` —— 并行的编译计算
- `grad(jit(f))` —— 编译函数的梯度（与jit(grad(f))相同）

## 参数管理模式

JAX参数是pytrees（嵌套的数组字典）：

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

统计参数量：
```python
n_params = sum(p.size for p in jax.tree.leaves(params))
```

## PRNG密钥管理

JAX要求显式的随机密钥：

```python
key = jax.random.PRNGKey(0)
key, subkey = jax.random.split(key)
noise = jax.random.normal(subkey, shape)
```

对于多个随机操作，一次拆分：
```python
keys = jax.random.split(key, n)
```

永远不要重复使用密钥。使用前先拆分。

## 常见错误

1. **在jit内部改变数组**：JAX数组是不可变的。使用`x.at[i].set(v)`代替`x[i] = v`。

2. **在jit内部使用Python的print**：`print`在追踪期间运行，而非执行期间。使用`jax.debug.print("{}", x)`。

3. **在jit内部对追踪值使用Python的if/for**：使用`jax.lax.cond`、`jax.lax.switch`、`jax.lax.scan`、`jax.lax.fori_loop`。

4. **忘记`.block_until_ready()`**：JAX使用异步调度。进行基准测试时，调用`.block_until_ready()`等待实际完成。

5. **重复使用PRNG密钥**：两个操作使用同一个密钥会产生相同的"随机"值。始终拆分。

6. **jit函数中的全局状态**：全局变量在追踪时被捕获。追踪后的更改不可见。将所有内容作为参数传递。

## 决策清单

1. 函数被多次调用？添加`@jax.jit`。
2. 需要梯度？使用`jax.grad`或`jax.value_and_grad`包装。
3. 处理单个样本但有批处理？使用`jax.vmap`包装。
4. 有多个设备？使用`jax.pmap`包装。
5. 使用随机性？显式地传递PRNG密钥。
6. 对数组值有Python控制流？替换为`jax.lax`原语。

## 何时使用JAX

使用JAX的情况：
- 你需要每个样本的梯度（差分隐私、Fisher信息）
- 你在TPU上训练（JAX是原生框架）
- 你需要高阶导数（Hessians、Jacobians）
- 你想将整个训练步骤编译为单个内核
- 你的团队在Google DeepMind或Anthropic

使用PyTorch的情况：
- 你想要最大的生态系统（HuggingFace、torchvision、Lightning）
- 你优先考虑调试便利性而非原始速度
- 你在NVIDIA GPU上使用TorchServe/Triton部署
- 你在招聘（更多PyTorch开发者可用）
- 你想在新架构上快速迭代
