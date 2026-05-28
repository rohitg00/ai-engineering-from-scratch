# JAX 入門

> PyTorch は tensors を mutate します。TensorFlow は graphs を構築します。JAX は pure functions を compile します。最後の 1 つが、deep learning の考え方を変えます。

**種類:** Build
**言語:** Python
**前提:** Phase 03 Lessons 01-10、basic NumPy
**時間:** 約 90 分

## 学習目標

- JAX の functional API（jax.numpy、jax.grad、jax.jit、jax.vmap）を使って pure-function neural network code を書く
- PyTorch の eager mutation と JAX の functional compilation model の重要な design difference を説明する
- jit compilation と vmap vectorization を適用し、naive Python と比べて training loops を高速化する
- JAX で simple network を学習し、explicit state management を PyTorch の object-oriented approach と対比する

## 問題

あなたは PyTorch で neural networks を作る方法を知っています。`nn.Module` を定義し、`.backward()` を呼び、optimizer を step します。それは動きます。何百万人も使っています。

しかし PyTorch には、その DNA に組み込まれた制約があります。operations を Python で 1 つずつ eager に trace することです。すべての `tensor + tensor` は別々の kernel launch です。すべての training step は同じ Python code を再解釈します。540-billion-parameter model を 2,048 TPUs 全体で学習する必要が出るまでは、これで十分です。その規模では overhead が致命的になります。

Google DeepMind は Gemini を JAX で学習しています。Anthropic は Claude を JAX で学習しました。これらは小さな operations ではありません。地球上で最大級の neural network training runs です。彼らが JAX を選んだのは、training loop を Python calls の列ではなく、compile 可能な program として扱うからです。

JAX は 3 つの superpowers を持つ NumPy です。automatic differentiation、XLA への JIT compilation、automatic vectorization。あなたは 1 example を処理する function を書きます。JAX はそれを、batch を処理し、gradients を計算し、machine code に compile し、複数 devices にまたがって実行する function にします。元の function を変えずに、です。

## 概念

### JAX Philosophy

JAX は functional framework です。classes なし、mutable state なし、`.backward()` method なし。代わりに:

| PyTorch | JAX |
|---------|-----|
| state を持つ `nn.Module` class | Pure function: `f(params, x) -> y` |
| `loss.backward()` | `jax.grad(loss_fn)(params, x, y)` |
| Eager execution | XLA による JIT compilation |
| `for x in batch:` manual loop | `jax.vmap(f)` auto-vectorization |
| `DataParallel` / `FSDP` | `jax.pmap(f)` auto-parallelism |
| mutable な `model.parameters()` | arrays の immutable pytree |

これは style preference ではありません。compiler constraint です。JIT compilation には pure functions が必要です。同じ inputs は常に同じ outputs を生み、side effects がない function です。その制約が 100x speedups を可能にします。

### jax.numpy: 見慣れた表面

JAX は accelerator 上で NumPy API を再実装しています。

```python
import jax.numpy as jnp

a = jnp.array([1.0, 2.0, 3.0])
b = jnp.array([4.0, 5.0, 6.0])
c = jnp.dot(a, b)
```

同じ function names。同じ broadcasting rules。同じ slicing semantics。しかし arrays は GPU/TPU 上にあり、すべての operation は compiler によって trace 可能です。

重要な違いが 1 つあります。JAX arrays は immutable です。`a[0] = 5` はできません。代わりに `a = a.at[0].set(5)` と書きます。最初の 1 週間は扱いづらく感じますが、その後腑に落ちます。immutability こそが、`grad`、`jit`、`vmap` のような transformations を composable にします。

### jax.grad: Functional Autodiff

PyTorch は gradients を tensors（`.grad`）に付けます。JAX は gradients を functions に付けます。

```python
import jax

def f(x):
    return x ** 2

df = jax.grad(f)
df(3.0)
```

`jax.grad` は function を受け取り、gradient を計算する新しい function を返します。`.backward()` call はありません。tensors 上に保存される computation graph もありません。gradient はただの別の function であり、呼び出したり、compose したり、JIT-compile したりできます。

これは任意に compose できます。

```python
d2f = jax.grad(jax.grad(f))
d2f(3.0)
```

second derivatives。third derivatives。Jacobians。Hessians。すべて `grad` を compose するだけです。PyTorch でも可能ですが（`torch.autograd.functional.hessian`）、後付けです。JAX ではこれが土台です。

制約: `grad` は pure functions にしか使えません。内部に print statements は置けません（tracing 中に実行され、execution 中ではありません）。external state を mutate できません。explicit key management なしに random number generation もできません。

