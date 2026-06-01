# 12 · JAX 入门

> PyTorch 原地修改张量，TensorFlow 构建计算图，JAX 编译纯函数。最后这一点会彻底改变你对深度学习的思考方式。

**类型：** 实战构建
**语言：** Python
**前置：** 第 03 阶段第 01-10 课、基础 NumPy
**时长：** 约 90 分钟

## 学习目标

- 使用 JAX 的函数式 API（jax.numpy、jax.grad、jax.jit、jax.vmap）编写纯函数式的神经网络代码
- 解释 PyTorch 的「即时变异（eager mutation）」与 JAX 的「函数式编译（functional compilation）」模型之间的关键设计差异
- 应用 jit 编译与 vmap 向量化来加速训练循环，对比朴素的 Python 写法
- 在 JAX 中训练一个简单网络，并将其显式的状态管理与 PyTorch 的面向对象方式进行对照

## 问题所在

你已经会用 PyTorch 构建神经网络了。你定义一个 `nn.Module`，调用 `.backward()`，再让优化器执行一步。它能跑通，几百万人都在用。

但 PyTorch 的基因里刻着一条约束：它以「即时（eager）」方式逐个追踪运算，一次一个，全部在 Python 中进行。每一次 `tensor + tensor` 都是一次独立的核函数（kernel）启动。每一个训练步都要重新解释同一段 Python 代码。在你需要跨 2048 块 TPU 训练一个 5400 亿参数的模型之前，这都没什么问题。可一旦到了那个规模，开销就会把你拖垮。

Google DeepMind 在 JAX 上训练 Gemini，Anthropic 在 JAX 上训练了 Claude。这些都不是小打小闹——它们是地球上规模最大的神经网络训练任务。它们选择 JAX，是因为 JAX 把你的训练循环当作一个可编译的程序来对待，而不是一连串的 Python 调用。

JAX 就是带有三种超能力的 NumPy：自动微分（automatic differentiation）、即时编译（JIT compilation）到 XLA、以及自动向量化（automatic vectorization）。你写一个处理单个样本的函数，JAX 就能给你一个能处理整个批次、计算梯度、编译成机器码、并跨多个设备运行的函数——而且完全不用改动原始函数。

## 核心概念

### JAX 的哲学

JAX 是一个函数式（functional）框架。没有类，没有可变状态，没有 `.backward()` 方法。取而代之的是：

| PyTorch | JAX |
|---------|-----|
| 带状态的 `nn.Module` 类 | 纯函数：`f(params, x) -> y` |
| `loss.backward()` | `jax.grad(loss_fn)(params, x, y)` |
| 即时执行（eager execution） | 通过 XLA 进行 JIT 编译 |
| `for x in batch:` 手写循环 | `jax.vmap(f)` 自动向量化 |
| `DataParallel` / `FSDP` | `jax.pmap(f)` 自动并行 |
| 可变的 `model.parameters()` | 不可变的数组「pytree」 |

这不是风格偏好，而是编译器约束。JIT 编译要求纯函数——相同输入永远产生相同输出，没有副作用。正是这条限制，让 100 倍的加速成为可能。

### jax.numpy：熟悉的外表

JAX 在加速器上重新实现了 NumPy 的 API：

```python
import jax.numpy as jnp

a = jnp.array([1.0, 2.0, 3.0])
b = jnp.array([4.0, 5.0, 6.0])
c = jnp.dot(a, b)
```

相同的函数名，相同的广播规则，相同的切片语义。但这些数组活在 GPU/TPU 上，并且每一次运算都可被编译器追踪。

一个关键差异：JAX 数组是不可变（immutable）的。不能写 `a[0] = 5`，而要写 `a = a.at[0].set(5)`。这一点头一周会让人很别扭，然后你就会顿悟——正是不可变性，才让 `grad`、`jit`、`vmap` 这样的变换可以相互组合（composable）。

### jax.grad：函数式自动微分

