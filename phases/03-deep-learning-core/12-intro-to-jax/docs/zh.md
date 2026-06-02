# JAX 入门（Introduction to JAX）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> PyTorch 直接修改张量。TensorFlow 构建计算图。JAX 编译纯函数。最后这一点会改变你思考深度学习的方式。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 03 Lessons 01-10, basic NumPy
**Time:** ~90 minutes

## 学习目标（Learning Objectives）

- 使用 JAX 的函数式 API（jax.numpy、jax.grad、jax.jit、jax.vmap）写出纯函数风格的神经网络代码
- 解释 PyTorch 的 eager 立即执行 / 可变状态与 JAX 的函数式编译模型之间的关键设计差异
- 应用 jit 编译与 vmap 向量化加速训练循环，并与朴素的 Python 实现对比
- 在 JAX 中训练一个简单网络，并对比它显式的状态管理与 PyTorch 面向对象的写法

## 问题（The Problem）

你已经会用 PyTorch 搭神经网络了。定义一个 `nn.Module`，调用 `.backward()`，再让 optimizer 走一步。能用，几百万人在用。

但 PyTorch 的 DNA 里刻着一个约束：它在 Python 里 eager 地、一条一条地追踪运算。每一次 `tensor + tensor` 都是一次独立的 kernel 启动。每一个训练 step 都在重新解释同一段 Python 代码。在你需要跨 2,048 块 TPU 训练 5400 亿参数的模型之前，这都没问题。一旦到了那个量级，开销就要把你拖死。

Google DeepMind 用 JAX 训练 Gemini。Anthropic 用 JAX 训练 Claude。这些不是小工程——它们是地球上规模最大的神经网络训练任务。他们选 JAX，是因为 JAX 把训练循环当作一段可编译的程序，而不是一串 Python 调用。

JAX 就是 NumPy 加上三件神兵：自动微分、JIT 编译到 XLA、自动向量化。你写一个处理单个样本的函数，JAX 给你一个能处理一整个 batch、计算梯度、编译成机器码、跨多设备运行的函数——而且原函数一行都不用改。

## 概念（The Concept）

### JAX 的哲学（The JAX Philosophy）

JAX 是一个函数式框架。没有 class，没有可变状态，也没有 `.backward()` 方法。取而代之的是：

| PyTorch | JAX |
|---------|-----|
| 带状态的 `nn.Module` 类 | 纯函数：`f(params, x) -> y` |
| `loss.backward()` | `jax.grad(loss_fn)(params, x, y)` |
| Eager 执行 | 通过 XLA 做 JIT 编译 |
| `for x in batch:` 手写循环 | `jax.vmap(f)` 自动向量化 |
| `DataParallel` / `FSDP` | `jax.pmap(f)` 自动并行 |
| 可变的 `model.parameters()` | 不可变的 array pytree |

这不是风格偏好，而是编译器的硬约束。JIT 编译要求纯函数——同样的输入永远给出同样的输出，没有副作用。正是这个限制，才让 100 倍加速成为可能。

### jax.numpy：熟悉的表面（jax.numpy: The Familiar Surface）

JAX 在加速器上重新实现了 NumPy API：

```python
import jax.numpy as jnp

a = jnp.array([1.0, 2.0, 3.0])
b = jnp.array([4.0, 5.0, 6.0])
c = jnp.dot(a, b)
```

同样的函数名。同样的广播规则。同样的切片语义。但数组住在 GPU/TPU 上，每一次运算都能被编译器追踪。

有一个关键差异：JAX 的数组是**不可变**的。不能写 `a[0] = 5`，要写 `a = a.at[0].set(5)`。一开始会觉得别扭，一周之后你就懂了——正是不可变性，才让 `grad`、`jit`、`vmap` 这些变换可以自由组合。

### jax.grad：函数式自动微分（jax.grad: Functional Autodiff）

