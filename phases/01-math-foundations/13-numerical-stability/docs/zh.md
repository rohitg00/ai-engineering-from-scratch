# 数值稳定性（Numerical Stability）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 浮点数是一层会漏的抽象。它会在训练时咬你一口，而你毫无察觉。

**Type:** Build
**Language:** Python
**Prerequisites:** Phase 1, Lessons 01-04
**Time:** ~120 minutes

## 学习目标（Learning Objectives）

- 用「减最大值」技巧实现数值稳定的 softmax 与 log-sum-exp
- 识别浮点计算中的 overflow（上溢）、underflow（下溢）以及灾难性抵消（catastrophic cancellation）
- 用中心有限差分（centered finite differences）把解析梯度（analytical gradient）与数值梯度（numerical gradient）对照验证
- 解释为什么训练时 bfloat16 比 float16 更受欢迎，以及 loss scaling 如何避免 gradient 下溢

## 问题（The Problem）

你的模型训练了三个小时，loss 突然变成 NaN。你加了一行 print。第 9000 步时 logits 还正常，第 9001 步变成 `inf`，第 9002 步所有梯度都是 `nan`，训练当场死亡。

或者：模型训练跑完了，但准确率比论文低 2%。你把所有东西都核对了一遍。架构一致，超参一致，数据一致。问题在于论文用的是 float32，你用的是 float16，且没做正确的 scaling。三十二位累计的舍入误差悄悄吃掉了你的准确率。

又或者：你从零实现了 cross-entropy loss。小 logits 时一切正常，logits 一过 100 就返回 `inf`。softmax 上溢了，因为 `exp(100)` 已经超出 float32 能表示的范围。每个 ML 框架都用一个两行小技巧解决这个问题。你只是不知道那个技巧存在。

数值稳定性不是理论问题。它是「训练成功」与「悄悄失败」之间的分界线。你将来调试到的每一个严肃的 ML bug，最后大概率都会归结到浮点数。

## 概念（The Concept）

### IEEE 754：计算机怎么存实数

计算机按照 IEEE 754 标准把实数存成浮点数。一个 float 有三部分：符号位（sign bit）、指数（exponent）和尾数（mantissa，又叫 significand）。

```
Float32 layout (32 bits total):
[1 sign] [8 exponent] [23 mantissa]

Value = (-1)^sign * 2^(exponent - 127) * 1.mantissa
```

尾数决定精度（多少位有效数字），指数决定范围（数能多大或多小）。

```
Format     Bits   Exponent  Mantissa  Decimal digits  Range (approx)
float64    64     11        52        ~15-16          +/- 1.8e308
float32    32     8         23        ~7-8            +/- 3.4e38
float16    16     5         10        ~3-4            +/- 65,504
bfloat16   16     8         7         ~2-3            +/- 3.4e38
```

float32 大概给你 7 位十进制精度。意思是它能区分 1.0000001 和 1.0000002，但分不清 1.00000001 和 1.00000002。第 7 位之后全是舍入噪声。

float16 大概只有 3 位精度。它能表示的最大数是 65,504。这对 ML 来说小得令人不安——logits、梯度、激活值动不动就超过这个数。

bfloat16 是 Google 给 float16 范围问题的答案。它和 float32 一样有 8 位指数（范围一样大，最大可达 3.4e38），但只有 7 位尾数（精度比 float16 还差）。训练神经网络时，范围比精度更重要，所以 bfloat16 通常胜出。

### 为什么 0.1 + 0.2 != 0.3

数字 0.1 在二进制浮点里没法精确表示。在二进制下它是个无限循环小数：

```
0.1 in binary = 0.0001100110011001100110011... (repeating forever)
```

float32 把它截断成 23 位尾数，存下来的值约为 0.100000001490116。同理 0.2 被存为约 0.200000002980232。两者相加是 0.300000004470348，不是 0.3。

```
In Python:
>>> 0.1 + 0.2
0.30000000000000004

>>> 0.1 + 0.2 == 0.3
False
```

这件事对 ML 重要，因为：

1. 像 `if loss < threshold` 这种 loss 比较可能给出错误答案
2. 累加大量小值（数千步的 gradient 更新）会从真实和漂移
3. 如果用 `==` 比较 float，校验和与可复现性测试会失败

办法：永远别用 `==` 比较 float。用 `abs(a - b) < epsilon` 或 `math.isclose()`。

### 灾难性抵消（Catastrophic Cancellation）

当你减去两个几乎相等的浮点数，有效数字相互抵消，剩下的全是被「升格」到首位的舍入噪声。