PyTorch 把梯度附着在张量上（`.grad`）；JAX 把梯度附着在函数上。

```python
import jax

def f(x):
    return x ** 2

df = jax.grad(f)
df(3.0)
```

`jax.grad` 接收一个函数，返回一个计算其梯度的新函数。没有 `.backward()` 调用，没有存储在张量上的计算图。梯度只是另一个你可以调用、组合或 JIT 编译的函数。

它可以任意组合：

```python
d2f = jax.grad(jax.grad(f))
d2f(3.0)
```

二阶导数、三阶导数、雅可比矩阵（Jacobian）、海森矩阵（Hessian）——全都靠组合 `grad` 来实现。PyTorch 也能做到（`torch.autograd.functional.hessian`），但那是后来硬加上去的。在 JAX 里，这是地基。

约束在于：`grad` 只对纯函数有效。函数内不能有 print 语句（它们在追踪期运行，而非执行期）。不能修改外部状态。不能在没有显式 key 管理的情况下生成随机数。

### jit：编译到 XLA

```python
@jax.jit
def train_step(params, x, y):
    loss = loss_fn(params, x, y)
    return loss

fast_step = jax.jit(train_step)
```

在第一次调用时，JAX 会追踪（trace）该函数——它记录下发生了哪些运算，但并不执行它们。然后它把这份追踪记录交给 XLA（Accelerated Linear Algebra，加速线性代数），即 Google 为 TPU 和 GPU 打造的编译器。XLA 会融合运算、消除冗余的内存拷贝，并生成优化过的机器码。

后续调用将完全跳过 Python。编译后的代码以 C++ 的速度在加速器上运行。

JIT 何时有帮助：
- 训练步（同一份计算重复成千上万次）
- 推理（同一个模型，不同的输入）
- 任何以相似形状输入被多次调用的函数

JIT 何时反而有害：
- 含有依赖于「值」的 Python 控制流的函数（例如 `if x > 0`，而 x 是一个被追踪的数组）
- 一次性计算（编译开销超过了运行时间）
- 调试（追踪会隐藏掉真实的执行过程）

控制流的限制是真实存在的。`jax.lax.cond` 替代 `if/else`，`jax.lax.scan` 替代 `for` 循环。这些不是可选项——而是编译所必须付出的代价。

### vmap：自动向量化

你写一个处理单个样本的函数：

```python
def predict(params, x):
    return jnp.dot(params['w'], x) + params['b']
```

`vmap` 把它提升为处理整个批次：

```python
batch_predict = jax.vmap(predict, in_axes=(None, 0))
```

`in_axes=(None, 0)` 的含义是：不要对 `params` 做批处理（它是共享的），而对 `x` 的第 0 轴做批处理。没有手写的 `for` 循环，没有 reshape，不用手动穿引批次维度。JAX 会自动算出批次维度，并把整个计算向量化。

这不是语法糖。`vmap` 生成的是融合后的向量化代码，比 Python 循环快 10 到 100 倍。而且它能与 `jit` 和 `grad` 组合：

```python
per_example_grads = jax.vmap(jax.grad(loss_fn), in_axes=(None, 0, 0))
```

逐样本梯度（per-example gradients），一行搞定。这在 PyTorch 中若不借助各种 hack 几乎不可能做到。

### pmap：跨设备的数据并行

```python
parallel_step = jax.pmap(train_step, axis_name='devices')
```

`pmap` 把函数复制到所有可用设备（GPU/TPU）上，并切分批次。在函数内部，`jax.lax.pmean` 和 `jax.lax.psum` 负责跨设备同步梯度。

Google 使用 `pmap`（及其继任者 `shard_map`）在数千块 TPU v5e 芯片上训练 Gemini。其编程模型很简单：先写好单设备版本，再用 `pmap` 包一层，搞定。

### Pytree：通用的数据结构

JAX 在「pytree」上运作——pytree 是列表、元组、字典与数组的嵌套组合。你的模型参数就是一个 pytree：

