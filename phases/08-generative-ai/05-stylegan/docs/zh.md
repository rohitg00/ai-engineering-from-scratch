# 05 · StyleGAN

> 大多数生成器把 `z` 同时搅入每一层。StyleGAN 把它拆开了：先把 `z` 映射到中间向量 `w`，再通过 AdaIN 在每个分辨率层级上*注入* `w`。仅这一处改动就解开了潜空间的纠缠，让照片级真实的人脸生成成为一个连续七年都已被解决的问题。

**类型：** 构建
**语言：** Python
**前置：** 阶段 8 · 03（GANs）、阶段 4 · 08（归一化）、阶段 3 · 07（CNNs）
**时长：** 约 45 分钟

## 问题所在

DCGAN 通过一叠转置卷积把 `z` 映射成图像。问题在于：`z` 控制着一切——姿态、光照、身份、背景——它们全都纠缠在一起。沿 `z` 的某一个轴移动，这四者会同时改变。你无法要求模型"同一个人，不同姿态"，因为这种表示并不是按那样的方式分解的。

Karras 等人（2019，NVIDIA）提出：不要再把 `z` 直接喂进卷积层。改为把一个常量的 `4×4×512` 张量作为网络输入。学习一个 8 层 MLP，把 `z ∈ Z` 映射到 `w ∈ W`。再通过*自适应实例归一化*（adaptive instance normalization，AdaIN）在每个分辨率上注入 `w`：先对每张卷积特征图归一化，再用 `w` 的仿射投影对其进行缩放和平移。同时加入逐层噪声以产生随机化的细节（皮肤毛孔、发丝）。

结果是：`W` 中"高层风格"（姿态、身份）与"精细风格"（光照、颜色）大致沿着相互正交的轴分布。你可以在两张图像之间交换风格——在低分辨率层级使用图像 A 的 `w`，在高分辨率层级使用图像 B 的 `w`。这解锁了图像编辑、跨域风格化，以及整条"StyleGAN 反演（inversion）"研究路线。

## 核心概念

〔图：StyleGAN：映射网络 + AdaIN + 逐层噪声〕

**映射网络（mapping network）。** `f: Z → W`，一个 8 层 MLP。`Z = N(0, I)^512`。`W` 不被强制服从高斯分布——它会学到一个与数据相适配的形状。

**合成网络（synthesis network）。** 从一个学习得到的常量 `4×4×512` 起步。每个分辨率块：`upsample → conv → AdaIN(w_i) → noise → conv → AdaIN(w_i) → noise`。分辨率逐级翻倍：4、8、16、32、64、128、256、512、1024。

**AdaIN。**

```
AdaIN(x, y) = y_scale · (x - mean(x)) / std(x) + y_bias
```

其中 `y_scale` 和 `y_bias` 来自 `w` 的仿射投影。先对每张特征图归一化，再重新赋予风格。这里的"风格"指特征图的一阶与二阶统计量。

**逐层噪声（per-layer noise）。** 向每张特征图加入单通道高斯噪声，并按一个可学习的逐通道因子进行缩放。它在不影响全局结构的前提下控制随机化细节。

**截断技巧（truncation trick）。** 推理时，采样 `z`，计算 `w = mapping(z)`，再得到 `w' = ŵ + ψ·(w - ŵ)`，其中 `ŵ` 是大量样本上 `w` 的均值。`ψ < 1` 以多样性换取质量。几乎所有 StyleGAN 演示都使用 `ψ ≈ 0.7`。

## StyleGAN 1 → 2 → 3

| 版本 | 年份 | 创新点 |
|---------|------|------------|
| StyleGAN | 2019 | 映射网络 + AdaIN + 噪声 + 渐进式增长。 |
| StyleGAN2 | 2020 | 权重解调（weight demodulation）取代 AdaIN（修复液滴伪影）；skip/残差架构；路径长度正则化。 |
| StyleGAN3 | 2021 | 无混叠（alias-free）卷积 + 等变核；消除纹理粘附于像素网格的问题。 |
| StyleGAN-XL | 2022 | 类别条件、1024²、ImageNet。 |
| R3GAN | 2024 | 以更强的正则化重新打造；在 FFHQ-1024 上以少 20 倍的参数量逼近扩散模型。 |

