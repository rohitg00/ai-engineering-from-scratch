# StyleGAN

> 大多数生成器将 `z` 同时搅入每一层。StyleGAN 将其拆分：先把 `z` 映射到中间的 `w`，再通过 AdaIN 在每个分辨率层级*注入* `w`。这一处改动解耦了潜空间，并让照片级真实人脸在此后的七年里成为一个已解决的问题。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 8 · 03（GAN）、Phase 4 · 08（归一化）、Phase 3 · 07（CNN）
**Time:** 约 45 分钟

## 问题所在

DCGAN 通过一叠转置卷积将 `z` 映射为图像。问题在于：`z` 控制着一切——姿态、光照、身份、背景——全部纠缠在一起。沿着 `z` 的某个轴移动，这四者同时变化。你无法要求模型"同一个人、不同姿态"，因为其表示方式并不是按这种方式分解的。

Karras 等人（2019，NVIDIA）提出：不再将 `z` 直接送入卷积层。改为以一个固定的 `4×4×512` 张量作为网络输入。学习一个 8 层 MLP 来映射 `z ∈ Z → w ∈ W`。在每个分辨率处通过*自适应实例归一化*（AdaIN）注入 `w`：先归一化每个卷积特征图，再按 `w` 的仿射投影进行缩放和平移。并加入逐层噪声以产生随机细节（皮肤毛孔、发丝）。

其结果是：`W` 中"高层风格"（姿态、身份）与"细粒度风格"（光照、颜色）的轴大致正交。你可以在两幅图像之间交换风格：低分辨率层级使用图像 A 的 `w`，高分辨率层级使用图像 B 的 `w`。这解锁了图像编辑、跨域风格化以及整个"StyleGAN 反演"研究方向。

## 核心概念

![StyleGAN: mapping network + AdaIN + per-layer noise](../assets/stylegan.svg)

**映射网络。** `f: Z → W`，一个 8 层 MLP。`Z = N(0, I)^512`。`W` 并不被强制为高斯分布——它学习到一个与数据相适应的形状。

**合成网络。** 从一个学习得到的常量 `4×4×512` 出发。每个分辨率块：`upsample → conv → AdaIN(w_i) → noise → conv → AdaIN(w_i) → noise`。分辨率逐层翻倍：4、8、16、32、64、128、256、512、1024。

**AdaIN。**

```
AdaIN(x, y) = y_scale · (x - mean(x)) / std(x) + y_bias
```

其中 `y_scale` 和 `y_bias` 来自 `w` 的仿射投影。先按特征图归一化，再进行重新风格化。这里的"风格"指的是特征图的一阶和二阶统计量。

**逐层噪声。** 向每个特征图加入单通道高斯噪声，并按学习得到的逐通道系数缩放。在不影响全局结构的前提下控制随机细节。

**截断技巧。** 推理时，采样 `z`，计算 `w = mapping(z)`，然后得到 `w' = ŵ + ψ·(w - ŵ)`，其中 `ŵ` 是多次采样得到的 `w` 均值。`ψ < 1` 以多样性换取质量。几乎每一个 StyleGAN 演示都使用 `ψ ≈ 0.7`。

## StyleGAN 1 → 2 → 3

| 版本 | 年份 | 创新点 |
|---------|------|------------|
| StyleGAN | 2019 | 映射网络 + AdaIN + 噪声 + 渐进式增长。 |
| StyleGAN2 | 2020 | 权重解调替代 AdaIN（修复水滴伪影）；跳跃/残差架构；路径长度正则化。 |
| StyleGAN3 | 2021 | 无混叠卷积 + 等变核；消除纹理粘贴在像素网格上的问题。 |
| StyleGAN-XL | 2022 | 类条件生成，1024²，ImageNet。 |
| R3GAN | 2024 | 以更强的正则化重新发布；以少 20 倍的参数量在 FFHQ-1024 上缩小与扩散模型的差距。 |

在 2026 年，StyleGAN3 仍是以下场景的默认选择：(a) 高帧率下的窄域照片级真实感生成，(b) 少样本域适应（仅用 100 张图像训练新数据集，冻结映射网络），(c) 基于反演的编辑（找到能重建真实照片的 `w`，然后编辑该 `w`）。对于开放域文本生成图像，它不是合适的工具——那属于扩散模型。

```figure
gx-stylegan-mapping
```

## 动手实现

`code/main.py` 在一维下实现了一个玩具版"轻量 style-GAN"：一个映射 MLP，一个接收学习得到的常量向量并用 `w` 派生的缩放/偏置对其进行调制的合成函数，以及逐层噪声。它表明通过仿射调制注入 `w` 的效果不逊于甚至优于将 `z` 拼接进生成器输入。

### 步骤 1：映射网络

```python
def mapping(z, M):
    h = z
    for i in range(num_layers):
        h = leaky_relu(add(matmul(M[f"W{i}"], h), M[f"b{i}"]))
    return h
```

### 步骤 2：自适应实例归一化

```python
def adain(x, w_scale, w_bias):
    mu = mean(x)
    sd = std(x)
    x_norm = [(xi - mu) / (sd + 1e-8) for xi in x]
    return [w_scale * xi + w_bias for xi in x_norm]
```

每个特征图的缩放和偏置由 `w` 经线性投影得到。

### 步骤 3：逐层噪声

```python
def add_noise(x, sigma, rng):
    return [xi + sigma * rng.gauss(0, 1) for xi in x]
```

每通道的 sigma 是可学习的。

## 常见陷阱

