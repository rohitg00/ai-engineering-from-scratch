# 流匹配（Flow Matching）与校正流（Rectified Flows）

> 扩散模型需要 20-50 步采样，因为它们在噪声到数据的路径上走了一条弯曲的路线。流匹配（Flow Matching, Lipman et al., 2023）和校正流（Rectified Flow, Liu et al., 2022）训练出了直线路径。更直的路径意味着更少的步数，从而带来更快的推理速度。Stable Diffusion 3、Flux.1 和 AudioCraft 2 都在 2024 年切换到了流匹配。

**类型：** 构建
**语言：** Python
**前置知识：** 第 8 阶段 · 06 (DDPM)、第 1 阶段 · 微积分
**预计时间：** ≈ 45 分钟

## 问题

DDPM 的反向过程是一个从 `N(0, I)` 回到数据分布的 1000 步随机游走。DDIM 将其压缩为 20-50 步的确定性步数。你希望步数更少——理想情况下只需一步。阻碍在于，求解反向过程的 ODE 是刚性的（stiff）；路径是弯曲的。

如果你能够训练模型，使得从噪声到数据的路径是一条*直线*，那么从 `t=1` 到 `t=0` 的单一欧拉步（Euler step）就能生效。流匹配直接构建了这一思路：定义一个从 `x_1 ∼ N(0, I)` 到 `x_0 ∼ data` 的直线插值，训练一个向量场 `v_θ(x, t)` 来匹配其时间导数，并在推理时进行积分。

校正流（Liu 2022）更进一步：通过一个再流动（reflow）过程迭代地拉直路径，该过程会逐步产生一条更接近线性的 ODE。经过两次再流动迭代后，一个 2 步采样器就能达到 50 步 DDPM 的质量。

## 概念

![流匹配：噪声与数据之间的直线插值](../assets/flow-matching.svg)

### 直线流

定义：

```
x_t = t · x_1 + (1 - t) · x_0,   t ∈ [0, 1]
```

其中 `x_0 ~ data`，`x_1 ~ N(0, I)`。沿这条直线的时间导数是常数：

```
dx_t / dt = x_1 - x_0
```

定义一个神经网络向量场 `v_θ(x_t, t)`，并训练它来匹配这个导数：

```
L = E_{x_0, x_1, t} || v_θ(x_t, t) - (x_1 - x_0) ||²
```

这就是**条件流匹配**（Conditional Flow Matching）损失（Lipman 2023）。训练是免模拟的（simulation-free）：你永远不需要展开 ODE。只需采样 `(x_0, x_1, t)` 并进行回归即可。

### 采样

在推理时，对学习到的向量场进行*逆时间*积分：

```
x_{t-Δt} = x_t - Δt · v_θ(x_t, t)
```

从 `x_1 ~ N(0, I)` 开始，用欧拉步下降到 `t=0`。

### 校正流（Liu 2022）

直线流虽然有效，但学习到的路径实际上*并非直线*——它们是弯曲的，因为许多 `x_0` 可能映射到同一个 `x_1`。校正流的再流动步骤：

1.  使用随机配对训练流模型 v_1。
2.  通过将 v_1 从 `x_1` 积分到其着陆点 `x_0`，采样 N 对 `(x_1, x_0)`。
3.  在这些配对的样本上训练 v_2。由于配对现在已经是“ODE 匹配”的，它们之间的直线插值实际上是更平坦的。
4.  重复。

在实践中，两次再流动迭代就能达到近似线性，从而实现 2-4 步推理。SDXL-Turbo、SD3-Turbo、LCM 都是从流匹配模型蒸馏得到的。

### 为什么它在 2024 年赢得了图像领域

三个原因：

1.  **免模拟训练**——训练期间无需展开 ODE，实现起来非常简单。
2.  **更好的损失几何**——直线路径具有一致的信号噪声比，而 DDPM 的 ε 损失在时间调度（schedule）的边缘处 SNR 较差。
3.  **更快的推理**——4-8 步即可达到 SDXL-Turbo 质量；结合一致性蒸馏（Consistency Distillation）可达到 1 步。

## 流匹配与 DDPM 的精确联系

使用高斯条件路径的流匹配，实际上就是*具有特定噪声调度（noise schedule）的扩散模型*。选取 `x_t = α(t) x_0 + σ(t) x_1` 调度，流匹配会恢复出 Stratonovich 重构的扩散，其 `v = α'·x_0 - σ'·x_1`。对于高斯路径来说，两者在代数上是等价的。

流匹配所增加的东西：目标的*清晰性*（一个简单的速度）、更干净的损失，以及使用非高斯插值进行实验的自由度。

## 动手构建

`code/main.py` 在一个双模态高斯混合分布上实现了 1 维流匹配。向量场 `v_θ(x, t)` 是一个小型 MLP，使用直线目标进行训练。推理时，分别用 1、2、4 和 20 步欧拉积分，并比较样本质量。

### 第 1 步：训练损失

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

预计 4 步采样器已经能够与 20 步质量相匹配——这对延迟来说意义重大。

## 陷阱

-   **时间参数化。** 流匹配使用 `t ∈ [0, 1]`，其中 `t=0` 对应数据，`t=1` 对应噪声。DDPM 使用 `t ∈ [0, T]`，其中 `t=0` 对应数据，`t=T` 对应噪声。方向相同，但尺度不同。论文经常搞错这一点。
-   **调度选择。** 校正流的直线是“标准的”流匹配调度，但你可以使用余弦或 logit-normal 的 t 采样（SD3 就是这样做的）来获得更好的尺度覆盖。
-   **再流动成本。** 为再流动生成配对数据集需要对每个样本进行一次完整的推理遍历。只有在你确实需要 1-2 步推理时才进行再流动。
-   **无分类器引导（Classifier-Free Guidance）仍然适用。** 只需将 ε 替换为 v 进行线性组合：`v_cfg = (1+w) v_cond - w v_uncond`。

