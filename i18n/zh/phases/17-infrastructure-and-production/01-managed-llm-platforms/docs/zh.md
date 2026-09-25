# 托管型 LLM 平台 — Bedrock、Vertex AI、Azure OpenAI

> 三家超大规模云厂商，三种截然不同的策略。AWS Bedrock 是一个模型市场 — Claude、Llama、Titan、Stability、Cohere 背后使用同一个 API。Azure OpenAI 是 OpenAI 的独家合作，并附带用于专用容量的预置吞吐量单位（PTU）。Vertex AI 以 Gemini 为先，在长上下文和多模态方面表现最佳。2026 年，Artificial Analysis 在 Llama 3.1 405B 等效模型上测得 Azure OpenAI 中位延迟约 50 ms，Bedrock 约 75 ms — 差距的原因在于 PTU，因为专用容量优于共享按需容量。决策原则不是“哪个最快”，而是“哪个模型目录和 FinOps 归因体系与我的产品匹配”。本课教你如何在权衡写清楚的前提下做出选择，而不是凭感觉。

**Type:** Learn
**Languages:** Python（标准库，简化的成本与延迟对比器）
**Prerequisites:** Phase 11（LLM 工程），Phase 13（工具与协议）
**Time:** 约 60 分钟

## 学习目标

- 说出三种平台策略（市场型 vs 独家型 vs Gemini 优先），并将每种策略对应到一个产品用例。
- 解释在 Azure OpenAI 中预置吞吐量单位（PTU）能带来什么，以及为什么在 405B 规模下按需 Bedrock 通常慢约 25 ms。
- 绘制每个平台的 FinOps 归因体系图（Bedrock Application Inference Profiles vs Vertex 每团队一个项目 vs Azure scope + PTU 预留）。
- 写下"至少双供应商"策略，并解释为什么单一供应商锁定是 2026 年代价高昂的错误。

## 问题

你为产品选择了 Claude 3.7 Sonnet。现在你需要部署它。你可以直接调用 Anthropic API，也可以通过 AWS Bedrock 调用，或者经由一个网关。直接 API 最简单；Bedrock 增加了 BAA、VPC 端点、IAM 和 CloudWatch 归因。网关增加了故障切换、统一计费以及跨供应商的速率限制。

更深层次的问题是模型目录。如果你需要在同一个产品中同时使用 Claude、Llama 和 Gemini，除非同时使用 Bedrock 加 Vertex 加 Azure OpenAI，否则无法从单一渠道全部买到。这些超大规模厂商不可互换 — 它们各自对“谁来拥有模型层”下了不同的赌注。

本课梳理这三种赌注、延迟差距、FinOps 差距以及锁定风险。

## 概念

### 三种策略

**AWS Bedrock** — 市场。Claude（Anthropic）、Llama（Meta）、Titan（AWS 自研）、Stability（图像）、Cohere（嵌入）、Mistral，以及图像和嵌入子目录。一个 API、一个 IAM 体系、一个 CloudWatch 导出。Bedrock 的赌注是：客户想要的选项多样性超过对单一模型的需求。

**Azure OpenAI** — 独家合作。你可以在 Azure 数据中心获得 GPT-4 / 4o / 5 / o 系列、DALL·E、Whisper，以及 OpenAI 模型的微调。"Azure OpenAI Service"目录中没有非 OpenAI 模型 — 那些模型属于 Azure AI Foundry（独立产品）。Azure 的赌注是：OpenAI 依然是前沿，客户希望在这一特定关系上获得企业级管控。

**Vertex AI** — Gemini 优先，其余靠后。Gemini 1.5 / 2.0 / 2.5 Flash 和 Pro，外加 Model Garden（第三方）。Vertex 的赌注是多模态长上下文 — 1M token 的 Gemini 上下文是其差异化优势。

### 大规模下的延迟差距

