# 數值穩定性

> 浮點數是一種有缺陷的抽象。訓練時它會反過來影響你，而且往往讓你措手不及。

**Type:** Build
**Language:** Python
**Prerequisites:** Phase 1, Lessons 01-04
**Time:** ~120 minutes

## Learning Objectives｜學習目標

- 使用最大值相減技巧，實作數值穩定的 softmax 與 log-sum-exp
- 辨識浮點運算中的溢位、下溢與災難性消去
- 使用中心有限差分，驗證解析梯度與數值梯度
- 說明訓練時為何偏好 bfloat16 而非 float16，以及損失縮放如何避免梯度下溢

## The Problem｜問題

模型訓練了三個小時，接著損失變成 NaN。你加上一行列印，發現第 9,000 步的 logits 都正常；第 9,001 步卻出現 `inf`。到了第 9,002 步，每個梯度都變成 `nan`，訓練也就此停擺。

又或者，模型順利訓練完成，準確率卻比論文宣稱的低了 2%。你逐一檢查，架構、超參數與資料都相符。問題在於論文使用 float32，而你用了沒有正確縮放的 float16。累積的 32 位元捨入誤差悄悄侵蝕了準確率。

又或者，你從頭實作交叉熵損失，在較小的 logits 上運作正常；但 logits 超過 100 時，結果就變成 `inf`。這是因為 softmax 溢位了：`exp(100)` 大於 float32 能表示的上限。每個機器學習框架都用一個兩行的小技巧處理這件事，而你還不知道它的存在。

數值穩定性不是理論上的顧慮，而是訓練順利完成與悄悄失敗的差別。你遲早會除錯的每個嚴重機器學習問題，最後都會追溯到浮點數。

## The Concept｜核心概念

### IEEE 754：電腦如何儲存實數

電腦依照 IEEE 754 標準，以浮點數儲存實數。浮點數由三個部分組成：符號位元、指數，以及尾數（有效數）。

```text
Float32 版面（共 32 位元）：
[1 符號] [8 指數] [23 尾數]

Value = (-1)^sign * 2^(exponent - 127) * 1.mantissa
```

尾數決定精度（可表示多少位有效數字）；指數決定範圍（數值可以有多大或多小）。

```text
格式     位元   指數    尾數    十進位位數    範圍（約）
float64  64     11      52      ~15-16       +/- 1.8e308
float32  32     8       23      ~7-8         +/- 3.4e38
float16  16     5       10      ~3-4         +/- 65,504
bfloat16 16     8       7       ~2-3         +/- 3.4e38
```

float32 約有 7 位十進位精度。也就是說，它能區分 1.0000001 和 1.0000002，卻無法區分 1.00000001 和 1.00000002。超過 7 位的部分都會受到捨入誤差影響。

float16 約有 3 位精度，能表示的最大數值是 65,504。對 logits、梯度與啟動值經常超過這個上限的機器學習而言，這個範圍小得令人擔心。

Google 為了解決 float16 的數值範圍問題，提出了 bfloat16。它的指數和 float32 一樣是 8 位元（數值範圍相同，最高約為 3.4e38），但尾數只有 7 位元（精度低於 float16）。訓練神經網路時，數值範圍通常比精度重要，因此 bfloat16 往往更合適。

### 為什麼 0.1 + 0.2 不等於 0.3

0.1 無法以二進位浮點數精確表示。在以 2 為底的系統中，它會成為無限循環小數：

```text
0.1 的二進位表示 = 0.0001100110011001100110011...（無限循環）
```

Float32 會將這個數值截斷為 23 位尾數。儲存後的近似值是 0.100000001490116。同樣地，0.2 會儲存為約 0.200000002980232，兩者相加得到 0.300000004470348，而不是 0.3。

```text
Python 範例：
>>> 0.1 + 0.2
0.30000000000000004

>>> 0.1 + 0.2 == 0.3
False
```

這會影響機器學習，原因如下：

