# 托管LLM平台 —— Bedrock、Vertex AI、Azure OpenAI

> 三大超大规模云服务商，三种不同策略。AWS Bedrock是模型市场 —— Claude、Llama、Titan、Stability、Cohere在一个API后面。Azure OpenAI是独家OpenAI合作伙伴关系，加上用于专用容量的预置吞吐量单元（PTU）。Vertex AI是Gemini优先，拥有最佳长上下文和多模态故事。2026年Artificial Analysis测量Azure OpenAI在Llama 3.1 405B等效模型上约50毫秒中位数，Bedrock约75毫秒 —— PTU解释了差距，因为专用容量优于共享按需。决策规则不是"哪个最快"，而是"哪个模型目录和FinOps界面匹配我的产品"。本课程教你带着写下的权衡来选择，而不是凭感觉。

**类型：** 学习
**语言：** Python（标准库，玩具成本与延迟比较器）
**前置知识：** 第11阶段（LLM工程），第13阶段（工具与协议）
**时间：** 约60分钟

## 学习目标

- 命名三种平台策略（市场 vs 独家 vs Gemini优先），并将每种匹配到产品用例。
- 解释Azure OpenAI中预置吞吐量单元（PTU）为你购买什么，以及为什么按需Bedrock通常在405B规模上读取慢约25毫秒。
- 为每个平台绘制FinOps归因界面（Bedrock应用推理配置文件 vs Vertex按项目团队 vs Azure范围 + PTU预留）。
- 写下"最低两家提供商"政策，并解释为什么单一供应商锁定是2026年的昂贵错误。

## 问题

你为产品选择了Claude 3.7 Sonnet。现在你需要提供它。你可以直接调用Anthropic API，或通过AWS Bedrock调用，或通过网关。直接API最简单；Bedrock添加BAA、VPC端点、IAM和CloudWatch归因。网关添加故障转移、统一计费和跨提供商速率限制。

更深层的问题是目录。如果你需要在同一产品中使用Claude、Llama和Gemini，你无法从一个地方购买全部，除非那个地方同时是Bedrock加Vertex加Azure OpenAI。超大规模云服务商不是可互换的 —— 它们各自对模型层所有权下了不同的赌注。

本课程映射三种赌注、延迟差距、FinOps差距和锁定风险。

## 概念

### 三种策略

**AWS Bedrock** —— 市场。Claude（Anthropic）、Llama（Meta）、Titan（AWS第一方）、Stability（图像）、Cohere（嵌入）、Mistral，加上图像和嵌入子目录。一个API、一个IAM界面、一个CloudWatch导出。Bedrock的赌注是客户想要选择性胜过单一模型。

**Azure OpenAI** —— 独家合作伙伴关系。你在Azure数据中心获得GPT-4 / 4o / 5 / o系列、DALL·E、Whisper和OpenAI模型的微调。"Azure OpenAI Service"目录中没有非OpenAI模型 —— 那些进入Azure AI Foundry（单独产品）。Azure的赌注是OpenAI保持前沿，客户想要对该特定关系的企业控制。

**Vertex AI** —— Gemini优先，其他一切其次。Gemini 1.5 / 2.0 / 2.5 Flash和Pro，加上Model Garden（第三方）。Vertex的赌注是多模态长上下文 —— 100万token Gemini上下文是差异化因素。

### 规模上的延迟差距

Artificial Analysis运行持续基准测试。在等效Llama 3.1 405B部署（共享按需）上，Azure OpenAI中位数首token延迟约50毫秒；Bedrock约75毫秒。差距不是AWS的失败 —— 它是容量模型差异。Azure销售PTU（预置吞吐量单元），为你的租户预留GPU容量。Bedrock的等效产品（预置吞吐量）存在但每单元约21美元/小时起，大多数客户停留在共享按需。

按需共享容量与每个其他客户的流量竞争。专用容量不竞争。如果你的产品SLA是P99 TTFT < 100毫秒，你要么在Azure购买PTU，要么购买Bedrock预置吞吐量，要么接受默认方差。

### 预置吞吐量经济学

Azure PTU：预留的推理计算块。可预测工作负载相比按需节省高达约70%。成本每小时固定无论流量 —— 即使在空闲时也支付预留。盈亏平衡通常在约40-60%持续利用率。

Bedrock预置吞吐量：每小时21-50美元，取决于模型和区域。类似数学 —— 盈亏平衡约在峰值利用率的一半。需要月度承诺。

Vertex预置容量按Gemini SKU销售；定价因模型和区域而异，公开宣传较少。

### FinOps界面 —— 真正的差异化因素

**Bedrock应用推理配置文件**是市场上最干净的归因。用`team`、`product`、`feature`标记配置文件；通过它路由所有模型调用；CloudWatch无需后处理即可按配置文件分解成本。2025年添加，仍然是最细粒度的超大规模云服务商原生方案。

**Vertex**归因是项目按团队加无处不在的标签。你将每个团队建模为GCP项目，在每个资源上放置标签，并使用BigQuery Billing Export + DataStudio进行汇总。更多工作，但BigQuery给你成本数据的任意SQL。

**Azure**依赖订阅/资源组范围加标签，PTU预留作为一等成本对象。标签从资源组继承，不是请求，所以每请求归因需要Application Insights自定义指标或标记头部的网关。

