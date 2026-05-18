# 数值稳定性

> 浮点是一个有漏洞的抽象。它会在训练期间咬你，而你不会看到它的到来。

** 类型：** 构建
** 语言：** Python
** 先决条件：** 第1阶段，课程01-04
** 时间：** ~120分钟

## 学习目标

- 使用最大减法技巧实现数字稳定的softmax和log-sum-BEP
- 识别浮点计算中的溢出、下溢和灾难性取消
- 使用中心有限差对照数字梯度验证分析梯度
- 解释为什么bfloat 16比float 16更适合训练，以及损失缩放如何防止梯度下溢

## 问题

你的模型训练三个小时，然后损失就变成了NaN。您添加打印声明。Logits在第9，000步时状态良好。在步骤9，001，它们是“inf”。到第9，002步，每个梯度都是“nan”，并且训练结束。

或者：您的模型训练完成，但准确性比论文声称的差2%。你检查一切。建筑匹配。超参数匹配。数据匹配。问题是论文使用了float 32，而您使用了float 16，但没有正确的缩放。三十二位累积的四舍五入误差悄悄地侵蚀了您的准确性。

或者：您从头开始实现交叉熵损失。它适用于小型Logits。当logits超过100时，它返回“inf”。softmax溢出，因为“BEP（100）”大于float 32可以表示的。每个ML框架都用两行技巧来处理这个问题。你不知道这个技巧的存在。

数字稳定性不是一个理论问题。这是成功的训练跑和默默失败的训练跑之间的区别。您要调试的每个严重ML错误最终都会归结为浮点。

## 概念

### IEEE 754：计算机如何存储真实数字

计算机按照IEEE 754标准将真实数字存储为浮点值。浮点数有三个部分：符号位、指数和尾数（有效数）。

```
Float32 layout (32 bits total):
[1 sign] [8 exponent] [23 mantissa]

Value = (-1)^sign * 2^(exponent - 127) * 1.mantissa
```

尾数决定精度（有多少位有效数字）。指数决定范围（数字可以有多大或小）。

```
Format     Bits   Exponent  Mantissa  Decimal digits  Range (approx)
float64    64     11        52        ~15-16          +/- 1.8e308
float32    32     8         23        ~7-8            +/- 3.4e38
float16    16     5         10        ~3-4            +/- 65,504
bfloat16   16     8         7         ~2-3            +/- 3.4e38
```

float 32为您提供大约7个小数位的精确度。这意味着它可以区分1.0000001和1.00000002，但不能区分1.00000001和1.000000002。7位数之后，一切都是舍入噪音。

float 16为您提供大约3位数字。它能代表的最大数字是65，504。对于ML来说，这一比例小得令人不安，因为ML的逻辑、梯度和激活通常超过这一比例。

bfloat 16是Google对float 16范围问题的解答。它与float 32具有相同的8位指数（范围相同，最高可达3.4e38），但只有7个后缀位（精度低于float 16）。对于训练神经网络来说，范围比精度更重要，因此bfloat 16通常会获胜。

### 为什么0.1 + 0.2！= 0.3

数字0.1不能用二进制浮点精确表示。在2进制中，它是一个重复的分数：

```
0.1 in binary = 0.0001100110011001100110011... (repeating forever)
```

Float 32将其截断为23位螳螂。存储的值约为0.10000001490116。同样，0.2存储为大约0.20000002980232。它们的总和是0.30000004470348，而不是0.3。

```
In Python:
>>> 0.1 + 0.2
0.30000000000000004

>>> 0.1 + 0.2 == 0.3
False
```

这对ML很重要，因为：

1. “如果损失<阈值”等损失比较可能会给出错误的答案
2. 积累许多小值（经过数千步的梯度更新）会偏离真实总和
3. 如果将浮动与'=='进行比较，检验和再现性测试将失败

修复方法：永远不要将浮点数与'=='进行比较。使用' abs（a-b）'或' math.isclose（）'。

### 大变动抵消

当您减去两个几乎相等的浮点数时，有效数字会消失，并且留下提升为前置数字的舍入噪音。

```
a = 1.0000001    (stored as 1.00000011920929 in float32)
b = 1.0000000    (stored as 1.00000000000000 in float32)

True difference:  0.0000001
Computed:         0.00000011920929

Relative error: 19.2%
```

这是一次减法的19%相对误差。在ML中，每当您：