1. 像 `if loss < threshold` 這類損失比較可能得出錯誤結果
2. 累加許多小數值（例如數千步的梯度更新）會逐漸偏離精確總和
3. 如果用 `==` 比較浮點數，校驗碼與可重現性測試可能會失敗

解法：不要用 `==` 比較浮點數。改用 `abs(a - b) < epsilon` 或 `math.isclose()`。

### 災難性消去

相減兩個非常接近的浮點數時，有效位數會彼此抵消，捨入誤差便會被放大成結果的主要數字。

```text
a = 1.0000001    （float32 中儲存為 1.00000011920929）
b = 1.0000000    （float32 中儲存為 1.00000000000000）

真實差值：  0.0000001
計算結果：  0.00000011920929

相對誤差：19.2%
```

只做一次減法就造成 19% 的相對誤差。在機器學習中，以下情況都可能發生：

- 計算平均值很大的資料之變異數：當 E[x] 很大時，`E[x^2] - E[x]^2` 會有精度問題
- 相減非常接近的對數機率
- 使用過小的 epsilon 計算有限差分梯度

解法：重新整理公式，避免相減兩個很大且彼此接近的數值。計算變異數時，可使用 Welford 演算法或先將資料中心化；計算對數機率時，則全程在對數空間中運算。

### 溢位與下溢

結果太大而無法表示時會發生溢位；結果太小（比最小可表示正數更接近零）時則會發生下溢。

```text
Float32 邊界：
  最大值：             3.4028235e+38
  最小正規正數：       1.175e-38
  最小正非正規數：     1.401e-45
  溢位：大於 3.4e38 的值會變成 inf
  下溢：小於 1.4e-45 的值會變成 0.0
```

在機器學習中，`exp()` 是造成溢位的主要來源：

```text
exp(88.7)  = 3.40e+38   （勉強可容納於 float32）
exp(89.0)  = inf         （溢位）
exp(-87.3) = 1.18e-38   （略高於下溢界線）
exp(-104)  = 0.0         （下溢為零）
```

`log()` 則會遇到相反方向的問題：

```text
log(0.0)   = -inf
log(-1.0)  = nan
log(1e-45) = -103.3      （正常）
log(1e-46) = -inf        （輸入先下溢成 0，再計算 log(0) = -inf）
```

在機器學習中，`exp()` 會出現在 softmax、sigmoid 與機率計算中；`log()` 則會用於交叉熵、對數概似與 KL 散度。若沒有合適技巧，`log(exp(x))` 這種組合很容易出問題。

### Log-Sum-Exp 技巧

直接計算 `log(sum(exp(x_i)))` 在數值上很危險。只要有一個 `x_i` 很大，`exp(x_i)` 就會溢位；如果所有 `x_i` 都非常負，每個 `exp(x_i)` 都會下溢成零，接著 `log(0)` 就會得到 `-inf`。

這個技巧是：先減去最大值，再計算指數。

```text
log(sum(exp(x_i))) = max(x) + log(sum(exp(x_i - max(x))))
```

原因是，減去 `max(x)` 後，最大的指數項會是 `exp(0) = 1`，因此不可能溢位。總和中至少有一項是 1，所以總和至少為 1，`log(1) = 0`，也不會下溢成 `-inf`。

推導如下：

```text
log(sum(exp(x_i)))
= log(sum(exp(x_i - c + c)))                    （同時加上並減去 c）
= log(sum(exp(x_i - c) * exp(c)))               (exp(a+b) = exp(a)*exp(b))
= log(exp(c) * sum(exp(x_i - c)))               （提出 exp(c)）
= c + log(sum(exp(x_i - c)))                    (log(a*b) = log(a) + log(b))
```

令 `c = max(x)`，即可消除溢位。

這個技巧在機器學習中用途廣泛：
- Softmax 正規化
- 交叉熵損失計算
- 序列模型中的對數機率加總
- 高斯混合模型
- 變分推論

### 為什麼 Softmax 需要最大值相減技巧

