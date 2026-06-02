# LLM 路由层 —— LiteLLM、OpenRouter、Portkey

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 被供应商锁死的代价是昂贵的。不同的 tool-calling 工作负载适合不同的模型。路由网关（routing gateway）提供统一的 API 表面、重试、故障切换、成本追踪和 guardrail（护栏）。2026 年主导市场的有三种原型：LiteLLM（开源自托管）、OpenRouter（托管 SaaS）、Portkey（产品级，2026 年 3 月开源）。本课讲清楚选型标准，并用 stdlib 走一遍路由网关的实现。

**Type:** Learn
**Languages:** Python (stdlib, routing + failover + cost tracker)
**Prerequisites:** Phase 13 · 02 (function calling), Phase 13 · 17 (gateways)
**Time:** ~45 minutes

## 学习目标（Learning Objectives）

- 区分自托管、托管、产品级三类路由方案。
- 实现一条 fallback 链：在供应商失败时按既定优先级顺序重试。
- 追踪每次请求在不同 provider 间的成本和 token 使用量。
- 在给定生产约束下，决定选 LiteLLM、OpenRouter 还是 Portkey。

## 问题（The Problem）

provider 路由真正会发挥价值的场景：

1. **成本。** Claude Sonnet 的价格是 Haiku 的 3 倍。triage（分诊）任务用 Haiku 就够；综合性任务才值得上 Sonnet。按请求路由。

2. **故障切换。** OpenAI 撞上糟糕的一小时。每个请求都失败。你希望不重新部署就自动 fallback 到 Anthropic。

3. **延迟。** 实时聊天 UI 需要快速的 time-to-first-token，批量摘要器则不需要。按延迟 SLA 路由。

4. **合规。** 欧盟用户必须留在欧盟区域。按地区路由。

5. **实验。** 在同一负载上 A/B 测试两个模型。按测试桶路由。

这些事每个集成都手写一遍非常重复。路由网关给你一个 OpenAI 兼容的 API，剩下的它来做。

## 概念（The Concept）

### OpenAI 兼容代理形态（OpenAI-compatible proxy shape）

大家都讲 OpenAI 那套协议。路由网关暴露 `/v1/chat/completions`，接收 OpenAI 的 schema，内部转发到 Anthropic / Gemini / Cohere / Ollama / 任何后端。客户端不用关心。

### 模型别名（Model aliases）

代码里不写 `claude-3-5-sonnet-20251022`，而是写 `our_smart_model`。网关把别名映射到真实模型。Anthropic 发布 Claude 4 时，你只需在服务端改别名；代码一行都不动。

### Fallback 链（Fallback chains）

```
primary: openai/gpt-4o
on 5xx: anthropic/claude-3-5-sonnet
on 5xx: google/gemini-1.5-pro
on 5xx: refuse
```

网关在配置里定义这些。重试要计入预算，避免 fallback 串联把成本炸穿。

### 语义缓存（Semantic caching）

完全相同或近似相同的 prompt 命中缓存而不是 provider。在反复运行的 agent loop 上，节省可达 30% 到 60%。key 基于 embedding；近似的 prompt 共享同一缓存槽。

### Guardrails（护栏）

网关层可以做：

- **PII 脱敏。** 在发送 prompt 前用正则或 ML 模型过一遍。
- **策略违规。** 拒绝包含违禁内容的 prompt。
- **输出过滤。** 清洗 completion，防止泄漏。

Portkey 和 Kong 都自带带主张的 guardrail。LiteLLM 把它留作可选。

### 按 key 的限流（Per-key rate limits）

一个 API key = 一个团队。按 key 设预算可以防止某个团队消耗掉共享配额。大多数网关都支持这个。

### 自托管 vs 托管的取舍（Self-hosted vs managed trade-offs）

| 维度 | LiteLLM（自托管） | OpenRouter（托管） | Portkey（产品级） |
|--------|----------------------|----------------------|----------------------|
| 代码 | 开源，Python | 托管 SaaS | 开源（2026 年 3 月）+ 托管 |
| 部署 | 自部署一个代理 | 注册即用 | 两种都行 |
| Provider 数 | 100+ | 300+ | 100+ |
| 计费 | 用你自己的 key | OpenRouter 积分 | 用你自己的 key |
| 可观测性 | OpenTelemetry | Dashboard | 完整 OTel + PII 脱敏 |
| 最适合 | 想要完全掌控的团队 | 快速原型 | 有合规要求的生产环境 |

如果你有 SRE 团队、需要数据主权，LiteLLM 胜出。如果你想要单一订阅、不碰基础设施，OpenRouter 胜出。如果你需要开箱即用的 guardrail 和合规，Portkey 胜出。

