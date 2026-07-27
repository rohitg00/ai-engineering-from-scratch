---
name: skill-cmer-monitor
description: 为生产级 VLM 端点配置跨模态错误率监控、仪表盘和告警
version: 1.0.0
phase: 4
lesson: 25
tags: [vlm, production, monitoring, hallucination]
---

# CMER 监控器

将跨模态对齐作为一级生产 KPI 来对待。

## 使用时机

- 部署任何生成基于图像文本的 VLM 端点。
- 调查幻觉响应的报告。
- 跟踪输入分布漂移是否会降低模型的对齐能力。

## 输入

- `vlm_output`：生成的文本。
- `text_confidence`：softmax 后的平均每个令牌概率，范围 `[0, 1]`。计算为 `exp(mean(log_probs))`。不要传递原始 logits；原始 logits 是无界的，`conf_threshold` 期望的是概率。
- `image_embedding`：图像的 CLIP 系列嵌入（DINOv3、SigLIP、CLIP）。
- `text_embedding`：生成文本的 CLIP 系列嵌入。
- 可选的 `prompt_type`：分组标签（vqa / ocr / captioning / agent）。

## 每次请求的计算

```python
import torch

def cmer_flag(image_emb, text_emb, text_conf, sim_thr=0.25, conf_thr=0.8):
    if image_emb.shape != text_emb.shape:
        raise ValueError(f"嵌入形状不匹配: {image_emb.shape} vs {text_emb.shape}")
    image_emb = image_emb / (image_emb.norm() + 1e-8)
    text_emb = text_emb / (text_emb.norm() + 1e-8)
    sim = float((image_emb * text_emb).sum())
    flagged = (text_conf > conf_thr) and (sim < sim_thr)
    return {"sim": sim, "flagged": flagged}
```

嵌入是来自独立 CLIP 系列编码器的 1-D PyTorch 张量（`torch.float32`）。如果使用 NumPy 数组，将 `.norm()` 替换为 `np.linalg.norm(...)` 并相应地转换输出。

将 `sim`、`text_conf`、`flagged`、`prompt_type`、`timestamp`、`model_version`、`request_id` 存储到你的监控流水线（Prometheus、DataDog、OpenTelemetry）。

## 聚合指标

```
CMER = (窗口内标记的请求数) / (窗口内总请求数)
```

按端点、按 prompt_type、按模型版本报告。

## 告警阈值

- 基线 CMER：在 7 天的正常流量上确定。
- 警告：CMER >= 基线 1.5 倍持续 1 小时。
- 严重：CMER >= 基线 2 倍持续 30 分钟，或任何窗口内 > 15% 的绝对值。

## 仪表盘面板

1. CMER 随时间变化（5 分钟桶，7 天窗口）。
2. 按 prompt_type 的 CMER（堆叠条形图）。
3. 每小时 `sim` 的分布（直方图）。
4. 顶级幻觉输出（每天抽样 20 个标记响应供人工审查）。

## CMER 飙升时的操作

1. 抽样标记的请求。
2. 验证模型版本没有意外更改。
3. 检查输入分布（新文件格式？新图像源？压缩方式不同？）。
4. 将受影响的流量路由到人工审查，直到峰值解决。
5. 如果峰值持续存在，微调或更换模型；不要压制告警。

## 规则

- 绝不使用 VLM 自身的嵌入来计算 CMER；使用独立的编码器（DINOv3、SigLIP 或 CLIP-L/14）。否则你测量的只是模型的自我一致性，而非对齐能力。
- 始终记录原始的 `sim` 值，而不仅仅是 `flagged` 位；分布漂移在标志率变化之前会先在下四分位数中显现。
- 没有 CMER 监控就不要发布 VLM 端点；幻觉是主导的生产失败模式，没有这个指标就会静默发生。
- 对于敏感领域（医疗、法律、金融），将 `sim_threshold` 提高到 0.35 或更高；标志条件是 `sim < sim_threshold`，因此更高的阈值会捕获更多可能无依据的输出——这是高风险用途的正确默认值。
