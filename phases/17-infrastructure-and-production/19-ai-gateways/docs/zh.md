# AI Gateway —— LiteLLM、Portkey、Kong AI Gateway、Bifrost

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> Gateway 坐落在你的 app 和模型 provider 之间。核心能力：provider 路由、fallback、retry、限流、密钥引用、可观测性、guardrail（护栏）。2026 年市场格局：**LiteLLM** 是 MIT 开源、支持 100+ provider、OpenAI 兼容，但在 ~2000 RPS 处会崩溃（8 GB 内存占用，公开 benchmark 显示出现级联故障）；最适合 Python、<500 RPS、开发 / 原型场景。**Portkey** 走控制面定位（guardrail、PII 脱敏、jailbreak 检测、审计日志），2026 年 3 月转为 Apache 2.0 开源，单请求 20–40 ms 延迟开销，生产档 $49/月。**Kong AI Gateway** 基于 Kong Gateway 构建——Kong 自家在同样 12 CPU 上的 benchmark：比 Portkey 快 228%，比 LiteLLM 快 859%；定价 $100/模型/月（Plus 档最多 5 个模型）；如果你已经在用 Kong，是企业级首选。**Bifrost**（Maxim AI）—— 自动 retry，可配置 backoff，OpenAI 429 时 fallback 到 Anthropic。**Cloudflare / Vercel AI Gateway** —— 托管型、零运维、基础 retry。是否自托管由数据驻留要求决定；Portkey 和 Kong 处于中间地带，提供 OSS + 可选托管。

**Type:** Learn
**Languages:** Python（标准库，玩具级 gateway 路由模拟器）
**Prerequisites:** Phase 17 · 01（Managed LLM Platforms）、Phase 17 · 16（Model Routing）
**Time:** ~60 分钟

## 学习目标（Learning Objectives）

- 列出 gateway 的六大核心能力（路由、fallback、retry、限流、密钥、可观测性、guardrail）。
- 把 2026 年的四个 gateway（LiteLLM、Portkey、Kong AI、Bifrost）映射到各自的规模上限和适用场景。
- 引用 Kong benchmark（比 Portkey 快 228%，比 LiteLLM 快 859%），解释为什么这对 >500 RPS 的场景至关重要。
- 在数据驻留要求和运维预算给定时，选择自托管还是托管。

## 问题（The Problem）

你的产品同时调用 OpenAI、Anthropic、还有自托管的 Llama。每个 provider 的 SDK、错误模型、限流策略、鉴权方式都不一样。你想要：故障切换（OpenAI 429 时尝试 Anthropic）、统一的凭据存储、统一的可观测性、按 tenant 的限流。

如果在 app 层把这些重新发明一遍，每个服务都会和每个 provider 耦合。Gateway 层把它们合并到一个进程里、对外暴露一套 API（通常是 OpenAI 兼容），再扇出到各 provider。

## 概念（The Concept）

### 六大核心能力（Six core features）

1. **Provider 路由** —— OpenAI、Anthropic、Gemini、自托管等等都藏在一套 API 后面。
2. **Fallback** —— 遇到 429、5xx 或质量不过关时换一家重试。
3. **Retry** —— 指数 backoff，限定次数。
4. **限流** —— 按 tenant、按 key、按模型分别限。
5. **密钥引用** —— 运行时从 vault 拉凭据（绝不写进 app）。
6. **可观测性** —— OTel + GenAI 属性（Phase 17 · 13）+ 成本归因。
7. **Guardrail** —— PII 脱敏、jailbreak 检测、允许话题过滤。

### LiteLLM —— MIT 开源、Python

- 100+ provider，OpenAI 兼容，router 配置、fallback、基础可观测性。
- 在 Kong 的 benchmark 里 ~2000 RPS 处崩溃；8 GB 内存占用，持续负载下出现级联故障。
- 最佳场景：Python app、<500 RPS、开发 / 预发 gateway、实验性路由。
- 成本：开源 $0；云版有免费档。

### Portkey —— 控制面定位

- 2026 年 3 月起 Apache 2.0 开源。Guardrail、PII 脱敏、jailbreak 检测、审计日志。
- 单请求 20–40 ms 延迟开销。
- 生产档 $49/月，含数据保留 + SLA。
- 最佳场景：受监管行业，需要 guardrail + 可观测性打包。

### Kong AI Gateway —— 拼规模那一档

- 基于 Kong Gateway 构建（成熟的 API gateway 产品，lua + OpenResty）。
- Kong 自家在 12 CPU 等价配置上的 benchmark：比 Portkey 快 228%，比 LiteLLM 快 859%。
- 定价：$100/模型/月，Plus 档最多 5 个模型。
- 最佳场景：已经在用 Kong；>1000 RPS；愿意付 license。

### Bifrost（Maxim AI）

- 自动 retry，可配置 backoff。
- OpenAI 429 时 fallback 到 Anthropic 是经典 recipe（配方）。
- 较新的玩家；商业产品。

### Cloudflare AI Gateway / Vercel AI Gateway

