# JAX 入門

> PyTorch 會就地修改張量（tensor）。TensorFlow 會建圖。JAX 會編譯純函式（pure function）。最後這一件，會改變你怎麼想深度學習（deep learning）。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 03 Lessons 01-10, basic NumPy
**Time:** ~90 minutes

## Learning Objectives｜學習目標

- 用 JAX 的函數式 API 寫純函式神經網路（neural network）程式：jax.numpy、jax.grad、jax.jit、jax.vmap
- 說明 PyTorch 的立即執行（eager execution）就地修改，和 JAX 的函數式編譯模型，關鍵設計差在哪
- 用 jit 編譯和 vmap 向量化（vectorization），讓訓練迴圈比單純的 Python 更快
- 在 JAX 裡訓練一個簡單網路，並把明確的狀態管理和 PyTorch 的物件導向作法對照

## The Problem｜問題

你知道怎麼在 PyTorch 裡建神經網路。你定義一個 `nn.Module`，呼叫 `.backward()`，再讓最佳化器（optimizer）走一步。它能動。好幾百萬人在用。

但 PyTorch 的骨子裡有一個限制：它以立即執行（eager execution）的方式，在 Python 裡一次一個地追蹤運算。每一次 `tensor + tensor` 都是一次獨立的 GPU kernel 啟動。每一步訓練都把同一段 Python 重新解讀一次。這在你要跨 2,048 個 TPU 訓練一個 5400 億參數（parameter）的模型（model）之前都還好。到了那個規模，額外開銷會把你拖垮。

Google DeepMind 用 JAX 訓練 Gemini。Anthropic 用 JAX 訓練 Claude。這不是小規模的運算。它們是地球上最大規模的神經網路訓練。他們選 JAX，是因為它把訓練迴圈當成一個可以編譯的程式，而不是一連串 Python 呼叫。

JAX 是帶三項超能力的 NumPy：自動微分（automatic differentiation）、JIT 編譯成 XLA，以及自動向量化。你寫一個處理一個例子的函式。JAX 給你一個能處理一個批次（batch）、計算梯度（gradient）、編譯成機器碼、並跨多個裝置（device）執行的函式。原本那個函式不用改。

## The Concept｜核心概念

### JAX 的哲學

JAX 是一個函數式框架（framework）。沒有類別，沒有可變狀態，沒有 `.backward()` 方法。取而代之的是：

| PyTorch | JAX |
|---------|-----|
| 帶狀態的 `nn.Module` 類別 | 純函式：`f(params, x) -> y` |
| `loss.backward()` | `jax.grad(loss_fn)(params, x, y)` |
| 立即執行（eager execution） | 經由 XLA 的 JIT 編譯 |
| 手動的 `for x in batch:` 迴圈 | `jax.vmap(f)` 自動向量化 |
| `DataParallel` / `FSDP` | `jax.pmap(f)` 自動平行化 |
| 可變的 `model.parameters()` | 不可變的陣列 pytree |

這不是風格偏好。這是編譯器的限制。JIT 編譯要求純函式：同樣的輸入永遠得到同樣的輸出，沒有副作用（side effect）。這個限制，才讓 100 倍的加速成為可能。

### jax.numpy：熟悉的表面

JAX 在加速器上重新實作了 NumPy API：

```python
import jax.numpy as jnp

a = jnp.array([1.0, 2.0, 3.0])
b = jnp.array([4.0, 5.0, 6.0])
c = jnp.dot(a, b)
```

函式名稱相同。廣播（broadcasting）規則相同。切片的語意相同。但陣列放在 GPU/TPU 上，而且每個運算都能被編譯器追蹤。

一個關鍵差別：JAX 陣列不可變。不能寫 `a[0] = 5`。要寫 `a = a.at[0].set(5)`。剛開始會覺得不太習慣，過一週左右就會上手。不可變，才讓 `grad`、`jit` 和 `vmap` 這類變換可以組合。

