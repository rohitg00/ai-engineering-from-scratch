# 自编码器与变分自编码器(VAE)

> 普通自编码器先压缩再重建。它是在记忆，而不是生成。加一个小技巧——强迫编码呈高斯分布——你就得到了一个采样器。正是这个技巧，即 `z = μ + σ·ε` 的重参数化，是为什么你在 2026 年使用的每个潜在扩散和流匹配图像模型的输入端都有一个 VAE。

**类型：** 构建
**语言：** Python
**前置知识：** Phase 3 · 02(反向传播)、Phase 3 · 07(CNN)、Phase 8 · 01(分类体系)
**时间：** 约 75 分钟

## 问题

把 784 像素的 MNIST 数字压缩成 16 个数的编码，然后再重建。普通自编码器在重建 MSE 上会表现优异，但编码空间是一团混乱的疙瘩。在编码空间里随机取一个点，解码后得到的是噪声。它没有采样器。它只是一个伪装起来的压缩模型。

你真正想要的是:(a)编码空间是一个干净、平滑、可采样的分布——比如各向同性高斯分布 `N(0, I)`,(b)解码任意样本都能产生一个看起来合理的数字，(c)编码器和解码器仍然压缩良好。三个目标，一个架构，一个损失函数。

Kingma 在 2013 年提出的 VAE 通过以下方式解决这个问题：训练编码器输出一个*分布* `q(z|x) = N(μ(x), σ(x)²)`,通过 KL 惩罚将该分布拉向先验 `N(0, I)`,然后在解码前从 `q(z|x)` 采样 `z`。推理时，丢掉编码器，采样 `z ~ N(0, I)`,然后解码。正是 KL 惩罚迫使编码空间变得有结构。

在 2026 年，VAE 很少单独使用——在原始图像质量上它已被扩散模型超越——但它仍是每个潜在扩散模型(SD 1/2/XL/3、Flux、AudioCraft)首选的编码器。学会 VAE,你就学会了所使用的每条图像流水线中不可见的第一层。

## 概念

![Autoencoder vs VAE: the reparameterization trick](../assets/vae.svg)

**自编码器。** `z = encoder(x)`、`x̂ = decoder(z)`,损失 = `||x - x̂||²`。编码空间无结构。

**VAE 编码器。** 输出两个向量：`μ(x)` 和 `log σ²(x)`。它们定义了 `q(z|x) = N(μ, diag(σ²))`。

**重参数化技巧。** 从 `q(z|x)` 采样是不可微的。把样本重写为 `z = μ + σ·ε`,其中 `ε ~ N(0, I)`。现在 `z` 是 `(μ, σ)` 的确定性函数加上一个非参数噪声——梯度可以流过 `μ` 和 `σ`。

**损失。** 证据下界(ELBO),包含两项：

```
loss = reconstruction + β · KL[q(z|x) || N(0, I)]
     = ||x - x̂||²  + β · Σ_i ( σ_i² + μ_i² - log σ_i² - 1 ) / 2
```

重建项把 `x̂` 拉向 `x`。KL 项把 `q(z|x)` 拉向先验。二者相互权衡。小 β(<1)= 样本更锐利，编码空间不那么高斯。大 β(>1)= 编码空间更规整，样本更模糊。β-VAE(Higgins 2017)使这个旋钮名声大噪，并开启了解耦表示研究。

**采样。** 推理时：抽取 `z ~ N(0, I)`,前向通过解码器。一次前向传播——不像扩散模型那样需要迭代采样。

```figure
vae-latent-grid
```

## 动手构建

`code/main.py` 在不使用 numpy 或 torch 的情况下实现一个小型 VAE。输入是从 8 维空间中双分量高斯混合分布抽取的 8 维合成数据。编码器和解码器都是单隐层 MLP。我们实现 tanh 激活、前向传播、损失以及手写的反向传播。这不是生产代码——是教学代码。

### 步骤 1:编码器前向

