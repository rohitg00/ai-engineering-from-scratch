# 扩散模型 —— 从零实现 DDPM

> Ho、Jain、Abbeel(2020)给了这个领域一个让人无法放弃的配方：用一千个小步骤逐步用噪声破坏数据，训练一个神经网络来预测噪声，推理时逆转该过程。如今所有主流的图像、视频、3D 和音乐模型都建立在这个循环之上，可能再加上 flow matching 或一致性技巧。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 3 · 02(反向传播)、Phase 8 · 02(VAE)
**Time:** 约 75 分钟

## 问题

你想要一个针对 `p_data(x)` 的采样器。GAN 玩的是经常发散的极小极大博弈。VAE 通过高斯解码器生成的样本是模糊的。你真正想要的是一个训练目标，它(a)是单一稳定的损失(没有鞍点、没有极小极大)，(b)是 `log p(x)` 的下界(因此你有似然)，(c)样本质量达到 SOTA。

Sohl-Dickstein 等人(2015)给出了一个理论答案：定义一个逐步添加高斯噪声的马尔可夫链 `q(x_t | x_{t-1})`,并训练一个反向链 `p_θ(x_{t-1} | x_t)` 来去噪。Ho、Jain、Abbeel(2020)证明损失可以简化为一行——预测噪声——并清理了数学推导。2020 年，这只是一个冷门研究；2021 年，它生成了最先进的样本；2022 年，它变成了 Stable Diffusion;2026 年，它是整个领域的基础设施。

## 概念

![DDPM: forward noise, reverse denoise](../assets/ddpm.svg)

**前向过程 `q`。** 在 `T` 个小步骤中添加高斯噪声。闭式解——数学上可处理的原因——是累积步骤也是高斯的：

```
q(x_t | x_0) = N( sqrt(α̅_t) · x_0,  (1 - α̅_t) · I )
```

其中 `α̅_t = ∏_{s=1..t} (1 - β_s)`,调度为 `β_t`。在 T=1000 步内将 `β_t` 从 1e-4 线性取到 0.02,则 `x_T` 近似为 `N(0, I)`。

**反向过程 `p_θ`。** 学习一个神经网络 `ε_θ(x_t, t)` 来预测所添加的噪声。给定 `x_t`,按如下方式去噪：

```
x_{t-1} = (1 / sqrt(α_t)) · ( x_t - (β_t / sqrt(1 - α̅_t)) · ε_θ(x_t, t) )  +  σ_t · z
```

其中 `σ_t` 可以是 `sqrt(β_t)` 或学习得到的方差。这个表达式很丑，但它只是代数运算——由后验 `q(x_{t-1} | x_t, x_0)` 解出 `x_{t-1}`,并将 `x_0` 替换为其基于噪声预测的估计。

**训练损失。**

```
L_simple = E_{x_0, t, ε} [ || ε - ε_θ( sqrt(α̅_t) · x_0 + sqrt(1 - α̅_t) · ε,  t ) ||² ]
```

从数据中采样 `x_0`,随机选取 `t`,采样 `ε ~ N(0, I)`,通过闭式解一步算出带噪的 `x_t`,然后对噪声做回归。一个损失，没有极小极大，没有 KL,没有重参数化技巧。

**采样。** 从 `x_T ~ N(0, I)` 开始，从 `t = T` 迭代反向步骤到 `1`。完成。

## 为什么有效

三个直觉：

1. **去噪容易，生成难。** 在 `t=T` 时，数据是纯噪声——网络要解决的是一个微不足道的问题。在 `t=0` 时，网络只需清理几个像素。在中间的 `t` 处，问题很难，但网络从每个噪声级别获得的梯度都流经同一组权重。

2. **变相的分数匹配。** Vincent(2011)证明了预测噪声等价于估计 `∇_x log q(x_t | x_0)`,即*分数*(score)。反向 SDE 利用这个分数沿密度梯度向上走——一次朝高概率区域的引导随机游走。

3. **ELBO 简化为简单的 MSE。** 完整的变分下界在每个时间步都有一个 KL 项。在 DDPM 的参数化下，这些 KL 项简化为带特定系数的噪声预测 MSE;Ho 去掉了系数(称之为"simple"损失)，质量反而*提升*了。

