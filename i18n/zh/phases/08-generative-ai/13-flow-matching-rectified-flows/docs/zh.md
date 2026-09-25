# 流匹配与整流流

> 扩散模型需要 20-50 个采样步，因为它们沿着一条弯曲的路径从噪声走向数据。流匹配（Lipman et al., 2023）和整流流（Liu et al., 2022）训练的是直线路径。路径越直，所需步数越少，推理也就越快。Stable Diffusion 3、Flux.1 和 AudioCraft 2 都在 2024 年转向了流匹配。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 8 · 06（DDPM）、Phase 1 · 微积分
**Time:** 约 45 分钟

## 问题所在

DDPM 的反向过程是一个从 `N(0, I)` 走回数据分布的 1000 步随机游走。DDIM 把它压缩到了 20-50 个确定性步。你想要更少的步数——最好是一步。阻碍在于求解反向过程的 ODE 是刚性的；路径是弯曲的。

如果你能把模型训练成从噪声到数据的路径是一条*直线*，那么从 `t=1` 到 `t=0` 只需一个 Euler 步就能完成。流匹配直接构造这一点：定义一条从 `x_1 ∼ N(0, I)` 到 `x_0 ∼ data` 的直线插值，训练一个向量场 `v_θ(x, t)` 来匹配它对时间的导数，推理时做积分即可。

整流流（Liu 2022）更进一步：通过一个 reflow 过程迭代地拉直路径，产生逐步更接近线性的 ODE。经过两轮 reflow 迭代，2 步采样器就能达到 50 步 DDPM 的质量。

## 核心概念

![Flow matching: straight-line interpolation between noise and data](../assets/flow-matching.svg)

### 直线流

定义：

```
x_t = t · x_1 + (1 - t) · x_0,   t ∈ [0, 1]
```

其中 `x_0 ~ data` 且 `x_1 ~ N(0, I)`。沿这条直线的时间导数是常数：

```
dx_t / dt = x_1 - x_0
```

定义一个神经向量场 `v_θ(x_t, t)`，训练它匹配这个导数：

```
L = E_{x_0, x_1, t} || v_θ(x_t, t) - (x_1 - x_0) ||²
```

这就是**条件流匹配**损失（Lipman 2023）。训练是无模拟的：你从不需要展开 ODE。只需采样 `(x_0, x_1, t)` 并做回归。

### 采样

推理时，对学到的向量场在时间上做*反向*积分：

```
x_{t-Δt} = x_t - Δt · v_θ(x_t, t)
```

从 `x_1 ~ N(0, I)` 出发，用 Euler 步走到 `t=0`。

### 整流流（Liu 2022）

直线流可行，但学到的路径*实际上并不直*——它们会弯曲，因为许多 `x_0` 可以映射到同一个 `x_1`。整流流的 reflow 步骤：

1. 用随机配对训练流模型 v_1。
2. 通过把 v_1 从 `x_1` 积分到其落点 `x_0`，采样出 N 对 `(x_1, x_0)`。
3. 用这些配对样本训练 v_2。因为这些配对现在是“ODE 匹配”的，它们之间的直线插值确实更平了。
4. 重复。

实践中 2 轮 reflow 迭代就能接近线性，从而实现 2-4 步推理。SDXL-Turbo、SD3-Turbo、LCM 都是从流匹配蒸馏而来的模型。

### 为什么它在 2024 年的图像领域胜出

三个原因：

1. **无模拟训练** —— 训练期间不展开 ODE，实现非常简单。
2. **更好的损失几何** —— 直线路径具有一致的信号噪声比，而 DDPM 的 ε 损失在调度两端 SNR 很差。
3. **更快的推理** —— SDXL-Turbo 质量下只需 4-8 步；配合一致性蒸馏可降至 1 步。

## 流匹配 vs DDPM —— 精确联系

带高斯条件路径的流匹配等价于*采用特定噪声调度的*扩散。选取 `x_t = α(t) x_0 + σ(t) x_1` 调度，流匹配就还原为 Stratonovich 形式化的扩散，且 `v = α'·x_0 - σ'·x_1`。对于高斯路径，二者在代数上等价。

流匹配带来的新东西：目标的*清晰性*（一个朴素的速度量）、更干净的损失，以及尝试非高斯插值的自由。

```figure
normalizing-flow
```

## 动手实现

`code/main.py` 在双模态高斯混合上实现了一维流匹配。向量场 `v_θ(x, t)` 是一个用直线目标训练的微型 MLP。推理时，分别用 1、2、4 和 20 个 Euler 步做积分，比较样本质量。

### 第 1 步：训练损失

```python
def train_step(x0, net, rng, lr):
    x1 = rng.gauss(0, 1)
    t = rng.random()
    x_t = t * x1 + (1 - t) * x0
    target = x1 - x0
    pred = net_forward(x_t, t)
    loss = (pred - target) ** 2
    # backprop + update
```

### 第 2 步：多步推理

```python
def sample(net, num_steps):
    x = rng.gauss(0, 1)
    for i in range(num_steps):
        t = 1.0 - i / num_steps
        dt = 1.0 / num_steps
        x -= dt * net_forward(x, t)
    return x
```

### 第 3 步：比较步数

预期 4 步采样器已经能匹配 20 步的质量——这对延迟来说是大事。

## 常见陷阱

