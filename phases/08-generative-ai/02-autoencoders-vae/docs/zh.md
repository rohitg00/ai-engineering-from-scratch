# 自编码器与变分自编码器（VAE）

> 一个普通的自编码器压缩然后重建。它记住了数据。它不会生成。只要加入一个小技巧——强制编码服从高斯分布——你就得到了一个采样器。这个小技巧，即 `z = μ + σ·ε` 的重参数化，正是你在 2026 年使用的每一个潜在扩散模型和流匹配图像模型在输入端都包含一个 VAE 的原因。

**类型：** 构建
**语言：** Python
**前置知识：** 阶段 3 · 02（反向传播），阶段 3 · 07（卷积神经网络），阶段 8 · 01（分类法）
**时间：** 约 75 分钟

## 问题

将一个 784 像素的 MNIST 数字压缩成 16 个数字的编码，然后重建。一个普通的自编码器可以完美地完成重建均方误差（MSE），但编码空间是一个凹凸不平的混乱区域。在编码空间中随机选一个点，解码后得到的是噪声。它没有采样器。它只是一个伪装的压缩模型。

你真正想要的是：(a) 编码空间是一个干净的、平滑的分布，你可以从中采样——例如各向同性高斯分布 `N(0, I)`；(b) 对任何样本进行解码都能产生一个合理的数字；(c) 编码器和解码器仍然能很好地压缩。三个目标，一个架构，一个损失函数。

Kingma 在 2013 年提出的 VAE 通过训练编码器输出一个*分布* `q(z|x) = N(μ(x), σ(x)²)`，通过 KL 散度惩罚将该分布推向先验 `N(0, I)`，然后在解码前从 `q(z|x)` 中采样 `z` 来解决这个问题。在推理时，丢弃编码器，采样 `z ~ N(0, I)`，然后解码。KL 散度惩罚正是强制编码空间结构化的原因。

到了 2026 年，VAE 很少单独发布——它们已经在原始图像质量上被扩散模型超越——但它们仍然是每个潜在扩散模型（SD 1/2/XL/3、Flux、AudioCraft）首选的编码器。学会 VAE，你就学会了你在使用的每个图像流水线的隐形第一层。

## 概念

![自编码器 vs VAE：重参数化技巧](../assets/vae.svg)

**自编码器。** `z = encoder(x)`，`x̂ = decoder(z)`，损失 = `||x - x̂||²`。编码空间无结构。

**VAE 编码器。** 输出两个向量：`μ(x)` 和 `log σ²(x)`。它们定义了 `q(z|x) = N(μ, diag(σ²))`。

**重参数化技巧。** 从 `q(z|x)` 中采样是不可微的。将采样重写为 `z = μ + σ·ε`，其中 `ε ~ N(0, I)`。现在 `z` 是 `(μ, σ)` 加上一个非参数噪声的确定性函数——梯度可以流经 `μ` 和 `σ`。

**损失函数。** 证据下界（ELBO），包含两项：

```
损失 = 重建 + β · KL[q(z|x) || N(0, I)]
     = ||x - x̂||²  + β · Σ_i ( σ_i² + μ_i² - log σ_i² - 1 ) / 2
```

重建项推动 `x̂` 接近 `x`。KL 散度项推动 `q(z|x)` 接近先验。两者相互权衡。较小的 β (<1) 会导致更锐利的样本，但编码空间不那么高斯。较大的 β (>1) 会导致更干净的编码空间，但样本更模糊。β-VAE（Higgins 2017）让这个调节旋钮闻名，并开启了解耦表示学习的研究。

**采样。** 推理时：抽取 `z ~ N(0, I)`，通过解码器前向传播。一次前向传播——不需要像扩散模型那样的迭代采样。

## 构建它

`code/main.py` 实现了一个微型 VAE，不使用 numpy 或 torch。输入是从 8 维中的 2 分量高斯混合中抽取的 8 维合成数据。编码器和解码器是单隐藏层的 MLP。我们实现了 tanh 激活函数、前向传播、损失函数和手动编写的反向传播。这不是生产级代码——而是教学用途。

### 步骤 1：编码器前向传播