- 计算具有较大均值的数据的方差：当E[x]较大时，`E[x^2] - E[x]^2`
- 减去几乎相等的log概率
- 使用太小的时间表计算有限差梯度

解决办法：重新排列公式，以避免减去大的、几乎相等的数字。对于方差，请使用Welford算法或首先对数据进行中心化。对于log概率，始终在log空间中工作。

### 上溢和下溢

当结果太大而无法表示时，就会发生溢出。当它太小（比最小的可表示的正值更接近零）时，就会发生下溢。

```
Float32 boundaries:
  Maximum:  3.4028235e+38
  Minimum positive (normal): 1.175e-38
  Minimum positive (denorm): 1.401e-45
  Overflow:  anything > 3.4e38 becomes inf
  Underflow: anything < 1.4e-45 becomes 0.0
```

' opp（）'函数是ML中溢出的主要来源：

```
exp(88.7)  = 3.40e+38   (barely fits in float32)
exp(89.0)  = inf         (overflow)
exp(-87.3) = 1.18e-38   (barely above underflow)
exp(-104)  = 0.0         (underflow to zero)
```

' log（）'函数指向另一个方向：

```
log(0.0)   = -inf
log(-1.0)  = nan
log(1e-45) = -103.3      (fine)
log(1e-46) = -inf        (input underflowed to 0, then log(0) = -inf)
```

在ML中，“BEP（）”出现在softmax、sigmoid和概率计算中。' log（）'出现在交叉熵、log似然性和KL分歧中。组合“log（BEP（x））”是一个没有正确技巧的雷区。

### 对数和经验技巧

直接计算“log（sum（BEP（x_i）”在数字上是危险的。如果任何“x_i”较大，则“BEP（x_i）”溢出。如果所有“x_i”都非常负，则每个“BEP（x_i）”下溢为零，并且“log（0）”是“-inf”。

技巧：在取指数之前减去最大值。

```
log(sum(exp(x_i))) = max(x) + log(sum(exp(x_i - max(x))))
```

为什么这样做：减去“max（x）”后，最大指数是“BEP（0）= 1”。不可能溢出。和中至少有一项是1，因此和至少是1，并且“log（1）= 0”。不可能下流到“-inf”。

证据：

```
log(sum(exp(x_i)))
= log(sum(exp(x_i - c + c)))                    (add and subtract c)
= log(sum(exp(x_i - c) * exp(c)))               (exp(a+b) = exp(a)*exp(b))
= log(exp(c) * sum(exp(x_i - c)))               (factor out exp(c))
= c + log(sum(exp(x_i - c)))                    (log(a*b) = log(a) + log(b))
```

设置“c = max（x）”并消除溢出。

这个技巧在ML中随处可见：
- Softmax规范化
- 交叉熵损失计算
- 序列模型中的log概率总和
- 高斯混合体
- 变分推理

### 为什么Softmax需要最大减法技巧

Softmax将逻辑转换为概率：

```
softmax(x_i) = exp(x_i) / sum(exp(x_j))
```

如果没有这个技巧，[100，101，102]的logits会导致溢出：

```
exp(100) = 2.69e43
exp(101) = 7.31e43
exp(102) = 1.99e44
sum      = 2.99e44

These overflow float32 (max ~3.4e38)? No, 2.69e43 < 3.4e38? Actually:
exp(88.7) is already at the float32 limit.
exp(100) = inf in float32.
```

使用技巧，减去max（x）= 102：

```
exp(100 - 102) = exp(-2) = 0.135
exp(101 - 102) = exp(-1) = 0.368
exp(102 - 102) = exp(0)  = 1.000
sum = 1.503

softmax = [0.090, 0.245, 0.665]
```

概率是相同的。计算安全。这不是优化。这是正确性的要求。

### NaN和Inf：检测和预防

“nan”（不是数字）和“inf”（无限）通过计算病毒式传播。梯度更新中的一个“nan”构成权重“nan”，这使得每个后续输出都成为“nan”。训练一步之遥。

“inf”的出现方式：
- 大正值的& BEP（）'
- 除以零：`1.0 / 0.0`
- ' float 32 '堆积物溢出

“南”的样子：
- “0.0 / 0.0”
- “inf - inf”
- ' inf * 0 '
- 负值的' SQRT（）'
- 负值的“log（）”
- 任何涉及现有“nan”的算术

