# AI 网关 — LiteLLM、Portkey、Kong AI Gateway、Bifrost

> 网关位于你的应用与模型提供商之间。核心功能包括提供商路由、故障转移、重试、速率限制、密钥引用、可观测性与护栏。2026 年市场格局：**LiteLLM** 为 MIT 开源，支持 100+ 提供商，兼容 OpenAI，但在约 2000 RPS 时会出现性能瓶颈（8 GB 内存，已发布基准测试中出现级联故障）；最适合 Python 环境、<500 RPS、开发/原型阶段。**Portkey** 定位为控制平面（护栏、PII 脱敏、越狱检测、审计追踪），2026 年 3 月转为 Apache 2.0 开源，延迟开销 20–40 ms，生产级 $49/月。**Kong AI Gateway** 基于 Kong Gateway 构建 —— Kong 自家在同等 12 CPU 上的基准测试：比 Portkey 快 228%，比 LiteLLM 快 859%；定价 $100/模型/月（Plus 层级最多 5 个）；若已使用 Kong 则天然适合企业。**Bifrost**（Maxim AI）—— 自动重试并支持可配置退避，在 OpenAI 返回 429 时自动回退到 Anthropic。**Cloudflare / Vercel AI Gateway** —— 托管、零运维、基础重试。数据驻留决定自托管决策；Portkey 与 Kong 处于中间地带，提供开源 + 可选托管。

**类型：** 学习
**语言：** Python（标准库，简易网关路由模拟器）
**前置知识：** 第 17 阶段 · 01（托管 LLM 平台）、第 17 阶段 · 16（模型路由）
**时间：** ~60 分钟

## 学习目标

- 列举网关的六大核心功能（路由、故障转移、重试、速率限制、密钥、可观测性、护栏）。
- 将 2026 年的四大网关（LiteLLM、Portkey、Kong AI、Bifrost）映射到各自的规模上限与适用场景。
- 引用 Kong 基准测试（比 Portkey 快 228%，比 LiteLLM 快 859%）并解释为何对 >500 RPS 重要。
- 根据数据驻留与运维预算选择自托管或托管方案。

## 问题背景

你的产品调用 OpenAI、Anthropic 以及自托管的 Llama。每个提供商拥有不同的 SDK、错误模型、速率限制与认证方式。你需要故障转移（若 OpenAI 返回 429，则尝试 Anthropic）、统一的凭证存储、统一的可观测性，以及按租户的速率限制。

在应用层重复实现这些功能，会让每个服务与每个提供商紧耦合。网关层将其整合为一个进程、一个 API（通常为 OpenAI 兼容），再分发到各提供商。

## 核心概念

### 六大核心功能

1. **提供商路由** —— 将 OpenAI、Anthropic、Gemini、自托管等统一到一个 API 后。
2. **故障转移** —— 在 429、5xx 或质量失败时，切换到其他提供商重试。
3. **重试** —— 指数退避，限制尝试次数。
4. **速率限制** —— 按租户、按密钥、按模型。
5. **密钥引用** —— 运行时从密钥库拉取凭证（绝不硬编码在应用中）。
6. **可观测性** —— OTel + GenAI 属性（第 17 阶段 · 13）+ 成本归因。
7. **护栏** —— PII 脱敏、越狱检测、允许主题过滤。

### LiteLLM —— MIT 开源，Python

- 100+ 提供商，OpenAI 兼容，路由配置、故障转移、基础可观测性。
- 在 Kong 的基准测试中约 2000 RPS 时出现瓶颈；8 GB 内存占用，持续负载下级联故障。
- 最佳场景：Python 应用、<500 RPS、开发/测试网关、实验性路由。
- 成本：开源免费；云版有免费层级。

### Portkey —— 控制平面定位

- 2026 年 3 月起采用 Apache 2.0 开源。护栏、PII 脱敏、越狱检测、审计追踪。
- 每次请求延迟开销 20–40 ms。
- 生产级 $49/月，含数据保留与 SLA。
- 最佳场景：受监管行业，需要护栏 + 可观测性一体化。

### Kong AI Gateway —— 规模化方案

- 基于 Kong Gateway（成熟的 API 网关产品，lua+OpenResty）。
- Kong 自家在同等 12 CPU 上的基准测试：比 Portkey 快 228%，比 LiteLLM 快 859%。
- 定价：$100/模型/月，Plus 层级最多 5 个。
- 最佳场景：已使用 Kong；>1000 RPS；愿意购买商业许可。

### Bifrost（Maxim AI）

- 自动重试并支持可配置退避。
- OpenAI 返回 429 时回退到 Anthropic 是经典配方。
- 新兴厂商；商业产品。

### Cloudflare AI Gateway / Vercel AI Gateway

