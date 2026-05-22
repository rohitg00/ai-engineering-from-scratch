# JAX 简介

> PyTorch 会改变张量。TensorFlow 构建图。JAX 编译纯函数。最后一点改变了你对深度学习的思考方式。

**类型：** 构建
**语言：** Python
**先决条件：** 第03阶段课程01-10，基础NumPy
**时间：** 约90分钟

## 学习目标

- 使用JAX的函数式API（jax.numpy, jax.grad, jax.jit, jax.vmap）编写纯函数神经网络代码
- 解释PyTorch的即时改变和JAX的函数式编译模型之间的关键设计差异
- 应用jit编译和vmap向量化来加速训练循环，与原始Python相比
- 在JAX中训练一个简单的网络，并对比其显式状态管理与PyTorch的面向对象方法

## 问题

你知道如何在PyTorch中构建神经网络。你定义一个`nn.Module`，调用`.backward()`，然后执行优化器步骤。它有效。数百万人都在使用它。
但PyTorch的DNA中有一个内置的限制：它在Python中即时追踪操作，一次一个。每个`tensor + tensor`都是一次独立的内核启动。每个训练步骤都重新解释相同的Python代码。这工作得很好，直到你需要跨2048个TPU训练一个5400亿参数的模型。那时开销会拖垮你。
Google DeepMind使用JAX训练Gemini。Anthropic使用JAX训练Claude。这些都不是小操作——它们是地球上最大的神经网络训练运行。他们选择JAX是因为它将你的训练循环视为一个可编译的程序，而不是一系列Python调用。
JAX是NumPy加上三个超能力：自动微分、编译到XLA的JIT、以及自动向量化。你编写一个处理单个示例的函数。JAX给你一个处理批次、计算梯度、编译为机器代码并在多个设备上运行的函数。所有这些都不改变原始函数。

## 概念

### JAX 哲学

JAX是一个函数式框架。没有类，没有可变状态，没有`.backward()`方法。相反：

| PyTorch | JAX |
|---------|-----|
| 带状态的`nn.Module`类 | 纯函数：`f(params, x) -> y` |
| `loss.backward()` | `jax.grad(loss_fn)(params, x, y)` |
| 即时执行 | 通过XLA的JIT编译 |
| `for x in batch:`手动循环 | `jax.vmap(f)`自动向量化 |
| `DataParallel` / `FSDP` | `jax.pmap(f)`自动并行化 |
| 可变的`model.parameters()` | 不可变的数组pytree |

这不是风格偏好。这是一个编译器约束。JIT编译需要纯函数——相同的输入总是产生相同的输出，没有副作用。这种限制正是实现100倍加速的可能所在。

### jax.numpy：熟悉的界面

JAX在加速器上重新实现了NumPy API：

```python
import jax.numpy as jnp

a = jnp.array([1.0, 2.0, 3.0])
b = jnp.array([4.0, 5.0, 6.0])
c = jnp.dot(a, b)
```

相同的函数名。相同的广播规则。相同的切片语义。但数组位于GPU/TPU上，每个操作都可以被编译器追踪。

一个关键区别：JAX数组是不可变的。不能`a[0] = 5`。而是：`a = a.at[0].set(5)`。这感觉一周很别扭，然后突然明白了——不可变性正是使`grad`、`jit`和`vmap`等变换可组合的原因。

### jax.grad：函数式自动微分

PyTorch将梯度附加到张量上（`.grad`）。JAX将梯度附加到函数上。

```python
import jax

def f(x):
    return x ** 2

df = jax.grad(f)
df(3.0)
```

`jax.grad`接受一个函数并返回一个计算梯度的新函数。没有`.backward()`调用。没有存储在张量上的计算图。梯度只是一个你可以调用、组合或JIT编译的函数。

这可以任意组合：

```python
d2f = jax.grad(jax.grad(f))
d2f(3.0)
```

二阶导数。三阶导数。雅可比矩阵。海森矩阵。全部通过组合`grad`实现。PyTorch也可以做到（`torch.autograd.functional.hessian`），但它是附加的。在JAX中，它是基础。

约束：`grad`只适用于纯函数。内部不能有打印语句（它们在追踪时运行，而不是执行时）。不能改变外部状态。没有明确的密钥管理就不能生成随机数。