检测：

```python
import math

math.isnan(x)       # True if x is nan
math.isinf(x)       # True if x is +inf or -inf
math.isfinite(x)    # True if x is neither nan nor inf
```

预防战略：

1. 钳位输入到'：' BEP（clamp（x，-80，80））'
2. 将计数器添加到计数器：`x /（y +1 e-8）`
3. 在“log（）”内添加收件箱：“log（x +1 e-8）”
4. 使用稳定实现（log-sum-BEP、稳定softmax）
5. 梯度剪裁以防止重量爆炸
6. 调试期间每次向前传递后检查“nan”/“inf”

### 数字梯度检查

分析梯度（来自反向传播）可能存在错误。数字梯度检查通过计算有限差的梯度来验证它们。

中心差公式：

```
df/dx ~= (f(x + h) - f(x - h)) / (2h)
```

这是O（h2）的准确性，比正向差“（f（x+h）- f（x）/ h”好得多，后者仅为O（h）。

选择h：太大，近似值错误。太小和灾难性的取消破坏了答案。h = 1 e-5 ~ 1 e-7是典型的。

检查：计算分析梯度和数字梯度之间的相对差。

```
relative_error = |grad_analytical - grad_numerical| / max(|grad_analytical|, |grad_numerical|, 1e-8)
```

经验法则：
- relative_oss <1 e-7：完美，梯度正确
- relative_错误<1 e-5：可接受，可能正确
- relative_错误> 1 e-3：有些问题
- relative_oss> 1：梯度完全错误

实现新层或损失函数时始终检查梯度。PyTorch为此提供了“torch.autograd.gradcheck（）”。

### 混合精准训练

现代图形处理器具有专门的硬件（张量核心），可以计算float 16矩阵相乘的速度比float 32快2- 8倍。混合精确训练利用了这一点：

```
1. Maintain float32 master copy of weights
2. Forward pass in float16 (fast)
3. Compute loss in float32 (prevents overflow)
4. Backward pass in float16 (fast)
5. Scale gradients to float32
6. Update float32 master weights
```

纯float 16训练的问题：梯度通常非常小（1 e-8或更小）。Float 16向下溢出~ 6 e-8以下的任何值至零。您的模型停止学习，因为所有梯度更新都为零。

解决方案是损失缩放：

```
1. Multiply loss by a large scale factor (e.g., 1024)
2. Backward pass computes gradients of (loss * 1024)
3. All gradients are 1024x larger (pushed above float16 underflow)
4. Divide gradients by 1024 before updating weights
5. Net effect: same update, but no underflow
```

动态损失缩放自动调整缩放因子。从一个较大的值（65536）开始。如果梯度溢出到“inf”，则将其减半。如果经过N个步骤而没有溢出，则将其加倍。

### bfloat 16 vs float 16：为什么bfloat 16在训练中获胜

```
float16:   [1 sign] [5 exponent]  [10 mantissa]
bfloat16:  [1 sign] [8 exponent]  [7 mantissa]
```

float 16具有更高的精确度（10个后缀位vs 7），但范围有限（最大~ 65，504）。bfloat 16的精度较低，但范围与float 32相同（最大~3.4e38）。

对于训练神经网络：

- 在训练高峰期间，激活和日志经常超过65，504。float 16溢出; bfloat 16处理它。
- float 16需要进行损失缩放，但bfloat 16通常不需要进行损失缩放，因为其范围涵盖了梯度幅度谱。
- bfloat 16是float 32的简单截断：删除尾数的底部16位。转换在指数中是微不足道且无损的。

float 16最适合值有界且精度更重要的推理。bfloat 16最适合射程更重要的训练。这就是pu和现代NVIDIA图形处理器（A100、H100）具有原生bfloat 16支持的原因。

### 渐变剪辑

当梯度在许多层中呈指数级增长时（常见于RNN、深度网络和转换器），就会发生梯度爆炸。单个大梯度可能会一步损坏所有权重。

两种类型的剪辑：

** 按值剪辑：** 独立剪辑每个梯度元素。

```
grad = clamp(grad, -max_val, max_val)
```

很简单，但可以改变梯度载体的方向。

** 按规范剪辑：** 缩放整个梯度载体，使其规范不超过阈值。

```
if ||grad|| > max_norm:
    grad = grad * (max_norm / ||grad||)
```

