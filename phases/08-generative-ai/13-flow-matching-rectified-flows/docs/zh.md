# 流匹配与整流流（Flow Matching & Rectified Flows）

> 扩散模型需要 20-50 个采样步，因为它们沿着一条弯曲的路径从噪声走向数据。流匹配（Lipman 等人，2023）和整流流（Liu 等人，2022）训练的是直线路径。更直的路径意味着更少的步数，意味着更快的推理。Stable Diffusion 3、Flux.1 和 AudioCraft 2 都在 2024 年切换到了流匹配。

**类型：** 构建
**语言：** Python
**先修知识：** 第 8 阶段 · 06（DDPM）、第 1 阶段 · 微积分
**时间：** ~45 分钟

## 问题

DDPM 的反向过程是一个从 `N(0, I)` 回到数据分布的 1000 步随机游走。DDIM 将其压缩到 20-50 个确定性步骤。你希望步数更少——理想情况下是一步。阻碍在于，求解反向过程的 ODE 是刚性的；路径是弯曲的。

如果你能训练模型，使得从噪声到数据的路径是一条*直线*，那么从 `t=1` 到 `t=0` 的单个欧拉步就足够了。流匹配直接构建这一点：定义一条从 `x_1 ∼ N(0, I)` 到 `x_0 ∼ data` 的直线插值，训练一个向量场 `v_θ(x, t)` 来匹配其时间导数，在推理时进行积分。

整流流（Liu 2022）更进一步：通过 reflow 程序迭代地拉直路径，产生一个逐渐更接近线性的 ODE。经过两次 reflow 迭代，一个 2 步采样器就能达到 50 步 DDPM 的质量。

## 概念

![流匹配：噪声与数据之间的直线插值](../assets/flow-matching.svg)

### 直线流

定义：

```
x_t = t · x_1 + (1 - t) · x_0,   t ∈ [0, 1]
```

其中 `x_0 ~ data` 且 `x_1 ~ N(0, I)`。沿这条直线的时间导数是恒定的：

```
dx_t / dt = x_1 - x_0
```

定义一个神经向量场 `v_θ(x_t, t)` 并训练它去匹配这个导数：

```
L = E_{x_0, x_1, t} || v_θ(x_t, t) - (x_1 - x_0) ||²
```

这就是**条件流匹配**损失（Lipman 2023）。训练是无模拟的：你永远不会展开 ODE。只需采样 `(x_0, x_1, t)` 并进行回归。

### 采样

在推理时，沿时间*反向*积分学习到的向量场：

```
x_{t-Δt} = x_t - Δt · v_θ(x_t, t)
```

从 `x_1 ~ N(0, I)` 开始，用欧拉步下降到 `t=0`。

### 整流流（Liu 2022）

直线流是有效的，但学习到的路径*实际上并不直*——它们会弯曲，因为许多 `x_0` 可能映射到同一个 `x_1`。整流流的 reflow 步骤：

1. 用随机配对训练流模型 v_1。
2. 通过从 `x_1` 积分 v_1 到其着陆点 `x_0`，采样 N 对 `(x_1, x_0)`。
3. 在这些配对样本上训练 v_2。因为这些配对现在是"ODE 匹配的"，所以它们之间的直线插值是真正更平坦的。
4. 重复。

在实践中，2 次 reflow 迭代就能让你接近线性，从而实现 2-4 步推理。SDXL-Turbo、SD3-Turbo、LCM 都是从流匹配模型蒸馏而来的。

### 为什么这在 2024 年赢得了图像生成

三个原因：

1. **无模拟训练** —— 训练期间无需 ODE 展开，实现起来非常简单。
2. **更好的损失几何** —— 直线路径具有稳定的信噪比，而 DDPM 的 ε-损失在调度边缘的信噪比很差。
3. **更快的推理** —— SDXL-Turbo 质量只需 4-8 步；通过一致性蒸馏只需 1 步。

## 流匹配 vs DDPM —— 精确联系

带有高斯条件路径的流匹配是*具有特定噪声调度*的扩散。选择 `x_t = α(t) x_0 + σ(t) x_1` 调度，流匹配就恢复了 Stratonovich 重构的扩散，其中 `v = α'·x_0 - σ'·x_1`。对于高斯路径，两者在代数上是等价的。

流匹配新增的内容：目标的*清晰度*（一个纯速度）、更干净的损失，以及尝试非高斯插值的许可。

## 构建它

`code/main.py` 在双峰高斯混合上实现了一维流匹配。向量场 `v_θ(x, t)` 是一个微小的 MLP，用直线目标训练。在推理时，积分 1、2、4 和 20 个欧拉步并比较样本质量。

### 步骤 1：训练损失

```python
def train_step(x0, net, rng, lr):
    x1 = rng.gauss(0, 1)
    t = rng.random()
    x_t = t * x1 + (1 - t) * x0
    target = x1 - x0
    pred = net_forward(x_t, t)
    loss = (pred - target) ** 2
    # 反向传播 + 更新
```

### 步骤 2：多步推理

```python
def sample(net, num_steps):
    x = rng.gauss(0, 1)
    for i in range(num_steps):
        t = 1.0 - i / num_steps
        dt = 1.0 / num_steps
        x -= dt * net_forward(x, t)
    return x
```

### 步骤 3：比较步数

期望 4 步采样器已经能匹配 20 步的质量——这对延迟来说是一件大事。

## 陷阱

