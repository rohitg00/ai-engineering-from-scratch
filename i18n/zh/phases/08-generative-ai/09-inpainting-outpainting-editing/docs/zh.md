# 图像修复(Inpainting)、外绘(Outpainting)与图像编辑

> 文生图创造新事物，图像修复修复旧事物。在生产环境中，70% 的计费图像工作是编辑——替换背景、移除 Logo、扩展画布、重新生成手部。图像修复是 diffusion 模型真正创造价值的地方。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 8 · 07 (Latent Diffusion)、Phase 8 · 08 (ControlNet & LoRA)
**Time:** ~75 分钟

## 问题所在

客户发来一张完美的产品照片，但背景中有一个干扰视线的招牌。你想擦除招牌，其余部分保持像素级一致。你不能从零开始运行文生图——结果会有不同的颜色、不同的光照、不同的产品角度。你只想重新生成*被遮罩*的区域，并且希望重新生成的内容尊重周围的上下文。

这就是图像修复(Inpainting)。其变体：

- **Inpainting(修复)。** 重新生成遮罩内部，保留外部像素。
- **Outpainting(外绘)。** 重新生成遮罩外部(或画布之外)，保留内部。
- **Image editing(图像编辑)。** 重新生成整幅图像，但保持与原图的语义或结构一致性(SDEdit、InstructPix2Pix)。

2026 年的每个 diffusion 流水线都带有修复模式。Flux.1-Fill、Stable Diffusion Inpaint、SDXL-Inpaint、DALL-E 3 Edit。它们的工作原理相同。

## 核心概念

![Inpainting: mask-aware denoising with context-preserving reinjection](../assets/inpainting.svg)

### 朴素方法(以及为什么它是错的)

用遮罩运行标准的文生图。在每个采样步骤，将噪声潜变量中未遮罩的区域替换为前向扩散后的干净图像。它确实能工作……但效果很差。边界伪影会渗透出来，因为模型对遮罩区域内的内容没有任何信息。

### 正规的修复模型

训练一个修改过的 U-Net,输入通道为 9 而非 4:

```
input = concat([ noisy_latent (4ch), encoded_image (4ch), mask (1ch) ], dim=channel)
```

额外的通道是 VAE 编码后的源图像副本加上一个单通道遮罩。训练时，随机遮罩图像区域，训练模型仅对遮罩区域去噪，同时未遮罩区域作为干净的条件信号给出。推理时，模型可以"看到"遮罩区域周围的内容，并生成连贯的补全。

SD-Inpaint、SDXL-Inpaint、Flux-Fill 都使用这种 9 通道(或类似)输入。Diffusers 中的 `StableDiffusionInpaintPipeline`、`FluxFillPipeline`。

### SDEdit (Meng et al., 2022) — 免训练编辑

向源图像加噪至某个中间时刻 `t`,然后以新提示词从 `t` 反向运行至 0。无需重新训练。起始 `t` 的选择是在保真度与创作自由度之间权衡：

- `t/T = 0.3` → 与源图几乎一致，仅有细微风格变化
- `t/T = 0.6` → 中等程度编辑，保留粗略结构
- `t/T = 0.9` → 从近乎纯噪声生成，几乎不保留源图信息

### InstructPix2Pix (Brooks et al., 2023)

在 `(input_image, instruction, output_image)` 三元组上微调 diffusion 模型。推理时，以输入图像和文本指令(“让它变成日落”、"add a dragon")共同为条件。使用两个 CFG 尺度：图像尺度和文本尺度。

### RePaint (Lugmayr et al., 2022)

保留标准的无条件 diffusion 模型。在每个反向步骤中重采样——偶尔跳回更嘈杂的状态并重新生成。避免边界伪影。当你没有训练好的修复模型时使用。

```figure
inpaint-mask-reinject
```

## 动手构建

