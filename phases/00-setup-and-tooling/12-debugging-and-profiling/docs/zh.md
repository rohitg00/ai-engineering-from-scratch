# 调试与性能分析

> 最糟糕的 AI 错误不会崩溃。它们默默地在垃圾数据上训练，并报告一条漂亮的 loss 曲线。

**类型：** 构建
**语言：** Python
**前置条件：** 第 01 课（开发环境），基本的 PyTorch 熟悉度
**预计时间：** ~60 分钟

## 学习目标

- 使用条件 `breakpoint()` 和 `debug_print` 在训练过程中检查 tensor 形状、数据类型和 NaN 值
- 使用 `cProfile`、`line_profiler` 和 `tracemalloc` 对训练循环进行性能分析，找出瓶颈
- 检测常见的 AI 错误：形状不匹配、NaN loss、数据泄漏和 tensor 设备错误
- 设置 TensorBoard 以可视化 loss 曲线、权重直方图和梯度分布

## 问题

AI 代码的失败方式与常规代码不同。Web 应用崩溃时会有堆栈跟踪。而配置错误的训练循环运行 8 小时，烧掉 $200 的 GPU 时间，最终产生一个预测每个输入均值的模型。代码从未报错。错误是 tensor 在错误的设备上、忘记调用 `.detach()`、或者标签泄露到了特征中。

你需要能够捕获这些静默失败的调试工具，避免它们浪费你的时间和算力。

## 概念

AI 调试在三个层面上进行：

```mermaid
graph TD
    L3["3. 训练动态<br/>Loss 曲线、梯度范数、激活值"] --> L2
    L2["2. Tensor 操作<br/>形状、数据类型、设备、NaN/Inf 值"] --> L1
    L1["1. 标准 Python<br/>断点、日志、性能分析、内存"]
```

大多数人直接跳到第 3 层（盯着 TensorBoard）。但 80% 的 AI 错误位于第 1 层和第 2 层。

## 动手实践

### 第一部分：Print 调试（没错，它很管用）

Print 调试经常被忽视。但它不应该被忽视。对于 tensor 代码，有针对性的 print 语句比在调试器中逐步执行更好，因为你需要同时看到形状、数据类型和数值范围。

```python
def debug_print(name, tensor):
    print(f"{name}: shape={tensor.shape}, dtype={tensor.dtype}, "
          f"device={tensor.device}, "
          f"min={tensor.min().item():.4f}, max={tensor.max().item():.4f}, "
          f"mean={tensor.mean().item():.4f}, "
          f"has_nan={tensor.isnan().any().item()}")
```

在每个可疑操作后调用这个函数。找到错误后，删除这些 print。简单。

### 第二部分：Python 调试器（pdb 和 breakpoint）

内置调试器在 AI 工作中被低估了。在你的训练循环中放入 `breakpoint()`，交互式地检查 tensor。

```python
def training_step(model, batch, criterion, optimizer):
    inputs, labels = batch
    outputs = model(inputs)
    loss = criterion(outputs, labels)

    if loss.item() > 100 or torch.isnan(loss):
        breakpoint()

    loss.backward()
    optimizer.step()
```

当调试器进入时，有用的命令：

- `p outputs.shape` 检查形状
- `p loss.item()` 查看 loss 值
- `p torch.isnan(outputs).sum()` 统计 NaN 数量
- `p model.fc1.weight.grad` 检查梯度
- `c` 继续，`q` 退出

这是条件调试。你只在看起来有问题时才停下来。对于 10,000 步的训练运行，这很重要。

### 第三部分：Python 日志

当调试超出快速检查的范围时，用日志代替 print 语句。

```python
import logging

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler("training.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

logger.info("Starting training: lr=%.4f, batch_size=%d", lr, batch_size)
logger.warning("Loss spike detected: %.4f at step %d", loss.item(), step)
logger.error("NaN loss at step %d, stopping", step)
```

日志提供时间戳、严重级别和文件输出。当训练在凌晨 3 点失败时，你需要一个日志文件，而不是已经滚出屏幕的终端输出。

### 第四部分：计时代码段

了解时间花在哪里是优化的第一步。

