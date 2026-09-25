# 批处理 API — 五折折扣作为行业标准

> 每个主要提供商都提供异步批处理 API，附带五折折扣和约 24 小时的完成时限。OpenAI、Anthropic、Google 以及大多数推理平台（Fireworks 批处理层级、Together 批处理）都实现了相同的模式。将批处理与提示缓存叠加，隔夜流水线的成本可降至同步未缓存成本的约 10%。规则非常简单：凡是交互性不强的任务，都应该放到批处理上。内容生成流水线、文档分类、数据提取、报告生成、批量标注、目录打标——任何能容忍 24 小时延迟的任务，在迁移到批处理之前都是在白白浪费钱。2026 年的生产模式是将每个新的 LLM 工作负载分流到三条通道：交互式（带缓存的同步）、半交互式（带回退的异步队列）、批处理（隔夜，叠加缓存输入）。那些伪装成交互式但实际能容忍数分钟延迟的工作负载，浪费最为严重。

**Type:** Learn
**Languages:** Python (stdlib, toy batch-vs-sync cost simulator)
**Prerequisites:** Phase 17 · 14 (Prompt & Semantic Caching)
**Time:** ~45 minutes

## 学习目标

- 说出三家提供商的批处理 API（OpenAI、Anthropic、Google），以及共同承诺的五折折扣 + 24 小时完成时限。
- 计算在隔夜分类工作负载上叠加批处理 + 缓存输入的成本，并与同步未缓存基线进行比较。
- 将工作负载分流为交互式 / 半交互式 / 批处理，并论证通道选择。
- 说出两个陷阱：部分交互性（用户期望快于 24 小时）和输出模式漂移（批处理文件格式因提供商而异）。

## 问题

你的团队上线了一个夜间报告生成流水线。50,000 份文档，逐份摘要，对摘要聚类，起草一份高管简报。同步运行需要 4 小时，成本 $2,000/晚。你听说了批处理 API。

批处理给你五折优惠。你还为系统提示启用了提示缓存（在全部 50k 次调用间共享）。叠加之后，账单降至 $180/晚——约为基线的 9%。同一条流水线，只改了三处配置。

批处理是 LLM 成本工具箱里最便宜却几乎没人使用的杠杆。原因主要是组织性的：团队以为 SLA 是“实时”，实际却是“明早之前”。这一课讲的就是如何不把 90% 的账单白白留在桌上。

## 概念

### 三种批处理 API

**OpenAI Batch API**：上传 JSONL 文件，包含一组请求。承诺 24 小时完成（实际通常约 2-8 小时）。输入和输出 token 五折。`/v1/batches` 端点。符合缓存条件的输入还可叠加缓存输入定价。

**Anthropic Message Batches**：JSONL 上传。24 小时完成。五折。支持 `cache_control`——缓存写入是显式的，读取在批处理内自动进行。

**Google Vertex AI Batch Prediction**：BigQuery 或 GCS 输入。Gemini 同样五折。与 Vertex 流水线集成。

### 语义：异步，而不是慢

批处理是“我承诺在 24 小时内返回”——而不是“这需要 24 小时”。典型 P50 是 2-6 小时。提供商在 GPU 资源利用率低的非高峰时段调度你的批处理。

### 与缓存叠加

一个 50k 文档摘要任务，共用同一个 4K token 的系统提示：

- 同步未缓存：50000 × ($input × 4000 + $输出 × 200)，按全价。
- 同步缓存：系统提示在首次写入后被缓存；其余 49999 次调用输入价格便宜 10 倍。
- 批处理 + 缓存：以上全部，再叠加读写均五折。

叠加效果：批处理 + 缓存 = 同步未缓存账单的约 10%。任何隔夜运行且共享系统提示的工作负载都应使用此方案。

### 工作负载分流

**交互式**——用户等待响应。TTFT 重要。使用带提示缓存的同步调用。不能批处理。

**半交互式**——用户提交任务，几分钟后回来查看。异步队列，批处理不可用时回退到同步。想象中等规模的 RAG 索引。

**批处理**——用户期望“明早之前”或“下一个小时”出结果。内容流水线、大规模分类、离线分析。永远用批处理，永远叠加缓存。

