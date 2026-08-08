# 13 · 数值稳定性

> 浮点数是一层会漏水的抽象。它会在训练时咬你一口，而你完全看不到它来。

**类型：** 构建（Build）
**语言：** Python
**前置：** 第 1 阶段，第 01-04 课
**时长：** 约 120 分钟

## 学习目标

- 使用「最大值相减技巧（max-subtraction trick）」实现数值稳定的 softmax 与 log-sum-exp
- 识别浮点运算中的「上溢（overflow）」、「下溢（underflow）」与「灾难性抵消（catastrophic cancellation）」
- 使用「中心有限差分（centered finite differences）」将解析梯度与数值梯度进行比对验证
- 解释为什么训练时偏好用 bfloat16 而非 float16，以及「损失缩放（loss scaling）」如何防止梯度下溢

## 问题所在

你的模型训练了三个小时，然后损失变成了 NaN。你加了一条打印语句。在第 9000 步时 logits 还是正常的。到第 9001 步它们变成了 `inf`。到第 9002 步每一个梯度都成了 `nan`，训练彻底死掉了。

或者：你的模型训练顺利完成，但准确率比论文宣称的低了 2%。你检查了一切。架构一致。超参数一致。数据一致。问题在于论文用的是 float32，而你用的是 float16 且没有正确的缩放。三十二个比特里累积的舍入误差悄悄吃掉了你的准确率。

又或者：你从零实现交叉熵损失。它在小 logits 上能正常工作。当 logits 超过 100 时，它返回 `inf`。softmax 溢出了，因为 `exp(100)` 比 float32 能表示的范围还大。每个 ML 框架都用一个两行的技巧来处理这个问题。而你根本不知道这个技巧存在。

数值稳定性不是一个理论问题。它是一次成功的训练与一次悄无声息失败的训练之间的区别。你将来要调试的每一个严肃的 ML bug，最终都会归结到浮点数上。

## 核心概念

### IEEE 754：计算机如何存储实数

计算机按照 IEEE 754 标准以浮点值的形式存储实数。一个浮点数有三个组成部分：「符号位（sign bit）」、「指数（exponent）」和「尾数（mantissa，又称有效数字 significand）」。

```
Float32 layout (32 bits total):
[1 sign] [8 exponent] [23 mantissa]

Value = (-1)^sign * 2^(exponent - 127) * 1.mantissa
```

尾数决定精度（有多少位有效数字）。指数决定范围（一个数可以多大或多小）。

```
Format     Bits   Exponent  Mantissa  Decimal digits  Range (approx)
float64    64     11        52        ~15-16          +/- 1.8e308
float32    32     8         23        ~7-8            +/- 3.4e38
float16    16     5         10        ~3-4            +/- 65,504
bfloat16   16     8         7         ~2-3            +/- 3.4e38
```

float32 给你大约 7 位十进制精度。这意味着它能区分 1.0000001 和 1.0000002，但区分不了 1.00000001 和 1.00000002。超过 7 位之后，一切都是舍入噪声。

float16 给你大约 3 位精度。它能表示的最大数是 65504。对于 ML 来说这小得令人不安，因为这里的 logits、梯度和激活值经常会超过这个数。

bfloat16 是 Google 针对 float16 范围问题给出的答案。它拥有与 float32 相同的 8 位指数（范围相同，可达 3.4e38），但只有 7 位尾数（精度低于 float16）。对于训练神经网络而言，范围比精度更重要，所以 bfloat16 通常胜出。

### 为什么 0.1 + 0.2 != 0.3

数字 0.1 无法在二进制浮点中精确表示。在二进制下，它是一个无限循环小数：

```
0.1 in binary = 0.0001100110011001100110011... (repeating forever)
```

float32 将其截断为 23 位尾数。存储的值约为 0.100000001490116。类似地，0.2 被存储为约 0.200000002980232。它们的和是 0.300000004470348，而不是 0.3。

```
In Python:
>>> 0.1 + 0.2
0.30000000000000004

>>> 0.1 + 0.2 == 0.3
False
```

