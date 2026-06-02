# Inpainting、Outpainting 与图像编辑

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 文生图（text-to-image）造新东西，inpainting（局部重绘）修旧东西。在生产环境里，70% 能开发票的图像活儿都是编辑——换个背景、抹掉一个 logo、扩展画布、重画一只手。Inpainting 才是 diffusion 真正赚钱的地方。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 8 · 07 (Latent Diffusion), Phase 8 · 08 (ControlNet & LoRA)
**Time:** ~75 minutes

## 问题（Problem）

客户发来一张完美的产品照片，背景里有一块碍眼的招牌。你想把招牌抹掉，其它像素一个不差地保留。你不能从零跑一次文生图——结果颜色会变、光线会变、产品角度也会变。你想要*只*重新生成被 mask（遮罩）住的区域，并且让重生成的部分尊重周围的上下文。

这就是 inpainting。它有几种变体：

- **Inpainting（局部重绘）。** 在 mask 内部重新生成，保留外部像素。
- **Outpainting（向外扩绘）。** 在 mask 外部（或画布之外）重新生成，保留内部。
- **图像编辑（Image editing）。** 重新生成整张图，但保持与原图在语义或结构上的一致（SDEdit、InstructPix2Pix）。

2026 年每个 diffusion pipeline 都自带 inpainting 模式。Flux.1-Fill、Stable Diffusion Inpaint、SDXL-Inpaint、DALL-E 3 Edit。它们的原理都是同一个。

## 概念（Concept）

![Inpainting：mask 感知的去噪 + 上下文保留的重新注入](../assets/inpainting.svg)

### 朴素做法（以及它为什么不对）

带一张 mask 跑标准的文生图。在每个采样步，把噪声 latent 中未被 mask 的区域替换成原图前向扩散后的版本。它能跑……但效果很差。边界处会有伪影渗出，因为模型对 mask 区域里到底有什么一无所知。

### 正经的 inpainting 模型

训练一个改造过的 U-Net，把输入通道从 4 个扩到 9 个：

```
input = concat([ noisy_latent (4ch), encoded_image (4ch), mask (1ch) ], dim=channel)
```

多出来的通道是 VAE 编码后的源图像副本，加上一个单通道 mask。训练时随机 mask 掉图像里的若干区域，让模型只对被 mask 的区域做去噪，未被 mask 的部分作为干净的条件信号给进去。推理时，模型就能"看到" mask 周围有什么，并产出连贯的补全。

SD-Inpaint、SDXL-Inpaint、Flux-Fill 用的都是这种 9 通道（或类似）输入。Diffusers 里对应 `StableDiffusionInpaintPipeline`、`FluxFillPipeline`。

### SDEdit（Meng et al., 2022）——免训练的编辑

把源图加噪到某个中间步 `t`，然后用一个新的 prompt 从 `t` 反向跑回 0。无需重训。起点 `t` 的选择是在保真度和创作自由度之间权衡：

- `t/T = 0.3` → 几乎和原图一致，仅做小幅风格化
- `t/T = 0.6` → 中等程度的编辑，保留粗结构
- `t/T = 0.9` → 几乎从纯噪声生成，原图信息所剩无几

### InstructPix2Pix（Brooks et al., 2023）

在 `(input_image, instruction, output_image)` 三元组上 fine-tune 一个 diffusion 模型。推理时同时以输入图和文本指令作为条件（"make it sunset"、"add a dragon"）。两路 CFG 缩放：图像 scale 和文本 scale。

### RePaint（Lugmayr et al., 2022）

保留一个标准的无条件 diffusion 模型。在每个反向步里 resample——偶尔回跳到更噪的状态再重新生成。这样能避开边界伪影。当你手头没有训好的 inpainting 模型时可以用它。

## 动手实现（Build It）

`code/main.py` 在 5 维数据上实现了一个玩具版的一维 inpainting 方案。我们在 5-D 混合数据上训练 DDPM，每个样本是从两个簇中之一采样得到的 5 个浮点数。推理时，我们对 5 个维度里的 2 个做"mask"，每一步都把未 mask 的三个维度替换成噪声前向版本，只对被 mask 的维度重新生成。