```python
def encode(x, enc):
    h = tanh(add(matmul(enc["W1"], x), enc["b1"]))
    mu = add(matmul(enc["W_mu"], h), enc["b_mu"])
    log_sigma2 = add(matmul(enc["W_sig"], h), enc["b_sig"])
    return mu, log_sigma2
```

使用 `log σ²` 而不是 `σ`，这样网络输出是无约束的（对 σ 使用 softplus 是一个陷阱——当 σ ≈ 0 时梯度会消失）。

### 步骤 2：重参数化和解码

```python
def reparameterize(mu, log_sigma2, rng):
    eps = [rng.gauss(0, 1) for _ in mu]
    sigma = [math.exp(0.5 * lv) for lv in log_sigma2]
    return [m + s * e for m, s, e in zip(mu, sigma, eps)]

def decode(z, dec):
    h = tanh(add(matmul(dec["W1"], z), dec["b1"]))
    return add(matmul(dec["W_out"], h), dec["b_out"])
```

### 步骤 3：ELBO

```python
def elbo(x, x_hat, mu, log_sigma2, beta=1.0):
    recon = sum((a - b) ** 2 for a, b in zip(x, x_hat))
    kl = 0.5 * sum(math.exp(lv) + m * m - lv - 1 for m, lv in zip(mu, log_sigma2))
    return recon + beta * kl, recon, kl
```

精确的闭式 KL 散度，因为两个分布都是高斯分布。不要使用数值积分。到了 2026 年，还有人发布使用蒙特卡洛 KL 估计的代码——这毫无理由地慢了 3 倍。

### 步骤 4：生成

```python
def sample(dec, z_dim, rng):
    z = [rng.gauss(0, 1) for _ in range(z_dim)]
    return decode(z, dec)
```

这就是生成模型。五行代码。

## 陷阱

- **后验坍缩。** KL 项过于强烈地驱使 `q(z|x) → N(0, I)`，以至于 `z` 不再携带关于 `x` 的信息。修复方法：β 退火（从 β=0 开始，逐渐增加到 1）、自由位（free bits）、或跳过非活跃维度上的 KL 散度。
- **样本模糊。** 高斯解码器似然意味着 MSE 重建，这在 L2 意义上是贝叶斯最优的（均值）——一组合理数字的均值是一个模糊的数字。修复方法：离散解码器（VQ-VAE、NVAE），或者仅将 VAE 用作编码器，并在潜在空间上堆叠扩散模型（这正是 Stable Diffusion 的做法）。
- **β 太大，太早。** 参考后验坍缩。从 β≈0.01 开始，然后逐渐增加。
- **潜在维度太小。** 对于 MNIST，16 维足够；对于 ImageNet 256²，需要 256 维；对于 ImageNet 1024²，需要 2048 维。Stable Diffusion 的 VAE 将 512×512×3 压缩为 64×64×4（空间区域下采样 32 倍，通道数下采样 32 倍）。

## 使用它

2026 年的 VAE 技术栈：

| 场景 | 选择 |
|------|------|
| 用于扩散模型的图像潜在编码器 | Stable Diffusion VAE（`sd-vae-ft-ema`）或 Flux VAE |
| 音频潜在编码器 | Encodec（Meta）、SoundStream 或 DAC（Descript） |
| 视频潜在空间 | Sora 的时空补丁、Latte VAE、WAN VAE |
| 解耦表示学习 | β-VAE、FactorVAE、TCVAE |
| 离散潜在空间（用于 transformer 建模） | VQ-VAE、RVQ（ResidualVQ） |
| 用于生成的连续潜在空间 | 普通 VAE，然后在该潜在空间上条件化一个流/扩散模型 |

一个潜在扩散模型就是一个 VAE，其编码器和解码器之间有一个扩散模型。VAE 负责粗粒度压缩，扩散模型负责繁重工作。视频（VAE + 视频扩散 DiT）和音频（Encodec + MusicGen transformer）也是同样的模式。

## 交付它

保存 `outputs/skill-vae-trainer.md`。

该技能接收：数据集配置文件 + 目标潜在维度 + 下游用途（重建、采样或潜在扩散输入）并输出：架构选择（普通/β/VQ/RVQ）、β 调度、潜在维度、解码器似然（高斯 vs 类别）、评估计划（重建 MSE、每维 KL、`q(z|x)` 与 `N(0, I)` 之间的 Fréchet 距离）。