PyTorch 把梯度挂在张量上（`.grad`）。JAX 把梯度挂在函数上。

```python
import jax

def f(x):
    return x ** 2

df = jax.grad(f)
df(3.0)
```

`jax.grad` 接收一个函数，返回一个新的函数——这个新函数计算梯度。没有 `.backward()` 调用。没有挂在张量上的计算图。梯度只是另一个函数，你可以调用它、组合它、JIT 编译它。

它可以任意组合：

```python
d2f = jax.grad(jax.grad(f))
d2f(3.0)
```

二阶导。三阶导。Jacobian（雅可比）。Hessian（海森）。全靠组合 `grad` 来实现。PyTorch 也能做到（`torch.autograd.functional.hessian`），但那是后来打的补丁。在 JAX 里，这是地基。

约束是：`grad` 只对纯函数生效。函数里不能有 print（它们只在 tracing 期间执行，不在真正运行时执行）。不能修改外部状态。不能在没有显式 key 管理的情况下用随机数。

### jit：编译到 XLA（jit: Compile to XLA）

```python
@jax.jit
def train_step(params, x, y):
    loss = loss_fn(params, x, y)
    return loss

fast_step = jax.jit(train_step)
```

第一次调用时，JAX 会 trace 这个函数——记录哪些运算发生了，但并不真的执行。然后把这段 trace 交给 XLA（Accelerated Linear Algebra），Google 为 TPU 和 GPU 打造的编译器。XLA 会做算子融合、消除冗余的内存拷贝、生成优化过的机器码。

之后的调用完全跳过 Python，编译好的代码以 C++ 的速度跑在加速器上。

JIT 帮得上忙的场景：
- 训练 step（同一段计算重复执行成千上万次）
- 推理（同一个模型，不同输入）
- 任何在相似形状的输入上被多次调用的函数

JIT 帮倒忙的场景：
- 控制流依赖于值的函数（比如 `if x > 0`，而 x 是一个被追踪的数组）
- 一次性的计算（编译开销超过运行时间）
- 调试（tracing 把真正的执行藏起来了）

控制流的限制是真实存在的。`jax.lax.cond` 替代 `if/else`。`jax.lax.scan` 替代 `for` 循环。它们不是可选项——它们是编译要付出的代价。

### vmap：自动向量化（vmap: Automatic Vectorization）

你写一个处理单个样本的函数：

```python
def predict(params, x):
    return jnp.dot(params['w'], x) + params['b']
```

`vmap` 把它提升成处理一整个 batch：

```python
batch_predict = jax.vmap(predict, in_axes=(None, 0))
```

`in_axes=(None, 0)` 的意思是：不在 `params` 上做 batch（共享），在 `x` 的第 0 轴上做 batch。不用手写 `for` 循环。不用 reshape。不用一路把 batch 维度穿来穿去。JAX 自己搞清楚 batch 维度，把整段计算向量化。

这不是语法糖。`vmap` 生成融合后的向量化代码，比 Python 循环快 10-100 倍。而且它能和 `jit`、`grad` 组合：

```python
per_example_grads = jax.vmap(jax.grad(loss_fn), in_axes=(None, 0, 0))
```

每个样本的梯度，一行搞定。在 PyTorch 里没有 hack 几乎做不到。

### pmap：跨设备的数据并行（pmap: Data Parallelism Across Devices）

```python
parallel_step = jax.pmap(train_step, axis_name='devices')
```

`pmap` 把函数复制到所有可用设备（GPU/TPU），并切分 batch。函数内部，`jax.lax.pmean` 和 `jax.lax.psum` 在设备间同步梯度。

Google 用 `pmap`（以及它的继任者 `shard_map`）跨数千块 TPU v5e 芯片训练 Gemini。编程模型是：写好单设备版本，用 `pmap` 包一下，搞定。

### Pytree：通用的数据结构（Pytrees: The Universal Data Structure）