### Step 1: 5-D DDPM 数据

```python
def sample_data(rng):
    cluster = rng.choice([0, 1])
    center = [-1.0] * 5 if cluster == 0 else [1.0] * 5
    return [c + rng.gauss(0, 0.2) for c in center], cluster
```

### Step 2: 在全部 5 维上训练去噪器

标准 DDPM。网络对 5-D 的噪声输入输出 5-D 的噪声预测。

### Step 3: 推理时做 mask 感知的反向

```python
def inpaint_step(x_t, mask, clean_image, alpha_bars, t, rng):
    # replace unmasked dims with a freshly noised version of the clean source
    a_bar = alpha_bars[t]
    for i in range(len(x_t)):
        if not mask[i]:
            x_t[i] = math.sqrt(a_bar) * clean_image[i] + math.sqrt(1 - a_bar) * rng.gauss(0, 1)
    # ...then run the normal reverse step on x_t
```

这就是朴素做法，在玩具 1-D 数据上够用。真正的图像 inpainting 会用 9 通道输入，因为纹理连贯性更重要。

### Step 4: outpainting

Outpainting 就是 mask 反过来的 inpainting：mask 掉新画布（之前不存在的区域），其余部分用原图填。训练目标完全相同。

## 易踩的坑（Pitfalls）

- **接缝。** 朴素做法会留下肉眼可见的边界，因为梯度信息无法跨过 mask 流通。修法：把 mask 膨胀（dilate）8-16 像素，或者改用正经的 inpainting 模型。
- **Mask 渗漏。** 如果作为条件的图像在 mask 外的区域质量低或者带噪，那它会污染 mask 内部的生成。可以稍微去噪或者轻微模糊一下。
- **CFG 与 mask 大小耦合。** 小 mask + 高 CFG = 过饱和的小补丁。小幅编辑要降低 CFG。
- **SDEdit 的保真度悬崖。** 从 `t/T = 0.5` 到 `t/T = 0.6` 可能会让主体失去身份。要做扫描并保存 checkpoint。
- **Prompt 不匹配。** Prompt 应该描述*整张*图，而不是只描述新内容。要写 "A cat sitting on a chair" 而不是 "a cat"。

## 用起来（Use It）

| 任务 | Pipeline |
|------|----------|
| 移除物体、小 mask | SD-Inpaint 或 Flux-Fill，普通 prompt |
| 替换天空 | SD-Inpaint + "blue sky at sunset" |
| 扩展画布 | SDXL outpaint 模式（8px 羽化）或 Flux-Fill 配 outpaint mask |
| 重画手 / 脸 | SD-Inpaint + 重新描述主体的 prompt + ControlNet-Openpose |
| 改某个区域的风格 | 在被 mask 的区域上 `t/T=0.5` 跑 SDEdit |
| "Make it sunset" | InstructPix2Pix 或 Flux-Kontext |
| 替换背景 | SAM 出 mask → SD-Inpaint |
| 极致高保真 | Flux-Fill 或 GPT-Image（托管）应付最难的情况 |

SAM（Meta 的 Segment Anything，2023）+ diffusion inpaint 是 2026 年通行的抠背景 pipeline。SAM 2（2024）支持视频。

## 上线部署（Ship It）

保存 `outputs/skill-editing-pipeline.md`。这个 skill 接收一张原图 + 编辑描述 + 可选 mask（或 SAM prompt），输出：mask 生成方案、基础模型、CFG scale（图像 + 文本两路）、SDEdit-t 或 inpainting 模式，以及 QA checklist。

## 练习（Exercises）

1. **Easy.** 在 `code/main.py` 里，把被 mask 的维度比例从 0.2 扫到 0.8。在哪个比例上 inpaint 的质量（被 mask 维度上的残差）退化到等于无条件生成？
2. **Medium.** 实现 RePaint：每隔 10 个反向步，回跳 5 步（加噪）后重新去噪。测一下它能否降低 mask 边缘处的边界残差。
3. **Hard.** 用 Hugging Face diffusers 对比：SD 1.5 Inpaint + ControlNet-Openpose 与 Flux.1-Fill 在 20 个换脸任务上的表现。分别打分姿态贴合度和身份保持度。