```figure
diffusion-denoise
```

## 动手实现

`code/main.py` 实现了一个一维 DDPM。数据是一个双峰混合分布。"网络"是一个微型 MLP,输入 `(x_t, t)`,输出预测的噪声。训练就是那一行损失。采样迭代反向链。

### 第 1 步：前向调度(闭式解)

```python
betas = [1e-4 + (0.02 - 1e-4) * t / (T - 1) for t in range(T)]
alphas = [1 - b for b in betas]
alpha_bars = []
cum = 1.0
for a in alphas:
    cum *= a
    alpha_bars.append(cum)
```

### 第 2 步：一步采样 `x_t`

```python
def forward_sample(x0, t, alpha_bars, rng):
    a_bar = alpha_bars[t]
    eps = rng.gauss(0, 1)
    x_t = math.sqrt(a_bar) * x0 + math.sqrt(1 - a_bar) * eps
    return x_t, eps
```

### 第 3 步：一次训练步骤

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

对于一个 40 个时间步、24 单元 MLP 的一维问题，大约 200 个 epoch 就能学会这个双峰混合分布。

## 时间条件化

网络需要知道它正在为哪个时间步去噪。两种标准方案：

- **正弦嵌入。** 类似 Transformer 的位置编码。`embed(t) = [sin(t/ω_0), cos(t/ω_0), sin(t/ω_1), ...]`。通过一个 MLP,广播进网络。
- **FiLM / group-norm 条件化。** 在每个块中将投影嵌入为逐通道的缩放/偏置(FiLM)。

我们的玩具代码使用正弦嵌入 → 拼接。生产级 U-Net 使用 FiLM。

## 常见陷阱

- **调度非常重要。** 线性 `β` 是 DDPM 的默认设置，但在相同计算量下，余弦调度(Nichol & Dhariwal, 2021)能给出更好的 FID。如果质量停滞不前，就换调度。
- **时间步嵌入很脆弱。** 将原始 `t` 作为浮点数传入在一维玩具问题上可行，但在图像上会失败；务必使用正式的嵌入。
- **V-prediction 与 ε-prediction。** 在极端区间(t 非常小或非常大)时，`ε` 的信噪比很差。V-prediction(`v = α·ε - σ·x`)更稳定；SDXL、SD3 和 Flux 都使用它。
- **无分类器引导(Classifier-free guidance)。** 推理时，同时计算有条件和无条件的 `ε`,然后用 `w ≈ 3-7` 计算 `ε_cfg = (1 + w) · ε_cond - w · ε_uncond`。详见第 08 课。
- **1000 步太多了。** 生产环境使用 DDIM(20-50 步)、DPM-Solver(10-20 步)或蒸馏(1-4 步)。见第 12 课。

## 应用场景

| 角色 | 2026 年的典型技术栈 |
|------|-----------------------|
| 图像像素空间扩散(小型、玩具) | DDPM + U-Net |
| 图像潜在扩散 | VAE 编码器 + U-Net 或 DiT(第 07 课) |
| 视频潜在扩散 | 时空 DiT(Sora、Veo、WAN) |
| 音频潜在扩散 | Encodec + 扩散 Transformer |
| 科学(分子、蛋白质、物理) | 等变扩散(EDM、RFdiffusion、AlphaFold3) |

扩散是通用的生成式骨干。Flow matching(第 13 课)是 2024-2026 年的竞争者，在相同质量下通常在推理速度上更胜一筹。

## 上线部署

保存 `outputs/skill-diffusion-trainer.md`。该技能接收一个数据集 + 计算预算，输出：调度(线性/余弦/sigmoid)、预测目标(ε/v/x)、步数、引导强度、采样器族，以及一个评估协议。

## 练习