这对 ML 之所以重要，是因为：

1. 像 `if loss < threshold` 这样的损失比较可能给出错误答案
2. 累加大量小数值（成千上万步上的梯度更新）会偏离真实的总和
3. 如果你用 `==` 比较浮点数，校验和与可复现性测试会失败

修复方法：永远不要用 `==` 比较浮点数。改用 `abs(a - b) < epsilon` 或 `math.isclose()`。

### 灾难性抵消

当你将两个几乎相等的浮点数相减时，有效数字相互抵消，剩下的是被提升为高位的舍入噪声。

```
a = 1.0000001    (stored as 1.00000011920929 in float32)
b = 1.0000000    (stored as 1.00000000000000 in float32)

True difference:  0.0000001
Computed:         0.00000011920929

Relative error: 19.2%
```

仅仅一次减法就造成了 19% 的相对误差。在 ML 中，这种情况会在你执行以下操作时发生：

- 计算均值很大的数据的方差：当 E[x] 很大时计算 `E[x^2] - E[x]^2`
- 将几乎相等的对数概率相减
- 用过小的 epsilon 计算有限差分梯度

修复方法：重新整理公式，避免对很大且几乎相等的数做减法。对于方差，使用「Welford 算法」或先对数据进行中心化。对于对数概率，全程在对数空间中运算。

### 上溢与下溢

「上溢（overflow）」发生在结果大到无法表示时。「下溢（underflow）」发生在结果太小时（比最小可表示的正数还接近零）。

```
Float32 boundaries:
  Maximum:  3.4028235e+38
  Minimum positive (normal): 1.175e-38
  Minimum positive (denorm): 1.401e-45
  Overflow:  anything > 3.4e38 becomes inf
  Underflow: anything < 1.4e-45 becomes 0.0
```

`exp()` 函数是 ML 中上溢的主要来源：

```
exp(88.7)  = 3.40e+38   (barely fits in float32)
exp(89.0)  = inf         (overflow)
exp(-87.3) = 1.18e-38   (barely above underflow)
exp(-104)  = 0.0         (underflow to zero)
```

`log()` 函数则朝另一个方向出问题：

```
log(0.0)   = -inf
log(-1.0)  = nan
log(1e-45) = -103.3      (fine)
log(1e-46) = -inf        (input underflowed to 0, then log(0) = -inf)
```

在 ML 中，`exp()` 出现在 softmax、sigmoid 和概率计算里。`log()` 出现在交叉熵、对数似然和 KL 散度里。在没有正确技巧的情况下，组合 `log(exp(x))` 是一片雷区。

### Log-Sum-Exp 技巧

直接计算 `log(sum(exp(x_i)))` 在数值上是危险的。如果任意 `x_i` 很大，`exp(x_i)` 就会上溢。如果所有 `x_i` 都非常负，每一项 `exp(x_i)` 都会下溢到零，于是 `log(0)` 就是 `-inf`。

技巧：在取指数之前先减去最大值。

```
log(sum(exp(x_i))) = max(x) + log(sum(exp(x_i - max(x))))
```

为什么这样可行：减去 `max(x)` 之后，最大的指数项是 `exp(0) = 1`。不可能发生上溢。求和中至少有一项是 1，所以和至少为 1，且 `log(1) = 0`。不可能下溢到 `-inf`。

证明：

```
log(sum(exp(x_i)))
= log(sum(exp(x_i - c + c)))                    (add and subtract c)
= log(sum(exp(x_i - c) * exp(c)))               (exp(a+b) = exp(a)*exp(b))
= log(exp(c) * sum(exp(x_i - c)))               (factor out exp(c))
= c + log(sum(exp(x_i - c)))                    (log(a*b) = log(a) + log(b))
```

设 `c = max(x)`，上溢就被消除了。

这个技巧在 ML 中无处不在：
- Softmax 归一化
- 交叉熵损失计算
- 序列模型中的对数概率求和
- 高斯混合模型
- 变分推断