保留梯度的方向。这就是“torch.nn.utils.clip_grad_norm_（）”的作用。这是标准选择。

典型值：对于变压器，“max_norm=1.0”，对于RL，“max_norm=0.5”，对于更简单的网络，“max_norm=5.0”。

渐变剪辑不是一个技巧。这是一种安全机制。如果没有它，单个异常值批次可能会产生足够大的梯度，从而破坏数周的训练。

### 作为数值稳定器的正规化层

批规格化、层规格化和RMS规格化通常作为帮助训练收敛的规则器来呈现。它们也是数字稳定器。

如果没有规范化，激活可能会在各个层中呈指数级增长或缩小：

```
Layer 1: values in [0, 1]
Layer 5: values in [0, 100]
Layer 10: values in [0, 10,000]
Layer 50: values in [0, inf]
```

标准化重新集中和重新缩放每个层的激活：

```
LayerNorm(x) = (x - mean(x)) / (std(x) + epsilon) * gamma + beta
```

当所有激活相同时，“”（通常为1 e-5）防止被零除。学习到的参数“gamma”和“Beta”允许网络恢复其所需的任何规模。

这将整个网络中的值保持在数字安全范围内，防止正向传递中的溢出和反向传递中的梯度爆炸。

### 常见ML数值错误

** 错误：几个时代后损失是NaN。**
原因：日志变得太大，softmax溢出。或者学习率太高，权重出现分歧。
修复：使用稳定的softmax（最大减法），降低学习率，添加梯度剪裁。

** 错误：丢失卡在log（num_classes）上。**
原因：模型输出的概率接近均匀。通常意味着梯度正在消失或模型根本不学习。
修复：检查数据标签是否正确，验证丢失功能，检查是否有死亡的ReLU。

** 错误：验证准确性比预期低1- 3%。**
原因：混合精度，没有适当的损失缩放。梯度下溢默默地将小更新归零。
修复：启用动态损失缩放，或切换到bfloat 16。

** 错误：某些层的梯度规范为0.0。**
原因：ReLU神经元死亡（所有输入均为负），或float 16下溢。
修复：使用LeakyReLU或GELU，使用梯度缩放，检查权重初始化。

** 错误：模型在一个图形处理器上工作，但在另一个图形处理器上给出不同的结果。**
原因：不确定的浮点累积顺序。不同的硬件上，图形处理器并行约简数的总和不同，并且浮点加法是不关联的。
修复：接受微小差异（1 e-6），或设置“torch.use_datashealthine_althine（True）”并接受速度惩罚。

** 错误：& BEP（）&在损失计算中返回& inf &。**
原因：原始logits传递给'，没有使用最大减法技巧。
修复：使用“torch.nn.functional.log_softmax（）”，它在内部实现log-sum-BEP。

** 错误：从float 32切换到float 16后，训练出现分歧。**
原因：float 16无法表示低于6 e-8的梯度幅度或高于65，504的激活。
修复：使用混合精度和损失缩放（MP），或者使用bfloat 16。

## 建设党

### 第1步：演示浮点精度限制

```python
print("=== Floating Point Precision ===")
print(f"0.1 + 0.2 = {0.1 + 0.2}")
print(f"0.1 + 0.2 == 0.3? {0.1 + 0.2 == 0.3}")
print(f"Difference: {(0.1 + 0.2) - 0.3:.2e}")
```

### 第2步：实施初始与稳定softmax

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

### 第3步：实现稳定的log-sum-BEP

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

### 第4步：实现稳定的交叉信息

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

### 第五步：梯度检查

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

## 使用它

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

### 渐变剪裁

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

### NaN/Inf检测

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

请参阅“code/numerical.py”以了解演示的所有边缘案例的完整实施。

## 把它运

本课产生：
- ' code/numerical.py '具有稳定的softmax、log-sum-BEP、交叉-entropy、梯度检查和混合精度模拟
- '输出/prompt-numerical-debugger.md '用于诊断NaN/Inf和培训中的数字问题

这些稳定的实现在构建训练循环时在第3阶段重新出现，在实施注意力机制时在第4阶段重新出现。

## 演习

