---
name: managed-platform-picker
description: 根据工作负载、SLA 和合规要求，选择托管 LLM 平台（Bedrock、Azure OpenAI、Vertex AI）及备用平台，并制定 FinOps 检测方案。
version: 1.0.0
phase: 17
lesson: 01
tags: [bedrock, azure-openai, vertex-ai, ptu, finops, managed-platforms]
---

给定工作负载概况（所需模型、每月 Token 数、P50/P99 TTFT SLA、合规约束、现有云足迹），生成平台推荐。

输出：

1. **主平台**。指明平台、其覆盖的具体模型，以及在按需和预置吞吐量单元（PTU）/预置吞吐量之间选择是否合适。引用盈亏平衡计算（PTU 约在 40-60% 持续利用率时持平）。
2. **备用平台**。指明最少两个提供商的故障切换方案。论证配对合理性——冗余必须覆盖模型重叠（Bedrock 上的 Claude + Azure OpenAI 上的 GPT 是常见组合）和区域重叠。
3. **FinOps 检测**。指定第一天需启用的内容：Bedrock Application Inference Profiles、Azure 作用域 + PTU 预留作为成本对象、每个团队一个项目 + BigQuery 账单导出。指明归属维度——按用户、按任务、按租户。
4. **SLA 检查**。将目标 TTFT P99 与已发布基准对比（Azure OpenAI PTU ≈ 50 ms P50；Bedrock 按需 ≈ 75 ms P50）。如果 SLA 比按需能提供的更严格，则要求 PTU。
5. **合规检查**。根据需要验证 BAA、SOC 2 Type II、HIPAA、欧盟数据驻留。注意三者均满足基准要求，但保留策略和滥用监控选择退出有所不同。
6. **迁移路径**。指明团队本周可执行的一个可逆步骤（例如，通过抽象提供商的 AI 网关部署；检测归属标头）和一个长期步骤（PTU 承诺；跨区域故障切换）。

**硬性拒绝条件：**
- 推荐单一平台而无指定备用方案。拒绝并要求至少两个提供商。
- 选择 PTU 而无利用率估算。拒绝并要求提供持续利用率数据。
- 在归属被列为需求时忽略 Bedrock Application Inference Profiles——它们是最简洁的原生接口。

**拒绝规则：**
- 如果工作负载要求 Claude、Gemini 和 GPT 均为 P0 级别，明确说明三平台现实（Bedrock + Vertex + Azure OpenAI 通过网关），而非假装一个平台可服务三者。
- 如果 SLA 为 TTFT P99 < 100 ms 且预期预算无法支持 PTU，拒绝承诺该 SLA——解释按需方案的延迟方差上限。
- 如果客户要求"使用最便宜的提供商"，拒绝——价格是多维度的（Token 费率 + 专用容量 + 归属开销 + 锁定成本）。

**输出**：一页决策文档，包含主平台、备用平台、PTU vs 按需、检测清单、SLA/合规验证以及两个迁移步骤。最后指出将捕获计划偏离的单一指标（持续利用率、PTU 浪费或归属覆盖率）。
