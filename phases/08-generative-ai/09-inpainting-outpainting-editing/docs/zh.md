# 图像修补（Inpainting）、外扩（Outpainting）与图像编辑（Image Editing）

> 文生图创造新事物，图像修补修复旧事物。在生产环境中，70% 的可计费图像工作是编辑——替换背景、移除标志、扩展画布、重绘手部。图像修补正是扩散模型大显身手的领域。

**类型：** 构建（Build）
**编程语言：** Python
**前置条件：** 阶段 8 · 07（潜在扩散 Latent Diffusion），阶段 8 · 08（ControlNet 与 LoRA）
**时间：** 约 75 分钟

## 问题

客户发来一张完美的产品照片，但背景中有一个分散注意力的标志。你想要擦除该标志，同时保持其他像素完全不变。你不能从头运行文生图——结果会呈现不同的颜色、不同的光照、不同的产品角度。你希望*只*重绘被遮罩（mask）的区域，并且希望重绘结果尊重周围上下文。

这就是图像修补。变体包括：

- **图像修补（Inpainting）**：在遮罩内部重绘，保持遮罩外部像素不变。
- **图像外扩（Outpainting）**：在遮罩外部（或画布外）重绘，保持遮罩内部像素不变。
- **图像编辑（Image Editing）**：重绘整个图像，但保持对原图的语义或结构保真度（SDEdit，InstructPix2Pix）。

到2026年，每个扩散管线都内置了图像修补模式：Flux.1-Fill、Stable Diffusion Inpaint、SDXL-Inpaint、DALL·E 3 Edit。它们基于相同的原理运行。

## 概念

![图像修补：带掩码感知的去噪与上下文保持重注入](../assets/inpainting.svg)

### 朴素方法（及其错误原因）

使用遮罩运行标准文生图。在每个采样步骤中，用前向扩散后的干净图像替换噪声潜在空间中未遮罩的区域。这...效果很差。边界伪影会渗入，因为模型没有关于遮罩区域内容的任何信息。

### 正确的图像修补模型

训练一个修改过的U-Net，它接受9个输入通道而非4个：

```
input = concat([ noisy_latent (4ch), encoded_image (4ch), mask (1ch) ], dim=channel)
```

额外的通道是VAE编码后的源图像副本加上一个单通道遮罩。在训练时，你随机遮罩图像的区域，并训练模型仅对遮罩区域进行去噪，而未遮罩区域则作为干净的调节信号给出。在推理时，模型可以“看到”遮罩区域周围的内容，从而产生连贯的补全结果。

SD-Inpaint、SDXL-Inpaint、Flux-Fill都使用了这种9通道（或类似）输入。Diffusers中的`StableDiffusionInpaintPipeline`、`FluxFillPipeline`。

### SDEdit (Meng et al., 2022) —— 免训练编辑

向源图像添加噪声到某个中间时间步`t`，然后从`t`向下到0运行逆向链，并配合新提示词。无需重新训练。起始`t`的选择在保真度与创意自由度之间权衡：

- `t/T = 0.3` → 与源图像几乎相同，微小风格变化
- `t/T = 0.6` → 中等编辑，保留粗略结构
- `t/T = 0.9` → 从接近噪声生成，源图像保留极少

### InstructPix2Pix (Brooks et al., 2023)

在`(输入图像, 指令, 输出图像)`三元组上微调扩散模型。推理时，以输入图像和文本指令（如“将其变成日落”、“添加一条龙”）为条件。有两个CFG缩放比例：图像缩放和文本缩放。

### RePaint (Lugmayr et al., 2022)

保留标准的无条件扩散模型。在每个逆向步骤中重新采样——偶尔跳回到更噪声的状态并重新生成。避免了边界伪影。在没有训练好的图像修补模型时使用。

## 构建它

