# JAX简介

> PyTorch变异张量。TensorFlow构建图表。JAX编译纯函数。最后一个改变了您对深度学习的看法。

** 类型：** 构建
** 语言：** Python
** 先决条件：** 阶段03课程01-10，基本NumPy
** 时间：** ~90分钟

## 学习目标

- 使用JAX的功能性API（.numpy、.grad、.jit、.vmap）编写纯功能神经网络代码
- 解释PyTorch的渴望突变和JAX的功能性编译模型之间的关键设计差异
- 与原始Python相比，应用jit编译和vmap vmap vector来加速训练循环
- 用JAX训练简单网络，并将显式状态管理与PyTorch的面向对象方法进行比较

## 问题

您知道如何在PyTorch中构建神经网络。您定义一个“nn.模块”，调用“.backward（）”，步进优化器。有时灵数百万人使用它。

但PyTorch的DNA中有一个约束：它热切地跟踪Python中的一次一个操作。每个“张量+张量”都是一个单独的内核启动。每个训练步骤都会重新解释相同的Python代码。这可以正常工作，直到您需要在2，048个TPA上训练5400亿参数模型。然后管理费用会杀死你。

Google DeepMind使用JAX训练Gemini。Anthropic对Claude进行了JAX培训。这些都不是小操作--它们是地球上最大的神经网络训练运行。他们选择JAX是因为它将您的训练循环视为可编译程序，而不是Python调用序列。

JAX是NumPy，具有三种超能力：自动区分、JT编译为XLA和自动向量化。您编写一个处理一个示例的函数。JAX为您提供了一个处理批处理、计算梯度、编译为机器代码并在多个设备上运行的函数。一切都不改变原来的功能。

## 概念

### JAX哲学

JAX是一个功能框架。没有类，没有可变状态，没有“.backward（）”方法。相反：

| PyTorch | Jax |
|---------|-----|
| 带状态的`nn.Module`类 | 纯函数：' f（params，x）-> y ' |
| ' loss.backward（）' | `grad（loss_fn）（params，x，y）` |
| Eager execution | 通过XLA进行JT编译 |
| `for x in batch：`手动循环 | '.vmap（f）'自动向量化 |
| '数据并行'/' FSDP ' | '.pmap（f）'自动并行 |
| 可变的`model.parameters（）` | 数组的不可变pytree |

这不是风格偏好。这是一个编译器约束。JT编译需要纯函数--相同的输入总是产生相同的输出，没有副作用。正是这种限制使得100倍加速成为可能。

### 。numpy：熟悉的表面

JAX在加速器上重新实现NumPy API：

```python
import jax.numpy as jnp

a = jnp.array([1.0, 2.0, 3.0])
b = jnp.array([4.0, 5.0, 6.0])
c = jnp.dot(a, b)
```

相同的函数名称。相同的广播规则。相同的切片语义。但这些阵列位于图形处理器/图形处理器上，并且每个操作都可以由编译器跟踪。

一个关键区别：JAX阵列是不可变的。没有' a[0] = 5 '。相反：' a = a.at[0].set（5）'。这感觉尴尬了一周，然后它就响了--不可变性是“grad”、“jit”和“vmap”等转换可组合的原因。

### 毕业生：功能性Autodiff

PyTorch将梯度附加到张量（'.grad '）。JAX将渐变附加到函数。

```python
import jax

def f(x):
    return x ** 2

df = jax.grad(f)
df(3.0)
```

'.grad '接受一个函数并返回一个计算梯度的新函数。没有'.backward（）'调用。张量上没有存储计算图。渐变只是您可以调用、编写或JT编译的另一个函数。

这是任意组成的：

```python
d2f = jax.grad(jax.grad(f))
d2f(3.0)
```

二阶衍生品。第三衍生品。雅各比派。黑森人。这一切都是通过创作“毕业生”来完成的。PyTorch也可以做到这一点（“torch.autograd.functional.hessian”），但它是固定的。在JAX中，它是基础。

限制：“grad”仅适用于纯函数。内部没有打印声明（它们在跟踪期间运行，而不是执行期间运行）。外部状态没有突变。如果没有明确的密钥管理，就无法生成随机数。

### jit：编译到XLA