- **水滴伪影。** StyleGAN 1 在特征图中产生了水滴状斑块，因为 AdaIN 将均值归零。StyleGAN 2 的权重解调通过改为缩放卷积权重来修复此问题。
- **纹理粘贴。** StyleGAN 1 和 2 的纹理跟随像素坐标而非物体坐标（在插值时可见）。StyleGAN 3 的无混叠卷积通过加窗 sinc 滤波器修复此问题。
- **模式覆盖。** 截断后的 `ψ < 0.7` 看起来干净但只从狭窄的锥形区域采样；如果需要多样性请使用 `ψ = 1.0`。
- **反演是有损的。** 将真实照片反演到 `W` 通常通过优化或编码器（e4e、ReStyle、HyperStyle）完成。结果在多次迭代后会发生偏移。

## 应用场景

| 使用场景 | 方法 |
|----------|----------|
| 照片级真实人脸（动漫、产品、窄域） | StyleGAN3 FFHQ / 自定义微调 |
| 基于照片的人脸编辑 | e4e 反演 + StyleSpace / InterFaceGAN 方向 |
| 人脸交换 / 驱动 | StyleGAN + 编码器 + 融合 |
| 头像流水线 | StyleGAN3 结合 ADA 进行低数据微调 |
| 少量图像的域适应 | 冻结映射网络，微调合成网络 |
| 多模态或文本条件生成 | 不要——请使用扩散模型 |

对于答案是"一个人脸照片"的产品级演示，StyleGAN 在推理成本（单次前向传播，4090 上 <10ms）和同等质量标准下的清晰度上都优于扩散模型。

## 上线交付

保存 `outputs/skill-stylegan-inversion.md`。该技能接收一张真实照片并输出：反演方法（e4e / ReStyle / HyperStyle）、预期潜空间损失、编辑预算（在 `W` 中可移动多远而不出现伪影），以及已知可靠的编辑方向列表（年龄、表情、姿态）。

## 练习

1. **简单。** 用 `adain_on=True` 和 `adain_on=False` 运行 `code/main.py`。比较固定潜变量与扰动潜变量下输出的差异范围。
2. **中等。** 实现混合正则化：对一个训练批次，计算 `w_a` 和 `w_b`，在合成的前半段应用 `w_a`，在后半段应用 `w_b`。解码器是否学到了解耦的风格？
3. **困难。** 取一个预训练的 StyleGAN3 FFHQ 模型（ffhq-1024.pkl）。通过在标注样本上训练 SVM，找到控制"微笑"的 `w` 方向；报告在身份发生漂移之前最多能推到多远。

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|-----------------|-----------------------|
| 映射网络 | "那个 MLP" | `f: Z → W`，8 层，将潜空间几何与数据统计解耦。 |
| W 空间 | "风格空间" | 映射网络的输出；大致解耦。 |
| AdaIN | "自适应实例归一化" | 先归一化特征图，再按 `w` 投影进行缩放 + 平移。 |
| 截断技巧 | "Psi" | `w = mean + ψ·(w - mean)`，ψ<1 以多样性换取质量。 |
| 路径长度正则化 | "PL 正则" | 惩罚 `w` 每单位变化对应的图像大幅变化；使 `W` 更平滑。 |
| 权重解调 | "StyleGAN2 的修复" | 归一化卷积权重而非激活值；消除水滴伪影。 |
| 无混叠 | "StyleGAN3 的技巧" | 加窗 sinc 滤波器；消除纹理粘贴在像素网格上的问题。 |
| 反演 | "为真实图像找到 w" | 优化或编码 `x → w` 使得 `G(w) ≈ x`。 |

## 生产环境说明：为什么 StyleGAN 在 2026 年仍在服役

4090 上的 StyleGAN3 生成一张 1024² 的 FFHQ 人脸用时不到 10 ms——`num_steps = 1`，没有 VAE 解码，没有交叉注意力计算。从生产角度看，这是任何图像生成器的延迟下限。同等分辨率下，50 步 SDXL + VAE 解码流水线约需 3 秒。这是 **300 倍的差距**，对于窄域产品（头像服务、证件照流水线、素材人脸生成），它在总体拥有成本上胜出。

两个运维层面的推论：

- **无需调度器，无需批处理聚合。** 在目标占用率下的静态批处理是最优的。持续批处理（对 LLM 和扩散模型至关重要）在这里毫无收益，因为每个请求消耗相同的 FLOPs。
- **截断 `ψ` 是安全旋钮。** `ψ < 0.7` 从映射网络输出范围的狭窄锥形区域采样。这是服务层控制样本方差的唯一手段。高峰负载时调低 `ψ`，高级用户时调高。

## 延伸阅读

- [Karras et al. (2019). A Style-Based Generator Architecture for GANs](https://arxiv.org/abs/1812.04948) — StyleGAN。
- [Karras et al. (2020). Analyzing and Improving the Image Quality of StyleGAN](https://arxiv.org/abs/1912.04958) — StyleGAN2。
- [Karras et al. (2021). Alias-Free Generative Adversarial Networks](https://arxiv.org/abs/2106.12423) — StyleGAN3。
- [Tov et al. (2021). Designing an Encoder for StyleGAN Image Manipulation](https://arxiv.org/abs/2102.02766) — e4e 反演。
- [Sauer et al. (2022). StyleGAN-XL: Scaling StyleGAN to Large Diverse Datasets](https://arxiv.org/abs/2202.00273) — StyleGAN-XL。
- [Huang et al. (2024). R3GAN: The GAN is dead; long live the GAN!](https://arxiv.org/abs/2501.05441) — 现代极简 GAN 配方。