```python
params = {
    'layer1': {'w': jnp.zeros((784, 256)), 'b': jnp.zeros(256)},
    'layer2': {'w': jnp.zeros((256, 128)), 'b': jnp.zeros(128)},
    'layer3': {'w': jnp.zeros((128, 10)),  'b': jnp.zeros(10)},
}
```

每一种 JAX 变换——`grad`、`jit`、`vmap`——都知道如何遍历 pytree。`jax.tree.map(f, tree)` 会把 `f` 应用到每一个叶子（leaf）上。优化器正是这样一次性更新所有参数的：

```python
params = jax.tree.map(lambda p, g: p - lr * g, params, grads)
```

没有 `.parameters()` 方法，不用注册参数。这棵树的结构本身就是模型。

### 函数式 vs 面向对象

PyTorch 把状态存储在对象内部：

```python
class Model(nn.Module):
    def __init__(self):
        self.linear = nn.Linear(784, 10)

    def forward(self, x):
        return self.linear(x)
```

JAX 使用带显式状态的纯函数：

```python
def predict(params, x):
    return jnp.dot(x, params['w']) + params['b']
```

params 被当作参数传入。什么都不存储，什么都不修改。这让每个函数都可测试、可组合、可编译。这也意味着你要自己管理 params——或者使用 Flax、Equinox 这样的库。

### JAX 生态系统

JAX 给你原语（primitives），而库为你提供易用性（ergonomics）：

| 库 | 角色 | 风格 |
|---------|------|-------|
| **Flax**（Google） | 神经网络层 | 带显式状态的 `nn.Module` |
| **Equinox**（Patrick Kidger） | 神经网络层 | 基于 pytree、更 Pythonic |
| **Optax**（DeepMind） | 优化器 + 学习率调度 | 可组合的梯度变换 |
| **Orbax**（Google） | 检查点（checkpointing） | 保存/恢复 pytree |
| **CLU**（Google） | 指标 + 日志 | 训练循环工具 |

Optax 是标准的优化器库。它把梯度变换（Adam、SGD、裁剪）与参数更新分离开来，让组合变得轻而易举：

```python
optimizer = optax.chain(
    optax.clip_by_global_norm(1.0),
    optax.adam(learning_rate=1e-3),
)
```

### 何时用 JAX，何时用 PyTorch

| 因素 | JAX | PyTorch |
|--------|-----|---------|
| TPU 支持 | 一等公民（两者皆由 Google 打造） | 社区维护（torch_xla） |
| GPU 支持 | 良好（通过 XLA 调用 CUDA） | 业界顶尖（原生 CUDA） |
| 调试 | 困难（追踪 + 编译） | 容易（即时执行，逐行调试） |
| 生态 | 偏研究（Flax、Equinox） | 海量（HuggingFace、torchvision 等） |
| 招聘 | 小众（Google/DeepMind/Anthropic） | 主流（无处不在） |
| 大规模训练 | 更优（XLA、pmap、mesh） | 良好（FSDP、DeepSpeed） |
| 原型开发速度 | 较慢（函数式开销） | 较快（改了就跑） |
| 生产环境推理 | TensorFlow Serving、Vertex AI | TorchServe、Triton、ONNX |
| 谁在用 | DeepMind（Gemini）、Anthropic（Claude） | Meta（Llama）、OpenAI（GPT）、Stability AI |

实话实说：除非你有使用 JAX 的特定理由，否则就用 PyTorch。这些理由包括——拥有 TPU 访问权限、需要逐样本梯度、超大规模的多设备训练，或者你就在 Google/DeepMind/Anthropic 工作。

### JAX 中的随机数

JAX 没有全局随机状态。每一次随机操作都需要一个显式的 PRNG key：

```python
key = jax.random.PRNGKey(42)
key1, key2 = jax.random.split(key)
w = jax.random.normal(key1, shape=(784, 256))
```

