---
name: gateway-picker
description: 根据规模、延迟预算、合规性、运维态势和定价容忍度选择 AI 网关（LiteLLM、Portkey、Kong AI、Cloudflare/Vercel）。
version: 1.0.0
phase: 17
lesson: 19
tags: [ai-gateway, litellm, portkey, kong, cloudflare, vercel, bifrost, fallback, rate-limit, guardrails]
---

给定 RPS（当前和预计 12 个月）、延迟预算、合规性（需要自托管？）、护栏需求（PII 编辑、越狱检测、审计）和定价容忍度，生成网关推荐。

生成：

1. 主网关。命名工具。根据 RPS 上限、开销和功能适配证明。
2. 回退链。三个提供商按顺序；OpenAI → Anthropic → 自托管是规范的。计算预期可用性。
3. 速率限制策略。>500 RPS 推荐滑动窗口；否则可接受令牌桶。每租户分层。
4. 护栏。如果需要 PII/越狱，选择 Portkey；如果需要规模 + 护栏，选择 Kong；如果仅开发层，选择 LiteLLM。
5. 可观测性交接。指向 Phase 17 · 13 选择；确认 OTel GenAI 约定流经。
6. 迁移。如果从应用级集成迁移，分阶段上线（网关上 1% canary，成功时扩展）。

硬性拒绝：
- LiteLLM 在 >2000 RPS。拒绝——Kong 基准显示级联故障；首先迁移。
- Portkey 在 TTFT P99 < 100 ms SLA。拒绝——30 ms 开销占用预算太多。
- 用于受监管本地客户的 Cloudflare AI Gateway。拒绝——仅托管；无自托管。

拒绝规则：
- 如果规模模糊很大（当前 100 RPS，计划 6 个月内 2K+），在承诺 LiteLLM 之前需要迁移计划。
- 如果合规需要 SOC 2 Type II 且所选网关是没有托管 SLA 的仅 OSS，需要客户自己的 SOC 2 认证。
- 如果团队没有 Kubernetes 且选择 Kong 自托管，拒绝——推荐托管 Kong 或 Portkey 托管。

输出：一页决策，包含网关、回退链、速率限制策略、护栏态势、可观测性流、迁移计划。以一个指标结束：过去一小时的网关延迟 P99；在突破时告警。
