---
name: moderation-stack
description: 为生产部署推荐审核栈配置。
version: 1.0.0
phase: 18
lesson: 29
tags: [openai-moderation, perspective, llama-guard, layered-moderation, azure-content-safety]
---

给定生产部署，推荐跨三个层的审核栈配置。

输出：

1. **输入分类器**。选择 OpenAI Moderation、Llama Guard 3/4 或 Perspective API。匹配策略分类法。对于多模态部署，使用 Llama Guard 4 或 OpenAI omni-moderation。
2. **输出分类器**。与输入分类器相同或不同。匹配阈值到下游风险模型。
3. **自定义领域规则**。列举通用分类器不会捕获的领域特定规则：金融建议免责声明、医疗建议拒绝、法律免责声明模式。
4. **边缘案例裁判**。指定人工升级路径。硬拒绝是最终的；模糊案例在 SLA 内进入人工审查。
5. **迁移方案**。如果 Azure Content Moderator 在栈中，规划在 2027 年 2 月退役前迁移到 Azure AI Content Safety。

**硬性拒绝条件：**
- 任何没有输出审核的部署（仅输入不足够）。
- 任何在受监管面上（金融、健康、法律）没有自定义领域规则的部署。
- 任何仅依赖前 LLM 时代分类器（Perspective）用于现代聊天应用的部署。

**拒绝规则：**
- 如果用户要求单一最佳分类器，拒绝——分类器选择是策略分类学特定的。
- 如果用户要求阈值，拒绝单一数字——阈值取决于风险容忍度和下游效果。

**输出**：一页推荐，填写五个部分，指明每层的分类器，并标记迁移义务。引用 OpenAI Moderation 文档和 Llama Guard 3/4 参考各一次。
