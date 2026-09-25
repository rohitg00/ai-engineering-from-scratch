# AI 网关 — LiteLLM、Portkey、Kong AI Gateway、Bifrost

> 网关位于你的应用与模型提供商之间。核心功能包括：提供商路由、回退（fallback）、重试、速率限制、密钥引用、可观测性、护栏（guardrails）。2026 年的市场格局：**LiteLLM** 是 MIT 协议的开源项目，支持 100+ 提供商，兼容 OpenAI，但在约 2000 RPS 左右会崩溃（8 GB 内存，公开基准测试中出现级联故障）；最适合 Python、<500 RPS、开发/原型场景。**Portkey** 定位为控制平面（护栏、PII 脱敏、越狱检测、审计跟踪），2026 年 3 月转为 Apache 2.0 开源，20-40 ms 延迟开销，$49/mo production tier. **Kong AI Gateway** built on Kong Gateway — Kong's own benchmark on same 12 CPUs: 228% faster than Portkey, 859% faster than LiteLLM; $100/模型/月的定价（Plus 档最多 5 个模型）；如果已在用 Kong，则很适合企业。**Bifrost**（Maxim AI）— 自动重试并支持可配置的退避策略，在 OpenAI 返回 429 时回退到 Anthropic。**Cloudflare / Vercel AI Gateways** — 托管、零运维、基础重试。数据驻留要求决定是否自托管；Portkey 和 Kong 处于中间地带，提供开源 + 可选托管。

**Type:** Learn
**Languages:** Python（标准库、玩具网关路由模拟器）
**Prerequisites:** 阶段 17 · 01（托管 LLM 平台）、阶段 17 · 16（模型路由）
**Time:** ~60 分钟

## 学习目标

- 列举六项核心网关功能（路由、回退、重试、速率限制、密钥、可观测性、护栏）。
- 将四个 2026 年网关（LiteLLM、Portkey、Kong AI、Bifrost）映射到规模上限与使用场景。
- 引用 Kong 基准测试（比 Portkey 快 228%，比 LiteLLM 快 859%），并解释其对 >500 RPS 场景的意义。
- 根据数据驻留要求与运维预算，选择自托管还是托管。

## 问题

你的产品同时调用 OpenAI、Anthropic 和一个自托管的 Llama。每个提供商有不同的 SDK、错误模型、速率限制和认证方式。你想要故障转移（OpenAI 返回 429 时尝试 Anthropic）、统一的凭据存储、统一可观测性，以及按租户的速率限制。

在应用层重复造轮子会让每个服务耦合每个提供商。网关层将其整合为一个进程、一个 API（通常兼容 OpenAI），向各提供商分发请求。

## 概念

### 六项核心功能

1. **提供商路由** — OpenAI、Anthropic、Gemini、自托管等，统一在单一 API 之后。
2. **回退** — 遇到 429、5xx 或质量问题时，改用其他提供商重试。
3. **重试** — 指数退避，限制尝试次数。
4. **速率限制** — 按租户、按键、按模型。
5. **密钥引用** — 运行时从 vault 拉取凭据（绝不在应用中）。
6. **可观测性** — OTel + GenAI 属性（阶段 17 · 13）+ 成本归因。
7. **护栏** — PII 脱敏、越狱检测、允许主题过滤。

### LiteLLM — MIT 开源，Python

- 100+ 提供商，兼容 OpenAI，路由配置、回退、基础可观测性。
- 在 Kong 的基准测试中约 2000 RPS 时崩溃；8 GB 内存占用，持续负载下出现级联故障。
- 最适合：Python 应用、<500 RPS、开发/预发环境网关、实验性路由。
- 成本：开源版 $0；提供云免费档。

### Portkey — 控制平面定位

- 自 2026 年 3 月起为 Apache 2.0 开源。护栏、PII 脱敏、越狱检测、审计跟踪。
- 每请求 20-40 ms 延迟开销。
- 生产档 $49/月，含数据保留 + SLA。
- 最适合：需要护栏 + 可观测性打包方案的受监管行业。

### Kong AI Gateway — 规模之选

- 基于 Kong Gateway 构建（成熟的 API 网关产品，lua+OpenResty）。
- Kong 在 12-CPU 等效环境下的自有基准：比 Portkey 快 228%，比 LiteLLM 快 859%。
- 定价：$100/模型/月，Plus 档最多 5 个。
- 最适合：已在用 Kong；>1000 RPS；愿意付费授权。

### Bifrost（Maxim AI）

- 自动重试，支持可配置退避。
- OpenAI 返回 429 时回退到 Anthropic 是经典方案。
- 较新的入场者；商业化产品。

### Cloudflare AI Gateway / Vercel AI Gateway

