# 07 · 潜在扩散与 Stable Diffusion

> 在 512×512 图像上直接做像素空间扩散，是一种计算资源上的暴行。Rombach 等人（2022）发现：生成一张图像并不需要全部 786k 个维度——你只需要足够多的维度来捕捉语义结构，剩下的部分交给一个独立的解码器即可。把扩散过程放进 VAE 的潜在空间里运行——就这一个想法，成就了 Stable Diffusion。

**类型：** 实战
**语言：** Python
**前置：** 阶段 8 · 02（VAE）、阶段 8 · 06（DDPM）、阶段 7 · 09（ViT）
**时长：** 约 75 分钟

## 问题所在

在 512² 分辨率上做像素空间扩散，意味着「U-Net」要在形状为 `[B, 3, 512, 512]` 的张量上运行。对于一个 500M 参数的 U-Net，每个采样步约消耗 100 GFLOPS。50 步就是每张图 5 TFLOPS。在十亿量级的图像上训练，算力账单大得离谱。

这些 FLOPs 中的大部分，都被用来把感知上无关紧要的细节推过网络——那些有损 VAE 本可以压缩掉的高频纹理。Rombach 的思路是：只训练一次「VAE」（即*第一阶段*），将其冻结，然后把扩散过程完全放进 4 通道的 64×64 潜在空间（即*第二阶段*）中运行。同样的 U-Net，像素量只有 1/16，在可比质量下 FLOPs 减少约 64 倍。

这就是 Stable Diffusion 的配方。SD 1.x / 2.x 在 `64×64×4` 的潜变量上使用 860M 的 U-Net，SDXL 在 `128×128×4` 上使用 2.6B 的 U-Net，SD3 则把 U-Net 换成了带流匹配（flow matching）的「扩散 Transformer（Diffusion Transformer，DiT）」。Flux.1-dev（Black Forest Labs，2024）发布了一个 12B 参数的 DiT-MMDiT。它们全都运行在同一套两阶段底座之上。

## 核心概念

〔图：潜在扩散——VAE 压缩 + 潜在空间中的扩散〕

**两个阶段，分别训练。**

1. **第一阶段——VAE。** 编码器 `E(x) → z`，解码器 `D(z) → x`。目标压缩率：在每个空间轴上 8 倍下采样，并调整通道数，使潜变量总尺寸约为像素数的 1/16。损失 = 重建损失（L1 + LPIPS 感知损失）+ KL 损失（权重很小，这样 `z` 不会被强行逼成高斯分布，因为我们并不需要从 `z` 精确采样）。通常还会加上对抗损失，使解码出的图像更锐利。

2. **第二阶段——在 `z` 上做扩散。** 把 `z = E(x_real)` 当作数据。训练一个 U-Net（或 DiT）来对 `z_t` 去噪。推理时：先通过扩散采样出 `z_0`，再用 `x = D(z_0)` 解码。

**文本条件。** 还有两个额外组件。一个冻结的文本编码器（SD 1.x 用 CLIP-L，SD 2/XL 用 CLIP-L+OpenCLIP-G，SD3 和 Flux 用 T5-XXL）。一个交叉注意力（cross-attention）注入：每个 U-Net 块接收 `[Q = 图像特征, K = V = 文本 token]` 并将它们融合。这些 token 是文本影响图像的唯一途径。

**损失函数与第 06 课完全相同。** 同样是对噪声做 DDPM / 流匹配的 MSE。你只是换了数据所在的域而已。

## 架构变体

| 模型 | 年份 | 主干 | 潜变量形状 | 文本编码器 | 参数量 |
|-------|------|----------|--------------|--------------|--------|
| SD 1.5 | 2022 | U-Net | 64×64×4 | CLIP-L（77 token） | 860M |
| SD 2.1 | 2022 | U-Net | 64×64×4 | OpenCLIP-H | 865M |
| SDXL | 2023 | U-Net + refiner | 128×128×4 | CLIP-L + OpenCLIP-G | 2.6B + 6.6B |
| SDXL-Turbo | 2023 | 蒸馏版 | 128×128×4 | 同上 | 1-4 步采样 |
| SD3 | 2024 | MMDiT（多模态 DiT） | 128×128×16 | T5-XXL + CLIP-L + CLIP-G | 2B / 8B |
| Flux.1-dev | 2024 | MMDiT | 128×128×16 | T5-XXL + CLIP-L | 12B |
| Flux.1-schnell | 2024 | MMDiT 蒸馏版 | 128×128×16 | T5-XXL + CLIP-L | 12B，1-4 步 |

