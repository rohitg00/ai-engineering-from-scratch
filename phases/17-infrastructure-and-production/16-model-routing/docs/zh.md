# 模型路由作为降本原语（Model Routing as a Cost-Reduction Primitive）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 一个动态 broker 评估每个请求（任务类型、token 长度、embedding 相似度、置信度），把简单的问题送给便宜模型，把复杂的升级到 frontier 模型。也叫 model cascading（模型级联）。生产案例显示在 US/UK/EU 部署中可在等质量条件下降本 20-60%；高流量 SaaS 上 30% 的路由效率提升能换来六位数年度节省。2026 年的背景是 LLM inference（推理）价格每年降约 10 倍——一个 GPT-4 级别的 token 价从 2022 年底的 $20/M 跌到 2026 年的约 $0.40/M。降幅大头来自更好的 serving stack（参见 Phase 17 · 04-09），而不是硬件。Routing 就是把这波降价转化为利润而不让产品退化的方式。失败模式是 cheap-model drift（便宜模型漂移）：路由把 40% 的流量推到弱模型，推理类任务质量掉了 3-5%，结果一个季度都没人注意到。要用线上质量指标卡住路由，而不是仅靠离线评测集。

**Type:** Learn
**Languages:** Python (stdlib, toy cascading router simulator)
**Prerequisites:** Phase 17 · 01 (Managed LLM Platforms), Phase 17 · 19 (AI Gateways)
**Time:** ~60 minutes

## 学习目标（Learning Objectives）

- 解释 model cascading：先便宜跑、做置信度检查、低置信就升级。
- 列出四个路由信号（任务分类、prompt 长度、与 known-hard 集合的 embedding 相似度、首轮自置信度）。
- 在目标路由切分和质量损失容忍下，计算预期混合成本。
- 说出能抓到 cheap-model creep（便宜模型蔓延）的漂移监控指标（线上质量门）。

## 问题（The Problem）

你的服务每月在 GPT-5 上烧掉 $80k。analytics 显示 70% 的查询是简单的：「巴黎现在几点？」「帮我把这句话改写一下。」一个 Haiku 级别的模型能完美处理这些，成本只有 3%。30% 才真正需要 GPT-5 的推理能力——写代码、数学、多步规划。

如果你把 70% 路由到便宜模型，30% 给贵的，账单大概能降 65%，产品质量不变。这就是 routing。诀窍在于构建 broker 时不让质量回退。

## 概念（The Concept）

### 四个路由信号（Four routing signals）

1. **任务分类（Task classification）**：simple/complex/codegen/math/chat。可以是基于规则的分类器，可以是个小 LLM（Haiku 级别 $0.25/M），也可以是与已标注桶的 embedding 相似度。输出：route = cheap / balanced / frontier。

2. **Prompt 长度**：超过 4K token 的 prompt 通常需要 frontier 来保持连贯。低于 500 token 的通常不需要。

3. **与 known-hard 集合的 embedding 相似度**：如果查询与一个已知困难桶很接近（cosine > 0.88），直接升级到 frontier。

4. **首轮自置信度（Self-confidence from first-pass）**：先发给便宜模型；如果模型 log-probs 显示低置信度、或拒答、或输出含糊措辞，就在 frontier 上重试。这会在 ~10% 的流量上增加 P95 延迟（latency），但在另外 90% 上节省 50% 以上。

### 三种模式（Three patterns）

**Pre-route**（前置分类器）：增加约 5-10ms 延迟；整体最快。

**Cascade**（先便宜、低置信升级）：median 延迟约 1.2 倍（便宜跑加验证），升级时约 2 倍。质量下限最稳。

**Ensemble route**（对样本并行跑便宜和 frontier，由 reward-model 挑选）：质量最高，成本最高；只在关键 A/B 时使用。

### 实现（Implementation）

AI gateway（参见 Phase 17 · 19）暴露了 routing 能力。LiteLLM 有带 fallback 和 cost-routing 的 `router` 配置。Portkey 有 guard + 路由。Kong AI Gateway 走插件式路由。OpenRouter 的模型市场暴露了一个推荐 API。

