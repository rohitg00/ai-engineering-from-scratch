# 托管 LLM 平台 — Bedrock、Vertex AI、Azure OpenAI

> 三家超大规模云厂商，三种截然不同的策略。AWS Bedrock 是一个模型市场——将 Claude、Llama、Titan、Stability、Cohere 统一在同一个 API 下。Azure OpenAI 是 OpenAI 独家合作加上预置吞吐单元（PTU）用于专用容量。Vertex AI 以 Gemini 为先，拥有最佳的长上下文和多模态能力。2026 年，Artificial Analysis 测得 Azure OpenAI 中位延迟约 50 ms，Bedrock 在 Llama 3.1 405B 等效模型上约 75 ms——PTU 解释了这一差距，因为专用容量优于共享按需。决策规则不是"谁最快"，而是"哪个模型目录和 FinOps 界面符合我的产品"。本课教你用写下来的权衡做选择，而不是凭感觉。

**类型：** 学习
**语言：** Python（标准库，简易成本与延迟比较器）
**前置要求：** 阶段 11（LLM 工程），阶段 13（工具与协议）
**时间：** 约 60 分钟

## 学习目标

- 说出三种平台策略（市场 vs 独家 vs Gemini 为先）并将每一种匹配到产品用例。
- 解释预置吞吐单元（PTU）在 Azure OpenAI 中能带来什么，以及为什么按需 Bedrock 在 405B 规模下通常慢约 25 ms。
- 绘制各平台的 FinOps 归因面（Bedrock Application Inference Profiles vs Vertex 每团队项目 vs Azure 作用域 + PTU 预留）。
- 写出一条"双提供商最低要求"策略，并解释为什么单一供应商锁定是 2026 年代价高昂的错误。

## 问题

你为产品选定了 Claude 3.7 Sonnet。现在需要提供服务。你可以直接调用 Anthropic API，也可以通过 AWS Bedrock 调用，还可以通过网关。直接 API 最简单；Bedrock 增加了 BAA、VPC 端点、IAM 和 CloudWatch 归因。网关增加了跨提供商的故障切换、统一计费和速率限制。

更深层的问题是目录。如果你需要在同一个产品中使用 Claude、Llama 和 Gemini，你无法从一个地方全部获取——除非你同时拥有 Bedrock、Vertex 和 Azure OpenAI。超大规模云厂商并不可互换——它们各自对模型层的归属下了不同的赌注。

本课将梳理这三种赌注、延迟差距、FinOps 差距以及锁定风险。

## 概念

### 三种策略

**AWS Bedrock** —— 市场。Claude（Anthropic）、Llama（Meta）、Titan（AWS 自研）、Stability（图像）、Cohere（嵌入）、Mistral，再加上图像和嵌入子目录。统一的 API、统一的 IAM 面、统一的 CloudWatch 导出。Bedrock 的赌注是：客户更想要可选性，而非单一模型。

**Azure OpenAI** —— 独家合作。你可以在 Azure 数据中心使用 GPT-4 / 4o / 5 / o 系列、DALL·E、Whisper 以及 OpenAI 模型的微调能力。"Azure OpenAI 服务"目录中没有非 OpenAI 模型——那些模型放在 Azure AI Foundry（独立产品）。Azure 的赌注是：OpenAI 仍然处于前沿位置，客户希望在此特定关系上获得企业级管控。

**Vertex AI** —— Gemini 优先，其他在后。Gemini 1.5 / 2.0 / 2.5 Flash 和 Pro，外加 Model Garden（第三方模型）。Vertex 的赌注是多模态长上下文——100 万 token 的 Gemini 上下文是其差异优势。

### 规模下的延迟差距

Artificial Analysis 持续运行基准测试。在等效的 Llama 3.1 405B 部署（共享按需）上，Azure OpenAI 中位首 token 延迟约为 50 ms；Bedrock 约为 75 ms。这一差距并非 AWS 的失败——而是容量模式的差异。Azure 销售 PTU（预置吞吐单元），为你的租户保留 GPU 容量。Bedrock 的等价方案（预置吞吐）也存在，但每个单元起价约 21 美元/小时，大多数客户仍停留在共享按需模式。

共享按需容量与其他所有客户的流量竞争。专用容量则不会。如果你的产品 SLA 要求 P99 TTFT < 100 ms，你要么在 Azure 上购买 PTU，要么购买 Bedrock 预置吞吐，要么接受默认方差。

### 预置吞吐的经济性

Azure PTU：一组预留的推理计算资源。与按需相比，对于可预测的工作负载最高可节省约 70%。无论流量如何，按小时固定收费——即使空闲也要为预留付费。盈亏平衡点通常在约 40-60% 的持续利用率。

Bedrock 预置吞吐：每小时 21-50 美元，取决于模型和区域。类似的算法——盈亏平衡点约为峰值利用率的一半。需要按月承诺。

Vertex 的预置容量按每个 Gemini SKU 销售；定价因模型和地区而异，公开宣传较少。

### FinOps 面——真正的差异化因素

**Bedrock Application Inference Profiles** 是市场上最清晰的归因工具。用 `team`、`product`、`feature` 标记一个配置文件；所有模型调用都通过它路由；CloudWatch 无需后处理即可按配置文件分解成本。2025 年新增，仍然是超大规模云厂商中原生粒度最细的方案。

**Vertex** 的归因是每团队项目加处处标签。你将每个团队建模为一个 GCP 项目，在每个资源上打标签，并使用 BigQuery 计费导出 + DataStudio 进行汇总。工作量更大，但 BigQuery 让你可以对成本数据执行任意 SQL 查询。

