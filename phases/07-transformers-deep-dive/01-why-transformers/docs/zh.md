# 为什么是 Transformer —— RNN 的那些麻烦

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> RNN 一次只处理一个 token，transformer 一次处理所有 token。就这一个架构上的押注，改写了 2017 年之后深度学习里的每一条 scaling 曲线。

**Type:** Learn
**Languages:** Python
**Prerequisites:** Phase 3（Deep Learning Core）、Phase 5 · 09（Sequence-to-Sequence）、Phase 5 · 10（Attention Mechanism）
**Time:** ~45 minutes

## 问题（Problem）

2017 年之前，地球上每一个 SOTA 的序列模型——语言、翻译、语音——都是某种循环神经网络（RNN）。LSTM 和 GRU 在长达半个十年的时间里横扫各种翻译基准（相当于 NLP 界的 ImageNet）。那是当时所有人手里唯一的工具。

它们身上有三个致命弱点。**串行计算**意味着无法沿时间轴并行：token `t+1` 需要 token `t` 的隐状态。一段 1,024 个 token 的序列就意味着 1,024 个串行步骤——而 GPU 每个周期能做百万级浮点运算。在专为并行设计的硬件上，训练的 wall-clock 时间随序列长度线性增长。

**梯度消失**意味着 50 个 token 之前的信息已经被压过 50 个非线性。门控循环单元（LSTM、GRU）缓解了这种压榨，但从未根除。长程依赖——比如「我去年夏天在去京都的飞机上读的那本书……」——经常翻车。

**定宽隐状态**意味着 encoder 必须把整个源序列压进一个向量，decoder 才看得到任何东西。源序列是 5 个 token 还是 500 个都无所谓，瓶颈的形状是固定的。

2017 年的论文《Attention Is All You Need》提出了一个激进方案：彻底丢掉 recurrence。让每个位置并行地 attend 到其他所有位置。把 1,024 步串行换成一次大矩阵乘法去训练。

到了 2026 年，结果就是 transformer 主宰一切模态。语言（GPT-5、Claude 4、Llama 4）、视觉（ViT、DINOv2、SAM 3）、音频（Whisper）、生物（AlphaFold 3）、机器人（RT-2）。同一个 block，输入不同而已。

## 概念（Concept）

![RNN sequential compute vs Transformer parallel attention](../assets/rnn-vs-transformer.svg)

**Recurrence 是瓶颈。** RNN 计算 `h_t = f(h_{t-1}, x_t)`，每一步都依赖上一步。`h_4` 没算出来就不能算 `h_5`。在拥有 10,000+ 并行核心的现代 GPU 上，跑一段长序列就等于浪费了 99% 的硅片。

**Attention 是广播。** Self-attention 同时对每一对 `(i, j)` 计算 `output_i = sum_j(a_ij * v_j)`。整张 N×N 的 attention 矩阵在一次 batched matmul 里就被填满，没有哪一步依赖另一步。GPU 爱死这种活。

**这种加速不是常数级的。** 它是 `O(N)` 串行深度和 `O(1)` 串行深度之间的差距。实际上，在相同硬件、N=512 时，transformer 每个 epoch 训练快 5–10×，而且差距随序列长度继续拉大，直到撞上 attention 那堵 `O(N²)` 内存墙（后来被 Flash Attention 解决——见第 12 课）。

**Transformer 的代价。** Attention 的内存按 `O(N²)` 增长。2K context 没问题。要 128K context 就得用 sliding window、RoPE 外推、Flash Attention tiling，或者各种线性 attention 变体。Recurrence 在时间和内存上都是 `O(N)`；transformer 是用内存换时间，再靠并行把时间赢回来。

**归纳偏置（inductive bias）的转变。** RNN 假设局部性和近期性。Transformer 什么都不假设——每一对位置都是 attention 的候选。这就是为什么 transformer 想训得好需要更多数据，但有了数据之后扩得更远。Chinchilla（2022）把这件事形式化了：只要 token 足够多，相同参数量下 transformer 总是赢过 RNN。

## 动手实现（Build It）

这里没有神经网络——我们用数值方式模拟核心瓶颈，让你在自己的笔记本上感受到那道差距。

### Step 1：测量串行深度

见 `code/main.py`。我们写两个函数。一个把序列编码成一连串加法（串行，像 RNN）。另一个把它编码成一次并行 reduction（广播，像 attention）。数学一样，依赖图不同。

```python
def rnn_style(xs):
    h = 0.0
    for x in xs:
        h = 0.9 * h + x   # can't parallelize: h depends on previous h
    return h

def attention_style(xs):
    return sum(xs) / len(xs)  # every x is independent
```

我们对长达 100,000 个元素的序列分别计时。RNN 版本是 O(N)，而且只占一条 CPU 流水线。哪怕是纯 Python，attention 风格的 reduction 在长度 ≥ 1,000 时就赢了，因为 Python 的 `sum()` 是用 C 实现的，每一步都没有解释器开销。

