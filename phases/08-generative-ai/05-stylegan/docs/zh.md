# StyleGAN

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 多数 generator 在每一层都同时把 `z` 搅进去。StyleGAN 把这件事拆开了：先把 `z` 映射到一个中间表示 `w`，再通过 AdaIN 在每个分辨率层级把 `w` *注入* 进去。就这一处改动，把 latent（潜空间）解耦开，让逼真人脸成为一个被解决了七年的问题。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 8 · 03 (GANs), Phase 4 · 08 (Normalization), Phase 3 · 07 (CNNs)
**Time:** ~45 minutes

## 问题（The Problem）

DCGAN 把 `z` 通过一摞转置卷积映射成图像。问题在于：`z` 控制了一切——pose、光照、身份、背景——全都纠缠在一起。沿 `z` 的某个轴移动，这四个属性会一起变。你没法跟模型说「同一个人，换个姿势」，因为它的表示根本不是按这个方式分解的。

Karras 等人（2019, NVIDIA）提出：别再把 `z` 直接喂给 conv 层。改成把一个常量 `4×4×512` 张量作为网络输入，再学一个 8 层 MLP，把 `z ∈ Z → w ∈ W`。在每个分辨率上，通过 *自适应实例归一化*（adaptive instance normalization, AdaIN）把 `w` 注入进去：先对每个 conv feature map 做归一化，再用 `w` 的仿射投影做 scale 和 shift。再叠加 per-layer 噪声，用来生成随机细节（毛孔、发丝）。

结果：`W` 的轴大致是正交的——「高层 style」（pose、身份）和「细节 style」（光照、颜色）分到了不同维度。你可以在两张图之间互换 style：低分辨率层用图 A 的 `w`，高分辨率层用图 B 的 `w`。这一下子打开了图像编辑、跨域风格化，以及整条「StyleGAN-inversion」的研究路线。

## 概念（The Concept）

![StyleGAN: mapping network + AdaIN + per-layer noise](../assets/stylegan.svg)

**Mapping network。** `f: Z → W`，一个 8 层 MLP。`Z = N(0, I)^512`。`W` 不强制是高斯——它会学出一个由数据决定的形状。

**Synthesis network。** 从一个学习得到的常量 `4×4×512` 出发。每个分辨率块：`upsample → conv → AdaIN(w_i) → noise → conv → AdaIN(w_i) → noise`。分辨率逐级翻倍：4, 8, 16, 32, 64, 128, 256, 512, 1024。

**AdaIN。**

```
AdaIN(x, y) = y_scale · (x - mean(x)) / std(x) + y_bias
```

其中 `y_scale` 和 `y_bias` 来自 `w` 的仿射投影。先对每个 feature map 归一化，再重新「上 style」。这里所谓 "style" 就是 feature map 的一阶和二阶统计量。

**Per-layer 噪声。** 给每个 feature map 加一份单通道高斯噪声，再用一个学习得到的 per-channel 系数缩放。它控制随机细节，但不会影响全局结构。

**Truncation trick。** 推理时先采 `z`，算 `w = mapping(z)`，然后 `w' = ŵ + ψ·(w - ŵ)`，其中 `ŵ` 是大量样本上 `w` 的均值。`ψ < 1` 用多样性换质量。几乎所有 StyleGAN demo 都用 `ψ ≈ 0.7`。

## StyleGAN 1 → 2 → 3

| 版本 | 年份 | 创新点 |
|---------|------|------------|
| StyleGAN | 2019 | Mapping network + AdaIN + 噪声 + progressive growing。 |
| StyleGAN2 | 2020 | 用 weight demodulation 替换 AdaIN（修掉 droplet 伪影）；skip / residual 架构；path-length 正则化。 |
| StyleGAN3 | 2021 | Alias-free 卷积 + 等变核；消除 texture sticking 到像素网格的问题。 |
| StyleGAN-XL | 2022 | 类别条件、1024²、ImageNet。 |
| R3GAN | 2024 | 用更强正则化重新打包；在 FFHQ-1024 上以 20× 更少参数追平 diffusion。 |

