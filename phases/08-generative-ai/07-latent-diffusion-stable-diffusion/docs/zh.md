# 潜在扩散与Stable Diffusion

> 在512×512像素空间上做扩散是一种计算暴行。Rombach等人(2022)注意到，生成一张图像并不需要所有78.6万个维度——只需要足够捕捉语义结构的部分，其余部分由单独的解码器负责。在VAE的潜空间中进行扩散。就这一个想法催生了Stable Diffusion（稳定扩散）。

**类型:** 构建
**语言:** Python
**前置知识:** 阶段8·02（VAE），阶段8·06（DDPM），阶段7·09（ViT）
**时间:** ≈75分钟

## 问题

在512²像素空间上的扩散意味着U-Net在形状为`[B, 3, 512, 512]`的张量上运行。对于一个500M参数的U-Net，每个采样步骤大约需要100 GFLOPS。五十步就是每张图像5 TFLOPS。在十亿张图像上训练，计算账单高得离谱。

这些FLOPs大部分都用于通过网络推送感知上不重要的细节——那些有损VAE可以压缩掉的高频纹理。Rombach的想法是：一次性训练一个VAE（*第一阶段*），冻结它，然后完全在4通道的64×64潜空间（*第二阶段*）中运行扩散。同样的U-Net。像素数量减少到1/16。在相同质量下，FLOPs减少约64倍。

这就是Stable Diffusion的配方。SD 1.x/2.x在`64×64×4`潜变量上使用了860M的U-Net，SDXL在`128×128×4`上使用了2.6B的U-Net，SD3将U-Net替换为带有流匹配的扩散Transformer（DiT）。Flux.1-dev（Black Forest Labs，2024）搭载了12B参数的DiT-MMDiT。它们都在相同的两阶段基础架构上运行。

## 概念

![潜在扩散：VAE压缩 + 潜空间扩散](../assets/latent-diffusion.svg)

**两个阶段，分别训练。**

1. **第一阶段——VAE。** 编码器`E(x) → z`，解码器`D(z) → x`。目标压缩：每个空间轴下采样8倍 + 调整通道数，使得总潜变量大小约为像素数的1/16。损失函数 = 重构损失（L1 + LPIPS感知损失）+ KL（权重较小，以免`z`被迫过于高斯分布，因为我们不需要从`z`精确采样）。通常还会加入对抗性损失，使解码图像更清晰。

2. **第二阶段——在`z`上做扩散。** 将`z = E(x_real)`视为数据。训练一个U-Net（或DiT）来去噪`z_t`。推理时：通过扩散采样`z_0`，然后`x = D(z_0)`。

**文本条件。** 额外两个组件。一个冻结的文本编码器（SD 1.x用CLIP-L，SD 2/XL用CLIP-L+OpenCLIP-G，SD3和Flux用T5-XXL）。一个交叉注意力注入：每个U-Net块接收`[Q = 图像特征，K = V = 文本token]`并将它们混合。这些token是文本影响图像的唯⼀方式。

**损失函数与课程06相同。** 同样是关于噪声的DDPM/流匹配MSE。只需切换数据域。

## 架构变体

| 模型 | 年份 | 骨干网络 | 潜变量形状 | 文本编码器 | 参数量 |
|------|------|----------|--------------|--------------|--------|
| SD 1.5 | 2022 | U-Net | 64×64×4 | CLIP-L (77 tokens) | 860M |
| SD 2.1 | 2022 | U-Net | 64×64×4 | OpenCLIP-H | 865M |
| SDXL | 2023 | U-Net + refiner | 128×128×4 | CLIP-L + OpenCLIP-G | 2.6B + 6.6B |
| SDXL-Turbo | 2023 | 蒸馏 | 128×128×4 | 同上 | 1-4步采样 |
| SD3 | 2024 | MMDiT（多模态DiT） | 128×128×16 | T5-XXL + CLIP-L + CLIP-G | 2B / 8B |
| Flux.1-dev | 2024 | MMDiT | 128×128×16 | T5-XXL + CLIP-L | 12B |
| Flux.1-schnell | 2024 | MMDiT蒸馏 | 128×128×16 | T5-XXL + CLIP-L | 12B, 1-4步 |

