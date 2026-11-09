# 风格

> 大多数发电机都会动$z$时刻将它们分开.$z$通过中间$w$接着*注射*$w$通过AdaIN,每一个分辨率级别. 这一变化解开了隐藏的空间,

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 8 · 03 (GANs), Phase 4 · 08 (Normalization), Phase 3 · 07 (CNNs)
**Time:** ~45 minutes

## 问题

一个DCGAN地图$z$问题是: 通过一堆转换的转变来将图像转换成图像.$z$控制一切 姿势,照明,身份,背景  结合在一起.$z$模型不能问"同一个人,不同的姿势",因为表现不以这种方式考虑.

卡拉斯等人 (2019,NVIDIA) 提出:停止养$z$直接进入层.`4×4×512`了解一个8层MLP,它将图表绘制$z \in Z \to w \in W$注射$w$在每个分辨率通过 *适应实例正常化* (AdaIN):将每个 conv 特性地图正常化,然后通过相似的投影来扩展和移动$w$增加每层噪音以确保体细节 (皮肤孔孔,头发线).

结果是:$W$图像的位置和形状是相对的. 图像的位置和形状是相对的.$w$对于低分辨率的水平和B图像$w$对于高层,这个开放的编辑,跨域风格化,以及整个"StyleGAN-inversion"的研究线.

## 概念

![StyleGAN: mapping network + AdaIN + per-layer noise](../assets/stylegan.svg)

**Mapping network.** $f: Z \to W$只有一个8层的MLP.$Z = \mathcal{N}(0, I)^{512}$现在,我们要去.$W$没有被迫成为高斯人,它学习了数据适应的形状.

**Synthesis network.**从一个学习的常数开始`4×4×512`每个分辨率块:`upsample → conv → AdaIN(w_i) → noise → conv → AdaIN(w_i) → noise`两次决议: 4, 8, 16, 32, 64, 128, 256, 512, 1024.

**AdaIN.**

```math
\mathop{\mathrm{AdaIN}}(x, y) = y_{\text{scale}} \cdot \frac{x - \mathop{\mathrm{mean}}(x)}{\mathop{\mathrm{std}}(x)} + y_{\text{bias}}
```

在哪里$y_{\text{scale}}$其他$y_{\text{bias}}$来自于 $w$按特征地图进行正常化,然后重新样式化. "样式"是特征地图的第一和第二级统计数据.

**Per-layer noise.**单通道高斯噪音加上每个特征地图,以每通道的学习因素进行扩展.

**Truncation trick.**在推断时,样本$z$计算$w = \text{mapping}(z)$现在$w' = \hat{w} + \psi \cdot (w - \hat{w})$在哪里$\hat{w}$是平均值$w$通过许多样本.$\psi < 1$几乎所有的Stylagan演示都使用了$\psi \approx 0.7$现在,我们要去.

## 风格GAN 1 → 2 → 3

| Version | Year | Innovation |
|---------|------|------------|
| StyleGAN | 2019 | Mapping network + AdaIN + noise + progressive growing. |
| StyleGAN2 | 2020 | Weight demodulation replaces AdaIN (fixes droplet artifacts); skip/residual architecture; path-length regularization. |
| StyleGAN3 | 2021 | Alias-free convolution + equivariant kernels; eliminates texture sticking to pixel grid. |
| StyleGAN-XL | 2022 | Class-conditional, 1024², ImageNet. |
| R3GAN | 2024 | Rebrands with stronger reg; closes gap to diffusion on FFHQ-1024 with 20x fewer params. |