JAX 操作的对象是 "pytree"——list、tuple、dict 和 array 的嵌套组合。你的模型参数就是一个 pytree：

```python
params = {
    'layer1': {'w': jnp.zeros((784, 256)), 'b': jnp.zeros(256)},
    'layer2': {'w': jnp.zeros((256, 128)), 'b': jnp.zeros(128)},
    'layer3': {'w': jnp.zeros((128, 10)),  'b': jnp.zeros(10)},
}
```

每一个 JAX 变换——`grad`、`jit`、`vmap`——都知道怎么遍历 pytree。`jax.tree.map(f, tree)` 对每个叶子应用 `f`。这就是 optimizer 一次性更新所有参数的方式：

```python
params = jax.tree.map(lambda p, g: p - lr * g, params, grads)
```

没有 `.parameters()` 方法。没有参数注册。树的结构就是模型本身。

### 函数式 vs 面向对象（Functional vs Object-Oriented）

PyTorch 把状态存在对象里：

```python
class Model(nn.Module):
    def __init__(self):
        self.linear = nn.Linear(784, 10)

    def forward(self, x):
        return self.linear(x)
```

JAX 用纯函数加显式状态：

```python
def predict(params, x):
    return jnp.dot(x, params['w']) + params['b']
```

params 作为参数传进来。什么都不存。什么都不改。这让每个函数都可测试、可组合、可编译。这也意味着你得自己管 params——或者用 Flax、Equinox 这类库。

### JAX 生态（The JAX Ecosystem）

JAX 给你原语，库给你工效：

| Library | 角色 | 风格 |
|---------|------|-------|
| **Flax**（Google） | 神经网络层 | `nn.Module` 加显式状态 |
| **Equinox**（Patrick Kidger） | 神经网络层 | 基于 pytree，更 Pythonic |
| **Optax**（DeepMind） | optimizer + 学习率调度 | 可组合的梯度变换 |
| **Orbax**（Google） | checkpoint | 保存 / 恢复 pytree |
| **CLU**（Google） | metrics + 日志 | 训练循环工具 |

Optax 是标准的 optimizer 库。它把梯度变换（Adam、SGD、clipping）和参数更新拆开，让组合变得轻而易举：

```python
optimizer = optax.chain(
    optax.clip_by_global_norm(1.0),
    optax.adam(learning_rate=1e-3),
)
```

### 什么时候用 JAX，什么时候用 PyTorch（When to Use JAX vs PyTorch）

| 维度 | JAX | PyTorch |
|--------|-----|---------|
| TPU 支持 | 一等公民（Google 两个都造） | 社区维护（torch_xla） |
| GPU 支持 | 不错（通过 XLA 跑 CUDA） | 业界最强（原生 CUDA） |
| 调试 | 难（tracing + 编译） | 容易（eager，逐行执行） |
| 生态 | 偏研究（Flax、Equinox） | 巨大（HuggingFace、torchvision 等） |
| 招聘 | 小众（Google/DeepMind/Anthropic） | 主流（哪都是） |
| 大规模训练 | 更优（XLA、pmap、mesh） | 良好（FSDP、DeepSpeed） |
| 原型速度 | 偏慢（函数式开销） | 偏快（直接改、直接跑） |
| 生产推理 | TensorFlow Serving、Vertex AI | TorchServe、Triton、ONNX |
| 谁在用 | DeepMind（Gemini）、Anthropic（Claude） | Meta（Llama）、OpenAI（GPT）、Stability AI |

老实说：除非有具体理由，否则就用 PyTorch。这些理由是——能拿到 TPU、需要 per-example 的梯度、超大规模多设备训练，或者你在 Google/DeepMind/Anthropic 上班。

### JAX 中的随机数（Random Numbers in JAX）

JAX 没有全局随机状态。每一次随机操作都需要一个显式的 PRNG key：