趋势：用DiT（基于潜变量块的Transformer）替代U-Net，扩大文本编码器规模（T5在提示遵循方面优于CLIP），增加潜变量通道数（4→16可提供更多细节空间）。

## 构建

`code/main.py`在课程06的DDPM之上叠加了一个玩具1D“VAE”（编码器和解码器均为恒等映射，用于演示；真正的VAE会是卷积网络），并添加了带有无分类器引导的类别条件。这展示了同样的扩散损失无论作用于原始1D值还是编码后的值都一样有效——这就是关键见解。

### 步骤1：编码器/解码器

```python
def encode(x):    return x * 0.5          # 玩具“压缩”到更小尺度
def decode(z):    return z * 2.0
```

真正的VAE有训练好的权重。出于教学目的，这个线性映射足以说明扩散在`z`上运行，而不关心原始数据空间。

### 步骤2：在`z`空间中扩散

与课程06相同的DDPM。网络看到的数据是`z = E(x)`。采样得到`z_0`后，用`D(z_0)`解码。

### 步骤3：无分类器引导

训练期间，10%的概率丢弃类别标签（替换为空token）。推理时，同时计算`ε_cond`和`ε_uncond`，然后：

```python
eps_cfg = (1 + w) * eps_cond - w * eps_uncond
```

`w = 0` = 无引导（完全多样性），`w = 3` = 默认值，`w = 7+` = 饱和/过度锐化。

### 步骤4：文本条件（概念，非代码）

将类别标签替换为冻结的文本编码器输出。通过交叉注意力将文本嵌入送入U-Net：

```python
h = h + CrossAttention(Q=h, K=text_embed, V=text_embed)
```

这是类别条件扩散模型与Stable Diffusion之间唯一实质性的区别。

## 常见陷阱

- **VAE尺度不匹配。** SD 1.x的VAE在编码后应用了一个缩放常数（`scaling_factor ≈ 0.18215`）。忘记这一点会导致U-Net在方差严重错误的潜变量上训练。每个检查点都带有一个缩放因子。
- **文本编码器静默出错。** SD3需要T5-XXL且至少128个token，仅回退到CLIP会有损失。务必检查`use_t5=True`，否则提示保真度会急剧下降。
- **混合潜空间。** SDXL、SD3、Flux使用不同的VAE。在SDXL潜变量上训练的LoRA无法在SD3上工作。Hugging Face diffusers 0.30+版本会拒绝加载不匹配的检查点。
- **CFG过高。** `w > 10`会产生饱和、油腻的图像，并过度关注提示而牺牲多样性。最佳范围是`w = 3-7`。
- **负提示泄露。** 空的负提示会成为空token；填充的负提示会成为`ε_uncond`。两者不同；某些pipeline静默地默认为空token。

## 使用

2026年的生产堆栈：

| 目标 | 推荐骨干网络 |
|--------|----------------------|
| 窄领域、有成对数据、从头训练模型 | SDXL微调（LoRA / 全参）——最快部署 |
| 开放领域文生图、开源权重 | Flux.1-dev（12B，Apache/非商用）或 SD3.5-Large |
| 最快推理、开源权重 | Flux.1-schnell（1-4步，Apache）或 SDXL-Lightning |
| 最佳提示遵循、托管服务 | GPT-Image / DALL-E 3（仍然领先）、Midjourney v7、Imagen 4 |
| 编辑工作流 | Flux.1-Kontext（2024年12月）——原生支持图像+文本 |
| 研究、基线 | SD 1.5——古老但研究充分 |

## 交付

保存`outputs/skill-sd-prompter.md`。技能接受一个文本提示 + 目标风格，输出：模型与检查点、CFG尺度、采样器、负提示、分辨率、可选的ControlNet/IP-Adapter组合，以及每步质量检查清单。

## 练习