趋势是：用 DiT（在潜变量 patch 上运行的 transformer）替代 U-Net，扩大文本编码器规模（在指令遵循上 T5 优于 CLIP），增加潜变量通道数（4 → 16 带来更多细节空间）。

## 动手实现

`code/main.py` 在第 06 课的 DDPM 之上，叠加了一个玩具式的一维「VAE」（恒等编码器 + 解码器，仅作演示；真实 VAE 会是一个卷积网络），并加入了带「无分类器引导（classifier-free guidance，CFG）」的类别条件。它表明：无论你在原始一维数值上运行，还是在编码后的数值上运行，同一套扩散损失都同样有效——这正是关键洞见。

### 第 1 步：编码器/解码器

```python
def encode(x):    return x * 0.5          # 玩具式"压缩"到更小的尺度
def decode(z):    return z * 2.0
```

真实 VAE 拥有训练好的权重。出于教学目的，这个线性映射已足以说明：扩散在 `z` 上运行，而不关心原始数据空间。

### 第 2 步：在 `z` 空间中扩散

与第 06 课相同的 DDPM。网络看到的数据是 `z = E(x)`。采样出 `z_0` 后，用 `D(z_0)` 解码。

### 第 3 步：无分类器引导

训练时，以 10% 的概率丢弃类别标签（替换为一个空 token）。推理时，同时计算 `ε_cond` 和 `ε_uncond`，然后：

```python
eps_cfg = (1 + w) * eps_cond - w * eps_uncond
```

`w = 0` = 无引导（多样性最大），`w = 3` = 默认值，`w = 7+` = 过饱和 / 过度锐化。

### 第 4 步：文本条件（仅概念，无代码）

把类别标签替换为一个冻结文本编码器的输出。通过交叉注意力把文本嵌入喂给 U-Net：

```python
h = h + CrossAttention(Q=h, K=text_embed, V=text_embed)
```

这就是类别条件扩散模型与 Stable Diffusion 之间唯一实质性的区别。

## 常见陷阱

- **VAE 尺度不匹配。** SD 1.x 的 VAE 在编码后会乘上一个缩放常数（`scaling_factor ≈ 0.18215`）。忘记这一步会让 U-Net 在方差严重错误的潜变量上训练。每个 checkpoint 都自带这个常数。
- **文本编码器静默出错。** SD3 需要 T5-XXL 且 token 数 >=128，回退到仅用 CLIP 是有损的。务必检查 `use_t5=True`，否则提示词保真度会崩塌。
- **混用潜在空间。** SDXL、SD3、Flux 用的是各不相同的 VAE。在 SDXL 潜变量上训练的 LoRA 无法用于 SD3。Hugging Face diffusers 0.30+ 会拒绝加载不匹配的 checkpoint。
- **CFG 过高。** `w > 10` 会产生过饱和、油腻的图像，并以牺牲多样性为代价过度拟合提示词。最佳区间是 `w = 3-7`。
- **负向提示词泄漏。** 空的负向提示词会变成空 token；填写了内容的负向提示词则会变成 `ε_uncond`。两者并不相同；某些管线会静默地默认使用空 token。

## 实际应用

2026 年的生产技术栈：

| 目标 | 推荐主干 |
|--------|----------------------|
| 窄领域、成对数据、从零训练模型 | SDXL 微调（LoRA / 全量）——上线最快 |
| 开放域文生图、开放权重 | Flux.1-dev（12B，Apache / 非商用）或 SD3.5-Large |
| 最快推理、开放权重 | Flux.1-schnell（1-4 步，Apache）或 SDXL-Lightning |
| 最佳提示词遵循、托管服务 | GPT-Image / DALL-E 3（仍然是）、Midjourney v7、Imagen 4 |
| 编辑工作流 | Flux.1-Kontext（2024 年 12 月）——原生支持图像 + 文本输入 |
| 研究、基线 | SD 1.5——古老但研究透彻 |

## 交付物

保存 `outputs/skill-sd-prompter.md`。该 skill 接收一段文本提示词 + 目标风格，输出：模型 + checkpoint、CFG 缩放值、采样器、负向提示词、分辨率、可选的 ControlNet/IP-Adapter 组合，以及一份逐步 QA 检查清单。

## 练习

