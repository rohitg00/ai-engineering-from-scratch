---
name: managed-platform-picker
description: 根据工作负载、SLA 和合规要求选择托管 LLM 平台（Bedrock、Azure OpenAI、Vertex AI）及冗余备用平台，然后制定 FinOps 插桩计划。
version: 1.0.0
phase: 17
lesson: 01
tags: [bedrock, azure-openai, vertex-ai, ptu, finops, managed-platforms]
---

给定工作负载配置文件（所需模型、月度 token 量、TTFT SLA 的 P50/P99、合规约束、现有云足迹），生成平台推荐。

生成：

1. 主平台。命名平台、其覆盖的具体模型，以及根据利用率判断按需（on-demand）还是预置吞吐量单元（PTU）/预置吞吐量（Provisioned Throughput）更合适。引用盈亏平衡数学（PTU 在大约 40-60% 的持续利用率下划算）。
2. 备用平台。命名最低双提供商回退方案。证明配对的合理性——冗余必须覆盖模型重叠（Bedrock 上的 Claude + Azure OpenAI 上的 GPT 是常见组合）和区域重叠。
3. FinOps 插桩。指定第一天要启用的内容：Bedrock 应用推理配置文件（Application Inference Profiles）、Azure 范围 + 作为成本对象的 PTU 预留、Vertex 按项目计费 + BigQuery 计费导出。命名归因维度——按用户、按任务、按租户。
4. SLA 检查。将目标 TTFT P99 与已发布基准进行比较（Azure OpenAI PTU ≈ 50 ms P50；Bedrock 按需 ≈ 75 ms P50）。如果 SLA 严于按需所能提供的，则要求 PTU。
5. 合规检查。根据需要验证 BAA、SOC 2 Type II、HIPAA、欧盟数据驻留。注意，三者均满足基线要求，但保留策略和滥用监控退出选项有所不同。
6. 迁移路径。命名团队本周可以采取的一个可逆步骤（例如，通过抽象提供商的 AI 网关部署；插桩归因头）和一个长期步骤（PTU 承诺；跨区域故障转移）。

硬性拒绝：
- 推荐没有命名备用方案的单一平台。拒绝并坚持最低双提供商。
- 在没有利用率估算的情况下选择 PTU。拒绝并要求提供持续利用率数据。
- 在归因被列为需求时忽略 Bedrock 应用推理配置文件——它们是最简洁的原生接口。

拒绝规则：
- 如果工作负载需要 Claude、Gemini 和 GPT 全部作为 P0，命名三平台现实（Bedrock + Vertex + Azure OpenAI 位于网关之后），而不是假装一个平台可以服务所有三个。
- 如果 SLA 是 TTFT P99 < 100 ms 且预期预算无法支持 PTU，拒绝承诺该 SLA——解释按需差异上限。
- 如果客户要求“使用最便宜的提供商”，拒绝——价格是多维的（token 费率 + 专用容量 + 归因开销 + 锁定成本）。

输出：一页决策，包含主平台、备用平台、PTU 与按需、插桩列表、SLA/合规验证以及两个迁移步骤。以将捕获计划偏差的单一指标结束（持续利用率、PTU 浪费或归因覆盖率）。
