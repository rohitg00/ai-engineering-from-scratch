# 图像修补、扩展与编辑

> 文生图创造新东西。图像修补修复旧东西。在生产中，70% 的可计费图像工作是编辑——替换背景、移除徽标、扩展画布、重生成手部。图像修补是扩散模型真正发挥价值的地方。

**类型：** 构建
**语言：** Python
**前置知识：** 阶段 8 · 07（潜在扩散）、阶段 8 · 08（ControlNet & LoRA）
**时间：** ~75 分钟

## 问题

客户发来一张完美的产品照片，背景中有一个分散注意力的标志。你想擦除标志，保持其他所有像素不变。你不能从头运行文生图——结果会有不同的颜色、不同的光照、不同的产品角度。你只想*只*重生成被遮罩的区域，并且希望重生成尊重周围的上下文。

这就是图像修补。变体：

- **Inpainting（图像修补）。** 在遮罩内部重生成，保持外部像素不变。
- **Outpainting（图像扩展）。** 在遮罩外部（或画布之外）重生成，保持内部不变。
- **Image editing（图像编辑）。** 重生成整个图像，但保持与原始图像的语义或结构保真度（SDEdit、InstructPix2Pix）。

2026 年的每个扩散流水线都附带一个图像修补模式。Flux.1-Fill、Stable Diffusion Inpaint、SDXL-Inpaint、DALL-E 3 Edit。它们都基于相同的原理。

## 概念

![图像修补：带上下文保持重注入的遮罩感知去噪](../assets/inpainting.svg)

### 朴素方法（以及为什么它错了）

使用遮罩运行标准文生图。在每个采样步骤，将未遮罩区域的带噪潜在表示替换为前向扩散的干净图像。它有效……但不理想。边界伪影会渗入，因为模型没有关于遮罩区域内是什么的信息。

### 正确的图像修补模型

训练一个修改后的 U-Net，接收 9 个输入通道而不是 4 个：

```
input = concat([ noisy_latent (4ch), encoded_image (4ch), mask (1ch) ], dim=channel)
```

额外的通道是 VAE 编码的源图像的副本加上一个单通道遮罩。训练时，你随机遮罩图像的区域，训练模型只对遮罩区域去噪，而未遮罩区域作为干净的条件信号给出。推理时，模型可以"看到"遮罩区域周围的内容，并产生连贯的补全。

SD-Inpaint、SDXL-Inpaint、Flux-Fill 都使用这种 9 通道（或类似）的输入。Diffusers 中的 `StableDiffusionInpaintPipeline`、`FluxFillPipeline`。

### SDEdit（Meng et al., 2022）——免费编辑

对源图像加噪到某个中间 `t`，然后从 `t` 向下运行反向链至 0，使用新的提示。无需重新训练。起始 `t` 的选择以保真度换取创作自由度：

- `t/T = 0.3` → 与源图像几乎相同，小幅风格变化
- `t/T = 0.6` → 中等编辑，保留粗略结构
- `t/T = 0.9` → 从接近噪声生成，源图像保留最少

### InstructPix2Pix（Brooks et al., 2023）

在 `(input_image, instruction, output_image)` 三元组上微调扩散模型。推理时，以输入图像和文本指令（"让它变成日落"、"添加一条龙"）为条件。两个 CFG 尺度：图像尺度和文本尺度。

### RePaint（Lugmayr et al., 2022）

保持一个标准的无条件扩散模型。在每个反向步骤，重新采样——偶尔跳回更嘈杂的状态并重新生成。避免边界伪影。在你没有训练好的图像修补模型时使用。

## 动手实现

`code/main.py` 在 5 维数据上实现了一个玩具 1-D 图像修补方案。我们在 5-D 混合数据上训练一个 DDPM，其中每个样本是来自两个聚类之一的 5 个浮点数。推理时，我们"遮罩"5 个维度中的 2 个，在每一步注入未遮罩的三个维度的带噪前向版本，并只重生成被遮罩的维度。

