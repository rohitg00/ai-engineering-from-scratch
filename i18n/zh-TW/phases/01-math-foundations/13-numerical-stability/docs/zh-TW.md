# 數值穩定性

> 浮點數是一種有漏洞的抽象。訓練時它會反咬你一口，而你不會預先察覺。

**Type:** Build
**Language:** Python
**Prerequisites:** Phase 1, Lessons 01-04
**Time:** ~120 minutes

## Learning Objectives｜學習目標

- 用最大值相減技巧（max-subtraction trick）實作數值穩定的 softmax 和 log-sum-exp
- 找出浮點運算中的溢位（overflow）、下溢位（underflow）和災難性消去（catastrophic cancellation）
- 使用中心有限差分（centered finite difference），驗證解析梯度與數值梯度（numerical gradient）是否一致
- 說明訓練時為什麼偏好 bfloat16 而非 float16，以及損失縮放（loss scaling）如何避免梯度下溢位

## The Problem｜問題

模型訓練了三小時，接著損失變成 NaN。你加了一行印出數值的程式碼：第 9,000 步的 logits 還正常；第 9,001 步就變成 `inf`；到了第 9,002 步，每個梯度都是 `nan`，訓練也停擺了。

或者，模型順利訓練完成，但準確率比論文低了 2%。你逐一檢查，架構、超參數和資料都一致。問題在於論文用 float32，而你用 float16，卻沒有正確縮放。32 位元浮點運算中累積的捨入誤差（rounding error），悄悄吃掉了你的準確率。

或者，你從零實作交叉熵損失（cross-entropy loss）。logits 不大時都正常，但超過 100 就回傳 `inf`。softmax 發生溢位，因為 `exp(100)` 大到超出 float32 的表示範圍。每個 ML 框架都用一個兩行的小技巧處理這件事，但你不知道它存在。

數值穩定性不是理論上的顧慮，而是訓練能否成功、還是悄悄失敗的關鍵。你遲早會除錯的每個嚴重 ML 錯誤，最後都會追溯到浮點數。

## The Concept｜核心概念

### IEEE 754：電腦如何儲存實數

電腦依照 IEEE 754 標準，以浮點數儲存實數。一個浮點數有三個部分：符號位元（sign bit）、指數（exponent）和尾數（mantissa，也稱 significand）。

```
Float32 layout (32 bits total):
[1 sign] [8 exponent] [23 mantissa]

Value = (-1)^sign * 2^(exponent - 127) * 1.mantissa
```

尾數決定精度（有效數字有幾位），指數決定範圍（數值能有多大或多小）。

```
Format     Bits   Exponent  Mantissa  Decimal digits  Range (approx)
float64    64     11        52        ~15-16          +/- 1.8e308
float32    32     8         23        ~7-8            +/- 3.4e38
float16    16     5         10        ~3-4            +/- 65,504
bfloat16   16     8         7         ~2-3            +/- 3.4e38
```

float32 約有 7 位十進位精度。它能分辨 1.0000001 和 1.0000002，卻分不出 1.00000001 和 1.00000002。超過 7 位的部分都會受捨入雜訊影響。

float16 約有 3 位精度，能表示的最大值是 65,504。這個範圍小得令人不安，因為 ML 的 logits、梯度和活化值常常會超過它。

bfloat16 是 Google 為了解決 float16 範圍不足而設計的格式。它和 float32 有相同的 8 位元指數（範圍相同，最大約 3.4e38），但只有 7 位元尾數（精度比 float16 更低）。對神經網路訓練而言，範圍通常比精度重要，所以 bfloat16 往往更適合。

### 為什麼 0.1 + 0.2 不等於 0.3

0.1 無法以二進位浮點數精確表示。在以 2 為底時，它是循環小數：

```
0.1 in binary = 0.0001100110011001100110011... (repeating forever)
```

float32 會將它截斷至 23 位元尾數。儲存的數值約為 0.100000001490116。0.2 同樣約儲存為 0.200000002980232。兩者相加得到 0.300000004470348，而不是 0.3。

```
In Python:
>>> 0.1 + 0.2
0.30000000000000004

>>> 0.1 + 0.2 == 0.3
False
```

