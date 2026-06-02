# Flow Matching 与 Rectified Flow

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> Diffusion 模型（扩散模型）需要 20-50 步采样，因为它从噪声到数据走的是一条弯路。Flow matching（Lipman 等，2023）和 rectified flow（Liu 等，2022）训练的是直线路径。路径越直，所需步数越少，推理也就越快。Stable Diffusion 3、Flux.1、AudioCraft 2 都在 2024 年切换到了 flow matching。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 8 · 06 (DDPM), Phase 1 · Calculus
**Time:** ~45 minutes

## 问题（The Problem）

DDPM 的反向过程是一条从 `N(0, I)` 走回数据分布的 1000 步随机游走。DDIM 把它压缩到了 20-50 步的确定性采样。你想要更少的步数——理想情况下只需一步。瓶颈在于求解反向过程的 ODE 是刚性的，路径是弯的。

如果你能让模型训练出一条从噪声到数据的*直线路径*，那么从 `t=1` 到 `t=0` 的单步 Euler（欧拉）积分就够了。Flow matching 直接构建了这一目标：定义一条从 `x_1 ∼ N(0, I)` 到 `x_0 ∼ data` 的直线插值，训练一个向量场 `v_θ(x, t)` 去匹配它的时间导数，然后在推理时积分。

Rectified flow（Liu 2022）走得更远：通过一种 reflow 流程迭代地把路径拉直，得到一个越来越接近线性的 ODE。两轮 reflow 之后，2 步采样器就能匹配 50 步 DDPM 的质量。

## 概念（The Concept）

![Flow matching：噪声与数据之间的直线插值](../assets/flow-matching.svg)

### 直线流（Straight-line flow）

定义：

```
x_t = t · x_1 + (1 - t) · x_0,   t ∈ [0, 1]
```

其中 `x_0 ~ data`，`x_1 ~ N(0, I)`。沿这条直线的时间导数是常数：

```
dx_t / dt = x_1 - x_0
```

定义一个神经向量场 `v_θ(x_t, t)`，训练它去匹配这个导数：

```
L = E_{x_0, x_1, t} || v_θ(x_t, t) - (x_1 - x_0) ||²
```

这就是 **conditional flow matching**（条件流匹配）损失（Lipman 2023）。训练是 simulation-free（无需仿真）的：你完全不用展开 ODE，只需采样 `(x_0, x_1, t)` 然后做回归。

### 采样（Sampling）

推理时，沿时间*反向*积分学到的向量场：

```
x_{t-Δt} = x_t - Δt · v_θ(x_t, t)
```

从 `x_1 ~ N(0, I)` 起步，用 Euler 步逐步降到 `t=0`。

### Rectified flow（Liu 2022）

直线流能用，但学到的路径*实际并不直*——它们会弯，因为很多 `x_0` 可以映射到同一个 `x_1`。Rectified flow 的 reflow 步骤：

1. 用随机配对训练 flow 模型 v_1。
2. 通过把 v_1 从 `x_1` 积分到它落地的 `x_0`，采样 N 对 `(x_1, x_0)`。
3. 在这些配对样本上训练 v_2。因为现在的配对是「ODE 匹配」过的，它们之间的直线插值真的更平了。
4. 重复。

实际中两轮 reflow 就能让你接近线性，从而支持 2-4 步推理。SDXL-Turbo、SD3-Turbo、LCM 都是从 flow matching 蒸馏出来的模型。

### 它为什么在 2024 年的图像领域胜出

三个原因：

1. **Simulation-free 训练**——训练时不用展开 ODE，实现起来非常简单。
2. **更好的损失几何**——直线路径有一致的信噪比，而 DDPM 的 ε-loss 在 schedule 两端的 SNR（信噪比）很糟。
3. **更快的推理**——在 SDXL-Turbo 质量下只需 4-8 步；用 consistency distillation（一致性蒸馏）则只需 1 步。

## Flow matching 与 DDPM——精确的关系

带高斯条件路径的 flow matching 就是*带特定噪声 schedule 的*扩散模型。选 `x_t = α(t) x_0 + σ(t) x_1` 这个 schedule，flow matching 就恢复出了 Stratonovich 重写形式的扩散，其中 `v = α'·x_0 - σ'·x_1`。在高斯路径下两者代数等价。

Flow matching 多带来的是：目标的*清晰性*（一个朴素的速度），更干净的 loss，以及实验非高斯插值的「许可证」。

## 动手实现（Build It）

`code/main.py` 在一个二模高斯混合上实现了一维的 flow matching。向量场 `v_θ(x, t)` 是一个小 MLP，用直线目标训练。推理时分别用 1、2、4、20 步 Euler 积分，对比采样质量。

### Step 1：训练损失

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

### Step 2：多步推理

```python
def sample(net, num_steps):
    x = rng.gauss(0, 1)
    for i in range(num_steps):
        t = 1.0 - i / num_steps
        dt = 1.0 / num_steps
        x -= dt * net_forward(x, t)
    return x
```

### Step 3：对比步数

预期 4 步采样器就能匹配 20 步的质量——这对延迟来说是大事。

## 坑（Pitfalls）

- **时间参数化。** Flow matching 用 `t ∈ [0, 1]`，`t=0` 是数据，`t=1` 是噪声。DDPM 用 `t ∈ [0, T]`，`t=0` 是数据，`t=T` 是噪声。方向相同，尺度不同。论文里这一点经常搞错。
- **Schedule 选择。** Rectified flow 的直线是「那个」flow-matching schedule，但你也可以用 cosine 或 logit-normal 的 t 采样（SD3 就这么做）来获得更好的尺度覆盖。
- **Reflow 成本。** 为 reflow 生成配对数据集，每个样本都要走一次完整的推理。只有在你真的需要 1-2 步推理时才做 reflow。
- **Classifier-free guidance 仍然适用。** 在线性组合里把 ε 换成 v 即可：`v_cfg = (1+w) v_cond - w v_uncond`。