### jax.grad：函數式自動微分

PyTorch 把梯度附在張量上，也就是 `.grad`。JAX 把梯度附在函式上。

```python
import jax

def f(x):
    return x ** 2

df = jax.grad(f)
df(3.0)
```

`jax.grad` 接收一個函式，回傳一個新函式來算梯度。沒有 `.backward()` 呼叫。張量上不會存著計算圖（computational graph）。梯度只是另一個你可以呼叫、組合或 JIT 編譯的函式。

這可以任意組合：

```python
d2f = jax.grad(jax.grad(f))
d2f(3.0)
```

二階導數（derivative）。三階導數。Jacobian。Hessian。全部靠組合 `grad`。PyTorch 也能做，`torch.autograd.functional.hessian`，但那是後來補上去的。在 JAX 裡，這是根基。

限制是：`grad` 只對純函式有效。裡面不能有 print，因為 print 在追蹤（tracing）時跑，不是在執行時跑。不能改外部狀態。沒有明確的 key 管理，就不能產生隨機數。

### jit：編譯成 XLA

```python
@jax.jit
def train_step(params, x, y):
    loss = loss_fn(params, x, y)
    return loss

fast_step = jax.jit(train_step)
```

第一次呼叫時，JAX 追蹤這個函式。它記下發生了哪些運算，但先不執行。然後把這份追蹤交給 XLA（Accelerated Linear Algebra），Google 給 TPU 和 GPU 用的編譯器。XLA 把運算融合、去掉多餘的記憶體（memory）複製，並產生最佳化過的機器碼。

之後的呼叫完全跳過 Python。編譯好的程式在加速器上以 C++ 的速度跑。

JIT 有幫助的時候：

- 訓練步驟，同一段計算重複幾千次
- 推論（inference），同一個模型、不同輸入
- 任何呼叫超過一次、而且輸入形狀相近的函式

JIT 會傷到你的時候：

- 函式裡的 Python 控制流取決於數值，例如 `if x > 0`，而 x 是被追蹤的陣列
- 只跑一次的計算，編譯開銷超過執行時間
- 除錯，追蹤把真正的執行藏起來

控制流的限制是真的。`jax.lax.cond` 取代 `if/else`。`jax.lax.scan` 取代 `for` 迴圈。這不是可選的。這是編譯的代價。

### vmap：自動向量化

你寫一個處理一個例子的函式：

```python
def predict(params, x):
    return jnp.dot(params['w'], x) + params['b']
```

`vmap` 把它提升成能處理一個批次：

```python
batch_predict = jax.vmap(predict, in_axes=(None, 0))
```

`in_axes=(None, 0)` 的意思是：不要對 `params` 分批，它是共用的；對 `x` 的第 0 軸分批。沒有手動的 `for` 迴圈。不用重塑形狀。不用把批次維度一路傳下去。JAX 自己找出批次維度，把整段計算向量化。

這不是語法糖。`vmap` 產生融合過的向量化程式，比 Python 迴圈快 10 到 100 倍。而且它和 `jit`、`grad` 可以組合：

```python
per_example_grads = jax.vmap(jax.grad(loss_fn), in_axes=(None, 0, 0))
```

每個例子各算一次梯度。一行。在 PyTorch 裡若沒有各種權宜作法，這幾乎做不到。

### pmap：跨裝置的資料平行

```python
parallel_step = jax.pmap(train_step, axis_name='devices')
```

`pmap` 把函式複製到所有可用的裝置上，可以是 GPU 或 TPU，並把批次切開。函式裡用 `jax.lax.pmean` 和 `jax.lax.psum` 在裝置之間同步梯度。

Google 用 `pmap`，以及它的後繼者 `shard_map`，在幾千顆 TPU v5e 上訓練 Gemini。程式模型是：寫好單裝置版本，用 `pmap` 包起來，就完成了。

### Pytree：通用的資料結構