Softmax 會將 logits 轉換為機率：

```text
softmax(x_i) = exp(x_i) / sum(exp(x_j))
```

若不使用這個技巧，logits 為 [100, 101, 102] 時就會造成溢位：

```text
exp(100) = 2.69e43
exp(101) = 7.31e43
exp(102) = 1.99e44
sum      = 2.99e44

這些數值會讓 float32 溢位（上限約 3.4e38）？不會，2.69e43 < 3.4e38？其實：
exp(88.7) 已經接近 float32 的上限。
exp(100) 在 float32 中會變成 inf。
```

使用這個技巧時，先減去 max(x) = 102：

```text
exp(100 - 102) = exp(-2) = 0.135
exp(101 - 102) = exp(-1) = 0.368
exp(102 - 102) = exp(0)  = 1.000
sum = 1.503

softmax = [0.090, 0.245, 0.665]
```

計算結果中的機率完全相同，但運算是安全的。這不是效能最佳化，而是確保正確性的必要做法。

### NaN 與 Inf：偵測及預防

`nan`（非數值）與 `inf`（無限大）會在運算中迅速傳播。梯度更新中只要出現一個 `nan`，權重就會變成 `nan`，接下來所有輸出也都會是 `nan`。訓練在一步之內就會停擺。

`inf` 的常見來源：
- 對很大的正數計算 `exp()`
- 除以零：`1.0 / 0.0`
- 累加時發生 `float32` 溢位

`nan` 的常見來源：
- `0.0 / 0.0`
- `inf - inf`
- `inf * 0`
- 對負數計算 `sqrt()`
- 對負數計算 `log()`
- 任何涉及既有 `nan` 的算術運算

偵測方式：

```python
import math

math.isnan(x)       # True if x is nan
math.isinf(x)       # True if x is +inf or -inf
math.isfinite(x)    # True if x is neither nan nor inf
```

預防策略：

1. 限制輸入 `exp()` 的數值範圍：`exp(clamp(x, -80, 80))`
2. 在分母加上 epsilon：`x / (y + 1e-8)`
3. 在 `log()` 的輸入中加上 epsilon：`log(x + 1e-8)`
4. 使用穩定的實作（log-sum-exp、穩定版 softmax）
5. 使用梯度裁剪，避免權重爆增
6. 除錯時，每次前向傳播後都檢查是否有 `nan` 或 `inf`

### 數值梯度檢查

反向傳播得到的解析梯度可能有錯。數值梯度檢查會用有限差分計算梯度，藉此驗證解析梯度。

中心差分公式：

```text
df/dx ~= (f(x + h) - f(x - h)) / (2h)
```

中心差分的誤差為 O(h^2)，比誤差為 O(h) 的前向差分 `(f(x+h) - f(x)) / h` 精確得多。

如何選擇 h：太大時近似結果會不準；太小時則會因災難性消去而破壞結果。通常可使用 `h = 1e-5` 到 `1e-7`。

檢查方式：計算解析梯度與數值梯度之間的相對差異。

```text
relative_error = |grad_analytical - grad_numerical| / max(|grad_analytical|, |grad_numerical|, 1e-8)
```

經驗判準：
- relative_error < 1e-7：非常理想，梯度正確
- relative_error < 1e-5：可接受，很可能正確
- relative_error > 1e-3：可能有問題
- relative_error > 1：梯度完全錯誤

實作新的層或損失函式時，務必檢查梯度。PyTorch 提供 `torch.autograd.gradcheck()` 進行這項檢查。

### 混合精度訓練

現代 GPU 配備 Tensor Core 等專用硬體，以 float16 執行矩陣乘法的速度比 float32 快 2 到 8 倍。混合精度訓練會運用這項優勢：

```text
1. 保留一份 float32 權重主副本
2. 以 float16 執行前向傳播（較快）
3. 以 float32 計算損失（避免溢位）
4. 以 float16 執行反向傳播（較快）
5. 將梯度縮放至 float32
6. 更新 float32 權重主副本
```