### jit: XLA へ Compile する

```python
@jax.jit
def train_step(params, x, y):
    loss = loss_fn(params, x, y)
    return loss

fast_step = jax.jit(train_step)
```

最初の call で、JAX は function を trace します。つまり、実行せずにどの operations が起きるかを記録します。その trace を XLA（Accelerated Linear Algebra）へ渡します。XLA は Google の TPUs/GPUs 向け compiler です。XLA は operations を fuse し、冗長な memory copies を削除し、optimized machine code を生成します。

以後の calls では Python を完全に skip します。compiled code が accelerator 上で C++ speed で動きます。

JIT が役立つ場面:
- Training steps（同じ computation を何千回も繰り返す）
- Inference（同じ model、異なる inputs）
- 似た shape の inputs で複数回呼ばれる任意の function

JIT が逆効果になる場面:
- values に依存する Python control flow を持つ functions（traced array である x に対する `if x > 0` など）
- one-shot computations（compilation overhead が runtime を上回る）
- debugging（tracing が実際の execution を隠す）

control flow restriction は現実的な制約です。`jax.lax.cond` は `if/else` を置き換えます。`jax.lax.scan` は `for` loops を置き換えます。これは optional ではありません。compilation の代償です。

### vmap: Automatic Vectorization

1 example を処理する function を書きます。

```python
def predict(params, x):
    return jnp.dot(params['w'], x) + params['b']
```

`vmap` はそれを batch を処理する function に持ち上げます。

```python
batch_predict = jax.vmap(predict, in_axes=(None, 0))
```

`in_axes=(None, 0)` は、`params` には batch をかけず（shared）、`x` の axis 0 に batch をかけるという意味です。manual `for` loop は不要です。reshaping も不要です。batch dimension を手で通す必要もありません。JAX が batch dimension を見つけ、computation 全体を vectorize します。

これは syntactic sugar ではありません。`vmap` は Python loop より 10-100x 速く動く fused vectorized code を生成します。そして `jit` や `grad` と compose できます。

```python
per_example_grads = jax.vmap(jax.grad(loss_fn), in_axes=(None, 0, 0))
```

Per-example gradients。1 行です。これは PyTorch では hacks なしではほぼ不可能です。

### pmap: Devices 間の Data Parallelism

```python
parallel_step = jax.pmap(train_step, axis_name='devices')
```

`pmap` は function を利用可能なすべての devices（GPUs/TPUs）に replicate し、batch を分割します。function 内では、`jax.lax.pmean` と `jax.lax.psum` が devices 間で gradients を synchronize します。

Google は Gemini を、`pmap`（とその successor である `shard_map`）を使って数千の TPU v5e chips 全体で学習しています。programming model は、single-device version を書き、`pmap` で wrap して終わりです。

### Pytrees: Universal Data Structure

JAX は "pytrees"、つまり lists、tuples、dicts、arrays の nested combinations を扱います。model parameters は pytree です。

```python
params = {
    'layer1': {'w': jnp.zeros((784, 256)), 'b': jnp.zeros(256)},
    'layer2': {'w': jnp.zeros((256, 128)), 'b': jnp.zeros(128)},
    'layer3': {'w': jnp.zeros((128, 10)),  'b': jnp.zeros(10)},
}
```

すべての JAX transformation（`grad`、`jit`、`vmap`）は pytrees を traverse する方法を知っています。`jax.tree.map(f, tree)` はすべての leaf に `f` を適用します。optimizers がすべての parameters を一度に更新できるのはこの仕組みです。

```python
params = jax.tree.map(lambda p, g: p - lr * g, params, grads)
```

`.parameters()` method はありません。parameter registration もありません。tree structure が model です。

### Functional vs Object-Oriented

PyTorch は state を objects の中に保存します。

```python
class Model(nn.Module):
    def __init__(self):
        self.linear = nn.Linear(784, 10)

    def forward(self, x):
        return self.linear(x)
```

JAX は explicit state を持つ pure functions を使います。

```python
def predict(params, x):
    return jnp.dot(x, params['w']) + params['b']
```

params は渡されます。何も保存されません。何も mutate されません。これにより、すべての function が testable、composable、compilable になります。同時に、自分で params を管理する必要があります。あるいは Flax や Equinox のような library を使います。

### JAX Ecosystem

JAX は primitives を提供します。libraries は ergonomics を提供します。

