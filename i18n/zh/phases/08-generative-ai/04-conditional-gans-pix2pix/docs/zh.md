# 条件GANs & Pix2Pix

> 2014-2017年第一场大解锁是控制GAN的产品. 添加标签,图像或句子.Pix2Pix完成了图像版本,并且在狭窄的图像到图像任务上仍然击败了每个通用文本到图像模型.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 8 · 03 (GANs), Phase 4 · 06 (U-Net), Phase 3 · 07 (CNNs)
**Time:** ~75 minutes

## 问题

无条件的GAN采样任意的面孔. 用于演示,无用在生产中.你想要: *将草图映射到照片中*, *将地图映射到空中照片中*, *日间场景映射到夜间*, *将灰色图像染色.在所有这些中,你得到一个输入图像$x$必须输出$y$许多可行的方法$y$现在,$x$平均平方错误会使它们平坦成.

条件GAN (Mirza & Osindero, 2014) 增加了一个条件$c$作为两者都的输入$G$其他$D$皮克斯2皮克斯 (伊索拉等人,2017) 专业化了这一点:条件是一个完整的输入图像,生成器是U-Net,歧视器是一个基于补丁的*分类器 (PatchGAN),损失是对立的+L1.该配方甚至在2026年也超过了从零开始的文本到图像模型,因为它是训练在 *对数据* 你有了你需要的信号.

## 概念

![Pix2Pix: U-Net generator, PatchGAN discriminator](../assets/pix2pix.svg)

**Conditional G.** $G(x, z) \to y$在Pix2Pix中,$z$在G内出现 (没有输入噪音 发现明确的噪音被忽略).

**Conditional D.** $D(x, y) \to [0, 1]$输入是*对* (条件,输出).这是关键的区别:D必须判断是否$y$符合$x$不仅仅是$y$看起来是真的.

**U-Net generator.**编码器-解码器,通过瓶跳转连接.输入和输出共享低层次结构 (边缘,外形).没有跳转,高频细节消失.

**PatchGAN discriminator.**结果是: 结果是:$N \times N$平均值.这是一个马科夫随机场假设:现实主义是本地.训练速度更快,参数更少,输出更敏捷.

**Loss.**

```math
\begin{aligned}
\text{loss}_G &= -\log D(x, G(x)) + \lambda \cdot \lVert y - G(x) \rVert_1 \\
\text{loss}_D &= -\log D(x, y) - \log(1 - D(x, G(x)))
\end{aligned}
```

术语L1稳定了训练,并将G推向已知目标.L1比L2 (中介,而不是中介) 提供了更尖的边缘.$\lambda = 100$现在,我们在使用Pix2Pix的默认版本.

##  CycleGAN  当你没有双子

Pix2Pix需要配对$(x, y)$循环GAN (Zhu等人,2017) 通过额外的损失降低了这一要求: *循环一致性损失.$G: X \to Y$其他$F: Y \to X$训练他们.$F(G(x)) \approx x$其他$G(F(y)) \approx y$这让你把马转换为斑马,夏天转换为冬天,没有双双的例子.

2026年,未对成的图像到图像主要通过扩散 (ControlNet,IP-Adapter) 而不是CycleGAN进行,但循环一致性概念几乎在每一个未对成的域调整论文中都存活下来.

```figure
gx-patchgan
```

## 建立它

`code/main.py`根据1D数据的条件,$c$任务:为给定的类型从条件分布中制造样本.

### 步骤1:将条件添加到G和D输入

```python
def G(z, c, params):
    return mlp(concat([z, one_hot(c)]), params)

def D(x, c, params):
    return mlp(concat([x, one_hot(c)]), params)
```

单热编码是最简单的方法.较大的模型使用学习嵌入,FiLM调节或交叉注意.

### 步骤2:火车条件

```python
for step in range(steps):
    x, c = sample_real_conditional()
    noise = sample_noise()
    update_D(x_real=x, x_fake=G(noise, c), c=c)
    update_G(noise, c)
```

发电机必须与给定的条件的实际分布相匹配,而不是边缘分布.

### 步骤3:验证每个类输出

```python
for c in [0, 1]:
    samples = [G(noise, c) for noise in batch]
    mean_c = mean(samples)
    assert_near(mean_c, real_mean_for_class_c)
```

## 陷

- **Condition ignored.**修复:条件D更积极 (早期层,不仅仅是晚期),使用投影歧视器 (Miyato & Koyama 2018).
- **L1 weight too low.**向任意的真实出口而不是忠实的出口.$\lambda \approx 100$对于Pix2Pix类型的任务.
- **L1 weight too high.**由于L1仍然是一个$L_p$一旦训练稳定,部就会停下来.
- **Ground-truth leakage in D.**酸$(x, y)$作为D输入,不仅仅是$y$没有这个D,不能检查一致性.
- **Mode collapse per class.**每个类都可以独立崩. 进行类条件的多样性检查.