### 步骤 1：5-D DDPM 数据

```python
def sample_data(rng):
    cluster = rng.choice([0, 1])
    center = [-1.0] * 5 if cluster == 0 else [1.0] * 5
    return [c + rng.gauss(0, 0.2) for c in center], cluster
```

### 步骤 2：在所有 5 维上训练去噪器

标准 DDPM。网络为 5-D 带噪输入输出 5-D 噪声预测。

### 步骤 3：推理时，遮罩感知的反向

```python
def inpaint_step(x_t, mask, clean_image, alpha_bars, t, rng):
    # replace unmasked dims with a freshly noised version of the clean source
    a_bar = alpha_bars[t]
    for i in range(len(x_t)):
        if not mask[i]:
            x_t[i] = math.sqrt(a_bar) * clean_image[i] + math.sqrt(1 - a_bar) * rng.gauss(0, 1)
    # ...then run the normal reverse step on x_t
```

这是朴素方法，在玩具 1-D 数据上有效。真实的图像修补使用 9 通道输入，因为纹理一致性更重要。

### 步骤 4：图像扩展（Outpainting）

图像扩展是遮罩反转的图像修补：遮罩新（以前不存在的）画布，用原始图像填充其余部分。相同的训练目标。

## 陷阱

- **接缝。** 朴素方法留下可见边界，因为梯度信息不流经遮罩。修复：将遮罩膨胀 8-16 像素，或使用正确的图像修补模型。
- **遮罩泄漏。** 如果条件图像的未遮罩区域质量低或有噪声，它会污染遮罩内的生成。去噪或轻微模糊。
- **CFG 与遮罩大小交互。** 小遮罩上的高 CFG = 饱和补丁。对小编辑降低 CFG。
- **SDEdit 保真度悬崖。** 从 `t/T = 0.5` 到 `t/T = 0.6` 可能会丢失主体的身份。扫描并检查点。
- **提示不匹配。** 提示应该描述*整个*图像，而不仅仅是新内容。"一只坐在椅子上的猫"而不是"一只猫"。

## 应用

| 任务 | 流水线 |
|------|----------|
| 移除物体，小遮罩 | SD-Inpaint 或 Flux-Fill，标准提示 |
| 替换天空 | SD-Inpaint + "blue sky at sunset" |
| 扩展画布 | SDXL 扩展模式（8px 羽化）或带扩展遮罩的 Flux-Fill |
| 重生成手/脸 | SD-Inpaint + 重新描述主体的提示 + ControlNet-Openpose |
| 更改一个区域的风格 | 在遮罩区域上的 SDEdit，`t/T=0.5` |
| "让它变成日落" | InstructPix2Pix 或 Flux-Kontext |
| 背景替换 | SAM 遮罩 → SD-Inpaint |
| 超高保真度 | 最难案例使用 Flux-Fill 或 GPT-Image（托管） |

SAM（Meta 的 Segment Anything，2023）+ 扩散图像修补是 2026 年的背景移除流水线。SAM 2（2024）适用于视频。

## 交付

保存为 `outputs/skill-editing-pipeline.md`。技能接受原始图像 + 编辑描述 + 可选遮罩（或 SAM 提示）并输出：遮罩生成方法、基座模型、CFG 尺度（图像 + 文本）、SDEdit-t 或图像修补模式以及 QA 检查清单。

## 练习

1. **简单。** 在 `code/main.py` 中，将被遮罩维度的比例从 0.2 变到 0.8。在什么比例下，图像修补质量（遮罩维度中的残差）等于无条件生成？
2. **中等。** 实现 RePaint：每第 10 个反向步骤，跳回 5 步（添加噪声）并重新去噪。测量它是否减少了遮罩边缘的边界残差。
3. **困难。** 使用 Hugging Face diffusers 比较：SD 1.5 Inpaint + ControlNet-Openpose vs Flux.1-Fill 在 20 个人脸重生成任务上。分别评分姿态遵循和身份保持。

