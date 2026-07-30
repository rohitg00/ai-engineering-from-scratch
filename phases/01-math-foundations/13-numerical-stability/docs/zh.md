# 數值穩定性

> 浮點數是一層會漏的抽象。它會在訓練途中咬你一口，而你完全不會預先察覺。

**類型：** 實作
**程式語言：** Python
**先修單元：** 階段 1 · 單元 01-04
**時間：** 約 120 分鐘

## 學習目標

- 用「減去最大值」的技巧實作數值穩定的 softmax 與 log-sum-exp
- 辨認浮點運算裡的溢位、下溢與災難性抵銷
- 用中心差分把解析梯度和數值梯度對照驗證
- 說明為什麼訓練時偏好 bfloat16 而不是 float16，以及 loss scaling 如何避免梯度下溢

## 問題所在

你的模型訓練了三個小時，然後損失變成 NaN。你加上一行 print。第 9,000 步時 logits 還好得很。到第 9,001 步變成 `inf`。到第 9,002 步每一個梯度都是 `nan`，訓練徹底死掉。

或者：模型順利訓練到最後，但準確率比論文聲稱的低了 2%。你什麼都檢查過了。架構一樣。超參數一樣。資料一樣。問題在於論文用的是 float32，而你用的是 float16 卻沒有搭配正確的縮放。三十二位元的累積捨入誤差就這樣悄悄吃掉了你的準確率。

或者：你從零實作交叉熵損失。在 logits 很小的時候都正常。當 logits 超過 100，它回傳 `inf`。softmax 溢位了，因為 `exp(100)` 比 float32 能表示的範圍還大。每一個 ML 框架都用兩行程式碼的小技巧處理掉這件事。你根本不知道有這個技巧存在。

數值穩定性不是理論上的顧慮。它決定一次訓練是成功、還是無聲無息地失敗。你將來要除的每一個像樣的 ML bug，追到底都會落回浮點數上。

## 核心概念

### IEEE 754：電腦怎麼儲存實數

電腦依照 IEEE 754 標準，把實數存成浮點數值。一個 float 有三個部分：一個符號位元、一個指數，以及一個尾數（significand）。

```
Float32 layout (32 bits total):
[1 sign] [8 exponent] [23 mantissa]

Value = (-1)^sign * 2^(exponent - 127) * 1.mantissa
```

尾數決定精度（有多少位有效數字）。指數決定範圍（一個數可以多大或多小）。

```
Format     Bits   Exponent  Mantissa  Decimal digits  Range (approx)
float64    64     11        52        ~15-16          +/- 1.8e308
float32    32     8         23        ~7-8            +/- 3.4e38
float16    16     5         10        ~3-4            +/- 65,504
bfloat16   16     8         7         ~2-3            +/- 3.4e38
```

float32 給你大約 7 位十進位精度。也就是說它分得出 1.0000001 和 1.0000002，但分不出 1.00000001 和 1.00000002。7 位之後，全都是捨入雜訊。

float16 給你大約 3 位。它能表示的最大數是 65,504。對 ML 來說這小得令人不安 —— logits、梯度和激活值動不動就超過這個值。

bfloat16 是 Google 對 float16 範圍問題的回答。它和 float32 有同樣的 8 位元指數（同樣的範圍，最大到 3.4e38），但只有 7 個尾數位元（精度比 float16 更差）。對訓練神經網路來說，範圍比精度重要，所以 bfloat16 通常勝出。

### 為什麼 0.1 + 0.2 != 0.3

數字 0.1 在二進位浮點數裡無法精確表示。在 2 進位下，它是一個循環小數：

```
0.1 in binary = 0.0001100110011001100110011... (repeating forever)
```

Float32 把它截斷到 23 個尾數位元。存下來的值大約是 0.100000001490116。同樣地，0.2 存成大約 0.200000002980232。它們的和是 0.300000004470348，不是 0.3。

```
In Python:
>>> 0.1 + 0.2
0.30000000000000004

>>> 0.1 + 0.2 == 0.3
False
```

