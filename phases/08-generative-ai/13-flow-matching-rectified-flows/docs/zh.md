# 13 · 流匹配与整流流

> 扩散模型需要 20-50 个采样步，因为它们从噪声到数据走的是一条弯曲的路径。流匹配（flow matching，Lipman 等，2023）和整流流（rectified flow，Liu 等，2022）训练的是直线路径。路径越直，所需步数越少，推理就越快。Stable Diffusion 3、Flux.1 和 AudioCraft 2 都在 2024 年切换到了流匹配。

**类型：** 实践
**语言：** Python
**前置：** 第 8 阶段 · 06（DDPM），第 1 阶段 · 微积分
**时长：** 约 45 分钟

## 问题所在

DDPM 的反向过程是一条从 `N(0, I)` 走回数据分布的 1000 步随机游走。DDIM 把它压缩到了 20-50 个确定性步。你希望步数更少——理想情况下只要一步。障碍在于：求解反向过程的常微分方程（ODE）是刚性的，路径是弯曲的。

如果你能把模型训练成：从噪声到数据的路径是一条*直线*，那么从 `t=1` 到 `t=0` 的单次欧拉步（Euler step）就足够了。流匹配（flow matching）直接构建出这一点：定义一条从 `x_1 ∼ N(0, I)` 到 `x_0 ∼ data` 的直线插值，训练一个向量场（vector field）`v_θ(x, t)` 去匹配它的时间导数，推理时再积分。

整流流（rectified flow，Liu 2022）更进一步：用一个 reflow 过程迭代地把路径拉直，从而得到一个逐渐趋于线性的 ODE。经过两次 reflow 迭代后，一个 2 步采样器就能匹配 50 步 DDPM 的质量。

## 核心概念

〔图：流匹配——噪声与数据之间的直线插值〕

### 直线流

定义：

```
x_t = t · x_1 + (1 - t) · x_0,   t ∈ [0, 1]
```

其中 `x_0 ~ data`、`x_1 ~ N(0, I)`。沿这条直线的时间导数是常数：

```
dx_t / dt = x_1 - x_0
```

定义一个神经向量场 `v_θ(x_t, t)`，训练它去匹配这个导数：

```
L = E_{x_0, x_1, t} || v_θ(x_t, t) - (x_1 - x_0) ||²
```

这就是**条件流匹配（conditional flow matching）**损失（Lipman 2023）。训练是免仿真（simulation-free）的：你从不展开 ODE。只需采样 `(x_0, x_1, t)` 然后回归即可。

### 采样

在推理时，沿时间*反向*积分学到的向量场：

```
x_{t-Δt} = x_t - Δt · v_θ(x_t, t)
```

从 `x_1 ~ N(0, I)` 出发，用欧拉步一路降到 `t=0`。

### 整流流（Liu 2022）

直线流是可行的，但学到的路径*实际上并不是直的*——它们会弯曲，因为许多 `x_0` 可以映射到同一个 `x_1`。整流流的 reflow 步骤如下：

1. 用随机配对训练流模型 v_1。
2. 通过把 v_1 从 `x_1` 积分到它的落点 `x_0`，采样 N 对 `(x_1, x_0)`。
3. 在这些配对样本上训练 v_2。因为这些配对现在是「ODE 匹配的」，它们之间的直线插值确实更平直了。
4. 重复。

实践中，2 次 reflow 迭代就能让你接近线性，从而实现 2-4 步推理。SDXL-Turbo、SD3-Turbo、LCM 都是从流匹配蒸馏而来的模型。

### 为什么它在 2024 年的图像生成中胜出

三个原因：

1. **免仿真训练**——训练期间无需展开 ODE，实现起来非常简单。
2. **更好的损失几何**——直线路径有一致的信噪比（signal-to-noise），而 DDPM 的 ε-损失在调度（schedule）两端的信噪比很差。
3. **更快的推理**——在 SDXL-Turbo 质量下只需 4-8 步；用一致性蒸馏（consistency distillation）只需 1 步。

## 流匹配 vs DDPM——精确的联系

带高斯条件路径的流匹配，就是*带特定噪声调度*的扩散。选取 `x_t = α(t) x_0 + σ(t) x_1` 这一调度，流匹配就还原成了 Stratonovich 重表述（Stratonovich-reformulated）的扩散，其中 `v = α'·x_0 - σ'·x_1`。对于高斯路径，二者在代数上是等价的。

流匹配带来的增量是：目标的*清晰性*（一个朴素的速度量）、更干净的损失，以及尝试非高斯插值的余地。

## 动手构建

`code/main.py` 在一个双峰高斯混合分布上实现了一维流匹配。向量场 `v_θ(x, t)` 是一个用直线目标训练的微型 MLP。在推理时，分别用 1、2、4、20 个欧拉步积分，并比较样本质量。

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

预期 4 步采样器已经能匹配 20 步的质量——这对延迟来说是个大优势。

## 常见陷阱

- **时间参数化。** 流匹配使用 `t ∈ [0, 1]`，`t=0` 处为数据、`t=1` 处为噪声。DDPM 使用 `t ∈ [0, T]`，`t=0` 处为数据、`t=T` 处为噪声。方向相同，尺度不同。论文里经常把这一点搞错。
- **调度选择。** 整流流的直线是「那个」流匹配调度，但你也可以使用余弦或 logit-normal 的 t-采样（SD3 就是这么做的），以获得更好的尺度覆盖。
- **reflow 成本。** 为 reflow 生成配对数据集，每个样本都要做一次完整推理。只有在你确实需要 1-2 步推理时才做 reflow。
- **无分类器引导（classifier-free guidance）依然适用。** 只需在线性组合中把 ε 换成 v：`v_cfg = (1+w) v_cond - w v_uncond`。