到 2026 年，StyleGAN3 仍是以下场景的默认选择：(a) 高帧率下窄域照片级真实感生成；(b) 少样本域适配（用 100 张图像在新数据集上训练，冻结映射网络）；(c) 基于反演的编辑（找到能重建一张真实照片的 `w`，再编辑该 `w`）。但对于开放域的文本生成图像，它不是合适的工具——扩散模型才是。

## 动手构建

`code/main.py` 在一维上实现了一个玩具版的"style-GAN lite"：一个映射 MLP、一个合成函数（接收一个学习得到的常量向量，并用 `w` 派生出的缩放/偏置对其进行调制），以及逐层噪声。它表明：通过仿射调制注入 `w`，效果可以媲美甚至胜过把 `z` 直接拼接进生成器的输入。

### 第 1 步：映射网络

```python
def mapping(z, M):
    h = z
    for i in range(num_layers):
        h = leaky_relu(add(matmul(M[f"W{i}"], h), M[f"b{i}"]))
    return h
```

### 第 2 步：自适应实例归一化

```python
def adain(x, w_scale, w_bias):
    mu = mean(x)
    sd = std(x)
    x_norm = [(xi - mu) / (sd + 1e-8) for xi in x]
    return [w_scale * xi + w_bias for xi in x_norm]
```

逐特征图的缩放与偏置通过线性投影从 `w` 得到。

### 第 3 步：逐层噪声

```python
def add_noise(x, sigma, rng):
    return [xi + sigma * rng.gauss(0, 1) for xi in x]
```

逐通道的 Sigma 是可学习的。

## 常见陷阱

- **液滴伪影（droplet artifacts）。** StyleGAN 1 在特征图中会产生一团斑块状的液滴，原因是 AdaIN 把均值归零了。StyleGAN 2 的权重解调通过改为缩放卷积权重来修复这一问题。
- **纹理粘附（texture sticking）。** StyleGAN 1 和 2 的纹理跟随像素坐标，而非物体坐标（在插值时可见）。StyleGAN 3 的无混叠卷积用加窗 sinc 滤波器修复了这一点。
- **模式覆盖（mode coverage）。** 截断 `ψ < 0.7` 看起来很干净，但只从一个狭窄的锥形区域内采样；若需要多样性，请使用 `ψ = 1.0`。
- **反演是有损的。** 把一张真实照片反演到 `W` 通常通过优化或编码器（e4e、ReStyle、HyperStyle）完成。结果会在多次迭代中漂移。

## 实际应用

| 用例 | 方法 |
|----------|----------|
| 照片级真实人脸（动漫、产品、窄域） | StyleGAN3 FFHQ / 自定义微调 |
| 从一张照片进行人脸编辑 | e4e 反演 + StyleSpace / InterFaceGAN 方向 |
| 换脸 / 表情重演 | StyleGAN + 编码器 + 融合 |
| 头像生成管线 | StyleGAN3 配合 ADA 用于低数据量微调 |
| 从少量图像进行域适配 | 冻结映射网络，微调合成网络 |
| 多模态或文本条件生成 | 别用——改用扩散模型 |

对于"输出一张人脸照片"这类产品级演示，StyleGAN 在同等质量标准下，于推理成本（单次前向、在 4090 上 <10ms）和锐度上都胜过扩散模型。

## 交付产出

保存 `outputs/skill-stylegan-inversion.md`。该 skill 接收一张真实照片，并输出：反演方法（e4e / ReStyle / HyperStyle）、预期的潜空间损失、编辑预算（在 `W` 中能移动多远才会出现伪影），以及一份已验证可用的编辑方向清单（年龄、表情、姿态）。

## 练习

