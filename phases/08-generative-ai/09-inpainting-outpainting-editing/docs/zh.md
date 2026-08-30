# 09 · 图像修复、扩展与编辑

> 文生图创造新事物，图像修复（inpainting）则修补旧事物。在生产环境中，70% 的可计费图像工作是编辑——更换背景、移除 logo、扩展画布、重新生成一只手。图像修复正是扩散模型真正发挥价值的地方。

**类型：** 实战构建
**语言：** Python
**前置：** 阶段 8 · 07（潜在扩散），阶段 8 · 08（ControlNet 与 LoRA）
**时长：** 约 75 分钟

## 问题

客户发来一张完美的产品照片，但背景里有个碍眼的指示牌。你想抹掉那个指示牌，同时让其余部分逐像素保持不变。你不能从头跑一遍文生图——那样得到的结果会是不同的颜色、不同的光照、不同的产品角度。你只想重新生成被「掩码（mask）」覆盖的那部分区域，并且希望重新生成的内容尊重周围的上下文。

这就是图像修复（inpainting）。它有几个变体：

- **图像修复（Inpainting）。** 在掩码内部重新生成，保留掩码外部的像素。
- **图像扩展（Outpainting）。** 在掩码外部（或画布之外）重新生成，保留内部。
- **图像编辑（Image editing）。** 重新生成整张图，但在语义或结构上保持对原图的保真度（SDEdit、InstructPix2Pix）。

2026 年的每一个扩散管线都内置了图像修复模式。Flux.1-Fill、Stable Diffusion Inpaint、SDXL-Inpaint、DALL-E 3 Edit，它们都基于同一个原理工作。

## 核心概念

〔图：图像修复——掩码感知的去噪与保留上下文的重注入流程〕

### 朴素做法（以及它为什么是错的）

带掩码地跑一遍标准文生图。在每个采样步骤，用对干净图像做前向扩散得到的版本替换噪声潜变量中未被掩码的区域。它能用……但效果很差。边界伪影会渗透出来，因为模型完全不知道掩码区域内部是什么。

### 正确的图像修复模型

训练一个改造过的 U-Net，让它接收 9 个输入通道而非 4 个：

```
input = concat([ noisy_latent (4ch), encoded_image (4ch), mask (1ch) ], dim=channel)
```

这些额外通道是「VAE 编码后的源图像副本」加上「一个单通道掩码」。训练时，你随机掩码图像中的某些区域，并训练模型只对被掩码的区域去噪，同时把未被掩码的区域作为干净的条件信号提供。推理时，模型就能「看到」掩码区域的周边内容，从而生成连贯的补全结果。

SD-Inpaint、SDXL-Inpaint、Flux-Fill 都采用这种 9 通道（或类似）输入。在 Diffusers 中对应 `StableDiffusionInpaintPipeline`、`FluxFillPipeline`。

### SDEdit（Meng 等人，2022）——免训练编辑

对源图像加噪到某个中间时刻 `t`，然后用新的提示词从 `t` 一路反向运行到 0。无需重新训练。起始 `t` 的选择是在保真度与创作自由度之间做权衡：

- `t/T = 0.3` → 与源图几乎一致，仅有细微风格变化
- `t/T = 0.6` → 中等程度的编辑，保留粗略结构
- `t/T = 0.9` → 几乎从纯噪声生成，对源图的保留极少

### InstructPix2Pix（Brooks 等人，2023）

在 `(input_image, instruction, output_image)` 三元组上微调一个扩散模型。推理时，同时以输入图像和文本指令（「make it sunset」「add a dragon」）作为条件。它有两个 CFG 系数：图像系数和文本系数。

### RePaint（Lugmayr 等人，2022）

保留一个标准的无条件扩散模型。在每个反向步骤进行重采样——偶尔跳回到更嘈杂的状态再重新生成。这样可避免边界伪影。在你没有训练好的图像修复模型时使用。

## 动手构建

`code/main.py` 在 5 维数据上实现了一个玩具级的一维图像修复方案。我们在 5 维混合数据上训练一个 DDPM，其中每个样本是来自两个簇之一的 5 个浮点数。推理时，我们「掩码」掉 5 维中的 2 维，在每一步注入未被掩码的那 3 维的噪声前向版本，只重新生成被掩码的那些维度。

