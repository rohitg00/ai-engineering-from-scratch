# 为什么选择 Transformer —— RNN 的问题

> RNN 逐个处理 token。Transformer 一次性处理所有 token。这一个架构层面的赌注改变了 2017 年之后深度学习中所有的扩展曲线。

**Type:** Learn
**Languages:** Python
**Prerequisites:** Phase 3 (Deep Learning Core), Phase 5 · 09 (Sequence-to-Sequence), Phase 5 · 10 (Attention Mechanism)
**Time:** ~45 分钟

## 问题所在

2017 年之前，地球上所有最先进的序列模型——语言、翻译、语音——都是循环神经网络。LSTM 和 GRU 在相当于 ImageNet 级别的翻译基准上称霸了五年。它们是当时唯一可用的工具。

它们有三个致命弱点。顺序计算意味着无法沿时间轴并行化：token `t+1` 需要 token `t` 的隐藏状态。一个 1,024 个 token 的序列意味着在每周期可执行 1,000,000 次浮点运算的 GPU 上进行 1,024 步串行计算。在为并行而设计的硬件上，训练耗时随序列长度线性增长。

梯度消失意味着 50 个 token 之前的信息已经经过了 50 层非线性的压缩。门控循环单元（LSTM、GRU）缓解了这种压缩，但从未消除它。长距离依赖——“我去年夏天在飞往京都的飞机上读的那本书是……”——经常失败。

固定宽度的隐藏状态意味着编码器在解码器看到任何东西之前，就把整个源序列压缩进单个向量。源序列是 5 个 token 还是 500 个 token 并不重要；瓶颈的形状是一样的。

2017 年的论文《Attention Is All You Need》提出了一个激进的想法：彻底抛弃循环。让每个位置并行地关注所有其他位置。用一次大的矩阵乘法来训练，而不是 1,024 次顺序的乘法。

到 2026 年，这一结果主导了所有模态。语言（GPT-5、Claude 4、Llama 4）、视觉（ViT、DINOv2、SAM 3）、音频（Whisper）、生物学（AlphaFold 3）、机器人（RT-2）。相同的模块，不同的输入。

## 核心概念

![RNN sequential compute vs Transformer parallel attention](../assets/rnn-vs-transformer.svg)

**循环作为瓶颈。** RNN 计算 `h_t = f(h_{t-1}, x_t)`。每一步都依赖于前一步。你无法在 `h_4` 之前计算 `h_5`。在拥有 10,000+ 并行核心的现代 GPU 上，长序列会浪费 99% 的硅片算力。

**注意力作为广播。** 自注意力同时对每一对 `(i, j)` 计算 `output_i = sum_j(a_ij * v_j)`。整个 N×N 注意力矩阵通过一次批量矩阵乘法填充完成。任何步骤都不依赖其他步骤。GPU 非常擅长这个。

**加速比不是一个常数。** 它是 `O(N)` 串行深度与 `O(1)` 串行深度之间的差异。实践中，在相同硬件、N=512 的条件下，transformer 每个 epoch 的训练速度快 5–10 倍，而且随着序列长度增加差距会继续扩大，直到触及注意力的 `O(N²)` 内存墙（Flash Attention 后来解决了这个问题——见第 12 课）。

**Transformer 的代价。** 注意力内存随 `O(N²)` 扩展。对于 2K 上下文，没问题。对于 128K 上下文，你需要滑动窗口、RoPE 外推、Flash Attention 分块或线性注意力变体。循环在时间和内存上都是 `O(N)`；transformer 用时间换内存，然后再通过并行性把时间赢回来。

**归纳偏置的转变。** RNN 假设局部性和近因性。Transformer 不做任何假设——每一对都是注意力的候选。这就是为什么 transformer 需要更多数据才能训练好，但一旦拥有足够数据就能扩展得更远。Chinchilla（2022）将其形式化：在 token 足够多的情况下，transformer 总是胜过参数量相同的 RNN。

```figure
rnn-vs-parallel
```

## 动手实现

这里没有神经网络——我们在数值上模拟核心瓶颈，让你在自己的笔记本上直观感受这个差距。

### 步骤 1：测量串行深度

见 `code/main.py`。我们构建两个函数。一个将序列编码为加法链（串行，类似 RNN）。另一个将其编码为并行归约（广播，类似注意力）。相同的数学，不同的依赖图。

```python
def rnn_style(xs):
    h = 0.0
    for x in xs:
        h = 0.9 * h + x   # can't parallelize: h depends on previous h
    return h

def attention_style(xs):
    return sum(xs) / len(xs)  # every x is independent
```