`code/main.py` 在 5 维数据上实现了一个玩具级的一维修复方案。我们在 5 维混合数据上训练一个 DDPM,其中每个样本是来自两个聚类之一的 5 个浮点数。推理时，我们"遮罩" 5 个维度中的 2 个，在每一步注入未遮罩的三个维度的噪声前向版本，并仅重新生成被遮罩的维度。

### 步骤 1:5 维 DDPM 数据

```python
def sample_data(rng):
    cluster = rng.choice([0, 1])
    center = [-1.0] * 5 if cluster == 0 else [1.0] * 5
    return [c + rng.gauss(0, 0.2) for c in center], cluster
```

### 步骤 2:在全部 5 个维度上训练去噪器

标准 DDPM。网络对 5 维噪声输入输出 5 维噪声预测。

### 步骤 3:推理时的遮罩感知反向过程

```python
def inpaint_step(x_t, mask, clean_image, alpha_bars, t, rng):
    # replace unmasked dims with a freshly noised version of the clean source
    a_bar = alpha_bars[t]
    for i in range(len(x_t)):
        if not mask[i]:
            x_t[i] = math.sqrt(a_bar) * clean_image[i] + math.sqrt(1 - a_bar) * rng.gauss(0, 1)
    # ...then run the normal reverse step on x_t
```

这是朴素方法，在玩具一维数据上是可行的。真实图像修复使用 9 通道输入，因为纹理连贯性更为重要。

### 步骤 4:外绘(Outpainting)

外绘就是遮罩反转的修复：遮罩新的(之前不存在的)画布区域，其余填充原图。训练目标完全相同。

## 常见陷阱

- **接缝。** 朴素方法会留下可见的边界，因为梯度信息无法跨越遮罩流动。修复方法：将遮罩膨胀 8-16 像素，或使用正规的修复模型。
- **遮罩泄漏。** 如果条件图像的未遮罩区域质量低或嘈杂，会污染遮罩内部的生成结果。轻微去噪或模糊处理。
- **CFG 与遮罩大小相互作用。** 小遮罩上用高 CFG = 过饱和补丁。小幅度编辑应降低 CFG。
- **SDEdit 保真度悬崖。** 从 `t/T = 0.5` 变到 `t/T = 0.6` 可能丢失主体身份。要做扫参并保存检查点。
- **提示词不匹配。** 提示词应描述*整幅*图像，而不仅仅是新内容。"A cat sitting on a chair" 而非 "a cat"。

## 实际应用

| 任务 | 流水线 |
|------|----------|
| 移除物体，小遮罩 | SD-Inpaint 或 Flux-Fill,标准提示词 |
| 替换天空 | SD-Inpaint + "blue sky at sunset" |
| 扩展画布 | SDXL outpaint 模式(8px 羽化)或 Flux-Fill 配合 outpaint 遮罩 |
| 重新生成手部 / 人脸 | SD-Inpaint,提示词重新描述主体 + ControlNet-Openpose |
| 改变某一区域风格 | SDEdit,在遮罩区域使用 `t/T=0.5` |
| "让它变成日落" | InstructPix2Pix 或 Flux-Kontext |
| 背景替换 | SAM 遮罩 → SD-Inpaint |
| 超高保真度 | 最难 cases 用 Flux-Fill 或 GPT-Image(托管) |

SAM(Meta 的 Segment Anything,2023)+ diffusion 修复是 2026 年的背景移除流水线。SAM 2(2024)可处理视频。

## 上线交付

保存 `outputs/skill-editing-pipeline.md`。技能接收原图 + 编辑描述 + 可选遮罩(或 SAM 提示词)，输出：遮罩生成方式、基础模型、CFG 尺度(图像 + 文本)、SDEdit-t 或修复模式，以及 QA 清单。

## 练习

