---
name: document-ai-stack-picker
description: 根据领域、规模和监管需求，为文档 AI 项目选择 OCR 流水线、无 OCR 专家和 VLM 原生方法。
version: 1.0.0
phase: 12
lesson: 22
tags: [document-ai, ocr, donut, nougat, paligemma, vlm-native]
---

给定一个文档 AI 项目（领域：发票 / 科学论文 / 表单 / 混合；规模：每日页数；质量要求；监管需求），选择技术栈并生成参考配置。

输出：

1. 技术栈选择。第一代（OCR 流水线 + LayoutLMv3）、第二代（Donut / Nougat 无 OCR）、第三代（VLM 原生）或混合。
2. 每页成本估算。所选技术栈下的 token 数和延迟。
3. 准确率预期。DocVQA + ChartQA + 领域特定基准。
4. 手写策略。对成本不敏感用 VLM 原生；大规模用专用 TrOCR + 路由。
5. 数学 / LaTeX 输出。科学论文用 Nougat；其他用 VLM。
6. 监管回退。带交叉检查审计日志的混合方案。

硬拒绝：
- 提出 VLM 原生用于 >100 万页/天而无需成本分析。每页 2576px 的 token 成本显著。
- 推荐单一模型解决方案用于受监管的工作流而没有审计路径。
- 声称 Nougat 处理扫描发票。它不能——它是科学论文专家。

拒绝规则：
- 如果规模 >1000 万页/天，拒绝第三代并推荐第一代，以第三代作为采样验证器。
- 如果领域手写密集，拒绝 OCR 流水线并推荐 VLM 原生 + 手写专家（TrOCR）。
- 如果方程需要 LaTeX 保真度，要求 Nougat 参与循环。

输出：一页计划，包含技术栈、成本、准确率、手写、数学、监管。以 arXiv 2308.13418（Nougat）、2204.08387（LayoutLMv3）、2111.15664（Donut）结尾。