```python
key = jax.random.PRNGKey(42)
key1, key2 = jax.random.split(key)
w = jax.random.normal(key1, shape=(784, 256))
```

刚开始用很烦人。但它能保证跨设备、跨编译的可复现性——这是 PyTorch 的 `torch.manual_seed` 在多 GPU 场景下没法保证的。

## 动手实现（Build It）

### 第一步：环境与数据（Step 1: Setup and Data）

我们用 JAX + Optax 在 MNIST 上训练一个 3 层 MLP。784 个输入，两个隐藏层各 256 / 128 个 neuron，10 个输出类别。

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

### 第二步：初始化参数（Step 2: Initialize Parameters）

没有 class，只有一个返回 pytree 的函数：

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

He 初始化，手动来。从一个 seed split 出三个 PRNG key。每个权重都是嵌套 dict 里的不可变 array。

### 第三步：前向传播（Step 3: Forward Pass）

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

纯函数。params 进，预测出。没有 `self`，没有内部状态。`loss_fn` 从零开始算交叉熵——softmax、log、负均值。

### 第四步：JIT 编译过的训练 step（Step 4: JIT-Compiled Training Step）

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

`jax.value_and_grad` 一次同时返回 loss 和 grads。`@jax.jit` 装饰器把两个函数都编译到 XLA。第一次调用之后，每个训练 step 都不再碰 Python。

### 第五步：训练循环（Step 5: Training Loop）

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

10 个 epoch。约 97% 的测试准确率。第一个 epoch 慢（JIT 编译）。第 2 到 10 个 epoch 飞快。

注意少了什么：没有 `.zero_grad()`，没有 `.backward()`，没有 `.step()`。整个更新是一次组合好的函数调用。梯度被算出来、被 Adam 变换、被应用到参数上——全在 `train_step` 里完成。

## 用起来（Use It）

### Flax：Google 标准（Flax: The Google Standard）

Flax 是最常见的 JAX 神经网络库。它把 `nn.Module` 又加了回来，但带着显式的状态管理：

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

结构和 PyTorch 一样，但 `params` 跟 model 是分开的。`model.init()` 创建 params。`model.apply(params, x)` 跑前向。model 对象本身没有状态。

### Equinox：Pythonic 的另一种选择（Equinox: The Pythonic Alternative）

Equinox（Patrick Kidger 写的）把模型本身表示成 pytree：

```python
import equinox as eqx

model = eqx.nn.MLP(
    in_size=784, out_size=10, width_size=256, depth=2,
    activation=jax.nn.relu, key=jax.random.PRNGKey(0)
)
logits = model(x)
```

模型自己就是一个 pytree。不用 `.apply()`。参数就是 model 的叶子。这更贴近 JAX 的思考方式。

### Optax：可组合的 optimizer（Optax: Composable Optimizers）

Optax 把梯度变换和更新解耦：

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

梯度裁剪、学习率 warmup、权重衰减——全部组合成一条变换链。每一个变换看到梯度、修改梯度、再传给下一个。没有那种巨无霸 optimizer 类。

## 上线部署（Ship It）

**安装：**

```bash
pip install jax jaxlib optax flax
```

GPU 支持：

```bash
pip install jax[cuda12]
```

TPU（Google Cloud）：

```bash
pip install jax[tpu] -f https://storage.googleapis.com/jax-releases/libtpu_releases.html
```

**性能踩坑：**

- 第一次 JIT 调用很慢（编译）。基准测试前先预热。
- 不要在 JIT 里对 JAX 数组写 Python 循环。用 `jax.lax.scan` 或 `jax.lax.fori_loop`。
- `jax.debug.print()` 可以在 JIT 里用。普通 `print()` 不行。
- 用 `jax.profiler` 或 TensorBoard 做 profile。XLA 编译可能掩盖瓶颈。
- JAX 默认预分配 75% 的 GPU 显存。设 `XLA_PYTHON_CLIENT_PREALLOCATE=false` 关掉。