這對 ML 很重要，因為：

1. `if loss < threshold` 之類的損失比較可能得出錯誤結果
2. 累加許多小數值（例如數千步的梯度更新）會逐漸偏離真正的總和
3. 如果用 `==` 比較浮點數，檢查碼和可重現性測試就可能失敗

解法：絕不要用 `==` 比較浮點數。改用 `abs(a - b) < epsilon` 或 `math.isclose()`。

### 災難性消去

當你相減兩個非常接近的浮點數時，有效數字會互相抵消，原本微不足道的捨入雜訊反而成為主要數值。

```
a = 1.0000001    (stored as 1.00000011920929 in float32)
b = 1.0000000    (stored as 1.00000000000000 in float32)

True difference:  0.0000001
Computed:         0.00000011920929

Relative error: 19.2%
```

只做一次減法，相對誤差（relative error）就達到 19%。在 ML 中，下列情況都可能發生這種問題：

- 計算平均數很大的資料之變異數（variance）：當 E[x] 很大時，`E[x^2] - E[x]^2`
- 相減非常接近的對數機率（log probability）
- 用太小的 epsilon 計算有限差分梯度

解法：重新整理公式，避免相減兩個很大且接近的數值。計算變異數時，可用 Welford 演算法，或先將資料置中。計算對數機率時，則全程在對數空間中運算。

### 溢位與下溢位

結果大到無法表示時會發生溢位；結果太小、比最小可表示正數更接近零時，則會發生下溢位。

```
Float32 boundaries:
  Maximum:  3.4028235e+38
  Minimum positive (normal): 1.175e-38
  Minimum positive (denorm): 1.401e-45
  Overflow:  anything > 3.4e38 becomes inf
  Underflow: anything < 1.4e-45 becomes 0.0
```

在 ML 中，`exp()` 是溢位的主要來源：

```
exp(88.7)  = 3.40e+38   (barely fits in float32)
exp(89.0)  = inf         (overflow)
exp(-87.3) = 1.18e-38   (barely above underflow)
exp(-104)  = 0.0         (underflow to zero)
```

`log()` 函式則可能在另一端出問題：

```
log(0.0)   = -inf
log(-1.0)  = nan
log(1e-45) = -103.3      (fine)
log(1e-46) = -inf        (input underflowed to 0, then log(0) = -inf)
```

在 ML 中，`exp()` 會出現在 softmax、sigmoid 和機率計算裡；`log()` 則用於交叉熵、對數概似和 KL 散度。若沒有合適技巧，`log(exp(x))` 這組運算就像走在雷區上。

### Log-Sum-Exp 技巧

直接計算 `log(sum(exp(x_i)))` 在數值上很危險。只要任一 `x_i` 很大，`exp(x_i)` 就會溢位；如果所有 `x_i` 都非常負，每個 `exp(x_i)` 都會因下溢位而成為零，接著 `log(0)` 就是 `-inf`。

這個技巧是在取指數前先減去最大值：

```
log(sum(exp(x_i))) = max(x) + log(sum(exp(x_i - max(x))))
```

為什麼有效？減去 `max(x)` 後，最大的指數項是 `exp(0) = 1`，不可能溢位。總和中至少有一項為 1，因此總和至少是 1，`log(1) = 0`，不會因下溢位而得到 `-inf`。

證明：

```
log(sum(exp(x_i)))
= log(sum(exp(x_i - c + c)))                    (add and subtract c)
= log(sum(exp(x_i - c) * exp(c)))               (exp(a+b) = exp(a)*exp(b))
= log(exp(c) * sum(exp(x_i - c)))               (factor out exp(c))
= c + log(sum(exp(x_i - c)))                    (log(a*b) = log(a) + log(b))
```

令 `c = max(x)`，就能消除溢位。

這個技巧在 ML 中無所不在：
- softmax 正規化
- 交叉熵損失計算
- 序列模型中的對數機率加總
- 高斯混合模型
- 變分推論

### 為什麼 Softmax 需要最大值相減技巧

Softmax 會將 logits 轉換成機率：

