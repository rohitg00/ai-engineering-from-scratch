# 06 · 扩散模型——从零实现 DDPM

> Ho、Jain、Abbeel（2020）给这个领域留下了一个让人欲罢不能的配方：用上千个微小步骤把数据逐步破坏成噪声，训练一个神经网络去预测噪声，然后在推理时反转整个过程。如今每一个主流的图像、视频、3D 和音乐模型都跑在这个循环上，只是可能在它之上叠加了流匹配（flow matching）或一致性（consistency）技巧。

**类型：** 构建
**语言：** Python
**前置：** 阶段 3 · 02（反向传播）、阶段 8 · 02（VAE）
**时长：** 约 75 分钟

## 问题所在

你想要一个针对 `p_data(x)` 的采样器。「生成对抗网络（GAN）」玩的是一个极小化极大（minimax）博弈，经常发散。「变分自编码器（VAE）」从高斯解码器中产出模糊的样本。你真正想要的是这样一个训练目标：(a) 是单一稳定的损失（没有鞍点，没有 minimax）；(b) 是 `log p(x)` 的下界（这样你就有了似然）；(c) 样本质量能达到「最先进水平（SOTA）」。

Sohl-Dickstein 等人（2015）给出了一个理论上的答案：定义一条「马尔可夫链（Markov chain）」`q(x_t | x_{t-1})`，逐步加入高斯噪声，再训练一条反向链 `p_θ(x_{t-1} | x_t)` 来去噪。Ho、Jain、Abbeel（2020）证明了这个损失可以简化为一行——预测噪声——并把数学推导整理得干净利落。在 2020 年这还只是个新奇玩意儿。到 2021 年它产出了最先进的样本。到 2022 年它变成了 Stable Diffusion。到 2026 年它已成为整个领域的基底。

## 核心概念

〔图：DDPM——正向加噪、反向去噪〕

**正向过程 `q`。** 用 `T` 个微小步骤加入高斯噪声。其闭式解——也正是数学之所以可解的原因——在于累计步骤本身也是高斯的：

```
q(x_t | x_0) = N( sqrt(α̅_t) · x_0,  (1 - α̅_t) · I )
```

其中对于一个 `β_t` 调度，`α̅_t = ∏_{s=1..t} (1 - β_s)`。在 T=1000 步上让 `β_t` 从 1e-4 线性增长到 0.02，`x_T` 就近似为 `N(0, I)`。

**反向过程 `p_θ`。** 学习一个神经网络 `ε_θ(x_t, t)`，让它预测此前加入的噪声。给定 `x_t`，按下式去噪：

```
x_{t-1} = (1 / sqrt(α_t)) · ( x_t - (β_t / sqrt(1 - α̅_t)) · ε_θ(x_t, t) )  +  σ_t · z
```

其中 `σ_t` 取 `sqrt(β_t)`，或取一个学习得到的方差。这个表达式看着难看，但它只不过是代数运算——在给定后验 `q(x_{t-1} | x_t, x_0)` 的条件下求解 `x_{t-1}`，再把 `x_0` 替换为它的噪声预测估计值。

**训练损失。**

```
L_simple = E_{x_0, t, ε} [ || ε - ε_θ( sqrt(α̅_t) · x_0 + sqrt(1 - α̅_t) · ε,  t ) ||² ]
```

从数据中采样 `x_0`，随机挑一个 `t`，采样 `ε ~ N(0, I)`，借助闭式解一步算出带噪的 `x_t`，然后对噪声做回归。一个损失，没有 minimax，没有 KL，没有重参数化技巧。

**采样。** 从 `x_T ~ N(0, I)` 开始。从 `t = T` 到 `1` 迭代反向步骤。完成。

## 它为什么有效

三个直觉：

1. **去噪很容易；生成很难。** 在 `t=T` 时，数据是纯噪声——神经网络要解的是一个平凡的问题。在 `t=0` 时，神经网络只需要清理掉几个像素。在中间的 `t` 上，问题很难，但来自每一个噪声层级的大量梯度都流经同一套权重。

2. **本质上是伪装的分数匹配。** Vincent（2011）证明了预测噪声等价于估计 `∇_x log q(x_t | x_0)`，即「分数（score）」。反向「随机微分方程（SDE）」利用这个分数沿密度梯度向上游走——这是一次朝着高概率区域定向行进的随机游走。

3. **ELBO 退化为简单的 MSE。** 完整的「变分下界（ELBO）」在每个时间步都有一个 KL 项。在 DDPM 的参数化下，这些 KL 项简化为带特定系数的噪声预测「均方误差（MSE）」；Ho 把这些系数丢掉了（称之为「simple」损失），质量反而*提升*了。