`code/main.py`在5维数据上实现了一个玩具1维图像修补方案。我们在5维混合数据上训练DDPM，其中每个样本来自两个簇之一，包含5个浮点数。推理时，我们“遮罩”5个维度中的2个，在每一步将未遮罩三个维度的加噪正向版本注入，并仅重绘遮罩维度。

### 步骤1：5维DDPM数据

```python
def sample_data(rng):
    cluster = rng.choice([0, 1])
    center = [-1.0] * 5 if cluster == 0 else [1.0] * 5
    return [c + rng.gauss(0, 0.2) for c in center], cluster
```

### 步骤2：在所有5维上训练去噪器

标准DDPM。网络针对5维噪声输入输出5维噪声预测。

### 步骤3：推理时，带遮罩感知的逆向

```python
def inpaint_step(x_t, mask, clean_image, alpha_bars, t, rng):
    # 用干净源图像的新鲜噪声版本替换未遮罩的维度
    a_bar = alpha_bars[t]
    for i in range(len(x_t)):
        if not mask[i]:
            x_t[i] = math.sqrt(a_bar) * clean_image[i] + math.sqrt(1 - a_bar) * rng.gauss(0, 1)
    # ...然后对x_t执行正常的逆向步骤
```

这是朴素方法，在玩具1维数据上有效。真实的图像修补使用9通道输入，因为纹理一致性更重要。

### 步骤4：图像外扩

图像外扩（Outpainting）是将遮罩反转后的图像修补：遮罩新的（之前不存在的）画布，用原始图像填充其余部分。训练目标相同。

## 陷阱

- **接缝。** 朴素方法会留下可见边界，因为梯度信息无法跨越遮罩流动。修复：将遮罩膨胀8-16像素，或使用正确的图像修补模型。
- **遮罩泄漏。** 如果调节图像的未遮罩区域质量较低或有噪声，它会污染遮罩内部的生成。适当去噪或轻微模糊。
- **CFG与遮罩大小相互作用。** 小遮罩上的高CFG会导致饱和斑块。对小编辑降低CFG。
- **SDEdit保真度悬崖。** 从`t/T = 0.5`转到`t/T = 0.6`可能会丢失主体身份。请扫描并检查点。
- **提示词不匹配。** 提示词应描述*整个*图像，而不仅仅是新内容。“一只坐在椅子上的猫”而非“一只猫”。

## 使用它

| 任务 | 管线 |
|------|------|
| 移除物体，小遮罩 | SD-Inpaint 或 Flux-Fill，标准提示词 |
| 替换天空 | SD-Inpaint + “日落时的蓝天” |
| 扩展画布 | SDXL 外扩模式（8px羽化）或 Flux-Fill 配合外扩遮罩 |
| 重绘手部/脸部 | SD-Inpaint + 重新描述主体的提示词 + ControlNet-Openpose |
| 改变某一区域的风格 | SDEdit 在 `t/T=0.5` 时应用于遮罩区域 |
| “将其变成日落” | InstructPix2Pix 或 Flux-Kontext |
| 背景替换 | SAM 遮罩 → SD-Inpaint |
| 超高保真度 | 最难情况使用 Flux-Fill 或 GPT-Image (托管) |

SAM (Meta的Segment Anything，2023) + 扩散图像修边是2026年的背景移除管线。SAM 2 (2024) 可处理视频。

## 部署它

保存 `outputs/skill-editing-pipeline.md`。技能输入一张原始图像 + 编辑描述 + 可选遮罩（或SAM提示词），输出：遮罩生成方法、基础模型、CFG缩放（图像+文本）、SDEdit-t或图像修补模式、以及QA检查清单。

## 练习

1. **简单。** 在 `code/main.py` 中，将遮罩维度的比例从0.2变化到0.8。在什么比例下，图像修补质量（遮罩维度的残差）等于无条件生成？
2. **中等。** 实现RePaint：每隔10个逆向步骤，跳回5步（添加噪声）并重新去噪。测量其是否减少了遮罩边缘的边界残差。
3. **困难。** 使用Hugging Face diffusers比较：SD 1.5 Inpaint + ControlNet-Openpose 与 Flux.1-Fill 在20个面部重绘任务上的表现。分别对姿态遵循度和身份保留度打分。