开源方案：RouteLLM（LMSYS）、Not Diamond（商用）、Prompt Mule。

### 2026 价格曲线（The 2026 price curve）

| Model class | Late 2022 | 2026 | Change |
|-------------|-----------|------|--------|
| GPT-4-level quality | ~$20/M | ~$0.40/M | 50x cheaper |
| Frontier (GPT-5, Claude 4) | — | ~$3-10/M | new tier |

改进的大头是 serving 效率——Phase 17 · 04-09 的核心课程，最终都体现成了 provider 端的成本下降。Routing 让你在 app 层把这些收益吃下，而不是被动等所有用户都迁到便宜档位。

### 真正的风险是 drift（Drift is the real risk）

你的路由把 40% 送到便宜模型。半年后任务分布变了（用户变得更老练，问题更长）。路由器没有察觉，因为它的分类器是用 Q1 数据训的。质量在悄悄下滑。没人投诉得够大声。最后是在一次竞品基准里你才发现自己输了。

要用线上质量指标卡路由：

- 每条路由的 thumbs-up / thumbs-down。
- 每条路由 5% 抽样跑自动 LLM-judge。
- 升级率：如果 cascade 的上调率（uprouted）超过 30%，说明便宜模型被过度路由了。
- 每条路由的拒答率。

### 该记住的数字（Numbers you should remember）

- 2026 等质量 routing 节省：案例研究 20-60%。
- 2022-2026 LLM 价格下降：每年总共约 10 倍。
- GPT-4 级别 2022 vs 2026：$20/M → ~$0.40/M。
- Cascade 延迟影响：median 约 1.2 倍，升级流量约 2 倍（~10% 的流量）。

## 用起来（Use It）

`code/main.py` 在混合工作负载上模拟 pre-route、cascade 和 ensemble。报告混合成本、质量损失和升级率。

## 上线部署（Ship It）

这节产出 `outputs/skill-router-plan.md`。给定工作负载和质量预算，挑选一种 routing 模式和信号。

## 练习（Exercises）

1. 跑一下 `code/main.py`。在哪个准确度下限上 cascade 会胜过 pre-route？
2. 你的用户群 30% 是企业用户（复杂查询），70% 是免费档（简单）。设计路由切分。用哪个线上指标来卡？
3. 一条路由质量掉 2%，但成本省 40%。能不能上？看产品而定——双方各论证一遍。
4. 用 OpenAI / Anthropic API 的 logprobs 实现一个置信度检查。你最初定的阈值是多少？
5. 半年内升级率从 8% 爬到 22%。诊断三种成因，并各给一个修复方案。

## 关键术语（Key Terms）

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Model routing | "cost broker" | Dynamic choice of model per request |
| Model cascade | "cheap-first escalate" | Run cheap, fall through to frontier on low confidence |
| Pre-route | "classify first" | Classifier up front; no re-run |
| Ensemble route | "parallel pick" | Run multiple, reward-model picks best |
| Escalation rate | "uprouted %" | Fraction of cascade requests that escalated |
| RouteLLM | "LMSYS router" | OSS router library |
| Not Diamond | "commercial router" | SaaS model-routing product |
| Drift | "cheap creep" | Distribution shift without router noticing |
| Online quality gate | "live check" | Automated LLM-judge sampling live traffic |

## 延伸阅读（Further Reading）

- [AbhyashSuchi — Model Routing LLM 2026 Best Practices](https://abhyashsuchi.in/model-routing-llm-2026-best-practices/)
- [Lukas Brunner — Rise of Inference Optimization 2026](https://dev.to/lukas_brunner/the-rise-of-inference-optimization-the-real-llm-infra-trend-shaping-2026-4e4o)
- [RouteLLM paper / code](https://github.com/lm-sys/RouteLLM)
- [Not Diamond — model routing](https://www.notdiamond.ai/)
- [OpenRouter](https://openrouter.ai/) — multi-model gateway with routing primitives.