- 托管、零运维。基础重试与可观测性。
- 最适合：部署在 Cloudflare/Vercel 上的边缘 JavaScript 应用。
- 在护栏与速率限制方面弱于 Kong/Portkey。

### 自托管 vs 托管

数据驻留是决定性因素。医疗与金融默认自托管（LiteLLM、Portkey OSS 或 Kong）。消费级产品默认托管（Cloudflare AI Gateway）或中间档（Portkey 托管）。混合模式：受监管租户自托管，其他用托管。

### 延迟预算

- LiteLLM：典型开销 5-15 ms。
- Portkey：开销 20-40 ms。
- Kong：开销 3-8 ms。
- Cloudflare/Vercel：开销 1-3 ms（边缘优势）。

网关延迟直接累加到 TTFT。若 TTFT P99 < 100 ms 的 SLA，选 Kong 或 Cloudflare。若 P99 < 500 ms，任何一家都可以。

### 速率限制语义很重要

简单令牌桶适用于中等规模以下。多租户需要滑动窗口 + 突发配额 + 按租户分层。LiteLLM 采用令牌桶；Kong 采用滑动窗口；Portkey 采用分层方案。

### 网关 + 可观测性 + 路由的组合

阶段 17 · 13（可观测性）+ 16（模型路由）+ 19（网关）在生产中属于同一层。选择一个覆盖三者的工具，或仔细接线：2026 年大多数部署将 Helicone（可观测性）或 Portkey（护栏）与 Kong（规模）组合，各司其职。

### 你应该记住的数字

- LiteLLM：约 2000 RPS 崩溃，8 GB 内存。
- Portkey：开销 20-40 ms；自 2026 年 3 月起 Apache 2.0。
- Kong：比 Portkey 快 228%，比 LiteLLM 快 859%。
- Kong 定价：$100/模型/月，Plus 档最多 5 个。
- Cloudflare/Vercel：边缘开销 1-3 ms。

```figure
mx-gateway-fallback
```

## 使用

`code/main.py` 在 429/5xx 注入条件下，模拟跨 3 个提供商的带回退网关路由。报告延迟、重试率和回退命中率。

## 交付

本课产出 `outputs/skill-gateway-picker.md`。根据规模、运维态势、合规性与延迟预算，选定一个网关。

## 练习

1. 运行 `code/main.py`。配置 OpenAI→Anthropic→自托管的回退链。在 5% 提供商错误率下，预期命中率是多少？
2. 你的 SLA 是基线 300 ms 下 TTFT P99 < 200 ms。哪些网关在预算内？
3. 一家医疗客户要求自托管 + PII 脱敏 + 审计。在 Portkey OSS 或 Kong 中选择。
4. 比较 LiteLLM 与 Kong：团队应在什么 RPS 上限时迁移？
5. 为多租户 SaaS 设计速率限制策略：免费档、试用档、付费档。令牌桶还是滑动窗口？

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|----------------|------------------------|
| 网关 | “API 经纪人” | 位于应用与提供商之间的进程 |
| LiteLLM | “MIT 那个” | Python 开源，100+ 提供商，2K RPS 崩溃 |
| Portkey | “护栏网关” | 控制平面 + 可观测性，Apache 2.0 |
| Kong AI Gateway | “扛规模的那个” | 基于 Kong Gateway 构建，基准测试领先者 |
| Bifrost | “Maxim 的网关” | 重试 + Anthropic 回退方案 |
| Cloudflare AI Gateway | “边缘托管” | 边缘部署的托管网关，零运维 |
| PII 脱敏 | “数据清洗” | 发送给模型前的 Regex + NER 遮蔽 |
| 越狱检测 | “提示注入防护” | 对用户输入的分类器 |
| 审计跟踪 | “合规日志” | 每次 LLM 调用的不可变记录 |
| 令牌桶 | “简单限流” | 基于补充速率的限流器 |
| 滑动窗口 | “精确限流” | 基于时间窗口的限流器；公平性更好 |

## 延伸阅读

- [Kong AI Gateway Benchmark](https://konghq.com/blog/engineering/ai-gateway-benchmark-kong-ai-gateway-portkey-litellm)
- [TrueFoundry — AI Gateways 2026 Comparison](https://www.truefoundry.com/blog/a-definitive-guide-to-ai-gateways-in-2026-competitive-landscape-comparison)
- [Techsy — Top LLM Gateway Tools 2026](https://techsy.io/en/blog/best-llm-gateway-tools)
- [LiteLLM GitHub](https://github.com/BerriAI/litellm)
- [Portkey GitHub](https://github.com/Portkey-AI/gateway)
- [Kong AI Gateway docs](https://docs.konghq.com/gateway/latest/ai-gateway/)