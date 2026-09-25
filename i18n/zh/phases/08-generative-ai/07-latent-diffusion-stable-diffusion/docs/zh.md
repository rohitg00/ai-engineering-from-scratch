# 潜空间扩散与 Stable Diffusion

> 在 512×512 图像上做像素空间扩散是一种计算上的暴行。Rombach 等人（2022）注意到，你并不需要全部 78.6 万个维度来生成一张图像——你只需要足够捕捉语义结构的维度，其余部分交给一个单独的解码器。把扩散放进 VAE 的潜空间里运行。这一个想法就是 Stable Diffusion。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 8 · 02 (VAE)、Phase 8 · 06 (DDPM)、Phase 7 · 09 (ViT)
**Time:** ~75 分钟

## 问题所在

在 512² 分辨率下做像素空间扩散，意味着 U-Net 要处理形状为 `[B, 3, 512, 512]` 的张量。对于一个 5 亿参数的 U-Net，每个采样步约需 100 GFLOPS。五十步就是每张图 5 TFLOPS。用十亿张图训练，计算开销高得离谱。

这些 FLOPs 大部分花在了把感知上不重要的细节推过网络——那些有损 VAE 本可以压缩掉的高频纹理。Rombach 的想法：先训练一次 VAE（*第一阶段*），将其冻结，然后完全在 4 通道 64×64 的潜空间中运行扩散（*第二阶段*）。同样的 U-Net，1/16 的像素量，FLOPs 减少约 64 倍，质量相当。

这就是 Stable Diffusion 的配方。SD 1.x / 2.x 在 `64×64×4` 的潜变量上使用 860M 的 U-Net，SDXL 在 `128×128×4` 上使用 2.6B 的 U-Net，SD3 把 U-Net 换成了带 flow matching 的 Diffusion Transformer（DiT）。Flux.1-dev（Black Forest Labs，2024）搭载了一个 12B 参数的 DiT-MMDiT。它们都运行在同样的两阶段底座之上。

## 核心概念

![Latent diffusion: VAE compression + diffusion in latent space](../assets/latent-diffusion.svg)

**两个阶段，分开训练。**

1. **阶段 1 —— VAE。** 编码器 `E(x) → z`，解码器 `D(z) → x`。目标压缩率：每个空间轴下采样 8 倍 + 调整通道数，使总潜变量大小约为像素数的 1/16。损失 = 重建（L1 + LPIPS 感知损失）+ KL（权重很小，以免把 `z` 逼得太接近高斯分布，因为我们不需要从 `z` 精确采样）。通常还带对抗损失，使解码图像足够锐利。

2. **阶段 2 —— 在 `z` 上做扩散。** 把 `z = E(x_real)` 当作数据。训练一个 U-Net（或 DiT）对 `z_t` 去噪。推理时：通过扩散采样 `z_0`，然后 `x = D(z_0)`。

**文本条件化。** 另外两个组件。一个冻结的文本编码器（SD 1.x 用 CLIP-L，SD 2/XL 用 CLIP-L+OpenCLIP-G，SD3 和 Flux 用 T5-XXL）。一个 cross-attention 注入：每个 U-Net 块接收 `[Q = image features, K = V = text tokens]` 并将其混合进来。这些 token 是文本影响图像的唯一途径。

**损失函数与第 06 课完全相同。** 同样是对噪声的 DDPM / flow matching MSE。你只是换了数据域。

## 架构变体

| 模型 | 年份 | 骨干网络 | 潜变量形状 | 文本编码器 | 参数量 |
|-------|------|----------|--------------|--------------|--------|
| SD 1.5 | 2022 | U-Net | 64×64×4 | CLIP-L (77 tokens) | 860M |
| SD 2.1 | 2022 | U-Net | 64×64×4 | OpenCLIP-H | 865M |
| SDXL | 2023 | U-Net + refiner | 128×128×4 | CLIP-L + OpenCLIP-G | 2.6B + 6.6B |
| SDXL-Turbo | 2023 | 蒸馏版 | 128×128×4 | 同上 | 1-4 步采样 |
| SD3 | 2024 | MMDiT (multimodal DiT) | 128×128×16 | T5-XXL + CLIP-L + CLIP-G | 2B / 8B |
| Flux.1-dev | 2024 | MMDiT | 128×128×16 | T5-XXL + CLIP-L | 12B |
| Flux.1-schnell | 2024 | MMDiT 蒸馏版 | 128×128×16 | T5-XXL + CLIP-L | 12B, 1-4 步 |