### jit：编译到XLA

```python
@jax.jit
def train_step(params, x, y):
    loss = loss_fn(params, x, y)
    return loss

fast_step = jax.jit(train_step)
```

在第一次调用时，JAX追踪函数——它记录哪些操作发生，但不执行它们。然后将该追踪传递给XLA（加速线性代数），Google为TPU和GPU设计的编译器。XLA融合操作，消除冗余的内存复制，并生成优化的机器代码。

后续调用完全跳过Python。编译后的代码以C++速度在加速器上运行。

JIT何时有帮助：
- 训练步骤（相同计算重复数千次）
- 推理（相同模型，不同输入）
- 任何被多次调用且输入形状相似的函数

JIT何时有害：
- 具有依赖于值的Python控制流的函数（`if x > 0`，其中x是被追踪的数组）
- 一次性计算（编译开销超过运行时间）
- 调试（追踪隐藏了实际执行）

控制流限制是真实的。`jax.lax.cond`替代`if/else`。`jax.lax.scan`替代`for`循环。这些不是可选的——它们是编译的代价。

### vmap：自动向量化

你编写一个处理单个示例的函数：

```python
def predict(params, x):
    return jnp.dot(params['w'], x) + params['b']
```

`vmap`将其提升为处理批次：

```python
batch_predict = jax.vmap(predict, in_axes=(None, 0))
```

`in_axes=(None, 0)`表示：不对`params`进行批处理（共享），对`x`的第0轴进行批处理。没有手动`for`循环。没有重塑。没有批处理维度线程。JAX找出批处理维度并向量化整个计算。

这不是语法糖。`vmap`生成融合的向量化代码，运行速度比Python循环快10-100倍。它可以与`jit`和`grad`组合：

```python
per_example_grads = jax.vmap(jax.grad(loss_fn), in_axes=(None, 0, 0))
```

每个示例的梯度。一行代码。在PyTorch中，没有黑客手段几乎不可能实现。

### pmap：跨设备数据并行

```python
parallel_step = jax.pmap(train_step, axis_name='devices')
```

`pmap`在所有可用设备（GPU/TPU）上复制函数并分割批次。在函数内部，`jax.lax.pmean`和`jax.lax.psum`跨设备同步梯度。

Google使用`pmap`（及其后续版本`shard_map`）在数千个TPU v5e芯片上训练Gemini。编程模型：编写单设备版本，用`pmap`包装，完成。

### Pytrees：通用数据结构

JAX在"pytrees"上操作——列表、元组、字典和数组的嵌套组合。你的模型参数是一个pytree：

```python
params = {
    'layer1': {'w': jnp.zeros((784, 256)), 'b': jnp.zeros(256)},
    'layer2': {'w': jnp.zeros((256, 128)), 'b': jnp.zeros(128)},
    'layer3': {'w': jnp.zeros((128, 10)),  'b': jnp.zeros(10)},
}
```

每个JAX变换——`grad`、`jit`、`vmap`——都知道如何遍历pytrees。`jax.tree.map(f, tree)`将`f`应用于每个叶子。这就是优化器一次更新所有参数的方式：

```python
params = jax.tree.map(lambda p, g: p - lr * g, params, grads)
```

没有`.parameters()`方法。没有参数注册。树结构就是模型。

### 函数式与面向对象

PyTorch在对象内部存储状态：

```python
class Model(nn.Module):
    def __init__(self):
        self.linear = nn.Linear(784, 10)

    def forward(self, x):
        return self.linear(x)
```

JAX使用带有显式状态的纯函数：

```python
def predict(params, x):
    return jnp.dot(x, params['w']) + params['b']
```

参数被传入。没有存储任何东西。没有改变任何东西。这使得每个函数都是可测试、可组合和可编译的。这也意味着你自己管理参数——或者使用像Flax或Equinox这样的库。

### JAX 生态系统

JAX为你提供基本构建块。库为你提供便利性：

| 库 | 角色 | 风格 |
|---------|------|-------|
| **Flax** (Google) | 神经网络层 | 带显式状态的`nn.Module` |
| **Equinox** (Patrick Kidger) | 神经网络层 | 基于pytree，Python风格 |
| **Optax** (DeepMind) | 优化器 + 学习率调度 | 可组合的梯度变换 |
| **Orbax** (Google) | 检查点 | 保存/恢复pytrees |
| **CLU** (Google) | 指标 + 日志 | 训练循环工具 |