### 为什么 Softmax 需要「最大值相减技巧」

Softmax 将 logits 转换为概率：

```
softmax(x_i) = exp(x_i) / sum(exp(x_j))
```

不用这个技巧，[100, 101, 102] 这样的 logits 会导致上溢：

```
exp(100) = 2.69e43
exp(101) = 7.31e43
exp(102) = 1.99e44
sum      = 2.99e44

These overflow float32 (max ~3.4e38)? No, 2.69e43 < 3.4e38? Actually:
exp(88.7) is already at the float32 limit.
exp(100) = inf in float32.
```

用上技巧后，减去 max(x) = 102：

```
exp(100 - 102) = exp(-2) = 0.135
exp(101 - 102) = exp(-1) = 0.368
exp(102 - 102) = exp(0)  = 1.000
sum = 1.503

softmax = [0.090, 0.245, 0.665]
```

概率完全相同。但计算是安全的。这不是一项优化，而是正确性的必要条件。

### NaN 与 Inf：检测与预防

`nan`（Not a Number，非数）与 `inf`（infinity，无穷）会像病毒一样在计算中传播。梯度更新中的一个 `nan` 会让权重变成 `nan`，进而让之后每一个输出都变成 `nan`。训练在一步之内就死了。

`inf` 是如何出现的：
- 对一个大正数取 `exp()`
- 除以零：`1.0 / 0.0`
- 累加中的 `float32` 上溢

`nan` 是如何出现的：
- `0.0 / 0.0`
- `inf - inf`
- `inf * 0`
- 对负数取 `sqrt()`
- 对负数取 `log()`
- 任何涉及已有 `nan` 的算术运算

检测：

```python
import math

math.isnan(x)       # 若 x 为 nan 则为 True
math.isinf(x)       # 若 x 为 +inf 或 -inf 则为 True
math.isfinite(x)    # 若 x 既不是 nan 也不是 inf 则为 True
```

预防策略：

1. 对 `exp()` 的输入进行钳制：`exp(clamp(x, -80, 80))`
2. 给分母加上 epsilon：`x / (y + 1e-8)`
3. 在 `log()` 内部加上 epsilon：`log(x + 1e-8)`
4. 使用稳定的实现（log-sum-exp、稳定 softmax）
5. 用梯度裁剪防止权重爆炸
6. 调试时在每一次前向传播之后检查 `nan`/`inf`

### 数值梯度检查

解析梯度（来自反向传播）可能存在 bug。「数值梯度检查（numerical gradient checking）」通过有限差分计算梯度来验证它们。

中心差分公式：

```
df/dx ~= (f(x + h) - f(x - h)) / (2h)
```

它的精度是 O(h^2)，远好于只有 O(h) 精度的前向差分 `(f(x+h) - f(x)) / h`。

如何选 h：太大则近似不准确，太小则灾难性抵消会摧毁结果。`h = 1e-5` 到 `1e-7` 是典型取值。

检查方法：计算解析梯度与数值梯度之间的相对差异。

```
relative_error = |grad_analytical - grad_numerical| / max(|grad_analytical|, |grad_numerical|, 1e-8)
```

经验法则：
- relative_error < 1e-7：完美，梯度正确
- relative_error < 1e-5：可接受，多半正确
- relative_error > 1e-3：有问题
- relative_error > 1：梯度完全错误

在实现一个新的层或损失函数时，务必检查梯度。PyTorch 为此提供了 `torch.autograd.gradcheck()`。

### 混合精度训练

现代 GPU 拥有专用硬件（「张量核心（Tensor Cores）」），其 float16 矩阵乘法的计算速度比 float32 快 2-8 倍。「混合精度训练（mixed precision training）」利用了这一点：

```
1. Maintain float32 master copy of weights
2. Forward pass in float16 (fast)
3. Compute loss in float32 (prevents overflow)
4. Backward pass in float16 (fast)
5. Scale gradients to float32
6. Update float32 master weights
```

