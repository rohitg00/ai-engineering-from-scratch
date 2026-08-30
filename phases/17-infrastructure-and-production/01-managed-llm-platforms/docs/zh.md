# 01 · 托管 LLM 平台——Bedrock、Vertex AI、Azure OpenAI

> 三大超大规模云厂商，三种截然不同的策略。AWS Bedrock 是一个模型市场——Claude、Llama、Titan、Stability、Cohere 都藏在同一个 API 之后。Azure OpenAI 是与 OpenAI 的独家合作，再加上用于专属容量的「预置吞吐量单元（Provisioned Throughput Units，PTU）」。Vertex AI 则以 Gemini 为先，拥有最出色的长上下文与多模态能力。2026 年，Artificial Analysis 在等效于 Llama 3.1 405B 的部署上测得 Azure OpenAI 中位延迟约 50 ms，而 Bedrock 约 75 ms——这一差距正是 PTU 造成的，因为专属容量胜过共享按需容量。决策的依据不是「哪家最快」，而是「哪家的模型目录与 FinOps 能力契合我的产品」。本课教你在把各项权衡写清楚的前提下做选择，而不是凭感觉。

**类型：** 学习
**语言：** Python（标准库，玩具级成本与延迟对比器）
**前置：** 第 11 阶段（LLM 工程）、第 13 阶段（工具与协议）
**时长：** 约 60 分钟

## 学习目标

- 说出三种平台策略（市场型 vs 独家型 vs Gemini 优先型），并将每一种匹配到对应的产品用例。
- 解释「预置吞吐量单元（PTU）」在 Azure OpenAI 中能为你带来什么，以及为什么在 405B 规模下按需的 Bedrock 通常会慢约 25 ms。
- 画出每个平台的 FinOps 归因能力图（Bedrock 应用推理画像 vs Vertex 每团队一项目 vs Azure 作用域 + PTU 预留）。
- 写下一条「双供应商最低保障」策略，并解释为什么在 2026 年单一厂商锁定是一个代价高昂的错误。

## 问题所在

你为产品选择了 Claude 3.7 Sonnet。现在你需要把它部署上线。你可以直接调用 Anthropic API，也可以通过 AWS Bedrock 调用，或者经由一个网关。直接调用 API 最简单；Bedrock 增加了 BAA、VPC 端点、IAM 和 CloudWatch 归因。网关则增加了跨供应商的故障切换、统一计费和速率限制。

更深层的问题是目录。如果你需要在同一个产品里同时用上 Claude、Llama 和 Gemini，那么除非你同时使用 Bedrock 加 Vertex 加 Azure OpenAI，否则无法从一个地方全部买到。这些超大规模云厂商并不可互换——他们各自在「谁拥有模型层」这件事上下了不同的赌注。

本课梳理这三种赌注、延迟差距、FinOps 差距以及锁定风险。

## 核心概念

### 三种策略

**AWS Bedrock**——市场型。Claude（Anthropic）、Llama（Meta）、Titan（AWS 自有）、Stability（图像）、Cohere（嵌入）、Mistral，再加上图像和嵌入的子目录。一个 API、一套 IAM 能力、一个 CloudWatch 导出。Bedrock 的赌注是：客户想要可选性，胜过想要某一个单一模型。

**Azure OpenAI**——独家合作型。你能获得 GPT-4 / 4o / 5 / o 系列、DALL·E、Whisper，以及在 Azure 数据中心对 OpenAI 模型进行的微调。「Azure OpenAI Service」目录中没有任何非 OpenAI 模型——那些归到 Azure AI Foundry（独立产品）。Azure 的赌注是：OpenAI 仍将占据前沿，而客户希望在这一特定合作关系上拥有企业级管控。

**Vertex AI**——Gemini 第一，其余其次。Gemini 1.5 / 2.0 / 2.5 Flash 与 Pro，外加 Model Garden（第三方）。Vertex 的赌注是多模态长上下文——100 万 token 的 Gemini 上下文是其差异化所在。

### 规模下的延迟差距