JAX 操作的是 pytree，也就是清單、tuple、dict 和陣列的巢狀組合。你的模型參數就是一棵 pytree：

```python
params = {
    'layer1': {'w': jnp.zeros((784, 256)), 'b': jnp.zeros(256)},
    'layer2': {'w': jnp.zeros((256, 128)), 'b': jnp.zeros(128)},
    'layer3': {'w': jnp.zeros((128, 10)),  'b': jnp.zeros(10)},
}
```

每一個 JAX 變換，`grad`、`jit`、`vmap`，都知道怎麼走訪 pytree。`jax.tree.map(f, tree)` 把 `f` 套到每一片葉子。最佳化器就是這樣一次更新所有參數：

```python
params = jax.tree.map(lambda p, g: p - lr * g, params, grads)
```

沒有 `.parameters()` 方法。沒有參數註冊。樹的結構就是模型。

### 函數式和物件導向

PyTorch 把狀態存在物件裡：

```python
class Model(nn.Module):
    def __init__(self):
        self.linear = nn.Linear(784, 10)

    def forward(self, x):
        return self.linear(x)
```

JAX 用帶明確狀態的純函式：

```python
def predict(params, x):
    return jnp.dot(x, params['w']) + params['b']
```

參數傳進去。沒有東西被存起來。沒有東西被就地修改。所以每個函式都可以測試、可以組合、可以編譯。這也表示參數要你自己管，或用 Flax、Equinox 這類函式庫（library）。

### JAX 的生態系

JAX 給你基本元件。函式庫給你好用的介面：

| 函式庫 | 角色 | 風格 |
|---------|------|-------|
| **Flax**（Google） | 神經網路層 | 帶明確狀態的 `nn.Module` |
| **Equinox**（Patrick Kidger） | 神經網路層 | 以 pytree 為基礎，很 Pythonic |
| **Optax**（DeepMind） | 最佳化器加學習率排程（learning rate schedule） | 可組合的梯度變換 |
| **Orbax**（Google） | 檢查點 | 儲存和還原 pytree |
| **CLU**（Google） | 指標（metric）和日誌記錄（logging） | 訓練迴圈的工具 |

Optax 是標準的最佳化器函式庫。它把梯度變換，例如 Adam、SGD、梯度裁剪（gradient clipping），和參數更新分開，所以組合起來很直接：

```python
optimizer = optax.chain(
    optax.clip_by_global_norm(1.0),
    optax.adam(learning_rate=1e-3),
)
```

### 什麼時候用 JAX，什麼時候用 PyTorch

| 因素 | JAX | PyTorch |
|--------|-----|---------|
| TPU 支援 | 官方一級支援，Google 兩邊都是自己做的 | 社群維護，torch_xla |
| GPU 支援 | 好，經由 XLA 用 CUDA | 最好，原生 CUDA |
| 除錯 | 難，追蹤加編譯 | 容易，立即執行，一行一行看 |
| 生態系 | 偏研究，Flax、Equinox | 非常大，HuggingFace、torchvision 等 |
| 徵人 | 很小眾，Google/DeepMind/Anthropic | 主流，到處都是 |
| 大規模訓練 | 更強，XLA、pmap、mesh | 好，FSDP、DeepSpeed |
| 原型速度 | 較慢，函數式有額外開銷 | 較快，改完就跑 |
| 正式環境推論 | TensorFlow Serving、Vertex AI | TorchServe、Triton、ONNX |
| 誰在用 | DeepMind 的 Gemini、Anthropic 的 Claude | Meta 的 Llama、OpenAI 的 GPT、Stability AI |

老實講：除非你有特定理由，否則用 PyTorch。那些理由是：有 TPU、需要每個例子各算一次梯度、超大規模的多裝置訓練，或你在 Google、DeepMind、Anthropic 工作。

### JAX 裡的隨機數

JAX 沒有全域的隨機狀態。每次隨機運算都要一把明確的 PRNG key：