Optax是标准的优化器库。它将梯度变换（Adam、SGD、裁剪）与参数更新分离，使组合变得简单：

```python
optimizer = optax.chain(
    optax.clip_by_global_norm(1.0),
    optax.adam(learning_rate=1e-3),
)
```

### 何时使用JAX与PyTorch

| 因素 | JAX | PyTorch |
|--------|-----|---------|
| TPU支持 | 一流（Google两者都构建） | 社区维护（torch_xla） |
| GPU支持 | 良好（通过XLA的CUDA） | 顶级（原生CUDA） |
| 调试 | 困难（追踪+编译） | 容易（即时，逐行） |
| 生态系统 | 研究导向（Flax, Equinox） | 庞大（HuggingFace, torchvision等） |
| 招聘 | 小众（Google/DeepMind/Anthropic） | 主流（无处不在） |
| 大规模训练 | 优越（XLA, pmap, mesh） | 良好（FSDP, DeepSpeed） |
| 原型速度 | 较慢（函数式开销） | 更快（改变并前进） |
| 生产推理 | TensorFlow Serving, Vertex AI | TorchServe, Triton, ONNX |
| 谁在使用 | DeepMind (Gemini), Anthropic (Claude) | Meta (Llama), OpenAI (GPT), Stability AI |

诚实的回答：除非你有特定的理由使用JAX，否则使用PyTorch。这些理由是——TPU访问、需要每个示例的梯度、大规模多设备训练，或在Google/DeepMind/Anthropic工作。

### JAX中的随机数

JAX没有全局随机状态。每个随机操作都需要一个明确的PRNG密钥：

```python
key = jax.random.PRNGKey(42)
key1, key2 = jax.random.split(key)
w = jax.random.normal(key1, shape=(784, 256))
```

这起初很烦人。但它保证了跨设备和编译的可重复性——一个PyTorch的`torch.manual_seed`在多GPU设置中无法保证的特性。

## 构建它

### 步骤1：设置和数据

我们将使用JAX和Optax在MNIST上训练一个3层MLP。784个输入，两个隐藏层分别有256和128个神经元，10个输出类别。

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

### 步骤2：初始化参数

没有类。只是一个返回pytree的函数：

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

He初始化，手动完成。从一个种子分割出三个PRNG密钥。每个权重都是嵌套字典中的一个不可变数组。

### 步骤3：前向传播

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

纯函数。参数输入，预测输出。没有`self`，没有存储的状态。`loss_fn`从头计算交叉熵——softmax、log、负均值。

### 步骤4：JIT编译的训练步骤

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

`jax.value_and_grad`在一次调用中返回损失值和梯度。`@jax.jit`装饰器将两个函数都编译为XLA。第一次调用后，每个训练步骤运行时都不接触Python。

### 步骤5：训练循环

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

10个epoch。约97%的测试准确率。第一个epoch很慢（JIT编译）。第2-10个epoch很快。

注意缺少什么：没有`.zero_grad()`，没有`.backward()`，没有`.step()`。整个更新是一个组合的函数调用。梯度被计算，被Adam变换，然后应用到参数上——全部在`train_step`内部完成。

## 使用它

### Flax：Google标准

Flax是最常见的JAX神经网络库。它重新添加了`nn.Module`，但带有显式状态管理：

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

与PyTorch相同的结构，但`params`与模型分离。`model.init()`创建参数。`model.apply(params, x)`运行前向传播。模型对象没有状态。

### Equinox：Python风格的替代方案

Equinox（由Patrick Kidger开发）将模型表示为pytrees：

```python
import equinox as eqx

model = eqx.nn.MLP(
    in_size=784, out_size=10, width_size=256, depth=2,
    activation=jax.nn.relu, key=jax.random.PRNGKey(0)
)
logits = model(x)
```

模型本身就是一个pytree。不需要`.apply()`。参数只是模型的叶子。这更接近JAX的思维方式。

### Optax：可组合的优化器

Optax将梯度变换与更新解耦：

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

梯度裁剪、学习率预热、权重衰减——全部作为变换链组合。每个变换看到梯度，修改它们，然后将它们传递给下一个。没有单一的优化器类。