1. **简单。** 把 `code/main.py` 中的 T 从 40 改为 10。样本质量(输出的可视化直方图)如何退化？在什么 T 下双峰结构会崩塌？
2. **中等。** 从 ε-prediction 切换到 v-prediction。重新推导反向步骤。比较最终样本质量。
3. **困难。** 添加无分类器引导。以类别标签 `c ∈ {0, 1}` 为条件，训练时以 10% 的概率丢弃它，采样时使用 `ε = (1+w)·ε_cond - w·ε_uncond`。测量 `w = 0, 1, 3, 7` 下的条件模式命中率。

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|-----------------|-----------------------|
| 前向过程 | “加噪声” | 破坏数据的固定马尔可夫链 `q(x_t \| x_{t-1})`。 |
| 反向过程 | “去噪” | 重建数据的可学习链 `p_θ(x_{t-1} \| x_t)`。 |
| β 调度 | “噪声阶梯” | 每步方差；线性、余弦或 sigmoid。 |
| α̅ | "Alpha bar" | 累积乘积 `∏(1 - β)`;给出从 `x_0` 到 `x_t` 的闭式解。 |
| Simple 损失 | “对噪声的 MSE” | `\|\|ε - ε_θ(x_t, t)\|\|²`;所有变分推导都坍缩到这一项。 |
| ε-prediction | “预测噪声” | 输出是所加的噪声；标准 DDPM。 |
| V-prediction | “预测速度” | 输出是 `α·ε - σ·x`;在不同 t 上条件化更好。 |
| DDPM | “那篇论文” | Ho 等人 2020;线性 β,1000 步，U-Net。 |
| DDIM | “确定性采样器” | 非马尔可夫采样器，20-50 步，训练目标相同。 |
| Classifier-free guidance | "CFG" | 混合有条件和无条件的噪声预测以放大数据条件化。 |

## 生产提示：扩散推理是一个步数问题

DDPM 论文运行 T=1000 个反向步骤。没有人在生产环境这样做。每个真实的推理技术栈都从三种策略中选择其一——每种都能清晰地对应到生产语境中“延迟来自哪里”的问题：

1. **更快的采样器，同一个模型。** DDIM(20-50 步)、DPM-Solver++(10-20 步)、UniPC(8-16 步)。直接替换反向循环；训练好的 `ε_θ` 权重不动。延迟降低 20-50 倍。
2. **蒸馏。** 训练一个学生模型在更少的步骤中匹配教师：Progressive Distillation(2 → 1)、Consistency Models(任意 → 1-4)、LCM、SDXL-Turbo、SD3-Turbo。延迟再降低 5-10 倍，但需要重新训练。
3. **缓存与编译。** `torch.compile(unet, mode="reduce-overhead")`、TensorRT-LLM 的扩散后端、`xformers`/SDPA 注意力、bf16 权重。每步延迟降低约 2 倍。可与(1)和(2)叠加。

对于一个生产级扩散服务器，预算讨论与生产文献中针对 LLM 的描述相同：延迟是 `num_steps × step_cost + VAE_decode`,吞吐量是 `batch_size × (num_steps × step_cost)^-1`。TTFT 很小(一步)；TPOT 等价于完整响应时间，因为从用户的角度看，图像生成是“一次性全部完成”的。

## 延伸阅读

- [Sohl-Dickstein 等人(2015)。Deep Unsupervised Learning using Nonequilibrium Thermodynamics](https://arxiv.org/abs/1503.03585) —— 扩散的开山之作，超前于时代。
- [Ho、Jain、Abbeel(2020)。Denoising Diffusion Probabilistic Models](https://arxiv.org/abs/2006.11239) —— DDPM。
- [Song、Meng、Ermon(2021)。Denoising Diffusion Implicit Models](https://arxiv.org/abs/2010.02502) —— DDIM,更少的步数。
- [Nichol & Dhariwal(2021)。Improved DDPM](https://arxiv.org/abs/2102.09672) —— 余弦调度、学习方差。
- [Dhariwal & Nichol(2021)。Diffusion Models Beat GANs on Image Synthesis](https://arxiv.org/abs/2105.05233) —— 分类器引导。
- [Ho & Salimans(2022)。Classifier-Free Diffusion Guidance](https://arxiv.org/abs/2207.12598) —— CFG。
- [Karras 等人(2022)。Elucidating the Design Space of Diffusion-Based Generative Models (EDM)](https://arxiv.org/abs/2206.00364) —— 统一记号，最清晰的配方。