這對 ML 有影響，因為：

1. 像 `if loss < threshold` 這種損失比較可能給出錯的答案
2. 累加很多小的值（數千步的梯度更新）會偏離真正的總和
3. 如果你用 `==` 比較浮點數，檢查碼和可重現性測試都會失敗

修法：永遠不要用 `==` 比較浮點數。用 `abs(a - b) < epsilon` 或 `math.isclose()`。

### 災難性抵銷

當你把兩個幾乎相等的浮點數相減時，有效數字會互相抵銷，剩下的是被推升到最高位的捨入雜訊。

```
a = 1.0000001    (stored as 1.00000011920929 in float32)
b = 1.0000000    (stored as 1.00000000000000 in float32)

True difference:  0.0000001
Computed:         0.00000011920929

Relative error: 19.2%
```

單單一次減法就帶來 19% 的相對誤差。在 ML 裡，只要你做以下這些事，這件事就會發生：

- 對平均值很大的資料算變異數：E[x] 很大時的 `E[x^2] - E[x]^2`
- 相減兩個幾乎相等的對數機率
- 用太小的 epsilon 計算有限差分梯度

修法：重排公式，避免把兩個很大又幾乎相等的數相減。對變異數，用 Welford 演算法，或先把資料中心化。對對數機率，全程留在對數空間裡運算。

### 溢位與下溢

當結果太大而無法表示時就發生溢位。當結果太小（比最小的可表示正數更靠近零）時就發生下溢。

```
Float32 boundaries:
  Maximum:  3.4028235e+38
  Minimum positive (normal): 1.175e-38
  Minimum positive (denorm): 1.401e-45
  Overflow:  anything > 3.4e38 becomes inf
  Underflow: anything < 1.4e-45 becomes 0.0
```

`exp()` 函式是 ML 裡溢位的頭號來源：

```
exp(88.7)  = 3.40e+38   (barely fits in float32)
exp(89.0)  = inf         (overflow)
exp(-87.3) = 1.18e-38   (barely above underflow)
exp(-104)  = 0.0         (underflow to zero)
```

`log()` 函式則是撞向另一邊：

```
log(0.0)   = -inf
log(-1.0)  = nan
log(1e-45) = -103.3      (fine)
log(1e-46) = -inf        (input underflowed to 0, then log(0) = -inf)
```

在 ML 裡，`exp()` 出現在 softmax、sigmoid 和機率計算裡。`log()` 出現在交叉熵、對數似然和 KL 散度裡。而 `log(exp(x))` 這個組合，在沒有正確技巧的情況下就是一片雷區。

### log-sum-exp 技巧

直接計算 `log(sum(exp(x_i)))` 在數值上很危險。只要有任何一個 `x_i` 很大，`exp(x_i)` 就會溢位。如果所有 `x_i` 都非常負，每一個 `exp(x_i)` 都會下溢成零，而 `log(0)` 是 `-inf`。

技巧是：在取指數之前先減掉最大值。

```
log(sum(exp(x_i))) = max(x) + log(sum(exp(x_i - max(x))))
```

為什麼行得通：減掉 `max(x)` 之後，最大的指數項是 `exp(0) = 1`。不可能溢位。總和裡至少有一項是 1，所以總和至少是 1，而 `log(1) = 0`。也不可能下溢成 `-inf`。

證明：

```
log(sum(exp(x_i)))
= log(sum(exp(x_i - c + c)))                    (add and subtract c)
= log(sum(exp(x_i - c) * exp(c)))               (exp(a+b) = exp(a)*exp(b))
= log(exp(c) * sum(exp(x_i - c)))               (factor out exp(c))
= c + log(sum(exp(x_i - c)))                    (log(a*b) = log(a) + log(b))
```

令 `c = max(x)`，溢位就消失了。

這個技巧在 ML 裡到處都是：
- softmax 正規化
- 交叉熵損失計算
- 序列模型裡的對數機率加總
- 高斯混合模型
- 變分推論

