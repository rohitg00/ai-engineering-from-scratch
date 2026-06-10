# 19 · AI 网关 —— LiteLLM、Portkey、Kong AI Gateway、Bifrost

> 一个网关（Gateway）坐落在你的应用与模型服务商之间。核心功能是服务商路由、降级回退、重试、限流、密钥引用、可观测性与护栏。2026 年的市场割据：**LiteLLM** —— MIT 开源,100+ 服务商,兼容 OpenAI,但在约 2000 RPS 时崩盘（8 GB 内存,已公布基准测试中出现级联故障）;最适合 Python、<500 RPS、开发/原型。**Portkey** —— 控制面定位（护栏、PII 脱敏、越狱检测、审计追踪）,2026 年 3 月开源为 Apache 2.0,延迟开销 20–40 ms,生产环境 $49/月。**Kong AI Gateway** —— 基于 Kong Gateway 构建,Kong 自身在同等 12 CPU 上的基准测试：比 Portkey 快 228%,比 LiteLLM 快 859%;按模型 $100/月定价（Plus 套餐最多 5 个模型）;适合已在使用 Kong 的企业场景。**Bifrost**（Maxim AI）——可配置退避的自动重试,在 OpenAI 返回 429 时降级至 Anthropic。**Cloudflare / Vercel AI Gateway** —— 托管、零运维、基础重试。数据驻留需求是决定自建与否的分水岭。Portkey 与 Kong 以开源+可选托管的方式居于中间地带。

**类型：** 学习
**语言：** Python
**前置：** Phase 17 · 01（托管 LLM 平台）,Phase 17 · 16（模型路由）
**时长：** 约 60 分钟

## 学习目标

- 列举网关六大核心功能：路由、回退、重试、限流、密钥、可观测性、护栏。
- 将 2026 年四大网关（LiteLLM、Portkey、Kong AI、Bifrost）映射到各自的规模上限与适用场景。
- 引用 Kong 基准测试结论（比 Portkey 快 228%,比 LiteLLM 快 859%）,并解释为什么在 >500 RPS 时它很重要。
- 在给定数据驻留要求与运维预算的前提下,在自建与托管之间做出选择。

## 问题所在

你的产品调用 OpenAI、Anthropic 和自建的 Llama。每家服务商有不同的 SDK、错误模型、限流策略与认证机制。你希望具备故障转移能力（如果 OpenAI 返回 429,就降级到 Anthropic）、一个统一的密钥仓库、统一的可观测性和按租户区分的限流策略。

把上述逻辑在应用层重新发明,将导致每一个服务都与每一家服务商耦合。而网关层把这一切整合进一个进程,对外暴露一个 API（通常兼容 OpenAI）,由该 API 将请求扇出到各家服务商。

## 核心概念

### 七大核心功能

1. **服务商路由** —— OpenAI、Anthropic、Gemini、自建推理等,统一在一个 API 背后。
2. **回退** —— 遇到 429、5xx 或质量失败时,将请求重试到其他服务商。
3. **重试** —— 指数退避,绑定尝试次数上限。
4. **限流** —— 按租户、按密钥、按模型粒度。
5. **密钥引用** —— 在运行时从保险库（Vault）拉取密钥（绝不出现在应用代码中）。
6. **可观测性** —— OTel + GenAI 属性（Phase 17 · 13）+ 成本归属。
7. **护栏** —— PII 脱敏、越狱检测、允许主题过滤。

### LiteLLM —— MIT 开源,Python

- 100+ 服务商,兼容 OpenAI,路由配置,回退,基础可观测性。
- 在 Kong 的基准测试中约 2000 RPS 崩盘;8 GB 内存占用,持续压力下出现级联故障。
- 最佳场景：Python 应用,<500 RPS,开发/预发布环境网关,实验性路由。
- 定价：开源为 $0;云端有免费层。

### Portkey —— 控制面定位

- 2026 年 3 月起以 Apache 2.0 开源。护栏、PII 脱敏、越狱检测、审计追踪。
- 每次请求延迟开销 20–40 ms。
- 生产环境 Tier $49/月,含数据留存与 SLA。
- 最佳场景：需要护栏 + 可观测性打包交付的受监管行业。

### Kong AI Gateway —— 规模化方案

- 基于 Kong Gateway（成熟的 API 网关产品,Lua + OpenResty）构建。
- Kong 在 12-CPU 等同环境下的基准测试：比 Portkey 快 228%,比 LiteLLM 快 859%。
- 定价：按模型 $100/月,Plus 套餐最多 5 个模型。
- 最佳场景：已在 Kong 生态中;>1000 RPS;意愿购买商业授权。

### Bifrost（Maxim AI）

- 可配置退避的自动重试。
- 经典写法：OpenAI 返回 429 时降级到 Anthropic。
- 较新的入场者;商业产品。

### Cloudflare AI Gateway / Vercel AI Gateway