Artificial Analysis 持续运行基准测试。在等效的 Llama 3.1 405B 部署（共享按需）上，Azure OpenAI 的中位首 token 延迟约为 50 ms；Bedrock 约为 75 ms。这一差距不是 AWS 的失误——而是容量模型的差异。Azure 售卖 PTU（预置吞吐量单元），为你的租户预留 GPU 容量。Bedrock 的对应物（Provisioned Throughput）也存在，但每单位起价约为每小时 21 美元，而大多数客户仍停留在共享按需上。

按需共享容量要与所有其他客户的流量争抢。专属容量则不会。如果你的产品 SLA 要求 P99 下 TTFT < 100 ms，你要么在 Azure 上购买 PTU，要么购买 Bedrock Provisioned Throughput，要么接受默认的波动。

### 预置吞吐量的经济账

Azure PTU：一块预留的推理算力。对于可预测的工作负载，相较按需可节省高达约 70%。成本按小时固定，与流量无关——即便空闲你也要为预留付费。盈亏平衡点通常在约 40%-60% 的持续利用率。

Bedrock Provisioned Throughput：每小时 21-50 美元，视模型与区域而定。算法类似——盈亏平衡点约在峰值利用率的一半。需要按月承诺。

Vertex 预置容量按各 Gemini SKU 售卖；定价因模型与区域而异，且公开宣传较少。

### FinOps 能力——真正的差异化点

**Bedrock 应用推理画像（Application Inference Profiles）** 是市场型平台中最清爽的归因方式。给一个画像打上 `team`、`product`、`feature` 标签；让所有模型调用都经由它路由；CloudWatch 无需后处理即可按画像拆分成本。该功能 2025 年加入，仍是各超大规模云厂商原生能力中最细粒度的。

**Vertex** 的归因是「每团队一项目」加「处处打标签」。你把每个团队建模为一个 GCP 项目，给每项资源打标签，再用 BigQuery 计费导出 + DataStudio 做汇总。工作量更大，但 BigQuery 让你能对成本数据写任意 SQL。

**Azure** 依赖订阅/资源组作用域加标签，并将 PTU 预留作为一等成本对象。标签从资源组继承，而非从请求继承，因此按请求归因需要 Application Insights 自定义指标，或一个会盖上请求头的网关。

规律是：Bedrock 原生最清爽，Vertex 借助 BigQuery 最灵活，Azure 在你不做埋点的情况下最不透明。

### 锁定是 2026 年的风险

当某一个模型一家独大时，押注单一超大规模云厂商没问题。但在 2026 年，前沿每月都在移动——这一季是 Claude 3.7，下一季是 Gemini 2.5，再下一季是 GPT-5。锁定在一个平台上，等于把自己挡在三分之二的前沿之外。

成熟团队采用的模式是：对任何产品关键的 LLM 调用都执行「双供应商最低保障」。Bedrock 加 Azure OpenAI 是常见组合——Claude 走一边，GPT 走另一边，两者之间故障切换，使用同一个网关。由于网关会做最优路由，成本上浮可以忽略；而在故障期间（如 2025 年 1 月 Azure OpenAI 事故、AWS us-east-1 宕机）带来的可用性提升则是决定性的。

### 数据驻留、BAA 与受监管行业

Bedrock：多数区域提供 BAA；VPC 端点；护栏（guardrails）。是金融科技的常见默认选择。
Azure OpenAI：HIPAA、SOC 2、ISO 27001；欧盟数据驻留；受监管企业的默认选择。
Vertex：HIPAA、GDPR、按区域的数据驻留；Google Cloud 的合规体系。

三家都能满足基本勾选项。差异在于数据保留策略、日志如何处理，以及滥用监控是否读取你的流量（多数默认开启;企业版可选择退出）。

### 你应该记住的数字

- Azure OpenAI 在等效 Llama 3.1 405B 上的中位 TTFT：约 50 ms（使用 PTU）。
- Bedrock 按需的中位 TTFT：约 75 ms。
- Bedrock Provisioned Throughput：每单位每小时 21-50 美元。
- Azure PTU 盈亏平衡点：约 40%-60% 的持续利用率。
- 高利用率下 PTU 相较按需的节省：高达 70%。