### 成本追踪（Cost tracking）

每次请求携带 `provider`、`model`、`input_tokens`、`output_tokens`。乘以按模型按 token 的单价（从网关维护的价目表里拉）。然后按用户 / 团队 / 项目聚合。

### MCP 加路由（MCP plus routing）

网关可以同时路由 LLM 调用 *和* MCP 采样请求。当某次采样请求的 modelPreferences 偏好某个特定模型时，网关把它翻译到对应的后端。这就是 Phase 13 · 17（MCP 网关）和本课的路由网关有时会合并成同一个服务的原因。

### 路由策略（Routing strategies）

- **静态优先级。** 列表里第一个；出错就降级到下一个。
- **负载均衡。** 轮询或加权。
- **成本优先。** 选满足延迟 / 质量约束下最便宜的模型。
- **延迟优先。** 选过去 N 分钟里最快的模型。
- **任务优先。** prompt 分类器把代码任务路由到一个模型，把摘要任务路由到另一个。

## 用起来（Use It）

`code/main.py` 用约 150 行实现了一个路由网关：接收 OpenAI 形状的请求、翻译到各 provider 的 stub、跑优先级 fallback 链、追踪每请求成本、并在输入上做 PII 脱敏。用三个场景跑一遍：正常请求、主 provider 故障触发 fallback、被脱敏拦下的 PII 泄漏。

重点看：

- `ROUTES` 字典：别名 -> 优先级排序的具体 provider 列表。
- Fallback 循环在 5xx 时重试。
- 成本追踪器把 token 用量乘上每个模型的单价。
- PII 脱敏器在转发前清洗类 SSN 形态的字符串。

## 上线部署（Ship It）

本课产出 `outputs/skill-routing-config-designer.md`。给定工作负载画像（延迟、成本、合规），这个 skill 会在 LiteLLM / OpenRouter / Portkey 之间选择，并产出一份路由配置。

## 练习（Exercises）

1. 跑 `code/main.py`。触发故障场景；确认 fallback 落在第二个 provider，并且成本被正确归账。

2. 加上语义缓存：prompt 的 SHA256 作为查找 key；命中即时返回。在重复调用上度量节省下来的成本。

3. 加一个 prompt 分类器：把 "code ..." 的 prompt 路由到偏向智能的别名，把 "summarize ..." 的 prompt 路由到偏向速度的别名。

4. 设计按团队的预算：每个团队有月度花费上限；上限用尽后网关拒绝请求。挑一个执行粒度（按请求或按时间窗）。

5. 把 LiteLLM、OpenRouter、Portkey 的文档并排读一遍。说出每家有、另两家没有的那一个特性。

## 关键术语（Key Terms）

| 术语 | 大家口头说什么 | 实际含义 |
|------|----------------|------------------------|
| Routing gateway（路由网关） | "LLM 代理" | 在多个 provider 前的统一 API 层 |
| OpenAI-compatible | "讲 OpenAI 那套 schema" | 接收 `/v1/chat/completions` 形状，翻译到任意后端 |
| Model alias（模型别名） | "our_smart_model" | 你代码里的名字，网关映射到具体模型 |
| Fallback chain（fallback 链） | "重试列表" | 失败时按顺序尝试的 provider 列表 |
| Semantic caching（语义缓存） | "Prompt embedding 缓存" | key 是 prompt 的 embedding；近似 prompt 共享命中 |
| Guardrails（护栏） | "输入/输出过滤" | PII 脱敏、拒绝违规策略 |
| Per-key rate limit | "团队预算" | 限定到某个 API key 的配额 |
| Cost tracking（成本追踪） | "每请求花费" | token 用量 × 模型单价的聚合 |
| LiteLLM | "开源代理" | 可自托管的 OSS 路由网关 |
| OpenRouter | "托管 SaaS" | 按积分计费的托管网关 |
| Portkey | "产品级选项" | 开源 + 托管，内置 guardrail |

## 延伸阅读（Further Reading）

- [LiteLLM — docs](https://docs.litellm.ai/) — self-hosted routing gateway
- [OpenRouter — quickstart](https://openrouter.ai/docs/quickstart) — managed routing SaaS
- [Portkey — docs](https://portkey.ai/docs) — production routing with guardrails
- [TrueFoundry — LiteLLM vs OpenRouter](https://www.truefoundry.com/blog/litellm-vs-openrouter) — decision guide
- [Relayplane — LLM gateway comparison 2026](https://relayplane.com/blog/llm-gateway-comparison-2026) — vendor survey