**Checkpoint：**

```python
import orbax.checkpoint as ocp
checkpointer = ocp.PyTreeCheckpointer()
checkpointer.save('/tmp/model', params)
restored = checkpointer.restore('/tmp/model')
```

**本课产出：**
- `outputs/prompt-jax-optimizer.md` —— 用于挑选合适 JAX optimizer 配置的 prompt
- `outputs/skill-jax-patterns.md` —— 一项覆盖 JAX 函数式模式的 skill

## 练习（Exercises）

1. 给这个 MLP 加上 dropout。在 JAX 里，dropout 需要一个 PRNG key——把 key 一路穿过前向传播，并在每个 dropout 层 split 一次。对比加 dropout 与不加 dropout 的测试准确率。

2. 用 `jax.vmap` 算一批 32 张 MNIST 图像的 per-example 梯度。算出每个样本的梯度范数。哪些样本的梯度最大？为什么？

3. 把手写的 forward 函数换成一个通用的 `mlp_forward(params, x)`，对任意层数都能跑。用 `jax.tree.leaves` 自动判断深度。

4. 给训练 step 做基准测试，分别测带 `@jax.jit` 和不带的版本。各跑 100 步计时。在你的硬件上加速比是多少？第一次调用的编译开销有多大？

5. 用 `optax.chain(optax.clip_by_global_norm(1.0), optax.adam(1e-3))` 实现梯度裁剪。带裁剪和不带裁剪各训练一次。把训练过程中的梯度范数画出来，看效果。

## 关键术语（Key Terms）

| 术语 | 大家怎么说 | 实际含义 |
|------|----------------|----------------------|
| XLA | "让 JAX 跑得快的那东西" | Accelerated Linear Algebra——一个编译器，把计算图里的运算融合并生成优化后的 GPU/TPU kernel |
| JIT | "即时编译" | JAX 在第一次调用时 trace 函数，编译成 XLA，之后的调用直接跑编译后的版本 |
| Pure function（纯函数） | "没有副作用" | 一个函数，输出只取决于输入——没有全局状态、不修改任何东西、没有显式 key 就没有随机性 |
| vmap | "自动 batch" | 把处理单个样本的函数变成处理一整 batch 的函数，不用重写 |
| pmap | "自动并行" | 把函数复制到多个设备，并把输入 batch 切分 |
| Pytree | "嵌套的 array dict" | JAX 能遍历和变换的任意嵌套结构（list、tuple、dict、array） |
| Tracing（追踪） | "记录运算" | JAX 用抽象值执行函数来构造计算图，并不真正算出结果 |
| Functional autodiff（函数式自动微分） | "对函数求 grad" | 通过变换函数来求导，而不是把梯度存储挂在张量上 |
| Optax | "JAX 的 optimizer 库" | 一个由可组合梯度变换组成的库——Adam、SGD、clipping、调度——可以串起来用 |
| Flax | "JAX 的 nn.Module" | Google 出品的 JAX 神经网络库，加了层抽象，但状态保持显式 |

## 延伸阅读（Further Reading）

- JAX 官方文档：https://jax.readthedocs.io/ —— 官方文档，关于 grad、jit、vmap 的教程都很优秀
- "JAX: composable transformations of Python+NumPy programs"（Bradbury 等，2018）—— 阐述设计哲学的原始论文
- Flax 文档：https://flax.readthedocs.io/ —— Google 的 JAX 神经网络库
- Patrick Kidger，"Equinox: neural networks in JAX via callable PyTrees and filtered transformations"（2021）—— 比 Flax 更 Pythonic 的替代品
- DeepMind，"Optax: composable gradient transformation and optimisation" —— 标准 optimizer 库
- "You Don't Know JAX"（Colin Raffel，2020）—— JAX 各种坑和模式的实战指南，作者是 T5 论文作者之一