Artificial Analysis 持续运行基准测试。在等效的 Llama 3.1 405B 部署上（共享按需容量），Azure OpenAI 中位首 token 延迟约为 50 ms；Bedrock 约为 75 ms。这个差距并非 AWS 的失败 — 而是容量模型的差异。Azure 出售 PTU（预置吞吐量单位），为你的租户预留 GPU 容量。Bedrock 的对应产品（Provisioned Throughput）存在，但起价约为每单位每小时 $21，大多数客户仍使用共享按需容量。

按需共享容量要与所有其他客户的流量竞争。专用容量则不用。如果你的产品 SLA 要求 P99 的 TTFT < 100 ms，你要么在 Azure 上购买 PTU，要么购买 Bedrock Provisioned Throughput，要么接受默认的波动。

### 预置吞吐量的经济学

Azure PTU：一块预留的推理计算资源。对于可预测的工作负载，相比按需可节省多达约 70%。无论流量如何，按小时固定计费 — 即使闲置也要为预留付费。盈亏平衡点通常在 40-60% 的持续利用率左右。

Bedrock Provisioned Throughput：$21-$50/小时，取决于模型和区域。类似的数学计算 — 盈亏平衡点约为峰值利用率的一半。需要按月承诺。

Vertex 的预置容量按 Gemini SKU 出售；定价因模型和区域而异，公开宣传较少。

### FinOps 体系 — 真正的差异化因素

**Bedrock Application Inference Profiles** 是市场中目前最清晰的归因方式。给一个 profile 打上 `team`、`product`、`feature` 标签；将所有模型调用经由它路由；CloudWatch 无需后处理即可按 profile 分解成本。2025 年推出，仍是超大规模厂商原生方案中粒度最细的。

**Vertex** 的归因是每团队一个项目加上随处打标签。你将每个团队建模为一个 GCP 项目，为每个资源打标签，并使用 BigQuery Billing Export + DataStudio 进行汇总。工作量更大，但 BigQuery 让你可以对成本数据运行任意 SQL。

**Azure** 依赖订阅/资源组 scope 加标签，PTU 预留是一等成本对象。标签继承自资源组而非请求，因此按请求归因需要 Application Insights 自定义指标或一个能加盖标头的网关。

规律：Bedrock 原生最干净，Vertex 通过 BigQuery 最灵活，Azure 除非你自行埋点，否则最不透明。

### 锁定是 2026 年的风险

在单一模型占主导地位时，绑定单一超大规模厂商没问题。在 2026 年，前沿模型按月更新 — 上个季度是 Claude 3.7，下个季度是 Gemini 2.5，再下个季度是 GPT-5。锁定一个平台，就意味着被排除在三分之二的前沿之外。

高效团队采用的规律是：任何产品关键的 LLM 调用至少使用两家供应商。Bedrock 加 Azure OpenAI 是常见组合 — Claude 来自一家，GPT 来自另一家，两者之间故障切换，共用同一个网关。由于网关会路由到最优选项，成本提升可以忽略不计；而在宕机期间（如 2025 年 1 月的 Azure OpenAI 事故、AWS us-east-1 宕机事件）带来的可用性提升则是决定性的。

### 数据驻留、BAA 与受监管行业

Bedrock：大多数区域提供 BAA；VPC 端点；guardrails。常见的金融科技默认选择。
Azure OpenAI：HIPAA、SOC 2、ISO 27001；EU 数据驻留；受监管企业的默认选择。
Vertex：HIPAA、GDPR、按区域数据驻留；Google Cloud 的合规体系。

三者都满足基本要求。差异在于数据保留策略、日志处理方式，以及滥用监控是否会读取你的流量（多数默认开启；企业客户可选择退出）。

### 你应该记住的数字

- Azure OpenAI 在 Llama 3.1 405B 等效模型上的中位 TTFT：约 50 ms（使用 PTU）。
- Bedrock 按需中位 TTFT：约 75 ms。
- Bedrock Provisioned Throughput：每单位 $21-$50/小时。
- Azure PTU 盈亏平衡：约 40-60% 的持续利用率。
- 高利用率下 PTU 相比按需的节省：最高 70%。

