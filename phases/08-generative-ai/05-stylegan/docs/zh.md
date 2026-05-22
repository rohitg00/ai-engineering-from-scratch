# StyleGAN

> 大多数生成器同时在每一层中混入 `z`。StyleGAN将其分离：首先将 `z` 映射到中间向量 `w`，然后通过AdaIN在每个分辨率层级*注入* `w`。这一改变解开了潜空间的纠缠，使得逼真的人脸生成问题在接下来的七年中迎刃而解。

**类型：** 构建
**语言：** Python
**前置知识：** 阶段8·03（GANs），阶段4·08（归一化），阶段3·07（CNN）
**时长：** 约45分钟

## 问题

DCGAN通过一连串转置卷积将 `z` 映射为图像。问题在于：`z` 控制着一切——姿态、光照、身份、背景——全都纠缠在一起。沿着 `z` 的一个轴移动，所有四个属性都会改变。你无法让模型生成“同一个人，不同姿态”，因为表示方式不支持这种分解。

Karras等人（2019，NVIDIA）提出：不再将 `z` 直接输入卷积层。而是以一个恒定的 `4×4×512` 张量作为网络输入。学习一个8层MLP，将 `z ∈ Z` 映射为 `w ∈ W`。通过*自适应实例归一化（Adaptive Instance Normalization, AdaIN）*在每个分辨率层级注入 `w`：对每个卷积特征图进行归一化，然后通过 `w` 的仿射投影进行缩放和平移。添加逐层噪声来捕捉随机细节（毛孔、发丝）。

结果：`W` 中大致存在正交的轴，分别对应“高层风格”（姿态、身份）和“精细风格”（光照、颜色）。你可以用图像A的 `w` 处理低分辨率层级，用图像B的 `w` 处理高分辨率层级，从而在两张图像间交换风格。这开启了编辑、跨域风格化以及整个“StyleGAN-反演（StyleGAN-inversion）”研究方向。

## 概念

![StyleGAN: 映射网络 + AdaIN + 逐层噪声](../assets/stylegan.svg)

**映射网络（Mapping network）。** `f: Z → W`，一个8层MLP。`Z = N(0, I)^512`。`W` 不必服从高斯分布——它会学习一个适应数据的形状。

**合成网络（Synthesis network）。** 从一个可学习的常量 `4×4×512` 开始。每个分辨率块：`上采样 → 卷积 → AdaIN(w_i) → 噪声 → 卷积 → AdaIN(w_i) → 噪声`。分辨率依次加倍：4, 8, 16, 32, 64, 128, 256, 512, 1024。

**AdaIN。**

```
AdaIN(x, y) = y_scale · (x - mean(x)) / std(x) + y_bias
```

其中 `y_scale` 和 `y_bias` 来自 `w` 的仿射投影。对每个特征图进行归一化，然后重新设置样式。这里的“样式”指的是特征图的一阶和二阶统计量。

**逐层噪声（Per-layer noise）。** 单通道高斯噪声添加至每个特征图，通过可学习的每通道因子进行缩放。控制随机细节而不影响全局结构。

**截断技巧（Truncation trick）。** 推理时，采样 `z`，计算 `w = mapping(z)`，然后 `w' = ŵ + ψ·(w - ŵ)`，其中 `ŵ` 是多个样本的均值 `w`。`ψ < 1` 用多样性换取质量。几乎所有的StyleGAN演示都使用 `ψ ≈ 0.7`。

## StyleGAN 1 → 2 → 3

| 版本 | 年份 | 创新点 |
|------|------|--------|
| StyleGAN | 2019 | 映射网络 + AdaIN + 噪声 + 渐进式增长。 |
| StyleGAN2 | 2020 | 权重解调替代AdaIN（修复液滴伪影）；跳跃/残差架构；路径长度正则化。 |
| StyleGAN3 | 2021 | 抗混叠卷积 + 等变核；消除纹理粘附像素网格的问题。 |
| StyleGAN-XL | 2022 | 类别条件，1024²，ImageNet。 |
| R3GAN | 2024 | 重新命名并加入更强正则化；以20倍更少的参数在FFHQ-1024上缩小与扩散模型的差距。 |

截至2026年，StyleGAN3仍然是以下场景的默认选择：(a) 窄域高保真度、高FPS场景；(b) 小样本域适应（用100张图像训练新数据集，冻结映射网络）；(c) 基于反演的编辑（找到重构真实照片的 `w`，然后编辑该 `w`）。对于开放域文本到图像生成，它不是合适工具——扩散模型才是。

## 构建它

`code/main.py` 实现了一个玩具版的“轻量StyleGAN”在一维空间：一个映射MLP，一个合成函数（接收一个可学习的常量向量，并用从 `w` 派生的缩放/偏置进行调制），以及逐层噪声。它展示了通过仿射调制注入 `w` 可以与或击败将 `z` 拼接进生成器输入的做法。

### 步骤1：映射网络

```python
def mapping(z, M):
    h = z
    for i in range(num_layers):
        h = leaky_relu(add(matmul(M[f"W{i}"], h), M[f"b{i}"]))
    return h
```

### 步骤2：自适应实例归一化

```python
def adain(x, w_scale, w_bias):
    mu = mean(x)
    sd = std(x)
    x_norm = [(xi - mu) / (sd + 1e-8) for xi in x]
    return [w_scale * xi + w_bias for xi in x_norm]
```

每个特征图的缩放和偏置来自 `w`，通过线性投影得到。

### 步骤3：逐层噪声

```python
def add_noise(x, sigma, rng):
    return [xi + sigma * rng.gauss(0, 1) for xi in x]
```

每个通道的sigma是可学习的。