我们在最多 100,000 个元素的序列上对两者计时。RNN 版本是 O(N)，且是单条 CPU 流水线。即使在纯 Python 中，注意力风格的归约在长度 ≥ 1,000 时也会胜过它，因为 Python 的 `sum()` 是用 C 实现的，迭代时每步没有解释器开销。

### 步骤 2：统计理论操作数

两个算法都做 N 次加法。区别在于*依赖深度*：下一个操作开始之前必须顺序执行多少个操作。RNN 深度 = N。注意力深度在使用树归约时为 log(N)，使用并行扫描时为 1。决定 GPU 耗时的是深度，而不是操作数。

### 步骤 3：长序列上的经验扩展

我们打印一张计时表，让 O(N) 的差距清晰可见。在 2026 年的 Mac 笔记本上，小于 1,000 个元素的序列快到无法测量。100,000 个元素的序列呈现出干净的线性扫描。把它放大到一个 16,384 个 token 的 transformer 与等效的 12 层 LSTM 对比，你就能明白为什么 2016 年训练耗时是一个阻碍。

## 实际应用

2026 年仍应选择 RNN 的场景：

| 情况 | 选择 |
|-----------|------|
| 流式推理，一次一个 token，恒定内存 | RNN 或状态空间模型（Mamba、RWKV） |
| 超长序列（>1M token），注意力内存爆炸 | 线性注意力、Mamba 2、Hyena |
| 没有矩阵乘法加速器的边缘设备 | 深度可分离 RNN 在 FLOPs/瓦特上仍占优势 |
| 其他所有情况（训练、批量推理、最高 128K 的上下文） | Transformer |

像 Mamba 这样的状态空间模型（SSM）本质上是具有结构化参数化的 RNN，兼得两者之长：`O(N)` 扫描内存，通过选择性扫描实现并行训练。它们以更好的长上下文扩展性恢复约 90% 的 transformer 质量。2026 年，大多数前沿实验室训练混合 SSM+transformer 模型（如 Jamba、Samba）——循环并没有消亡，它成为了一个组件。

## 上线部署

见 `outputs/skill-architecture-picker.md`。该技能在给定长度、吞吐量和训练预算约束的情况下，为一个新序列问题选择架构。对于超过 1B token 的训练任务，它应始终拒绝直接推荐纯 RNN，除非说明权衡。

## 练习

1. **简单。** 取 `code/main.py` 中的 `rnn_style`，把标量隐藏状态替换为长度为 64 的隐藏状态向量。重新测量。串行开销随隐藏状态维度增长多少？
2. **中等。** 用纯 Python 实现并行前缀和（Hillis-Steele 扫描）。验证它在长度 1024 上产生与串行扫描相同的数值输出。统计其深度。
3. **困难。** 将注意力风格的归约移植到 GPU 上的 PyTorch。当序列长度从 64 扫描到 65,536 时对两者计时。绘制并解释曲线形状。

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|-----------------|-----------------------|
| 循环 | “RNN 是顺序的” | 步骤 `t` 依赖于步骤 `t-1` 的计算，迫使沿时间轴串行执行。 |
| 串行深度 | “图有多深” | 相互依赖操作的最长链；即使在无限硬件上也限制了实际耗时。 |
| 注意力 | “让 token 互相查看” | 加权和 `sum_j a_ij v_j`，其中 `a_ij` 来自位置 i 和 j 之间的相似度分数。 |
| 上下文窗口 | “模型能看多少” | 注意力层可接受的输入位置数；二次方内存成本在此扩展。 |
| 归纳偏置 | “架构中固化的假设” | 关于数据样貌的先验；CNN 假设平移不变性，RNN 假设近因性。 |
| 状态空间模型 | “背后有代数支撑的 RNN” | 通过结构化状态空间矩阵参数化的循环，以支持并行训练。 |
| 二次方瓶颈 | “为什么上下文这么贵” | 注意力内存 = 按序列长度的 `O(N²)`；Flash Attention 隐藏的是常数，而不是扩展规律。 |

## 延伸阅读

- [Vaswani et al. (2017). Attention Is All You Need](https://arxiv.org/abs/1706.03762) — 终结主流 NLP 中循环结构的论文。
- [Bahdanau, Cho, Bengio (2014). Neural MT by Jointly Learning to Align and Translate](https://arxiv.org/abs/1409.0473) — 注意力的诞生地，当时是附加在 RNN 上的。
- [Hochreiter, Schmidhuber (1997). Long Short-Term Memory](https://www.bioinf.jku.at/publications/older/2604.pdf) — 最初的 LSTM 论文，留作记录。
- [Gu, Dao (2023). Mamba: Linear-Time Sequence Modeling with Selective State Spaces](https://arxiv.org/abs/2312.00752) — 针对 transformer 的现代循环结构回应。