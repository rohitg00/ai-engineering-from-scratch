# Batch API —— 把 50% 折扣变成行业标准

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 几乎所有主流 provider 都提供异步 batch API：50% 折扣 + ~24 小时返回。OpenAI、Anthropic、Google，以及大部分 inference 平台（Fireworks 的 batch tier、Together 的 batch）都实现了同一套模式。把 batch 和 prompt caching 叠加起来，跑在隔夜流水线上，账单可以压到同步无缓存版本的 ~10%。规则非常残酷地简单：只要不是交互式的，就该上 batch。内容生成流水线、文档分类、数据抽取、报告生成、批量打标、商品目录打 tag——任何能容忍 24 小时延迟的工作负载，没搬到 batch 之前都是在白白烧钱。2026 年的生产模式是：把每一个新的 LLM 工作负载分成三档——interactive（带缓存的同步调用）、semi-interactive（异步队列，必要时回落到同步）、batch（隔夜跑，叠加 cached input）。那些假装自己是交互式、其实能容忍几分钟延迟的工作负载，浪费得最多。

**Type:** Learn
**Languages:** Python (stdlib, toy batch-vs-sync cost simulator)
**Prerequisites:** Phase 17 · 14 (Prompt & Semantic Caching)
**Time:** ~45 minutes

## 学习目标（Learning Objectives）

- 说出三家 provider 的 batch API（OpenAI、Anthropic、Google），以及它们共同的 50% 折扣 + 24 小时返回承诺。
- 计算「batch + cached-input」叠加在一个隔夜分类工作负载上的成本，并和同步无缓存基线对比。
- 把一个工作负载分到 interactive / semi-interactive / batch 中的某一档，并说明理由。
- 说出两个常见陷阱：partial interactivity（用户期望比 24 小时更快）以及 output-schema drift（每家 provider 的 batch 文件格式不一样）。

## 问题（The Problem）

你的团队上线了一个每晚跑的报告生成流水线。50,000 份文档，每份要做摘要，再对摘要做聚类，最后起草一份高管简报。同步跑要 4 小时，每晚 $2,000。然后你听说了 batch API。

batch 给你打 5 折。你顺手又给 system prompt（在所有 5 万次调用里共享）打开 prompt caching。两个一叠加，账单从 $2,000 掉到 $180/晚——大约是基线的 9%。流水线一行没动，只改了三处配置。

batch 是 LLM 成本工具箱里最便宜、却最少被人拉的那根杠杆。原因主要在组织层面：团队只要听到「生产环境」就脑补「实时」，而真正的 SLA 其实是「明早之前给我」。这一课讲的是：别再把 90% 的账单白白扔在桌上。

## 概念（The Concept）

### 三家的 batch API

**OpenAI Batch API**：上传一个 JSONL 文件，里面是一组请求。承诺 24 小时内返回（实际上通常 ~2–8 小时）。input 和 output token 都打 5 折。endpoint 是 `/v1/batches`。命中缓存的输入还会在此之上再叠加 cached-input 价格。

**Anthropic Message Batches**：JSONL 上传。24 小时返回。5 折。支持 `cache_control`——cache 写入是显式的，读则在 batch 内自动发生。

**Google Vertex AI Batch Prediction**：用 BigQuery 或 GCS 作为输入。Gemini 同样有 5 折。和 Vertex pipeline 集成。

### 语义：是异步，不是慢

batch 是「我承诺在 24 小时内返回」——不是「这玩意要跑 24 小时」。典型 P50 在 2–6 小时。provider 会把你的 batch 调度到 GPU 库存利用率不高的非高峰时段去跑。

### 和 caching 叠加

一个 5 万份文档的摘要任务，所有调用共享同一份 4K token 的 system prompt：

- 同步无缓存：50000 × ($input × 4000 + $output × 200)，全价。
- 同步带缓存：system prompt 在第一次写入后被缓存，剩余 49999 次的 input 便宜 10 倍。
- batch + 缓存：上面两条全部生效，再加 input/output 都打 5 折。

叠起来：batch + cache ≈ 同步无缓存账单的 ~10%。任何隔夜跑、且共享 system prompt 的工作负载，都该用这套组合。

### 工作负载分档（workload triage）

**Interactive**——用户在等返回。TTFT（首 token 延迟）很关键。同步调用 + prompt caching。不能 batch。

**Semi-interactive**——用户提交任务，几分钟后回来看结果。异步队列；如果 batch 不可用就回落到同步。比如中等吞吐的 RAG 索引。

