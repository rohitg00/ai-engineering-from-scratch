# 数字稳定性

> 浮点是一个漏洞的抽象,它会在训练中咬你,你不会看到它.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 1, Lessons 01-04
**Time:** ~120 minutes

## 学习目标

- 通过最大减法技巧实现数值稳定的软max和日志总和-exp
- 在浮点计算中确定过度流量,低流量和灾难性取消
- 通过中心化有限差异对数值梯度进行分析梯度验证
- 解释为什么bfloat16是训练中偏好的,以及损失缩小如何防止梯度下流

## 问题

您的模型列车3小时,然后损失成为NaN.您添加了打印声明. 记录在9000步骤上是好的.在9001步骤上,它们是好的.`inf`通过9 002 步骤,每个梯度是`nan`训练已经结束了.

您的模型已经完成,但精度比纸质要求差了2%.您检查了一切. 建筑匹配. 超参数匹配. 数据匹配. 问题是纸质使用 float32 而您使用 float16 没有正确的扩展. 32 位积累的圆形错误食了您的精度.

它们可以在小的日志上运行. 当日志超过100时,它会返回.`inf`软max过了,因为`exp(100)`任何ML框架都用两行技巧来处理这个.你不知道这个技巧存在.

编号稳定不是一个理论问题.这是成功和沉默失败的训练运行之间的区别.你将对每一个严重的 ML 错误进行调试,最终会变成浮动点.

## 概念

### 电脑如何存储真数

计算机以IEEE 754标准的浮点值存储实数.浮点有三个部分:一个标志位,一个指数和一个 mantissa (含义和).

```
Float32 layout (32 bits total):
[1 sign] [8 exponent] [23 mantissa]

Value = (-1)^sign * 2^(exponent - 127) * 1.mantissa
```

分数决定了精度 (有多少个重要数字). 指数决定了范围 (一个数字可以多大或小).

```
Format     Bits   Exponent  Mantissa  Decimal digits  Range (approx)
float64    64     11        52        ~15-16          +/- 1.8e308
float32    32     8         23        ~7-8            +/- 3.4e38
float16    16     5         10        ~3-4            +/- 65,504
bfloat16   16     8         7         ~2-3            +/- 3.4e38
```

现在,我们可以看到一个数字的音,但它不能分辨出1.0000001和1.0000002,但它不能分辨出1.00000001和1.00000002.

光16给你大约3个数字. 它可以表示的最大数字是65,504. 这对于 ML来说是令人不安的小数,在那里,光,梯度和激活通常超过这个数量.

bfloat16是谷歌对 float16 的范围问题的答案.它与 float32 (相同的范围,高达3.4e38) 的8位指数相同,但只有7位 mantissa (比 float16更精确).对于训练神经网络,范围比精度更重要,因此 bfloat16 通常胜利.

### 为什么0.1加0.2!=0.3

在二进制浮点中,0.1号是不能完全表示的.在基数2中,它是重复的分数:

```
0.1 in binary = 0.0001100110011001100110011... (repeating forever)
```

浮32将其缩小到23位.存储值大约为0.100000001490116. 同样,0.2被存储为大约0.200000002980232.它们的总和是0.300000004470348,而不是0.3.

```
In Python:
>>> 0.1 + 0.2
0.30000000000000004

>>> 0.1 + 0.2 == 0.3
False
```

这对ML来说很重要,因为:

1. 损失比较`if loss < threshold`能给出错误的答案
2. 积累许多小值 (在数千步的渐进更新) 从真实数量中偏移
3. 如果比较浮动机与 `==`

解决方案:永远不要比较浮动机`==`使用`abs(a - b) < epsilon`或`math.isclose()`现在,我们要去.

### 灾难性的取消

当你减去两个几乎相同的浮点数, 显著数字取消,

```
a = 1.0000001    (stored as 1.00000011920929 in float32)
b = 1.0000000    (stored as 1.00000000000000 in float32)

True difference:  0.0000001
Computed:         0.00000011920929

Relative error: 19.2%
```