到 2026 年，StyleGAN3 仍然是这些场景的默认选择：(a) 窄域、高 FPS 的逼真生成；(b) few-shot 域适配（用 100 张图训新数据集，冻住 mapping 网络）；(c) 基于 inversion 的编辑（找出能重建一张真实照片的 `w`，再编辑那个 `w`）。但对开放域的 text-to-image，它就不是顺手的工具——那是 diffusion 的地盘。

## 动手实现（Build It）

`code/main.py` 用 1-D 实现一个玩具版 "style-GAN lite"：一个 mapping MLP，一个 synthesis 函数（取一个学习得到的常量向量，再用 `w` 派生的 scale/bias 调制），以及 per-layer 噪声。它会展示：通过仿射调制注入 `w`，效果不输甚至好过把 `z` 直接拼进 generator 的输入。

### Step 1: mapping network

```python
def mapping(z, M):
    h = z
    for i in range(num_layers):
        h = leaky_relu(add(matmul(M[f"W{i}"], h), M[f"b{i}"]))
    return h
```

### Step 2: adaptive instance normalization

```python
def adain(x, w_scale, w_bias):
    mu = mean(x)
    sd = std(x)
    x_norm = [(xi - mu) / (sd + 1e-8) for xi in x]
    return [w_scale * xi + w_bias for xi in x_norm]
```

每个 feature map 的 scale 和 bias 都通过线性投影从 `w` 算出来。

### Step 3: per-layer 噪声

```python
def add_noise(x, sigma, rng):
    return [xi + sigma * rng.gauss(0, 1) for xi in x]
```

每通道的 sigma 是可学习的。

## 易错点（Pitfalls）

- **Droplet 伪影。** StyleGAN 1 的 feature map 里会出现一团 blob 状的水滴，原因是 AdaIN 把均值清零了。StyleGAN 2 的 weight demodulation 改成对卷积权重做缩放，修掉了这个问题。
- **Texture sticking。** StyleGAN 1 和 2 的纹理会跟着像素坐标走，而不是物体坐标走（在 interpolation 时尤其明显）。StyleGAN 3 的 alias-free 卷积用加窗 sinc filter 把这事修了。
- **Mode coverage（模式覆盖）。** Truncation `ψ < 0.7` 看着干净，但只是从一个很窄的锥形区域里采样；如果你需要多样性，就用 `ψ = 1.0`。
- **Inversion 是有损的。** 把一张真实照片 invert 回 `W` 通常靠优化或者一个 encoder（e4e、ReStyle、HyperStyle）来做。多迭代几次结果就会漂移。

## 用起来（Use It）

| 用例 | 方案 |
|----------|----------|
| 逼真人脸（动漫、产品、窄域） | StyleGAN3 FFHQ / 自定义微调 |
| 从一张照片做人脸编辑 | e4e inversion + StyleSpace / InterFaceGAN 编辑方向 |
| 换脸 / 表情迁移 | StyleGAN + encoder + 融合 |
| Avatar 流水线 | StyleGAN3 + ADA，做小数据微调 |
| 从少量图做域适配 | 冻住 mapping 网络，微调 synthesis |
| 多模态或文本条件生成 | 别用——上 diffusion |

如果产品级 demo 的答案就是「一张人脸照片」，StyleGAN 在推理成本上完胜 diffusion（单次前向，4090 上 <10ms），同等质量下也更锐利。

## 上线部署（Ship It）

保存 `outputs/skill-stylegan-inversion.md`。这个 skill 接收一张真实照片，输出：inversion 方法（e4e / ReStyle / HyperStyle）、预期 latent 损失、编辑预算（在 `W` 里能挪多远才出伪影），以及一份已知好用的编辑方向清单（年龄、表情、姿势）。