1. ** 灾难性的取消。**使用float 32中的朴素公式“E[x#2] - E[x]'计算[10000000.0，1000001.0，100002.0]的方差。然后使用韦尔福德的在线算法计算它。将误差与真实方差（0.6667）进行比较。

2. ** 精确狩猎。**在Python中找到最小的正float 32值“x”，使得“1.0 + x == 1.0”。这是机器。验证它与“numpy.finfo（numpy.float32）.eps”匹配。

3. **Log-sum-Exp边缘情况。**测试您的“logsump_stable”函数：（a）所有值都相等，（b）一个值比其余值大得多，（c）所有值都非常负（-1000）。验证它在原始版本失败的情况下提供正确的结果。

4. ** 梯度检查神经网络层。**实现单个线性层“y = Wx + b”及其分析反向传递。使用“numeric_gradient”来验证3x 2权重矩阵的正确性。

5. ** 损失定标实验。**使用float 16模拟训练：在[1 e-9，1 e-3]范围内创建随机梯度，转换为float 16，并测量哪些分数变为零。然后应用loss scaling（乘以1024），转换为float 16，回缩，并再次测量零分数。

## 关键术语

| Term | 别人怎么说 | 它实际上意味着什么 |
|------|----------------|----------------------|
| IEEE 754 | “浮动标准” | 定义二进制浮点格式、舍入规则和特殊值（inf、nan）的国际标准。每个现代的中央处理器和图形处理器都实现了它。 |
| 机器收件箱 | “精度极限” | 最小值e，使1.0 + e！= 1.0以给定的浮动格式。对于float 32来说，大约是1.19e-7。 |
| 大变动抵消 | “减法的精确损失” | 当减去几乎相等的浮点数时，有效数字会抵消，并且舍入噪音主导结果。 |
| 溢流 | “数量太大” | 结果超过了最大可表示值并成为inf。BEP（89）溢出float 32。 |
| 下溢 | “数量太小” | 结果比最小的可代表正值更接近零并成为0.0。BEP（-104）下溢浮动32. |
| 对数和经验技巧 | “先减去最大值” | 通过分解BEP（max（x））来计算日志（sum（sup（x）以防止上溢和下溢。用于softmax、交叉熵和log概率数学。 |
| 稳定的softmax | “不会爆炸的Softmax” | 在取指数之前减去最大值（logits）。结果数字相同，不可能溢出。 |
| 梯度检查 | “验证您的背道具” | 比较来自反向传播的分析梯度与来自有限差异的数字梯度以发现实现错误。 |
| 混合精度 | “向前漂浮16，向后漂浮32” | 使用较低精度的浮动来进行速度严格的操作，使用较高精度的浮动来进行数字敏感的操作。典型的加速是2- 3倍。 |
| 损失缩放 | “防止梯度下溢” | 在反推之前将损失乘以一个大的常数，以便梯度保持在float 16的可表示范围内，然后在权重更新之前除以同一个常数。 |
| bfloat 16 | “脑浮动点” | Google的16位格式，有8个指数位（与float 32的范围相同）和7个尾数位（精度低于float 16）。首选培训。 |
| 渐变剪裁 | “限制梯度规范” | 缩放梯度载体，使其规范不超过阈值。防止爆炸的梯度破坏重量。 |
| 楠 | “不是一个数字” | 来自未定义操作（0/0，inf-inf，SQRT（-1））的特殊浮点值。简化所有后续算术。 |
| INF | “无限” | 溢出或除零的特殊浮动值。可以组合产生NaN（inf - inf，inf * 0）。 |
| 数字梯度 | “暴力衍生品” | 通过计算f（x+h）和f（x-h）并除以2 h来逼近衍生物。验证缓慢但可靠。 |

## 进一步阅读

- [What每个计算机科学家都应该了解浮点算术（Goldberg 1991）]（https：//docs.oracle.com/cd/E19957-01/806-3568/ncg_goldberg.html）--权威参考，密集但完整
- [混合精确训练（Micikevicius等人，2018）]（https：//arxiv.org/ab/1710.03740）--为float 16培训引入损失缩放的NVIDIA论文
- [AMP：自动混合精度（PyTorch docs）]（https：//pytorch.org/docs/stable/amp.html）--PyTorch中混合精度的实用指南
- [bfloat 16格式（Google Cloud pu docs）]（https：//cloud.google.com/tpu/docs/bfloat16）--为什么Google选择这种格式用于pu
- [Kahan Summation（维基百科）]（https：//en.wikipedia.org/wiki/Kahan_summation_almation）--减少浮点和中舍入误差的算法