**Azure** 依赖订阅/资源组作用域加标签，PTU 预留是一级成本对象。标签从资源组继承而来，而非来自请求，因此按请求归因需要 Application Insights 自定义指标或一个能打标记的网关。

模式：Bedrock 原生最清晰，Vertex 通过 BigQuery 最灵活，Azure 最不透明（除非你自行埋点）。

### 锁定是 2026 年的风险

单一超大规模云厂商承诺在单一模型主导时是可行的。到了 2026 年，前沿模型每月都在变化——这一季是 Claude 3.7，下一季是 Gemini 2.5，再下一季是 GPT-5。锁定一个平台就等于被挡在三分之二的前沿之外。

高效团队采用的模式：对所有产品关键型 LLM 调用实行双提供商最低要求。Bedrock 加 Azure OpenAI 是常见组合——Claude 来自一个，GPT 来自另一个，它们之间可故障切换，共用同一个网关。成本增加可以忽略不计，因为网关会选择最优路由；在故障期间的可用性提升（如 2025 年 1 月 Azure OpenAI 事件、AWS us-east-1 宕机）是决定性的。

### 数据驻留、BAA 与受监管行业

Bedrock：大多数区域支持 BAA；VPC 端点；护栏。常见的金融科技默认选择。
Azure OpenAI：HIPAA、SOC 2、ISO 27001；欧盟数据驻留；企业受监管行业的默认选择。
Vertex：HIPAA、GDPR、按区域数据驻留；Google Cloud 合规体系。

三者都满足基本合规要求。差异在于数据保留策略、日志处理方式，以及滥用监控是否读取你的流量（大多数默认开启；企业版可选择关闭）。

### 你应该记住的数字

- Azure OpenAI 在 Llama 3.1 405B 等效模型上的中位 TTFT：约 50 ms（使用 PTU）。
- Bedrock 按需中位 TTFT：约 75 ms。
- Bedrock 预置吞吐：每单元每小时 21-50 美元。
- Azure PTU 盈亏平衡点：约 40-60% 持续利用率。
- PTU 在高利用率下与按需相比的节省：最高 70%。

## 使用它

`code/main.py` 在合成工作负载上比较三个平台——它模拟按需与 PTU 的经济性、TTFT 方差和成本归因保真度。运行它来看 PTU 何时划算，以及市场的模型广度何时胜过 TTFT 差距。

## 交付物

本课产出 `outputs/skill-managed-platform-picker.md`。给定一个工作负载画像（所需模型、TTFT SLA、每日用量、合规要求），它会推荐一个主平台、一个备用平台以及一个 FinOps 埋点方案。

## 练习

1. 运行 `code/main.py`。对于 70B 类模型，Azure PTU 在什么样的持续利用率下优于按需？计算盈亏平衡点并与宣传的 40-60% 区间进行比较。
2. 你的产品需要 Claude 3.7 Sonnet 和 GPT-4o。设计一个双提供商部署方案——哪个模型放到哪个超大规模云上，前方使用什么网关，故障切换策略是什么？
3. 一个受监管的医疗客户需要 BAA、美东数据驻留以及低于 100 ms 的 P99 TTFT。选择一个平台并用三个具体特性证明。
4. 你发现你的 Bedrock 账单本月在没有流量变化的情况下上涨了 4 倍。如果没有 Application Inference Profiles，你如何找到原因？如果有配置文件，需要多长时间？
5. 阅读 Azure OpenAI 和 Bedrock 的定价页面。对于一个 1 亿 token/月的 Claude 工作负载，哪个更便宜——直接 Anthropic API、Bedrock 按需还是 Bedrock 预置吞吐？

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------|---------|
| Bedrock | "AWS LLM 服务" | 跨 Claude、Llama、Titan、Mistral、Cohere 的模型市场 |
| Azure OpenAI | "Azure 的 ChatGPT" | Azure 数据中心中的独家 OpenAI 模型，含企业管控 |
| Vertex AI | "Google 的 LLM" | Gemini 优先平台，附带 Model Garden 的第三方模型 |
| PTU | "专用容量" | 预置吞吐单元——预留的推理 GPU，按小时计费 |
| Application Inference Profile | "Bedrock 标签" | 带标签的按产品成本/用量配置文件，CloudWatch 原生 |
| Model Garden | "Vertex 目录" | Vertex AI 的第三方模型分区，独立于 Gemini |
| 双提供商最低要求 | "LLM 冗余" | 每条关键 LLM 路径跨越 ≥2 个超大规模云厂商运行 |
| BAA | "HIPAA 文书" | 业务伙伴协议；PHI 所需；三家均提供 |
| 滥用监控 | "日志观察者" | 服务端对提示词/输出进行安全扫描；企业版可选择关闭 |

## 延伸阅读

- [AWS Bedrock 定价](https://aws.amazon.com/bedrock/pricing/) — 官方费率表和预置吞吐定价。
- [Azure OpenAI 服务定价](https://azure.microsoft.com/en-us/pricing/details/cognitive-services/openai-service/) — PTU 经济性和费率表。
- [Vertex AI 生成式 AI 定价](https://cloud.google.com/vertex-ai/generative-ai/pricing) — Gemini 分层和 Model Garden 附加费。
- [Artificial Analysis LLM 排行榜](https://artificialanalysis.ai/) — 跨提供商的持续延迟和吞吐量基准测试。
- [The AI Journal — AWS Bedrock vs Azure OpenAI CTO 指南 2026](https://theaijournal.co/2026/03/aws-bedrock-vs-azure-openai/) — 企业决策框架。
- [Finout — Bedrock vs Vertex vs Azure FinOps](https://www.finout.io/blog/bedrock-vs.-vertex-vs.-azure-cognitive-a-finops-comparison-for-ai-spend) — 归因机制对比。
