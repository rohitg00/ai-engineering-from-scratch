# 扩散模型——从头实现DDPM

> Ho, Jain, Abbeel (2020) 给这个领域提供了一个无法抗拒的配方。通过一千个微小的步骤用噪声破坏数据。训练一个神经网络预测噪声。在推理时逆转这个过程。如今所有主流的图像、视频、3D和音乐模型都运行在这个循环上，可能在其上叠加了流匹配或一致性技巧。

**类型：** 构建
**语言：** Python
**前置条件：** 阶段3·02（反向传播），阶段8·02（变分自编码器）
**时间：** ~75分钟

## 问题

你想要一个能够采样 `p_data(x)` 的采样器。生成对抗网络（GAN）玩的是一种经常发散的极小极大博弈。变分自编码器（VAE）从高斯解码器产生模糊的样本。你真正需要的是一个训练目标，它（a）是一个单一的稳定损失（没有鞍点，没有极小极大），（b）是 `log p(x)` 的下界（因此你有似然值），并且（c）产生的样本能达到最前沿的质量。

Sohl-Dickstein 等人（2015）有一个理论上的答案：定义一个马尔可夫链 `q(x_t | x_{t-1})`，逐步添加高斯噪声，并训练一个逆向链 `p_θ(x_{t-1} | x_t)` 去噪。Ho、Jain、Abbeel（2020）证明损失可以简化为一行——预测噪声——并清理了数学。2020年这还是一件新奇事。2021年它产生了最先进的样本。2022年它变成了Stable Diffusion。到了2026年，它成为基础。

## 概念

![DDPM：前向加噪，反向去噪](../assets/ddpm.svg)

**前向过程（Forward process）`q`。** 在 `T` 个微小的步骤中添加高斯噪声。其闭合形式——也就是数学易于处理的原因——是累积步骤也是高斯分布：

```
q(x_t | x_0) = N( sqrt(α̅_t) · x_0,  (1 - α̅_t) · I )
```

其中 `α̅_t = ∏_{s=1..t} (1 - β_s)`，`β_s` 是一个预设调度。选择 `β_t` 从 1e-4 到 0.02，在 T=1000 步内线性变化，则 `x_T` 近似为 `N(0, I)`。

**逆向过程（Reverse process）`p_θ`。** 学习一个神经网络 `ε_θ(x_t, t)` 来预测添加的噪声。给定 `x_t`，按如下方式去噪：

```
x_{t-1} = (1 / sqrt(α_t)) · ( x_t - (β_t / sqrt(1 - α̅_t)) · ε_θ(x_t, t) )  +  σ_t · z
```

其中 `σ_t` 是 `sqrt(β_t)` 或一个学习的方差。表达式看起来复杂，但只是代数运算——根据后验 `q(x_{t-1} | x_t, x_0)` 解出 `x_{t-1}`，并用噪声预测估计替换 `x_0`。

**训练损失。**

```
L_simple = E_{x_0, t, ε} [ || ε - ε_θ( sqrt(α̅_t) · x_0 + sqrt(1 - α̅_t) · ε,  t ) ||² ]
```

从数据中采样 `x_0`，随机选择一个 `t`，采样 `ε ~ N(0, I)`，通过闭合形式一步计算出带噪的 `x_t`，然后对噪声进行回归。一个损失，没有极小极大，没有KL散度，没有重参数化技巧。

**采样。** 从 `x_T ~ N(0, I)` 开始。从 `t = T` 到 `1` 迭代逆向步骤。完成。

## 为什么有效

三个直觉：

1. **去噪容易，生成难。** 在 `t=T` 时，数据是纯噪声——网络只需解决一个琐碎的问题。在 `t=0` 时，网络只需清理几个像素。在中间的 `t`，问题很难，但网络从所有噪声水平获得大量梯度流过相同的权重。

2. **本质是分数匹配。** Vincent (2011) 证明预测噪声等价于估计 `∇_x log q(x_t | x_0)`，即*分数（score）*。逆向 SDE 利用这个分数沿密度梯度上升——一个朝向高概率区域的引导随机游走。

3. **证据下界（ELBO）简化为简单的均方误差（MSE）。** 完整的变分下界在每个时间步都有一个KL散度项。使用DDPM的参数化，这些KL项简化为带特定系数的噪声预测MSE；Ho去掉了系数（称之为"简单"损失），质量反而*提升了*。

## 构建它

`code/main.py` 实现了一个一维DDPM。数据是双模态混合。"网络"是一个微型多层感知机（MLP），接收 `(x_t, t)` 并输出预测的噪声。训练就是一行的损失。采样迭代逆向链。