## 用它

2026 图像到图像任务状态:

| Task | Best approach |
|------|---------------|
| Sketch → photo, same domain, paired data | Pix2Pix / Pix2PixHD (still fast, still sharp) |
| Sketch → photo, unpaired | ControlNet with a Scribble conditioning model |
| Semantic seg → photo | SPADE / GauGAN2 or SD + ControlNet-Seg |
| Style transfer | Diffusion with IP-Adapter or LoRA; GAN methods are legacy |
| Depth → photo | ControlNet-Depth over Stable Diffusion |
| Super-resolution | Real-ESRGAN (GAN), ESRGAN-Plus, or SD-Upscale (diffusion) |
| Colorization | ColTran, diffusion-based colorizers, or Pix2Pix-color |
| Daytime → nighttime, seasons, weather | CycleGAN or ControlNet-based |

在 (a) 拥有数千个对式示例时, (b) 任务是狭窄的,可重复的, (c) 需要快速推断时,Pix2Pix仍然是正确的工具.在通用开放域任务上,扩散获胜.

## 运送它

保存`outputs/skill-img2img-chooser.md`技能采用任务描述,数据可用性 (对与对的,N样本),延迟/质量预算,然后输出:方法 (Pix2Pix,CycleGAN,ControlNet变体,SDXL+IP-Adapter),培训数据要求,推断成本和评估协议 (LPIPS,FID,任务特定).

## 运动

1. **Easy.**修改`code/main.py`确认G仍然将每个类的噪音映射到正确的模式.
2. **Medium.**在1D设置中,取代L1以感知式损失 (例如作为特征提取器的小结D).它是否改变条件分布的敏度?
3. **Hard.**在1D设置中绘制一个CycleGAN:两个分布,两个发电机,周期损失. 显示它学习在没有对数据之间映射.

## 关键词

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Conditional GAN | "GAN with labels" | G(z, c), D(x, c). Both networks see the condition. |
| Pix2Pix | "Image-to-image GAN" | Paired cGAN with U-Net G and PatchGAN D + L1 loss. |
| U-Net | "Encoder-decoder with skips" | Symmetric conv network; skips preserve high-freq. |
| PatchGAN | "Local-realism classifier" | D outputs per-patch score instead of global score. |
| CycleGAN | "Unpaired image translation" | Two G's + cycle-consistency loss; no paired data. |
| SPADE | "GauGAN" | Normalizes intermediate activations with the semantic map; segmentation-to-image. |
| FiLM | "Feature-wise linear modulation" | Per-feature affine transform from the condition; cheap conditioning. |

## 制作注:Pix2Pix作为延迟限制的基线

当你对数据和狭窄任务 (sketch → render,语义地图 →照片,白天 →夜) 时,Pix2Pix的一次性推断比延迟扩散量更高.

| Path | Steps | Typical latency at 512² on a single L4 |
|------|-------|----------------------------------------|
| Pix2Pix (U-Net forward) | 1 | ~30 ms |
| SD-Inpaint or SD-Img2Img | 20 | ~1.2 s |
| SDXL-Turbo Img2Img | 1-4 | ~0.15-0.35 s |
| ControlNet + SDXL base | 20-30 | ~3-5 s |

二皮克斯在静态批量中获胜于吞吐量 (每个请求都是相同的FLOP).二皮克斯在质量和通用化上获胜.现代游戏通常是为狭窄任务运送Pix2Pix式蒸模型,而尾入输出则为二皮克斯式蒸模型.

## 进一步阅读

- [Mirza & Osindero (2014). Conditional Generative Adversarial Nets](https://arxiv.org/abs/1411.1784) 关于该公司的文件.
- [Isola et al. (2017). Image-to-Image Translation with Conditional Adversarial Networks](https://arxiv.org/abs/1611.07004)   
- [Zhu et al. (2017). Unpaired Image-to-Image Translation using Cycle-Consistent Adversarial Networks](https://arxiv.org/abs/1703.10593)     
- [Wang et al. (2018). High-Resolution Image Synthesis with Conditional GANs](https://arxiv.org/abs/1711.11585)    
- [Park et al. (2019). Semantic Image Synthesis with Spatially-Adaptive Normalization](https://arxiv.org/abs/1903.07291)   / 
- [Miyato & Koyama (2018). cGANs with Projection Discriminator](https://arxiv.org/abs/1802.05637)投影D
