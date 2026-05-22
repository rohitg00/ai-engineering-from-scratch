# AI 网关 — LiteLLM、Portkey、Kong AI Gateway、Bifrost

> 网关位于你的应用和模型提供商之间。核心功能是提供商路由、故障转移、重试、速率限制、密钥引用、可观测性、保护栏。2026 年市场分为：**LiteLLM** 是 MIT OSS，支持 100+ 提供商，OpenAI 兼容，但在约 2000 RPS 时会出现故障（8 GB 内存，已发布基准测试中的级联故障）；最适合 Python、<500 RPS、开发/原型设计。**Portkey** 定位控制平面（保护栏、PII 编辑、越狱检测、审计跟踪），2026 年 3 月转为 Apache 2.0 开源，20-40 ms 延迟开销，49 美元/月生产层级。**Kong AI Gateway** 构建在 Kong Gateway 之上——Kong 自己的基准测试在同等 12 CPU 上：比 Portkey 快 228%，比 LiteLLM 快 859%；定价 100 美元/模型/月（Plus 层级最多 5 个）。如果你已经在用 Kong，它非常适合企业场景。**Bifrost**（Maxim AI）——可配置退避的自动重试，OpenAI 429 时故障转移到 Anthropic。**Cloudflare / Vercel AI Gateways**——托管式，零运维，基本重试。数据驻留驱动自托管决策；Portkey 和 Kong 处于中间位置，提供 OSS + 可选托管。

**类型：** 学习
**语言：** Python（标准库，简单的网关路由模拟器）
**先修要求：** 阶段 17 · 01（托管 LLM 平台）、阶段 17 · 16（模型路由）
**时间：** 约 60 分钟

## 学习目标

- 列举六个核心网关功能（路由、故障转移、重试、速率限制、密钥、可观测性、保护栏）。
- 将四个 2026 年网关（LiteLLM、Portkey、Kong AI、Bifrost）映射到规模上限和用例。
- 引用 Kong 基准测试（比 Portkey 快 228%，比 LiteLLM 快 859%）并解释为什么它对 >500 RPS 很重要。
- 给定数据驻留和运维预算，选择自托管 vs 托管。

## 问题

你的产品调用 OpenAI、Anthropic 和自托管 Llama。每个提供商都有不同的 SDK、错误模型、速率限制和身份验证方案。你想要故障转移（如果 OpenAI 429，尝试 Anthropic）、统一的凭证存储、统一的可观测性和每租户的速率限制。

在应用层重新实现这些功能会将每个服务与每个提供商耦合。网关层将其整合到一个进程中，使用同一个 API（通常是 OpenAI 兼容的）扇出到各个提供商。

## 概念

### 六个核心功能

1. **提供商路由**——在 OpenAI、Anthropic、Gemini、自托管等后面，使用同一个 API。
2. **故障转移**——在 429、5xx 或质量失败时，在其他地方重试。
3. **重试**——指数退避，有界尝试次数。
4. **速率限制**——每租户、每密钥、每模型。
5. **密钥引用**——在运行时从 Vault 拉取凭证（绝不在应用中）。
6. **可观测性**——OTel + GenAI 属性（阶段 17 · 13）+ 成本归因。
7. **保护栏**——PII 编辑、越狱检测、允许的主题过滤器。

### LiteLLM——MIT OSS，Python

- 100+ 提供商，OpenAI 兼容，路由器配置，故障转移，基本可观测性。
- 在 Kong 的基准测试中约 2000 RPS 时出现故障；8 GB 内存占用，持续负载下的级联故障。
- 最适合：Python 应用，<500 RPS，开发/预发布网关，实验性路由。
- 成本：OSS 免费；存在云免费层级。

### Portkey——控制平面定位

- 2026 年 3 月起为 Apache 2.0 OSS。保护栏、PII 编辑、越狱检测、审计跟踪。
- 每请求 20-40 ms 延迟开销。
- 生产层级 49 美元/月，带保留和 SLA。
- 最适合：需要保护栏 + 可观测性捆绑的受监管行业。

### Kong AI Gateway——规模玩法

- 构建在 Kong Gateway（成熟的 API 网关产品，lua+OpenResty）之上。
- Kong 自己在同等 12 CPU 上的基准测试：比 Portkey 快 228%，比 LiteLLM 快 859%。
- 定价：100 美元/模型/月，Plus 层级最多 5 个。
- 最适合：已经在使用 Kong；>1000 RPS；愿意获得许可。

### Bifrost (Maxim AI)

- 可配置退避的自动重试。
- OpenAI 429 时故障转移到 Anthropic 是一个典型方案。
- 较新的进入者；商业产品。

### Cloudflare AI Gateway / Vercel AI Gateway