```python
import time

class Timer:
    def __init__(self, name=""):
        self.name = name

    def __enter__(self):
        self.start = time.perf_counter()
        return self

    def __exit__(self, *args):
        elapsed = time.perf_counter() - self.start
        print(f"[{self.name}] {elapsed:.4f}s")

with Timer("data loading"):
    batch = next(dataloader_iter)

with Timer("forward pass"):
    outputs = model(batch)

with Timer("backward pass"):
    loss.backward()
```

常见发现：数据加载占用了 60% 的训练时间。解决方法是在 DataLoader 中设置 `num_workers > 0`，而不是换更快的 GPU。

### 第五部分：cProfile 和 line_profiler

当你需要比手动计时器更多的东西时：

```bash
python -m cProfile -s cumtime train.py
```

这显示每个函数调用按累积时间排序。对于逐行性能分析：

```bash
pip install line_profiler
```

```python
@profile
def train_step(model, data, target):
    output = model(data)
    loss = F.cross_entropy(output, target)
    loss.backward()
    return loss

# 运行：kernprof -l -v train.py
```

### 第六部分：内存性能分析

#### 使用 tracemalloc 分析 CPU 内存

```python
import tracemalloc

tracemalloc.start()

# 你的代码在这里
model = build_model()
data = load_dataset()

snapshot = tracemalloc.take_snapshot()
top_stats = snapshot.statistics("lineno")
for stat in top_stats[:10]:
    print(stat)
```

#### 使用 memory_profiler 分析 CPU 内存

```bash
pip install memory_profiler
```

```python
from memory_profiler import profile

@profile
def load_data():
    raw = read_csv("data.csv")       # 观察这里内存跳升
    processed = preprocess(raw)       # 和这里
    return processed
```

使用 `python -m memory_profiler your_script.py` 运行，查看逐行内存使用情况。

#### 使用 PyTorch 分析 GPU 内存

```python
import torch

if torch.cuda.is_available():
    print(torch.cuda.memory_summary())

    print(f"Allocated: {torch.cuda.memory_allocated() / 1e9:.2f} GB")
    print(f"Cached: {torch.cuda.memory_reserved() / 1e9:.2f} GB")
```

当你遇到 OOM（内存不足）时：

1. 减小 batch size（首先尝试这个，总是有效）
2. 使用 `torch.cuda.empty_cache()` 释放缓存内存
3. 使用 `del tensor` 后跟 `torch.cuda.empty_cache()` 处理大型中间变量
4. 使用混合精度（`torch.cuda.amp`）将内存使用减半
5. 对非常深的模型使用梯度检查点

### 第七部分：常见 AI 错误及捕获方法

#### 形状不匹配

最常见的错误。tensor 的形状是 `[batch, features]`，而模型期望的是 `[batch, channels, height, width]`。

```python
def check_shapes(model, sample_input):
    print(f"Input: {sample_input.shape}")
    hooks = []

    def make_hook(name):
        def hook(module, inp, out):
            in_shape = inp[0].shape if isinstance(inp, tuple) else inp.shape
            out_shape = out.shape if hasattr(out, "shape") else type(out)
            print(f"  {name}: {in_shape} -> {out_shape}")
        return hook

    for name, module in model.named_modules():
        hooks.append(module.register_forward_hook(make_hook(name)))

    with torch.no_grad():
        model(sample_input)

    for h in hooks:
        h.remove()
```

用一个样本 batch 运行一次。它会映射模型中每个形状变换。

#### NaN Loss

NaN loss 意味着某些东西爆炸了。常见原因：

- 学习率太高
- 自定义 loss 中的除零
- 对零或负数取对数
- RNN 中的梯度爆炸

```python
def detect_nan(model, loss, step):
    if torch.isnan(loss):
        print(f"NaN loss at step {step}")
        for name, param in model.named_parameters():
            if param.grad is not None:
                if torch.isnan(param.grad).any():
                    print(f"  NaN gradient in {name}")
                if torch.isinf(param.grad).any():
                    print(f"  Inf gradient in {name}")
        return True
    return False
```

#### 数据泄漏

你的模型在测试集上达到 99% 的准确率。听起来很棒。这是一个错误。

