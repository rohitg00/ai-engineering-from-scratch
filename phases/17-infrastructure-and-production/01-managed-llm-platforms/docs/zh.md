# 托管 LLM 平台 — Bedrock、Vertex AI、Azure OpenAI

> 三大超大规模云厂商，三种截然不同的策略。AWS Bedrock 是一个模型市场——Claude、Llama、Titan、Stability、Cohere 共用一个 API。Azure OpenAI 是 OpenAI 独家合作伙伴关系，加上用于专用容量的预配吞吐量单位（PTU）。Vertex AI 以 Gemini 为先，拥有最佳的长上下文和多模态能力。2026 年 Artificial Analysis 测得 Azure OpenAI 在 Llama 3.1 405B 等效模型上中位数约 50 ms，Bedrock 约 75 ms——PTU 解释了这一差距，因为专用容量优于共享按需资源。决策规则不是"哪个最快"，而是"哪个模型目录和 FinOps 界面符合我的产品需求"。本课教你带着明确记录的权衡来做选择，而不是靠感觉。

**类型：** 学习
**语言：** Python（标准库，简单的成本和延迟比较器）
**先修要求：** 阶段 11（LLM 工程）、阶段 13（工具与协议）
**时间：** 约 60 分钟

## 学习目标

- 说出三种平台策略（市场 vs 独家 vs Gemini 优先），并将每种策略匹配到产品用例。
- 解释 Azure OpenAI 中的预配吞吐量单位（PTU）能为你带来什么，以及为什么按需 Bedrock 在 405B 规模上通常慢约 25 ms。
- 绘制每个平台的 FinOps 归因界面图（Bedrock 应用程序推理配置文件 vs Vertex 每团队一个项目 vs Azure 作用域 + PTU 预留）。
- 写下"至少两家提供商"策略，并解释为什么单一供应商锁定是 2026 年代价高昂的错误。

## 问题

你为产品选择了 Claude 3.7 Sonnet。现在你需要部署它。你可以直接调用 Anthropic API，或者通过 AWS Bedrock 调用，或者通过网关调用。直接 API 最简单；Bedrock 增加了 BAA、VPC 端点、IAM 和 CloudWatch 归因。网关增加了故障转移、统一计费和跨提供商的速率限制。

更深层次的问题是目录。如果你的产品需要同时使用 Claude、Llama 和 Gemini，你无法从一个地方全部购买，除非这个地方同时是 Bedrock + Vertex + Azure OpenAI。超大规模云厂商不可互换——它们各自在谁拥有模型层上押了不同的注。

本课映射了这三种押注、延迟差距、FinOps 差距和锁定风险。

## 概念

### 三种策略

**AWS Bedrock**——市场模式。Claude（Anthropic）、Llama（Meta）、Titan（AWS 第一方）、Stability（图像）、Cohere（嵌入）、Mistral，加上图像和嵌入子目录。一个 API、一个 IAM 界面、一个 CloudWatch 导出。Bedrock 的押注是：客户更想要选择性，而不是单一模型。

**Azure OpenAI**——独家合作伙伴关系。你可以在 Azure 数据中心获得 GPT-4 / 4o / 5 / o 系列、DALL·E、Whisper，以及对 OpenAI 模型的微调。"Azure OpenAI 服务"目录中没有非 OpenAI 模型——那些归于 Azure AI Foundry（独立产品）。Azure 的押注是：OpenAI 保持前沿地位，客户希望在这个特定关系上获得企业控制。

**Vertex AI**——Gemini 优先，其他一切次之。Gemini 1.5 / 2.0 / 2.5 Flash 和 Pro，加上 Model Garden（第三方）。Vertex 的押注是多模态长上下文——100 万 token 的 Gemini 上下文是差异化优势。

### 大规模下的延迟差距

Artificial Analysis 运行持续基准测试。在等效的 Llama 3.1 405B 部署（共享按需）上，Azure OpenAI 的首 token 延迟中位数约为 50 ms；Bedrock 约为 75 ms。这一差距不是 AWS 的失败——而是容量模型的差异。Azure 销售 PTU（预配吞吐量单位），为你的租户预留 GPU 容量。Bedrock 的等效产品（预配吞吐量）存在，但每单位起价约 21 美元/小时，大多数客户停留在共享按需模式。

按需共享容量与所有其他客户的流量竞争。专用容量则不会。如果你的产品 SLA 是 P99 TTFT < 100 ms，你要么在 Azure 上购买 PTU，购买 Bedrock 预配吞吐量，要么接受默认的波动性。

### 预配吞吐量经济学

Azure PTU：预留的推理计算块。对于可预测的工作负载，相比按需最高可节省约 70%。无论流量如何，按小时固定成本——即使空闲时你也要为预留付费。盈亏平衡点通常在约 40-60% 持续利用率左右。

Bedrock 预配吞吐量：根据模型和区域不同，21-50 美元/小时。数学类似——盈亏平衡点约为峰值利用率的一半。需要月度承诺。

Vertex 预配容量按 Gemini SKU 销售；价格因模型和区域而异，公开宣传较少。

### FinOps 界面——真正的差异化因素

**Bedrock 应用程序推理配置文件**是市场中最干净的归因方式。用 `team`、`product`、`feature` 标记配置文件；将所有模型调用路由通过它；CloudWatch 无需后处理即可分解每个配置文件的成本。2025 年新增，至今仍是超大规模云厂商中最细粒度的原生方案。

**Vertex** 归因是每团队一个项目加上无处不在的标签。你将每个团队建模为一个 GCP 项目，在每个资源上放置标签，并使用 BigQuery 计费导出 + DataStudio 进行汇总。更多工作，但 BigQuery 让你可以对成本数据执行任意 SQL。