```
a = 1.0000001    (stored as 1.00000011920929 in float32)
b = 1.0000000    (stored as 1.00000000000000 in float32)

True difference:  0.0000001
Computed:         0.00000011920929

Relative error: 19.2%
```

一次减法就 19% 的相对误差。在 ML 里，这种事会发生在：

- 算大均值数据的方差：`E[x^2] - E[x]^2`，当 E[x] 很大时
- 减两个几乎相等的对数概率
- 用过小的 epsilon 算有限差分梯度

办法：重排公式，避免相减「大且几乎相等」的数。算方差用 Welford 算法或先把数据中心化。算对数概率全程在对数空间里走。

### Overflow 与 Underflow

Overflow 是结果太大，无法表示。Underflow 是结果太小（比最小的可表示正数还接近零）。

```
Float32 boundaries:
  Maximum:  3.4028235e+38
  Minimum positive (normal): 1.175e-38
  Minimum positive (denorm): 1.401e-45
  Overflow:  anything > 3.4e38 becomes inf
  Underflow: anything < 1.4e-45 becomes 0.0
```

`exp()` 是 ML 里 overflow 的头号来源：

```
exp(88.7)  = 3.40e+38   (barely fits in float32)
exp(89.0)  = inf         (overflow)
exp(-87.3) = 1.18e-38   (barely above underflow)
exp(-104)  = 0.0         (underflow to zero)
```

`log()` 则朝另一个方向出事：

```
log(0.0)   = -inf
log(-1.0)  = nan
log(1e-45) = -103.3      (fine)
log(1e-46) = -inf        (input underflowed to 0, then log(0) = -inf)
```

ML 里 `exp()` 出现在 softmax、sigmoid、概率计算里；`log()` 出现在 cross-entropy、对数似然、KL 散度里。`log(exp(x))` 这种组合不加技巧就是雷区。

### Log-Sum-Exp 技巧

直接计算 `log(sum(exp(x_i)))` 在数值上极度危险。任意一个 `x_i` 大一点，`exp(x_i)` 就 overflow；所有 `x_i` 都很负时，每个 `exp(x_i)` 都 underflow 到零，`log(0)` 变成 `-inf`。

技巧：取指数前先减去最大值。

```
log(sum(exp(x_i))) = max(x) + log(sum(exp(x_i - max(x))))
```

为什么有效：减完 `max(x)` 之后最大的指数是 `exp(0) = 1`，不可能 overflow。求和里至少有一项是 1，所以总和至少是 1，`log(1) = 0`，也不可能 underflow 到 `-inf`。

证明：

```
log(sum(exp(x_i)))
= log(sum(exp(x_i - c + c)))                    (add and subtract c)
= log(sum(exp(x_i - c) * exp(c)))               (exp(a+b) = exp(a)*exp(b))
= log(exp(c) * sum(exp(x_i - c)))               (factor out exp(c))
= c + log(sum(exp(x_i - c)))                    (log(a*b) = log(a) + log(b))
```

取 `c = max(x)`，overflow 就消失了。

这个技巧在 ML 里到处都是：
- softmax 归一化
- cross-entropy loss 计算
- 序列模型里对数概率的累加
- 高斯混合
- 变分推断（variational inference）

### 为什么 softmax 必须用减最大值技巧

softmax 把 logits 转成概率：

```
softmax(x_i) = exp(x_i) / sum(exp(x_j))
```

不用技巧时，logits 为 [100, 101, 102] 就会 overflow：

```
exp(100) = 2.69e43
exp(101) = 7.31e43
exp(102) = 1.99e44
sum      = 2.99e44

These overflow float32 (max ~3.4e38)? No, 2.69e43 < 3.4e38? Actually:
exp(88.7) is already at the float32 limit.
exp(100) = inf in float32.
```

用了技巧，减去 max(x) = 102：

```
exp(100 - 102) = exp(-2) = 0.135
exp(101 - 102) = exp(-1) = 0.368
exp(102 - 102) = exp(0)  = 1.000
sum = 1.503

softmax = [0.090, 0.245, 0.665]
```

概率结果完全一致，但计算安全。这不是优化，这是正确性的硬性要求。

### NaN 与 Inf：检测与预防

`nan`（Not a Number）和 `inf`（infinity）会像病毒一样在计算中传染。一次 gradient 更新里出现一个 `nan`，权重就变 `nan`，之后每个输出都是 `nan`。一步之内训练就死透了。

`inf` 怎么出现：
- 对一个大正数取 `exp()`
- 除零：`1.0 / 0.0`
- 累加时 `float32` overflow