```python
def check_data_leakage(train_set, test_set, id_column="id"):
    train_ids = set(train_set[id_column].tolist())
    test_ids = set(test_set[id_column].tolist())
    overlap = train_ids & test_ids
    if overlap:
        print(f"DATA LEAKAGE: {len(overlap)} samples in both train and test")
        return True
    return False
```

还要检查时间泄漏：使用未来数据预测过去。在划分之前按时间戳排序。

#### 设备错误

tensor 在不同设备上（CPU vs GPU）会导致运行时错误。但有时 tensor 会在其他所有内容都在 GPU 上时默默地留在 CPU 上，训练只会运行得很慢。

```python
def check_devices(model, *tensors):
    model_device = next(model.parameters()).device
    print(f"Model device: {model_device}")
    for i, t in enumerate(tensors):
        if t.device != model_device:
            print(f"  WARNING: tensor {i} on {t.device}, model on {model_device}")
```

### 第八部分：TensorBoard 基础

TensorBoard 向你展示训练过程中随时间变化的情况。

```bash
pip install tensorboard
```

```python
from torch.utils.tensorboard import SummaryWriter

writer = SummaryWriter("runs/experiment_1")

for step in range(num_steps):
    loss = train_step(model, batch)

    writer.add_scalar("loss/train", loss.item(), step)
    writer.add_scalar("lr", optimizer.param_groups[0]["lr"], step)

    if step % 100 == 0:
        for name, param in model.named_parameters():
            writer.add_histogram(f"weights/{name}", param, step)
            if param.grad is not None:
                writer.add_histogram(f"grads/{name}", param.grad, step)

writer.close()
```

启动它：

```bash
tensorboard --logdir=runs
```

要注意什么：

- **Loss 没有下降**：学习率太低，或模型架构问题
- **Loss 剧烈振荡**：学习率太高
- **Loss 变为 NaN**：数值不稳定性（参见上面的 NaN 部分）
- **训练 loss 下降，验证 loss 上升**：过拟合
- **权重直方图收缩到零**：梯度消失
- **梯度直方图爆炸**：需要梯度裁剪

### 第九部分：VS Code 调试器

对于交互式调试，配置 VS Code 的 `launch.json`：

```json
{
    "version": "0.2.0",
    "configurations": [
        {
            "name": "Debug Training",
            "type": "debugpy",
            "request": "launch",
            "program": "${file}",
            "console": "integratedTerminal",
            "justMyCode": false
        }
    ]
}
```

通过单击 gutter 设置断点。使用变量面板检查 tensor 属性。调试控制台让你在运行过程中执行任意的 Python 表达式。

对于逐步执行数据预处理管道（你想查看每个转换步骤）很有用。

## 使用方式

以下是能捕获大多数 AI 错误的调试工作流：

1. **训练前**：用样本 batch 运行 `check_shapes`。验证输入和输出维度符合预期。
2. **前 10 步**：在 loss、输出和梯度上使用 `debug_print`。确认没有任何 NaN，且值在合理范围内。
3. **训练期间**：记录 loss、学习率和梯度范数。使用 TensorBoard 进行可视化。
4. **出问题时**：在失败点放入 `breakpoint()`。交互式地检查 tensor。
5. **性能方面**：对数据加载与前向/反向传播计时。如果接近 OOM 则分析内存。

## 交付物

运行调试工具包脚本：

```bash
python phases/00-setup-and-tooling/12-debugging-and-profiling/code/debug_tools.py
```

参见 `outputs/prompt-debug-ai-code.md` 获取帮助诊断 AI 特定错误的提示。

## 练习

1. 运行 `debug_tools.py` 并通读每个部分的输出。修改虚拟模型以引入 NaN（提示：在前向传播中除零），观察检测器捕获它。
2. 使用 `cProfile` 对训练循环进行性能分析，找出最慢的函数。
3. 使用 `tracemalloc` 找出数据加载管道中分配最多内存的行。
4. 为一个简单的训练运行设置 TensorBoard，判断模型是否过拟合。
5. 在训练循环中使用 `breakpoint()`。练习从调试器提示符检查 tensor 形状、设备和梯度值。
