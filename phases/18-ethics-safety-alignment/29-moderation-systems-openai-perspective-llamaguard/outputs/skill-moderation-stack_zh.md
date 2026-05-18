---
name: moderation-stack
description: 为生产部署推荐审核栈配置。
version: 1.0.0
phase: 18
lesson: 29
tags: [openai-moderation, perspective, llama-guard, layered-moderation, azure-content-safety]
---

给定生产部署，推荐跨三层的审核栈配置。

产出：

1. 输入分类器。选择OpenAI Moderation、Llama Guard 3/4或Perspective API。匹配策略分类法。对于多模态部署，选择Llama Guard 4或OpenAI omni-moderation。
2. 输出分类器。与输入分类器相同或不同。将阈值匹配到下游风险模型。
3. 自定义域规则。枚举通用分类器无法捕获的域特定规则：财务建议免责声明、医疗建议拒绝、法律免责声明模式。
4. 边缘案例评判。指定人工升级路径。硬性拒绝是最终的；模糊案例在SLA内送人工审核。
5. 迁移计划。如果Azure Content Moderator在栈中，规划在2027年2月退役前迁移到Azure AI Content Safety。

硬性拒绝：
- 任何没有输出审核的部署（仅输入不足够）。
- 任何在受监管表面（金融、健康、法律）没有自定义域规则的部署。
- 任何仅依赖预LLM时代分类器（Perspective）用于现代聊天应用的部署。

拒绝规则：
- 如果用户要求单一最佳分类器，拒绝 — 分类器选择取决于策略分类法。
- 如果用户要求阈值，拒绝单一数字 — 阈值取决于风险容忍度和下游影响。

输出：一页推荐，填充五个部分，命名每层的分类器，并标注迁移义务。各引用一次OpenAI Moderation文档和Llama Guard 3/4参考。
