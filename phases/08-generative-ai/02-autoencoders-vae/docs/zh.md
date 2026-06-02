# 自编码器与变分自编码器（Autoencoders & Variational Autoencoders, VAE）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 普通 autoencoder 先压缩再重构，它只会记忆，不会生成。加一个小技巧——强迫 code 看起来像高斯分布——你就得到了一个采样器。这个技巧，也就是 `z = μ + σ·ε` 的 reparameterization（重参数化），正是 2026 年你用的所有 latent-diffusion（潜空间扩散）和 flow-matching（流匹配）图像模型在输入端都挂着一个 VAE 的根本原因。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 3 · 02 (Backprop), Phase 3 · 07 (CNNs), Phase 8 · 01 (Taxonomy)
**Time:** ~75 minutes

## 问题（The Problem）

把一张 784 像素的 MNIST 数字压成 16 个数的 code，然后再重构出来。普通 autoencoder 在重构 MSE 上能交出漂亮成绩，但 code 空间却是一团乱麻：在 code 空间里随机挑一个点解码出来，得到的是噪声。它没有采样器，本质上只是一个伪装过的压缩模型。

你真正想要的是：(a) code 空间是一个干净、平滑、可采样的分布——比如各向同性高斯 `N(0, I)`；(b) 从这个分布里采样一个点，解码后能得到一个看起来合理的数字；(c) encoder 和 decoder 仍然有不错的压缩能力。三个目标，一套架构，一个 loss。

Kingma 在 2013 年提出的 VAE 通过下面这套办法把这件事一并搞定：训练 encoder 输出一个*分布* `q(z|x) = N(μ(x), σ(x)²)`，用 KL 惩罚把这个分布往先验 `N(0, I)` 上拉，再从 `q(z|x)` 里采样 `z` 喂给 decoder。推理时直接丢掉 encoder，从 `N(0, I)` 里采样 `z`，解码即可。正是这个 KL 惩罚迫使 code 空间被结构化。

到了 2026 年，VAE 很少作为独立模型上线——在原始图像质量上已经被 diffusion 全面超越——但它仍然是所有 latent-diffusion 模型（SD 1/2/XL/3、Flux、AudioCraft）的首选 encoder。学懂 VAE，你就读懂了你日常用的每一条图像 pipeline 里那个隐形的第一层。

## 概念（The Concept）

![Autoencoder vs VAE：reparameterization 技巧](../assets/vae.svg)

**Autoencoder。** `z = encoder(x)`，`x̂ = decoder(z)`，loss = `||x - x̂||²`。code 空间没有结构。

**VAE encoder。** 输出两个向量：`μ(x)` 和 `log σ²(x)`。它们定义了 `q(z|x) = N(μ, diag(σ²))`。

**Reparameterization 技巧。** 直接从 `q(z|x)` 采样是不可微的。把采样改写成 `z = μ + σ·ε`，其中 `ε ~ N(0, I)`。这样 `z` 就成了 `(μ, σ)` 的确定性函数加上一段非参数噪声——梯度可以顺着 `μ` 和 `σ` 流回去。

**Loss。** 证据下界（Evidence Lower BOund, ELBO），由两项构成：

```
loss = reconstruction + β · KL[q(z|x) || N(0, I)]
     = ||x - x̂||²  + β · Σ_i ( σ_i² + μ_i² - log σ_i² - 1 ) / 2
```

重构项把 `x̂` 推向 `x`，KL 项把 `q(z|x)` 推向先验，两者相互制衡。β 小（<1）= 样本更锐，但 code 空间偏离高斯；β 大（>1）= code 空间更干净，但样本更糊。β-VAE（Higgins 2017）让这个旋钮一炮而红，并掀起了 disentanglement（解耦表示）研究热潮。

**采样。** 推理时：从 `N(0, I)` 采一个 `z`，过一遍 decoder。一次前向传播——不像 diffusion 还要反复迭代采样。

## 动手实现（Build It）

`code/main.py` 实现了一个不依赖 numpy 也不依赖 torch 的迷你 VAE。输入是 8 维合成数据，从一个 8 维的 2 分量 Gaussian 混合分布采出。Encoder 和 decoder 都是单隐层 MLP。我们手写了 tanh 激活函数、前向传播、loss 以及反向传播。这不是生产代码——是教学代码。

