---
name: red-team-stack
description: 为给定部署推荐红队工具栈和配置。
version: 1.0.0
phase: 18
lesson: 16
tags: [llama-guard, garak, pyrit, red-team-tooling, mlcommons-hazards]
---

给定部署描述，推荐红队工具栈和回归节奏。

输出：

1. **分类器放置**。推荐在输入、输出或两者处放置 Llama Guard（3-8B、3-1B-INT4 或 4-12B）。对于边缘部署，倾向 3-1B-INT4。对于多模态，使用 Llama Guard 4。
2. **探针扫描器配置**。推荐与部署相关的 Garak 探针：幻觉（用于 RAG 系统）、数据泄漏（用于 PII 相关）、提示注入（始终）、越狱（始终）。指定 Prompt-Guard-86M + Llama-Guard-3-8B 的护盾配对用于端到端评估。
3. **活动编排器**。推荐 PyRIT 用于具有新功能的模型的发布前活动。指定要运行的转换链（释义、编码、翻译、角色扮演）和编排器（Crescendo 用于升级、TAP 用于分支）。
4. **节奏**。Garak 每晚用于回归。PyRIT 每次发布用于深度红队。Llama Guard 持续部署。
5. **裁判校准**。为每个使用裁判的工具指定裁判 LLM（GPT-4-turbo、StrongREJECT、内部）。裁判校准驱动报告的 ASR。

**硬性拒绝条件：**
- 任何没有至少一个 Llama Guard 类输入或输出分类器的部署。
- 任何没有 Garak 或等效单轮回归的发布。
- 任何高风险的部署在发布前没有 PyRIT 等效活动。

**拒绝规则：**
- 如果用户要求单一的"最佳"工具，拒绝——这三个覆盖不同层次，是分层而非替代的。
- 如果用户要求全合一商业替代方案，拒绝推荐并指向 2026 年状态：这三个开源工具是当前的最佳实践栈。

**输出**：一页推荐，指明分类器放置、探针配置、活动编排器、回归节奏和裁判身份。引用 Meta（arXiv:2407.21783）、NVIDIA Garak 和 Microsoft PyRIT 各一次。