純 float16 訓練的問題是，梯度通常非常小（1e-8 或更小）。float16 會將低於約 6e-8 的數值下溢成零。所有梯度更新都變成零時，模型就會停止學習。

解法是使用損失縮放：

```text
1. 將損失乘上較大的縮放係數（例如 1024）
2. 反向傳播計算 `(loss * 1024)` 的梯度
3. 所有梯度都放大 1024 倍（高於 float16 下溢範圍）
4. 更新權重前，將梯度除以 1024
5. 最終更新量相同，但不會下溢
```

動態損失縮放會自動調整縮放係數。先從較大的值（65536）開始；如果梯度溢位成 `inf`，就將係數減半。如果連續 N 步都沒有溢位，就將係數加倍。

### bfloat16 與 float16：為什麼訓練偏好 bfloat16

```text
float16:   [1 符號] [5 指數]  [10 尾數]
bfloat16:  [1 符號] [8 指數]  [7 尾數]
```

float16 的精度較高（尾數為 10 位元，bfloat16 則為 7 位元），但數值範圍較有限（上限約為 65,504）。bfloat16 的精度較低，數值範圍卻和 float32 相同（上限約為 3.4e38）。

訓練神經網路時：

- 訓練過程中，啟動值與 logits 常會超過 65,504。float16 會溢位，bfloat16 則能表示。
- float16 需要損失縮放；bfloat16 通常不需要，因為它的數值範圍涵蓋了梯度可能出現的大小。
- bfloat16 是將 float32 尾數最低的 16 個位元截掉的簡化表示法；轉換很直接，而且指數不會失真。

推論時，數值範圍較有限，精度也更重要，因此常偏好 float16；訓練時，數值範圍更重要，因此常偏好 bfloat16。這也是 TPU 與現代 NVIDIA GPU（A100、H100）原生支援 bfloat16 的原因。

### 梯度裁剪

梯度爆炸是指梯度在多層網路中呈指數增長，常見於 RNN、深度網路與 Transformer。單一過大的梯度，就可能在一次更新中破壞所有權重。

裁剪方式有兩種：

**依數值裁剪：** 分別限制每個梯度元素的範圍。

```text
grad = clamp(grad, -max_val, max_val)
```

這種方式很簡單，但可能改變梯度向量的方向。

**依範數裁剪：** 縮放整個梯度向量，使其範數不超過指定門檻。

```text
if ||grad|| > max_norm:
    grad = grad * (max_norm / ||grad||)
```

這種方式會保留梯度方向。`torch.nn.utils.clip_grad_norm_()` 就是採用這種做法，也是標準選擇。

常見設定值：Transformer 使用 `max_norm=1.0`，強化學習使用 `max_norm=0.5`，較簡單的網路使用 `max_norm=5.0`。

梯度裁剪不是權宜之計，而是一種安全機制。若不使用它，單一異常批次就可能產生足以毀掉數週訓練成果的梯度。

### 正規化層如何穩定數值

批次正規化、層正規化與 RMS 正規化通常被視為能幫助訓練收斂的正規化方法；它們同時也能穩定數值。

若沒有正規化，啟動值可能會在各層之間呈指數增長或縮小：

```text
第 1 層：數值介於 [0, 1]
第 5 層：數值介於 [0, 100]
第 10 層：數值介於 [0, 10,000]
第 50 層：數值介於 [0, inf]
```

正規化會在每一層重新置中並縮放啟動值：

```text
LayerNorm(x) = (x - mean(x)) / (std(x) + epsilon) * gamma + beta
```

`epsilon`（通常是 1e-5）可避免所有啟動值相同時發生除以零。可學習的參數 `gamma` 和 `beta` 則讓網路能調回所需的尺度。

這能讓數值在整個網路中維持於安全範圍，避免前向傳播溢位與反向傳播的梯度爆炸。

### 常見的機器學習數值問題