### 為什麼 softmax 需要「減去最大值」的技巧

softmax 把 logits 轉成機率：

```
softmax(x_i) = exp(x_i) / sum(exp(x_j))
```

沒有這個技巧，[100, 101, 102] 這樣的 logits 會造成溢位：

```
exp(100) = 2.69e43
exp(101) = 7.31e43
exp(102) = 1.99e44
sum      = 2.99e44

These overflow float32 (max ~3.4e38)? No, 2.69e43 < 3.4e38? Actually:
exp(88.7) is already at the float32 limit.
exp(100) = inf in float32.
```

用了這個技巧，減掉 max(x) = 102：

```
exp(100 - 102) = exp(-2) = 0.135
exp(101 - 102) = exp(-1) = 0.368
exp(102 - 102) = exp(0)  = 1.000
sum = 1.503

softmax = [0.090, 0.245, 0.665]
```

機率完全相同。計算是安全的。這不是一種最佳化，這是正確性的必要條件。

### NaN 與 Inf：偵測與預防

`nan`（Not a Number）和 `inf`（無限）會像病毒一樣在計算中擴散。梯度更新裡出現一個 `nan`，權重就變成 `nan`，接著之後每一個輸出都是 `nan`。訓練在一步之內就死了。

`inf` 怎麼出現：
- 對一個很大的正數取 `exp()`
- 除以零：`1.0 / 0.0`
- 累加過程中的 `float32` 溢位

`nan` 怎麼出現：
- `0.0 / 0.0`
- `inf - inf`
- `inf * 0`
- 對負數取 `sqrt()`
- 對負數取 `log()`
- 任何牽涉到已存在的 `nan` 的運算

偵測：

```python
import math

math.isnan(x)       # True if x is nan
math.isinf(x)       # True if x is +inf or -inf
math.isfinite(x)    # True if x is neither nan nor inf
```

預防策略：

1. 把 `exp()` 的輸入夾住：`exp(clamp(x, -80, 80))`
2. 在分母加上 epsilon：`x / (y + 1e-8)`
3. 在 `log()` 內部加上 epsilon：`log(x + 1e-8)`
4. 使用穩定的實作（log-sum-exp、穩定版 softmax）
5. 用梯度裁剪避免權重爆炸
6. 除錯期間，每一次前向傳遞之後都檢查 `nan`／`inf`

### 數值梯度檢查

解析梯度（來自反向傳播）也可能有 bug。數值梯度檢查用有限差分算出梯度，藉此驗證它們。

中心差分公式：

```
df/dx ~= (f(x + h) - f(x - h)) / (2h)
```

它的精度是 O(h^2)，遠好過只有 O(h) 的前向差分 `(f(x+h) - f(x)) / h`。

h 怎麼選：太大，近似就不準。太小，災難性抵銷會毀掉答案。`h = 1e-5` 到 `1e-7` 是常見範圍。

檢查方式：算出解析梯度和數值梯度之間的相對差異。

```
relative_error = |grad_analytical - grad_numerical| / max(|grad_analytical|, |grad_numerical|, 1e-8)
```

經驗法則：
- relative_error < 1e-7：完美，梯度是對的
- relative_error < 1e-5：可接受，大概是對的
- relative_error > 1e-3：有東西壞了
- relative_error > 1：梯度徹底錯誤

實作新的層或新的損失函式時，一定要檢查梯度。PyTorch 提供 `torch.autograd.gradcheck()` 來做這件事。

### 混合精度訓練

現代 GPU 有專門的硬體（Tensor Cores），做 float16 矩陣乘法比 float32 快 2 到 8 倍。混合精度訓練就是在利用這一點：

```
1. Maintain float32 master copy of weights
2. Forward pass in float16 (fast)
3. Compute loss in float32 (prevents overflow)
4. Backward pass in float16 (fast)
5. Scale gradients to float32
6. Update float32 master weights
```