```
softmax(x_i) = exp(x_i) / sum(exp(x_j))
```

如果沒有這個技巧，logits 為 [100, 101, 102] 時就會溢位：

```
exp(100) = 2.69e43
exp(101) = 7.31e43
exp(102) = 1.99e44
sum      = 2.99e44

These overflow float32 (max ~3.4e38)? No, 2.69e43 < 3.4e38? Actually:
exp(88.7) is already at the float32 limit.
exp(100) = inf in float32.
```

使用這個技巧，先減去 max(x) = 102：

```
exp(100 - 102) = exp(-2) = 0.135
exp(101 - 102) = exp(-1) = 0.368
exp(102 - 102) = exp(0)  = 1.000
sum = 1.503

softmax = [0.090, 0.245, 0.665]
```

機率完全相同，計算也安全。這不是效能最佳化，而是確保正確性的必要條件。

### NaN 與 Inf：偵測和預防

`nan`（Not a Number，非數值）和 `inf`（infinity，無限大）會在運算中快速傳播。梯度更新中只要有一個 `nan`，權重就會變成 `nan`，接著所有輸出都會是 `nan`。訓練一個步驟內就會停擺。

`inf` 的成因：
- 對很大的正數呼叫 `exp()`
- 除以零：`1.0 / 0.0`
- 累加時 `float32` 溢位

`nan` 的成因：
- `0.0 / 0.0`
- `inf - inf`
- `inf * 0`
- 對負數呼叫 `sqrt()`
- 對負數呼叫 `log()`
- 任何涉及既有 `nan` 的算術運算

偵測方式：

```python
import math

math.isnan(x)       # True if x is nan
math.isinf(x)       # True if x is +inf or -inf
math.isfinite(x)    # True if x is neither nan nor inf
```

預防策略：

1. 限制輸入 `exp()` 的範圍：`exp(clamp(x, -80, 80))`
2. 在分母加上 epsilon：`x / (y + 1e-8)`
3. 在 `log()` 裡加上 epsilon：`log(x + 1e-8)`
4. 使用穩定的實作（log-sum-exp、穩定 softmax）
5. 用梯度裁剪（gradient clipping）防止權重爆炸
6. 除錯期間，每次前向傳遞後都檢查 `nan`／`inf`

### 數值梯度檢查

解析梯度（由反向傳播（backpropagation）算出）可能有錯。數值梯度檢查會用有限差分計算梯度，以驗證解析梯度。

中心差分公式：

```
df/dx ~= (f(x + h) - f(x - h)) / (2h)
```

此公式的誤差階為 O(h^2)，比誤差階只有 O(h) 的前向差分 `(f(x+h) - f(x)) / h` 好得多。

選擇 h：太大，近似就會不準；太小，災難性消去會破壞結果。常見範圍是 `h = 1e-5` 到 `1e-7`。

檢查方式：計算解析梯度與數值梯度之間的相對差異。

```
relative_error = |grad_analytical - grad_numerical| / max(|grad_analytical|, |grad_numerical|, 1e-8)
```

經驗法則：
- relative_error < 1e-7：完美，梯度正確
- relative_error < 1e-5：可接受，梯度很可能正確
- relative_error > 1e-3：有地方出錯
- relative_error > 1：梯度完全錯誤

每次實作新的層或損失函數，都要檢查梯度。PyTorch 提供 `torch.autograd.gradcheck()`。

### 混合精度訓練

現代 GPU 有專用硬體（Tensor Core），float16 矩陣乘法的速度比 float32 快 2 到 8 倍。混合精度（mixed precision）訓練會利用這點：

```
1. Maintain float32 master copy of weights
2. Forward pass in float16 (fast)
3. Compute loss in float32 (prevents overflow)
4. Backward pass in float16 (fast)
5. Scale gradients to float32
6. Update float32 master weights
```

只用 float16 訓練的問題是：梯度通常很小（1e-8 或更小）。float16 中低於約 6e-8 的數值會因下溢位而成為零。所有梯度更新都變成零，模型就不再學習。

解法是損失縮放（loss scaling）：