```python
key = jax.random.PRNGKey(42)
key1, key2 = jax.random.split(key)
w = jax.random.normal(key1, shape=(784, 256))
```

這一開始很煩。但它保證跨裝置、跨編譯都可重現。PyTorch 的 `torch.manual_seed` 在多 GPU 設定下做不到這件事。

```figure
batchnorm-effect
```

## Build It｜動手實作

### 步驟 1：設定和資料

我們用 JAX 和 Optax，在 MNIST 上訓練一個 3 層 MLP。784 個輸入，兩個隱藏層（hidden layer）各 256 和 128 個神經元（neuron），10 個輸出類別。

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

### 步驟 2：初始化參數

沒有類別。只是一個回傳 pytree 的函式：

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

手動做的 He 初始化。從一顆種子拆出三把 PRNG key。每個權重（weight）都是巢狀 dict 裡的不可變陣列。

### 步驟 3：前向傳遞（forward pass）

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

純函式。參數進去，預測出來。沒有 `self`，沒有存起來的狀態。`loss_fn` 從頭算交叉熵：softmax、log、負的平均數（mean）。

### 步驟 4：JIT 編譯的訓練步驟

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

`jax.value_and_grad` 同一趟回傳損失值和梯度。`@jax.jit` 裝飾器把兩個函式都編譯成 XLA。第一次呼叫之後，每一步訓練都不再碰到 Python。

### 步驟 5：訓練迴圈

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

10 個 epoch（訓練週期）。測試準確率約 97%。第一個 epoch 很慢，因為在做 JIT 編譯。第 2 到第 10 個 epoch 就快了。

注意少了什麼：沒有 `.zero_grad()`，沒有 `.backward()`，沒有 `.step()`。整次更新是一次組合好的函式呼叫。梯度在 `train_step` 裡被算出來，經 Adam 變換，再套到參數上。

## Use It｜實際應用

### Flax：Google 的標準

Flax 是最常用的 JAX 神經網路函式庫。它把 `nn.Module` 加回來，但狀態管理是明確的：

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

結構和 PyTorch 相同，但 `params` 和模型是分開的。`model.init()` 建立參數。`model.apply(params, x)` 跑前向傳遞。模型物件本身沒有狀態。

### Equinox：更 Pythonic 的替代

Equinox 是 Patrick Kidger 做的，把模型表示成 pytree：

```python
import equinox as eqx

model = eqx.nn.MLP(
    in_size=784, out_size=10, width_size=256, depth=2,
    activation=jax.nn.relu, key=jax.random.PRNGKey(0)
)
logits = model(x)
```

模型本身就是一棵 pytree。不需要 `.apply()`。參數就是模型的葉子。這更接近 JAX 的想法。

### Optax：可組合的最佳化器

Optax 把梯度變換和更新拆開：

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

梯度裁剪、學習率（learning rate）預熱（warmup）、權重衰減（weight decay），全部組成一條變換鏈。每個變換看到梯度、修改它，再傳給下一個。沒有一個龐大的最佳化器類別。

## Ship It｜交付成果

**安裝：**

```bash
pip install jax jaxlib optax flax
```

要 GPU 支援：

```bash
pip install jax[cuda12]
```

要 TPU，在 Google Cloud 上：

```bash
pip install jax[tpu] -f https://storage.googleapis.com/jax-releases/libtpu_releases.html
```

**效能上容易踩的坑：**

- 第一次 JIT 呼叫很慢，因為在編譯。做基準測試前先暖機。
- 在 JIT 裡不要用 Python 迴圈走過 JAX 陣列。用 `jax.lax.scan` 或 `jax.lax.fori_loop`。
- `jax.debug.print()` 在 JIT 裡能用。一般的 `print()` 不能。
- 用 `jax.profiler` 或 TensorBoard 剖析。XLA 編譯可能把瓶頸藏起來。
- JAX 預設先配置 75% 的 GPU 記憶體。設 `XLA_PYTHON_CLIENT_PREALLOCATE=false` 可以關掉。