純 float16 訓練的問題在於：梯度往往非常小（1e-8 或更小）。float16 會把任何低於約 6e-8 的值下溢成零。你的模型停止學習，因為所有梯度更新都是零。

解法是 loss scaling：

```
1. Multiply loss by a large scale factor (e.g., 1024)
2. Backward pass computes gradients of (loss * 1024)
3. All gradients are 1024x larger (pushed above float16 underflow)
4. Divide gradients by 1024 before updating weights
5. Net effect: same update, but no underflow
```

動態 loss scaling 會自動調整縮放係數。從一個大值（65536）開始。如果梯度溢位成 `inf`，就把它砍半。如果連續 N 步都沒有溢位，就把它加倍。

### bfloat16 vs float16：為什麼訓練時 bfloat16 勝出

```
float16:   [1 sign] [5 exponent]  [10 mantissa]
bfloat16:  [1 sign] [8 exponent]  [7 mantissa]
```

float16 精度較高（10 個尾數位元對 7 個），但範圍有限（最大約 65,504）。bfloat16 精度較差，但範圍和 float32 一樣（最大約 3.4e38）。

對訓練神經網路來說：

- 訓練過程中出現尖峰時，激活值和 logits 常常超過 65,504。float16 會溢位；bfloat16 撐得住。
- float16 一定要搭配 loss scaling，而 bfloat16 通常不需要，因為它的範圍已經覆蓋了梯度大小的整個區間。
- bfloat16 就是 float32 的單純截斷：把尾數最低的 16 個位元丟掉。轉換非常簡單，而且在指數部分無損。

推論時偏好 float16，因為那時數值有界、精度更重要。訓練時偏好 bfloat16，因為那時範圍更重要。這就是為什麼 TPU 和現代 NVIDIA GPU（A100、H100）都原生支援 bfloat16。

### 梯度裁剪

梯度爆炸發生在梯度穿過很多層時呈指數成長（常見於 RNN、深層網路和 transformer）。單一個過大的梯度，就能在一步之內毀掉所有權重。

兩種裁剪方式：

**按值裁剪：** 把每個梯度元素獨立夾住。

```
grad = clamp(grad, -max_val, max_val)
```

簡單，但可能改變梯度向量的方向。

**按範數裁剪：** 縮放整個梯度向量，讓它的範數不超過某個門檻。

```
if ||grad|| > max_norm:
    grad = grad * (max_norm / ||grad||)
```

保留梯度的方向。這就是 `torch.nn.utils.clip_grad_norm_()` 在做的事，也是標準選擇。

常見的值：transformer 用 `max_norm=1.0`，RL 用 `max_norm=0.5`，較簡單的網路用 `max_norm=5.0`。

梯度裁剪不是偷吃步，它是一道安全機制。少了它，單一個離群批次就可能產生大到足以毀掉數週訓練成果的梯度。

### 正規化層作為數值穩定器

批次正規化、層正規化和 RMS 正規化，通常被當成幫助訓練收斂的正則化手段來介紹。它們同時也是數值穩定器。

沒有正規化，激活值可能隨著層數呈指數成長或縮小：

```
Layer 1: values in [0, 1]
Layer 5: values in [0, 100]
Layer 10: values in [0, 10,000]
Layer 50: values in [0, inf]
```

正規化在每一層都把激活值重新置中、重新縮放：

```
LayerNorm(x) = (x - mean(x)) / (std(x) + epsilon) * gamma + beta
```

其中的 `epsilon`（通常是 1e-5）避免在所有激活值都相同時除以零。可學習的參數 `gamma` 和 `beta` 讓網路能還原它需要的任何尺度。

這讓整個網路的數值都留在安全範圍內，同時避免前向傳遞的溢位和反向傳遞的梯度爆炸。

### ML 裡常見的數值 bug

**Bug：跑幾個 epoch 之後損失變成 NaN。**
原因：logits 長得太大，softmax 溢位。或是學習率太高、權重發散。
修法：使用穩定版 softmax（減去最大值）、降低學習率、加上梯度裁剪。