## 关键术语

| 术语 | 人们说的 | 实际含义 |
|------|-----------------|-----------------------|
| Inpainting | "填充空洞" | 在遮罩内部重生成；保持外部像素不变。 |
| Outpainting | "扩展画布" | 在画布外重生成；保持内部不变。 |
| 9-channel U-Net | "正确的图像修补模型" | 以 `noisy \| encoded-source \| mask` 为输入的 U-Net。 |
| SDEdit | "带噪声级别的图生图" | 加噪到时间 `t`，用新提示去噪。 |
| InstructPix2Pix | "仅文本编辑" | 在（图像、指令、输出）三元组上微调的扩散模型。 |
| RePaint | "无需重新训练" | 在反向过程中周期性地重新加噪以减少接缝。 |
| SAM | "Segment Anything" | 通过点击或框生成的遮罩器；与图像修补配对。 |
| Flux-Kontext | "带上下文的编辑" | 接受参考图像 + 指令进行编辑的 Flux 变体。 |

## 生产说明：编辑流水线对延迟敏感

编辑图像的用户期待 5 秒以内的往返时间。1024² 下的 30 步 SDXL-Inpaint 在 L4 上是 3-4 秒，加上 SAM 遮罩生成（约 200 ms）和 VAE 编码/解码（合计约 500 ms）。在生产框架中，这受 TTFT 限制而非吞吐量限制——批大小为 1，低并发，最小化每个阶段：

- **SAM-H 是慢的那个。** 1024² 下的 SAM-H 约 200 ms；SAM-ViT-B 约 40 ms，质量损失很小。SAM 2（视频）增加了时间开销；不要将其用于单图像编辑。
- **尽可能跳过编码。** `pipe.image_processor.preprocess(img)` 编码为潜在表示。如果你有之前生成中的潜在表示（在迭代编辑 UI 中常见），通过 `latents=...` 直接传递它们，以跳过一次 VAE 编码。
- **遮罩膨胀也影响吞吐量。** 小遮罩意味着大部分 U-Net 前向传播被浪费（未遮罩像素无论如何都被钳制）。`diffusers` 的 `StableDiffusionInpaintPipeline` 无论如何都运行完整的 U-Net；只有 9 通道的适当图像修补变体利用了遮罩计算。
- **Flux-Kontext 是 2025 年的答案。** 在 `(source_image, instruction)` 上的单次前向传播——没有单独的遮罩，没有 SDEdit 噪声扫描。在 H100 上，它在大约 1.5 秒内完成一次编辑。架构上的教训：合并阶段。

## 延伸阅读

- [Lugmayr et al. (2022). RePaint: Inpainting using Denoising Diffusion Probabilistic Models](https://arxiv.org/abs/2201.09865) — 无需训练的修补。
- [Meng et al. (2022). SDEdit: Guided Image Synthesis and Editing with Stochastic Differential Equations](https://arxiv.org/abs/2108.01073) — SDEdit。
- [Brooks, Holynski, Efros (2023). InstructPix2Pix](https://arxiv.org/abs/2211.09800) — 文本指令编辑。
- [Kirillov et al. (2023). Segment Anything](https://arxiv.org/abs/2304.02643) — SAM，遮罩来源。
- [Ravi et al. (2024). SAM 2: Segment Anything in Images and Videos](https://arxiv.org/abs/2408.00714) — 视频 SAM。
- [Hertz et al. (2022). Prompt-to-Prompt Image Editing with Cross-Attention Control](https://arxiv.org/abs/2208.01626) — 注意力级编辑。
- [Black Forest Labs (2024). Flux.1-Fill and Flux.1-Kontext](https://blackforestlabs.ai/flux-1-tools/) — 2024 年工具。