## 常见陷阱

- **液滴伪影（Droplet artifacts）。** StyleGAN 1 在特征图中产生团块状液滴，因为AdaIN将均值归零。StyleGAN 2 的权重解调通过缩放卷积权重而非激活值来修复此问题。
- **纹理粘附（Texture sticking）。** StyleGAN 1 和 2 的纹理跟随像素坐标而非物体坐标（插值时可见）。StyleGAN 3 的抗混叠卷积使用窗函数sinc滤波器修复了此问题。
- **模式覆盖（Mode coverage）。** 截断 `ψ < 0.7` 看起来清晰，但采样范围狭窄；如果需要多样性，请使用 `ψ = 1.0`。
- **反演是有损的。** 将真实照片反演为 `W` 通常通过优化或编码器（e4e、ReStyle、HyperStyle）完成。结果在多次迭代后会漂移。

## 使用它

| 使用场景 | 方法 |
|----------|------|
| 逼真的人脸（动漫、产品、窄域） | StyleGAN3 FFHQ / 自定义微调 |
| 从照片进行人脸编辑 | e4e 反演 + StyleSpace / InterFaceGAN 方向 |
| 人脸交换 / 表情驱动 | StyleGAN + 编码器 + 混合 |
| 头像管线 | StyleGAN3 w/ ADA 用于低数据微调 |
| 从少量图像进行域适应 | 冻结映射网络，微调合成网络 |
| 多模态或文本条件生成 | 不使用——使用扩散模型 |

对于“人物面部照片”这类产品级演示，在相同质量水平下，StyleGAN在推理成本（单次前向传播，4090上不到10毫秒）和清晰度方面优于扩散模型。

## 交付它

保存 `outputs/skill-stylegan-inversion.md`。技能接受一张真实照片并输出：反演方法（e4e / ReStyle / HyperStyle）、期望的潜空间损失、编辑预算（在出现伪影之前能在 `W` 中移动多远）、以及一组已知有效的编辑方向（年龄、表情、姿态）。

## 练习

1. **简单。** 分别以 `adain_on=True` 和 `adain_on=False` 运行 `code/main.py`。比较固定潜变量与扰动潜变量下输出的分布差异。
2. **中等。** 实现混合正则化（mixing regularization）：对于一个训练批次，计算 `w_a` 和 `w_b`，在合成的前半部分使用 `w_a`，后半部分使用 `w_b`。解码器是否学会了解耦的样式？
3. **困难。** 获取预训练的 StyleGAN3 FFHQ 模型（ffhq-1024.pkl）。通过在有标签的样本上训练 SVM 找出控制“微笑”的 `w` 方向；报告在身份漂移之前能推动多远。

## 关键术语

| 术语 | 人们常说的 | 实际含义 |
|------|-------------|----------|
| 映射网络 | "MLP" | `f: Z → W`，8层，将潜空间几何与数据统计解耦。 |
| W空间 | "样式空间" | 映射网络的输出；大致解耦。 |
| AdaIN | "自适应实例归一化" | 归一化特征图，然后通过 `w` 的投影进行缩放和平移。 |
| 截断技巧 | "Psi" | `w = mean + ψ·(w - mean)`，ψ<1 用多样性换取质量。 |
| 路径长度正则化 | "PL reg" | 惩罚每单位 `w` 变化导致的大图像变化；使 `W` 更平滑。 |
| 权重解调 | "StyleGAN2修复" | 归一化卷积权重而非激活值；消除液滴伪影。 |
| 抗混叠 | "StyleGAN3的技巧" | 窗函数sinc滤波器；消除纹理粘附像素网格的问题。 |
| 反演 | "为真实图像找到 w" | 优化或编码 `x → w`，使得 `G(w) ≈ x`。 |

## 生产说明：为何StyleGAN在2026年仍在部署

StyleGAN3在4090上生成一张1024²的FFHQ人脸不到10毫秒——`num_steps = 1`，无需VAE解码，无需交叉注意力计算。在生产意义上，这是任何图像生成器的最低延迟。同样分辨率下，50步SDXL + VAE解码管线大约需要3秒。这是**300倍的差距**，对于窄域产品（头像服务、身份证件管线、库存人脸生成），它在总体拥有成本（TCO）上胜出。

两个运营后果：

- **无需调度器，无需批处理器。** 目标占用率下的静态批处理是最优的。连续批处理（对LLM和扩散模型必不可少）没有带来任何好处，因为每个请求的FLOPs相同。
- **截断 `ψ` 是安全旋钮。** `ψ < 0.7` 从映射网络范围的狭窄锥形中采样。这是服务层对样本方差唯一的控制杠杆。高峰期降低 `ψ`，为高级用户提高它。

## 进一步阅读

- [Karras et al. (2019). A Style-Based Generator Architecture for GANs](https://arxiv.org/abs/1812.04948) — StyleGAN.
- [Karras et al. (2020). Analyzing and Improving the Image Quality of StyleGAN](https://arxiv.org/abs/1912.04958) — StyleGAN2.
- [Karras et al. (2021). Alias-Free Generative Adversarial Networks](https://arxiv.org/abs/2106.12423) — StyleGAN3.
- [Tov et al. (2021). Designing an Encoder for StyleGAN Image Manipulation](https://arxiv.org/abs/2102.02766) — e4e 反演.
- [Sauer et al. (2022). StyleGAN-XL: Scaling StyleGAN to Large Diverse Datasets](https://arxiv.org/abs/2202.00273) — StyleGAN-XL.
- [Huang et al. (2024). R3GAN: The GAN is dead; long live the GAN!](https://arxiv.org/abs/2501.05441) — 现代最小化GAN配方.