## 关键术语（Key Terms）

| Term | 大家嘴里怎么说 | 实际是什么 |
|------|-----------------|-----------------------|
| Inpainting | "把洞填上" | 在 mask 内部重新生成；保留外部像素。 |
| Outpainting | "扩展画布" | 在画布之外重新生成；保留内部。 |
| 9-channel U-Net | "正经 inpainting 模型" | 输入是 `noisy \| encoded-source \| mask` 的 U-Net。 |
| SDEdit | "带噪声等级的 img2img" | 加噪到时间 `t`，再用新 prompt 去噪。 |
| InstructPix2Pix | "纯文本指令编辑" | 在 (image, instruction, output) 三元组上 fine-tune 的 diffusion。 |
| RePaint | "免重训" | 反向过程中周期性重新加噪以减少接缝。 |
| SAM | "Segment Anything" | 通过点击或框选生成 mask 的模型；和 inpaint 配套。 |
| Flux-Kontext | "带上下文的编辑" | Flux 的一个变体，接收一张参考图 + 指令做编辑。 |

## 生产笔记：编辑 pipeline 对延迟敏感

用户在编辑图像时期望端到端不超过 5 秒。30 步 SDXL-Inpaint 在 1024² 分辨率上 L4 卡跑 3-4 秒，再加上 SAM mask 生成（~200 ms）以及 VAE 编/解码（合计 ~500 ms）。从生产视角看，这是 TTFT 受限的负载，而不是吞吐受限——batch 1、低并发，每一阶段都得抠：

- **SAM-H 是慢环节。** SAM-H 在 1024² 约 200 ms；SAM-ViT-B 约 40 ms，质量略掉一点。SAM 2（视频版）多了时序开销，单张图编辑别用它。
- **能省的 encode 就省。** `pipe.image_processor.preprocess(img)` 会把图编到 latent。如果 latent 已经在前一次生成时拿到了（迭代式编辑 UI 里很常见），直接 `latents=...` 传进去，能省一次 VAE encode。
- **Mask 膨胀同样关乎吞吐。** Mask 太小意味着 U-Net 大半个前向是浪费的（未 mask 的像素反正会被夹回去）。`diffusers` 的 `StableDiffusionInpaintPipeline` 不管 mask 多小都跑完整 U-Net；只有 9 通道的正经 inpaint 变体才能利用 masked compute。
- **Flux-Kontext 是 2025 年的答案。** 一次前向就吃下 `(source_image, instruction)`——没有单独的 mask、不用扫 SDEdit 噪声。H100 上 ~1.5 s 就能出一次编辑。架构层面的教训是：把多阶段折叠掉。

## 延伸阅读（Further Reading）

- [Lugmayr et al. (2022). RePaint: Inpainting using Denoising Diffusion Probabilistic Models](https://arxiv.org/abs/2201.09865) —— 免训练 inpainting。
- [Meng et al. (2022). SDEdit: Guided Image Synthesis and Editing with Stochastic Differential Equations](https://arxiv.org/abs/2108.01073) —— SDEdit。
- [Brooks, Holynski, Efros (2023). InstructPix2Pix](https://arxiv.org/abs/2211.09800) —— 文本指令编辑。
- [Kirillov et al. (2023). Segment Anything](https://arxiv.org/abs/2304.02643) —— SAM，mask 的来源。
- [Ravi et al. (2024). SAM 2: Segment Anything in Images and Videos](https://arxiv.org/abs/2408.00714) —— 视频版 SAM。
- [Hertz et al. (2022). Prompt-to-Prompt Image Editing with Cross-Attention Control](https://arxiv.org/abs/2208.01626) —— attention 层级的编辑。
- [Black Forest Labs (2024). Flux.1-Fill and Flux.1-Kontext](https://blackforestlabs.ai/flux-1-tools/) —— 2024 年的工具栈。