```
1. Multiply loss by a large scale factor (e.g., 1024)
2. Backward pass computes gradients of (loss * 1024)
3. All gradients are 1024x larger (pushed above float16 underflow)
4. Divide gradients by 1024 before updating weights
5. Net effect: same update, but no underflow
```

動態損失縮放（loss scaling）會自動調整縮放因子。從較大的值（65536）開始；如果梯度溢位成 `inf`，就把它減半；如果經過 N 步都沒有溢位，就把它加倍。

### bfloat16 與 float16：為什麼訓練更適合 bfloat16

```
float16:   [1 sign] [5 exponent]  [10 mantissa]
bfloat16:  [1 sign] [8 exponent]  [7 mantissa]
```

float16 精度較高（10 位元尾數，而 bfloat16 有 7 位元），但範圍有限（最大約 65,504）。bfloat16 精度較低，範圍卻和 float32 相同（最大約 3.4e38）。

訓練神經網路時：

- 訓練過程中的活化值和 logits 峰值常超過 65,504，float16 會溢位，bfloat16 則能處理。
- float16 需要損失縮放（loss scaling）；bfloat16 通常不需要，因為它的範圍涵蓋梯度幅度。
- bfloat16 是 float32 的簡單截斷格式：丟掉尾數最低的 16 位元。指數部分不變，因此轉換簡單且不損失指數範圍。

float16 較適合推論時數值範圍有界且精度要求較高的情況；bfloat16 較適合範圍更重要的訓練。這就是為什麼 TPU 和現代 NVIDIA GPU（A100、H100）都原生支援 bfloat16。

### 梯度裁剪

當梯度在多層網路中指數增長時，就會發生梯度爆炸（常見於 RNN、深層網路和 Transformer）。一次很大的梯度，就可能在一個步驟內破壞所有權重。

有兩種裁剪方式：

**依值裁剪：** 獨立限制每個梯度元素。

```
grad = clamp(grad, -max_val, max_val)
```

做法簡單，但可能改變梯度向量的方向。

**依範數裁剪：** 縮放整個梯度向量，使其範數不超過閾值。

```
if ||grad|| > max_norm:
    grad = grad * (max_norm / ||grad||)
```

這會保留梯度方向。`torch.nn.utils.clip_grad_norm_()` 就是這麼做的，也是標準選擇。

常見值：Transformer 用 `max_norm=1.0`，RL 用 `max_norm=0.5`，較簡單的網路用 `max_norm=5.0`。

梯度裁剪不是權宜之計，而是一種安全機制。沒有它，一個離群批次就可能產生大到足以毀掉數週訓練成果的梯度。

### 正規化層如何穩定數值

批次正規化、層正規化和 RMS 正規化，通常被介紹為能幫助訓練收斂的正則化方法；它們也能穩定數值。

沒有正規化時，活化值可能在多層運算中指數增大或縮小：

```
Layer 1: values in [0, 1]
Layer 5: values in [0, 100]
Layer 10: values in [0, 10,000]
Layer 50: values in [0, inf]
```

正規化會在每一層重新置中並縮放活化值：

```
LayerNorm(x) = (x - mean(x)) / (std(x) + epsilon) * gamma + beta
```

`epsilon`（通常為 1e-5）可避免所有活化值相同時除以零。學得的參數 `gamma` 和 `beta` 讓網路可以恢復所需的任何尺度。

這能讓整個網路的數值維持在安全範圍內，避免前向傳遞溢位和反向傳遞時梯度爆炸。

### 常見的 ML 數值錯誤

**錯誤：幾個 epoch 後損失變成 NaN。**
原因：logits 太大，softmax 發生溢位；或學習率過高，權重發散。
解法：使用穩定 softmax（先減最大值）、降低學習率、加入梯度裁剪。

**錯誤：損失卡在 log(num_classes)。**
原因：模型輸出接近均勻分布的機率。通常表示梯度消失，或模型完全沒有在學習。
解法：檢查資料標籤、確認損失函數正確，並檢查是否有失效的 ReLU。

