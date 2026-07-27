# AI 网关 — LiteLLM、Portkey、Kong AI Gateway、Bifrost

> 网关位于应用与模型提供商之间。核心功能包括：提供商路由、故障回退、重试、速率限制、密钥引用、可观测性、护栏。2026 年市场格局：**LiteLLM** 是 MIT 协议的开源方案，支持 100+ 提供商，兼容 OpenAI API，但在约 2000 RPS 时会出现性能瓶颈（8 GB 内存，已发布基准测试中存在级联故障）；最适合 Python 栈、<500 RPS、开发/原型场景。**Portkey** 定位为控制平面（护栏、PII 脱敏、越狱检测、审计追踪），2026 年 3 月转为 Apache 2.0 开源，延迟开销 20-40 ms，生产版 $49/月。**Kong AI Gateway** 基于 Kong Gateway 构建——Kong 在相同 12 CPU 上的基准测试：比 Portkey 快 228%，比 LiteLLM 快 859%；定价 $100/模型/月（Plus 版最多 5 个模型）；适合已使用 Kong 的企业。**Bifrost**（Maxim AI）——自动重试与可配置退避，OpenAI 429 时回退到 Anthropic。**Cloudflare / Vercel AI 网关**——托管、零运维、基础重试能力。数据驻留需求驱动自托管决策；Portkey 和 Kong 居于中间地带，同时提供开源 + 可选托管服务。

**类型：** 学习
**语言：** Python（标准库，玩具网关路由模拟器）
**前置要求：** 阶段 17 · 01（托管 LLM 平台），阶段 17 · 16（模型路由）
**时长：** ~60 分钟

## 学习目标

- 列举六大核心网关功能（路由、回退、重试、速率限制、密钥管理、可观测性、护栏）。
- 将四个 2026 年主流网关（LiteLLM、Portkey、Kong AI、Bifrost）映射到其规模上限与适用场景。
- 引用 Kong 基准测试（比 Portkey 快 228%，比 LiteLLM 快 859%）并解释其对 >500 RPS 场景的意义。
- 根据数据驻留和运维预算，选择自托管还是托管方案。

## 问题场景

你的产品同时调用 OpenAI、Anthropic 和自托管的 Llama。每个提供商都有不同的 SDK、错误模型、速率限制和认证方案。你需要故障转移（如果 OpenAI 返回 429，尝试 Anthropic）、统一的凭证存储、一致的可观测性以及每租户的速率限制。

在应用层重新实现这些功能会使每个服务与每个提供商紧密耦合。而网关层将其整合为一个进程、一个 API（通常兼容 OpenAI），再由网关分发给各提供商。

## 核心概念

### 七大核心功能

1. **提供商路由** — OpenAI、Anthropic、Gemini、自托管等，统一在一个 API 后面。
2. **故障回退** — 遇到 429、5xx 或质量失败时，在其他提供商处重试。
3. **重试** — 指数退避，有限次数。
4. **速率限制** — 按租户、按密钥、按模型。
5. **密钥引用** — 运行时从密钥管理服务拉取凭证（绝不保存在应用中）。
6. **可观测性** — OTel + GenAI 属性（阶段 17 · 13）+ 成本归因。
7. **护栏** — PII 脱敏、越狱检测、话题过滤器。

### LiteLLM — MIT 开源，Python 生态

- 支持 100+ 提供商，兼容 OpenAI API，提供路由器配置、回退、基础可观测性。
- 在 Kong 的基准测试中，约 2000 RPS 时性能崩溃；8 GB 内存占用，持续负载下出现级联故障。
- 最佳适用场景：Python 应用、<500 RPS、开发/预发布环境、实验性路由。
- 成本：开源免费；存在免费云层。

### Portkey — 控制平面定位

- 2026 年 3 月起转为 Apache 2.0 开源。提供护栏、PII 脱敏、越狱检测、审计追踪。
- 每请求延迟开销 20-40 ms。
- 生产版本 $49/月，包含数据保留 + SLA。
- 最佳适用场景：需要护栏 + 可观测性捆绑的受监管行业。

### Kong AI Gateway — 规模化方案

- 基于 Kong Gateway（成熟的 API 网关产品，lua+OpenResty）构建。
- Kong 在 12 CPU 等效环境下的自有基准测试：比 Portkey 快 228%，比 LiteLLM 快 859%。
- 定价：$100/模型/月，Plus 版最多 5 个模型。
- 最佳适用场景：已在用 Kong；>1000 RPS；愿意购买许可。

### Bifrost（Maxim AI）

- 自动重试，支持可配置退避策略。
- OpenAI 返回 429 时回退到 Anthropic 是典型方案。
- 较新的市场进入者，商业产品。

### Cloudflare AI Gateway / Vercel AI Gateway

- 托管方案，零运维。提供基础重试和可观测性。
- 最佳适用场景：在 Cloudflare/Vercel 上运行的边缘服务 JavaScript 应用。
- 在护栏和速率限制方面功能弱于 Kong/Portkey。