纯 float16 训练的问题在于：梯度往往非常小（1e-8 或更小）。float16 会把任何小于约 6e-8 的值下溢为零。你的模型会停止学习，因为所有梯度更新都是零。

修复方法是损失缩放：

```
1. Multiply loss by a large scale factor (e.g., 1024)
2. Backward pass computes gradients of (loss * 1024)
3. All gradients are 1024x larger (pushed above float16 underflow)
4. Divide gradients by 1024 before updating weights
5. Net effect: same update, but no underflow
```

「动态损失缩放（dynamic loss scaling）」会自动调整缩放因子。从一个大值（65536）开始。如果梯度上溢到 `inf`，就将其减半。如果连续 N 步都没有上溢，就将其翻倍。

### bfloat16 对比 float16：为什么训练偏爱 bfloat16

```
float16:   [1 sign] [5 exponent]  [10 mantissa]
bfloat16:  [1 sign] [8 exponent]  [7 mantissa]
```

float16 精度更高（10 位尾数对 7 位），但范围有限（最大约 65504）。bfloat16 精度较低，但范围与 float32 相同（最大约 3.4e38）。

对于训练神经网络：

- 在训练尖峰期间，激活值和 logits 经常超过 65504。float16 会上溢；bfloat16 能处理。
- 用 float16 时必须做损失缩放，而用 bfloat16 时通常不需要，因为它的范围覆盖了梯度量级的整个谱系。
- bfloat16 是 float32 的简单截断：丢掉尾数底部的 16 个比特。转换很简单，而且在指数上是无损的。

float16 在推理场景中更受偏爱，那里数值有界且精度更重要。bfloat16 在训练场景中更受偏爱，那里范围更重要。这就是为什么 TPU 和现代 NVIDIA GPU（A100、H100）都原生支持 bfloat16。

### 梯度裁剪

「梯度爆炸（exploding gradients）」发生在梯度穿过许多层后呈指数级增长时（常见于 RNN、深层网络和 transformer）。单个很大的梯度就能在一步之内毁掉所有权重。

两种裁剪类型：

**按值裁剪（Clip by value）：** 独立地钳制每一个梯度元素。

```
grad = clamp(grad, -max_val, max_val)
```

简单，但可能改变梯度向量的方向。

**按范数裁剪（Clip by norm）：** 缩放整个梯度向量，使其范数不超过某个阈值。

```
if ||grad|| > max_norm:
    grad = grad * (max_norm / ||grad||)
```

保持梯度的方向。这正是 `torch.nn.utils.clip_grad_norm_()` 所做的。它是标准选择。

典型取值：transformer 用 `max_norm=1.0`，强化学习（RL）用 `max_norm=0.5`，较简单的网络用 `max_norm=5.0`。

梯度裁剪不是一个权宜之计的 hack。它是一种安全机制。没有它，单个异常批次就可能产生一个大到足以毁掉数周训练的梯度。

### 作为数值稳定器的归一化层

「批归一化（batch normalization）」、「层归一化（layer normalization）」和「RMS 归一化（RMS normalization）」通常被描述为帮助训练收敛的正则化手段。它们同时也是数值稳定器。

没有归一化时，激活值会穿过各层呈指数级增长或收缩：

```
Layer 1: values in [0, 1]
Layer 5: values in [0, 100]
Layer 10: values in [0, 10,000]
Layer 50: values in [0, inf]
```

归一化在每一层对激活值重新中心化并重新缩放：

```
LayerNorm(x) = (x - mean(x)) / (std(x) + epsilon) * gamma + beta
```

`epsilon`（通常为 1e-5）在所有激活值都相同时防止除以零。可学习参数 `gamma` 和 `beta` 让网络能恢复它所需的任意尺度。

这使得数值在整个网络中保持在数值安全的范围内，既防止了前向传播中的上溢，也防止了反向传播中的梯度爆炸。

### 常见的 ML 数值 bug

**Bug：训练几个 epoch 后损失变成 NaN。**
原因：logits 增长得太大，softmax 上溢了。或者学习率太高导致权重发散。
修复：使用稳定 softmax（最大值相减），降低学习率，加入梯度裁剪。

