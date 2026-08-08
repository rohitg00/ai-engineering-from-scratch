# 02 · 自编码器与变分自编码器（VAE）

> 普通的「自编码器（Autoencoder）」先压缩再重建。它只会记忆，不会生成。加上一个小技巧——逼迫编码看起来像高斯分布——你就得到了一个采样器。这个技巧，也就是 `z = μ + σ·ε` 的「重参数化（reparameterization）」，正是你在 2026 年用到的每一个潜在扩散（latent-diffusion）和流匹配（flow-matching）图像模型在输入端都带着一个 VAE 的原因。

**类型：** 构建
**语言：** Python
**前置：** 阶段 3 · 02（反向传播）、阶段 3 · 07（CNN）、阶段 8 · 01（分类体系）
**时长：** 约 75 分钟

## 问题所在

把一张 784 像素的 MNIST 数字压缩成 16 个数字组成的编码，再重建出来。普通自编码器在重建 MSE 上能拿满分，但它的编码空间却是一团杂乱无章的东西。在编码空间里随便挑一个点，解码出来——你得到的是噪声。它没有采样器，只是一个装扮成生成模型的压缩模型。

你真正想要的是：（a）编码空间是一个干净、平滑、可供采样的分布——比如各向同性的高斯分布 `N(0, I)`；（b）对任意采样点解码都能产生一个看起来合理的数字；（c）编码器和解码器依然有良好的压缩能力。三个目标，一套架构，一个损失函数。

Kingma 在 2013 年提出的 VAE 通过以下方式解决这个问题：训练编码器输出一个*分布* `q(z|x) = N(μ(x), σ(x)²)`，用 KL 惩罚项把这个分布拉向先验 `N(0, I)`，然后在解码前从 `q(z|x)` 中采样出 `z`。在推理阶段，丢掉编码器，直接采样 `z ~ N(0, I)`，再解码。正是这个 KL 惩罚项强制编码空间变得有结构。

到了 2026 年，VAE 很少单独出货——在原始图像质量上它已被扩散模型全面超越——但它是每一个潜在扩散模型（SD 1/2/XL/3、Flux、AudioCraft）的首选编码器。学会 VAE，你就学会了你所使用的每一条图像管线中那个看不见的第一层。

## 核心概念

〔图：自编码器与 VAE 对比——重参数化技巧〕

**自编码器。** `z = encoder(x)`，`x̂ = decoder(z)`，损失 = `||x - x̂||²`。编码空间没有结构。

**VAE 编码器。** 输出两个向量：`μ(x)` 和 `log σ²(x)`。它们定义了 `q(z|x) = N(μ, diag(σ²))`。

**重参数化技巧。** 从 `q(z|x)` 中采样是不可微的。把采样改写为 `z = μ + σ·ε`，其中 `ε ~ N(0, I)`。这样 `z` 就成了 `(μ, σ)` 的确定性函数加上一个非参数的噪声——梯度可以穿过 `μ` 和 `σ` 流动。

**损失。** 「证据下界（Evidence Lower BOund，ELBO）」，包含两项：

```
loss = reconstruction + β · KL[q(z|x) || N(0, I)]
     = ||x - x̂||²  + β · Σ_i ( σ_i² + μ_i² - log σ_i² - 1 ) / 2
```

重建项把 `x̂` 推向 `x`。KL 项把 `q(z|x)` 推向先验。两者相互权衡。β 小（<1）= 采样更锐利，编码空间没那么高斯。β 大（>1）= 编码空间更干净，采样更模糊。β-VAE（Higgins 2017）让这个旋钮声名大噪，并开启了「解耦表示（disentanglement）」研究。

**采样。** 在推理阶段：抽取 `z ~ N(0, I)`，前向通过解码器。一次前向传播——不像扩散那样需要迭代采样。

## 动手构建

`code/main.py` 实现了一个不依赖 numpy 或 torch 的微型 VAE。输入是 8 维合成数据，从一个 8 维空间中的 2 分量高斯混合分布采样而来。编码器和解码器都是单隐藏层 MLP。我们实现了 tanh 激活、前向传播、损失，以及手写的反向传播。这不是生产代码——而是教学。

### 第 1 步：编码器前向

