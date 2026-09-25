# LLM 路由层 — LiteLLM、OpenRouter、Portkey

> 供应商锁定代价高昂。不同的工具调用工作负载适合不同的模型。路由网关提供统一的 API 表面、重试、故障转移、成本跟踪和防护机制。2026 年占主导地位的三种模式是：LiteLLM（开源自托管）、OpenRouter（托管 SaaS）、Portkey（生产级，2026 年 3 月开源）。本课说明决策标准，并实现一个基于 stdlib 的路由网关。

**Type:** Learn
**Languages:** Python（stdlib，路由 + 故障转移 + 成本跟踪）
**Prerequisites:** Phase 13 · 02（函数调用）、Phase 13 · 17（网关）
**Time:** 约 45 分钟

## 学习目标

- 区分自托管、托管和生产级路由选项。
- 实现一个回退链，按定义的优先级顺序在供应商故障时重试。
- 跨供应商跟踪每请求的成本和 token 用量。
- 针对给定的生产约束，在 LiteLLM、OpenRouter 和 Portkey 之间做出选择。

## 问题所在

供应商路由起作用的场景：

1. **成本。** Claude Sonnet 的价格是 Haiku 的 3 倍。对于分诊任务，Haiku 足够；对于综合任务，Sonnet 更值得。按请求路由。

2. **故障转移。** OpenAI 出现一小时故障。每个请求都失败。你希望自动回退到 Anthropic，而无需重新部署。

3. **延迟。** 实时聊天 UI 需要快速的首 token 响应时间。批量摘要器则不需要。按延迟 SLA 路由。

4. **合规。** 欧盟用户必须留在欧盟区域。按区域路由。

5. **实验。** 在同一工作负载上对两个模型进行 A/B 测试。按测试分桶路由。

在每个集成中手工编码这些逻辑是重复劳动。路由网关提供一个兼容 OpenAI 的 API，并处理其余事务。

## 核心概念

### 兼容 OpenAI 的代理形态

所有供应商都说 OpenAI 格式。路由网关暴露 `/v1/chat/completions`，接受 OpenAI 模式，并在内部代理到 Anthropic / Gemini / Cohere / Ollama / 任何后端。客户端不关心差异。

### 模型别名

你的代码不用写死快照 id，而是使用 `our_smart_model` 这样的别名。网关把别名映射到真实模型。当某供应商发布新一代模型时，你在服务端修改别名；你的代码一行都不用动。

### 回退链

```
primary: openai/gpt-4o
on 5xx: anthropic/claude-3-5-sonnet
on 5xx: google/gemini-1.5-pro
on 5xx: refuse
```

网关在配置中定义这一点。重试计入预算，防止回退级联导致成本失控。

### 语义缓存

相同或近似相同的提示词命中缓存而不是供应商。在重复的 agent 循环中可节省 30% 到 60%。键基于 embedding；近似相同的提示词共享同一个缓存槽。

### 防护机制

网关层面：

- **PII 脱敏。** 在发送提示词之前进行正则或 ML 检查。
- **策略违规。** 拒绝包含违禁内容的提示词。
- **输出过滤。** 清除补全中的泄露内容。

Portkey 和 Kong 都内置了成体系的防护机制。LiteLLM 将其作为可选功能。

### 按 key 的速率限制

一个 API key = 一个团队。按 key 的预算可防止某个团队耗尽共享配额。大多数网关都支持此功能。

### 自托管与托管的权衡

| 因素 | LiteLLM（自托管） | OpenRouter（托管） | Portkey（生产级） |
|--------|----------------------|----------------------|----------------------|
| 代码 | 开源，Python | 托管 SaaS | 开源（2026 年 3 月）+ 托管 |
| 部署 | 部署一个代理 | 注册即用 | 两者皆可 |
| 供应商 | 100+ | 300+ | 100+ |
| 计费 | 使用你自己的 key | OpenRouter 信用额度 | 使用你自己的 key |
| 可观测性 | OpenTelemetry | 仪表板 | 完整 OTel + PII 脱敏 |
| 最适合 | 想要完全控制权的团队 | 快速原型开发 | 有合规要求的生产环境 |

当你有 SRE 团队并要求数据主权时，LiteLLM 胜出。当你想要单一订阅且无基础设施时，OpenRouter 胜出。当你需要开箱即用的防护机制和合规能力时，Portkey 胜出。