**檢查點：**

```python
import orbax.checkpoint as ocp
checkpointer = ocp.PyTreeCheckpointer()
checkpointer.save('/tmp/model', params)
restored = checkpointer.restore('/tmp/model')
```

**本課會產出：**

- `outputs/prompt-jax-optimizer.md`：一份 prompt，用來選擇合適的 JAX 最佳化器設定
- `outputs/skill-jax-patterns.md`：一份涵蓋 JAX 函數式模式的技能

## Exercises｜練習

1. 給 MLP 加上 dropout。在 JAX 裡，dropout 需要一把 PRNG key。把 key 傳過前向傳遞，並為每一層 dropout 拆一把。比較有 dropout 和沒有 dropout 的測試準確率。
2. 用 `jax.vmap` 為一批 32 張 MNIST 影像，替每個例子計算梯度。計算每個例子的梯度範數。哪些例子的梯度最大，為什麼？
3. 把手動的前向函式換成通用的 `mlp_forward(params, x)`，任何層數都能用。用 `jax.tree.leaves` 自動判斷深度。
4. 比較有 `@jax.jit` 和沒有它的訓練步驟。各計時 100 步。在你的硬體上加速有多大？第一次呼叫的編譯開銷是多少？
5. 用 `optax.chain(optax.clip_by_global_norm(1.0), optax.adam(1e-3))` 實作梯度裁剪。有裁剪和沒有裁剪都訓練。畫出訓練過程的梯度範數，看效果。

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|----------------|----------------------|
| XLA | 「讓 JAX 變快的那個東西」 | Accelerated Linear Algebra。一個編譯器，把運算融合，並從計算圖產生最佳化過的 GPU/TPU 核心 |
| JIT | 「即時編譯」 | JAX 在第一次呼叫時追蹤函式、編譯成 XLA，之後的呼叫跑編譯好的版本 |
| 純函式 | 「沒有副作用」 | 輸出只取決於輸入的函式。沒有全域狀態，沒有就地修改，沒有明確的 key 就不產生隨機數 |
| vmap | 「自動分批」 | 把處理一個例子的函式，變成處理一個批次的函式，不用重寫 |
| pmap | 「自動平行化」 | 把函式複製到多個裝置，並把輸入批次切開 |
| pytree | 「巢狀的陣列 dict」 | 任何由清單、tuple、dict 和陣列組成的巢狀結構，JAX 可以走訪並變換 |
| 追蹤 | 「把計算記下來」 | JAX 用抽象值執行函式，建出計算圖，不算真正的結果 |
| 函數式自動微分 | 「對函式取 grad」 | 用變換函式來算導數，而不是把梯度儲存附在張量上 |
| Optax | 「JAX 的最佳化器函式庫」 | 可組合的梯度變換函式庫。Adam、SGD、裁剪、排程可以串成一鏈 |
| Flax | 「JAX 的 nn.Module」 | Google 給 JAX 的神經網路函式庫。加上層的抽象，同時讓狀態保持明確 |

## Further Reading｜延伸閱讀

- JAX documentation: https://jax.readthedocs.io/ ——官方文件，grad、jit 和 vmap 的教學寫得很好
- "JAX: composable transformations of Python+NumPy programs" (Bradbury et al., 2018)——說明設計哲學的原始論文
- Flax documentation: https://flax.readthedocs.io/ ——Google 給 JAX 的神經網路函式庫
- Patrick Kidger, "Equinox: neural networks in JAX via callable PyTrees and filtered transformations" (2021)——比 Flax 更 Pythonic 的替代
- DeepMind, "Optax: composable gradient transformation and optimisation"——標準的最佳化器函式庫
- "You Don't Know JAX" (Colin Raffel, 2020)——一份實用指南，講 JAX 容易踩的坑和常見模式，作者是 T5 的作者之一