## 用起来（Use It）

| 用例 | 2026 技术栈 |
|----------|-----------|
| 文生图，最佳质量 | Flow matching：SD3、Flux.1-dev |
| 文生图，1-4 步 | 蒸馏后的 flow matching：Flux.1-schnell、SD3-Turbo、SDXL-Turbo |
| 实时推理 | 从 flow-matched 基模做 consistency distillation（LCM、PCM） |
| 音频生成 | Flow matching：Stable Audio 2.5、AudioCraft 2 |
| 视频生成 | Flow matching 与 diffusion 混合（Sora、Veo、Stable Video） |
| 科学 / 物理（粒子轨迹、分子） | Flow matching + 等变向量场 |

2025-2026 年只要论文说「比 diffusion 更快」，几乎都是 flow matching + 蒸馏。

## 上线部署（Ship It）

保存 `outputs/skill-fm-tuner.md`。Skill 接收一份 diffusion 风格的模型规格，把它转成 flow-matching 训练配置：schedule 选择、时间采样分布（uniform / logit-normal）、optimizer、reflow 计划、目标步数、评估协议。

## 练习（Exercises）

1. **简单。** 跑 `code/main.py`，对比 1 步 vs 20 步相对真实数据分布的 MSE。
2. **中等。** 把 t 的均匀采样换成 logit-normal（采样集中在 t 中段）。模型质量提升了吗？
3. **困难。** 实现一轮 reflow：用第一个模型积分生成配对的 (x_0, x_1)，在这些配对上训练第二个模型，对比 1 步采样质量。

## 关键术语（Key Terms）

| 术语 | 别人怎么说 | 真正的含义 |
|------|-----------------|-----------------------|
| Flow matching | 「直线 diffusion」 | 训练 `v_θ(x, t)` 去匹配插值路径上的 `x_1 - x_0`。 |
| Rectified flow | 「Reflow」 | 迭代拉直已学到的 flow 的流程。 |
| Velocity field（速度场） | 「v_θ」 | 模型的输出——`x_t` 该往哪个方向走。 |
| 直线插值（Straight-line interpolant） | 「那条路径」 | `x_t = (1-t)·x_0 + t·x_1`；目标导数极其简单。 |
| Euler 采样器 | 「一阶 ODE solver」 | 最简单的积分器；当路径是直线时表现很好。 |
| Logit-normal t | 「SD3 采样」 | 把 `t` 采样集中到梯度最强的中段。 |
| Consistency distillation | 「1 步采样器」 | 训练一个学生模型，把任意 `x_t` 直接映射到 `x_0`。 |
| 带速度的 CFG | 「v-CFG」 | `v_cfg = (1+w) v_cond - w v_uncond`；同样的把戏，换了变量。 |

## 生产笔记：Flux.1-schnell 是 flow matching 跑得最快的版本

Flow matching 的生产代表作就是 Flux.1-schnell——一个 flow-matched DiT，被蒸馏到 1-4 步推理，同时保持 Flux-dev 级别的质量。Niels 那本「在 8GB 机器上跑 Flux」的笔记本就是参考部署配方：T5 + CLIP 编码、量化后的 MMDiT 去噪（schnell 4 步 vs dev 50 步）、VAE 解码。成本账：

| Variant | Steps | L4 上 1024² 的 latency | 总 FLOPs（相对值） |
|---------|-------|------------------------|------------------------|
| Flux.1-dev（原始） | 50 | ~15 s | 1.0× |
| Flux.1-schnell | 4 | ~1.2 s | 0.08×（快 12 倍） |
| SDXL-base | 30 | ~4 s | 0.25× |
| SDXL-Lightning 2-step | 2 | ~0.3 s | 0.03× |

生产层面的规则：**flow-matched 基模 + 蒸馏 = 2026 年快速文生图的默认组合。**每家主流厂商都在出这个组合：SD3-Turbo（SD3 + flow + 蒸馏）、Flux-schnell（Flux-dev + rectified-flow 拉直）、CogView-4-Flash。纯 diffusion 基模只剩 legacy checkpoint 在用。

## 延伸阅读（Further Reading）

- [Liu, Gong, Liu (2022). Flow Straight and Fast: Learning to Generate and Transfer Data with Rectified Flow](https://arxiv.org/abs/2209.03003) — rectified flow。
- [Lipman et al. (2023). Flow Matching for Generative Modeling](https://arxiv.org/abs/2210.02747) — flow matching。
- [Esser et al. (2024). Scaling Rectified Flow Transformers for High-Resolution Image Synthesis](https://arxiv.org/abs/2403.03206) — SD3，规模化的 rectified flow。
- [Albergo, Vanden-Eijnden (2023). Stochastic Interpolants](https://arxiv.org/abs/2303.08797) — 涵盖 FM + diffusion 的通用框架。
- [Song et al. (2023). Consistency Models](https://arxiv.org/abs/2303.01469) — diffusion / flow 的 1 步蒸馏。
- [Sauer et al. (2023). Adversarial Diffusion Distillation (SDXL-Turbo)](https://arxiv.org/abs/2311.17042) — turbo 变体。
- [Black Forest Labs (2024). Flux.1 models](https://blackforestlabs.ai/announcing-black-forest-labs/) — 生产中的 flow matching。