### Step 1: encoder 前向

```python
def encode(x, enc):
    h = tanh(add(matmul(enc["W1"], x), enc["b1"]))
    mu = add(matmul(enc["W_mu"], h), enc["b_mu"])
    log_sigma2 = add(matmul(enc["W_sig"], h), enc["b_sig"])
    return mu, log_sigma2
```

输出 `log σ²` 而不是 `σ`，是为了让网络输出无约束（对 σ 套 softplus 是个坑——σ ≈ 0 时梯度会消失）。

### Step 2: 重参数化并解码

```python
def reparameterize(mu, log_sigma2, rng):
    eps = [rng.gauss(0, 1) for _ in mu]
    sigma = [math.exp(0.5 * lv) for lv in log_sigma2]
    return [m + s * e for m, s, e in zip(mu, sigma, eps)]

def decode(z, dec):
    h = tanh(add(matmul(dec["W1"], z), dec["b1"]))
    return add(matmul(dec["W_out"], h), dec["b_out"])
```

### Step 3: ELBO

```python
def elbo(x, x_hat, mu, log_sigma2, beta=1.0):
    recon = sum((a - b) ** 2 for a, b in zip(x, x_hat))
    kl = 0.5 * sum(math.exp(lv) + m * m - lv - 1 for m, lv in zip(mu, log_sigma2))
    return recon + beta * kl, recon, kl
```

KL 有闭式解，因为两个分布都是高斯。不要去做数值积分。2026 年还有人发布用蒙特卡洛估 KL 的代码——慢 3 倍，毫无理由。

### Step 4: 生成

```python
def sample(dec, z_dim, rng):
    z = [rng.gauss(0, 1) for _ in range(z_dim)]
    return decode(z, dec)
```

这就是生成模型，五行代码。

## 坑点（Pitfalls）

- **后验坍塌（Posterior collapse）。** KL 项把 `q(z|x) → N(0, I)` 拉得太狠，导致 `z` 不再携带任何关于 `x` 的信息。解决办法：β-annealing（β 从 0 慢慢升到 1）、free bits，或者对失活的维度跳过 KL。
- **样本糊（Blurry samples）。** 高斯 decoder 似然等价于 MSE 重构，而 MSE 在 L2 意义下的 Bayes 最优解就是均值——一堆合理数字的均值就是一个模糊数字。解决办法：换离散 decoder（VQ-VAE、NVAE），或者干脆只把 VAE 当 encoder 用，在它的潜空间上叠 diffusion（这就是 Stable Diffusion 的做法）。
- **β 过大、上得太早。** 见上面的后验坍塌。从 β≈0.01 起步，再慢慢升。
- **Latent dim 太小。** MNIST 16 维够用，ImageNet 256² 要 256 维，ImageNet 1024² 要 2048 维。Stable Diffusion 的 VAE 把 512×512×3 压到 64×64×4（空间面积 32 倍下采样，通道也压 32 倍）。

## 用起来（Use It）

2026 年的 VAE 选型：

| 场景 | 选什么 |
|-----------|------|
| diffusion 的图像潜空间 encoder | Stable Diffusion VAE（`sd-vae-ft-ema`）或 Flux VAE |
| 音频潜空间 encoder | Encodec（Meta）、SoundStream、或 DAC（Descript） |
| 视频潜空间 | Sora 的时空 patches、Latte VAE、WAN VAE |
| 解耦表示学习 | β-VAE、FactorVAE、TCVAE |
| 离散潜空间（用于 transformer 建模） | VQ-VAE、RVQ（ResidualVQ） |
| 连续潜空间用于生成 | 普通 VAE，再在它的潜空间上条件化一个 flow / diffusion 模型 |

一个 latent-diffusion 模型 = 一个 VAE，在 encoder 和 decoder 之间塞了一个 diffusion 模型。VAE 负责粗压缩，diffusion 干重活。视频（VAE + 视频-diffusion DiT）和音频（Encodec + MusicGen transformer）都是同一个套路。

## 上线部署（Ship It）

保存到 `outputs/skill-vae-trainer.md`。

Skill 输入：数据集画像 + latent-dim 目标 + 下游用途（重构、采样，或 latent-diffusion 输入）；输出：架构选型（plain / β / VQ / RVQ）、β 时间表、latent dim、decoder 似然（高斯 vs 类别）、以及评估方案（重构 MSE、每维 KL、`q(z|x)` 与 `N(0, I)` 的 Fréchet 距离）。