1. **简单。** 用引导值 `w ∈ {0, 1, 3, 7, 15}` 运行 `code/main.py`。记录各类别的样本均值。在哪个 `w` 下，类别均值会偏离真实数据均值更远？
2. **中等。** 把玩具式线性编码器换成一对带重建损失的 tanh-MLP 编码器/解码器。在新潜变量上重新训练扩散。样本质量是否会改变？
3. **困难。** 用 diffusers 搭建一次真实的 Stable Diffusion 推理：加载 `sdxl-base`，以 CFG=7 运行 30 步 Euler 采样并计时。然后换成 `sdxl-turbo`，用 4 步、CFG=0。相同主题、不同质量——描述发生了什么变化以及原因。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------------|-----------------------|
| 第一阶段（First stage） | "那个 VAE" | 训练好的编码器/解码器对；把 512² 压缩到 64²。 |
| 第二阶段（Second stage） | "那个 U-Net" | 在潜在空间上运行的扩散模型。 |
| CFG | "引导缩放值" | `(1+w)·ε_cond - w·ε_uncond`；调节条件强度。 |
| 空 token（Null token） | "空提示词嵌入" | 用于计算 `ε_uncond` 的无条件嵌入。 |
| 交叉注意力（Cross-attention） | "文本如何进来" | 每个 U-Net 块把文本 token 当作 K 和 V 进行注意力。 |
| DiT | "扩散 Transformer" | 用在潜变量 patch 上运行的 transformer 替代 U-Net；扩展性更好。 |
| MMDiT | "多模态 DiT" | SD3 的架构：文本流与图像流，并做联合注意力。 |
| VAE 缩放因子（VAE scaling factor） | "魔法数字" | 把潜变量除以约 5.4，使扩散在单位方差空间中运行。 |

## 生产注记：在 8GB 消费级 GPU 上运行 Flux-12B

参考的 Flux 集成方案，是那套经典的"我有一块消费级 GPU，能上线这玩意吗？"配方。诀窍与生产推理文献列出的三旋钮配方相同，只是应用到了扩散 DiT 上：

1. **错峰加载。** Flux 有几个永远不需要同时驻留显存的网络：T5-XXL 文本编码器（fp32 下约 10 GB）、CLIP-L（很小）、12B 的 MMDiT，以及 VAE。先编码提示词，*删除*编码器，加载 DiT，去噪，*删除* DiT，加载 VAE，解码。8GB 的消费级 GPU 一次只能装下一个阶段。
2. **通过 bitsandbytes 做 4-bit 量化。** 对 T5 编码器和 DiT 同时使用 `BitsAndBytesConfig(load_in_4bit=True, bnb_4bit_compute_dtype=torch.bfloat16)`。内存削减 8 倍，按照 Aritra 的基准测试（notebook 中有链接），文生图的质量下降几乎不可察觉。
3. **CPU 卸载。** `pipe.enable_model_cpu_offload()` 会随着每次前向传播的推进，在 CPU 与 GPU 之间自动换入换出模块。会增加 10-20% 的延迟，但能让整条管线得以运行。

内存核算如下：`10 GB T5 / 8 = 1.25 GB`（量化后），`12 B 参数 × 0.5 字节 = 约 6 GB`（量化后的 DiT），再加上激活值。用 stas00 的说法，这是 TP=1 推理的极端情形——没有模型并行，量化拉满。在生产环境中，你会在 H100 上跑 TP=2 或 TP=4；而对于一台单独的开发笔记本，这就是那套配方。

## 延伸阅读

- [Rombach et al. (2022). High-Resolution Image Synthesis with Latent Diffusion Models](https://arxiv.org/abs/2112.10752) —— Stable Diffusion。
- [Podell et al. (2023). SDXL: Improving Latent Diffusion Models for High-Resolution Image Synthesis](https://arxiv.org/abs/2307.01952) —— SDXL。
- [Peebles & Xie (2023). Scalable Diffusion Models with Transformers (DiT)](https://arxiv.org/abs/2212.09748) —— DiT。
- [Esser et al. (2024). Scaling Rectified Flow Transformers for High-Resolution Image Synthesis](https://arxiv.org/abs/2403.03206) —— SD3、MMDiT。
- [Ho & Salimans (2022). Classifier-Free Diffusion Guidance](https://arxiv.org/abs/2207.12598) —— CFG。
- [Labs (2024). Flux.1 — Black Forest Labs announcement](https://blackforestlabs.ai/announcing-black-forest-labs/) —— Flux.1 家族。
- [Hugging Face Diffusers docs](https://huggingface.co/docs/diffusers/index) —— 上述所有 checkpoint 的参考实现。