`nan` 怎么出现：
- `0.0 / 0.0`
- `inf - inf`
- `inf * 0`
- 对负数取 `sqrt()`
- 对负数取 `log()`
- 任何参与了已有 `nan` 的算术

检测：

```python
import math

math.isnan(x)       # True if x is nan
math.isinf(x)       # True if x is +inf or -inf
math.isfinite(x)    # True if x is neither nan nor inf
```

预防策略：

1. 给 `exp()` 的输入加 clamp：`exp(clamp(x, -80, 80))`
2. 分母加 epsilon：`x / (y + 1e-8)`
3. `log()` 内部加 epsilon：`log(x + 1e-8)`
4. 用稳定实现（log-sum-exp、stable softmax）
5. 梯度裁剪（gradient clipping）防止权重爆炸
6. 调试时每次前向传播后都检查 `nan`/`inf`

### 数值梯度检查（Numerical Gradient Checking）

解析梯度（来自反向传播）也可能写错。数值梯度检查用有限差分计算梯度来验证它。

中心差分公式：

```
df/dx ~= (f(x + h) - f(x - h)) / (2h)
```

它的精度是 O(h^2)，比前向差分 `(f(x+h) - f(x)) / h`（只有 O(h)）好得多。

选 h：太大近似就不准，太小灾难性抵消会毁掉答案。`h = 1e-5` 到 `1e-7` 是常见取值。

检查方法：算解析梯度和数值梯度的相对差。

```
relative_error = |grad_analytical - grad_numerical| / max(|grad_analytical|, |grad_numerical|, 1e-8)
```

经验法则：
- relative_error < 1e-7：完美，梯度正确
- relative_error < 1e-5：可接受，大概率正确
- relative_error > 1e-3：有问题
- relative_error > 1：梯度完全错了

实现新 layer 或新 loss 时永远要做梯度检查。PyTorch 提供 `torch.autograd.gradcheck()` 帮你做这件事。

### 混合精度训练（Mixed Precision Training）

现代 GPU 有专门硬件（Tensor Core）做 float16 矩阵乘法，速度比 float32 快 2-8 倍。混合精度训练利用这一点：

```
1. Maintain float32 master copy of weights
2. Forward pass in float16 (fast)
3. Compute loss in float32 (prevents overflow)
4. Backward pass in float16 (fast)
5. Scale gradients to float32
6. Update float32 master weights
```

纯 float16 训练的问题：梯度往往非常小（1e-8 甚至更小）。float16 把任何小于约 6e-8 的值都 underflow 成零。模型停止学习，因为所有 gradient 更新都是零。

办法是 loss scaling：

```
1. Multiply loss by a large scale factor (e.g., 1024)
2. Backward pass computes gradients of (loss * 1024)
3. All gradients are 1024x larger (pushed above float16 underflow)
4. Divide gradients by 1024 before updating weights
5. Net effect: same update, but no underflow
```

动态 loss scaling 会自动调整 scale factor。从一个大值（65536）开始；如果梯度 overflow 成 `inf`，就减半；连续 N 步没 overflow 就翻倍。

### bfloat16 vs float16：训练为何选 bfloat16

```
float16:   [1 sign] [5 exponent]  [10 mantissa]
bfloat16:  [1 sign] [8 exponent]  [7 mantissa]
```

float16 精度更高（10 位尾数 vs 7 位）但范围有限（最大约 65,504）。bfloat16 精度更低，但和 float32 范围一样（最大约 3.4e38）。

训练神经网络时：

- 训练中的尖峰会让激活和 logits 经常超过 65,504。float16 直接 overflow，bfloat16 顶得住。
- float16 必须配 loss scaling，bfloat16 通常不用，因为它的范围已经覆盖了梯度幅度的整个谱。
- bfloat16 就是 float32 的简单截断：把尾数低 16 位丢掉。转换平凡，指数无损。

float16 在推理（inference）时更受欢迎，因为推理时数值有界、精度更重要。bfloat16 训练更受欢迎，因为训练时范围更重要。这就是 TPU 和现代 NVIDIA GPU（A100、H100）原生支持 bfloat16 的原因。

### 梯度裁剪（Gradient Clipping）

梯度爆炸（exploding gradients）发生在梯度穿过多层时呈指数增长（在 RNN、深网络、transformer 里很常见）。一个超大的梯度就足以一步内毁掉所有权重。

两种裁剪：

**按值裁剪（Clip by value）：** 独立地把每个梯度元素夹紧。

```
grad = clamp(grad, -max_val, max_val)
```

简单，但可能改变梯度向量的方向。

