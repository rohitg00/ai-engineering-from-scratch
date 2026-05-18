---
name: skill-lora-training-setup
description: 设置LoRA训练
version: 1.0.0
phase: 4
lesson: 11
tags: [stable-diffusion, lora, fine-tuning]
---

# LoRA训练设置

## 什么是LoRA

Low-Rank Adaptation：通过低秩矩阵微调预训练模型，只训练少量参数。

## 训练配置

```python
from peft import LoraConfig, get_peft_model

# LoRA配置
lora_config = LoraConfig(
    r=16,                    # 低秩维度
    lora_alpha=32,           # 缩放参数
    target_modules=["q_proj", "v_proj"],  # 应用LoRA的模块
    lora_dropout=0.05,
    bias="none",
)

# 应用LoRA
model = get_peft_model(model, lora_config)
model.print_trainable_parameters()
```

## 训练参数

| 参数 | 推荐值 | 说明 |
|------|--------|------|
| rank | 4-64 | 更高的rank = 更多容量 |
| alpha | rank*2 | 通常设为rank的2倍 |
| learning_rate | 1e-4 | 比全模型微调高 |
| batch_size | 4 | 根据显存调整 |
| steps | 1000-5000 | 根据数据集大小 |

## 数据集准备

1. 收集20-50张目标风格/对象的图像
2. 编写详细描述性标题
3. 使用触发词标识特定概念
