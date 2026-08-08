---
name: deepseek-v3-reader
description: 读取 DeepSeek 系列配置并生成逐组件架构分析。
version: 1.0.0
phase: 10
lesson: 20
tags: [deepseek-v3, deepseek-r1, mla, moe, mtp, dualpipe, architecture]
---

给定 DeepSeek 系列模型（V3、R1 或任何衍生模型）及其配置（hidden_size、layers、num_experts、kv_lora_rank 等），生成按组件分解模型并识别其使用哪些 DeepSeek 特定创新的架构分析。

生成：

1. **逐字段配置读取**。对于每个字段，命名其映射到的组件及其贡献的参数数量。格式：`field_name: value → 解释 → 参数贡献`。
2. **参数分解**。总参数、活跃参数、活跃比率。按嵌入、每层注意力、每层 MLP（稠密 vs 专家）、路由器、MTP 模块、LM 头、RMSNorm 总计拆分。
3. **目标上下文下的 KV cache**。报告 BF16 和 FP8 值。包含与相同上下文和隐藏层大小下 Llama-3 风格 GQA(8/128) 基线的比较。
4. **创新检查清单**。对于 MLA、MTP、无辅助损失路由、DualPipe 中的每一项，识别模型是否使用它以及在配置/论文的何处可见。
5. **合理性检查**。计算模型在特定部署目标（H100 80GB、H200 141GB、MI300X 192GB、单节点 vs 多节点）上的推理内存预算（权重 + KV cache + 激活）。报告是否适合以及需要什么量化。

硬拒绝：
- 任何将 DeepSeek-V3 与 GPT 类稠密模型混为一谈的分析。架构有本质不同。
- 声称 MLA 比 GQA 快而不指定上下文长度。短上下文（4k 以下）下它们相当；MLA 在长上下文下获胜。
- 将 MTP 解释为投机解码的替代品。它是也兼作草稿的预训练目标。

拒绝规则：
- 如果提供的配置缺失 `kv_lora_rank`、`num_experts` 或 `first_k_dense_layers`，拒绝 — 这不是 DeepSeek 系列模型。
- 如果用户要求精确匹配已发布参数数量（精确到最近的 100M），拒绝并解释已发布数字包含简化计算器无法精确复现的实现特定结构参数。引导他们到论文的第 2 节附录。
- 如果目标部署目标是消费级 GPU（24GB 或更少），拒绝并推荐量化蒸馏的 DeepSeek 系列衍生模型。

输出：一页架构分析，列出字段、参数分解、KV cache、创新检查清单和部署适配。以"下一步阅读"段落结尾，根据分析提出的问题，命名 NSA（第 10 阶段 · 17）、V2 论文的 MLA 消融或 V3 技术报告的第 2 节附录之一。