### 第 1 步：5 维 DDPM 数据

```python
def sample_data(rng):
    cluster = rng.choice([0, 1])
    center = [-1.0] * 5 if cluster == 0 else [1.0] * 5
    return [c + rng.gauss(0, 0.2) for c in center], cluster
```

### 第 2 步：在全部 5 维上训练去噪器

标准 DDPM。网络针对 5 维噪声输入输出 5 维噪声预测。

### 第 3 步：推理时进行掩码感知的反向过程

```python
def inpaint_step(x_t, mask, clean_image, alpha_bars, t, rng):
    # 用对干净源图重新加噪后的版本替换未被掩码的维度
    a_bar = alpha_bars[t]
    for i in range(len(x_t)):
        if not mask[i]:
            x_t[i] = math.sqrt(a_bar) * clean_image[i] + math.sqrt(1 - a_bar) * rng.gauss(0, 1)
    # ……然后对 x_t 运行常规的反向步骤
```

这就是朴素做法，它在玩具级的一维数据上奏效。真实的图像修复采用 9 通道输入，因为纹理连贯性在那里要重要得多。

### 第 4 步：图像扩展

图像扩展就是把掩码反转过来的图像修复：掩码住新的（此前并不存在的）画布，用原图填充其余部分。训练目标完全相同。

## 常见陷阱

- **接缝（Seams）。** 朴素做法会留下可见的边界，因为梯度信息无法跨越掩码流动。修复方法：将掩码膨胀（dilate）8-16 像素，或使用正规的图像修复模型。
- **掩码泄漏（Mask leakage）。** 如果条件图像中未被掩码的区域质量低下或带噪，它会污染掩码内部的生成结果。可对其做轻微去噪或模糊处理。
- **CFG 与掩码大小相互作用。** 在小掩码上使用高 CFG = 过饱和的色块。对小幅编辑应降低 CFG。
- **SDEdit 的保真度悬崖。** 从 `t/T = 0.5` 提到 `t/T = 0.6` 可能丢失主体的身份特征。要做扫描并设置检查点。
- **提示词不匹配。** 提示词应该描述*整张*图像，而不只是新增的内容。要写「A cat sitting on a chair」而不是「a cat」。

## 实际运用

| 任务 | 管线 |
|------|----------|
| 移除物体、小掩码 | SD-Inpaint 或 Flux-Fill，标准提示词 |
| 替换天空 | SD-Inpaint + "blue sky at sunset" |
| 扩展画布 | SDXL 图像扩展模式（8px 羽化）或带扩展掩码的 Flux-Fill |
| 重新生成手 / 脸 | SD-Inpaint，提示词重新描述主体 + ControlNet-Openpose |
| 改变某个区域的风格 | 在掩码区域上以 `t/T=0.5` 运行 SDEdit |
| 「Make it sunset」 | InstructPix2Pix 或 Flux-Kontext |
| 背景替换 | SAM 掩码 → SD-Inpaint |
| 超高保真度 | 对最棘手的情况使用 Flux-Fill 或 GPT-Image（托管服务） |

SAM（Meta 的 Segment Anything，2023）+ 扩散图像修复是 2026 年的背景移除管线。SAM 2（2024）可用于视频。

## 交付物

保存 `outputs/skill-editing-pipeline.md`。该 skill 接收一张原图 + 编辑描述 + 可选掩码（或 SAM 提示），并输出：掩码生成方法、基础模型、CFG 系数（图像 + 文本）、SDEdit 的 `t` 或图像修复模式，以及质检（QA）清单。

## 练习

1. **简单。** 在 `code/main.py` 中，把被掩码维度的比例从 0.2 变化到 0.8。在哪个比例下，图像修复质量（被掩码维度上的残差）会与无条件生成相当？
2. **中等。** 实现 RePaint：每隔 10 个反向步骤，跳回 5 步（加噪）并重新去噪。测量它是否降低了掩码边缘处的边界残差。
3. **困难。** 使用 Hugging Face diffusers 进行对比：在 20 个人脸重生成任务上，比较 SD 1.5 Inpaint + ControlNet-Openpose 与 Flux.1-Fill。分别为姿态贴合度和身份保持度打分。