### 第1步：前向调度（闭合形式）

```python
# 生成beta调度，从1e-4线性增加到0.02，共T步
betas = [1e-4 + (0.02 - 1e-4) * t / (T - 1) for t in range(T)]
# 计算alpha = 1 - beta
alphas = [1 - b for b in betas]
# 计算累计乘积alpha_bar
alpha_bars = []
cum = 1.0
for a in alphas:
    cum *= a
    alpha_bars.append(cum)
```

### 第2步：一步采样 `x_t`

```python
def forward_sample(x0, t, alpha_bars, rng):
    a_bar = alpha_bars[t]
    eps = rng.gauss(0, 1)  # 采样标准高斯噪声
    x_t = math.sqrt(a_bar) * x0 + math.sqrt(1 - a_bar) * eps
    return x_t, eps
```

### 第3步：一步训练

```python
def train_step(x0, model, alpha_bars, rng):
    t = rng.randrange(T)  # 随机选择时间步
    x_t, eps = forward_sample(x0, t, alpha_bars, rng)
    eps_hat = model_forward(model, x_t, t)  # 模型预测噪声
    loss = (eps - eps_hat) ** 2  # 简单MSE损失
    return loss, gradient_step(model, ...)  # 梯度下降更新
```

### 第4步：逆向采样

```python
def sample(model, alpha_bars, T, rng):
    x = rng.gauss(0, 1)  # 从标准高斯噪声开始
    for t in range(T - 1, -1, -1):
        eps_hat = model_forward(model, x, t)  # 预测噪声
        beta_t = 1 - alphas[t]  # 当前步的beta
        x = (x - beta_t / math.sqrt(1 - alpha_bars[t]) * eps_hat) / math.sqrt(alphas[t])
        if t > 0:
            x += math.sqrt(beta_t) * rng.gauss(0, 1)  # 添加随机噪声（除最后一步）
    return x
```

对于一个40个时间步、24个隐藏单元MLP的一维问题，大约200个epoch就能学会双模态混合分布。

## 时间条件

网络需要知道它在去噪哪个时间步。两个标准选项：

- **正弦嵌入（Sinusoidal embedding）。** 类似于Transformer的位置编码。`embed(t) = [sin(t/ω_0), cos(t/ω_0), sin(t/ω_1), ...]`。通过一个MLP处理，广播到网络中。
- **FIILM / 组归一化条件（Film / group-norm conditioning）。** 在每个块中将嵌入投影为每通道的缩放/偏置（FiLM）。

我们的玩具代码使用正弦嵌入然后拼接。生产环境中的U-Net使用FiLM。

## 陷阱

- **调度非常重要。** 线性 `β` 是DDPM的默认选择，但余弦调度（Nichol & Dhariwal, 2021）能在相同计算量下获得更好的FID。如果质量停滞不前，请切换调度。
- **时间步嵌入很脆弱。** 将原始 `t` 作为浮点数传入对玩具1D有效，但对图像会失败；始终使用合适的嵌入。
- **V预测 vs ε预测。** 对于狭窄区间（非常小或非常大的t），`ε` 的信噪比很差。V预测（`v = α·ε - σ·x`）更稳定；SDXL、SD3和Flux都使用它。
- **无分类器引导（Classifier-free guidance）。** 在推理时，同时计算有条件 `ε` 和无条件 `ε`，然后 `ε_cfg = (1 + w) · ε_cond - w · ε_uncond`，其中 `w ≈ 3-7`。在课程08中介绍。
- **1000步很多。** 生产环境使用DDIM（20-50步）、DPM-Solver（10-20步）或蒸馏（1-4步）。参见课程12。

## 使用它

| 角色 | 2026年的典型技术栈 |
|------|-----------------------|
| 图像像素空间扩散（小型、玩具） | DDPM + U-Net |
| 图像潜空间扩散 | 变分自编码器（VAE）编码器 + U-Net 或 DiT（课程07） |
| 视频潜空间扩散 | 时空DiT（Sora, Veo, WAN） |
| 音频潜空间扩散 | Encodec + 扩散Transformer |
| 科学（分子、蛋白质、物理） | 等变扩散（EDM, RFdiffusion, AlphaFold3） |

扩散是通用的生成骨干。流匹配（课程13）是2024-2026年的竞争者，通常在相同质量下推理速度更快。

## 交付

保存 `outputs/skill-diffusion-trainer.md`。技能接收数据集和计算预算，输出：调度（线性/余弦/sigmoid）、预测目标（ε/v/x）、步数、引导尺度、采样器家族以及评估协议。