**按范数裁剪（Clip by norm）：** 把整个梯度向量缩放，使其范数不超过阈值。

```
if ||grad|| > max_norm:
    grad = grad * (max_norm / ||grad||)
```

保留方向。这就是 `torch.nn.utils.clip_grad_norm_()` 干的事，是标准选择。

典型值：transformer 用 `max_norm=1.0`，强化学习（RL）用 `max_norm=0.5`，更简单的网络用 `max_norm=5.0`。

梯度裁剪不是 hack。它是一道安全机制。没有它，一个离群 batch 产生的梯度就足以毁掉几周的训练。

### Normalization 层作为数值稳定器

Batch norm、layer norm、RMS norm 通常被介绍成帮助训练收敛的正则化手段。它们也是数值稳定器。

没有 normalization 时，激活会随层数指数增长或衰减：

```
Layer 1: values in [0, 1]
Layer 5: values in [0, 100]
Layer 10: values in [0, 10,000]
Layer 50: values in [0, inf]
```

normalization 在每层都把激活重新中心化、重新缩放：

```
LayerNorm(x) = (x - mean(x)) / (std(x) + epsilon) * gamma + beta
```

`epsilon`（通常 1e-5）防止全部激活相同时除以零。可学习参数 `gamma` 和 `beta` 让网络可以恢复任何它需要的尺度。

这能让数值在整个网络里都待在数值安全区，既防止前向 overflow，也防止反向 gradient 爆炸。

### 常见 ML 数值 bug

**Bug：训练几个 epoch 后 loss 是 NaN。**
原因：logits 长得太大，softmax overflow；或者学习率（learning rate）太高，权重发散。
解法：用稳定 softmax（减最大值）、降学习率、加梯度裁剪。

**Bug：loss 卡在 log(num_classes)。**
原因：模型输出接近均匀概率。通常意味着梯度消失或者模型根本没在学。
解法：检查数据标签是否正确、核对 loss 函数、检查是否有死掉的 ReLU。

**Bug：验证准确率比预期低 1-3%。**
原因：混合精度但没有正确做 loss scaling。gradient underflow 悄悄把小更新清零。
解法：开启动态 loss scaling，或换成 bfloat16。

**Bug：某些层的 gradient norm 是 0.0。**
原因：ReLU 神经元死掉（输入全负），或者 float16 underflow。
解法：换 LeakyReLU 或 GELU、用 gradient scaling、检查权重初始化。

**Bug：模型在一块 GPU 上能跑，在另一块上结果不一样。**
原因：浮点累加顺序不确定。GPU 并行 reduction 在不同硬件上以不同顺序求和，而浮点加法不满足结合律。
解法：接受小差异（1e-6），或设置 `torch.use_deterministic_algorithms(True)` 并接受速度损失。

**Bug：loss 计算里 `exp()` 返回 `inf`。**
原因：原始 logits 没经过减最大值技巧就被传给了 `exp()`。
解法：用 `torch.nn.functional.log_softmax()`，它内部已经实现了 log-sum-exp。

**Bug：从 float32 切到 float16 后训练发散。**
原因：float16 表示不了小于 6e-8 的梯度幅度，也表示不了大于 65,504 的激活。
解法：用带 loss scaling 的混合精度（AMP），或者直接换 bfloat16。

## 动手实现（Build It）

### Step 1：演示浮点精度的极限

```python
print("=== Floating Point Precision ===")
print(f"0.1 + 0.2 = {0.1 + 0.2}")
print(f"0.1 + 0.2 == 0.3? {0.1 + 0.2 == 0.3}")
print(f"Difference: {(0.1 + 0.2) - 0.3:.2e}")
```

### Step 2：朴素 vs 稳定 softmax

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

### Step 3：稳定的 log-sum-exp

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

### Step 4：稳定的 cross-entropy

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

### Step 5：梯度检查

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

## 用起来（Use It）

### 模拟混合精度

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

### NaN/Inf 检测

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

完整实现以及所有边界情况的演示见 `code/numerical.py`。

## 上线部署（Ship It）

本课产出：
- `code/numerical.py`：包含稳定 softmax、log-sum-exp、cross-entropy、梯度检查、混合精度模拟
- `outputs/prompt-numerical-debugger.md`：用于诊断训练中 NaN/Inf 与数值问题的 prompt

这些稳定实现会在 Phase 3 的训练循环和 Phase 4 的 attention 实现里再次出现。

## 练习（Exercises）

1. **灾难性抵消。** 用朴素公式 `E[x^2] - E[x]^2` 在 float32 下计算 [1000000.0, 1000001.0, 1000002.0] 的方差。再用 Welford 在线算法计算一次。把两种结果与真实方差（0.6667）的误差比较。