一开始会觉得很烦。但它保证了在不同设备和不同编译之间的可复现性——这是 PyTorch 的 `torch.manual_seed` 在多 GPU 场景下无法保证的特性。

## 动手构建

### 第 1 步：环境与数据

我们将用 JAX 和 Optax 在 MNIST 上训练一个 3 层 MLP。784 个输入，两个分别为 256 和 128 个神经元的隐藏层，10 个输出类别。

```python
import jax
import jax.numpy as jnp
from jax import random
import optax

def get_mnist_data():
    from sklearn.datasets import fetch_openml
    mnist = fetch_openml('mnist_784', version=1, as_frame=False, parser='auto')
    X = mnist.data.astype('float32') / 255.0
    y = mnist.target.astype('int')
    X_train, X_test = X[:60000], X[60000:]
    y_train, y_test = y[:60000], y[60000:]
    return X_train, y_train, X_test, y_test
```

### 第 2 步：初始化参数

没有类，只有一个返回 pytree 的函数：

```python
def init_params(key):
    k1, k2, k3 = random.split(key, 3)
    scale1 = jnp.sqrt(2.0 / 784)
    scale2 = jnp.sqrt(2.0 / 256)
    scale3 = jnp.sqrt(2.0 / 128)
    params = {
        'layer1': {
            'w': scale1 * random.normal(k1, (784, 256)),
            'b': jnp.zeros(256),
        },
        'layer2': {
            'w': scale2 * random.normal(k2, (256, 128)),
            'b': jnp.zeros(128),
        },
        'layer3': {
            'w': scale3 * random.normal(k3, (128, 10)),
            'b': jnp.zeros(10),
        },
    }
    return params
```

手动完成的 He 初始化（He-initialization）。从一个种子拆分出三个 PRNG key。每个权重都是嵌套字典中的一个不可变数组。

### 第 3 步：前向传播

```python
def forward(params, x):
    x = jnp.dot(x, params['layer1']['w']) + params['layer1']['b']
    x = jax.nn.relu(x)
    x = jnp.dot(x, params['layer2']['w']) + params['layer2']['b']
    x = jax.nn.relu(x)
    x = jnp.dot(x, params['layer3']['w']) + params['layer3']['b']
    return x

def loss_fn(params, x, y):
    logits = forward(params, x)
    one_hot = jax.nn.one_hot(y, 10)
    return -jnp.mean(jnp.sum(jax.nn.log_softmax(logits) * one_hot, axis=-1))
```

纯函数。params 进，预测出。没有 `self`，没有存储的状态。`loss_fn` 从头计算交叉熵——softmax、取对数、取负均值。

### 第 4 步：JIT 编译的训练步

```python
@jax.jit
def train_step(params, opt_state, x, y):
    loss, grads = jax.value_and_grad(loss_fn)(params, x, y)
    updates, opt_state = optimizer.update(grads, opt_state, params)
    params = optax.apply_updates(params, updates)
    return params, opt_state, loss

@jax.jit
def accuracy(params, x, y):
    logits = forward(params, x)
    preds = jnp.argmax(logits, axis=-1)
    return jnp.mean(preds == y)
```

`jax.value_and_grad` 一次性返回损失值和梯度。`@jax.jit` 装饰器把两个函数都编译到 XLA。第一次调用之后，每个训练步的运行都不再触及 Python。

### 第 5 步：训练循环

