---
name: inference-platform-picker
description: 根据工作负载、SLA、预算和运营约束选择推理平台（Fireworks、Together、Baseten、Modal、Replicate、Anyscale 或定制芯片）。统一每 token、每分钟和每次预测的定价。
version: 1.0.0
phase: 17
lesson: 02
tags: [inference, fireworks, together, baseten, modal, replicate, anyscale, economics]
---

给定工作负载配置文件（模型、每日 token 量、持续利用率、TTFT SLA、突发因子、合规性、Python 与混合技术栈），生成平台推荐。

生成：

1. 主平台。命名平台及具体定价层级（serverless 与 dedicated 与 batch）。用匹配的工作负载特征证明其合理性——例如，“选择 Fireworks serverless，因为 TTFT < 500 ms 是 SLA 且流量具有突发性。”
2. 有效成本。将所选定价模型统一为 $/M 输出 token。与至少两个替代方案进行比较。指出每分钟计费何时优于每 token 计费（高于约 30% 的持续利用率）或反之。
3. 冷启动计划。对于 serverless 选择（Fireworks、Modal、Replicate），说明预期冷启动延迟和缓解措施（预热、min_workers=1、实时迁移）。对于 dedicated 选择（Baseten、Anyscale），跳过此部分但注明权衡。
4. 备选方案。命名第二平台及切换的明确条件（例如，“如果我们签订需要 HIPAA + 专用 GPU 的企业协议，则迁移到 Baseten”）。
5. 网关层。建议是否在平台前部署 AI 网关（LiteLLM、Portkey、Kong AI Gateway）以将产品与提供商变动隔离。默认：是，除非规模低于 500 RPS。

硬性拒绝：
- 未统一就对比每 token 与每分钟计费。拒绝并坚持有效的 $/M token。
- 因“最快”而选择 Fireworks，但未针对已发布基准验证 TTFT SLA。
- 为任何非延迟敏感型工作负载推荐定制芯片（Groq、Cerebras、SambaNova）。它们定价溢价，仅在交互式 SLA 下才合理。

拒绝规则：
- 如果工作负载需要受监管框架（SOC 2 Type II、HIPAA）且客户选择了 Modal 或 Replicate，拒绝——二者的企业足迹均不及 Baseten 或 Anyscale。建议 Baseten。
- 如果预期流量低于 100k token/天，拒绝推荐按分钟计费（Baseten、Modal、Anyscale）。经济学上不划算——默认选择市场平台（OpenRouter、DeepInfra）或托管超大规模云。
- 如果客户想要“最便宜的”，拒绝——命名多维成本函数（token 费率 + 冷启动 + 归因 + 网关 + DX）。

输出：一页推荐，命名主平台、有效成本、冷启动计划、备选方案、网关态势。以将揭示选择错误的单一指标结束（冷启动 P99、每 token 费率或利用率漂移）。