- 托管、零运维。基础重试与可观测性。
- 最佳场景：在 Cloudflare/Vercel 上运行的边缘 JavaScript 应用。
- 在护栏与速率限制方面不如 Kong/Portkey。

### 自托管 vs 托管

数据驻留是决定性因素。医疗与金融行业默认自托管（LiteLLM、Portkey OSS 或 Kong）。消费类产品默认托管（Cloudflare AI Gateway）或中端（Portkey 托管）。混合方案：受监管租户自托管，其他租户托管。

### 延迟预算

- LiteLLM：典型开销 5–15 ms。
- Portkey：开销 20–40 ms。
- Kong：开销 3–8 ms。
- Cloudflare/Vercel：开销 1–3 ms（边缘优势）。

网关延迟直接累加到 TTFT。若 TTFT P99 < 100 ms SLA，选 Kong 或 Cloudflare。若 P99 < 500 ms，任意均可。

### 速率限制语义至关重要

简单令牌桶在中等规模以下有效。多租户场景需要滑动窗口 + 突发容忍 + 按租户分级。LiteLLM 内置令牌桶；Kong 内置滑动窗口；Portkey 内置分级限制。

### 网关 + 可观测性 + 路由的组合

第 17 阶段 · 13（可观测性）+ 16（模型路由）+ 19（网关）在生产环境中属于同一层。选择一款能同时覆盖三者的工具，或仔细拼接：大多数 2026 年的部署会将 Helicone（可观测性）或 Portkey（护栏）与 Kong（规模）组合，各司其职。

### 需要记住的数字

- LiteLLM：约 2000 RPS 瓶颈，8 GB 内存。
- Portkey：20–40 ms 开销；2026 年 3 月起 Apache 2.0。
- Kong：比 Portkey 快 228%，比 LiteLLM 快 859%。
- Kong 定价：$100/模型/月，Plus 层级最多 5 个。
- Cloudflare/Vercel：边缘开销 1–3 ms。

## 使用

`code/main.py` 模拟网关在 3 个提供商之间的路由与故障转移，注入 429/5xx 错误。报告延迟、重试率与故障转移命中率。

## 交付

本课产出 `outputs/skill-gateway-picker.md`。根据规模、运维姿态、合规要求、延迟预算，选择一款网关。

## 练习

1. 运行 `code/main.py`。配置从 OpenAI→Anthropic→自托管的故障转移。在 5% 提供商错误率下，预期命中率是多少？
2. 你的 SLA 要求 TTFT P99 < 200 ms，基线 300 ms。哪些网关仍在预算内？
3. 某医疗客户要求自托管 + PII 脱敏 + 审计。在 Portkey OSS 与 Kong 之间做选择。
4. 对比 LiteLLM 与 Kong：团队应在什么 RPS 上限时迁移？
5. 为一款多租户 SaaS 设计速率限制策略：免费层、试用层、付费层。令牌桶还是滑动窗口？

## 关键术语

| 术语 | 业界说法 | 实际含义 |
|------|---------|---------|
| Gateway | "API broker" | 位于应用与提供商之间的进程 |
| LiteLLM | "the MIT one" | Python 开源，100+ 提供商，2K RPS 瓶颈 |
| Portkey | "guardrails gateway" | 控制平面 + 可观测性，Apache 2.0 |
| Kong AI Gateway | "the scale one" | 基于 Kong Gateway，基准测试领先 |
| Bifrost | "Maxim's gateway" | 重试 + Anthropic 故障转移配方 |
| Cloudflare AI Gateway | "edge managed" | 边缘部署的托管网关，零运维 |
| PII redaction | "data scrub" | 在发送给模型前用正则 + NER 掩码 |
| Jailbreak detection | "prompt injection guard" | 对用户输入的分类器检测 |
| Audit trail | "regulated log" | 每次 LLM 调用的不可变记录 |
| Token-bucket | "simple rate limit" | 基于补充的速率限制器 |
| Sliding-window | "precise rate limit" | 基于时间窗口的速率限制器；公平性更好 |

## 延伸阅读

- [Kong AI Gateway Benchmark](https://konghq.com/blog/engineering/ai-gateway-benchmark-kong-ai-gateway-portkey-litellm)
- [TrueFoundry — AI Gateways 2026 Comparison](https://www.truefoundry.com/blog/a-definitive-guide-to-ai-gateways-in-2026-competitive-landscape-comparison)
- [Techsy — Top LLM Gateway Tools 2026](https://techsy.io/en/blog/best-llm-gateway-tools)
- [LiteLLM GitHub](https://github.com/BerriAI/litellm)
- [Portkey GitHub](https://github.com/Portkey-AI/gateway)
- [Kong AI Gateway docs](https://docs.konghq.com/gateway/latest/ai-gateway/)