## 使用场景

| 使用场景 | 2026 年技术栈 |
|----------|-----------|
| 文生图，最佳质量 | 流匹配：SD3, Flux.1-dev |
| 文生图，1-4 步 | 蒸馏流匹配：Flux.1-schnell, SD3-Turbo, SDXL-Turbo |
| 实时推理 | 从流匹配基模型进行一致性蒸馏（LCM, PCM） |
| 音频生成 | 流匹配：Stable Audio 2.5, AudioCraft 2 |
| 视频生成 | 流匹配与扩散混合（Sora, Veo, Stable Video） |
| 科学/物理（粒子轨迹、分子） | 流匹配 + 等变向量场 |

每当一篇论文在 2025-2026 年提到“比扩散更快”时，几乎总是指流匹配 + 蒸馏。

## 输出成果

保存 `outputs/skill-fm-tuner.md`。该技能接收一个扩散风格的模型规格，将其转换为流匹配的训练配置：调度选择、时间采样分布（均匀/logit-normal）、优化器、再流动计划、目标步数、评估协议。

## 练习

1.  **简单。** 运行 `code/main.py`，比较 1 步与 20 步的 MSE 以及真实数据分布。
2.  **中等。** 从均匀的 `t` 采样切换到 logit-normal（将采样集中在中间 t 值附近）。模型质量是否提升？
3.  **困难。** 实现一次再流动迭代：通过对第一个模型进行积分生成配对 (x_0, x_1)，在配对数据上训练第二个模型，并比较 1 步采样质量。

## 关键术语

| 术语 | 人们常说的 | 实际含义 |
|------|-----------------|-----------------------|
| 流匹配（Flow matching） | "直线扩散" | 训练 `v_θ(x, t)` 沿着插值路径匹配 `x_1 - x_0`。 |
| 校正流（Rectified flow） | "再流动" | 拉直学习到的流的迭代过程。 |
| 速度场（Velocity field） | "v_θ" | 模型的输出——移动 `x_t` 的方向。 |
| 直线插值（Straight-line interpolant） | "路径" | `x_t = (1-t)·x_0 + t·x_1`；简单的目标导数。 |
| 欧拉采样器（Euler sampler） | "一阶 ODE 求解器" | 最简单的积分器；当路径是直线时效果很好。 |
| Logit-normal t 采样 | "SD3 采样" | 将 `t` 采样集中在中间值附近，那里梯度最强。 |
| 一致性蒸馏（Consistency distillation） | "1 步采样器" | 训练一个学生模型，将任意 `x_t` 直接映射到 `x_0`。 |
| 速度引导的无分类器引导（CFG with velocity） | "v-CFG" | `v_cfg = (1+w) v_cond - w v_uncond`；相同的技巧，新的变量。 |

## 生产说明：Flux.1-schnell 是最快的流匹配

流匹配在生产中的胜利是 Flux.1-schnell——一个经过流匹配的 DiT，被蒸馏到 1-4 推理步数，同时保持了 Flux-dev 级别的质量。Niels 的“在 8GB 机器上运行 Flux”笔记本是参考部署方案：T5 + CLIP 编码，量化 MMDiT 去噪（schnell 用 4 步，dev 用 50 步），VAE 解码。成本核算：

| 变体 | 步数 | L4 上 1024² 延迟 | 总 FLOPs（相对） |
|---------|-------|------------------------|------------------------|
| Flux.1-dev (原始) | 50 | ≈ 15 秒 | 1.0× |
| Flux.1-schnell | 4 | ≈ 1.2 秒 | 0.08× (快 12 倍) |
| SDXL-base | 30 | ≈ 4 秒 | 0.25× |
| SDXL-Lightning 2 步 | 2 | ≈ 0.3 秒 | 0.03× |

生产规则：**流匹配基模型 + 蒸馏 = 2026 年快速文生图的默认方案。** 每个主要厂商都使用这个组合：SD3-Turbo（SD3 + 流 + 蒸馏）、Flux-schnell（Flux-dev + 校正流拉直）、CogView-4-Flash。纯扩散基模型仅用于遗留检查点。

## 进一步阅读

- [Liu, Gong, Liu (2022). Flow Straight and Fast: Learning to Generate and Transfer Data with Rectified Flow](https://arxiv.org/abs/2209.03003) — 校正流。
- [Lipman et al. (2023). Flow Matching for Generative Modeling](https://arxiv.org/abs/2210.02747) — 流匹配。
- [Esser et al. (2024). Scaling Rectified Flow Transformers for High-Resolution Image Synthesis](https://arxiv.org/abs/2403.03206) — SD3，大规模校正流。
- [Albergo, Vanden-Eijnden (2023). Stochastic Interpolants](https://arxiv.org/abs/2303.08797) — 涵盖流匹配 + 扩散的通用框架。
- [Song et al. (2023). Consistency Models](https://arxiv.org/abs/2303.01469) — 扩散/流的一步蒸馏。
- [Sauer et al. (2023). Adversarial Diffusion Distillation (SDXL-Turbo)](https://arxiv.org/abs/2311.17042) — Turbo 变体。
- [Black Forest Labs (2024). Flux.1 models](https://blackforestlabs.ai/announcing-black-forest-labs/) — 生产中的流匹配。