```python
def encode(x, enc):
    h = tanh(add(matmul(enc["W1"], x), enc["b1"]))
    mu = add(matmul(enc["W_mu"], h), enc["b_mu"])
    log_sigma2 = add(matmul(enc["W_sig"], h), enc["b_sig"])
    return mu, log_sigma2
```

用 `log σ²` 而不是 `σ`,这样网络输出不受约束(对 σ 用 softplus 是个陷阱——σ ≈ 0 时梯度会消失)。

### 步骤 2:重参数化并解码

```python
def reparameterize(mu, log_sigma2, rng):
    eps = [rng.gauss(0, 1) for _ in mu]
    sigma = [math.exp(0.5 * lv) for lv in log_sigma2]
    return [m + s * e for m, s, e in zip(mu, sigma, eps)]

def decode(z, dec):
    h = tanh(add(matmul(dec["W1"], z), dec["b1"]))
    return add(matmul(dec["W_out"], h), dec["b_out"])
```

### 步骤 3:ELBO

```python
def elbo(x, x_hat, mu, log_sigma2, beta=1.0):
    recon = sum((a - b) ** 2 for a, b in zip(x, x_hat))
    kl = 0.5 * sum(math.exp(lv) + m * m - lv - 1 for m, lv in zip(mu, log_sigma2))
    return recon + beta * kl, recon, kl
```

使用精确的闭式 KL,因为两个分布都是高斯分布。不要做数值积分。到 2026 年仍然有人交付使用蒙特卡洛 KL 估计的代码——毫无理由地慢了 3 倍。

### 步骤 4:生成

```python
def sample(dec, z_dim, rng):
    z = [rng.gauss(0, 1) for _ in range(z_dim)]
    return decode(z, dec)
```

这就是生成模型。五行代码。

## 常见陷阱

- **后验坍缩。** KL 项把 `q(z|x) → N(0, I)` 压得过于厉害，以至于 `z` 不携带关于 `x` 的任何信息。解决方法：β 退火(从 β=0 开始，逐渐升到 1)、free bits,或对不活跃的维度跳过 KL。
- **样本模糊。** 高斯解码器似然意味着 MSE 重建，而 MSE 对 L2 是贝叶斯最优的(即均值)——一组合理数字的均值就是一个模糊的数字。解决方法：使用离散解码器(VQ-VAE、NVAE),或者只把 VAE 当作编码器，在潜在空间上叠加扩散模型(Stable Diffusion 正是这样做的)。
- **β 太大、太早。** 参见后验坍缩。从 β≈0.01 开始，逐渐升高。
- **潜在维度太小。** MNIST 用 16 维，ImageNet 256² 用 256 维，ImageNet 1024² 用 2048 维。Stable Diffusion 的 VAE 将 512×512×3 压缩到 64×64×4(空间面积上 32 倍的下采样，通道上 32 倍)。

## 使用

2026 年的 VAE 技术栈：

| 场景 | 选择 |
|------|------|
| 扩散的图像潜在编码器 | Stable Diffusion VAE(`sd-vae-ft-ema`)或 Flux VAE |
| 音频潜在编码器 | Encodec(Meta)、SoundStream 或 DAC(Descript) |
| 视频潜在表示 | Sora 的时空 patch、Latte VAE、WAN VAE |
| 解耦表示学习 | β-VAE、FactorVAE、TCVAE |
| 离散潜在表示(用于 transformer 建模) | VQ-VAE、RVQ(ResidualVQ) |
| 用于生成的连续潜在表示 | 普通 VAE,然后在该潜在空间中条件化流/扩散模型 |

潜在扩散模型就是一个在编码器和解码器之间嵌入扩散模型的 VAE。VAE 负责粗压缩，扩散模型负责繁重工作。视频(VAE + 视频扩散 DiT)和音频(Encodec + MusicGen transformer)采用同样的模式。

## 交付

保存 `outputs/skill-vae-trainer.md`。

该技能的输入：数据集特征 + 潜在维度目标 + 下游用途(重建、采样或潜在扩散输入)，输出：架构选择(普通/β/VQ/RVQ)、β 调度、潜在维度、解码器似然(高斯 vs 类别分布)，以及评估计划(重建 MSE、每维 KL、`q(z|x)` 与 `N(0, I)` 之间的 Fréchet 距离)。