```figure
i4-platform-lanes
```

## 动手使用

`code/main.py` 在合成工作负载上对比三个平台 — 它模拟按需与 PTU 的经济学、TTFT 波动以及成本归因的保真度。运行它，观察 PTU 在哪里划算，以及市场的模型广度在何处足以弥补 TTFT 差距。

## 交付成果

本课产出 `outputs/skill-managed-platform-picker.md`。给定一个工作负载画像（所需模型、TTFT SLA、日调用量、合规要求），它会推荐一个主平台、一个备选平台以及一份 FinOps 埋点方案。

## 练习

1. 运行 `code/main.py`。对于一个 70B 级别的模型，Azure PTU 在什么持续利用率下优于按需？计算盈亏平衡点，并与宣传的 40-60% 区间进行比较。
2. 你的产品需要 Claude 3.7 Sonnet 和 GPT-4o。设计一个双供应商部署 — 哪个模型放在哪家超大规模厂商上，前面放什么网关，故障切换策略是什么？
3. 一位受监管的医疗客户要求 BAA、US-East 数据驻留和低于 100ms 的 P99 TTFT。选择一个平台，并用三个具体特性说明理由。
4. 你发现 Bedrock 账单本月上涨了 4 倍，而流量没有变化。在没有 Application Inference Profiles 的情况下，你如何找到原因？有 profiles 时需要多长时间？
5. 阅读 Azure OpenAI 和 Bedrock 的定价页面。对于一个每月 1 亿 token 的 Claude 工作负载，哪个更便宜 — 直接使用 Anthropic API、Bedrock 按需，还是 Bedrock Provisioned Throughput？

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|------------------------|
| Bedrock | "AWS 的 LLM 服务" | 涵盖 Claude、Llama、Titan、Mistral、Cohere 的模型市场 |
| Azure OpenAI | "Azure 版 ChatGPT" | Azure 数据中心中的独家 OpenAI 模型，附带企业级管控 |
| Vertex AI | "Google 的 LLM" | 以 Gemini 为先的平台，附带用于第三方模型的 Model Garden |
| PTU | "专用容量" | Provisioned Throughput Unit — 预留的推理 GPU，按小时计价 |
| Application Inference Profile | "Bedrock 标签" | 带标签的按产品成本/用量 profile，CloudWatch 原生 |
| Model Garden | "Vertex 目录" | Vertex AI 的第三方模型专区，独立于 Gemini |
| 双供应商最低要求 | "LLM 冗余" | 将每条关键 LLM 路径运行在至少 2 家超大规模厂商上的策略 |
| BAA | "HIPAA 文件" | Business Associate Agreement；处理 PHI 所必需；三家均提供 |
| 滥用监控 | "日志监视器" | 供应商侧对提示词/输出的安全扫描；企业客户可选择退出 |

## 延伸阅读

- [AWS Bedrock Pricing](https://aws.amazon.com/bedrock/pricing/) — 权威费率表及 Provisioned Throughput 定价。
- [Azure OpenAI Service Pricing](https://azure.microsoft.com/en-us/pricing/details/azure-openai/) — PTU 经济学与费率表。
- [Vertex AI Generative AI Pricing](https://cloud.google.com/vertex-ai/generative-ai/pricing) — Gemini 各层级与 Model Garden 附加费。
- [Artificial Analysis LLM Leaderboard](https://artificialanalysis.ai/) — 跨供应商的持续延迟与吞吐量基准测试。
- [The AI Journal — AWS Bedrock vs Azure OpenAI CTO Guide 2026](https://theaijournal.co/2026/03/aws-bedrock-vs-azure-openai/) — 企业决策框架。
- [Finout — Bedrock vs Vertex vs Azure FinOps](https://www.finout.io/blog/bedrock-vs.-vertex-vs.-azure-cognitive-a-finops-comparison-for-ai-spend) — 并排对比归因机制。