1. **简单。** 分别以 `adain_on=True` 和 `adain_on=False` 运行 `code/main.py`。对比固定潜向量与扰动潜向量下输出的离散程度。
2. **中等。** 实现混合正则化（mixing regularization）：对一个训练批次，计算 `w_a`、`w_b`，在合成的前半段应用 `w_a`、后半段应用 `w_b`。解码器是否学到了解耦的风格？
3. **困难。** 取一个预训练的 StyleGAN3 FFHQ 模型（ffhq-1024.pkl）。通过在带标签样本上训练一个 SVM，找到控制"微笑"的 `w` 方向；报告在身份开始漂移之前你能把它推多远。

## 关键术语

| 术语 | 大家怎么说 | 它实际指什么 |
|------|-----------------|-----------------------|
| 映射网络（Mapping network） | "那个 MLP" | `f: Z → W`，8 层，把潜空间几何与数据统计量解耦。 |
| W 空间（W space） | "风格空间" | 映射网络的输出；大致是解耦的。 |
| AdaIN | "自适应实例归一化" | 归一化特征图，再用 `w` 投影做缩放 + 平移。 |
| 截断技巧（Truncation trick） | "Psi" | `w = mean + ψ·(w - mean)`，ψ<1 以多样性换质量。 |
| 路径长度正则化（Path-length regularization） | "PL reg" | 惩罚单位 `w` 变化所引起的图像剧烈变化；使 `W` 更平滑。 |
| 权重解调（Weight demodulation） | "StyleGAN2 的修复方案" | 归一化卷积权重而非激活值；消除液滴伪影。 |
| 无混叠（Alias-free） | "StyleGAN3 的招数" | 加窗 sinc 滤波器；消除纹理粘附于像素网格的问题。 |
| 反演（Inversion） | "为真实图像找到 w" | 通过优化或编码得到 `x → w`，使得 `G(w) ≈ x`。 |

## 生产笔记：为什么 StyleGAN 在 2026 年仍在上线服务

StyleGAN3 在 4090 上生成一张 1024² 的 FFHQ 人脸只需不到 10 毫秒——`num_steps = 1`，没有 VAE 解码，没有交叉注意力（cross-attention）通路。从生产角度看，这是任何图像生成器的延迟下限。相同分辨率下，一条 50 步的 SDXL + VAE 解码管线约需 3 秒。这是 **300 倍的差距**，而对于窄域产品（头像服务、身份证件管线、库存人脸生成），它在总体拥有成本（TCO）上胜出。

由此带来两个运维层面的后果：

- **无需调度器，无需批处理器。** 在目标占用率下采用静态批处理就是最优解。连续批处理（continuous batching，对 LLM 和扩散模型至关重要）在这里毫无收益，因为每个请求消耗的 FLOPs 都相同。
- **截断 `ψ` 就是那个安全旋钮。** `ψ < 0.7` 从映射网络值域的一个狭窄锥形区域内采样。这是服务层对样本方差唯一能拨动的杠杆。在峰值负载时调低 `ψ`，对高级用户则调高。

## 延伸阅读

- [Karras et al. (2019). A Style-Based Generator Architecture for GANs](https://arxiv.org/abs/1812.04948) —— StyleGAN。
- [Karras et al. (2020). Analyzing and Improving the Image Quality of StyleGAN](https://arxiv.org/abs/1912.04958) —— StyleGAN2。
- [Karras et al. (2021). Alias-Free Generative Adversarial Networks](https://arxiv.org/abs/2106.12423) —— StyleGAN3。
- [Tov et al. (2021). Designing an Encoder for StyleGAN Image Manipulation](https://arxiv.org/abs/2102.02766) —— e4e 反演。
- [Sauer et al. (2022). StyleGAN-XL: Scaling StyleGAN to Large Diverse Datasets](https://arxiv.org/abs/2202.00273) —— StyleGAN-XL。
- [Huang et al. (2024). R3GAN: The GAN is dead; long live the GAN!](https://arxiv.org/abs/2501.05441) —— 现代极简 GAN 配方。
