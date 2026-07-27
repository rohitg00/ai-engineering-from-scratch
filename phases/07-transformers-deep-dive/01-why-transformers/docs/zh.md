# Why Transformers — RNN 的问题

> RNN 一次处理一个 token。Transformer 一次性处理所有 token。这一架构赌注改变了 2017 年后深度学习的每一条扩展曲线。

**Type:** Learn
**Languages:** Python
**Prerequisites:** Phase 3 (Deep Learning Core), Phase 5 · 09 (Sequence-to-Sequence), Phase 5 · 10 (Attention Mechanism)
**Time:** ~45 分钟

## 问题

2017 年之前，地球上每一个最先进的序列模型——语言、翻译、语音——都是循环神经网络。LSTM 和 GRU 在长达五年的时间里统治了等同于 ImageNet 级别的翻译基准。它们是当时唯一可用的工具。

它们有三个致命弱点。序列计算意味着你无法沿着时间轴并行化：token `t+1` 需要来自 token `t` 的隐藏状态。一个 1,024 token 的序列意味着在一个每周期可执行 1,000,000 次浮点运算的 GPU 上需要 1,024 个串行步骤。在专为并行设计的硬件上，训练墙钟时间随序列长度线性增长。

梯度消失意味着 50 个 token 前的信息已经经过 50 次非线性压缩。门控循环单元（LSTM、GRU）缓解了这一问题，但从未消除。长距离依赖——"我去年夏天在去京都的飞机上读的那本书是……"——常常失败。

固定宽度的隐藏状态意味着编码器在解码器看到任何内容之前，将整个源序列压缩到一个单一的向量中。无论源序列是 5 个 token 还是 500 个，瓶颈的形状都一样。

2017 年的论文 "Attention Is All You Need" 提出了一种激进的做法：完全抛弃循环。让每个位置并行地关注所有其他位置。用一个大的矩阵乘法训练，而不是 1,024 个顺序操作。

截至 2026 年，这一结果主导了所有模态。语言（GPT-5、Claude 4、Llama 4）、视觉（ViT、DINOv2、SAM 3）、音频（Whisper）、生物学（AlphaFold 3）、机器人（RT-2）。相同的模块，不同的输入。

## 概念

![RNN 顺序计算 vs Transformer 并行注意力](../assets/rnn-vs-transformer.svg)

**循环作为瓶颈。** RNN 计算 `h_t = f(h_{t-1}, x_t)`。每一步都依赖前一步。你无法在 `h_4` 之前计算 `h_5`。在拥有 10,000+ 个并行核心的现代 GPU 上，长序列浪费了 99% 的芯片资源。

**注意力作为广播。** Self-attention 同时为每一对 `(i, j)` 计算 `output_i = sum_j(a_ij * v_j)`。整个 N×N 注意力矩阵在一次批处理矩阵乘法中填充。没有步骤依赖另一个步骤。GPU 喜欢它。

**加速不是常数。** 这是 `O(N)` 串行深度和 `O(1)` 串行深度之间的差异。在实践中，在 N=512 且硬件匹配的情况下，transformer 每 epoch 训练速度快 5–10 倍，差距随序列长度扩大，直到触及注意力的 `O(N²)` 内存墙（后来 Flash Attention 解决了这个问题——见第 12 课）。

**Transformer 的代价。** 注意力内存扩展为 `O(N²)`。对于 2K 上下文，没问题。对于 128K 上下文，你需要 sliding window、RoPE 外推、Flash Attention 分块或线性注意力变体。循环在时间和内存上都是 `O(N)`；transformer 用时间换内存，然后通过并行性赢回时间。

**归纳偏置的转变。** RNN 假设局部性和近因性。Transformer 不假设任何东西——每一对都是注意力的候选。这就是为什么 transformer 需要更多数据才能训练好，但一旦有了数据就能扩展得更远。Chinchilla（2022）形式化了这一点：给定足够的 token，同等参数量的 transformer 总是优于 RNN。

## 动手构建

这里没有神经网络——我们用数值方式模拟核心瓶颈，让你在笔记本上感受差距。

### 步骤 1：测量串行深度

参见 `code/main.py`。我们构建了两个函数。一个将序列编码为加法链（串行，类似 RNN）。另一个将其编码为并行归约（广播，类似注意力）。相同的数学运算，不同的依赖图。

```python
def rnn_style(xs):
    h = 0.0
    for x in xs:
        h = 0.9 * h + x   # can't parallelize: h depends on previous h
    return h

def attention_style(xs):
    return sum(xs) / len(xs)  # every x is independent
```