## 实战应用

| 用例 | 2026 技术栈 |
|----------|-----------|
| 文生图，最佳质量 | 流匹配：SD3、Flux.1-dev |
| 文生图，1-4 步 | 蒸馏流匹配：Flux.1-schnell、SD3-Turbo、SDXL-Turbo |
| 实时推理 | 从流匹配基座蒸馏的一致性模型（LCM、PCM） |
| 音频生成 | 流匹配：Stable Audio 2.5、AudioCraft 2 |
| 视频生成 | 流匹配与扩散混合（Sora、Veo、Stable Video） |
| 科学 / 物理（粒子轨迹、分子） | 流匹配 + 等变向量场（equivariant vector field） |

每当 2025-2026 年有论文说「比扩散更快」，几乎总是指流匹配 + 蒸馏。

## 交付物

保存 `outputs/skill-fm-tuner.md`。该 skill 接收一份扩散风格的模型规格，并把它转换成流匹配训练配置：调度选择、时间采样分布（uniform / logit-normal）、优化器、reflow 计划、目标步数、评估协议。

## 练习

1. **简单。** 运行 `code/main.py`，比较 1 步与 20 步相对于真实数据分布的 MSE。
2. **中等。** 把均匀 `t` 采样换成 logit-normal（把采样集中在 t 的中段）。模型质量提升了吗？
3. **困难。** 实现一次 reflow 迭代：通过积分第一个模型生成配对的 (x_0, x_1)，在配对数据上训练第二个模型，并比较 1 步采样质量。

## 关键术语

| 术语 | 人们怎么说 | 它实际指什么 |
|------|-----------------|-----------------------|
| 流匹配（Flow matching） | 「直线扩散」 | 训练 `v_θ(x, t)` 去沿插值匹配 `x_1 - x_0`。 |
| 整流流（Rectified flow） | 「Reflow」 | 把学到的流拉直的迭代过程。 |
| 速度场（Velocity field） | 「v_θ」 | 模型的输出——移动 `x_t` 的方向。 |
| 直线插值（Straight-line interpolant） | 「那条路径」 | `x_t = (1-t)·x_0 + t·x_1`；目标导数很平凡。 |
| 欧拉采样器（Euler sampler） | 「一阶 ODE 求解器」 | 最简单的积分器；当路径是直的时效果很好。 |
| Logit-normal t | 「SD3 采样」 | 把 `t` 采样集中到梯度最强的中段值。 |
| 一致性蒸馏（Consistency distillation） | 「1 步采样器」 | 训练一个学生模型，把任意 `x_t` 直接映射到 `x_0`。 |
| 带速度的 CFG | 「v-CFG」 | `v_cfg = (1+w) v_cond - w v_uncond`；同样的技巧，换了个变量。 |

## 生产笔记：Flux.1-schnell 是流匹配最快的形态

流匹配在生产上的胜利是 Flux.1-schnell——一个流匹配的 DiT，蒸馏到 1-4 个推理步，同时保持 Flux-dev 级别的质量。Niels 的「在 8GB 机器上运行 Flux」笔记本是参考部署配方：T5 + CLIP 编码、量化 MMDiT 去噪（schnell 用 4 步，dev 用 50 步）、VAE 解码。成本账如下：

| 变体 | 步数 | 在 L4 上 1024² 的延迟 | 总 FLOPs（相对） |
|---------|-------|------------------------|------------------------|
| Flux.1-dev（原始） | 50 | 约 15 s | 1.0× |
| Flux.1-schnell | 4 | 约 1.2 s | 0.08×（快 12 倍） |
| SDXL-base | 30 | 约 4 s | 0.25× |
| SDXL-Lightning 2 步 | 2 | 约 0.3 s | 0.03× |

生产法则：**流匹配基座 + 蒸馏 = 2026 年快速文生图的默认方案。** 每家主流厂商都推出了这个组合：SD3-Turbo（SD3 + 流 + 蒸馏）、Flux-schnell（Flux-dev + 整流流拉直）、CogView-4-Flash。纯扩散基座只存在于遗留的检查点（checkpoint）中。

## 延伸阅读

- [Liu, Gong, Liu (2022). Flow Straight and Fast: Learning to Generate and Transfer Data with Rectified Flow](https://arxiv.org/abs/2209.03003) ——整流流。
- [Lipman et al. (2023). Flow Matching for Generative Modeling](https://arxiv.org/abs/2210.02747) ——流匹配。
- [Esser et al. (2024). Scaling Rectified Flow Transformers for High-Resolution Image Synthesis](https://arxiv.org/abs/2403.03206) ——SD3，大规模整流流。
- [Albergo, Vanden-Eijnden (2023). Stochastic Interpolants](https://arxiv.org/abs/2303.08797) ——涵盖流匹配 + 扩散的通用框架。
- [Song et al. (2023). Consistency Models](https://arxiv.org/abs/2303.01469) ——扩散 / 流的 1 步蒸馏。
- [Sauer et al. (2023). Adversarial Diffusion Distillation (SDXL-Turbo)](https://arxiv.org/abs/2311.17042) ——turbo 变体。
- [Black Forest Labs (2024). Flux.1 models](https://blackforestlabs.ai/announcing-black-forest-labs/) ——流匹配在生产中的应用。