## 练习（Exercises）

1. **简单。** 把 `code/main.py` 里的 `β` 改成 `0.01`、`0.1`、`1.0`、`5.0`。记录最终的重构 MSE 和 KL。哪个 β 在你这份合成数据上是 Pareto 最优？
2. **中等。** 把高斯 decoder 似然换成 Bernoulli 似然（交叉熵损失）。在同一份合成数据二值化后的版本上对比样本质量。
3. **困难。** 把 `code/main.py` 扩成一个 mini VQ-VAE：把连续 `z` 换成在大小 K=32 的 codebook 里做最近邻查找。对比重构 MSE，并报告 codebook 中实际被用到的条目数（codebook collapse 是真实存在的）。

## 关键术语（Key Terms）

| 术语 | 大家口头说的 | 实际意思 |
|------|-----------------|-----------------------|
| Autoencoder | 编码-解码网络 | `x → z → x̂`，学 MSE。不是生成模型。 |
| VAE | 带采样器的 AE | encoder 输出分布，KL 惩罚把 code 空间塑形。 |
| ELBO | 证据下界 | `log p(x) ≥ recon - KL[q(z\|x) \|\| p(z)]`；当 `q = p(z\|x)` 时取等。 |
| Reparameterization | `z = μ + σ·ε` | 把随机节点改写成确定项 + 纯噪声。让梯度能穿过采样。 |
| Prior | `p(z)` | latent 的目标分布，通常是 `N(0, I)`。 |
| Posterior collapse | 「KL 项赢了」 | encoder 忽略 `x`、直接吐先验；decoder 只能瞎编。 |
| β-VAE | 可调 KL 权重 | `loss = recon + β·KL`。β 越大越解耦但越糊。 |
| VQ-VAE | 离散 latent | 把连续 `z` 换成 codebook 里最近的向量；让 transformer 能在上面建模。 |

## 生产笔记：VAE 是 diffusion 服务里最热的路径

在 Stable Diffusion / Flux / SD3 的 pipeline 里，VAE 每个请求会被调用两次——一次 encode（如果是 img2img / inpainting），一次 decode。在 1024² 分辨率下，decoder 那一遍往往是整条 pipeline 中单次激活内存的最高峰，因为它要把 `128×128×16` 的 latent 上采样回 `1024×1024×3`。两条实战经验：

- **对 decode 做 slice 或 tile。** `diffusers` 暴露了 `pipe.vae.enable_slicing()` 和 `pipe.vae.enable_tiling()`。tiling 用一点轻微接缝瑕疵换来 `O(tile²)` 而不是 `O(H·W)` 的内存占用，对消费级 GPU 跑 1024² 以上的分辨率是必备。
- **bf16 decoder，最终上采样用 fp32。** SD 1.x 的 VAE 是以 fp32 发布的，转成 fp16 在 1024² 以上会*悄无声息地产生 NaN*。SDXL 提供了 `madebyollin/sdxl-vae-fp16-fix`——永远优先用 fp16-fix 版本，或者直接用 bf16。

## 延伸阅读（Further Reading）

- [Kingma & Welling (2013). Auto-Encoding Variational Bayes](https://arxiv.org/abs/1312.6114) — VAE 原论文。
- [Higgins et al. (2017). β-VAE: Learning Basic Visual Concepts with a Constrained Variational Framework](https://openreview.net/forum?id=Sy2fzU9gl) — 解耦的 β-VAE。
- [van den Oord et al. (2017). Neural Discrete Representation Learning](https://arxiv.org/abs/1711.00937) — VQ-VAE。
- [Vahdat & Kautz (2021). NVAE: A Deep Hierarchical Variational Autoencoder](https://arxiv.org/abs/2007.03898) — 当前最强图像 VAE。
- [Rombach et al. (2022). High-Resolution Image Synthesis with Latent Diffusion Models](https://arxiv.org/abs/2112.10752) — Stable Diffusion；用 VAE 当 encoder。
- [Défossez et al. (2022). High Fidelity Neural Audio Compression](https://arxiv.org/abs/2210.13438) — Encodec，音频 VAE 的事实标准。