- 托管型、零运维。基础 retry 和可观测性。
- 最佳场景：跑在 Cloudflare / Vercel 边缘的 JavaScript app。
- 在 guardrail 和限流上比 Kong / Portkey 弱不少。

### 自托管 vs 托管（Self-hosted vs managed）

数据驻留要求是决定性因素。医疗和金融默认自托管（LiteLLM、Portkey OSS 或 Kong）。消费类产品默认走托管（Cloudflare AI Gateway）或中间档（Portkey 托管版）。混合模式：受监管的 tenant 走自托管，其余走托管。

### 延迟预算（Latency budget）

- LiteLLM：典型 5–15 ms 开销。
- Portkey：20–40 ms 开销。
- Kong：3–8 ms 开销。
- Cloudflare / Vercel：1–3 ms 开销（边缘优势）。

Gateway 的延迟直接加在 TTFT 上。如果 TTFT P99 SLA < 100 ms，选 Kong 或 Cloudflare。P99 < 500 ms 的话怎么选都行。

### 限流语义很关键（Rate-limit semantics matter）

简单的 token-bucket 在中等规模够用。多 tenant 场景需要 sliding-window + burst 容量 + 按 tenant 分档。LiteLLM 出厂用 token-bucket；Kong 出厂用 sliding-window；Portkey 出厂用分档限流。

### Gateway + 可观测性 + 路由 是同一层（Gateway + observability + routing compose）

Phase 17 · 13（可观测性）+ 16（model routing）+ 19（gateway）在生产里就是同一层。要么挑一个工具把三件事一起做掉，要么把它们仔细串起来：2026 年大多数部署的组合是 Helicone（可观测性）或 Portkey（guardrail）+ Kong（拼规模），各司其职。

### 你应该记住的几个数字（Numbers you should remember）

- LiteLLM：~2000 RPS 处崩溃，8 GB 内存。
- Portkey：20–40 ms 开销；2026 年 3 月起 Apache 2.0。
- Kong：比 Portkey 快 228%，比 LiteLLM 快 859%。
- Kong 定价：$100/模型/月，Plus 档最多 5 个。
- Cloudflare / Vercel：边缘 1–3 ms 开销。

## 用起来（Use It）

`code/main.py` 在注入 429 / 5xx 错误的条件下，模拟 3 个 provider 的 gateway 路由 + fallback。报告延迟、retry 比例、fallback 命中率。

## 上线部署（Ship It）

本节产出 `outputs/skill-gateway-picker.md`。给定规模、运维姿态、合规要求、延迟预算，挑出一个 gateway。

## 练习（Exercises）

1. 跑一遍 `code/main.py`。配置 OpenAI → Anthropic → 自托管 的 fallback 链。在 5% provider 错误率下，期望命中率是多少？
2. 你的 SLA 是 TTFT P99 < 200 ms，基线是 300 ms。哪些 gateway 还在预算里？
3. 一个医疗客户要求自托管 + PII 脱敏 + 审计。在 Portkey OSS 和 Kong 之间选一个。
4. 对比 LiteLLM 和 Kong：到了多少 RPS 上限时团队应该迁移？
5. 给一个多 tenant SaaS 设计限流策略：免费档、试用档、付费档。用 token-bucket 还是 sliding-window？

## 关键术语（Key Terms）

| 术语 | 大家口头怎么说 | 实际指什么 |
|------|----------------|------------|
| Gateway | "API broker" | 坐在 app 和 provider 之间的进程 |
| LiteLLM | "那个 MIT 的" | Python OSS，100+ provider，~2K RPS 处崩溃 |
| Portkey | "做 guardrail 那个" | 控制面 + 可观测性，Apache 2.0 |
| Kong AI Gateway | "拼规模那个" | 基于 Kong Gateway 构建，benchmark 领跑 |
| Bifrost | "Maxim 那个 gateway" | Retry + Anthropic fallback recipe |
| Cloudflare AI Gateway | "边缘托管" | 边缘部署的托管 gateway，零运维 |
| PII redaction | "数据擦洗" | 调模型前用正则 + NER 打码 |
| Jailbreak detection | "prompt 注入防护" | 在用户输入上跑分类器 |
| Audit trail | "合规日志" | 每一次 LLM 调用的不可变记录 |
| Token-bucket | "简单限流" | 基于补充 token 的限流器 |
| Sliding-window | "精确限流" | 时间窗口限流器；公平性更好 |

## 延伸阅读（Further Reading）

- [Kong AI Gateway Benchmark](https://konghq.com/blog/engineering/ai-gateway-benchmark-kong-ai-gateway-portkey-litellm)
- [TrueFoundry — AI Gateways 2026 Comparison](https://www.truefoundry.com/blog/a-definitive-guide-to-ai-gateways-in-2026-competitive-landscape-comparison)
- [Techsy — Top LLM Gateway Tools 2026](https://techsy.io/en/blog/best-llm-gateway-tools)
- [LiteLLM GitHub](https://github.com/BerriAI/litellm)
- [Portkey GitHub](https://github.com/Portkey-AI/gateway)
- [Kong AI Gateway docs](https://docs.konghq.com/gateway/latest/ai-gateway/)