我们对长达 100,000 个元素的序列进行计时。RNN 版本是 O(N) 并且在单 CPU 流水线上运行。即使在纯 Python 中，attention 风格的归约在长度 ≥ 1,000 时也能击败它，因为 Python 的 `sum()` 是用 C 实现的，且每次迭代没有解释器开销。

### 步骤 2：计数理论操作

两个算法都做 N 次加法。区别在于*依赖深度*：在下一步开始之前必须顺序执行多少操作。RNN 深度 = N。Attention 深度 = 使用树归约为 log(N)，使用并行扫描为 1。决定 GPU 时间的是深度，而不是操作数。

### 步骤 3：长序列的经验扩展

我们打印一个时序表，使 O(N) 差距可见。在一台 2026 年的 Mac 笔记本上，1,000 个元素以下的序列快得无法测量。100,000 的序列显示出清晰的线性扫描。将其扩展到一个 16,384 token 的 transformer，使用 12 层等效 LSTM，你就会明白为什么 2016 年训练墙钟时间是一个瓶颈。

## 实际应用

2026 年何时仍然选择 RNN：

| 场景 | 选择 |
|-----------|------|
| 流式推理，一次一个 token，恒定内存 | RNN 或状态空间模型（Mamba, RWKV） |
| 非常长的序列（>1M token），注意力内存爆炸 | Linear attention, Mamba 2, Hyena |
| 没有 matmul 加速器的边缘设备 | Depthwise-separable RNN 在 FLOPs/watt 上仍占优 |
| 其他所有情况（训练、批推理、上下文 ≤ 128K） | Transformer |

像 Mamba 这样的状态空间模型（SSM）本质上是具有结构化参数化的 RNN，兼具两者优点：`O(N)` 扫描内存，通过选择性扫描实现并行训练。它们以更好的长上下文扩展恢复了 transformer 90% 的质量。到 2026 年，大多数前沿实验室训练混合 SSM+transformer 模型（如 Jamba、Samba）——循环并未消亡，它只是一个组件。

## 交付

参见 `outputs/skill-architecture-picker.md`。该 skill 根据序列长度、吞吐量和训练预算约束，为新的序列问题选择架构。对于超过 1B token 的训练运行，它应始终拒绝推荐纯 RNN，除非说明权衡。

## 练习

1. **简单。** 从 `code/main.py` 中取出 `rnn_style`，将标量隐藏状态替换为长度为 64 的向量隐藏状态。重新测量。串行开销随隐藏状态维度增长多少？
2. **中等。** 用纯 Python 实现并行前缀和（Hillis-Steele scan）。验证它在长度为 1024 时产生与串行扫描相同的数值输出。计算深度。
3. **困难。** 将 attention 风格的归约移植到 GPU 上的 PyTorch。在序列长度从 64 到 65,536 的范围内对两者计时。绘制并解释曲线形状。

## 关键术语

| 术语 | 人们说的 | 实际含义 |
|------|-----------------|-----------------------|
| Recurrence | "RNN 是顺序的" | 步骤 `t` 依赖步骤 `t-1` 的计算，迫使沿时间轴串行执行。 |
| Serial depth | "图有多深" | 最长依赖操作链；即使在无限硬件上也限制墙钟时间。 |
| Attention | "让 token 互相看" | 加权和 `sum_j a_ij v_j`，其中 `a_ij` 来自位置 i 和 j 之间的相似度得分。 |
| Context window | "模型能看多远" | 注意力层可以接受的输入位置数；二次内存开销在此扩展。 |
| Inductive bias | "架构内置的假设" | 关于数据样貌的先验知识；CNN 假设平移不变性，RNN 假设近因性。 |
| State-space model | "有代数的 RNN" | 通过结构化状态空间矩阵参数化以实现并行训练的循环。 |
| Quadratic bottleneck | "为什么上下文这么贵" | 注意力内存 = `O(N²)` 序列长度；Flash Attention 隐藏了常数，而非扩展性。 |

## 延伸阅读

- [Vaswani et al. (2017). Attention Is All You Need](https://arxiv.org/abs/1706.03762) — 终结主流 NLP 中循环的论文。
- [Bahdanau, Cho, Bengio (2014). Neural MT by Jointly Learning to Align and Translate](https://arxiv.org/abs/1409.0473) — 注意力诞生之地，附着在 RNN 上。
- [Hochreiter, Schmidhuber (1997). Long Short-Term Memory](https://www.bioinf.jku.at/publications/older/2604.pdf) — 原始 LSTM 论文。
- [Gu, Dao (2023). Mamba: Linear-Time Sequence Modeling with Selective State Spaces](https://arxiv.org/abs/2312.00752) — 现代应对 transformer 的循环答案。