## 发布它

**安装：**

```bash
pip install jax jaxlib optax flax
```

对于GPU支持：

```bash
pip install jax[cuda12]
```

对于TPU（Google Cloud）：

```bash
pip install jax[tpu] -f https://storage.googleapis.com/jax-releases/libtpu_releases.html
```

**性能陷阱：**

- 第一次JIT调用很慢（编译）。在基准测试前预热。
- 避免在JIT内部对JAX数组使用Python循环。使用`jax.lax.scan`或`jax.lax.fori_loop`。
- `jax.debug.print()`在JIT内部工作。常规的`print()`不工作。
- 使用`jax.profiler`或TensorBoard进行性能分析。XLA编译可能隐藏瓶颈。
- 默认情况下，JAX预分配75%的GPU内存。设置`XLA_PYTHON_CLIENT_PREALLOCATE=false`来禁用。

**检查点：**

```python
import orbax.checkpoint as ocp
checkpointer = ocp.PyTreeCheckpointer()
checkpointer.save('/tmp/model', params)
restored = checkpointer.restore('/tmp/model')
```

**本课程产出：**

- `outputs/prompt-jax-optimizer.md` —— 一个用于选择正确JAX优化器配置的提示
- `outputs/skill-jax-patterns.md` —— 一个涵盖JAX中函数式模式的技能

## 练习

1. 向MLP添加dropout。在JAX中，dropout需要一个PRNG密钥——在前向传播中传递一个密钥，并为每个dropout层分割它。比较有无dropout的测试准确率。
2. 使用`jax.vmap`为32张MNIST图像的批次计算每个示例的梯度。计算每个示例的梯度范数。哪些示例的梯度最大，为什么？
3. 用通用的`mlp_forward(params, x)`替换手动前向函数，该函数适用于任意数量的层。使用`jax.tree.leaves`自动确定深度。
4. 基准测试有和没有`@jax.jit`的训练步骤。计时每个的100步。在你的硬件上加速有多大？第一次调用的编译开销是多少？
5. 通过组合`optax.chain(optax.clip_by_global_norm(1.0), optax.adam(1e-3))`实现梯度裁剪。训练时有和没有裁剪。绘制训练过程中的梯度范数以查看效果。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|----------------|----------------------|
| XLA | "让JAX变快的东西" | 加速线性代数——一个融合操作并从计算图生成优化GPU/TPU内核的编译器 |
| JIT | "即时编译" | JAX在第一次调用时追踪函数，编译为XLA，然后在后续调用中运行编译版本 |
| 纯函数 | "没有副作用" | 一个输出仅依赖于输入的函数——没有全局状态，没有改变，没有没有明确密钥的随机性 |
| vmap | "自动批处理" | 将处理单个示例的函数转换为处理批次的函数，无需重写 |
| pmap | "自动并行化" | 在多个设备上复制函数并分割输入批次 |
| Pytree | "数组的嵌套字典" | JAX可以遍历和变换的列表、元组、字典和数组的任何嵌套结构 |
| 追踪 | "记录计算" | JAX使用抽象值执行函数以构建计算图，不计算实际结果 |
| 函数式自动微分 | "函数的grad" | 通过变换函数计算导数，而不是将梯度存储附加到张量 |
| Optax | "JAX的优化器库" | 一个可组合的梯度变换库——Adam、SGD、裁剪、调度——它们链接在一起 |
| Flax | "JAX的nn.Module" | Google的JAX神经网络库，添加了层抽象，同时保持状态显式 |

## 进一步阅读

- JAX文档：https://jax.readthedocs.io/ —— 官方文档，包含关于grad、jit和vax的优秀教程
- "JAX: Python+NumPy程序的可组合变换"（Bradbury等人，2018）——解释设计理念的原始论文
- Flax文档：https://flax.readthedocs.io/ —— Google的JAX神经网络库
- Patrick Kidger，"Equinox: 通过可调用PyTrees和过滤变换的JAX神经网络"（2021）——Flax的Python风格替代方案
- DeepMind，"Optax: 可组合的梯度变换和优化"——标准优化器库
- "你不知道JAX"（Colin Raffel，2020）——JAX陷阱和模式的实用指南，来自T5作者之一