1. **简单。** 在 `code/main.py` 中，将被遮罩维度的比例从 0.2 变到 0.8。在什么比例下，修复质量(遮罩维度上的残差)等于无条件生成？
2. **中等。** 实现 RePaint:每隔 10 个反向步骤，跳回 5 步(加噪)并重新去噪。测量它是否减少了遮罩边缘的边界残差。
3. **困难。** 使用 Hugging Face diffusers 对比：在 20 个人脸重生成任务上，SD 1.5 Inpaint + ControlNet-Openpose vs Flux.1-Fill。分别对姿态一致性和身份保持评分。

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|-----------------|-----------------------|
| Inpainting | "填补空洞" | 重新生成遮罩内部；保留外部像素。 |
| Outpainting | "扩展画布" | 重新生成画布之外；保留内部。 |
| 9-channel U-Net | "正规的修复模型" | 以 `noisy \| encoded-source \| mask` 为输入的 U-Net。 |
| SDEdit | "带噪声水平的 img2img" | 加噪到时刻 `t`,用新提示词去噪。 |
| InstructPix2Pix | "纯文本编辑" | 在(图像、指令、输出)三元组上微调的 diffusion 模型。 |
| RePaint | "无需重新训练" | 反向过程中周期性重新加噪以减少接缝。 |
| SAM | "Segment Anything" | 通过点击或框生成遮罩；与修复搭配使用。 |
| Flux-Kontext | "带上下文编辑" | 接受参考图像 + 指令进行编辑的 Flux 变体。 |

## 生产提示：编辑流水线对延迟敏感

用户编辑图像时期望 5 秒以内的往返时间。1024² 分辨率下 30 步的 SDXL-Inpaint 在 L4 上耗时 3-4 秒，加上 SAM 遮罩生成(约 200 毫秒)和 VAE 编码/解码(合计约 500 毫秒)。在生产语境下，这是 TTFT 受限而非吞吐量受限——batch 为 1、低并发、最小化每个阶段：

- **SAM-H 是最慢的一环。** 1024² 下 SAM-H 约需 200 毫秒；SAM-ViT-B 约需 40 毫秒，质量损失轻微。SAM 2(视频)会增加时间维度的开销；单图像编辑不要用它。
- **尽可能跳过编码。** `pipe.image_processor.preprocess(img)` 会编码为潜变量。如果你已有上一次生成的潜变量(迭代式编辑 UI 中的典型情况)，直接通过 `latents=...` 传入，省去一次 VAE 编码。
- **遮罩膨胀也影响吞吐量。** 小遮罩意味着 U-Net 前向传播的大部分计算被浪费(未遮罩的像素反正会被钳制)。`diffusers` 的 `StableDiffusionInpaintPipeline` 无论如何都运行完整的 U-Net;只有 9 通道的正规修复变体才能利用遮罩计算。
- **Flux-Kontext 是 2025 年的答案。** 对 `(source_image, instruction)` 单次前向传播——无需单独遮罩，无需 SDEdit 噪声扫参。在 H100 上，一次编辑约 1.5 秒完成。架构层面的教训：合并各个阶段。

## 延伸阅读

- [Lugmayr et al. (2022). RePaint: Inpainting using Denoising Diffusion Probabilistic Models](https://arxiv.org/abs/2201.09865) — 免训练修复。
- [Meng et al. (2022). SDEdit: Guided Image Synthesis and Editing with Stochastic Differential Equations](https://arxiv.org/abs/2108.01073) — SDEdit。
- [Brooks, Holynski, Efros (2023). InstructPix2Pix](https://arxiv.org/abs/2211.09800) — 文本指令编辑。
- [Kirillov et al. (2023). Segment Anything](https://arxiv.org/abs/2304.02643) — SAM,遮罩来源。
- [Ravi et al. (2024). SAM 2: Segment Anything in Images and Videos](https://arxiv.org/abs/2408.00714) — 视频 SAM。
- [Hertz et al. (2022). Prompt-to-Prompt Image Editing with Cross-Attention Control](https://arxiv.org/abs/2208.01626) — 注意力层级的编辑。
- [Black Forest Labs (2024). Flux.1-Fill and Flux.1-Kontext](https://blackforestlabs.ai/flux-1-tools/) — 2024 年工具链。