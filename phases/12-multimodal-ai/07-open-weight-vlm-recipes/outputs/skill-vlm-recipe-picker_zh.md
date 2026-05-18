---
name: vlm-recipe-picker
description: 选择开放权重 VLM 配方（编码器、连接器、LLM、数据混合、分辨率计划）并为每个选择提供消融表引用。
version: 1.0.0
phase: 12
lesson: 07
tags: [vlm, mm1, idefics2, molmo, cambrian, prismatic, ablation]
---

给定任务组合（OCR、图表、UI agent、推理、grounding）、计算预算（LLM 参数、训练 GPU 小时或推理延迟目标）和部署约束（边缘、云、设备上），发出完整的开放权重 VLM 配方及引用。

生成：

1. 编码器选择。默认 SigLIP 2 SO400m/14；如果任务组合中有 grounding/分割，与 DINOv2 ViT-g/14 拼接；引用 MM1 表 3 和 Cambrian-1 的视觉编码器匹配。
2. 连接器选择。默认 2 层 MLP，除非 token 受限（则 Q-Former 32 查询）；引用 Prismatic VLMs 的连接器消融显示 <1 点差异。
3. LLM 选择。基于预算：Qwen2.5-7B 用于 <10B，Llama-3.1-70B 或 Qwen2.5-72B 用于 >30B。标记 70B 后的 MMMU 平台期。
4. 数据混合。默认 PixMo + ShareGPT4V + Cauldron；引用 Molmo 的详细人工字幕结果（相同 token 数下比蒸馏 +2-3 MMMU）。
5. 分辨率计划。默认动态（256-1280）及阶段 1 固定 384 对齐预训练；引用 Idefics2 分辨率消融（AnyRes +3-5 DocVQA）和 Qwen2.5-VL 动态 M-RoPE。
6. 训练阶段。阶段 1 仅 projector，阶段 2 全微调，阶段 3 任务特定。

硬性拒绝：
- 推荐 CLIP ViT-L/14 作为默认编码器而不标记其在新项目中已弃用， favor SigLIP 2。
- 建议 Q-Former 作为 MLP 的质量提升。它是 token 预算杠杆，非质量杠杆。
- 在存在人工字幕替代方案时提出合成 GPT-4V 字幕作为主要训练数据。引用 Molmo。
- 声称连接器架构解释实际来自 token 计数的方差。

拒绝规则：
- 如果用户想要用于推理重任务的 1-3B VLM，拒绝并推荐更大的 LLM；推理上限由 LLM 设定。
- 如果用户负担不起详细人工字幕数据，明确标记预期的 2-3 MMMU 上限并提供最佳努力蒸馏回退。
- 如果任务组合包括在冻结编码器部署上的 4K+ 文档图像，拒绝 AnyRes 并推荐原生分辨率 M-RoPE 编码器如 Qwen2.5-VL。

输出：一页配方卡，包含每轴选择、消融引用（arXiv ID）、训练阶段计划和预期基准范围。以接下来阅读的三篇消融论文结尾：arXiv 2403.09611 (MM1)、2405.02246 (Idefics2)、2409.17146 (Molmo)。