## 练习

1. **简单。** 在 `code/main.py` 中将T从40改为10。样本质量（输出的可视化直方图）如何下降？在什么T下双模态结构崩溃？
2. **中等。** 从ε预测切换到v预测。重新推导逆向步骤。比较最终样本质量。
3. **困难。** 添加无分类器引导。根据类标签 `c ∈ {0,1}` 进行条件控制，训练时10%的概率丢弃标签，采样时使用 `ε = (1+w)·ε_cond - w·ε_uncond`。测量在 `w = 0, 1, 3, 7` 时的有条件模式命中率。

## 关键术语

| 术语 | 人们说的 | 实际含义 |
|------|----------|----------|
| 前向过程（Forward process） | "加噪声" | 固定的马尔可夫链 `q(x_t | x_{t-1})`，破坏数据。 |
| 逆向过程（Reverse process） | "去噪" | 学习的链 `p_θ(x_{t-1} | x_t)`，重构数据。 |
| β调度（β schedule） | "噪声阶梯" | 每一步的方差；线性、余弦或sigmoid。 |
| α̅（Alpha bar） | "Alpha bar" | 累积乘积 `∏(1 - β)`；提供从 `x_0` 到 `x_t` 的闭合形式。 |
| 简单损失（Simple loss） | "噪声上的MSE" | `||ε - ε_θ(x_t, t)||²`；所有变分推导都简化为此。 |
| ε预测（ε-prediction） | "预测噪声" | 输出是添加的噪声；标准DDPM。 |
| V预测（V-prediction） | "预测速度" | 输出是 `α·ε - σ·x`；在不同t上条件更好。 |
| DDPM | "那篇论文" | Ho等人2020；线性β，1000步，U-Net。 |
| DDIM | "确定性采样器" | 非马尔可夫采样器，20-50步，相同的训练目标。 |
| 无分类器引导（Classifier-free guidance） | "CFG" | 混合有条件和无条件噪声预测以放大条件。 |

## 生产注意：扩散推理是一个步数问题

DDPM论文运行T=1000步逆向步骤。没有人会在生产环境中那样部署。每个真实的推理栈都会选择以下三种策略之一——每种策略都能清晰地对应到"延迟从何而来"的生产视角：

1. **更快的采样器，相同的模型。** DDIM（20-50步），DPM-Solver++（10-20），UniPC（8-16）。直接替换逆向循环；训练好的 `ε_θ` 权重保持不变。延迟降低20-50倍。
2. **蒸馏。** 训练一个学生模型以更少的步骤匹配教师模型：渐进蒸馏（2→1），一致性模型（任意步数→1-4），LCM，SDXL-Turbo，SD3-Turbo。延迟再降低5-10倍，但需要重新训练。
3. **缓存与编译。** `torch.compile(unet, mode="reduce-overhead")`，TensorRT-LLM的扩散后端，`xformers`/SDPA注意力，bf16权重。每步延迟降低约2倍。可与（1）和（2）叠加。

对于一个生产环境下的扩散服务器，延迟的预算讨论与生产文献中描述LLM的方式相同：延迟 = `num_steps × step_cost + VAE_decode`，吞吐量 = `batch_size × (num_steps × step_cost)^-1`。首次生成时间（TTFT）很小（一步）；等效于每位生成时间（TPOT）的是完整的响应时间，因为从用户角度来看图像生成是"一次性"的。

## 进一步阅读

- [Sohl-Dickstein et al. (2015). Deep Unsupervised Learning using Nonequilibrium Thermodynamics](https://arxiv.org/abs/1503.03585) —— 扩散论文，超越时代。
- [Ho, Jain, Abbeel (2020). Denoising Diffusion Probabilistic Models](https://arxiv.org/abs/2006.11239) —— DDPM。
- [Song, Meng, Ermon (2021). Denoising Diffusion Implicit Models](https://arxiv.org/abs/2010.02502) —— DDIM，更少步数。
- [Nichol & Dhariwal (2021). Improved DDPM](https://arxiv.org/abs/2102.09672) —— 余弦调度，学习方差。
- [Dhariwal & Nichol (2021). Diffusion Models Beat GANs on Image Synthesis](https://arxiv.org/abs/2105.05233) —— 分类器引导。
- [Ho & Salimans (2022). Classifier-Free Diffusion Guidance](https://arxiv.org/abs/2207.12598) —— 无分类器引导。
- [Karras et al. (2022). Elucidating the Design Space of Diffusion-Based Generative Models (EDM)](https://arxiv.org/abs/2206.00364) —— 统一符号，最干净的配方。