**Bug：損失卡在 log(num_classes)。**
原因：模型輸出接近均勻機率。這通常表示梯度正在消失，或模型根本沒在學。
修法：確認資料標籤正確、驗證損失函式、檢查是不是有死掉的 ReLU。

**Bug：驗證準確率比預期低 1-3%。**
原因：用了混合精度卻沒有正確的 loss scaling。梯度下溢無聲無息地把小幅更新歸零。
修法：啟用動態 loss scaling，或改用 bfloat16。

**Bug：某些層的梯度範數是 0.0。**
原因：ReLU 神經元死掉（所有輸入都是負的），或是 float16 下溢。
修法：改用 LeakyReLU 或 GELU、使用梯度縮放、檢查權重初始化。

**Bug：模型在某張 GPU 上正常，換到另一張結果卻不同。**
原因：浮點數累加順序不確定。GPU 的平行歸約在不同硬體上以不同順序求和，而浮點加法不符合結合律。
修法：接受微小差異（1e-6），或設定 `torch.use_deterministic_algorithms(True)` 並接受速度上的代價。

**Bug：損失計算中 `exp()` 回傳 `inf`。**
原因：原始 logits 沒有經過減去最大值的技巧就丟給 `exp()`。
修法：使用 `torch.nn.functional.log_softmax()`，它內部實作了 log-sum-exp。

**Bug：從 float32 換成 float16 之後訓練發散。**
原因：float16 無法表示低於 6e-8 的梯度大小，也無法表示高於 65,504 的激活值。
修法：使用搭配 loss scaling 的混合精度（AMP），或直接改用 bfloat16。

```figure
logsumexp-stability
```

## 動手實作

### 步驟 1：示範浮點數的精度極限

```python
print("=== Floating Point Precision ===")
print(f"0.1 + 0.2 = {0.1 + 0.2}")
print(f"0.1 + 0.2 == 0.3? {0.1 + 0.2 == 0.3}")
print(f"Difference: {(0.1 + 0.2) - 0.3:.2e}")
```

### 步驟 2：實作天真版與穩定版 softmax

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

### 步驟 3：實作穩定版 log-sum-exp

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

### 步驟 4：實作穩定版交叉熵

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

## 框架應用

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

完整實作與所有邊界情況的示範，請看 `code/numerical.py`。

## 產出交付

這個單元產出：
- `code/numerical.py`，內含穩定版 softmax、log-sum-exp、交叉熵、梯度檢查與混合精度模擬
- `outputs/prompt-numerical-debugger.md`，用來診斷訓練中的 NaN/Inf 與數值問題

這些穩定實作會在階段 3 打造訓練迴圈時、以及階段 4 實作注意力機制時再次出現。

## 練習

1. **災難性抵銷。** 在 float32 下用天真公式 `E[x^2] - E[x]^2` 算出 [1000000.0, 1000001.0, 1000002.0] 的變異數。然後改用 Welford 的線上演算法算一次。把兩者的誤差和真正的變異數（0.6667）比較。

2. **精度搜捕。** 在 Python 裡找出使 `1.0 + x == 1.0` 成立的最小正 float32 值 `x`。這就是機器 epsilon。驗證它和 `numpy.finfo(numpy.float32).eps` 相符。

3. **log-sum-exp 的邊界情況。** 用以下輸入測試你的 `logsumexp_stable` 函式：(a) 所有值都相等，(b) 其中一個值遠大於其他，(c) 所有值都非常負（-1000）。確認在天真版本失敗的地方它仍給出正確結果。

4. **對神經網路的層做梯度檢查。** 實作單一線性層 `y = Wx + b` 以及它的解析反向傳遞。用 `numerical_gradient` 驗證一個 3x2 權重矩陣的正確性。