## 动手构建

`code/main.py` 实现了一个一维 DDPM。数据是一个双峰混合分布。这个「网络」是一个极小的 MLP，接收 `(x_t, t)` 并输出预测噪声。训练就是那一行损失。采样则迭代反向链。

### 第 1 步：正向调度（闭式解）

```python
betas = [1e-4 + (0.02 - 1e-4) * t / (T - 1) for t in range(T)]
alphas = [1 - b for b in betas]
alpha_bars = []
cum = 1.0
for a in alphas:
    cum *= a
    alpha_bars.append(cum)
```

### 第 2 步：一步采样出 `x_t`

```python
def forward_sample(x0, t, alpha_bars, rng):
    a_bar = alpha_bars[t]
    eps = rng.gauss(0, 1)
    x_t = math.sqrt(a_bar) * x0 + math.sqrt(1 - a_bar) * eps
    return x_t, eps
```

### 第 3 步：一次训练步

```python
def train_step(x0, model, alpha_bars, rng):
    t = rng.randrange(T)
    x_t, eps = forward_sample(x0, t, alpha_bars, rng)
    eps_hat = model_forward(model, x_t, t)
    loss = (eps - eps_hat) ** 2
    return loss, gradient_step(model, ...)
```

### 第 4 步：反向采样

```python
def sample(model, alpha_bars, T, rng):
    x = rng.gauss(0, 1)
    for t in range(T - 1, -1, -1):
        eps_hat = model_forward(model, x, t)
        beta_t = 1 - alphas[t]
        x = (x - beta_t / math.sqrt(1 - alpha_bars[t]) * eps_hat) / math.sqrt(alphas[t])
        if t > 0:
            x += math.sqrt(beta_t) * rng.gauss(0, 1)
    return x
```

对于一个 40 个时间步、24 个单元的 MLP 的一维问题，大约 200 个 epoch 就能学会这个双峰混合分布。

## 时间步条件化

网络需要知道它正在为哪个时间步去噪。两种标准做法：

- **正弦嵌入（sinusoidal embedding）。** 类似 Transformer 的位置编码。`embed(t) = [sin(t/ω_0), cos(t/ω_0), sin(t/ω_1), ...]`。经过一个 MLP，再广播到网络中。
- **FiLM / 组归一化条件化。** 把嵌入投影成每通道的缩放/偏置（FiLM），在每个模块中施加。

我们的玩具代码用的是正弦嵌入→拼接。生产级 U-Net 用的是 FiLM。

## 易踩的坑

- **调度的影响很大。** 线性 `β` 是 DDPM 的默认选择，但余弦调度（cosine schedule，Nichol & Dhariwal，2021）在相同算力下能给出更好的 FID。如果质量遇到瓶颈，就换调度。
- **时间步嵌入很脆弱。** 把原始的 `t` 当作浮点数直接传入，对一维玩具问题有效，但对图像会失败；始终要用一个合适的嵌入。
- **V 预测 vs ε 预测。** 对于极端区间（极小或极大的 t），`ε` 的信噪比很差。V 预测（`v = α·ε - σ·x`）更稳定；SDXL、SD3 和 Flux 都用它。
- **无分类器引导（classifier-free guidance）。** 在推理时同时计算条件和无条件的 `ε`，然后 `ε_cfg = (1 + w) · ε_cond - w · ε_uncond`，其中 `w ≈ 3-7`。详见第 08 课。
- **1000 步太多了。** 生产环境用 DDIM（20-50 步）、DPM-Solver（10-20 步），或蒸馏（1-4 步）。详见第 12 课。

## 实际应用

| 角色 | 2026 年的典型技术栈 |
|------|-----------------------|
| 图像像素空间扩散（小型、玩具级） | DDPM + U-Net |
| 图像隐空间扩散 | VAE 编码器 + U-Net 或 DiT（第 07 课） |
| 视频隐空间扩散 | 时空 DiT（Sora、Veo、WAN） |
| 音频隐空间扩散 | Encodec + 扩散 Transformer |
| 科学（分子、蛋白质、物理） | 等变扩散（EDM、RFdiffusion、AlphaFold3） |

扩散是通用的生成主干。流匹配（flow matching，第 13 课）是 2024-2026 年的竞争者，在同等质量下通常在推理速度上胜出。

## 交付落地

保存 `outputs/skill-diffusion-trainer.md`。这个技能接收一个数据集 + 算力预算，并输出：调度（线性/余弦/sigmoid）、预测目标（ε/v/x）、步数、引导强度、采样器族，以及一套评估协议。

## 练习

