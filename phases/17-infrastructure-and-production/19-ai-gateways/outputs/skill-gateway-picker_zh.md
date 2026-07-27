---
name: gateway-picker
description: 根据规模、延迟预算、合规性、运营姿态和定价容忍度，选择 AI 网关（LiteLLM、Portkey、Kong AI、Cloudflare/Vercel）。
version: 1.0.0
phase: 17
lesson: 19
tags: [ai-gateway, litellm, portkey, kong, cloudflare, vercel, bifrost, fallback, rate-limit, guardrails]
---

给定 RPS（当前和 12 个月预测）、延迟预算、合规要求（是否需要自托管？）、护栏需求（PII 脱敏、越狱检测、审计）和定价容忍度，生成网关推荐。

输出：

1. **主网关**。指明工具名称。根据 RPS 上限、开销和功能匹配度论证。
2. **故障切换链**。按顺序三个提供商；OpenAI → Anthropic → 自托管是标准配置。计算预期可用性。
3. **限流策略**。>500 RPS 推荐滑动窗口；否则可接受令牌桶。按租户分层。
4. **护栏**。如果需要 PII/越狱检测选择 Portkey；如果需要规模 + 护栏选择 Kong；如果仅开发层级选择 LiteLLM。
5. **可观测性交接**。指向阶段 17 · 13 的选择；确认 OTel GenAI 约定已贯穿。
6. **迁移**。如果从应用级集成迁移，分阶段上线（1% 金丝雀在网关上，成功后扩展）。

**硬性拒绝条件：**
- LiteLLM 在 >2000 RPS 时。拒绝——Kong 基准测试显示级联故障；先迁移。
- Portkey 在 TTFT P99 < 100 ms 的 SLA 下。拒绝——30 ms 开销消耗了过多预算。
- 为受监管的本地客户使用 Cloudflare AI Gateway。拒绝——仅托管；不支持自托管。

**拒绝规则：**
- 如果规模模糊性较大（当前 100 RPS，计划 6 个月内 2K+），在承诺使用 LiteLLM 前要求迁移方案。
- 如果合规要求 SOC 2 Type II 且所选网关仅开源无托管 SLA，要求客户自己的 SOC 2 认证。
- 如果团队没有 Kubernetes 却选择了 Kong 自托管，拒绝——推荐托管 Kong 或托管 Portkey。

**输出**：一页决策，包含网关、故障切换链、限流策略、护栏状态、可观测性流程、迁移方案。最后给出一个指标：过去一小时的网关延迟 P99；超标则告警。