## 关键术语

| 术语 | 人们通常说的意思 | 实际含义 |
|------|-----------------|----------|
| Inpainting | “填充空洞” | 在遮罩内部重绘；保持外部像素不变。 |
| Outpainting | “扩展画布” | 在画布外部重绘；保持内部不变。 |
| 9-channel U-Net | “正确的图像修补模型” | 输入为 `噪声 \| 编码源图像 \| 遮罩` 的U-Net。 |
| SDEdit | “带噪声级别的图生图” | 加噪到时间步 `t`，用新提示词去噪。 |
| InstructPix2Pix | “仅文本编辑” | 在（图像，指令，输出）三元组上微调的扩散模型。 |
| RePaint | “无需重新训练” | 在逆向过程中周期性地重新加噪以减少接缝。 |
| SAM | “分割一切” | 通过点击或框选生成遮罩；与图像修补配合。 |
| Flux-Kontext | “带上下文的编辑” | Flux变体，接受参考图像+指令进行编辑。 |

## 生产环境说明：编辑管线对延迟敏感

用户编辑图像时期望往返时间小于5秒。在L4上，一个30步的SDXL-Inpaint在1024²分辨率下耗时3-4秒，加上SAM遮罩生成（约200毫秒）和VAE编码/解码（合计约500毫秒）。在生产框架中，这属于TTFT受限而非吞吐受限——batch大小为1，低并发，最小化每个阶段：

- **SAM-H是慢的那个。** SAM-H在1024²下约200毫秒；SAM-ViT-B约40毫秒，质量略有损失。SAM 2（视频）增加了时间开销；请勿将其用于单图像编辑。
- **尽可能跳过编码。** `pipe.image_processor.preprocess(img)` 将图像编码为潜在表示。如果你有之前生成步骤的潜在表示（这在迭代式编辑UI中很常见），可以通过 `latents=...` 直接传递它们，从而跳过一次VAE编码。
- **遮罩膨胀也影响吞吐。** 小遮罩意味着大部分U-Net前向传播是浪费的（未遮罩像素无论如何都会被固定）。`diffusers` 的 `StableDiffusionInpaintPipeline` 无论如何都会运行完整的U-Net；只有9通道正确图像修补变体才能利用遮罩计算。
- **Flux-Kontext是2025年的答案。** 对（源图像，指令）进行单次前向传播——无需单独的遮罩，无需SDEdit噪声扫描。在H100上，它在约1.5秒内完成一次编辑。架构上的教训：合并各阶段。

## 延伸阅读

- [Lugmayr et al. (2022). RePaint: Inpainting using Denoising Diffusion Probabilistic Models](https://arxiv.org/abs/2201.09865) —— 无需训练的图像修补。
- [Meng et al. (2022). SDEdit: Guided Image Synthesis and Editing with Stochastic Differential Equations](https://arxiv.org/abs/2108.01073) —— SDEdit。
- [Brooks, Holynski, Efros (2023). InstructPix2Pix](https://arxiv.org/abs/2211.09800) —— 文本指令编辑。
- [Kirillov et al. (2023). Segment Anything](https://arxiv.org/abs/2304.02643) —— SAM，遮罩的来源。
- [Ravi et al. (2024). SAM 2: Segment Anything in Images and Videos](https://arxiv.org/abs/2408.00714) —— 视频SAM。
- [Hertz et al. (2022). Prompt-to-Prompt Image Editing with Cross-Attention Control](https://arxiv.org/abs/2208.01626) —— 注意力层面编辑。
- [Black Forest Labs (2024). Flux.1-Fill and Flux.1-Kontext](https://blackforestlabs.ai/flux-1-tools/) —— 2024年工具。