```python
def encode(x, enc):
    h = tanh(add(matmul(enc["W1"], x), enc["b1"]))
    mu = add(matmul(enc["W_mu"], h), enc["b_mu"])
    log_sigma2 = add(matmul(enc["W_sig"], h), enc["b_sig"])
    return mu, log_sigma2
```

输出 `log σ²` 而不是 `σ`，是为了让网络输出不受约束（对 σ 做 softplus 是个陷阱——在 σ ≈ 0 处梯度会消失）。

### 第 2 步：重参数化并解码

```python
def reparameterize(mu, log_sigma2, rng):
    eps = [rng.gauss(0, 1) for _ in mu]
    sigma = [math.exp(0.5 * lv) for lv in log_sigma2]
    return [m + s * e for m, s, e in zip(mu, sigma, eps)]

def decode(z, dec):
    h = tanh(add(matmul(dec["W1"], z), dec["b1"]))
    return add(matmul(dec["W_out"], h), dec["b_out"])
```

### 第 3 步：ELBO

```python
def elbo(x, x_hat, mu, log_sigma2, beta=1.0):
    recon = sum((a - b) ** 2 for a, b in zip(x, x_hat))
    kl = 0.5 * sum(math.exp(lv) + m * m - lv - 1 for m, lv in zip(mu, log_sigma2))
    return recon + beta * kl, recon, kl
```

因为两个分布都是高斯分布，所以 KL 有精确的闭式解。不要做数值积分。直到 2026 年仍有人在代码里用蒙特卡洛估计 KL——那要慢 3 倍，毫无意义。

### 第 4 步：生成

```python
def sample(dec, z_dim, rng):
    z = [rng.gauss(0, 1) for _ in range(z_dim)]
    return decode(z, dec)
```

这就是生成模型。五行代码。

## 常见陷阱

- **后验坍缩（Posterior collapse）。** KL 项把 `q(z|x) → N(0, I)` 推得太狠，以至于 `z` 不再携带任何关于 `x` 的信息。解决办法：β 退火（从 β=0 开始，逐渐升到 1）、free bits，或对不活跃的维度跳过 KL。
- **采样模糊。** 高斯解码器似然意味着 MSE 重建，而 MSE 对 L2 是贝叶斯最优的（即取均值）——一组合理数字的均值是一个模糊的数字。解决办法：用离散解码器（VQ-VAE、NVAE），或只把 VAE 当作编码器，在其潜在空间上叠加扩散（这正是 Stable Diffusion 的做法）。
- **β 太大、太早。** 参见后验坍缩。从 β≈0.01 开始，再逐渐升高。
- **潜在维度太小。** 16 维适用于 MNIST，256 维适用于 ImageNet 256²，2048 维适用于 ImageNet 1024²。Stable Diffusion 的 VAE 把 512×512×3 压缩到 64×64×4（空间面积下采样 32 倍，通道数下采样 32 倍）。

## 实战选型

2026 年的 VAE 技术栈：

| 场景 | 选择 |
|-----------|------|
| 用于扩散的图像潜在编码器 | Stable Diffusion VAE（`sd-vae-ft-ema`）或 Flux VAE |
| 音频潜在编码器 | Encodec（Meta）、SoundStream 或 DAC（Descript） |
| 视频潜在表示 | Sora 的时空 patch、Latte VAE、WAN VAE |
| 解耦表示学习 | β-VAE、FactorVAE、TCVAE |
| 离散潜在表示（用于 transformer 建模） | VQ-VAE、RVQ（ResidualVQ） |
| 用于生成的连续潜在表示 | 普通 VAE，然后在该潜在空间中训练一个流/扩散模型作为条件 |

潜在扩散模型就是一个 VAE，在它的编码器和解码器之间塞进了一个扩散模型。VAE 负责粗粒度压缩，扩散模型承担繁重的工作。视频（VAE + 视频扩散 DiT）和音频（Encodec + MusicGen transformer）也是同样的模式。

## 封装产出

保存到 `outputs/skill-vae-trainer.md`。

该技能接收：数据集画像 + 目标潜在维度 + 下游用途（重建、采样，或作为潜在扩散的输入），输出：架构选择（普通/β/VQ/RVQ）、β 调度方案、潜在维度、解码器似然（高斯 vs 类别）、以及评估方案（重建 MSE、每维 KL、`q(z|x)` 与 `N(0, I)` 之间的 Fréchet 距离）。