### 自托管 vs 托管

数据驻留是决策的驱动力。医疗和金融行业默认选择自托管（LiteLLM 或 Portkey OSS 或 Kong）。面向消费者的产品默认选择托管方案（Cloudflare AI Gateway）或中间层（Portkey 托管）。混合方案：受监管的租户用自托管，其他用托管。

### 延迟预算

- LiteLLM：典型开销 5-15 ms。
- Portkey：开销 20-40 ms。
- Kong：开销 3-8 ms。
- Cloudflare/Vercel：开销 1-3 ms（边缘计算优势）。

网关延迟直接累加到 TTFT（首 token 时间）上。对于 TTFT P99 < 100 ms 的 SLA，选择 Kong 或 Cloudflare。对于 P99 < 500 ms，任意方案均可。

### 速率限制语义很重要

简单的令牌桶算法在中等规模下可行。多租户场景需要滑动窗口 + 突发额度 + 按租户分级。LiteLLM 使用令牌桶；Kong 使用滑动窗口；Portkey 使用分级策略。

### 网关 + 可观测性 + 路由的组合

阶段 17 · 13（可观测性）+ 16（模型路由）+ 19（网关）在生产环境中处于同一层。要么选择一款覆盖全部三个功能的工具，要么仔细编排它们：大多数 2026 年部署会将 Helicone（可观测性）或 Portkey（护栏）与 Kong（规模化）组合，实现角色分离。

### 需要记住的数据

- LiteLLM：约 2000 RPS 时性能崩溃，8 GB 内存。
- Portkey：延迟开销 20-40 ms；2026 年 3 月起 Apache 2.0。
- Kong：比 Portkey 快 228%，比 LiteLLM 快 859%。
- Kong 定价：$100/模型/月，Plus 版最多 5 个模型。
- Cloudflare/Vercel：边缘延迟开销 1-3 ms。

## 动手实践

`code/main.py` 模拟网关路由，在注入 429/5xx 错误的场景下实现三个提供商之间的故障回退。输出延迟、重试率和回退命中率。

## 交付物

本课程产出 `outputs/skill-gateway-picker.md`。根据规模、运维姿态、合规需求、延迟预算，选择推荐一个网关方案。

## 练习

1. 运行 `code/main.py`。配置回退链路 OpenAI→Anthropic→自托管。在 5% 的提供商错误率下，预期回退命中率是多少？
2. 你的 SLA 要求 TTFT P99 < 200 ms，基础延迟为 300 ms。哪些网关能满足预算？
3. 某医疗客户要求自托管 + PII 脱敏 + 审计。选择 Portkey OSS 还是 Kong？
4. 比较 LiteLLM 和 Kong：在多少 RPS 上限时团队应该迁移？
5. 为多租户 SaaS 设计速率限制策略：免费层、试用层、付费层。用令牌桶还是滑动窗口？

## 关键术语

| 术语 | 常见说法 | 实际含义 |
|------|----------|----------|
| 网关 (Gateway) | "API 代理" | 位于应用与提供商之间的进程 |
| LiteLLM | "那个 MIT 协议的项目" | Python 开源方案，100+ 提供商，2K RPS 时崩溃 |
| Portkey | "护栏网关" | 控制平面 + 可观测性，Apache 2.0 |
| Kong AI Gateway | "规模化方案" | 基于 Kong Gateway 构建，基准测试领先 |
| Bifrost | "Maxim 的网关" | 重试 + Anthropic 回退方案 |
| Cloudflare AI Gateway | "边缘托管" | 边缘部署的托管网关，零运维 |
| PII 脱敏 (PII redaction) | "数据清洗" | 发送到模型前用正则 + 命名实体识别遮盖敏感信息 |
| 越狱检测 (Jailbreak detection) | "提示注入防护" | 对用户输入进行分类检测 |
| 审计追踪 (Audit trail) | "合规日志" | 每次 LLM 调用的不可变记录 |
| 令牌桶 (Token-bucket) | "简单限流" | 基于补充的速率限制器 |
| 滑动窗口 (Sliding-window) | "精确限流" | 基于时间窗口的速率限制器；公平性更优 |

## 延伸阅读

- [Kong AI Gateway 基准测试](https://konghq.com/blog/engineering/ai-gateway-benchmark-kong-ai-gateway-portkey-litellm)
- [TrueFoundry — 2026 年 AI 网关对比](https://www.truefoundry.com/blog/a-definitive-guide-to-ai-gateways-in-2026-competitive-landscape-comparison)
- [Techsy — 2026 年最佳 LLM 网关工具](https://techsy.io/en/blog/best-llm-gateway-tools)
- [LiteLLM GitHub](https://github.com/BerriAI/litellm)
- [Portkey GitHub](https://github.com/Portkey-AI/gateway)
- [Kong AI Gateway 文档](https://docs.konghq.com/gateway/latest/ai-gateway/)