2. **精度搜索。** 在 Python 里找出最小的正 float32 值 `x`，使得 `1.0 + x == 1.0`。这就是机器 epsilon。验证它是否与 `numpy.finfo(numpy.float32).eps` 一致。

3. **log-sum-exp 边界用例。** 用以下输入测试你的 `logsumexp_stable`：(a) 所有值相等，(b) 一个值远大于其余，(c) 所有值都很负（-1000）。验证它在朴素版失败的地方仍然正确。

4. **对一个神经网络层做梯度检查。** 实现一个线性 layer `y = Wx + b` 及其解析反向传播。用 `numerical_gradient` 验证一个 3x2 权重矩阵的正确性。

5. **loss scaling 实验。** 模拟 float16 训练：在 [1e-9, 1e-3] 范围里随机生成梯度，转成 float16，统计有多大比例变成零。然后做 loss scaling（乘 1024），转 float16，再缩回去，再统计零的比例。

## 关键术语（Key Terms）

| Term | What people say | What it actually means |
|------|----------------|----------------------|
| IEEE 754 | "浮点标准" | 国际标准，定义了二进制浮点格式、舍入规则与特殊值（inf、nan）。每一颗现代 CPU 和 GPU 都实现它。 |
| Machine epsilon | "精度极限" | 给定 float 格式下，最小的使 1.0 + e != 1.0 成立的值 e。float32 大约是 1.19e-7。 |
| Catastrophic cancellation | "减法导致精度丢失" | 减去两个几乎相等的浮点数时，有效数字相互抵消，舍入噪声主导结果。 |
| Overflow | "数太大" | 结果超过最大可表示值，变成 inf。exp(89) 在 float32 里就 overflow。 |
| Underflow | "数太小" | 结果比最小可表示正数还接近零，变成 0.0。exp(-104) 在 float32 里 underflow。 |
| Log-sum-exp trick | "先减最大值" | 通过把 exp(max(x)) 因式提出来计算 log(sum(exp(x)))，避免 overflow 与 underflow。用于 softmax、cross-entropy 与对数概率运算。 |
| Stable softmax | "不会爆炸的 softmax" | 在取指数前减去 max(logits)。结果数值上完全相同，且不可能 overflow。 |
| Gradient checking | "验证你的 backprop" | 把反向传播得到的解析梯度和有限差分得到的数值梯度作对比，找出实现 bug。 |
| Mixed precision | "前向 float16，反向 float32" | 速度敏感的运算用低精度 float，数值敏感的运算用高精度 float。常见加速 2-3x。 |
| Loss scaling | "防止 gradient underflow" | 反向传播前把 loss 乘一个大常数，让梯度落在 float16 可表示范围内，权重更新前再除回去。 |
| bfloat16 | "Brain floating point" | Google 的 16 位格式：8 位指数（与 float32 同范围）、7 位尾数（精度低于 float16）。训练首选。 |
| Gradient clipping | "限制梯度范数" | 把梯度向量缩放，使其范数不超过阈值。防止梯度爆炸毁掉权重。 |
| NaN | "Not a Number" | 来自未定义运算（0/0、inf-inf、sqrt(-1)）的特殊 float 值。会传染给后续所有算术。 |
| Inf | "无穷" | 来自 overflow 或除零的特殊 float 值。可能与其它运算组合出 NaN（inf - inf、inf * 0）。 |
| Numerical gradient | "暴力求导" | 通过算 f(x+h) 和 f(x-h) 再除以 2h 来近似导数。慢，但用来验证很可靠。 |

## 延伸阅读（Further Reading）

- [What Every Computer Scientist Should Know About Floating-Point Arithmetic (Goldberg 1991)](https://docs.oracle.com/cd/E19957-01/806-3568/ncg_goldberg.html) -- 权威参考，密度高但完整
- [Mixed Precision Training (Micikevicius et al., 2018)](https://arxiv.org/abs/1710.03740) -- NVIDIA 提出 float16 训练 loss scaling 的论文
- [AMP: Automatic Mixed Precision (PyTorch docs)](https://pytorch.org/docs/stable/amp.html) -- PyTorch 中混合精度的实践指南
- [bfloat16 format (Google Cloud TPU docs)](https://cloud.google.com/tpu/docs/bfloat16) -- Google 为 TPU 选择该格式的原因
- [Kahan Summation (Wikipedia)](https://en.wikipedia.org/wiki/Kahan_summation_algorithm) -- 减小浮点求和舍入误差的算法