在ML中,这发生在你:

- 计算大平均数据的差异: $\mathbb{E}[x^2] - \mathbb{E}[x]^2$什么时候$\mathbb{E}[x]$是大
- 减去几乎相同的日志概率
- 用太小的石计算有限差异梯度

解决方案:重新安排公式以避免减小大,几乎相同的数量.为了变化,首先使用韦尔福德算法或中心数据.

### 过流和下流

过度流动发生在一个结果太大了不能表示时.过度流动发生在它太小了时 (接近零比最小可表示的正数).

```
Float32 boundaries:
  Maximum:  3.4028235e+38
  Minimum positive (normal): 1.175e-38
  Minimum positive (denorm): 1.401e-45
  Overflow:  anything > 3.4e38 becomes inf
  Underflow: anything < 1.4e-45 becomes 0.0
```

其他`exp()`在 ML 中,函数是溢出的主要来源:

```
exp(88.7)  = 3.40e+38   (barely fits in float32)
exp(89.0)  = inf         (overflow)
exp(-87.3) = 1.18e-38   (barely above underflow)
exp(-104)  = 0.0         (underflow to zero)
```

其他`log()`函数向另一个方向:

```
log(0.0)   = -inf
log(-1.0)  = nan
log(1e-45) = -103.3      (fine)
log(1e-46) = -inf        (input underflowed to 0, then log(0) = -inf)
```

在ML中,`exp()`在软max,sigmoid和概率计算中出现. `log()`它们的结合是通过跨,日志概率和KL分离.`log(exp(x))`没有正确的技巧.

### 记录和计量技巧

计算`log(sum(exp(x_i)))`直接的数值是危险的.`x_i`子的子`exp(x_i)`如果所有`x_i`它们都是非常负面的.`exp(x_i)`低流到零,`log(0)`是`-inf`现在,我们要去.

技巧是,在指数化之前,减去最大值.

```math
\log\left(\sum_i \exp(x_i)\right) = \max(x) + \log\left(\sum_i \exp(x_i - \max(x))\right)
```

为什么这有效:减去后`max(x)`它们的最大指数是`exp(0) = 1`总数至少是1个,所以总数至少是1个,`log(1) = 0`没有下流到`-inf`现在,我们可以.

证据:

```math
\begin{aligned}
& \log\left(\sum_i \exp(x_i)\right) \\
&= \log\left(\sum_i \exp(x_i - c + c)\right) && \text{(add and subtract } c\text{)} \\
&= \log\left(\sum_i \exp(x_i - c) \cdot \exp(c)\right) && (\exp(a+b) = \exp(a) \cdot \exp(b)) \\
&= \log\left(\exp(c) \cdot \sum_i \exp(x_i - c)\right) && \text{(factor out } \exp(c)\text{)} \\
&= c + \log\left(\sum_i \exp(x_i - c)\right) && (\log(a \cdot b) = \log(a) + \log(b))
\end{aligned}
```

设置`c = max(x)`并且消除了过剩.

这招在ML中出现了:
- 软max正常化
- 跨缩损失计算
- 在序列模型中记录概率总结
- 甘混合物
- 变化推断

### 为什么软max需要最大减法技巧

软max将 logits转换为概率:

```math
\mathop{\mathrm{softmax}}(x_i) = \frac{\exp(x_i)}{\sum_j \exp(x_j)}
```

如果没有这个技巧, [100, 101, 102] 的号会导致过:

```
exp(100) = 2.69e43
exp(101) = 7.31e43
exp(102) = 1.99e44
sum      = 2.99e44

2.69e43 > 3.4e38, the float32 maximum, so every term overflows.
exp(88.7) is already at the float32 limit.
exp(100) = inf in float32.
```