- 托管式，零运维。基本重试和可观测性。
- 最适合：在 Cloudflare/Vercel 上的边缘服务 JavaScript 应用。
- 与 Kong/Portkey 相比，在保护栏和速率限制方面有限。

### 自托管 vs 托管

数据驻留是决定性因素。医疗和金融默认自托管（LiteLLM 或 Portkey OSS 或 Kong）。消费产品默认托管（Cloudflare AI Gateway）或中间层级（Portkey 托管）。混合方案：受监管租户自托管，其他租户托管。

### 延迟预算

- LiteLLM：典型 5-15 ms 开销。
- Portkey：20-40 ms 开销。
- Kong：3-8 ms 开销。
- Cloudflare/Vercel：边缘优势 1-3 ms 开销。

网关延迟直接加到 TTFT 上。对于 TTFT P99 < 100 ms SLA，使用 Kong 或 Cloudflare。对于 P99 < 500 ms，任何一个都可以。

### 速率限制语义很重要

简单的令牌桶适用于中等规模。多租户需要滑动窗口 + 突发允许 + 每租户分层。LiteLLM 提供令牌桶；Kong 提供滑动窗口；Portkey 提供分层。

### 网关 + 可观测性 + 路由组合

阶段 17 · 13（可观测性）+ 16（模型路由）+ 19（网关）是生产环境中的同一层。选择一个覆盖所有三个的工具，或者仔细连接它们：大多数 2026 年部署将 Helicone（可观测性）或 Portkey（保护栏）与 Kong（规模）结合使用，以实现职责分离。

### 你应该记住的数字

- LiteLLM：约 2000 RPS 时出现故障，8 GB 内存。
- Portkey：20-40 ms 开销；2026 年 3 月起为 Apache 2.0。
- Kong：比 Portkey 快 228%，比 LiteLLM 快 859%。
- Kong 定价：100 美元/模型/月，Plus 层级最多 5 个。
- Cloudflare/Vercel：边缘 1-3 ms 开销。

## 使用它

`code/main.py` 模拟在 429/5xx 注入情况下跨 3 个提供商的网关路由和故障转移。报告延迟、重试率和故障转移命中率。

## 交付它

本课生成 `outputs/skill-gateway-picker.md`。给定规模、运维状况、合规性、延迟预算，选择一个网关。

## 练习

1. 运行 `code/main.py`。配置从 OpenAI→Anthropic→自托管故障转移。在 5% 提供商错误率下，预期命中率是多少？
2. 你的 SLA 是在 300 ms 基线下的 TTFT P99 < 200 ms。哪些网关在预算内？
3. 医疗客户需要自托管 + PII 编辑 + 审计。选择 Portkey OSS 还是 Kong。
4. 比较 LiteLLM 与 Kong：团队应在何种 RPS 上限下迁移？
5. 为多租户 SaaS 设计速率限制策略：免费层级、试用层级、付费层级。令牌桶还是滑动窗口？

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|----------------|------------------------|
| Gateway | "API 代理" | 位于应用和提供商之间的进程 |
| LiteLLM | "MIT 那个" | Python OSS，100+ 提供商，约 2000 RPS 时出现故障 |
| Portkey | "保护栏网关" | 控制平面 + 可观测性，Apache 2.0 |
| Kong AI Gateway | "规模那个" | 构建在 Kong Gateway 之上，基准测试领导者 |
| Bifrost | "Maxim 的网关" | 重试 + Anthropic 故障转移方案 |
| Cloudflare AI Gateway | "边缘托管" | 边缘部署的托管网关，零运维 |
| PII redaction | "数据清理" | 在发送到模型之前的正则表达式 + NER 掩码 |
| Jailbreak detection | "提示注入保护" | 用户输入上的分类器 |
| Audit trail | "受监管日志" | 每个 LLM 调用的不可变记录 |
| Token-bucket | "简单速率限制" | 基于 refill 的速率限制器 |
| Sliding-window | "精确速率限制" | 时间窗口速率限制器；更好的公平性 |

## 延伸阅读

- [Kong AI Gateway 基准测试](https://konghq.com/blog/engineering/ai-gateway-benchmark-kong-ai-gateway-portkey-litellm)
- [TrueFoundry——2026 年 AI 网关比较](https://www.truefoundry.com/blog/a-definitive-guide-to-ai-gateways-in-2026-competitive-landscape-comparison)
- [Techsy——顶级 LLM 网关工具 2026](https://techsy.io/en/blog/best-llm-gateway-tools)
- [LiteLLM GitHub](https://github.com/BerriAI/litellm)
- [Portkey GitHub](https://github.com/Portkey-AI/gateway)
- [Kong AI Gateway 文档](https://docs.konghq.com/gateway/latest/ai-gateway/)