```python
@jax.jit
def train_step(params, x, y):
    loss = loss_fn(params, x, y)
    return loss

fast_step = jax.jit(train_step)
```

在第一次调用时，JAX跟踪该函数--它记录发生的操作，而不执行它们。然后它将该轨迹交给XLA（加速线性代数），这是谷歌的pu和图形处理器。XLA融合操作，消除冗余内存副本，并生成优化的机器代码。

随后的调用完全跳过Python。编译后的代码以C++速度在加速器上运行。

当JT提供帮助时：
- 训练步骤（相同的计算重复数千次）
- 推理（相同的模型，不同的输入）
- 使用类似形状的输入多次调用的任何函数

当JT受伤时：
- 具有取决于值的Python控制流的函数（“if x > 0”，其中x是跟踪数组）
- 一次性计算（编译负载超过运行时）
- （跟踪隐藏实际执行）

控制流量限制是真实存在的。'.lax.cond '替换' if/else '。'.lax. scanner '替换' for '循环。这些都不是可选的--它们是编译的代价。

### vmap：自动向量化

您编写一个处理一个示例的函数：

```python
def predict(params, x):
    return jnp.dot(params['w'], x) + params['b']
```

“vmap”提升它以处理批处理：

```python
batch_predict = jax.vmap(predict, in_axes=(None, 0))
```

`in_axes=（None，0）`表示：不批处理`params`（共享），批处理`x`的轴0。没有手动“for”循环。没有整形。无批量尺寸螺纹连接。JAX计算批处理维度并将整个计算进行载体化。

这不是语法糖。“vmap”会生成融合的向量化代码，其运行速度比Python循环快10- 100倍。它由“jit”和“grad”组成：

```python
per_example_grads = jax.vmap(jax.grad(loss_fn), in_axes=(None, 0, 0))
```

每个示例的渐变。一行。如果没有黑客攻击，这在PyTorch中几乎是不可能的。

### pmap：跨设备的数据并行主义

```python
parallel_step = jax.pmap(train_step, axis_name='devices')
```

“pmap”跨所有可用设备（图形处理器/图形处理器）复制该功能并拆分该批处理。在该函数中，“.lax.pmean”和“.lax.psum”同步设备之间的梯度。

谷歌使用“pmap”（及其继任者“shard_map”）在数千个pu v5 e芯片上训练Gemini。编程模型：编写单设备版本，用“pmap”包装，完成。

### Pytree：通用数据结构

JAX对“pytree”进行操作--列表、二元组、字典和数组的嵌套组合。您的模型参数是pytree：

```python
params = {
    'layer1': {'w': jnp.zeros((784, 256)), 'b': jnp.zeros(256)},
    'layer2': {'w': jnp.zeros((256, 128)), 'b': jnp.zeros(128)},
    'layer3': {'w': jnp.zeros((128, 10)),  'b': jnp.zeros(10)},
}
```

每个JAX转换--“grad”、“jit”、“vmap”--都知道如何穿越pytree。' jax.tree.map（f，tree）'将'应用于每片叶子。这就是优化器一次更新所有参数的方式：

```python
params = jax.tree.map(lambda p, g: p - lr * g, params, grads)
```

没有'. parties（）'方法。无参数注册。树结构就是模型。

### 功能性与面向对象

PyTorch将状态存储在对象内部：

```python
class Model(nn.Module):
    def __init__(self):
        self.linear = nn.Linear(784, 10)

    def forward(self, x):
        return self.linear(x)
```

JAX使用具有显式状态的纯函数：

```python
def predict(params, x):
    return jnp.dot(x, params['w']) + params['b']
```

传入参数。什么都没有储存。没有什么是变异的。这使得每个函数都是可测试的、可组合的和可编译的。这还意味着您可以自己管理参数--或者使用Flax或Equinox等库。

### JAX生态系统

JAX提供了原语。图书馆为您提供人体工程学：

| 图书馆 | 作用 | 风格 |
|---------|------|-------|
| ** 亚麻 **（谷歌） | 神经网络层 | 具有显式状态的' nn.模组' |
| *** | 神经网络层 | 基于Pytree的Python |
| **Optax**（DeepMind） | 优化器+ LR调度 | 可组合梯度变换 |
| **Orbax**（Google） | 检查点 | 保存/恢复pytree |
| **CLU**（Google） | 收件箱+登录 | 训练循环实用程序 |

