# 21 · LLM 路由层 —— LiteLLM、OpenRouter、Portkey

> 供应商锁定（Provider lock-in）代价高昂。不同的工具调用负载适配不同的模型。路由网关（routing gateway）提供统一的 API 接口、重试、故障切换、成本追踪与护栏。2026 年有三种典型形态占据主流：LiteLLM（开源自托管）、OpenRouter（托管式 SaaS）、Portkey（生产级，于 2026 年 3 月开源）。本课明确选型决策标准，并带你走一遍用标准库实现的路由网关。

**类型：** 学习
**语言：** Python（标准库，路由 + 故障切换 + 成本追踪器）
**前置：** 第 13 阶段 · 02（函数调用）、第 13 阶段 · 17（网关）
**时长：** 约 45 分钟

## 学习目标

- 区分自托管（self-hosted）、托管（managed）与生产级三类路由方案。
- 实现一条回退链（fallback chain），在供应商失败时按既定优先级顺序重试。
- 跨供应商追踪每次请求的成本与 token 用量。
- 针对给定的生产约束，在 LiteLLM、OpenRouter 与 Portkey 之间做出选型。

## 问题所在

供应商路由（provider routing）发挥作用的场景：

1. **成本。** Claude Sonnet 的价格是 Haiku 的 3 倍。对于分流（triage）任务，Haiku 足矣；对于综合（synthesis）任务，Sonnet 物有所值。按请求路由。

2. **故障切换。** OpenAI 遇到一个糟糕的小时，每个请求都失败。你希望无需重新部署即可自动回退到 Anthropic。

3. **延迟。** 实时聊天界面需要快速的首 token 时间（time-to-first-token）；批量摘要器则不需要。按延迟 SLA 路由。

4. **合规。** 欧盟用户必须留在欧盟区域内。按区域路由。

5. **实验。** 在同一负载上对两个模型做 A/B 测试。按测试分桶路由。

为每个集成手写这一切既重复又繁琐。一个路由网关提供统一的 OpenAI 兼容 API，其余的它来处理。

## 核心概念

### OpenAI 兼容代理形态

人人都讲 OpenAI 的形态。路由网关暴露 `/v1/chat/completions`，接受 OpenAI 模式（schema），在内部代理到 Anthropic / Gemini / Cohere / Ollama / 任意后端。客户端无需关心。

### 模型别名

你的代码不写 `claude-3-5-sonnet-20251022`，而是写 `our_smart_model`。网关把别名映射到真实模型。当 Anthropic 发布 Claude 4 时，你只需在服务端改别名；你的代码一行都不用动。

### 回退链

```
primary: openai/gpt-4o
on 5xx: anthropic/claude-3-5-sonnet
on 5xx: google/gemini-1.5-pro
on 5xx: refuse
```

网关在配置中定义这套逻辑。重试会计入预算，因此回退级联不会让成本爆炸。

### 语义缓存

完全相同或近似相同的提示词命中缓存，而不是命中供应商。在重复的智能体循环（agent loop）上，节省可达 30% 到 60%。缓存键基于嵌入（embedding）；近似相同的提示词共享一个缓存槽。

### 护栏

网关层面：

- **PII 脱敏。** 在发送提示词前进行基于正则或机器学习的处理。
- **策略违规。** 拒绝含违禁内容的提示词。
- **输出过滤。** 清洗补全结果中的泄漏内容。

Portkey 和 Kong 都自带有明确主张的护栏。LiteLLM 则把护栏留作可选项。

### 按键限流

一个 API key = 一个团队。按键预算可防止某个团队耗尽共享配额。大多数网关都支持这一点。

### 自托管与托管的权衡

| 因素 | LiteLLM（自托管） | OpenRouter（托管） | Portkey（生产级） |
|--------|----------------------|----------------------|----------------------|
| 代码 | 开源，Python | 托管式 SaaS | 开源（2026 年 3 月）+ 托管 |
| 部署 | 部署一个代理 | 注册即用 | 两者皆可 |
| 供应商 | 100+ | 300+ | 100+ |
| 计费 | 你自己的密钥 | OpenRouter 额度（credits） | 你自己的密钥 |
| 可观测性 | OpenTelemetry | 仪表盘 | 完整 OTel + PII 脱敏 |
| 适用于 | 想要完全掌控的团队 | 快速原型开发 | 有合规要求的生产环境 |

当你拥有 SRE 团队并希望数据主权时，LiteLLM 胜出。当你想要单一订阅、零基础设施时，OpenRouter 胜出。当你需要开箱即用的护栏与合规时，Portkey 胜出。