5. **loss scaling 實驗。** 模擬 float16 訓練：產生範圍在 [1e-9, 1e-3] 的隨機梯度，轉成 float16，量測有多少比例變成零。然後套用 loss scaling（乘以 1024）、轉成 float16、再縮放回來，重新量測歸零的比例。

## 關鍵術語

| 術語 | 大家怎麼說 | 實際上是什麼 |
|------|----------------|----------------------|
| IEEE 754 | 「浮點數標準」 | 定義二進位浮點格式、捨入規則與特殊值（inf、nan）的國際標準。每一顆現代 CPU 和 GPU 都實作了它。 |
| 機器 epsilon | 「精度極限」 | 在某個 float 格式下，使 1.0 + e != 1.0 成立的最小值 e。對 float32 來說大約是 1.19e-7。 |
| 災難性抵銷 | 「減法造成的精度流失」 | 相減兩個幾乎相等的浮點數時，有效數字互相抵銷，結果被捨入雜訊主導。 |
| 溢位 | 「數字太大」 | 結果超過可表示的最大值，變成 inf。exp(89) 會讓 float32 溢位。 |
| 下溢 | 「數字太小」 | 結果比最小的可表示正數更靠近零，變成 0.0。exp(-104) 會讓 float32 下溢。 |
| log-sum-exp 技巧 | 「先減掉最大值」 | 把 exp(max(x)) 提出來計算 log(sum(exp(x)))，以避免溢位與下溢。用在 softmax、交叉熵和對數機率運算裡。 |
| 穩定版 softmax | 「不會爆掉的 softmax」 | 在取指數之前先減掉 max(logits)。結果在數值上完全相同，而且不可能溢位。 |
| 梯度檢查 | 「驗證你的反向傳播」 | 把反向傳播得到的解析梯度和有限差分得到的數值梯度做對照，抓出實作上的 bug。 |
| 混合精度 | 「float16 前向、float32 反向」 | 對速度關鍵的運算使用較低精度的浮點數，對數值敏感的運算使用較高精度。典型加速是 2-3 倍。 |
| loss scaling | 「避免梯度下溢」 | 在反向傳播之前把損失乘上一個大常數，讓梯度留在 float16 可表示的範圍內，再在更新權重之前除回同一個常數。 |
| bfloat16 | 「brain floating point」 | Google 的 16 位元格式，有 8 個指數位元（範圍和 float32 相同）與 7 個尾數位元（精度比 float16 差）。訓練時的首選。 |
| 梯度裁剪 | 「限制梯度範數」 | 縮放梯度向量，使它的範數不超過某個門檻。避免梯度爆炸毀掉權重。 |
| NaN | 「Not a Number」 | 來自未定義運算（0/0、inf-inf、sqrt(-1)）的特殊浮點值。會擴散到後續所有運算。 |
| Inf | 「無限」 | 來自溢位或除以零的特殊浮點值。可以組合出 NaN（inf - inf、inf * 0）。 |
| 數值梯度 | 「暴力求導數」 | 求出 f(x+h) 與 f(x-h) 再除以 2h，藉此近似導數。慢，但用來驗證很可靠。 |

## 延伸閱讀

- [What Every Computer Scientist Should Know About Floating-Point Arithmetic (Goldberg 1991)](https://docs.oracle.com/cd/E19957-01/806-3568/ncg_goldberg.html) -- 權威參考文獻，很硬但很完整
- [Mixed Precision Training (Micikevicius et al., 2018)](https://arxiv.org/abs/1710.03740) -- NVIDIA 的論文，為 float16 訓練引入了 loss scaling
- [AMP: Automatic Mixed Precision (PyTorch docs)](https://pytorch.org/docs/stable/amp.html) -- PyTorch 混合精度的實用指南
- [bfloat16 format (Google Cloud TPU docs)](https://cloud.google.com/tpu/docs/bfloat16) -- Google 為什麼為 TPU 選了這個格式
- [Kahan Summation (Wikipedia)](https://en.wikipedia.org/wiki/Kahan_summation_algorithm) -- 降低浮點加總捨入誤差的演算法