**Azure**依赖订阅/资源组作用域加上标签，PTU 预留作为一等成本对象。标签从资源组继承，而非从请求继承，因此每次请求的归因需要 Application Insights 自定义指标或能够标记头部的网关。

模式：Bedrock 是最干净的原生方案，Vertex 通过 BigQuery 最灵活，Azure 最不透明，除非你进行检测。

### 锁定是 2026 年的风险

单一超大规模云厂商承诺在单一模型主导时没问题。在 2026 年，前沿每月都在变动——这一季度是 Claude 3.7，下一季度是 Gemini 2.5，再下一季度是 GPT-5。锁定到一个平台会让你错失三分之二的前沿。

工作团队采用的模式：任何产品关键的 LLM 调用至少使用两家提供商。Bedrock 加 Azure OpenAI 是常见的组合——Claude 来自一个，GPT 来自另一个，两者之间故障转移，同一个网关。成本提升微乎其微，因为网关路由最优；在中断期间（如 2025 年 1 月 Azure OpenAI 事件、AWS us-east-1 中断）的可用性提升是决定性的。

### 数据驻留、BAA 和受监管行业

Bedrock：大多数区域的 BAA；VPC 端点；防护栏。常见的金融科技默认方案。

Azure OpenAI：HIPAA、SOC 2、ISO 27001；欧盟数据驻留；企业受监管默认方案。

Vertex：HIPAA、GDPR、按区域数据驻留；Google Cloud 的合规体系。

三者都满足基本的合规性要求。差异在于数据保留政策、日志处理方式，以及滥用监控是否读取你的流量（大多数默认选择加入；企业可选择退出）。

### 你应该记住的数字

- Azure OpenAI 在 Llama 3.1 405B 等效模型上的中位数 TTFT：约 50 ms（使用 PTU）。
- Bedrock 按需中位数 TTFT：约 75 ms。
- Bedrock 预配吞吐量：21-50 美元/小时每单位。
- Azure PTU 盈亏平衡点：约 40-60% 持续利用率。
- 高利用率下 PTU 相比按需的节省：最高 70%。

## 使用它

`code/main.py`在合成工作负载上比较三个平台——它建模了按需 vs PTU 经济学、TTFT 方差和成本归因保真度。运行它以了解 PTU 在何处物有所值，以及在何处市场的模型广度超过了 TTFT 差距。

## 交付它

本课生成 `outputs/skill-managed-platform-picker.md`。给定工作负载配置文件（所需模型、TTFT SLA、每日量、合规要求），它推荐主要平台、后备平台和 FinOps 检测计划。

## 练习

1. 运行 `code/main.py`。对于 70B 级模型，Azure PTU 在何种持续利用率下优于按需？计算盈亏平衡点，并与宣传的 40-60% 区间进行比较。
2. 你的产品需要 Claude 3.7 Sonnet 和 GPT-4o。设计一个双提供商部署——哪个去哪个超大规模云厂商，前面放什么网关，故障转移政策是什么？
3. 受监管的医疗保健客户需要 BAA、美国东部数据驻留和 P99 TTFT 低于 100 ms。选择一个平台，并用三个具体功能证明。
4. 你发现你的 Bedrock 账单本月上涨了 4 倍，但流量没有变化。如果没有应用程序推理配置文件，你如何找到罪魁祸首？有了配置文件，需要多长时间？
5. 阅读 Azure OpenAI 和 Bedrock 定价页面。对于每月 1 亿 token 的 Claude 工作负载，哪个更便宜——直接 Anthropic API、Bedrock 按需还是 Bedrock 预配吞吐量？

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|----------------|------------------------|
| Bedrock | "AWS LLM 服务" | 跨 Claude、Llama、Titan、Mistral、Cohere 的模型市场 |
| Azure OpenAI | "Azure 的 ChatGPT" | Azure 数据中心中的独家 OpenAI 模型，带企业控制 |
| Vertex AI | "Google 的 LLM" | Gemini 优先平台，Model Garden 用于第三方模型 |
| PTU | "专用容量" | 预配吞吐量单位——预留推理 GPU，按小时定价 |
| Application Inference Profile | "Bedrock 标签" | 带标签的每产品成本/使用配置文件，CloudWatch 原生 |
| Model Garden | "Vertex 目录" | Vertex AI 的第三方模型部分，独立于 Gemini |
| Two-provider minimum | "LLM 冗余" | 在每个关键 LLM 路径上跨至少 2 家超大规模云厂商运行的策略 |
| BAA | "HIPAA 文书工作" | 业务关联协议；PHI 所需；三家都提供 |
| Abuse monitoring | "日志监视器" | 提供商侧对提示/输出的安全扫描；企业可选择退出 |

## 延伸阅读

- [AWS Bedrock 定价](https://aws.amazon.com/bedrock/pricing/)——权威费率表和预配吞吐量定价。
- [Azure OpenAI 服务定价](https://azure.microsoft.com/en-us/pricing/details/cognitive-services/openai-service/)——PTU 经济学和费率表。
- [Vertex AI 生成式 AI 定价](https://cloud.google.com/vertex-ai/generative-ai/pricing)——Gemini 层级和 Model Garden 附加费。
- [Artificial Analysis LLM 排行榜](https://artificialanalysis.ai/)——跨提供商的持续延迟和吞吐量基准测试。
- [The AI Journal——AWS Bedrock vs Azure OpenAI CTO 指南 2026](https://theaijournal.co/2026/03/aws-bedrock-vs-azure-openai/)——企业决策框架。
- [Finout——Bedrock vs Vertex vs Azure FinOps](https://www.finout.io/blog/bedrock-vs.-vertex-vs.-azure-cognitive-a-finops-comparison-for-ai-spend)——并排归因机制。