**錯誤：驗證準確率比預期低 1-3%。**
原因：混合精度訓練沒有正確使用損失縮放（loss scaling），梯度下溢位會悄悄把小幅更新變成零。
解法：啟用動態損失縮放（loss scaling），或改用 bfloat16。

**錯誤：有些層的梯度範數是 0.0。**
原因：ReLU 神經元失效（所有輸入都為負），或 float16 下溢位。
解法：使用 LeakyReLU 或 GELU、縮放梯度，並檢查權重初始化。

**錯誤：同一個模型在一張 GPU 上運作正常，在另一張上結果不同。**
原因：浮點數累加順序不具決定性。不同硬體上的 GPU 平行歸約會以不同順序加總，而浮點加法不具結合律。
解法：接受微小差異（1e-6），或設定 `torch.use_deterministic_algorithms(True)`，並接受速度變慢。

**錯誤：損失計算中的 `exp()` 回傳 `inf`。**
原因：原始 logits 未經最大值相減就直接傳入 `exp()`。
解法：使用 `torch.nn.functional.log_softmax()`，它在內部實作了 log-sum-exp。

**錯誤：從 float32 換成 float16 後，訓練發散。**
原因：float16 無法表示低於 6e-8 的梯度幅度，或高於 65,504 的活化值。
解法：使用含損失縮放（loss scaling）的混合精度（AMP），或改用 bfloat16。

```figure
logsumexp-stability
```

## Build It｜動手實作

### 步驟 1：展示浮點精度的限制

```python
print("=== Floating Point Precision ===")
print(f"0.1 + 0.2 = {0.1 + 0.2}")
print(f"0.1 + 0.2 == 0.3? {0.1 + 0.2 == 0.3}")
print(f"Difference: {(0.1 + 0.2) - 0.3:.2e}")
```

### 步驟 2：實作未穩定化版與穩定版 softmax

```python
import math

def softmax_naive(logits):
    exps = [math.exp(z) for z in logits]
    total = sum(exps)
    return [e / total for e in exps]

def softmax_stable(logits):
    max_logit = max(logits)
    exps = [math.exp(z - max_logit) for z in logits]
    total = sum(exps)
    return [e / total for e in exps]

safe_logits = [2.0, 1.0, 0.1]
print(f"Naive:  {softmax_naive(safe_logits)}")
print(f"Stable: {softmax_stable(safe_logits)}")

dangerous_logits = [100.0, 101.0, 102.0]
print(f"Stable: {softmax_stable(dangerous_logits)}")
# softmax_naive(dangerous_logits) would return [nan, nan, nan]
```

### 步驟 3：實作穩定的 log-sum-exp

```python
def logsumexp_naive(values):
    return math.log(sum(math.exp(v) for v in values))

def logsumexp_stable(values):
    c = max(values)
    return c + math.log(sum(math.exp(v - c) for v in values))

safe = [1.0, 2.0, 3.0]
print(f"Naive:  {logsumexp_naive(safe):.6f}")
print(f"Stable: {logsumexp_stable(safe):.6f}")

large = [500.0, 501.0, 502.0]
print(f"Stable: {logsumexp_stable(large):.6f}")
# logsumexp_naive(large) returns inf
```

### 步驟 4：實作穩定的交叉熵

```python
def cross_entropy_naive(true_class, logits):
    probs = softmax_naive(logits)
    return -math.log(probs[true_class])

def cross_entropy_stable(true_class, logits):
    max_logit = max(logits)
    shifted = [z - max_logit for z in logits]
    log_sum_exp = math.log(sum(math.exp(s) for s in shifted))
    log_prob = shifted[true_class] - log_sum_exp
    return -log_prob

logits = [2.0, 5.0, 1.0]
true_class = 1
print(f"Naive:  {cross_entropy_naive(true_class, logits):.6f}")
print(f"Stable: {cross_entropy_stable(true_class, logits):.6f}")
```

### 步驟 5：梯度檢查