## 关键术语

| 术语 | 人们怎么说 | 它实际指什么 |
|------|-----------------|-----------------------|
| 图像修复（Inpainting） | 「填补这个洞」 | 在掩码内部重新生成，保留外部像素。 |
| 图像扩展（Outpainting） | 「扩展画布」 | 在画布外部重新生成，保留内部。 |
| 9 通道 U-Net | 「正规的图像修复模型」 | 以 `noisy \| encoded-source \| mask` 作为输入的 U-Net。 |
| SDEdit | 「带噪声级别的图生图」 | 加噪到时刻 `t`，再用新提示词去噪。 |
| InstructPix2Pix | 「纯文本编辑」 | 在 (image, instruction, output) 三元组上微调的扩散模型。 |
| RePaint | 「无需重新训练」 | 在反向过程中周期性重新加噪，以减少接缝。 |
| SAM | 「Segment Anything」 | 通过点击或框选生成掩码；与图像修复配合使用。 |
| Flux-Kontext | 「带上下文编辑」 | 接收参考图像 + 指令进行编辑的 Flux 变体。 |

## 生产环境提示：编辑管线对延迟敏感

正在编辑图像的用户期望往返耗时低于 5 秒。在 1024² 分辨率下，一个 30 步的 SDXL-Inpaint 在 L4 上需要 3-4 秒，再加上 SAM 掩码生成（约 200 ms）以及 VAE 编码/解码（合计约 500 ms）。从生产视角看，这是受 TTFT 约束（TTFT-bound）而非受吞吐量约束——batch 为 1、低并发，必须把每个阶段都尽量压缩：

- **SAM-H 是慢的那个。** SAM-H 在 1024² 下约 200 ms；SAM-ViT-B 约 40 ms，仅有轻微的质量损失。SAM 2（视频）会带来时间维度上的额外开销；不要把它用于单张图像的编辑。
- **能省则省，跳过编码。** `pipe.image_processor.preprocess(img)` 会把图像编码为潜变量。如果你已经拥有上一次生成产生的潜变量（迭代式编辑 UI 中很常见），就通过 `latents=...` 直接传入，从而省掉一次 VAE 编码。
- **掩码膨胀对吞吐量同样重要。** 小掩码意味着 U-Net 前向传播的大部分都被浪费了（未被掩码的像素无论如何都会被钳制回去）。`diffusers` 的 `StableDiffusionInpaintPipeline` 无论如何都会跑完整个 U-Net；只有 9 通道的正规图像修复变体才能利用掩码计算（masked compute）。
- **Flux-Kontext 是 2025 年的答案。** 对 `(source_image, instruction)` 做单次前向传播——无需单独的掩码，也无需 SDEdit 噪声扫描。在 H100 上约 1.5 秒就能交付一次编辑。其架构层面的启示是：把多个阶段坍缩为一个。

## 延伸阅读

- [Lugmayr 等人（2022）。RePaint: Inpainting using Denoising Diffusion Probabilistic Models](https://arxiv.org/abs/2201.09865) ——免训练的图像修复。
- [Meng 等人（2022）。SDEdit: Guided Image Synthesis and Editing with Stochastic Differential Equations](https://arxiv.org/abs/2108.01073) ——SDEdit。
- [Brooks、Holynski、Efros（2023）。InstructPix2Pix](https://arxiv.org/abs/2211.09800) ——文本指令编辑。
- [Kirillov 等人（2023）。Segment Anything](https://arxiv.org/abs/2304.02643) ——SAM，掩码来源。
- [Ravi 等人（2024）。SAM 2: Segment Anything in Images and Videos](https://arxiv.org/abs/2408.00714) ——视频版 SAM。
- [Hertz 等人（2022）。Prompt-to-Prompt Image Editing with Cross-Attention Control](https://arxiv.org/abs/2208.01626) ——注意力级别的编辑。
- [Black Forest Labs（2024）。Flux.1-Fill 与 Flux.1-Kontext](https://blackforestlabs.ai/flux-1-tools/) ——2024 年的工具链。