```python
optimizer = optax.adam(learning_rate=1e-3)

X_train, y_train, X_test, y_test = get_mnist_data()
X_train, X_test = jnp.array(X_train), jnp.array(X_test)
y_train, y_test = jnp.array(y_train), jnp.array(y_test)

key = random.PRNGKey(0)
params = init_params(key)
opt_state = optimizer.init(params)

batch_size = 128
n_epochs = 10

for epoch in range(n_epochs):
    key, subkey = random.split(key)
    perm = random.permutation(subkey, len(X_train))
    X_shuffled = X_train[perm]
    y_shuffled = y_train[perm]

    epoch_loss = 0.0
    n_batches = len(X_train) // batch_size
    for i in range(n_batches):
        start = i * batch_size
        xb = X_shuffled[start:start + batch_size]
        yb = y_shuffled[start:start + batch_size]
        params, opt_state, loss = train_step(params, opt_state, xb, yb)
        epoch_loss += loss

    train_acc = accuracy(params, X_train[:5000], y_train[:5000])
    test_acc = accuracy(params, X_test, y_test)
    print(f"Epoch {epoch + 1:2d} | Loss: {epoch_loss / n_batches:.4f} | "
          f"Train Acc: {train_acc:.4f} | Test Acc: {test_acc:.4f}")
```

10 个 epoch，约 97% 的测试准确率。第一个 epoch 较慢（JIT 编译），第 2 到 10 个 epoch 则很快。

注意这里缺少了什么：没有 `.zero_grad()`，没有 `.backward()`，没有 `.step()`。整个更新就是一次组合好的函数调用。梯度被计算出来、经 Adam 变换、再应用到参数上——全部都在 `train_step` 内部完成。

## 实际运用

### Flax：Google 的标准

Flax 是最常用的 JAX 神经网络库。它把 `nn.Module` 又加了回来，但配以显式的状态管理：

```python
import flax.linen as nn

class MLP(nn.Module):
    @nn.compact
    def __call__(self, x):
        x = nn.Dense(256)(x)
        x = nn.relu(x)
        x = nn.Dense(128)(x)
        x = nn.relu(x)
        x = nn.Dense(10)(x)
        return x

model = MLP()
params = model.init(jax.random.PRNGKey(0), jnp.ones((1, 784)))
logits = model.apply(params, x_batch)
```

结构与 PyTorch 相同，但 `params` 是与模型分离的。`model.init()` 创建 params，`model.apply(params, x)` 执行前向传播。模型对象本身没有状态。

### Equinox：更 Pythonic 的替代方案

Equinox（由 Patrick Kidger 开发）把模型表示为 pytree：

```python
import equinox as eqx

model = eqx.nn.MLP(
    in_size=784, out_size=10, width_size=256, depth=2,
    activation=jax.nn.relu, key=jax.random.PRNGKey(0)
)
logits = model(x)
```

模型本身就是一个 pytree。不需要 `.apply()`。参数就是这个模型的叶子。这更贴近 JAX 的思考方式。

### Optax：可组合的优化器

Optax 把梯度变换与更新解耦：

```python
schedule = optax.warmup_cosine_decay_schedule(
    init_value=0.0, peak_value=1e-3,
    warmup_steps=1000, decay_steps=50000
)

optimizer = optax.chain(
    optax.clip_by_global_norm(1.0),
    optax.adamw(learning_rate=schedule, weight_decay=0.01),
)
```

梯度裁剪、学习率预热（warmup）、权重衰减——全都作为一条变换链组合起来。每个变换看到梯度、修改它，再把它传给下一个。没有臃肿的单体式优化器类。

## 上线部署

**安装：**

```bash
pip install jax jaxlib optax flax
```

GPU 支持：

```bash
pip install jax[cuda12]
```

TPU 支持（Google Cloud）：

```bash
pip install jax[tpu] -f https://storage.googleapis.com/jax-releases/libtpu_releases.html
```

**性能踩坑点：**

- 第一次 JIT 调用很慢（编译）。基准测试前要先「热身」。
- 避免在 JIT 内部对 JAX 数组使用 Python 循环。改用 `jax.lax.scan` 或 `jax.lax.fori_loop`。
- `jax.debug.print()` 在 JIT 内部有效，普通的 `print()` 则无效。
- 用 `jax.profiler` 或 TensorBoard 做性能分析。XLA 编译可能会掩盖瓶颈。
- JAX 默认会预分配 75% 的 GPU 显存。设置 `XLA_PYTHON_CLIENT_PREALLOCATE=false` 可关闭此行为。