```python
def numerical_gradient(f, x, h=1e-5):
    grad = []
    for i in range(len(x)):
        x_plus = x[:]
        x_minus = x[:]
        x_plus[i] += h
        x_minus[i] -= h
        grad.append((f(x_plus) - f(x_minus)) / (2 * h))
    return grad

def check_gradient(analytical, numerical, tolerance=1e-5):
    for i, (a, n) in enumerate(zip(analytical, numerical)):
        denom = max(abs(a), abs(n), 1e-8)
        rel_error = abs(a - n) / denom
        status = "OK" if rel_error < tolerance else "FAIL"
        print(f"  param {i}: analytical={a:.8f} numerical={n:.8f} "
              f"rel_error={rel_error:.2e} [{status}]")

def f(params):
    x, y = params
    return x**2 + 3*x*y + y**3

def f_grad(params):
    x, y = params
    return [2*x + 3*y, 3*x + 3*y**2]

point = [2.0, 1.0]
analytical = f_grad(point)
numerical = numerical_gradient(f, point)
check_gradient(analytical, numerical)
```

## Use It｜實際應用

### 混合精度模擬

```python
import struct

def float32_to_float16_round(x):
    packed = struct.pack('f', x)
    f32 = struct.unpack('f', packed)[0]
    packed16 = struct.pack('e', f32)
    return struct.unpack('e', packed16)[0]

def simulate_bfloat16(x):
    packed = struct.pack('f', x)
    as_int = int.from_bytes(packed, 'little')
    truncated = as_int & 0xFFFF0000
    repacked = truncated.to_bytes(4, 'little')
    return struct.unpack('f', repacked)[0]
```

### 梯度裁剪

```python
def clip_by_norm(gradients, max_norm):
    total_norm = math.sqrt(sum(g**2 for g in gradients))
    if total_norm > max_norm:
        scale = max_norm / total_norm
        return [g * scale for g in gradients]
    return gradients

grads = [10.0, 20.0, 30.0]
clipped = clip_by_norm(grads, max_norm=5.0)
print(f"Original norm: {math.sqrt(sum(g**2 for g in grads)):.2f}")
print(f"Clipped norm:  {math.sqrt(sum(g**2 for g in clipped)):.2f}")
print(f"Direction preserved: {[c/clipped[0] for c in clipped]} == {[g/grads[0] for g in grads]}")
```

### NaN／Inf 偵測

```python
def check_tensor(name, values):
    has_nan = any(math.isnan(v) for v in values)
    has_inf = any(math.isinf(v) for v in values)
    if has_nan or has_inf:
        print(f"WARNING {name}: nan={has_nan} inf={has_inf}")
        return False
    return True

check_tensor("good", [1.0, 2.0, 3.0])
check_tensor("bad",  [1.0, float('nan'), 3.0])
check_tensor("ugly", [1.0, float('inf'), 3.0])
```

完整實作及各種邊界情況示範請見 `code/numerical.py`。

## Ship It｜交付成果

本課產出：
- `code/numerical.py`，包含穩定的 softmax、log-sum-exp、交叉熵、梯度檢查和混合精度模擬
- `outputs/prompt-numerical-debugger.md`，用於診斷訓練中的 NaN／Inf 和數值問題

這些穩定實作會在第 3 階段的訓練迴圈，以及第 4 階段的注意力機制中再次出現。

## Exercises｜練習

1. **災難性消去。** 對 [1000000.0, 1000001.0, 1000002.0] 使用 float32，以未經穩定化處理的公式 `E[x^2] - E[x]^2` 計算變異數；再用 Welford 線上演算法計算一次，並將兩者的誤差與真實變異數（0.6667）比較。

2. **尋找精度極限。** 找出最小的正 float32 數值 `x`，使得 Python 中 `1.0 + x == 1.0`。這就是機器精度（machine epsilon）。確認它和 `numpy.finfo(numpy.float32).eps` 相符。

3. **Log-sum-exp 邊界情況。** 用以下輸入測試 `logsumexp_stable`：（a）所有值相同；（b）一個值遠大於其他值；（c）所有值都非常負（-1000）。確認未穩定化版本失敗時，穩定版本仍能得到正確結果。

4. **檢查神經網路層的梯度。** 實作單一線性層 `y = Wx + b` 及其解析反向傳遞。用 `numerical_gradient` 驗證 3x2 權重矩陣的梯度是否正確。