Optax是标准的优化器库。它将梯度变换（Adam，SGD，clipping）与参数更新分离，使其变得微不足道：

```python
optimizer = optax.chain(
    optax.clip_by_global_norm(1.0),
    optax.adam(learning_rate=1e-3),
)
```

### 何时使用JAX与PyTorch

| 因子 | Jax | PyTorch |
|--------|-----|---------|
| pu支持 | 一流（两者都是谷歌打造的） | 社区维护（torch_xla） |
| GPU支持 | 良好（CUDA通过XLA） | 一流（原生CUDA） |
| 调试 | 难（追踪+编译） | 轻松（渴望，逐行） |
| 生态系统 | 以研究为重点（亚麻，Equinox） | 巨大的（HuggingFace、Torchvision等） |
| 招聘 | 利基（Google/DeepMind/Anthropic） | 主流（无处不在） |
| 大规模培训 | 高级（XLA、pmap、网格） | 良好（FSDP、DeepSpeed） |
| 原型制作速度 | 较慢（功能费用） | 更快（变异并消失） |
| 生产推理 | TensorFlow Serving、Vertex AI | TorchServe、Triton、ONNX |
| 谁使用它 | DeepMind（双子座）、Anthropic（克劳德） | Meta（Llama）、OpenAI（GPT）、稳定AI |

诚实的答案是：除非您有特定原因使用JAX，否则请使用PyTorch。这些原因是--pu访问、需要逐个示例的梯度、大规模的多设备训练，或者在Google/DeepMind/Anthropic工作。

### JAX中的随机数

JAX没有全局随机状态。每个随机操作都需要显式的PRNG密钥：

```python
key = jax.random.PRNGKey(42)
key1, key2 = jax.random.split(key)
w = jax.random.normal(key1, shape=(784, 256))
```

一开始这很烦人。但它保证了跨设备和编译的可重复性--这是PyTorch的“torch.manual_seed”在多图形处理器设置中无法保证的属性。

## 建设党

### 第1步：设置和数据

我们将使用JAX和Optax在MNIST上训练3层MLP。784个输入、由256和128个神经元组成的两个隐藏层、10个输出类。

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

### 第2步：初始化参数

没有课。只是一个返回pytree的函数：

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

He-初始化，手动完成。三个PRNG密钥从一个种子中分裂出来。每个权重都是一个嵌套指令中的不可变数组。

### 第3步：向前传球

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

纯粹的功能。参数输入，预测输出。没有“自我”，没有存储状态。' loss_fn '从头开始计算交叉熵-- softmax、log、负平均值。

### 第4步：JT编写的培训步骤

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

'.Value_and_grad '一次返回损失值和梯度。'@ spel.jit '装饰器将这两个函数编译为XLA。第一次调用后，每个训练步骤都在不接触Python的情况下运行。

### 5.训练循环

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

10 时代。~97%测试准确性。第一个纪元很慢（JT编译）。纪元2-10很快。

请注意缺少什么：没有'.zero_grad（）'、没有'.backward（）'、没有'、.Step（）'。整个更新是一个组成的函数调用。Adam计算、转换分量，并应用于参数--所有这些都在“train_Step”内。

## 使用它

### 亚麻：谷歌标准

Flax是最常见的JAX神经网络库。它添加了“nn.模组”，但具有显式的状态管理：

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

结构与PyTorch相同，但“参数”与模型分开。' mode. initt（）'创建参数。' mode.apply（params，x）'运行向前传递。模型对象没有状态。

### 春分：Python替代方案

Equinox（作者：Patrick Kidger）将模型表示为pytree：

```python
import equinox as eqx

model = eqx.nn.MLP(
    in_size=784, out_size=10, width_size=256, depth=2,
    activation=jax.nn.relu, key=jax.random.PRNGKey(0)
)
logits = model(x)
```

该模型本身是一个pytree。不需要'.apply（）'。参数只是模型的叶子。这更接近JAX的想法。

### Optax：可组合优化器

Optax将梯度转换与更新分离：

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

梯度剪裁、学习率预热、权重衰减--所有这些都构成了一系列变换。每个变换都会看到渐变，修改它们，并将它们传递给下一个变换。没有整体优化器类。

## 把它运