## 练习

1. **简单。** 把 `code/main.py` 中的 `β` 改为 `0.01`、`0.1`、`1.0`、`5.0`。记录最终的重建 MSE 和 KL。对你的合成数据而言，哪个 β 是帕累托最优的？
2. **中等。** 把高斯解码器似然替换为 Bernoulli 似然(交叉熵损失)。在同样合成数据的二值化版本上比较样本质量。
3. **困难。** 将 `code/main.py` 扩展为迷你 VQ-VAE:把连续的 `z` 替换为在 K=32 个条目的码本中的最近邻查找。比较重建 MSE,并报告有多少码本条目被使用(码本坍缩是真实存在的)。

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|-----------|---------|
| 自编码器 | 编码-解码网络 | `x → z → x̂`,学习 MSE。非生成模型。 |
| VAE | 带采样器的 AE | 编码器输出一个分布，KL 惩罚塑造编码空间。 |
| ELBO | 证据下界 | `log p(x) ≥ recon - KL[q(z\|x) \|\| p(z)]`;当 `q = p(z\|x)` 时取等。 |
| 重参数化 | `z = μ + σ·ε` | 把随机节点重写为确定性部分 + 纯噪声。使反向传播能穿过采样。 |
| 先验 | `p(z)` | 潜变量的目标分布，通常是 `N(0, I)`。 |
| 后验坍缩 | “KL 项获胜” | 编码器忽略 `x`,直接输出先验；解码器只能凭空编造。 |
| β-VAE | 可调的 KL 权重 | `loss = recon + β·KL`。β 越高 = 解耦越好但越模糊。 |
| VQ-VAE | 离散潜在表示 | 把连续的 `z` 替换为码本中最近的向量；使 transformer 建模成为可能。 |

## 生产提示:VAE 是扩散服务器中最热的路径

在 Stable Diffusion / Flux / SD3 流水线中，VAE 每次请求被调用两次——一次编码(如果做 img2img / inpainting),一次解码。在 1024² 分辨率下，解码过程往往是整条流水线中最大的激活内存峰值，因为它要把 `128×128×16` 的潜在表示上采样回 `1024×1024×3`。两个实用的应对：

- **对解码进行切片或分块。** `diffusers` 提供了 `pipe.vae.enable_slicing()` 和 `pipe.vae.enable_tiling()`。分块用轻微的接缝伪影换取 `O(tile²)` 内存，而不是 `O(H·W)`。对于消费级 GPU 上 1024² 及以上分辨率必不可少。
- **解码器用 bf16,最终调整尺寸时用 fp32 数值。** SD 1.x 的 VAE 以 fp32 发布，在 1024²+ 时转换为 fp16 会*悄悄产生 NaN*。SDXL 附带 `madebyollin/sdxl-vae-fp16-fix`——务必优先使用 fp16 修复版或使用 bf16。

## 延伸阅读

- [Kingma & Welling (2013). Auto-Encoding Variational Bayes](https://arxiv.org/abs/1312.6114) — VAE 原始论文。
- [Higgins et al. (2017). β-VAE: Learning Basic Visual Concepts with a Constrained Variational Framework](https://openreview.net/forum?id=Sy2fzU9gl) — 解耦的 β-VAE。
- [van den Oord et al. (2017). Neural Discrete Representation Learning](https://arxiv.org/abs/1711.00937) — VQ-VAE。
- [Vahdat & Kautz (2021). NVAE: A Deep Hierarchical Variational Autoencoder](https://arxiv.org/abs/2007.03898) — 最先进的图像 VAE。
- [Rombach et al. (2022). High-Resolution Image Synthesis with Latent Diffusion Models](https://arxiv.org/abs/2112.10752) — Stable Diffusion;VAE 作为编码器。
- [Défossez et al. (2022). High Fidelity Neural Audio Compression](https://arxiv.org/abs/2210.13438) — Encodec,音频 VAE 的标准。