- **时间参数化。** 流匹配使用 `t ∈ [0, 1]`，`t=0` 在数据端，`t=1` 在噪声端。DDPM 使用 `t ∈ [0, T]`，`t=0` 在数据端，`t=T` 在噪声端。方向相同，尺度不同。论文经常把这个搞错。
- **调度选择。** 整流流的直线是"那个"流匹配调度，但你可以使用余弦或 logit-normal t 采样（SD3 这样做）来获得更好的尺度覆盖。
- **Reflow 成本。** 为 reflow 生成配对数据集需要对每个样本进行完整的推理传递。只有当你真正需要 1-2 步推理时才做 reflow。
- **分类器自由引导仍然适用。** 只需在线性组合中将 ε 换成 v：`v_cfg = (1+w) v_cond - w v_uncond`。

## 使用它

| 用例 | 2026 年技术栈 |
|----------|-----------|
| 文生图，最佳质量 | 流匹配：SD3、Flux.1-dev |
| 文生图，1-4 步 | 蒸馏流匹配：Flux.1-schnell、SD3-Turbo、SDXL-Turbo |
| 实时推理 | 从流匹配基础模型进行一致性蒸馏（LCM、PCM） |
| 音频生成 | 流匹配：Stable Audio 2.5、AudioCraft 2 |
| 视频生成 | 流匹配与扩散混合（Sora、Veo、Stable Video） |
| 科学/物理（粒子轨迹、分子） | 流匹配 + 等变向量场 |

每当一篇论文在 2025-2026 年说"比扩散更快"时，它几乎总是流匹配 + 蒸馏。

## 交付它

保存 `outputs/skill-fm-tuner.md`。该技能接收一个扩散风格的模型规格，并将其转换为流匹配训练配置：调度选择、时间采样分布（均匀/logit-normal）、优化器、reflow 计划、目标步数、评估协议。

## 练习

1. **简单。** 运行 `code/main.py` 并比较 1 步与 20 步的 MSE 与真实数据分布。
2. **中等。** 从均匀 `t` 采样切换到 logit-normal（将采样集中在中间 t）。模型质量会提高吗？
3. **困难。** 实现一次 reflow 迭代：通过积分第一个模型生成配对 (x_0, x_1)，在配对上训练第二个模型，并比较 1 步样本质量。

## 关键术语

| 术语 | 人们怎么说 | 它实际是什么意思 |
|------|-----------------|-----------------------|
| Flow matching | "直线扩散" | 训练 `v_θ(x, t)` 以匹配沿插值的 `x_1 - x_0`。 |
| Rectified flow | "Reflow" | 迭代拉直学习流的程序。 |
| Velocity field | "v_θ" | 模型的输出——移动 `x_t` 的方向。 |
| Straight-line interpolant | "路径" | `x_t = (1-t)·x_0 + t·x_1`；平凡的目标导数。 |
| Euler sampler | "1 阶 ODE 求解器" | 最简单的积分器；当路径是直线时效果很好。 |
| Logit-normal t | "SD3 采样" | 将 `t` 采样集中在梯度最强的中间值。 |
| Consistency distillation | "1 步采样器" | 训练一个学生将任何 `x_t` 直接映射到 `x_0`。 |
| CFG with velocity | "v-CFG" | `v_cfg = (1+w) v_cond - w v_uncond`；同样的技巧，新的变量。 |

## 生产说明：Flux.1-schnell 是流匹配在最快时的样子

流匹配的生产级胜利是 Flux.1-schnell —— 一个流匹配的 DiT，蒸馏到 1-4 个推理步，同时保持 Flux-dev 级别的质量。Niels 的"在 8GB 机器上运行 Flux"笔记本是参考部署方案：T5 + CLIP 编码，量化 MMDiT 去噪（schnell 4 步 vs dev 50 步），VAE 解码。成本核算：

| 变体 | 步数 | L4 上 1024² 的延迟 | 总 FLOPs（相对） |
|---------|-------|------------------------|------------------------|
| Flux.1-dev（原始） | 50 | ~15 秒 | 1.0× |
| Flux.1-schnell | 4 | ~1.2 秒 | 0.08×（快 12 倍） |
| SDXL-base | 30 | ~4 秒 | 0.25× |
| SDXL-Lightning 2-step | 2 | ~0.3 秒 | 0.03× |

生产规则是：**流匹配基础 + 蒸馏 = 2026 年快速文生图的默认方案。** 每个主要供应商都提供这种组合：SD3-Turbo（SD3 + 流 + 蒸馏）、Flux-schnell（Flux-dev + 整流流拉直）、CogView-4-Flash。纯扩散基础只存在于遗留检查点中。

## 延伸阅读

- [Liu, Gong, Liu (2022). Flow Straight and Fast: Learning to Generate and Transfer Data with Rectified Flow](https://arxiv.org/abs/2209.03003) —— 整流流。
- [Lipman et al. (2023). Flow Matching for Generative Modeling](https://arxiv.org/abs/2210.02747) —— 流匹配。
- [Esser et al. (2024). Scaling Rectified Flow Transformers for High-Resolution Image Synthesis](https://arxiv.org/abs/2403.03206) —— SD3，大规模整流流。
- [Albergo, Vanden-Eijnden (2023). Stochastic Interpolants](https://arxiv.org/abs/2303.08797) —— 涵盖 FM + 扩散的通用框架。
- [Song et al. (2023). Consistency Models](https://arxiv.org/abs/2303.01469) —— 扩散/流的 1 步蒸馏。
- [Sauer et al. (2023). Adversarial Diffusion Distillation (SDXL-Turbo)](https://arxiv.org/abs/2311.17042) —— turbo 变体。
- [Black Forest Labs (2024). Flux.1 models](https://blackforestlabs.ai/announcing-black-forest-labs/) —— 生产中的流匹配。