### 成本追踪

每次请求都携带 `provider`、`model`、`input_tokens`、`output_tokens`。乘以各模型的每 token 单价（从网关维护的价格表中拉取）。按用户 / 按团队 / 按项目聚合。

### MCP 与路由结合

一个网关既可以路由 LLM 调用，也可以路由 MCP 采样（sampling）请求。当某个采样请求的 modelPreferences 偏好某个特定模型时，网关会将其翻译到正确的后端。这正是第 13 阶段 · 17（MCP 网关）与本课的路由网关有时会合并为一个服务之处。

### 路由策略

- **静态优先级。** 取列表中的第一个；出错时回退。
- **负载均衡。** 轮询（round-robin）或加权。
- **成本感知。** 在满足延迟 / 质量的前提下选最便宜的模型。
- **延迟感知。** 选最近 N 分钟内最快的模型。
- **任务感知。** 用提示词分类器把编码任务路由到一个模型，把摘要任务路由到另一个模型。

## 动手用

`code/main.py` 用约 150 行实现了一个路由网关：接受 OpenAI 形态的请求，翻译为各供应商的桩（stub），运行一条优先级回退链，追踪每次请求的成本，并对输入做一次 PII 脱敏。用三个场景运行它：正常请求、主供应商宕机触发回退、PII 泄漏被脱敏拦截。

需要关注的点：

- `ROUTES` 字典：别名 -> 按优先级排序的具体供应商列表。
- 回退循环在遇到 5xx 时重试。
- 成本追踪器将 token 用量乘以各模型费率。
- PII 脱敏器在转发前清洗形如 SSN 的模式。

## 交付物

本课产出 `outputs/skill-routing-config-designer.md`。给定一份负载画像（延迟、成本、合规），该技能会选出 LiteLLM / OpenRouter / Portkey，并生成一份路由配置。

## 练习

1. 运行 `code/main.py`。触发宕机场景；确认回退落到第二个供应商，且成本被正确归因。

2. 加入语义缓存：以提示词的 SHA256 作为查找键；缓存命中时立即返回。在一次重复调用上测量成本节省。

3. 加入一个提示词分类器，把以 "code ..." 开头的提示词路由到一个偏好智能的别名，把以 "summarize ..." 开头的提示词路由到一个偏好速度的别名。

4. 设计按团队预算：每个团队有月度支出上限；一旦达到上限，网关即拒绝请求。选定一个执行粒度（按请求或按时间窗口）。

5. 把 LiteLLM、OpenRouter 与 Portkey 的文档并排阅读。各点出一个其余两者所没有的独有特性。

## 关键术语

| 术语 | 大家怎么说 | 实际含义 |
|------|----------------|------------------------|
| 路由网关（Routing gateway） | "LLM 代理" | 位于众多供应商之前的统一 API 接口层 |
| OpenAI 兼容（OpenAI-compatible） | "讲 OpenAI 模式" | 接受 `/v1/chat/completions` 形态，翻译到任意后端 |
| 模型别名（Model alias） | "our_smart_model" | 你代码中的名字，由网关映射到具体模型 |
| 回退链（Fallback chain） | "重试列表" | 失败时按序尝试的供应商有序列表 |
| 语义缓存（Semantic caching） | "提示词嵌入缓存" | 键为提示词的嵌入；近似重复者共享一次缓存命中 |
| 护栏（Guardrails） | "输入/输出过滤器" | 脱敏 PII，拒绝策略违规 |
| 按键限流（Per-key rate limit） | "团队预算" | 作用域限定到某个 API key 的配额 |
| 成本追踪（Cost tracking） | "按请求支出" | 聚合 token 用量 x 各模型单价 |
| LiteLLM | "那个开源代理" | 可自托管的开源路由网关 |
| OpenRouter | "那个托管 SaaS" | 采用额度计费的托管网关 |
| Portkey | "那个生产级选项" | 开源 + 托管，内建护栏 |

## 延伸阅读

- [LiteLLM — 文档](https://docs.litellm.ai/) —— 自托管路由网关
- [OpenRouter — 快速上手](https://openrouter.ai/docs/quickstart) —— 托管式路由 SaaS
- [Portkey — 文档](https://portkey.ai/docs) —— 带护栏的生产级路由
- [TrueFoundry — LiteLLM vs OpenRouter](https://www.truefoundry.com/blog/litellm-vs-openrouter) —— 选型指南
- [Relayplane — 2026 年 LLM 网关对比](https://relayplane.com/blog/llm-gateway-comparison-2026) —— 厂商综览