通过这个技巧,减去最大 ((x) = 102:

```
exp(100 - 102) = exp(-2) = 0.135
exp(101 - 102) = exp(-1) = 0.368
exp(102 - 102) = exp(0)  = 1.000
sum = 1.503

softmax = [0.090, 0.245, 0.665]
```

计算是安全的,这不是优化,这是准确的要求.

### 染病和疾病预防

`nan`没有数字`inf`通过计算传播病毒.`nan`在梯度更新中,重量增加了`nan`后续的输出`nan`训练在一个步骤内就死了.

如何?`inf`显示:
- `exp()`具有大正数
- 零分:`1.0 / 0.0`
- `float32`积累的溢出

如何?`nan`显示:
- `0.0 / 0.0`
- `inf - inf`
- `inf * 0`
- `sqrt()`负数的数量
- `log()`负数的数量
- 任何涉及现有数值的算法`nan`

检测:

```python
import math

math.isnan(x)       # True if x is nan
math.isinf(x)       # True if x is +inf or -inf
math.isfinite(x)    # True if x is neither nan nor inf
```

预防策略:

1. 入口到`exp()`其他`exp(clamp(x, -80, 80))`
2. 添加epsilon到分号码中: `x / (y + 1e-8)`
3. 加入内方的子`log()`其他`log(x + 1e-8)`
4. 使用稳定的实现 (log-sum-exp,稳定的软max)
5. 减速切割以防止重量爆炸
6. 查看`nan`现在,我们要去.`inf`在调试过程中每次前进通行之后

### 数字渐进检查

分析梯度 (从后延伸) 可能存在错误. 数字梯度检查通过计算有限差异的梯度来验证它们.

集中差异公式:

```math
\frac{df}{dx} \approx \frac{f(x + h) - f(x - h)}{2h}
```

这是$O(h^2)$它们的准确性远远高于前进差异.$(f(x+h) - f(x)) / h$这只是$O(h)$现在,我们要去.

选择$h$由于太小,太大,太差,太大,太大,太大,太大,太大,太大,太大,太大,太大,太大,太大,太大,太大,太大,太大,太大,太大,太大,太大,太大,太大,太大,太大,太大,太大,太大,太大,太大,太大,太大,太大,太大,太大,太大,太大,太大,太大,太大,太大,太大,太大,太大,太大,太大,太大,太大,太大,太大,太大,太大,太大,太大,太大,太大,太大,太大,太大,太大,太大,太大,太大,太大,太大,太大,太大,太大,太大,太大,太大,太大,太大,太大,太大,太大,太大,太大,太大,太大,太大,太大,太大,太大,太大,太大,太大,太多,太多,太多,太多,太多.`h = 1e-5`为了`1e-7`,这是典型的.

检查:计算分析和数值梯度之间的相对差异.

```math
\text{relative\_error} = \frac{\lvert \text{grad}_{\text{analytical}} - \text{grad}_{\text{numerical}} \rvert}{\max(\lvert \text{grad}_{\text{analytical}} \rvert, \lvert \text{grad}_{\text{numerical}} \rvert, 10^{-8})}
```

基本规则:
- 相对_错误 < 1e-7:完美,梯度正确
- relative_error < 1e-5:可接受,可能是正确的
- 相对_错误 > 1e-3:有什么不对
- relative_error > 1:梯度完全错误

总是检查梯度,当实现新的层或损失函数. PyTorch提供`torch.autograd.gradcheck()`为了这个.

### 混合精准训练

现代GPU具有专业硬件 (度芯) 计算float16矩阵乘法比float32快2-8倍.混合精度训练利用此:

```
1. Maintain float32 master copy of weights
2. Forward pass in float16 (fast)
3. Compute loss in float32 (prevents overflow)
4. Backward pass in float16 (fast)
5. Scale gradients to float32
6. Update float32 master weights
```

纯浮动16训练的问题:梯度通常非常小 (1e-8或更小).浮动16下流任何低于 ~ 6e-8到零.你的模型停止学习,因为所有梯度更新都是零.

解决方案是损失规模化:

```
1. Multiply loss by a large scale factor (e.g., 1024)
2. Backward pass computes gradients of (loss * 1024)
3. All gradients are 1024x larger (pushed above float16 underflow)
4. Divide gradients by 1024 before updating weights
5. Net effect: same update, but no underflow
```

动态损失扩展自动调整规模因子.从一个大值开始 (65536).如果梯度过量到`inf`减半一半.$N$步骤没有过度过来,加倍.

### 球16对球16:为什么球16赢得训练

```
float16:   [1 sign] [5 exponent]  [10 mantissa]
bfloat16:  [1 sign] [8 exponent]  [7 mantissa]
```

浮16具有更高精度 (10 mantissa bits vs 7) 但范围有限 (最高~65,504). bfloat16具有更少精度,但范围与 float32相同 (最高~3.4e38).

训练神经网络:

- 运动和位在训练时经常超过65,504.
- 损失规模化是需要的 float16 但通常是不必要的 bfloat16 因为其范围覆盖梯度大小谱.
- bfloat16是 float32的简单缩短:将 mantissa 的底部16位放下.

在线测试系统 (Float16) 对于测试系统 (Float16) 进行推断,而在线测试系统 (Float16) 则是最适合推断的,而在线测试系统 (Float16) 则是最适合测试系统 (Float16) 进行推断,而在线测试系统 (Float16) 则是最适合测试系统 (Float16) 进行推测,而在线测试系统 (Float16) 则是最适合测试系统 (Float16) 进行推测,而在线测试系统 (Float16) 则是最适合测试,而在线测试系统 (Float16) 则是最适合测试系统 (Float16) 进行推测.

### 渐进式剪切

爆炸梯度发生在梯度通过多层 (在RNN,深度网络和变压器中很常见) 呈指数增长时. 一个单一的大梯度可以在一个步骤中破坏所有重量.

剪切的两种类型:

**Clip by value:**独立住每个梯度元素.

```
grad = clamp(grad, -max_val, max_val)
```

简单,但可以改变梯度向量的方向.

**Clip by norm:**缩小整个梯度向量,使其标准不超过门.

```
if ||grad|| > max_norm:
    grad = grad * (max_norm / ||grad||)
```

保持梯度的方向.`torch.nn.utils.clip_grad_norm_()`现在,我们需要一个标准的选择.

典型值:`max_norm=1.0`对于变压器`max_norm=0.5`对于RL,`max_norm=5.0`对于更简单的网络.

梯剪除不是一个,而是一个安全机制.

### 规范化层作为数值稳定剂

批量正常化,层正常化和RMS正常化通常被表现为帮助训练融合的调节剂.

没有正常化,激活可以通过层次增长或缩小:

```
Layer 1: values in [0, 1]
Layer 5: values in [0, 100]
Layer 10: values in [0, 10,000]
Layer 50: values in [0, inf]
```

在每个层次的正常化更新和重新扩展激活:

```math
\mathop{\mathrm{LayerNorm}}(x) = \frac{x - \mathop{\mathrm{mean}}(x)}{\mathop{\mathrm{std}}(x) + \epsilon} \cdot \gamma + \beta
```

其他`epsilon`通过所有激活相同时,它可以防止零分.`gamma`其他`beta`让网络恢复任何需要的规模.

这使得整个网络的值保持在数值安全的范围内,防止前进通道的过剩和后退通道的梯度爆炸.

### 常见的ML数值错误

**Bug: Loss is NaN after a few epochs.**
原因:位变得太大,软max过剩,学习率过高,体重分离.
修复:使用稳定的软max (最大减法),降低学习速度,增加梯度剪切.

**Bug: Loss is stuck at log(num_classes).**
原因:模型输出几乎是均的概率. 通常意味着梯度消失或模型根本没有学习.
修复:检查数据标签是否正确,检查损失函数,检查已故的RELU.

**Bug: Validation accuracy is lower than expected by 1-3%.**
原因:不需要适当的损失扩展, 渐进的下流将默默地消除小更新.
修复:启用动态损失扩展,或切换到bfloat16.

**Bug: Gradient norms are 0.0 for some layers.**
原因:死于RLU神经元 (所有输入都是负),或浮16下流.
修复:使用LeakyReLU或GELU,使用梯度扩展,检查重量初始化.

**Bug: Model works on one GPU but gives different results on another.**
原因:非确定性浮点积累顺序.GPU平行减小在不同硬件上的不同顺序中总和,而浮点加算是不相关的.
解决问题:接受小差异 (1e-6),或设定`torch.use_deterministic_algorithms(True)`接受速度罚款.

**Bug: `exp()` returns `inf` in loss computation.**
原因:原材料被转移到`exp()`没有最大减法技巧.
修复:使用`torch.nn.functional.log_softmax()`内部实现了总数计算.

**Bug: Training diverges after switching from float32 to float16.**
原因: float16不能代表6e-8以下的梯度大小或超过65,504的激活.
修复:使用混合精度与损失扩展 (AMP) 或使用bfloat16代替.

```figure
logsumexp-stability
```

## 建立它

### 步骤1:展示浮点精度限制

```python
print("=== Floating Point Precision ===")
print(f"0.1 + 0.2 = {0.1 + 0.2}")
print(f"0.1 + 0.2 == 0.3? {0.1 + 0.2 == 0.3}")
print(f"Difference: {(0.1 + 0.2) - 0.3:.2e}")
```

### 步骤2: 实现简单与稳定的软max

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

### 步骤3:实现稳定的日志和总体exp

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

### 步骤4:实现稳定的交叉

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

### 步骤5: 渐进检查

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

## 用它

### 混合精密模拟

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

### 渐进式剪切

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

### 检测NAN/inf

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

看到`code/numerical.py`文件  文件 文件 文件 文件 文件 文件 文件 文件`code/numerical.ts`是一个具有相同的功能和演示的TypeScript端口.

## 运送它

这一课产生了:
- `code/numerical.py`具有稳定的软max,日志总和exp,交叉透,梯度检查和混合精度模拟
- `outputs/prompt-numerical-debugger.md`对于培训中诊断NAN/Inf和数值问题

在3期建立培训循环时,以及在4期实施注意力机制时,这些稳定实施再次出现.

## 运动

1. **Catastrophic cancellation.**通过简单公式计算[1000000.0, 1000001.0, 1000002.0]的差异$\mathbb{E}[x^2] - \mathbb{E}[x]^2$然后使用韦尔福德的在线算法计算它.

2. **Precision hunt.**找到最小的正值 float32 `x`这样.`1.0 + x == 1.0`这就是机器的epsilon. 检查它匹配.`numpy.finfo(numpy.float32).eps`现在,我们要去.

3. **Log-sum-exp edge cases.**测试你的`logsumexp_stable`函数: (a) 所有值均等, (b) 一个值比其余值大得多, (c) 所有值非常负 (-1000). 验证它在天真版本失败时能提供正确的结果.

4. **Gradient checking a neural network layer.**实现单一线性层`y = Wx + b`分析后退.`numerical_gradient`为了验证3x2重量矩阵的准确性.

5. **Loss scaling experiment.**模拟训练使用 float16:在范围 [1e-9, 1e-3] 中创建随机梯度,转换为 float16,并测量什么分数变为零.然后应用损失规模 (乘以1024),转换为 float16,重新扩展,再次测量零分数.

### 暗示

**Exercise 1.**转换三个值为`np.float32`在你把它们平衡之前,然后打电话`variance_naive`其他`welford_variance`接近一个值$10^{12}$在 float32 中,距离大于 1,所以预计天真结果远离0.6667和Welford结果接近.

**Exercise 2.**开始`x = np.float32(1.0)`减半一半,`np.float32(1.0) + x != np.float32(1.0)`按 float32 存储每个值,然后比较最后一个值,`numpy.finfo(numpy.float32).eps`现在,$2^{-23}$现在,我们要去.

**Exercise 3.**预测每一个答案.$n$平等的价值$c$结果是$c + \ln n$对于一个大值,结果接近于这个值.对于接近 -1000的值,结果接近$-1000 + \ln n$在`logsumexp_naive`收益`-inf`因为每个指数向下流到0.

**Exercise 4.**为了$y = Wx + b$没有人能得到$L$向的梯度$W$是上游梯度的外部产物,$x$缩损失的函数$W$打电话`numerical_gradient`通过两个结果`check_gradient`现在,我们要去.

**Exercise 5.**通过日志尺度进行测量`10 ** np.random.uniform(-9, -3, n)`转化为`np.float16`. Float16不能保持值在大约以下$6 \times 10^{-8}$预计在扩展之前,大约四分之一的值将变为零,

## 关键词

| Term | What people say | What it actually means |
|------|----------------|----------------------|
| IEEE 754 | "The float standard" | International standard defining binary floating point formats, rounding rules, and special values (inf, nan). Every modern CPU and GPU implements it. |
| Machine epsilon | "The precision limit" | The smallest value $e$ such that $1.0 + e \ne 1.0$ in a given float format. For float32, it is about 1.19e-7. |
| Catastrophic cancellation | "Precision loss from subtraction" | When subtracting nearly equal floating point numbers, significant digits cancel and rounding noise dominates the result. |
| Overflow | "Number too big" | A result exceeds the maximum representable value and becomes inf. exp(89) overflows float32. |
| Underflow | "Number too small" | A result is closer to zero than the smallest representable positive number and becomes 0.0. exp(-104) underflows float32. |
| Log-sum-exp trick | "Subtract the max first" | Computing $\log(\sum \exp(x))$ by factoring out $\exp(\max(x))$ to prevent overflow and underflow. Used in softmax, cross-entropy, and log-probability math. |
| Stable softmax | "Softmax that does not explode" | Subtracting $\max(\text{logits})$ before exponentiating. Numerically identical result, no overflow possible. |
| Gradient checking | "Verify your backprop" | Comparing analytical gradients from backpropagation against numerical gradients from finite differences to catch implementation bugs. |
| Mixed precision | "Float16 forward, float32 backward" | Using lower-precision floats for speed-critical operations and higher-precision floats for numerically sensitive operations. Typical speedup is 2-3x. |
| Loss scaling | "Prevent gradient underflow" | Multiplying the loss by a large constant before backprop so gradients stay in float16's representable range, then dividing by the same constant before weight updates. |
| bfloat16 | "Brain floating point" | Google's 16-bit format with 8 exponent bits (same range as float32) and 7 mantissa bits (less precision than float16). Preferred for training. |
| Gradient clipping | "Cap the gradient norm" | Scaling the gradient vector so its norm does not exceed a threshold. Prevents exploding gradients from ruining weights. |
| NaN | "Not a Number" | Special float value from undefined operations (0/0, inf-inf, sqrt(-1)). Propagates through all subsequent arithmetic. |
| Inf | "Infinity" | Special float value from overflow or division by zero. Can combine to produce NaN (inf - inf, inf * 0). |
| Numerical gradient | "Brute force derivative" | Approximating a derivative by evaluating $f(x+h)$ and $f(x-h)$ and dividing by $2h$. Slow but reliable for verification. |

## 进一步阅读

- [What Every Computer Scientist Should Know About Floating-Point Arithmetic (Goldberg 1991)](https://docs.oracle.com/cd/E19957-01/806-3568/ncg_goldberg.html)--最终的参考,密集但完整
- [Mixed Precision Training (Micikevicius et al., 2018)](https://arxiv.org/abs/1710.03740)对于"浮动16"训练的损失扩展,
- [AMP: Automatic Mixed Precision (PyTorch docs)](https://pytorch.org/docs/stable/amp.html)-- PyTorch中混合精度的实用指南
- [bfloat16 format (Google Cloud TPU docs)](https://cloud.google.com/tpu/docs/bfloat16)为什么谷歌选择了这个格式的TPU
- [Kahan Summation (Wikipedia)](https://en.wikipedia.org/wiki/Kahan_summation_algorithm)-- 减少浮点总数的圆形错误的算法