** 安装：**

```bash
pip install jax jaxlib optax flax
```

对于图形处理器支持：

```bash
pip install jax[cuda12]
```

对于pu（Google Cloud）：

```bash
pip install jax[tpu] -f https://storage.googleapis.com/jax-releases/libtpu_releases.html
```

** 绩效陷阱：**

- 第一个JT调用很慢（编译）。基准前先热身。
- 避免在JT内部的JAX数组上进行Python循环。使用“.lax. scanner”或“.lax.fori_loop”。
- '.debug.print（）'在JT内部工作。常规的“print（）”则不然。
- 使用“Deliver.profiler”或TensorBoard进行配置。XLA编译可以隐藏瓶颈。
- JAX默认预分配75%的图形处理器内存。设置“XLA_PYTHON_CLUTE_PREALLOCATE=假”以禁用。

** 检查点：**

```python
import orbax.checkpoint as ocp
checkpointer = ocp.PyTreeCheckpointer()
checkpointer.save('/tmp/model', params)
restored = checkpointer.restore('/tmp/model')
```

** 本课产生：**
- ' outputes/prompt-jax-optimizer.md '--选择正确的JAX优化器配置的提示
- '输出/skill-jax-patterns.md '--涵盖JAX功能模式的技能

## 演习

1. 将辍学添加到MLP中。在JAX中，dropout需要PRNG密钥--将一个密钥通过正向传递并将其拆分为每个dropout层。比较有和没有的测试准确性。

2. 使用“spel.vmap”为一批32个MNIST图像计算每个示例的梯度。计算每个示例的梯度规范。哪些示例具有最大的梯度，为什么？

3. 用通用的“mlp_forward（params，x）”替换手动转发函数，该函数适用于任何数量的层。使用'.tree.leaves '自动确定深度。

4. 使用和不使用“@ spel.jit”对培训步骤进行基准测试。每个步骤计时100步。您的硬件加速有多大？第一次调用的编译费用是多少？

5. 通过编写' optax.chain（optax.clip_by_global_norm（1.0），optax.adam（1 e-3））'来实现梯度剪裁。有修剪和不有修剪的训练。绘制训练的梯度规范以查看效果。

## 关键术语

| Term | 别人怎么说 | 它实际上意味着什么 |
|------|----------------|----------------------|
| XLA | “让JAX变得更快的东西” | 加速线性代数--一个融合运算并从计算图生成优化的图形处理器 |
| JIT | “及时汇编” | JAX在第一次调用时跟踪该函数，编译为XLA，然后在后续调用时运行已编译的版本 |
| 纯函数 | “没有副作用” | 输出仅取决于输入的函数--没有全局状态、没有突变、没有显式密钥就没有随机性 |
| vmap | “自动收件箱” | 将处理一个示例的函数转换为处理批处理的函数，无需重写 |
| pmap | “自动并行” | 跨多个设备复制功能并拆分输入批次 |
| 皮特里 | “数组的嵌套法令” | JAX可以穿越和转换的列表、二元组、字典和数组的任何嵌套结构 |
| 追踪 | “记录计算” | JAX执行具有抽象值的函数来构建计算图，而不计算实际结果 |
| 功能性自动差异 | “一个功能的毕业生” | 通过变换函数而不是通过将梯度存储附加到张量来计算求导 |
| Optax | “JAX的优化器库” | 一个可组合的梯度转换库-- Adam、Singapore、剪裁、调度--将其链在一起 |
| 亚麻 | “JAX的nn.模块” | Google的JAX神经网络库，添加层抽象，同时保持状态显式 |

## 进一步阅读

- JAX文档：https://jax.readthedocs.io/--官方文档，包含有关毕业生、jit和vmap的优秀教程
- “JAX：Python+NumPy程序的可组合转换”（Bradbury等人，2018）--解释设计理念的原创论文
- 亚麻文档：https://flax.readthedocs.io/-- Google的JAX神经网络库
- Patrick Kidger，“Equinox：通过可调用PyTrees和过滤转换在JAX中的神经网络”（2021年）--Flax的Python替代品
- DeepMind，“Optax：可组合的梯度转换和优化”--标准优化器库
- “你不知道JAX”（Colin Raffel，2020）--JAX陷阱和模式的实用指南，来自T5作者之一