## 练习（Exercises）

1. **简单。** 用 `adain_on=True` 和 `adain_on=False` 各跑一遍 `code/main.py`。比较固定 latent 与扰动 latent 下输出的散布。
2. **中等。** 实现 mixing regularization：对一个训练 batch，算出 `w_a`、`w_b`，前半段 synthesis 用 `w_a`，后半段用 `w_b`。decoder 是不是学出了解耦的 style？
3. **困难。** 拿一个预训练的 StyleGAN3 FFHQ 模型（ffhq-1024.pkl）。在带标签的样本上训一个 SVM，找出控制「微笑」的 `w` 方向；汇报你能推多远，身份才开始漂移。

## 关键术语（Key Terms）

| 术语 | 大家会说 | 实际含义 |
|------|-----------------|-----------------------|
| Mapping network | "那个 MLP" | `f: Z → W`，8 层，把 latent 的几何形状从数据统计量里解耦出来。 |
| W space | "Style 空间" | Mapping 网络的输出；大致解耦。 |
| AdaIN | "自适应实例归一化" | 先归一化 feature map，再用 `w` 的投影做 scale + shift。 |
| Truncation trick | "Psi" | `w = mean + ψ·(w - mean)`，ψ<1 用多样性换质量。 |
| Path-length regularization | "PL reg" | 惩罚单位 `w` 变化引起的图像大幅变动；让 `W` 更平滑。 |
| Weight demodulation | "StyleGAN2 的修复" | 不归一化激活值，改归一化 conv 权重；干掉 droplet 伪影。 |
| Alias-free | "StyleGAN3 的招数" | 加窗 sinc filter；消除纹理粘像素网格的问题。 |
| Inversion | "给真实图找 w" | 优化或编码 `x → w`，使得 `G(w) ≈ x`。 |

## 生产笔记：为什么 StyleGAN 在 2026 年还在上线

StyleGAN3 在 4090 上生成一张 1024² FFHQ 人脸用时不到 10 ms——`num_steps = 1`、不用 VAE 解码、不用过 cross-attention。从生产角度看，这就是任何图像生成器的延迟下限。同分辨率下 50 步的 SDXL + VAE-decode 流水线大约 3 秒。这是 **300 倍的差距**，对窄域产品（avatar 服务、证件流水线、stock 人脸生成）来说，TCO（总拥有成本）上完胜。

由此带来两条运维上的后果：

- **不需要 scheduler，也不需要 batcher。** 在目标占用率下做静态 batch 就是最优。continuous batching（对 LLM 和 diffusion 是必备）在这里收益为零，因为每个请求的 FLOPs 都一样。
- **Truncation `ψ` 是安全旋钮。** `ψ < 0.7` 只在 mapping 网络输出范围里一个很窄的锥形区域采样。这是 serving 层唯一能用来调节样本方差的旋钮。高峰期把 `ψ` 调低，给付费用户调高。

## 延伸阅读（Further Reading）

- [Karras et al. (2019). A Style-Based Generator Architecture for GANs](https://arxiv.org/abs/1812.04948) — StyleGAN。
- [Karras et al. (2020). Analyzing and Improving the Image Quality of StyleGAN](https://arxiv.org/abs/1912.04958) — StyleGAN2。
- [Karras et al. (2021). Alias-Free Generative Adversarial Networks](https://arxiv.org/abs/2106.12423) — StyleGAN3。
- [Tov et al. (2021). Designing an Encoder for StyleGAN Image Manipulation](https://arxiv.org/abs/2102.02766) — e4e inversion。
- [Sauer et al. (2022). StyleGAN-XL: Scaling StyleGAN to Large Diverse Datasets](https://arxiv.org/abs/2202.00273) — StyleGAN-XL。
- [Huang et al. (2024). R3GAN: The GAN is dead; long live the GAN!](https://arxiv.org/abs/2501.05441) — 现代极简 GAN 配方。