## 练习

1. **简单。** 把 `code/main.py` 中的 `β` 分别改为 `0.01`、`0.1`、`1.0`、`5.0`。记录最终的重建 MSE 和 KL。对你的合成数据来说，哪个 β 是帕累托最优的？
2. **中等。** 把高斯解码器似然替换为伯努利似然（交叉熵损失）。在同一份合成数据的二值化版本上比较采样质量。
3. **困难。** 把 `code/main.py` 扩展成一个迷你 VQ-VAE：用一个 K=32 项码本中的最近邻查找替换连续的 `z`。比较重建 MSE，并报告有多少个码本条目被实际使用（码本坍缩是真实存在的）。

## 关键术语

| 术语 | 人们怎么说 | 它实际指什么 |
|------|-----------------|-----------------------|
| 自编码器 | 编码-解码网络 | `x → z → x̂`，学 MSE。不是生成模型。 |
| VAE | 带采样器的 AE | 编码器输出一个分布，KL 惩罚塑造编码空间。 |
| ELBO | 证据下界 | `log p(x) ≥ recon - KL[q(z\|x) \|\| p(z)]`；当 `q = p(z\|x)` 时取得紧界。 |
| 重参数化 | `z = μ + σ·ε` | 把随机节点改写为确定性 + 纯噪声。使得能够对采样反向传播。 |
| 先验 | `p(z)` | 潜在变量的目标分布，通常是 `N(0, I)`。 |
| 后验坍缩 | 「KL 项赢了」 | 编码器忽略 `x`，直接输出先验；解码器只能凭空编造。 |
| β-VAE | 可调的 KL 权重 | `loss = recon + β·KL`。β 越大，越解耦但越模糊。 |
| VQ-VAE | 离散潜在表示 | 用最近的码本向量替换连续的 `z`；使得能用 transformer 建模。 |

## 生产笔记：VAE 是扩散服务器中最热的路径

在 Stable Diffusion / Flux / SD3 管线里，VAE 每个请求会被调用两次——一次用于编码（如果做 img2img / 图像修复），一次用于解码。在 1024² 分辨率下，解码这一步往往是整条管线中单个最大的激活内存峰值，因为它要把 `128×128×16` 的潜在表示上采样回 `1024×1024×3`。这带来两个实际后果：

- **对解码做切片（slice）或分块（tile）。** `diffusers` 提供了 `pipe.vae.enable_slicing()` 和 `pipe.vae.enable_tiling()`。分块以一点轻微的接缝伪影为代价，把内存从 `O(H·W)` 降到 `O(tile²)`。对于消费级 GPU 上的 1024²+ 而言这是必需的。
- **用 bf16 解码器，最终缩放用 fp32 数值精度。** SD 1.x 的 VAE 以 fp32 发布，在 1024²+ 下转成 fp16 时会*悄无声息地产生 NaN*。SDXL 提供了 `madebyollin/sdxl-vae-fp16-fix`——务必优先使用这个 fp16-fix 变体，或者干脆用 bf16。

## 延伸阅读

- [Kingma & Welling (2013). Auto-Encoding Variational Bayes](https://arxiv.org/abs/1312.6114) —— VAE 论文。
- [Higgins et al. (2017). β-VAE: Learning Basic Visual Concepts with a Constrained Variational Framework](https://openreview.net/forum?id=Sy2fzU9gl) —— 解耦的 β-VAE。
- [van den Oord et al. (2017). Neural Discrete Representation Learning](https://arxiv.org/abs/1711.00937) —— VQ-VAE。
- [Vahdat & Kautz (2021). NVAE: A Deep Hierarchical Variational Autoencoder](https://arxiv.org/abs/2007.03898) —— 当时最先进的图像 VAE。
- [Rombach et al. (2022). High-Resolution Image Synthesis with Latent Diffusion Models](https://arxiv.org/abs/2112.10752) —— Stable Diffusion；VAE 作为编码器。
- [Défossez et al. (2022). High Fidelity Neural Audio Compression](https://arxiv.org/abs/2210.13438) —— Encodec，音频 VAE 标准。