**問題：訓練幾個 epoch 後，損失變成 NaN。**
原因：logits 過大，造成 softmax 溢位；或學習率過高，導致權重發散。
解法：使用穩定版 softmax（先減去最大值）、降低學習率，並加入梯度裁剪。

**問題：損失卡在 log(num_classes)。**
原因：模型輸出的機率接近均勻分布。這通常表示梯度消失，或模型根本沒有學習。
解法：確認資料標籤正確、驗證損失函式，並檢查是否有失效的 ReLU。

**問題：驗證準確率比預期低 1–3%。**
原因：混合精度訓練沒有正確進行損失縮放，梯度下溢會讓小幅更新悄悄歸零。
解法：啟用動態損失縮放，或改用 bfloat16。

**問題：某些層的梯度範數為 0.0。**
原因：ReLU 神經元失效（所有輸入都是負值），或 float16 發生下溢。
解法：改用 LeakyReLU 或 GELU、進行梯度縮放，並檢查權重初始化。

**問題：模型在一張 GPU 上正常，在另一張上結果不同。**
原因：浮點數累加順序不具決定性。不同硬體上的 GPU 平行歸約可能以不同順序加總，而浮點加法不符合結合律。
解法：接受細微差異（1e-6），或設定 `torch.use_deterministic_algorithms(True)`，並接受執行速度下降。

**問題：計算損失時，`exp()` 回傳 `inf`。**
原因：直接將原始 logits 傳給 `exp()`，沒有先減去最大值。
解法：使用 `torch.nn.functional.log_softmax()`，它會在內部處理 log-sum-exp。

**問題：從 float32 換成 float16 後，訓練開始發散。**
原因：float16 無法表示小於 6e-8 的梯度，或大於 65,504 的啟動值。
解法：使用搭配損失縮放的混合精度（AMP），或改用 bfloat16。

```figure
logsumexp-stability
```

## Build It

### 步驟 1：示範浮點數精度的限制

```python
print("=== Floating Point Precision ===")
print(f"0.1 + 0.2 = {0.1 + 0.2}")
print(f"0.1 + 0.2 == 0.3? {0.1 + 0.2 == 0.3}")
print(f"Difference: {(0.1 + 0.2) - 0.3:.2e}")
```

### 步驟 2：實作基本版與穩定版 softmax

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

### 步驟 5：檢查梯度

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

## Use It

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

### NaN/Inf 偵測

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

完整實作與各種邊界情況示範，請見 `code/numerical.py`。

## Ship It

本課程會產出：
- `code/numerical.py`：包含穩定版 softmax、log-sum-exp、交叉熵、梯度檢查與混合精度模擬
- `outputs/prompt-numerical-debugger.md`：用於診斷訓練中的 NaN/Inf 與數值問題

這些穩定版實作會在 Phase 3 的訓練迴圈，以及 Phase 4 的注意力機制實作中再次用到。

## Exercises｜練習

1. **災難性消去。** 使用基本公式 `E[x^2] - E[x]^2`，以 float32 計算 [1000000.0, 1000001.0, 1000002.0] 的變異數。再以 Welford 線上演算法計算一次，並和正確變異數（0.6667）比較誤差。

2. **尋找精度極限。** 找出最小的正 float32 數值 `x`，使 Python 中 `1.0 + x == 1.0`。這就是機器 epsilon。確認它與 `numpy.finfo(numpy.float32).eps` 相符。

3. **測試 Log-Sum-Exp 邊界情況。** 使用以下輸入測試 `logsumexp_stable`：(a) 所有數值相同；(b) 一個數值遠大於其他數值；(c) 所有數值都非常負（-1000）。確認基本版本會失敗時，穩定版仍能得出正確結果。

4. **檢查神經網路層的梯度。** 實作單一線性層 `y = Wx + b` 及其解析反向傳播。使用 `numerical_gradient` 驗證 3x2 權重矩陣的梯度正確性。