- 托管,零运维。基础重试与可观测性。
- 最佳场景：运行在 Cloudflare/Vercel 上的边缘-JavaScript 应用。
- 在护栏与限流方面相比 Kong/Portkey 有所局限。

### 自建 vs 托管

数据驻留是关键决策因素。医疗与金融领域默认自建（LiteLLM 或 Portkey OSS 或 Kong）。消费者产品默认托管（Cloudflare AI Gateway）或中间方案（Portkey 托管）。混合模式：为受监管租户自建,为其他租户使用托管。

### 延迟开销预算

- LiteLLM：典型开销 5–15 ms。
- Portkey：20–40 ms。
- Kong：3–8 ms。
- Cloudflare/Vercel：1–3 ms（边缘优势）。

网关延迟直接叠加到 TTFT 上。如果 TTFT P99 < 100 ms SLA,选 Kong 或 Cloudflare。如果 P99 < 500 ms,任何一款都可以。

### 限流语义很重要

简单令牌桶（Token Bucket）在中低规模可用。多租户需要滑动窗口（Sliding Window）+ 突发余量 + 按租户分层。LiteLLM 默认提供令牌桶;Kong 提供滑动窗口;Portkey 提供分层限流。

### 网关 + 可观测性 + 路由的组合

Phase 17 · 13（可观测性）+ 16（模型路由）+ 19（网关）在生产环境中是同一层。选择一款同时覆盖这三者的工具,或细心串联它们：大多数 2026 年的生产部署组合使用 Helicone（可观测性）或 Portkey（护栏）搭配 Kong（规模）以拆分职责。

### 你应该记住的数字

- LiteLLM：约 2000 RPS 崩溃,8 GB 内存。
- Portkey：20–40 ms 开销;自 2026 年 3 月起为 Apache 2.0。
- Kong：比 Portkey 快 228%,比 LiteLLM 快 859%。
- Kong 定价：按模型 $100/月,Plus 套餐最多 5 个模型。
- Cloudflare/Vercel：边缘环境下延迟 1–3 ms。

## 实际运用

`code/main.py` 模拟了跨三家服务商的网关路由与回退,注入 429/5xx 故障。输出延迟、重试率和回退命中率。

## 交付成果

本课产出 `outputs/skill-gateway-picker.md`。给定规模、运维状态、合规与延迟预算,挑选合适的网关。

## 练习

1. 运行 `code/main.py`。配置从 OpenAI → Anthropic → 自建的回退链路。在 5% 服务商错误率下的预期命中率是多少？
2. 你的 SLA 要求 TTFT P99 < 200 ms,而基准延迟为 300 ms。哪些网关仍可满足预算约束？
3. 某医疗客户要求自建 + PII 脱敏 + 审计。选择 Portkey OSS 还是 Kong？
4. 对比 LiteLLM 与 Kong：在什么 RPS 临界点时团队应搬迁？
5. 为一个多租户 SaaS 设计限流策略：免费层、试用层、付费层。令牌桶还是滑动窗口？

## 关键术语

| 术语 | 人们常这么说 | 实际含义 |
|-|-|-|
| 网关（Gateway） | 「API 代理」 | 位于应用与服务商之间的进程 |
| LiteLLM | 「MIT 那个」 | Python 开源,100+ 服务商,2000 RPS 崩溃 |
| Portkey | 「护栏型网关」 | 控制面 + 可观测性,Apache 2.0 |
| Kong AI Gateway | 「规模化那个」 | 基于 Kong Gateway,基准测试领先 |
| Bifrost | 「Maxim 的网关」 | 重试 + Anthropic 回退公式 |
| Cloudflare AI Gateway | 「边缘托管」 | 边缘部署托管网关,零运维 |
| PII 脱敏 | 「数据擦除」 | 正则 + NER 遮挡,在模型看到之前 |
| 越狱检测 | 「提示注入防护」 | 对用户输入的分类器判断 |
| 审计追踪 | 「受监管日志」 | 每次 LLM 调用的不可变记录 |
| 令牌桶 | 「简单限流」 | 基于桶补充的限流器 |
| 滑动窗口 | 「精确限流」 | 时间窗口限流器;公平性更好 |

## 延伸阅读

- [Kong AI Gateway 基准测试](https://konghq.com/blog/engineering/ai-gateway-benchmark-kong-ai-gateway-portkey-litellm)
- [TrueFoundry——AI Gateway 2026 对比](https://www.truefoundry.com/blog/a-definitive-guide-to-ai-gateways-in-2026-competitive-landscape-comparison)
- [Techsy——2026 年顶级 LLM 网关工具](https://techsy.io/en/blog/best-llm-gateway-tools)
- [LiteLLM GitHub](https://github.com/BerriAI/litellm)
- [Portkey GitHub](https://github.com/Portkey-AI/gateway)
- [Kong AI Gateway 文档](https://docs.konghq.com/gateway/latest/ai-gateway/)