| Library | Role | Style |
|---------|------|-------|
| **Flax** (Google) | Neural network layers | explicit state 付き `nn.Module` |
| **Equinox** (Patrick Kidger) | Neural network layers | Pytree-based、Pythonic |
| **Optax** (DeepMind) | Optimizers + LR schedules | composable gradient transforms |
| **Orbax** (Google) | Checkpointing | pytrees の save/restore |
| **CLU** (Google) | Metrics + logging | training loop utilities |

Optax は標準 optimizer library です。gradient transformation（Adam、SGD、clipping）を parameter update から分離し、compose を容易にします。

```python
optimizer = optax.chain(
    optax.clip_by_global_norm(1.0),
    optax.adam(learning_rate=1e-3),
)
```

### When to Use JAX vs PyTorch

| Factor | JAX | PyTorch |
|--------|-----|---------|
| TPU support | first-class（Google が両方を作った） | community-maintained（torch_xla） |
| GPU support | 良い（XLA 経由の CUDA） | best-in-class（native CUDA） |
| Debugging | 難しい（tracing + compilation） | 簡単（eager、line-by-line） |
| Ecosystem | research-focused（Flax、Equinox） | massive（HuggingFace、torchvision など） |
| Hiring | niche（Google/DeepMind/Anthropic） | mainstream（everywhere） |
| Large-scale training | 優秀（XLA、pmap、mesh） | 良い（FSDP、DeepSpeed） |
| Prototyping speed | 遅め（functional overhead） | 速い（mutate and go） |
| Production inference | TensorFlow Serving、Vertex AI | TorchServe、Triton、ONNX |
| Who uses it | DeepMind（Gemini）、Anthropic（Claude） | Meta（Llama）、OpenAI（GPT）、Stability AI |

正直な答えは、JAX を使う明確な理由がない限り PyTorch を使うことです。その理由とは、TPU access、per-example gradients の必要性、massive scale の multi-device training、または Google/DeepMind/Anthropic で働いていることです。

### Random Numbers in JAX

JAX には global random state がありません。すべての random operation には explicit PRNG key が必要です。

```python
key = jax.random.PRNGKey(42)
key1, key2 = jax.random.split(key)
w = jax.random.normal(key1, shape=(784, 256))
```

これは最初は面倒です。しかし devices や compilations をまたいだ reproducibility を保証します。これは multi-GPU settings では PyTorch の `torch.manual_seed` では保証できない性質です。

## 作ってみる

### Step 1: Setup and Data

JAX と Optax を使って MNIST 上で 3-layer MLP を学習します。784 inputs、256 と 128 neurons の hidden layers 2 つ、10 output classes です。

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

### Step 2: Parameters を初期化する

class はありません。pytree を返す function だけです。

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

He-initialization を手動で行っています。1 つの seed から 3 つの PRNG keys を split します。すべての weight は nested dict 内の immutable array です。

### Step 3: Forward Pass

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

Pure functions です。Params in、prediction out。`self` はなく、stored state もありません。`loss_fn` は cross-entropy をゼロから計算しています。softmax、log、negative mean です。

### Step 4: JIT-Compiled Training Step

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

`jax.value_and_grad` は 1 回の pass で loss value と gradients の両方を返します。`@jax.jit` decorator は両方の functions を XLA に compile します。最初の call の後、各 training step は Python に触れずに実行されます。

### Step 5: Training Loop

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

10 epochs。test accuracy は約 97%。最初の epoch は遅いです（JIT compilation）。epochs 2-10 は高速です。

欠けているものに注目してください。`.zero_grad()` も、`.backward()` も、`.step()` もありません。update 全体が 1 つの composed function call です。gradients が計算され、Adam によって変換され、parameters に適用されます。すべて `train_step` の中です。

## 使ってみる

### Flax: Google Standard

Flax は最も一般的な JAX neural network library です。`nn.Module` を戻しますが、explicit state management を伴います。

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

PyTorch と同じ構造ですが、`params` は model から分離されています。`model.init()` が params を作ります。`model.apply(params, x)` が forward pass を実行します。model object は state を持ちません。

### Equinox: Pythonic Alternative

Equinox（Patrick Kidger による）は models を pytrees として表現します。

```python
import equinox as eqx

model = eqx.nn.MLP(
    in_size=784, out_size=10, width_size=256, depth=2,
    activation=jax.nn.relu, key=jax.random.PRNGKey(0)
)
logits = model(x)
```

model 自体が pytree です。`.apply()` は不要です。parameters は model の leaves です。これは JAX の考え方により近い形です。

### Optax: Composable Optimizers

Optax は gradient transformation を update から decouple します。

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

Gradient clipping、learning rate warmup、weight decay。すべて transform の chain として compose されています。各 transform は gradients を受け取り、それを変更し、次へ渡します。monolithic optimizer class はありません。