**Bug：损失卡在 log(num_classes)。**
原因：模型输出接近均匀分布的概率。这往往意味着梯度在消失，或者模型根本没在学习。
修复：检查数据标签是否正确，验证损失函数，检查是否存在「死亡 ReLU（dead ReLU）」。

**Bug：验证准确率比预期低 1-3%。**
原因：混合精度但没有正确的损失缩放。梯度下溢悄悄把小的更新清零了。
修复：启用动态损失缩放，或切换到 bfloat16。

**Bug：某些层的梯度范数为 0.0。**
原因：死亡的 ReLU 神经元（所有输入为负），或 float16 下溢。
修复：使用 LeakyReLU 或 GELU，使用梯度缩放，检查权重初始化。

**Bug：模型在一块 GPU 上正常，但在另一块上给出不同结果。**
原因：浮点累加顺序不确定。GPU 的并行归约在不同硬件上以不同顺序求和，而浮点加法不满足结合律。
修复：接受微小差异（1e-6），或设置 `torch.use_deterministic_algorithms(True)` 并接受速度损失。

**Bug：损失计算中 `exp()` 返回 `inf`。**
原因：原始 logits 没有经过最大值相减技巧就传给了 `exp()`。
修复：使用 `torch.nn.functional.log_softmax()`，它内部实现了 log-sum-exp。

**Bug：从 float32 切换到 float16 后训练发散。**
原因：float16 无法表示低于 6e-8 的梯度量级或高于 65504 的激活值。
修复：使用带损失缩放的混合精度（AMP），或改用 bfloat16。

## 动手构建

### 第 1 步：演示浮点精度极限

```python
print("=== Floating Point Precision ===")
print(f"0.1 + 0.2 = {0.1 + 0.2}")
print(f"0.1 + 0.2 == 0.3? {0.1 + 0.2 == 0.3}")
print(f"Difference: {(0.1 + 0.2) - 0.3:.2e}")
```

### 第 2 步：实现朴素 softmax 与稳定 softmax

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
# softmax_naive(dangerous_logits) 会返回 [nan, nan, nan]
```

### 第 3 步：实现稳定的 log-sum-exp

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
# logsumexp_naive(large) 返回 inf
```

### 第 4 步：实现稳定的交叉熵

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

### 第 5 步：梯度检查

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

## 实际运用

### 混合精度模拟

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

完整实现及所有边界情况的演示，参见 `code/numerical.py`。

## 交付成果

本课产出：
- `code/numerical.py`，包含稳定 softmax、log-sum-exp、交叉熵、梯度检查与混合精度模拟
- `outputs/prompt-numerical-debugger.md`，用于诊断训练中的 NaN/Inf 与数值问题

这些稳定实现会在第 3 阶段构建训练循环时、以及第 4 阶段实现注意力机制时再次出现。

## 练习

1. **灾难性抵消。** 在 float32 下，用朴素公式 `E[x^2] - E[x]^2` 计算 [1000000.0, 1000001.0, 1000002.0] 的方差。然后用 Welford 在线算法计算它。将两者的误差与真实方差（0.6667）进行比较。

2. **精度搜寻。** 在 Python 中找出使得 `1.0 + x == 1.0` 成立的最小正 float32 值 `x`。这就是机器 epsilon。验证它是否与 `numpy.finfo(numpy.float32).eps` 一致。

3. **Log-sum-exp 边界情况。** 用以下输入测试你的 `logsumexp_stable` 函数：(a) 所有值相等，(b) 一个值远大于其余值，(c) 所有值都非常负（-1000）。验证在朴素版本失败的地方它给出了正确结果。

4. **对神经网络层做梯度检查。** 实现一个单一线性层 `y = Wx + b` 及其解析反向传播。使用 `numerical_gradient` 验证一个 3x2 权重矩阵的正确性。