**Batch**——用户预期「明早出」或「下个钟头出」。内容流水线、大规模分类、离线分析。永远走 batch，永远叠加 caching。

常见错误：因为流水线是生产环境，就把所有任务都分进 interactive。生产环境不是延迟规格——SLA 才是。

### partial-interactivity 陷阱

有些功能看起来是交互式的，其实能容忍 5–10 分钟。比如：每晚生成的「客户健康度」报告，带一个「刷新」按钮。用户点刷新，等 10 分钟完全没问题。团队却把它做成了同步调用。50 次并发刷新的成本，是「batch 跑完邮件送达」方案的 10 倍。

要问的问题是：「对这个用户来说，24 小时意味着什么？」如果答案是「他根本不会察觉」，那就 batch。

### output-schema 陷阱

每家 provider 的 batch 文件格式都不一样：

- OpenAI：JSONL，每行一个请求。
- Anthropic：JSONL，每行一条 message；响应格式嵌入其中。
- Vertex：BigQuery 表，或 GCS 前缀下的 TFRecord。

想写「一个跨 provider 的 batch 客户端」，意味着每个 provider 都得有适配代码。那些声称跨 provider batch 的网关（Portkey、LiteLLM 的某些档位）也只是对原生格式做薄封装。

### 该记住的几个数字

- 各家 provider 的 batch 折扣：input + output 一律 5 折。
- 返回 SLA：保证 24 小时，典型 P50 是 2–6 小时。
- batch + cached input 叠加后：约为同步无缓存成本的 ~10%。
- 工作负载分档规则：只要能接受 24 小时延迟，就永远走 batch。

## 用起来（Use It）

`code/main.py` 在一个 5 万份文档的工作负载上，分别计算 sync、sync+cache、batch、batch+cache 四种模式的成本。报告里同时给出节省金额（$）和节省比例。

## 上线部署（Ship It）

本课产出 `outputs/skill-batch-triager.md`。给定一组工作负载特征，它会把任务分到 interactive / semi / batch，并估算节省金额。

## 练习（Exercises）

1. 跑一遍 `code/main.py`。对一个 10 万份文档、3K token system prompt、500 token 输出的流水线，算出「batch + cache」全套叠加 vs 同步基线能省多少。
2. 挑你熟悉的某个真实产品里的三个功能。把每一个分到 interactive / semi / batch。
3. 一个用户抱怨他的报告跑了 3 小时。这是 batch 分档错了，还是它本来就该是 interactive？写下你的判断准则。
4. 你的 batch API 返回 SLA 是 24 小时，但 P99 是 20 小时。你怎么向用户沟通这件事——边界情况下下游系统应该有什么行为？
5. 算盈亏平衡点：共享前缀长度达到多少时，「batch + cache」会比用你自己预留的 GPU 隔夜跑更便宜？

## 关键术语（Key Terms）

| 术语 | 大家嘴上怎么说 | 实际意思 |
|------|----------------|------------------------|
| Batch API | 「异步折扣」 | 5 折 + 24 小时返回 |
| JSONL | 「batch 格式」 | 每行一个 JSON 请求；OpenAI/Anthropic 的标准 |
| Message Batches | 「Anthropic batch」 | Anthropic batch API 的产品名 |
| Batch prediction | 「Vertex batch」 | Vertex AI 的 batch API 产品 |
| Turnaround SLA | 「24 小时承诺」 | 是保证值，不是典型值；典型是 2–6 小时 |
| Workload triage | 「交互性决策」 | interactive / semi / batch 的分档决策 |
| Output schema | 「响应格式」 | 每家 provider 的 JSONL 布局；不可移植 |
| Stacked discount | 「batch + cache」 | 两者同时生效时，约为同步无缓存账单的 ~10% |

## 延伸阅读（Further Reading）

- [OpenAI Batch API](https://platform.openai.com/docs/guides/batch) —— JSONL 格式和 `/v1/batches` 语义。
- [Anthropic Message Batches](https://docs.anthropic.com/en/docs/build-with-claude/batch-processing) —— batch 格式以及与 `cache_control` 的交互。
- [Vertex AI Batch Prediction](https://cloud.google.com/vertex-ai/generative-ai/docs/model-reference/batch-prediction) —— Gemini 的 batch 语义。
- [Finout —— OpenAI vs Anthropic API Pricing 2026](https://www.finout.io/blog/openai-vs-anthropic-api-pricing-comparison)
- [Zen Van Riel —— LLM API Cost Comparison 2026](https://zenvanriel.com/ai-engineer-blog/llm-api-cost-comparison-2026/)