**检查点（Checkpointing）：**

```python
import orbax.checkpoint as ocp
checkpointer = ocp.PyTreeCheckpointer()
checkpointer.save('/tmp/model', params)
restored = checkpointer.restore('/tmp/model')
```

**本课产出：**
- `outputs/prompt-jax-optimizer.md`——一个用于选择正确 JAX 优化器配置的提示词
- `outputs/skill-jax-patterns.md`——一份涵盖 JAX 函数式模式的技能文档

## 练习

1. 给 MLP 加上 dropout。在 JAX 中，dropout 需要一个 PRNG key——把一个 key 穿引到前向传播中，并为每个 dropout 层拆分它。对比加与不加 dropout 时的测试准确率。

2. 用 `jax.vmap` 为一批 32 张 MNIST 图像计算逐样本梯度。计算每个样本的梯度范数（gradient norm）。哪些样本的梯度最大，为什么？

3. 把手写的 forward 函数替换为一个通用的 `mlp_forward(params, x)`，使其适用于任意层数。用 `jax.tree.leaves` 自动确定网络深度。

4. 对加与不加 `@jax.jit` 的训练步做基准测试。分别计时 100 步。在你的硬件上加速比有多大？第一次调用的编译开销是多少？

5. 通过组合 `optax.chain(optax.clip_by_global_norm(1.0), optax.adam(1e-3))` 来实现梯度裁剪。分别在有裁剪和无裁剪的情况下训练。绘制训练过程中的梯度范数曲线，观察其效果。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|----------------|----------------------|
| XLA | 「让 JAX 跑得快的那玩意儿」 | Accelerated Linear Algebra（加速线性代数）——一个编译器，它融合运算，并从计算图生成优化过的 GPU/TPU 核函数 |
| JIT | 「即时编译」 | JAX 在首次调用时追踪函数、编译到 XLA，随后调用就运行编译后的版本 |
| 纯函数 | 「没有副作用」 | 输出只依赖于输入的函数——没有全局状态，没有变异，没有未带显式 key 的随机性 |
| vmap | 「自动批处理」 | 把处理单个样本的函数变换为处理一个批次的函数，无需重写 |
| pmap | 「自动并行」 | 把一个函数复制到多个设备上，并切分输入批次 |
| Pytree | 「数组的嵌套字典」 | 任何由列表、元组、字典和数组构成的、JAX 能遍历并变换的嵌套结构 |
| 追踪（Tracing） | 「记录计算过程」 | JAX 用抽象值执行函数以构建计算图，而不计算真实结果 |
| 函数式自动微分 | 「对函数取 grad」 | 通过变换函数来计算导数，而非通过给张量附加梯度存储来实现 |
| Optax | 「JAX 的优化器库」 | 一个可组合的梯度变换库——Adam、SGD、裁剪、调度——它们串联在一起 |
| Flax | 「JAX 版的 nn.Module」 | Google 为 JAX 打造的神经网络库，在保持状态显式的同时加入了层级抽象 |

## 延伸阅读

- JAX 官方文档：https://jax.readthedocs.io/ ——官方文档，含关于 grad、jit、vmap 的优秀教程
- "JAX: composable transformations of Python+NumPy programs"（Bradbury 等，2018）——阐释其设计哲学的原始论文
- Flax 官方文档：https://flax.readthedocs.io/ ——Google 为 JAX 打造的神经网络库
- Patrick Kidger，"Equinox: neural networks in JAX via callable PyTrees and filtered transformations"（2021）——Flax 的 Pythonic 替代方案
- DeepMind，"Optax: composable gradient transformation and optimisation"——标准的优化器库
- "You Don't Know JAX"（Colin Raffel，2020）——一份关于 JAX 踩坑点与模式的实用指南，出自 T5 论文的作者之一