1. **简单。** 运行`code/main.py`，设置引导`w ∈ {0, 1, 3, 7, 15}`。记录每个类别的平均样本。当`w`为何值时，类别均值偏离真实数据均值？
2. **中等。** 将玩具线性编码器替换为一对带有重构损失的tanh-MLP编码器/解码器。在新潜变量上重新训练扩散。样本质量有变化吗？
3. **困难。** 使用diffusers设置一个真正的Stable Diffusion推理：加载`sdxl-base`，运行30步Euler采样，CFG=7，计时。然后切换到`sdxl-turbo`，4步，CFG=0。相同主题，不同质量——描述发生了什么变化及原因。

## 关键术语

| 术语 | 人们常说的 | 实际含义 |
|------|-----------------|-----------------------|
| 第一阶段 (First stage) | "VAE" | 训练好的编码器/解码器对；将512²压缩为64²。 |
| 第二阶段 (Second stage) | "U-Net" | 潜空间上的扩散模型。 |
| CFG | "引导尺度" | `(1+w)·ε_cond - w·ε_uncond`；调节条件强度。 |
| 空token (Null token) | "空提示嵌入" | 用于`ε_uncond`的无条件嵌入。 |
| 交叉注意力 (Cross-attention) | "文本如何进入" | 每个U-Net块将文本token作为K和V进行注意力计算。 |
| DiT | "扩散Transformer" | 用Transformer替代U-Net，作用于潜变量块；扩展性更好。 |
| MMDiT | "多模态DiT" | SD3的架构：文本和图像流通过联合注意力处理。 |
| VAE缩放因子 | "魔法数字" | 将潜变量除以约5.4，使扩散在单位方差空间中运行。 |

## 生产笔记：在8GB消费级GPU上运行Flux-12B

参考的Flux集成是经典的“我有消费级GPU，能部署它吗？”方案。诀窍与生产推理文献中列出的三旋钮配方相同，应用于扩散DiT：

1. **分步加载。** Flux有三个网络，它们无需同时存在于显存中：T5-XXL文本编码器（fp32约10 GB）、CLIP-L（小）、12B MMDiT以及VAE。首先编码提示，*删除*编码器，加载DiT，去噪，*删除* DiT，加载VAE，解码。消费级8GB GPU一次只能容纳一个阶段。
2. **通过bitsandbytes进行4比特量化。** 在T5编码器和DiT上都使用`BitsAndBytesConfig(load_in_4bit=True, bnb_4bit_compute_dtype=torch.bfloat16)`。将内存需求降低8倍，根据Aritra的基准测试（笔记本中链接），文生图的质量损失几乎不可察觉。
3. **CPU offload。** `pipe.enable_model_cpu_offload()` 在每次前向传播推进时自动在CPU和GPU之间切换模块。增加10-20%延迟，但让pipeline能够运行。

内存计算如下：`10 GB T5 / 8 = 1.25 GB`（量化后），`12 B参数 × 0.5字节 = ~6 GB`（量化DiT），加上激活值。用stas00的术语来说，这是TP=1推理的极端情况——无模型并行，最大化量化。生产环境中，你会使用H100上的TP=2或TP=4；对于单个开发者的笔记本，这就是配方。

## 延伸阅读

- [Rombach et al. (2022). High-Resolution Image Synthesis with Latent Diffusion Models](https://arxiv.org/abs/2112.10752) — Stable Diffusion。
- [Podell et al. (2023). SDXL: Improving Latent Diffusion Models for High-Resolution Image Synthesis](https://arxiv.org/abs/2307.01952) — SDXL。
- [Peebles & Xie (2023). Scalable Diffusion Models with Transformers (DiT)](https://arxiv.org/abs/2212.09748) — DiT。
- [Esser et al. (2024). Scaling Rectified Flow Transformers for High-Resolution Image Synthesis](https://arxiv.org/abs/2403.03206) — SD3, MMDiT。
- [Ho & Salimans (2022). Classifier-Free Diffusion Guidance](https://arxiv.org/abs/2207.12598) — CFG。
- [Labs (2024). Flux.1 — Black Forest Labs announcement](https://blackforestlabs.ai/announcing-black-forest-labs/) — Flux.1系列。
- [Hugging Face Diffusers docs](https://huggingface.co/docs/diffusers/index) — 上述所有检查点的参考实现。