### 成本跟踪

每个请求携带 `provider`、`model`、`input_tokens`、`output_tokens`。乘以各模型的每 token 价格（从网关维护的价格表中获取）。支持按用户 / 团队 / 项目聚合。

### MCP 加路由

网关既可以路由 LLM 调用，也可以路由 MCP 采样请求。当采样请求的 modelPreferences 偏好某个特定模型时，网关将其转换到正确的后端。这就是 Phase 13 · 17（MCP 网关）与本课的路由网关有时会合并为一个服务的地方。

### 路由策略

- **静态优先级。** 列表中第一个；出错时回退。
- **负载均衡。** 轮询或加权。
- **成本感知。** 选择满足延迟 / 质量要求的最便宜模型。
- **延迟感知。** 选择最近 N 分钟内最快的模型。
- **任务感知。** 提示词分类器将编码任务路由到一个模型，摘要任务路由到另一个模型。

```figure
tp-router-failover
```

## 使用它

`code/main.py` 用约 150 行实现了一个路由网关：接受 OpenAI 格式的请求，转换为各供应商的存根，运行优先级回退链，跟踪每请求成本，并对输入应用 PII 脱敏处理。运行三个场景：正常请求、主供应商故障触发回退、PII 泄露被脱敏捕获。

值得关注的点：

- `ROUTES` 字典：别名 -> 按优先级排序的具体供应商列表。
- 回退循环在 5xx 时重试。
- 成本跟踪器将 token 用量乘以各模型的费率。
- PII 脱敏器在转发前清除 SSN 形态的模式。

## 上线它

本课产出 `outputs/skill-routing-config-designer.md`。给定一个工作负载画像（延迟、成本、合规），该 skill 会选择 LiteLLM / OpenRouter / Portkey，并生成路由配置。

## 练习

1. 运行 `code/main.py`。触发故障场景；确认回退落在第二个供应商上，且成本归属正确。

2. 添加语义缓存：以提示词的 SHA256 作为查找键；缓存命中时立即返回。在重复调用上测量成本节省。

3. 添加一个提示词分类器，将"code ..."提示词路由到偏重智能的别名，将"summarize ..."提示词路由到偏重速度的别名。

4. 设计按团队的预算：每个团队有月度支出上限；网关在达到上限后拒绝请求。选择一种执行粒度（按请求或按时间窗口）。

5. 并排阅读 LiteLLM、OpenRouter 和 Portkey 的文档。指出每家独有而另外两家没有的一个功能。

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|----------------|------------------------|
| 路由网关 | "LLM 代理" | 在众多供应商之前的统一 API 表面层 |
| 兼容 OpenAI | "说 OpenAI 的模式" | 接受 `/v1/chat/completions` 形状，转换为任意后端 |
| 模型别名 | "our_smart_model" | 你代码中的名称，由网关映射到具体模型 |
| 回退链 | "重试列表" | 失败时按顺序尝试的供应商列表 |
| 语义缓存 | "提示词 embedding 缓存" | 键是提示词的 embedding；近似重复共享一次缓存命中 |
| 防护机制 | "输入/输出过滤器" | 脱敏 PII，拒绝策略违规 |
| 按 key 速率限制 | "团队预算" | 限定于某个 API key 的配额 |
| 成本跟踪 | "每请求支出" | token 用量 x 各模型价格的聚合 |
| LiteLLM | "开源代理" | 可自托管的开源路由网关 |
| OpenRouter | "托管 SaaS" | 基于信用额度计费的托管网关 |
| Portkey | "生产级选项" | 开源 + 托管，内置防护机制 |

## 延伸阅读

- [LiteLLM — 文档](https://docs.litellm.ai/) — 自托管路由网关
- [OpenRouter — 快速开始](https://openrouter.ai/docs/quickstart) — 托管路由 SaaS
- [Portkey — 文档](https://portkey.ai/docs) — 带防护机制的生产级路由
- [TrueFoundry — LiteLLM vs OpenRouter](https://www.truefoundry.com/blog/litellm-vs-openrouter) — 决策指南
- [Relayplane — 2026 年 LLM 网关对比](https://relayplane.com/blog/llm-gateway-comparison-2026) — 供应商调研