- **时间参数化。** 流匹配使用 `t ∈ [0, 1]`，其中 `t=0` 在数据端、`t=1` 在噪声端。DDPM 使用 `t ∈ [0, T]`，其中 `t=0` 在数据端、`t=T` 在噪声端。方向相同，尺度不同。论文里经常搞错这一点。
- **调度选择。** 整流流的直线是“标准的”流匹配调度，但你可以用 cosine 或 logit-normal 的 t 采样（SD3 就是这么做的）来获得更好的尺度覆盖。
- **Reflow 成本。** 为 reflow 生成配对数据集意味着每个样本都要完整跑一次推理。只有在你真的需要 1-2 步推理时才做 reflow。
- **Classifier-free guidance 依然适用。** 只需在线性组合中把 ε 换成 v：`v_cfg = (1+w) v_cond - w v_uncond`。

## 使用场景

| 使用场景 | 2026 年技术栈 |
|----------|-----------|
| 文生图，最高质量 | 流匹配：SD3、Flux.1-dev |
| 文生图，1-4 步 | 蒸馏流匹配：Flux.1-schnell、SD3-Turbo、SDXL-Turbo |
| 实时推理 | 从流匹配基座做一致性蒸馏（LCM、PCM） |
| 音频生成 | 流匹配：Stable Audio 2.5、AudioCraft 2 |
| 视频生成 | 流匹配与扩散混合（Sora、Veo、Stable Video） |
| 科学 / 物理（粒子轨迹、分子） | 流匹配 + 等变向量场 |

在 2025-2026 年， whenever 一篇论文声称“比扩散更快”，它几乎总是流匹配 + 蒸馏。

## 上线部署

保存 `outputs/skill-fm-tuner.md`。该技能接收一个扩散风格的模型规格，并将其转换为流匹配训练配置：调度选择、时间采样分布（uniform / logit-normal）、优化器、reflow 计划、目标步数、评估协议。

## 练习

1. **简单。** 运行 `code/main.py`，比较 1 步与 20 步相对真实数据分布的 MSE。
2. **中等。** 把均匀的 `t` 采样换成 logit-normal（把采样集中到中等 t 值）。模型质量是否提升？
3. **困难。** 实现一轮 reflow 迭代：通过积分第一个模型生成配对 (x_0, x_1)，用这些配对训练第二个模型，并比较 1 步采样质量。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------------|-----------------------|
| 流匹配 | “直线扩散” | 训练 `v_θ(x, t)` 以匹配插值路径上的 `x_1 - x_0`。 |
| 整流流 | “Reflow” | 迭代拉直已学流的程序。 |
| 速度场 | "v_θ" | 模型的输出——移动 `x_t` 的方向。 |
| 直线插值 | “那条路径” | `x_t = (1-t)·x_0 + t·x_1`；目标导数平凡。 |
| Euler 采样器 | “一阶 ODE 求解器” | 最简单的积分器；路径为直线时效果很好。 |
| Logit-normal t | “SD3 采样” | 把 `t` 采样集中到梯度最强的中间值附近。 |
| 一致性蒸馏 | “1 步采样器” | 训练学生模型把任意 `x_t` 直接映射到 `x_0`。 |
| 带速度的 CFG | "v-CFG" | `v_cfg = (1+w) v_cond - w v_uncond`；同样的技巧，换了变量。 |

## 生产注记：Flux.1-schnell 是流匹配的最快形态

流匹配在生产上的胜利就是 Flux.1-schnell——一个被蒸馏到 1-4 个推理步、同时保持 Flux-dev 级质量的流匹配 DiT。Niels 的"Run Flux on an 8GB machine"笔记本是参考部署方案：T5 + CLIP 编码、量化 MMDiT 去噪（schnell 用 4 步，dev 用 50 步）、VAE 解码。成本核算：

| 变体 | 步数 | L4 上 1024² 延迟 | 总 FLOPs（相对） |
|---------|-------|------------------------|------------------------|
| Flux.1-dev (raw) | 50 | ~15 s | 1.0× |
| Flux.1-schnell | 4 | ~1.2 s | 0.08× (12× faster) |
| SDXL-base | 30 | ~4 s | 0.25× |
| SDXL-Lightning 2-step | 2 | ~0.3 s | 0.03× |

生产规则：**流匹配基座 + 蒸馏 = 2026 年快速文生图的默认方案。** 每家主要厂商都在交付这一组合：SD3-Turbo（SD3 + 流匹配 + 蒸馏）、Flux-schnell（Flux-dev + 整流流拉直）、CogView-4-Flash。纯扩散基座只作为遗留 checkpoint 存在。

## 延伸阅读

- [Liu, Gong, Liu (2022). Flow Straight and Fast: Learning to Generate and Transfer Data with Rectified Flow](https://arxiv.org/abs/2209.03003) —— 整流流。
- [Lipman et al. (2023). Flow Matching for Generative Modeling](https://arxiv.org/abs/2210.02747) —— 流匹配。
- [Esser et al. (2024). Scaling Rectified Flow Transformers for High-Resolution Image Synthesis](https://arxiv.org/abs/2403.03206) —— SD3，规模化整流流。
- [Albergo, Vanden-Eijnden (2023). Stochastic Interpolants](https://arxiv.org/abs/2303.08797) —— 涵盖 FM + 扩散的通用框架。
- [Song et al. (2023). Consistency Models](https://arxiv.org/abs/2303.01469) —— 扩散 / 流的 1 步蒸馏。
- [Sauer et al. (2023). Adversarial Diffusion Distillation (SDXL-Turbo)](https://arxiv.org/abs/2311.17042) —— turbo 变体。
- [Black Forest Labs (2024). Flux.1 models](https://blackforestlabs.ai/announcing-black-forest-labs/) —— 生产中的流匹配。