### Step 2：清点理论操作数

两个算法都做了 N 次加法。区别在 *依赖深度*：在下一个操作能开始之前，必须串行完成多少操作。RNN 深度 = N。Attention 深度在树形 reduction 下是 log(N)，在并行 scan 下是 1。决定 GPU 用时的是深度，不是操作数。

### Step 3：长序列上的实证扩展

我们打印一张时序表，让 O(N) 的差距肉眼可见。在一台 2026 年的 Mac 笔记本上，长度低于 1,000 的序列快得测不出来。10 万长度的序列才能看到一条干净的线性扫描。把这个比例放到一个 16,384 token 的 transformer，对比一个 12 层等价 LSTM，你就能看懂 2016 年训练 wall-clock 为什么是个拦路虎了。

## 用起来（Use It）

到了 2026 年，什么时候还应该选 RNN：

| 情境 | 选 |
|-----------|------|
| 流式推理、一次一个 token、内存恒定 | RNN 或状态空间模型（Mamba、RWKV） |
| 极长序列（>1M token），attention 内存爆炸 | 线性 attention、Mamba 2、Hyena |
| 没有 matmul 加速器的边缘设备 | depthwise-separable RNN 在 FLOPs/瓦特上仍然占优 |
| 其它一切（训练、batched 推理、context 上至 128K） | Transformer |

状态空间模型（SSM，如 Mamba）本质上就是带结构化参数化的 RNN，让它兼得两边的好处：`O(N)` 的 scan 内存、通过 selective scan 实现的并行训练。它们能在更好的长 context 扩展性下，逼近 transformer 90% 的质量。2026 年大多数前沿实验室都在训练 SSM+transformer 的混合模型（如 Jamba、Samba）——recurrence 没死，它变成了一个组件。

## 上线部署（Ship It）

见 `outputs/skill-architecture-picker.md`。这个 skill 会在给定长度、吞吐和训练预算约束的情况下，为一个新序列问题挑架构。对于训练 token 超过 1B 的任务，如果不附带说明取舍，它应当始终拒绝推荐纯 RNN。

## 练习（Exercises）

1. **Easy.** 把 `code/main.py` 里的 `rnn_style` 把那个标量隐状态换成长度 64 的向量。重新测时间。串行开销随隐状态维度怎么涨？
2. **Medium.** 用纯 Python 实现一个并行 prefix-sum（Hillis-Steele scan）。验证它在长度 1024 上和串行 scan 给出同样的数值结果。数一下深度。
3. **Hard.** 把 attention 风格的 reduction 移植到 PyTorch GPU 上。把序列长度从 64 扫到 65,536，分别计时。画出曲线并解释它的形状。

## 关键术语（Key Terms）

| 术语 | 大家嘴上说的 | 它真正的意思 |
|------|-----------------|-----------------------|
| Recurrence | 「RNN 是串行的」 | 第 `t` 步依赖第 `t-1` 步的计算，强制沿时间轴串行执行。 |
| Serial depth（串行深度） | 「这张图有多深」 | 依赖操作链中最长的一条；即便硬件无穷，它也是 wall-clock 的下界。 |
| Attention | 「让 token 互相看一眼」 | 加权和 `sum_j a_ij v_j`，其中 `a_ij` 来自位置 i 和 j 的相似度分数。 |
| Context window | 「模型一次能看多少」 | 一个 attention 层能吃进的位置数；二次方内存成本就在这里增长。 |
| Inductive bias（归纳偏置） | 「架构里写死的假设」 | 关于数据长什么样的先验；CNN 假设平移不变，RNN 假设近期重要。 |
| State-space model | 「带代数底子的 RNN」 | 通过结构化状态空间矩阵参数化、可并行训练的 recurrence。 |
| Quadratic bottleneck（二次方瓶颈） | 「context 为啥这么贵」 | Attention 内存 = 序列长度的 `O(N²)`；Flash Attention 藏起了常数项，藏不掉缩放规律。 |

## 延伸阅读（Further Reading）

- [Vaswani et al. (2017). Attention Is All You Need](https://arxiv.org/abs/1706.03762) —— 主流 NLP 中干掉 recurrence 的那篇论文。
- [Bahdanau, Cho, Bengio (2014). Neural MT by Jointly Learning to Align and Translate](https://arxiv.org/abs/1409.0473) —— attention 诞生的地方，被嫁接在了一个 RNN 上。
- [Hochreiter, Schmidhuber (1997). Long Short-Term Memory](https://www.bioinf.jku.at/publications/older/2604.pdf) —— 留个底，最早的 LSTM 论文。
- [Gu, Dao (2023). Mamba: Linear-Time Sequence Modeling with Selective State Spaces](https://arxiv.org/abs/2312.00752) —— recurrence 阵营对 transformer 的现代回应。