常见错误：仅仅因为流水线在生产环境运行，就把一切都归为交互式。生产环境不是延迟规格——SLA 才是。

### 部分交互性陷阱

有些功能看似交互式，但能容忍 5-10 分钟。例如：一个带“刷新”按钮的夜间客户健康报告。用户点击刷新，等 10 分钟没问题。团队却把它做成了同步。50 个并发刷新的成本是“批处理并通过邮件交付”方案的 10 倍。

要问的问题是：“24 小时对这个用户意味着什么？”如果答案是“他们不会注意到”，就批处理。

### 输出模式陷阱

批处理文件格式因提供商而异：

- OpenAI：JSONL，每行一个请求。
- Anthropic：JSONL，每行一条消息；响应格式内嵌。
- Vertex：BigQuery 表或带 TFRecord 的 GCS 前缀。

跨提供商编写“一个批处理客户端”意味着要为每个提供商写适配代码。宣称支持多提供商批处理的网关（Portkey、部分层级的 LiteLLM）也只是对原始格式的薄封装。

### 你应该记住的数字

- 各提供商的批处理折扣：输入 + 输出统一五折。
- 完成 SLA：保证 24 小时，典型 P50 为 2-6 小时。
- 叠加批处理 + 缓存输入：同步未缓存成本的约 10%。
- 工作负载分流规则：如果 24 小时延迟可接受，永远批处理。

```figure
batch-lane-triage
```

## 使用它

`code/main.py` 针对 50k 文档工作负载，计算同步、同步+缓存、批处理、批处理+缓存四种方案的成本。以美元和百分比报告节省额。

## 上线它

本课产出 `outputs/skill-batch-triager.md`。根据工作负载特征，分流为交互式/半交互式/批处理并估算节省额。

## 练习

1. 运行 `code/main.py`。对一个 100k 文档、3K token 系统提示、500 token 输出的流水线，计算全栈方案（批处理 + 缓存）相对同步基线的节省额。
2. 挑选你熟悉的一个真实产品中的三个功能，将每个分流为交互式/半交互式/批处理。
3. 一位用户抱怨他们的报告花了 3 小时。这是批处理分流失误，还是合理的交互式场景？写出判断标准。
4. 你的批处理 API 返回 SLA 是 24 小时，但 P99 是 20 小时。你如何向用户传达这一点——在这种边界情况下，下游系统应如何表现？
5. 计算盈亏平衡点：当共享前缀达到多长时，批处理 + 缓存比在自己预留的 GPU 上隔夜运行更便宜？

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|----------------|------------------------|
| Batch API | “异步折扣” | 五折，24 小时完成时限 |
| JSONL | “批处理格式” | 每行一个 JSON 请求；OpenAI/Anthropic 的标准 |
| Message Batches | “Anthropic 批处理” | Anthropic 批处理 API 的产品名 |
| Batch prediction | “Vertex 批处理” | Vertex AI 的批处理 API 产品 |
| Turnaround SLA | “24 小时承诺” | 是保证值，不是典型值；典型为 2-6 小时 |
| Workload triage | “交互性决策” | 交互式 / 半交互式 / 批处理的路由决策 |
| Output schema | “响应格式” | 因提供商而异的 JSONL 布局；不可移植 |
| Stacked discount | “批处理 + 缓存” | 两者叠加时约为同步未缓存账单的 10% |

## 延伸阅读

- [OpenAI Batch API](https://platform.openai.com/docs/guides/batch) — JSONL 格式与 `/v1/batches` 语义。
- [Anthropic Message Batches](https://docs.anthropic.com/en/docs/build-with-claude/batch-processing) — 批处理格式与 `cache_control` 的交互。
- [Vertex AI Batch Prediction](https://cloud.google.com/vertex-ai/generative-ai/docs/multimodal/batch-prediction-gemini) — Gemini 批处理语义。
- [Finout — OpenAI vs Anthropic API Pricing 2026](https://www.finout.io/blog/openai-vs-anthropic-api-pricing-comparison)
- [Zen Van Riel — LLM API Cost Comparison 2026](https://zenvanriel.com/ai-engineer-blog/llm-api-cost-comparison-2026/)