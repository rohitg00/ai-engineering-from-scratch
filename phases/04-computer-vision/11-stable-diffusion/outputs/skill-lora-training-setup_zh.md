---
name: skill-lora-training-setup
description: 为自定义数据集编写完整的 LoRA 训练配置，包括描述文本、秩、批量大小和学习率
version: 1.0.0
phase: 4
lesson: 11
tags: [computer-vision, stable-diffusion, lora, fine-tuning]
---

# LoRA 训练设置

将微调意图的描述转化为可直接传递给 `diffusers` 或 `kohya_ss` 的具体训练配置。

## 使用时机

- 为主题（人物、物体、角色）、风格（艺术家、品牌）或概念（姿态、光照）训练 LoRA。
- 用更多数据扩展已有的 LoRA。
- 调试在训练图像上欠拟合或过拟合的 LoRA 运行。

## 输入

- `purpose`：subject（主题） | style（风格） | concept（概念）
- `num_images`：可用的训练图像数量
- `base_model`：SD 1.5 | SDXL | SD3 | FLUX
- `gpu_vram_gb`：8 | 12 | 16 | 24 | 48+
- `caption_source`：manual（手动） | BLIP2-generated（生成） | dataset-native（数据集自带）

## 秩选择器

| 用途 | 秩 | Alpha |
|---------|------|-------|
| Subject（主题） | 8-16 | rank |
| Style（风格） | 16-32 | rank * 2 |
| Concept（概念） | 32-64 | rank |

更高的秩 = 更大的容量，在小数据集上过拟合风险更高。Alpha 缩放 LoRA 的效果强度；`alpha == rank` 是安全的默认值。风格是文档中的例外：`alpha == rank * 2` 提供更强的风格推动，但代价是风格过于强烈的风险——仅在主题保真度不是目标时使用。

## 训练步数目标

- `subject`，5-20 张图像：500-1500 步。
- `style`，30-100 张图像：1500-4000 步。
- `concept`，100+ 张图像：4000-10000 步。

过度训练有风险——记住了训练图像的 LoRA 无法泛化。

## 学习率

- 文本编码器 LoRA：SD 1.5 为 `1e-4`，SDXL 为 `5e-5`。
- U-Net LoRA：SD 1.5 为 `1e-4`，SDXL 为 `1e-4`。
- FLUX / SD3：Transformer 为 `5e-5`，文本编码器通常冻结。
- 当 `num_images < 15`（主题）或训练超过 3000 步时，将学习率减半；小数据集和长训练周期都能从更温和的更新中获益。

## 调度器

- `cosine_with_warmup`（默认）：前 5-10% 的步数进行预热，然后余弦衰减。当 `steps >= 1000` 时使用；衰减尾部提供更清晰的结果样本。
- `constant`：仅在非常短的运行（`steps < 500`）或恢复之前的 LoRA 时使用，以保留当前学习的特征而无需重新退火。

## 描述文本格式

- Subject（主题）：在每个描述文本前添加唯一的触发词（如 "myperson"）。保持触发词罕见，以免覆盖已有概念。避免使用真实词汇和常见名称。
- Style（风格）：在每个描述文本末尾添加唯一的风格标签（如 "...in mystyle style"）。将标签本身视为罕见的触发词——使用 `mystyle` 而非 `impressionism`，后者已映射到真实概念。
- Concept（概念）：在每个描述文本中描述该概念；无需触发词。概念本身（如 "low-angle shot" 低角度拍摄）就是锚点。

## 输出配置

```yaml
model:
  base: <基础模型的 HuggingFace ID>
  precision: fp16 | bf16

lora:
  rank: <整数>
  alpha: <整数>
  targets: unet.cross_attention  # 和/或 unet.to_q, to_k, to_v, to_out

training:
  steps:          <整数>
  batch_size:     <整数，根据 gpu_vram_gb 调整>
  grad_accum:     <整数，>=16 GB 通常为 1，<=12 GB 通常为 4>
  learning_rate:  <浮点数>
  optimizer:      AdamW8bit | AdamW
  scheduler:      cosine_with_warmup | constant
  warmup_steps:   <整数>
  save_every:     <整数>

data:
  images_dir:     <路径>
  caption_source: <manual | BLIP2 | native>
  trigger_token:  <如果 purpose==subject 则为字符串>
  resolution:     <SD 1.5 为 512，SDXL 为 1024>
  aspect_ratio_bucketing: true
  augmentation:
    flip:          true
    color_jitter:  false

validation:
  prompts:
    - "<trigger> ...测试提示词..."
    - "<trigger> 在不同场景中"
  every_steps: 250
```

## 报告

```
[lora setup]
  purpose:   <subject|style|concept>
  base:      <model>
  rank:      <整数>
  steps:     <整数>
  batch:     <整数>   grad_accum: <整数>
  lr:        <浮点数>
  vram est.: <浮点数> GB
```

## 规则

- 绝不推荐 `rank > 64`；超过此值后 LoRA 变成微型微调，失去其"适配器"性质。
- 对于 `num_images < 5`，强烈警告——1-3 张图像的身份 LoRA 每次都会过拟合。
- 对于 `gpu_vram_gb < 12`，要求使用 AdamW8bit 和梯度检查点。
- 如果 `base_model == FLUX` 且 `gpu_vram_gb < 24`，路由到 `schnell` 变体并说明训练速度较慢。
- 绝不跳过验证提示词；没有样本网格的 LoRA 无法评估。