趋势：用 DiT（在潜变量 patch 上的 transformer）取代 U-Net，扩大文本编码器规模（在提示词遵循度上 T5 优于 CLIP），增加潜变量通道数（4 → 16 提供更多细节余量）。

```figure
noise-schedule
```

## 动手实现

`code/main.py` 在第 06 课的 DDPM 之上叠加了一个玩具级 1-D "VAE"（编码器 + 解码器均为恒等映射，仅作演示；真实的 VAE 会是一个卷积网络），并添加了带 classifier-free guidance 的类别条件化。它展示了同样的扩散损失无论作用于原始 1-D 值还是编码后的值都有效——这就是关键洞见。

### 步骤 1：编码器/解码器

```python
def encode(x):    return x * 0.5          # toy "compression" to smaller scale
def decode(z):    return z * 2.0
```

真实的 VAE 有训练好的权重。出于教学目的，这个线性映射足以说明扩散作用于 `z` 而不关心原始数据空间。

### 步骤 2：在 `z` 空间中做扩散

与第 06 课的 DDPM 相同。网络看到的数据是 `z = E(x)`。采样出 `z_0` 后，用 `D(z_0)` 解码。

### 步骤 3：classifier-free guidance

训练时，10% 的情况下丢弃类别标签（替换为 null token）。推理时，同时计算 `ε_cond` 和 `ε_uncond`，然后：

```python
eps_cfg = (1 + w) * eps_cond - w * eps_uncond
```

`w = 0` = 无引导（完全多样性），`w = 3` = 默认值，`w = 7+` = 饱和 / 过度锐化。

### 步骤 4：文本条件化（概念，非代码）

把类别标签换成冻结文本编码器的输出。通过 cross-attention 把文本嵌入喂给 U-Net：

```python
h = h + CrossAttention(Q=h, K=text_embed, V=text_embed)
```

这就是类别条件扩散模型与 Stable Diffusion 之间唯一的实质性差别。

## 常见陷阱

- **VAE 尺度不匹配。** SD 1.x 的 VAE 在编码后有一个缩放常数（`scaling_factor ≈ 0.18215`）。忘记这一点会让 U-Net 在方差严重错误的潜变量上训练。每个 checkpoint 都自带一个该常数。
- **文本编码器悄然出错。** SD3 需要 T5-XXL 且 token 数 >=128，而只回退到 CLIP 是有损的。务必检查 `use_t5=True`，否则提示词保真度会崩塌。
- **混用潜空间。** SDXL、SD3、Flux 使用的 VAE 各不相同。在 SDXL 潜变量上训练的 LoRA 无法用于 SD3。Hugging Face diffusers 0.30+ 会拒绝加载不匹配的 checkpoint。
- **CFG 过高。** `w > 10` 会产生饱和、油润的图像，并为了贴合提示词而牺牲多样性。最佳区间是 `w = 3-7`。
- **负面提示词泄漏。** 空的负面提示词等于 null token；填了内容的负面提示词等于 `ε_uncond`。两者并不相同；某些 pipeline 会悄然默认使用 null。

## 选型使用

2026 年的生产级技术栈：

| 目标 | 推荐骨干网络 |
|--------|----------------------|
| 窄领域、有配对数据、从零训练模型 | SDXL 微调（LoRA / 全量）—— 最快落地 |
| 开放域文生图、开放权重 | Flux.1-dev（12B，Apache / 非商用）或 SD3.5-Large |
| 推理最快、开放权重 | Flux.1-schnell（1-4 步，Apache）或 SDXL-Lightning |
| 提示词遵循度最佳、托管服务 | GPT-Image / DALL-E 3（依然是）、Midjourney v7、Imagen 4 |
| 编辑工作流 | Flux.1-Kontext（2024 年 12 月）—— 原生接受图像 + 文本 |
| 研究用基线 | SD 1.5 —— 老旧但研究充分 |

## 交付上线

保存 `outputs/skill-sd-prompter.md`。该技能接收一个文本提示 + 目标风格，输出：模型 + checkpoint、CFG scale、采样器、负面提示词、分辨率、可选的 ControlNet/IP-Adapter 组合，以及一个分步 QA 清单。

## 练习