5. **損失縮放（loss scaling）實驗。** 模擬 float16 訓練：產生範圍為 [1e-9, 1e-3] 的隨機梯度，轉成 float16，計算變成零的比例。接著先套用損失縮放（loss scaling）（乘以 1024）、轉成 float16、再縮回原尺度，重新計算變成零的比例。

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|----------------|----------------------|
| IEEE 754 | 「浮點數標準」 | 定義二進位浮點格式、捨入規則和特殊值（inf、nan）的國際標準。現代 CPU 和 GPU 都有實作。 |
| 機器精度（machine epsilon） | 「精度極限」 | 對某種浮點格式而言，使 1.0 + e != 1.0 成立的最小值。float32 約為 1.19e-7。 |
| 災難性消去（catastrophic cancellation） | 「減法造成的精度損失」 | 相減非常接近的浮點數時，有效數字互相抵消，捨入雜訊因而主導結果。 |
| 溢位（overflow） | 「數值太大」 | 結果超過最大可表示值，變成 inf。exp(89) 會讓 float32 溢位。 |
| 下溢位（underflow） | 「數值太小」 | 結果比最小可表示正數更接近零，變成 0.0。exp(-104) 會讓 float32 下溢位。 |
| log-sum-exp 技巧（log-sum-exp trick） | 「先減去最大值」 | 將 exp(max(x)) 提出後計算 log(sum(exp(x)))，避免溢位和下溢位。用於 softmax、交叉熵和對數機率運算。 |
| 穩定 softmax（stable softmax） | 「不會爆掉的 softmax」 | 取指數前先減去 max(logits)。結果在數學上相同，且不會溢位。 |
| 梯度檢查（gradient checking） | 「驗證反向傳播」 | 比較反向傳播得到的解析梯度和有限差分算出的數值梯度，找出實作錯誤。 |
| 混合精度（mixed precision） | 「float16 前向、float32 反向」 | 對速度關鍵運算使用低精度浮點數，對數值敏感運算使用高精度浮點數。通常可加速 2 到 3 倍。 |
| 損失縮放（loss scaling） | 「避免梯度下溢位」 | 反向傳播前先乘上較大的常數，讓梯度維持在 float16 可表示範圍內；更新權重前再除以相同常數。 |
| bfloat16 | 「Brain floating point」 | Google 的 16 位元格式，有 8 位元指數（範圍與 float32 相同）和 7 位元尾數（精度比 float16 低），較適合訓練。 |
| 梯度裁剪（gradient clipping） | 「限制梯度範數」 | 縮放梯度向量，使其範數不超過閾值，避免梯度爆炸破壞權重。 |
| NaN | 「Not a Number」 | 由未定義運算（0/0、inf-inf、sqrt(-1)）產生的特殊浮點值，會傳播到後續算術運算。 |
| Inf | 「無限大」 | 由溢位或除以零產生的特殊浮點值。運算後可能產生 NaN（inf - inf、inf * 0）。 |
| 數值梯度（numerical gradient） | 「暴力計算導數」 | 計算 f(x+h) 和 f(x-h)，再除以 2h，以近似導數。計算慢，但適合驗證。 |

## Further Reading｜延伸閱讀

- [What Every Computer Scientist Should Know About Floating-Point Arithmetic (Goldberg 1991)](https://docs.oracle.com/cd/E19957-01/806-3568/ncg_goldberg.html) -- 浮點運算的權威參考資料，內容精密完整
- [Mixed Precision Training (Micikevicius et al., 2018)](https://arxiv.org/abs/1710.03740) -- NVIDIA 提出 float16 訓練損失縮放（loss scaling）的論文
- [AMP: Automatic Mixed Precision (PyTorch docs)](https://pytorch.org/docs/stable/amp.html) -- PyTorch 混合精度實務指南
- [bfloat16 format (Google Cloud TPU docs)](https://cloud.google.com/tpu/docs/bfloat16) -- Google 為 TPU 選擇此格式的原因
- [Kahan Summation (Wikipedia)](https://en.wikipedia.org/wiki/Kahan_summation_algorithm) -- 降低浮點數加總捨入雜訊的演算法