5. **損失縮放實驗。** 模擬 float16 訓練：產生範圍在 [1e-9, 1e-3] 的隨機梯度，轉成 float16，計算其中變成零的比例。接著套用損失縮放（乘以 1024）、轉成 float16、再縮回原尺度，並再次計算歸零比例。

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|----------|----------|
| IEEE 754 |「浮點數標準」| 定義二進位浮點格式、捨入規則與特殊值（inf、nan）的國際標準。現代 CPU 與 GPU 都有實作。 |
| Machine epsilon（機器 epsilon）|「精度極限」| 對某種浮點格式而言，能讓 1.0 + e 不等於 1.0 的最小 e。float32 約為 1.19e-7。 |
| Catastrophic cancellation（災難性消去）|「相減造成精度損失」| 相減非常接近的浮點數時，有效位數會抵消，捨入誤差因而主導結果。 |
| Overflow（溢位）|「數字太大」| 結果超過可表示的最大值，因而變成 inf。例如 exp(89) 會使 float32 溢位。 |
| Underflow（下溢）|「數字太小」| 結果比最小可表示正數更接近零，因而變成 0.0。例如 exp(-104) 會使 float32 下溢。 |
| Log-sum-exp trick（Log-Sum-Exp 技巧）|「先減去最大值」| 將 exp(max(x)) 提出來計算 log(sum(exp(x)))，以避免溢位與下溢。常用於 softmax、交叉熵與對數機率計算。 |
| Stable softmax（穩定版 softmax）|「不會爆掉的 softmax」| 計算指數前先減去 logits 的最大值。結果在數值上相同，而且不會溢位。 |
| Gradient checking（梯度檢查）|「驗證反向傳播」| 比較反向傳播得到的解析梯度與有限差分得到的數值梯度，以找出實作錯誤。 |
| Mixed precision（混合精度）|「float16 前向、float32 反向」| 對重視速度的運算使用較低精度浮點數，對數值敏感的運算則使用較高精度。通常可加速 2–3 倍。 |
| Loss scaling（損失縮放）|「避免梯度下溢」| 反向傳播前先將損失乘上較大的常數，讓梯度維持在 float16 可表示的範圍；更新權重前再除以同一常數。 |
| bfloat16 |「腦浮點數」| Google 的 16 位元格式，使用 8 位元指數（數值範圍和 float32 相同）與 7 位元尾數（精度低於 float16），適合訓練。 |
| Gradient clipping（梯度裁剪）|「限制梯度範數」| 縮放梯度向量，使其範數不超過門檻，避免梯度爆炸破壞權重。 |
| NaN |「非數值」| 由未定義運算（0/0、inf-inf、sqrt(-1)）產生的特殊浮點值，會傳播到後續算術運算。 |
| Inf |「無限大」| 由溢位或除以零產生的特殊浮點值。運算後也可能產生 NaN（例如 inf - inf、inf * 0）。 |
| Numerical gradient（數值梯度）|「暴力計算導數」| 計算 f(x+h) 與 f(x-h)，再除以 2h，以近似導數。速度較慢，但適合用來驗證。 |

## Further Reading｜延伸閱讀

- [What Every Computer Scientist Should Know About Floating-Point Arithmetic（Goldberg，1991）](https://docs.oracle.com/cd/E19957-01/806-3568/ncg_goldberg.html) -- 權威且完整的參考資料，內容較為密集
- [Mixed Precision Training（Micikevicius 等人，2018）](https://arxiv.org/abs/1710.03740) -- NVIDIA 發表的論文，介紹 float16 訓練的損失縮放方法
- [AMP: Automatic Mixed Precision（PyTorch 文件）](https://pytorch.org/docs/stable/amp.html) -- PyTorch 混合精度的實務指南
- [bfloat16 format（Google Cloud TPU 文件）](https://cloud.google.com/tpu/docs/bfloat16) -- 說明 Google 為 TPU 選用此格式的原因
- [Kahan Summation（Wikipedia）](https://en.wikipedia.org/wiki/Kahan_summation_algorithm) -- 降低浮點數加總捨入誤差的演算法