1. **简单。** 以 guidance `w ∈ {0, 1, 3, 7, 15}` 运行 `code/main.py`。按类别记录样本均值。当 `w` 为多大时，类别均值开始偏离超出真实数据均值？
2. **中等。** 把玩具级线性编码器换成带重建损失的 tanh-MLP 编码器/解码器对。在新潜变量上重新训练扩散。样本质量有变化吗？
3. **困难。** 用 diffusers 搭建真实的 Stable Diffusion 推理：加载 `sdxl-base`，以 CFG=7 跑 30 步 Euler 并计时。然后切换到 `sdxl-turbo`，用 4 步、CFG=0。同一个主体，不同的质量——描述发生了什么变化以及为什么。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------------|-----------------------|
| 第一阶段 | "那个 VAE" | 训练好的编码器/解码器对；把 512² 压缩到 64²。 |
| 第二阶段 | "那个 U-Net" | 在潜空间上运行的扩散模型。 |
| CFG | "guidance scale" | `(1+w)·ε_cond - w·ε_uncond`；调节条件化强度。 |
| Null token | "空提示词嵌入" | 用于 `ε_uncond` 的无条件嵌入。 |
| Cross-attention | "文本进入的方式" | 每个 U-Net 块把文本 token 作为 K 和 V 进行注意力计算。 |
| DiT | "Diffusion Transformer" | 用在潜变量 patch 上的 transformer 取代 U-Net；扩展性更好。 |
| MMDiT | "多模态 DiT" | SD3 的架构：文本流与图像流共享联合注意力。 |
| VAE 缩放因子 | "魔法数字" | 将潜变量除以约 5.4，使扩散在单位方差空间中运行。 |

## 生产实践：在 8GB 消费级 GPU 上运行 Flux-12B

参考 Flux 集成是“我只有消费级 GPU，能上线吗？”的标准配方。其技巧就是生产推理文献中列出的三旋钮配方应用于扩散 DiT：

1. **分阶段错峰加载。** Flux 有四个从不需要同时驻留显存的网络：T5-XXL 文本编码器（fp32 下约 10 GB）、CLIP-L（很小）、12B MMDiT 和 VAE。先编码提示词，*删除*编码器，加载 DiT，去噪，*删除* DiT，加载 VAE，解码。8GB 消费级 GPU 一次只能容纳一个阶段。
2. **通过 bitsandbytes 做 4-bit 量化。** 对 T5 编码器和 DiT 都做 `BitsAndBytesConfig(load_in_4bit=True, bnb_4bit_compute_dtype=torch.bfloat16)`。内存减少 8 倍，根据 Aritra 的基准测试（见 notebook 中的链接），文生图的质量下降无法察觉。
3. **CPU offload。** `pipe.enable_model_cpu_offload()` 会在每次前向传播推进时在 CPU 和 GPU 之间自动交换模块。增加 10-20% 的延迟，但让 pipeline 至少能跑起来。

内存账目是：`10 GB T5 / 8 = 1.25 GB` 量化后，加上 `12 B params × 0.5 bytes = ~6 GB` 量化 DiT，再加激活值。用 stas00 的话说，这是 TP=1 推理的极限场景——没有模型并行，量化拉满。生产环境你会在 H100 上跑 TP=2 或 TP=4；而对一台开发笔记本来说，这就是那个配方。

## 延伸阅读

- [Rombach et al. (2022). High-Resolution Image Synthesis with Latent Diffusion Models](https://arxiv.org/abs/2112.10752) —— Stable Diffusion。
- [Podell et al. (2023). SDXL: Improving Latent Diffusion Models for High-Resolution Image Synthesis](https://arxiv.org/abs/2307.01952) —— SDXL。
- [Peebles & Xie (2023). Scalable Diffusion Models with Transformers (DiT)](https://arxiv.org/abs/2212.09748) —— DiT。
- [Esser et al. (2024). Scaling Rectified Flow Transformers for High-Resolution Image Synthesis](https://arxiv.org/abs/2403.03206) —— SD3、MMDiT。
- [Ho & Salimans (2022). Classifier-Free Diffusion Guidance](https://arxiv.org/abs/2207.12598) —— CFG。
- [Labs (2024). Flux.1 — Black Forest Labs announcement](https://blackforestlabs.ai/announcing-black-forest-labs/) —— Flux.1 系列。
- [Hugging Face Diffusers 文档](https://huggingface.co/docs/diffusers/index) —— 以上所有 checkpoint 的参考实现。