## 练习

1. **简单。** 将 `code/main.py` 中的 `β` 改为 `0.01`、`0.1`、`1.0`、`5.0`。记录最终的重建 MSE 和 KL 散度。对于你的合成数据，哪个 β 是帕累托最优的？
2. **中等。** 将高斯解码器似然替换为伯努利似然（交叉熵损失）。比较在相同合成数据二值化版本上的样本质量。
3. **困难。** 将 `code/main.py` 扩展为一个微型 VQ-VAE：将连续的 `z` 替换为在 K=32 个条目的码本中进行的最近邻查找。比较重建 MSE，并报告有多少码本条目被使用（码本坍缩是真实存在的）。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|------------|----------|
| 自编码器（Autoencoder） | 编码-解码网络 | `x → z → x̂`，学习 MSE。不具备生成能力。 |
| VAE | 带采样器的自编码器 | 编码器输出一个分布，KL 散度惩罚塑造编码空间。 |
| ELBO | 证据下界 | `log p(x) ≥ 重建 - KL[q(z|x) \|\| p(z)]`；当 `q = p(z|x)` 时等号成立。 |
| 重参数化（Reparameterization） | `z = μ + σ·ε` | 将随机节点重写为确定性加纯噪声。使反向传播能通过采样。 |
| 先验（Prior） | `p(z)` | 潜在空间的目标分布，通常为 `N(0, I)`。 |
| 后验坍缩（Posterior collapse） | “KL 项赢了” | 编码器忽略 `x`，输出先验；解码器必须无中生有。 |
| β-VAE | 可调 KL 权重 | `loss = 重建 + β·KL`。β 越大，解耦越强但图像越模糊。 |
| VQ-VAE | 离散潜在变量 | 将连续的 `z` 替换为最近的码本向量；支持 transformer 建模。 |

## 生产注意事项：VAE 是扩散服务器中最热门的路径

在 Stable Diffusion / Flux / SD3 流水线中，VAE 在每个请求中被调用两次——一次用于编码（如果做 img2img / 修复），一次用于解码。在 1024² 分辨率下，解码器的前向传播通常是整个流水线中最大的激活内存峰值，因为它将 `128×128×16` 的潜在表示上采样回 `1024×1024×3`。两个实际后果：

- **对解码进行分块或切片。** `diffusers` 提供了 `pipe.vae.enable_slicing()` 和 `pipe.vae.enable_tiling()`。分块（tiling）以较小的接缝伪影为代价，将内存消耗从 `O(H·W)` 降低到 `O(tile²)`。在消费级 GPU 上进行 1024²+ 分辨率的推理时必不可少。
- **解码器使用 bf16，最终缩放使用 fp32 数值。** SD 1.x 的 VAE 以 fp32 发布，当在 1024²+ 下转换为 fp16 时会*静默地产生 NaN*。SDXL 发布了 `madebyollin/sdxl-vae-fp16-fix`——始终优先选择 fp16-fix 变体或使用 bf16。

## 深入阅读

- [Kingma & Welling (2013). Auto-Encoding Variational Bayes](https://arxiv.org/abs/1312.6114) —— VAE 论文。
- [Higgins et al. (2017). β-VAE: Learning Basic Visual Concepts with a Constrained Variational Framework](https://openreview.net/forum?id=Sy2fzU9gl) —— 解耦 β-VAE。
- [van den Oord et al. (2017). Neural Discrete Representation Learning](https://arxiv.org/abs/1711.00937) —— VQ-VAE。
- [Vahdat & Kautz (2021). NVAE: A Deep Hierarchical Variational Autoencoder](https://arxiv.org/abs/2007.03898) —— 最先进的图像 VAE。
- [Rombach et al. (2022). High-Resolution Image Synthesis with Latent Diffusion Models](https://arxiv.org/abs/2112.10752) —— Stable Diffusion；VAE 作为编码器。
- [Défossez et al. (2022). High Fidelity Neural Audio Compression](https://arxiv.org/abs/2210.13438) —— Encodec，音频 VAE 的标准。