1. **简单。** 在 `code/main.py` 中把 T 从 40 改成 10。样本质量（输出的可视化直方图）如何退化？在哪个 T 值下双峰结构会崩塌？
2. **中等。** 从 ε 预测切换到 v 预测。重新推导反向步骤。比较最终样本质量。
3. **困难。** 加入无分类器引导。以一个类别标签 `c ∈ {0, 1}` 作为条件，在训练时有 10% 的概率丢弃它，采样时用 `ε = (1+w)·ε_cond - w·ε_uncond`。在 `w = 0, 1, 3, 7` 下测量条件模式命中率。

## 关键术语

| 术语 | 人们怎么说 | 它实际指什么 |
|------|-----------------|-----------------------|
| 正向过程 | 「加噪声」 | 破坏数据的固定马尔可夫链 `q(x_t \| x_{t-1})`。 |
| 反向过程 | 「去噪」 | 重建数据的学习链 `p_θ(x_{t-1} \| x_t)`。 |
| β 调度 | 「噪声阶梯」 | 每步的方差；线性、余弦或 sigmoid。 |
| α̅ | 「alpha bar」 | 累积乘积 `∏(1 - β)`；由 `x_0` 给出闭式的 `x_t`。 |
| simple 损失 | 「噪声的 MSE」 | `\|\|ε - ε_θ(x_t, t)\|\|²`；所有变分推导都坍缩到这个。 |
| ε 预测 | 「预测噪声」 | 输出是所加入的噪声；标准 DDPM。 |
| V 预测 | 「预测速度」 | 输出是 `α·ε - σ·x`；在不同 t 上的条件化更好。 |
| DDPM | 「那篇论文」 | Ho 等人 2020；线性 β、1000 步、U-Net。 |
| DDIM | 「确定性采样器」 | 非马尔可夫采样器，20-50 步，训练目标相同。 |
| 无分类器引导 | 「CFG」 | 混合条件和无条件的噪声预测，以放大条件作用。 |

## 生产说明：扩散推理是一个步数问题

DDPM 论文跑 T=1000 个反向步骤。没有人会在生产环境里这么发布。每一套真实的推理栈都会从三种策略里挑一种——而每一种都能干净地对应到生产框架中「延迟从哪来」的提问：

1. **更快的采样器，同一个模型。** DDIM（20-50 步）、DPM-Solver++（10-20 步）、UniPC（8-16 步）。直接替换反向循环；训练好的 `ε_θ` 权重原封不动。把延迟削减 20-50 倍。
2. **蒸馏。** 训练一个学生模型用更少步数匹配教师：渐进式蒸馏（Progressive Distillation，2 → 1）、一致性模型（Consistency Models，任意 → 1-4）、LCM、SDXL-Turbo、SD3-Turbo。再把延迟削减 5-10 倍，需要重新训练。
3. **缓存与编译。** `torch.compile(unet, mode="reduce-overhead")`、TensorRT-LLM 的扩散后端、`xformers`/SDPA 注意力、bf16 权重。把每步延迟削减约 2 倍。可与（1）和（2）叠加。

对于一个生产级扩散服务，预算的讨论与生产文献对 LLM 的描述如出一辙：延迟是 `num_steps × step_cost + VAE_decode`，吞吐是 `batch_size × (num_steps × step_cost)^-1`。TTFT 很小（一步）；从用户角度看图像生成是「一次性全部产出」的，因此等价于 TPOT 的指标其实就是完整的响应时间。

## 延伸阅读

- [Sohl-Dickstein et al. (2015). Deep Unsupervised Learning using Nonequilibrium Thermodynamics](https://arxiv.org/abs/1503.03585) —— 扩散论文，远超时代。
- [Ho, Jain, Abbeel (2020). Denoising Diffusion Probabilistic Models](https://arxiv.org/abs/2006.11239) —— DDPM。
- [Song, Meng, Ermon (2021). Denoising Diffusion Implicit Models](https://arxiv.org/abs/2010.02502) —— DDIM，更少步数。
- [Nichol & Dhariwal (2021). Improved DDPM](https://arxiv.org/abs/2102.09672) —— 余弦调度、学习方差。
- [Dhariwal & Nichol (2021). Diffusion Models Beat GANs on Image Synthesis](https://arxiv.org/abs/2105.05233) —— 分类器引导。
- [Ho & Salimans (2022). Classifier-Free Diffusion Guidance](https://arxiv.org/abs/2207.12598) —— CFG。
- [Karras et al. (2022). Elucidating the Design Space of Diffusion-Based Generative Models (EDM)](https://arxiv.org/abs/2206.00364) —— 统一记号，最干净的配方。