模式：Bedrock原生最干净，Vertex通过BigQuery最灵活，Azure除非你检测否则最不透明。

### 锁定是2026年的风险

单一超大规模云服务商承诺在一种模型主导时没问题。2026年前沿每月移动 —— Claude 3.7一个季度，Gemini 2.5下一个，GPT-5再下一个。锁定到一个平台将你锁定在三分之二的前沿之外。

工作团队采用的模式：任何产品关键LLM调用的最低两家提供商。Bedrock加Azure OpenAI是常见组合 —— 一个提供Claude，另一个提供GPT，两者之间故障转移，相同网关。成本提升可忽略，因为网关路由最优；中断期间（如Azure OpenAI 2025年1月事件、AWS us-east-1中断）的可用性提升是决定性的。

### 数据驻留、BAA和受监管行业

Bedrock：大多数区域的BAA；VPC端点；护栏。常见金融科技默认。
Azure OpenAI：HIPAA、SOC 2、ISO 27001；欧盟数据驻留；企业受监管默认。
Vertex：HIPAA、GDPR、每区域数据驻留；Google Cloud的合规栈。

三者都满足基本勾选框。差异在于数据保留政策、日志处理方式，以及滥用监控是否读取你的流量（大多数默认选择加入；企业可选择退出）。

### 你应该记住的数字

- Azure OpenAI在Llama 3.1 405B等效模型上的中位数TTFT：约50毫秒（使用PTU）。
- Bedrock按需中位数TTFT：约75毫秒。
- Bedrock预置吞吐量：每单元每小时21-50美元。
- Azure PTU盈亏平衡：约40-60%持续利用率。
- 高利用率下PTU相比按需节省：高达70%。

## 使用它

`code/main.py`在合成工作负载上比较三个平台 —— 它建模按需 vs PTU经济学、TTFT方差和成本归因保真度。运行它以查看PTU在哪里有回报，以及市场的模型广度在哪里超过TTFT差距。

## 交付它

本课程产出`outputs/skill-managed-platform-picker.md`。给定工作负载配置文件（需要的模型、TTFT SLA、日量、合规要求），它推荐主要平台、后备方案和FinOps检测计划。

## 练习

1. 运行`code/main.py`。在70B类模型上，Azure PTU在什么持续利用率下击败按需？计算盈亏平衡并与宣传的40-60%区间比较。
2. 你的产品需要Claude 3.7 Sonnet和GPT-4o。设计一个双提供商部署 —— 哪个去哪个超大规模云服务商，什么网关在前面，故障转移政策是什么？
3. 受监管的医疗保健客户需要BAA、美国东部数据驻留和低于100毫秒P99 TTFT。选择一个平台并用三个具体功能证明。
4. 你发现本月Bedrock账单上涨4倍，流量没有变化。没有应用推理配置文件，你如何找到罪魁祸首？有配置文件，需要多长时间？
5. 阅读Azure OpenAI和Bedrock定价页面。对于每月1亿token的Claude工作负载，哪个更便宜 —— 直接Anthropic API、Bedrock按需，还是Bedrock预置吞吐量？

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------|---------|
| Bedrock | "AWS LLM服务" | Claude、Llama、Titan、Mistral、Cohere的模型市场 |
| Azure OpenAI | "Azure的ChatGPT" | Azure数据中心中带企业控制的独家OpenAI模型 |
| Vertex AI | "Google的LLM" | Gemini优先平台，Model Garden用于第三方模型 |
| PTU | "专用容量" | 预置吞吐量单元 —— 预留推理GPU，按小时定价 |
| 应用推理配置文件 | "Bedrock标记" | 带标签的每产品成本/使用配置文件，CloudWatch原生 |
| Model Garden | "Vertex目录" | Vertex AI的第三方模型部分，与Gemini分开 |
| 最低两家提供商 | "LLM冗余" | 在≥2个超大规模云服务商上运行每个关键LLM路径的政策 |
| BAA | "HIPAA文书" | 商业伙伴协议；PHI需要；三者都提供 |
| 滥用监控 | "日志观察者" | 提供商端对提示/输出的安全扫描；企业中可选择退出 |

## 延伸阅读

- [AWS Bedrock定价](https://aws.amazon.com/bedrock/pricing/) —— 权威费率表和预置吞吐量定价。
- [Azure OpenAI服务定价](https://azure.microsoft.com/en-us/pricing/details/cognitive-services/openai-service/) —— PTU经济学和费率表。
- [Vertex AI生成式AI定价](https://cloud.google.com/vertex-ai/generative-ai/pricing) —— Gemini层级和Model Garden附加费。
- [Artificial Analysis LLM排行榜](https://artificialanalysis.ai/) —— 跨提供商的持续延迟和吞吐量基准测试。
- [AI Journal —— AWS Bedrock vs Azure OpenAI CTO指南2026](https://theaijournal.co/2026/03/aws-bedrock-vs-azure-openai/) —— 企业决策框架。
- [Finout —— Bedrock vs Vertex vs Azure FinOps](https://www.finout.io/blog/bedrock-vs.-vertex-vs.-azure-cognitive-a-finops-comparison-for-ai-spend) —— 归因机制并排比较。