在2026年,StyleGAN3仍然是 (a) 狭域光现实主义的默认标准,高FPS, (b) 短拍的域调整 (在100图片的新数据集上进行训练,结地图), (c) 基于逆转的编辑 (查看 $w$修改一个真实照片,然后编辑它.$w$对于开放域的文字到图像,它不是工具传播是.

```figure
gx-stylegan-mapping
```

## 建立它

`code/main.py`实现1D中的玩具"风格-GAN 莱特":一个绘图MLP,一个合成函数,它采用学习的常量向量并通过$w$射的效果是可观的.$w$通过结调节匹配或结结$z$它们可以在发电机的输入中输入.

### 步骤1:地图网络

```python
def mapping(z, M):
    h = z
    for i in range(num_layers):
        h = leaky_relu(add(matmul(M[f"W{i}"], h), M[f"b{i}"]))
    return h
```

### 步骤2:适应实例正常化

```python
def adain(x, w_scale, w_bias):
    mu = mean(x)
    sd = std(x)
    x_norm = [(xi - mu) / (sd + 1e-8) for xi in x]
    return [w_scale * xi + w_bias for xi in x_norm]
```

性能图的尺度和偏差来自$w$通过线性投影.

### 步骤3:每层噪音

```python
def add_noise(x, sigma, rng):
    return [xi + sigma * rng.gauss(0, 1) for xi in x]
```

通过道学习可以.

## 陷

- **Droplet artifacts.**由于AdaIN 零了平均值,StyleGAN 1 在功能地图中产生了滴.StyleGAN 2 的权重解调通过缩小卷积权重来修复它.
- **Texture sticking.**模拟器1和2的纹理遵循像素坐标,而不是对象坐标 (在插曲时可见).StyleGAN3的无形曲线通过窗口的sinc过器来解决这一问题.
- **Mode coverage.**切割`ψ < 0.7`表面清洁,但来自狭角的样本;使用`ψ = 1.0`如果需要多样性.
- **Inversion is lossy.**转换一个真实照片成$W$结果通常通过优化或编码器 (e4e,ReStyle,HyperStyle) 进行.

## 用它

| Use case | Approach |
|----------|----------|
| Photoreal human faces (anime, product, narrow) | StyleGAN3 FFHQ / custom fine-tune |
| Face editing from a photo | e4e inversion + StyleSpace / InterFaceGAN directions |
| Face swap / reenactment | StyleGAN + encoder + blending |
| Avatar pipelines | StyleGAN3 w/ ADA for low-data fine-tune |
| Domain adaptation from a few images | Freeze mapping network, fine-tune synthesis |
| Multi-modal or text-conditioned generation | Don't — use diffusion |

对于产品级演示,答案是"人的脸照片",StyleGAN比推断成本 (单向传递,4090ms <10ms) 的扩散率和相同质量条的敏度更高.

## 运送它

保存`outputs/skill-stylegan-inversion.md`技能拍摄真实照片和输出:逆转方法 (e4e / ReStyle / HyperStyle),预期隐藏损失,编辑预算 (到底在$W$您可以在文物之前移动),以及已知编辑指南 (年龄,表情,姿势) 的列表.

## 运动

1. **Easy.**跑步`code/main.py`随着`adain_on=True`其他`adain_on=False`对于固定隐形与扰乱隐形的输出分布进行比较.
2. **Medium.**实施混合规律化:对于训练批次,计算$w_a$现在$w_b$应用$w_a$对于合成的第一半年$w_b$解码器能学到没有任何分歧的风格吗?
3. **Hard.**采用预训练的StyleGAN3 FFHQ模型 (ffhq-1024.pkl).$w$通过在标记样品上训练SVM来控制"微笑"的方向;报告在身份漂移之前,您可以推向多远.

## 关键词

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Mapping network | "The MLP" | $f: Z \to W$, 8 layers, decouples latent geometry from data statistics. |
| W space | "The style space" | Output of the mapping network; roughly disentangled. |
| AdaIN | "Adaptive instance norm" | Normalize feature map, then scale + shift by $w$-projection. |
| Truncation trick | "Psi" | $w = \text{mean} + \psi \cdot (w - \text{mean})$, $\psi<1$ trades diversity for quality. |
| Path-length regularization | "PL reg" | Penalizes large changes in image per unit change in $w$; makes $W$ smoother. |
| Weight demodulation | "The StyleGAN2 fix" | Normalize conv weights instead of activations; kills droplet artifacts. |
| Alias-free | "StyleGAN3's trick" | Windowed sinc filters; eliminates texture sticking to the pixel grid. |
| Inversion | "Find w for a real image" | Optimize or encode $x \to w$ so $G(w) \approx x$. |

## 产品注释:为什么StayGAN仍在2026年出货

在4090上,StyleGAN3在10ms内产生10242 FFHQ面孔`num_steps = 1`没有VAE解码,没有跨度注意力通过.在生产方面,这是任何图像生成器的地板延迟.一个50步的SDXL +VAE解码管道在相同分辨率是 ~3秒.**300× gap**对于狭域产品 (avatar服务,身份证件管道,股票面孔生成)

两种操作后果:

- **No scheduler, no batcher.**目标占用量最佳的静态批量.持续批量 (对于LLM和传播至关重要) 提供零效益,因为每个请求都采用相同的FLOP.
- **Truncation `ψ` is the safety knob.** `ψ < 0.7`图测网络范围的狭窄角角的样本.这是服务层对样本变异的唯一杆.`ψ`在高负载时,将其提高为优质用户.

## 进一步阅读

- [Karras et al. (2019). A Style-Based Generator Architecture for GANs](https://arxiv.org/abs/1812.04948) 风格GAN
- [Karras et al. (2020). Analyzing and Improving the Image Quality of StyleGAN](https://arxiv.org/abs/1912.04958)    
- [Karras et al. (2021). Alias-Free Generative Adversarial Networks](https://arxiv.org/abs/2106.12423)    
- [Tov et al. (2021). Designing an Encoder for StyleGAN Image Manipulation](https://arxiv.org/abs/2102.02766)e4e逆转
- [Sauer et al. (2022). StyleGAN-XL: Scaling StyleGAN to Large Diverse Datasets](https://arxiv.org/abs/2202.00273)     
- [Huang et al. (2024). R3GAN: The GAN is dead; long live the GAN!](https://arxiv.org/abs/2501.05441)现代的最小GAN食谱.