## 动手用

`code/main.py` 在一个合成工作负载上对比三个平台——它对按需 vs PTU 的经济账、TTFT 波动以及成本归因保真度进行建模。运行它，看看 PTU 在何处划算，以及市场型平台的模型广度在何处能盖过 TTFT 上的差距。

## 交付它

本课产出 `outputs/skill-managed-platform-picker.md`。给定一份工作负载画像（所需模型、TTFT SLA、每日流量、合规要求），它会推荐一个主平台、一个备用平台，以及一套 FinOps 埋点方案。

## 练习

1. 运行 `code/main.py`。对于 70B 级别的模型，Azure PTU 在多高的持续利用率下能胜过按需？计算盈亏平衡点，并与宣传的 40%-60% 区间作比较。
2. 你的产品需要 Claude 3.7 Sonnet 和 GPT-4o。设计一套双供应商部署——哪个走哪家超大规模云厂商，前面放什么网关，故障切换策略是什么？
3. 一家受监管的医疗客户要求 BAA、US-East 数据驻留以及 P99 TTFT 低于 100 ms。挑选一个平台，并用三个具体特性来论证。
4. 你发现本月 Bedrock 账单涨了 4 倍，但流量没有变化。在没有应用推理画像的情况下，你会如何找出元凶？有了画像之后，又需要多长时间？
5. 阅读 Azure OpenAI 和 Bedrock 的定价页面。对于每月 1 亿 token 的 Claude 工作负载，哪个更便宜——直接调用 Anthropic API、Bedrock 按需，还是 Bedrock Provisioned Throughput？

## 关键术语

| 术语 | 大家怎么说 | 它实际上的含义 |
|------|----------------|------------------------|
| Bedrock | 「AWS 的 LLM 服务」 | 横跨 Claude、Llama、Titan、Mistral、Cohere 的模型市场 |
| Azure OpenAI | 「Azure 的 ChatGPT」 | 在 Azure 数据中心提供、带企业级管控的独家 OpenAI 模型 |
| Vertex AI | 「Google 的 LLM」 | 以 Gemini 为先、配有 Model Garden 提供第三方模型的平台 |
| PTU | 「专属容量」 | 预置吞吐量单元——预留的推理 GPU，按小时计价 |
| Application Inference Profile | 「Bedrock 打标签」 | 按产品的成本/用量画像，带标签，CloudWatch 原生支持 |
| Model Garden | 「Vertex 目录」 | Vertex AI 的第三方模型板块，独立于 Gemini |
| Two-provider minimum | 「LLM 冗余」 | 让每条关键 LLM 路径都跨 ≥2 家超大规模云厂商运行的策略 |
| BAA | 「HIPAA 文书」 | 业务伙伴协议（Business Associate Agreement）；处理 PHI 时必需;三家都提供 |
| Abuse monitoring | 「日志监视器」 | 供应商侧对提示/输出的安全扫描；企业版可选择退出 |

## 延伸阅读

- [AWS Bedrock 定价](https://aws.amazon.com/bedrock/pricing/)——权威费率表与 Provisioned Throughput 定价。
- [Azure OpenAI Service 定价](https://azure.microsoft.com/en-us/pricing/details/cognitive-services/openai-service/)——PTU 经济账与费率表。
- [Vertex AI 生成式 AI 定价](https://cloud.google.com/vertex-ai/generative-ai/pricing)——Gemini 各档位与 Model Garden 附加费。
- [Artificial Analysis LLM 排行榜](https://artificialanalysis.ai/)——跨供应商的持续延迟与吞吐基准测试。
- [The AI Journal——AWS Bedrock vs Azure OpenAI CTO 指南 2026](https://theaijournal.co/2026/03/aws-bedrock-vs-azure-openai/)——企业决策框架。
- [Finout——Bedrock vs Vertex vs Azure FinOps](https://www.finout.io/blog/bedrock-vs.-vertex-vs.-azure-cognitive-a-finops-comparison-for-ai-spend)——归因机制并排对比。
