---
name: inference-platform-picker
description: 根据工作负载、SLA、预算和运营约束，选择推理平台（Fireworks、Together、Baseten、Modal、Replicate、Anyscale 或定制芯片）。标准化每 Token、每分钟和每次预测的定价。
version: 1.0.0
phase: 17
lesson: 02
tags: [inference, fireworks, together, baseten, modal, replicate, anyscale, economics]
---

给定工作负载概况（模型、每日 Token 数、持续利用率、TTFT SLA、突发系数、合规要求、Python 与混合栈），生成平台推荐。

输出：

1. **主平台**。指明平台及其具体定价层级（无服务器 vs 专用 vs 批处理）。用匹配的工作负载特性论证——例如，"选择 Fireworks 无服务器，因为 TTFT < 500 ms 是 SLA 且流量是突发性的。"
2. **有效成本**。将所选定价模型标准化为 $/M 输出 Token。与至少两个替代方案对比。指出每分钟计费何时优于每 Token 计费（约 >30% 持续利用率时）或反之。
3. **冷启动方案**。对于无服务器方案（Fireworks、Modal、Replicate），说明预期的冷启动延迟及缓解措施（预热、min_workers=1、实时迁移）。对于专用方案（Baseten、Anyscale），跳过此部分但说明权衡。
4. **备选方案**。指明第二平台及切换的确切条件（例如，"如果我们签订需要 HIPAA + 专用 GPU 的企业合同，则迁移到 Baseten"）。
5. **网关层**。建议是否在平台前添加 AI 网关（LiteLLM、Portkey、Kong AI Gateway）以隔离产品与提供商变更。默认：是，除非规模低于 500 RPS。

**硬性拒绝条件：**
- 在未标准化的情况下比较每 Token 与每分钟价格。拒绝并要求提供有效 $/M Token。
- 仅因 Fireworks"最快"就选择它，而未对照已发布基准验证 TTFT SLA。
- 为任何非延迟敏感的工作负载推荐定制芯片（Groq、Cerebras、SambaNova）。它们定价溢价，仅在交互式 SLA 上具备合理性。

**拒绝规则：**
- 如果工作负载需要受监管框架（SOC 2 Type II、HIPAA）而客户选择了 Modal 或 Replicate，拒绝——两者均没有 Baseten 或 Anyscale 的企业足迹。建议 Baseten。
- 如果预期流量低于 100k Token/天，拒绝推荐按分钟计费方案（Baseten、Modal、Anyscale）。经济性不成立——默认选择市场（OpenRouter、DeepInfra）或托管超大规模提供商。
- 如果客户想要"最便宜的"，拒绝——指明多维成本函数（Token 费率 + 冷启动 + 归属 + 网关 + 开发者体验）。

**输出**：一页推荐文档，指明主平台、有效成本、冷启动方案、备选方案和网关策略。最后指出将揭示错误选择的单一指标（冷启动 P99、每 Token 费率或利用率漂移）。