## 成果物

**Installation:**

```bash
pip install jax jaxlib optax flax
```

GPU support:

```bash
pip install jax[cuda12]
```

TPU（Google Cloud）:

```bash
pip install jax[tpu] -f https://storage.googleapis.com/jax-releases/libtpu_releases.html
```

**Performance gotchas:**

- 最初の JIT call は遅いです（compilation）。benchmarking の前に warm up してください。
- JIT 内で JAX arrays に対する Python loops は避けてください。`jax.lax.scan` または `jax.lax.fori_loop` を使います。
- `jax.debug.print()` は JIT 内で動きます。通常の `print()` は動きません。
- `jax.profiler` または TensorBoard で profile してください。XLA compilation は bottlenecks を隠すことがあります。
- JAX は default で GPU memory の 75% を pre-allocate します。無効化するには `XLA_PYTHON_CLIENT_PREALLOCATE=false` を設定します。

**Checkpointing:**

```python
import orbax.checkpoint as ocp
checkpointer = ocp.PyTreeCheckpointer()
checkpointer.save('/tmp/model', params)
restored = checkpointer.restore('/tmp/model')
```

**この lesson で作るもの:**
- `outputs/prompt-jax-optimizer.md` -- 適切な JAX optimizer configuration を選ぶための prompt
- `outputs/skill-jax-patterns.md` -- JAX の functional patterns を扱う skill

## 演習

1. MLP に dropout を追加してください。JAX では dropout に PRNG key が必要です。forward pass に key を通し、各 dropout layer 用に split してください。あり/なしで test accuracy を比較します。

2. `jax.vmap` を使い、32 枚の MNIST images の batch について per-example gradients を計算してください。各 example の gradient norm を計算します。どの examples が最大 gradients を持ちますか。なぜですか。

3. manual forward function を、任意の number of layers で動く generic な `mlp_forward(params, x)` に置き換えてください。`jax.tree.leaves` を使って depth を自動的に決めます。

4. `@jax.jit` あり/なしで training step を benchmark してください。それぞれ 100 steps を計測します。あなたの hardware では speedup はどれくらいですか。first call の compilation overhead はどれくらいですか。

5. `optax.chain(optax.clip_by_global_norm(1.0), optax.adam(1e-3))` を compose して gradient clipping を実装してください。clipping あり/なしで学習します。training 中の gradient norm を plot して effect を確認してください。

## 重要用語

| 用語 | よく言われること | 実際の意味 |
|------|----------------|----------------------|
| XLA | "The thing that makes JAX fast" | Accelerated Linear Algebra。computation graph から operations を fuse し、optimized GPU/TPU kernels を生成する compiler |
| JIT | "Just-in-time compilation" | JAX が first call で function を trace し、XLA に compile し、subsequent calls では compiled version を実行すること |
| Pure function | "No side effects" | output が inputs だけに依存する function。global state、mutation、explicit keys なしの randomness がない |
| vmap | "Auto-batching" | 1 example を処理する function を、書き換えなしに batch を処理するものへ変換する |
| pmap | "Auto-parallelism" | function を複数 devices に replicate し、input batch を分割する |
| Pytree | "Nested dict of arrays" | JAX が traverse して transform できる、lists、tuples、dicts、arrays の任意の nested structure |
| Tracing | "Recording the computation" | 実際の results を計算せず、abstract values で function を実行して computation graph を構築すること |
| Functional autodiff | "grad of a function" | gradient storage を tensors に付けるのではなく、functions を変換して derivatives を計算すること |
| Optax | "JAX's optimizer library" | Adam、SGD、clipping、scheduling などを chain できる composable gradient transformations の library |
| Flax | "JAX's nn.Module" | state を explicit に保ったまま layer abstractions を追加する、Google の JAX 用 neural network library |

## 参考資料

- JAX documentation: https://jax.readthedocs.io/ -- grad、jit、vmap の優れた tutorials を含む official docs
- "JAX: composable transformations of Python+NumPy programs" (Bradbury et al., 2018) -- design philosophy を説明する original paper
- Flax documentation: https://flax.readthedocs.io/ -- Google の JAX 用 neural network library
- Patrick Kidger, "Equinox: neural networks in JAX via callable PyTrees and filtered transformations" (2021) -- Flax の Pythonic alternative
- DeepMind, "Optax: composable gradient transformation and optimisation" -- standard optimizer library
- "You Don't Know JAX" (Colin Raffel, 2020) -- T5 authors の 1 人による、JAX gotchas and patterns の practical guide