5. **损失缩放实验。** 用 float16 模拟训练：创建范围在 [1e-9, 1e-3] 的随机梯度，转换为 float16，测量有多大比例变成了零。然后应用损失缩放（乘以 1024），转换为 float16，再缩放回来，再次测量为零的比例。

## 关键术语

| 术语 | 人们怎么说 | 它的真实含义 |
|------|----------------|----------------------|
| IEEE 754 | “浮点标准” | 定义二进制浮点格式、舍入规则与特殊值（inf、nan）的国际标准。每一颗现代 CPU 和 GPU 都实现了它。 |
| 机器 epsilon（Machine epsilon） | “精度极限” | 在给定浮点格式下，使得 1.0 + e != 1.0 成立的最小值 e。对 float32 而言约为 1.19e-7。 |
| 灾难性抵消（Catastrophic cancellation） | “减法导致的精度损失” | 当两个几乎相等的浮点数相减时，有效数字相互抵消，结果被舍入噪声主导。 |
| 上溢（Overflow） | “数太大了” | 结果超出最大可表示值，变成 inf。exp(89) 会使 float32 上溢。 |
| 下溢（Underflow） | “数太小了” | 结果比最小可表示正数还接近零，变成 0.0。exp(-104) 会使 float32 下溢。 |
| Log-sum-exp 技巧 | “先减去最大值” | 通过提取 exp(max(x)) 来计算 log(sum(exp(x)))，以防止上溢和下溢。用于 softmax、交叉熵和对数概率运算。 |
| 稳定 softmax（Stable softmax） | “不会炸的 softmax” | 在取指数前减去 max(logits)。结果在数值上完全相同，且不可能上溢。 |
| 梯度检查（Gradient checking） | “验证你的反向传播” | 将来自反向传播的解析梯度与来自有限差分的数值梯度进行比较，以捕捉实现 bug。 |
| 混合精度（Mixed precision） | “前向用 float16，反向用 float32” | 对速度关键的操作使用较低精度浮点，对数值敏感的操作使用较高精度浮点。典型加速为 2-3 倍。 |
| 损失缩放（Loss scaling） | “防止梯度下溢” | 在反向传播前将损失乘以一个大常数，使梯度保持在 float16 的可表示范围内，然后在权重更新前再除以同一个常数。 |
| bfloat16 | “脑浮点（Brain floating point）” | Google 的 16 位格式，有 8 位指数（与 float32 范围相同）和 7 位尾数（精度低于 float16）。训练时的首选。 |
| 梯度裁剪（Gradient clipping） | “给梯度范数封顶” | 缩放梯度向量使其范数不超过某个阈值。防止梯度爆炸毁掉权重。 |
| NaN | “非数（Not a Number）” | 来自未定义运算（0/0、inf-inf、sqrt(-1)）的特殊浮点值。会在之后所有算术中传播。 |
| Inf | “无穷（Infinity）” | 来自上溢或除以零的特殊浮点值。能组合产生 NaN（inf - inf、inf * 0）。 |
| 数值梯度（Numerical gradient） | “暴力求导” | 通过计算 f(x+h) 和 f(x-h) 再除以 2h 来近似导数。慢，但用于验证时可靠。 |

## 延伸阅读

- [每位计算机科学家都应了解的浮点运算知识（Goldberg 1991）](https://docs.oracle.com/cd/E19957-01/806-3568/ncg_goldberg.html) —— 权威参考，内容密集但完整
- [混合精度训练（Micikevicius 等人，2018）](https://arxiv.org/abs/1710.03740) —— NVIDIA 引入 float16 训练损失缩放的那篇论文
- [AMP：自动混合精度（PyTorch 文档）](https://pytorch.org/docs/stable/amp.html) —— PyTorch 中混合精度的实用指南
- [bfloat16 格式（Google Cloud TPU 文档）](https://cloud.google.com/tpu/docs/bfloat16) —— Google 为 TPU 选择该格式的原因
- [Kahan 求和（Wikipedia）](https://en.wikipedia.org/wiki/Kahan_summation_algorithm) —— 用于减少浮点求和舍入误差的算法
