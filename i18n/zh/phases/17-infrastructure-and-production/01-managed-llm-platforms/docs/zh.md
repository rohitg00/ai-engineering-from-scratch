# 管理的LLM平台 Bedrock,Vertex AI,Azure OpenAI

> 只有三个超级级级别,三个不同的策略. AWS Bedrock是一个模型市场 克劳德,拉马,泰坦,稳定,协同在一个API后面.  Azure OpenAI是一个专属的OpenAI合作伙伴关系,加上为专用容量提供通量单位 (PTU). 果AI是双胞胎第一,拥有最好的长文本和多模式故事. 2026年,人工分析测量Azure OpenAI的中位数为50 ms,Bedrock的Llama 3.1 405B等级为75 ms. 决定的规则不是"哪个是最快的"而是"哪个模型目录和FinOps表面匹配我的产品".

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, toy cost-and-latency comparator)
**Prerequisites:** Phase 11 (LLM Engineering), Phase 13 (Tools & Protocols)
**Time:** ~60 minutes

## 学习目标

- 列出三个平台策略 (市场对独家对双子座第一) 并将每个平台与产品使用情况匹配.
- 解释Azure OpenAI中提供吞吐量单位 (PTU) 如何购买您,以及为什么按需Bedrock通常在405B尺度上读取速度低于25 ms.
- 图表每个平台的FinOps属性表面 (Bedrock应用程序推理资料与 Vertex项目/团队与Azure范围 + PTU预订).
- 写下"两供应商最低"政策,并解释为什么单供应商锁定是2026年的昂贵错误.

## 问题

您选择了Claude 3.7 Sonnet为您的产品.现在您需要服务.您可以直接调用Anthropic API,或者通过AWS Bedrock,或者通过网关.直接 API是最简单的;Bedrock添加BAA,VPC终端点,IAM和CloudWatch属性.网关添加了故障转账,统一的发票和跨供应商的利率限制.

更多的问题是目录.如果你需要克劳德,拉马和双胞胎在同一产品中,你不能从一个地方购买它们,除非那个地方是Bedrock加上Vertex加上AzureOpenAI同时.

这一课将三个投注,延迟差距,FinOps差距,

## 概念

### 三种策略

**AWS Bedrock**市场.克劳德 (人类),Llama (Meta),Titan (AWS首方),稳定性 (图像),Cohere (嵌入),Mistral,加上图像和嵌入子目录.一个API,一个IAM表面,一个CloudWatch出口.贝德罗克的投注是客户希望选项更多的比他们想要单个模型.

**Azure OpenAI**独家合作.你得到了GPT-4/4o/5/o系列,DALL·E,Whisper和Azure数据中心的OpenAI模型的细节调整.Azure OpenAI服务目录中没有非OpenAI模型.这些模型进入Azure AI Foundry (单独的产品).Azure的投注是OpenAI仍然是边界,客户希望对该特定关系进行企业控制.

**Vertex AI**双子座第一,其他的一切第二.双子座1.5/2.0/2.5闪电和Pro,加上模型园 (第三方).Vertex的投注是多模式长语境  1M标志双子座背景是区别.

### 缩放时间的差距

人工分析运行持续的基准. 在相当于Llama 3.1 405B部署时,Azure的初代令牌延迟平均为50ms左右,PTU;在需要共享的Bedrock约为75ms左右. 缺口不是AWS故障,而是能力模型差异.  Azure 销售PTU (提供通量单位),为租户保留GPU容量. 贝德罗克的相当量 (提供通量) 存在,但每单位的价格从每小时21美元左右开始,大多数客户都在按需共享.

如果您的产品 SLA 在 P99 时 TTFT < 100 ms,则您要么在 Azure 上购买 PTU,要么购买 Bedrock 提供通量,要么接受默认变量.

### 提供吞吐量经济学

 Azure PTU:一个保留的推理计算区块.可预测的工作负载的节省率高达70%对需求. 固定的每小时成本,无论流量如何. 您即使在空中时也支付预订费用. 折扣平衡通常在持续利用率的40%-60%.

床提供过量: $21-$根据模型和地区,每小时50分. 类似的数学  破平率是大约半峰值利用率. 需要每月承诺.

根据Gemini SKU,Vertex提供的容量销售;价格因车型和地区而异,并且不公开广告.

### 终端表面 真正的区分器

**Bedrock Application Inference Profiles**标签一个个人资料`team`现在`product`现在`feature`通过它将所有模型调用路由;CloudWatch没有后处理,每个配置文件的成本都会破裂.

**Vertex**您可以将每个团队作为一个GCP项目,将标签放在每个资源上,并使用BigQuery 计费出口+数据研究.更多的工作,但BigQuery 给你任意的SQL在成本数据.

**Azure**基于订阅/资源组范围以及标签,PTU预订作为一流成本对象.标签是从资源组继承的,而不是请求,因此每请求属性需要应用洞察的定制度或盖茨标签.

模式:Bedrock是最干净的本地,Vertex是通过BigQuery最灵活的,Azure是最不透明的,除非你是仪器.

### 锁定是2026年风险

单个高层级的承诺是很好的,当一个模型占主导地位. 2026年,边界每月移动 克劳德 3.7 一季度,双胞胎 2.5 下一个季度,GPT-5 后一个季度.锁定一个平台锁定你两个三分之一的边界.

模式工作团队采用:任何产品关键的LLM调用时至少有两家提供商.Bedrock加上Azure OpenAI是一个共同的对Claude,另一种GPT,它们之间的故障,相同的门户.成本上升是微不足道的,因为门户路线是最佳的;停机期间可用性上升 (如Azure OpenAI2025年1月事件,AWS us-east-1停机) 是决定性的.

### 数据居住,BAA和受监管的行业

床:大多数地区的BAA;VPC终端点;防护.常见的金融科技默认.
 Azure OpenAI: HIPAA,SOC 2,ISO 27001;欧盟数据居住权;企业规范的默认.
根据"环保标准"的规定,

它们都符合基本的选项框. 差异在于数据保留政策,记录处理方式以及滥用监测是否读取您的流量 (大多数情况下默认选择进入;企业可选择退出).

### 你应该记住的数字

- 在Llama 3.1 405B等级的Azure OpenAI中介TTF: ~50 ms (含PTU).
- 床床中位数TTFT按要求: ~75 ms.
- 床提供过量: $21-$每个单位50小时.
- 光电源平衡率:持续使用率为40-60%.
- 储蓄与使用量高的需求:最高70%.

```figure
i4-platform-lanes
```

## 用它

`code/main.py`通过测试,测试了三种平台的合成工作负载,它模拟了需求对比PTU经济学,TTFT差异和成本归因忠诚度.运行它来看看PTU在哪里收益,以及市场的模型宽度在哪里超过TTFT差距.

## 运送它

这一课产生了`outputs/skill-managed-platform-picker.md`鉴于工作负载配置 (需要的模型,TTFT SLA,每日量,合规要求),它建议一个主要平台,一个倒退和一个FinOps仪器计划.

## 运动

1. 跑步`code/main.py`根据要求,Azure PTU 能比70B类型的需求更好?
2. 设计一个两个供应商的部署, 进入哪个超级级级, 哪个门口坐着前面, 什么是故障转移政策?
3. 监管的医疗保健客户需要BAA,美国东部数据居住,以及100ms以下P99TTFT.
4. 你发现你的Bedrock账单本月增长了四倍,没有交通变化.没有应用程序推理资料,你怎么会找到罪犯?
5. 阅读人类API和贝德罗克的价格页面. 对于一个100M代币/月的克劳德工作负载,哪个更便宜?

## 关键词

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Bedrock | "AWS LLM service" | Model marketplace across Claude, Llama, Titan, Mistral, Cohere |
| Azure OpenAI | "Azure's ChatGPT" | Exclusive OpenAI models in Azure datacenters with enterprise controls |
| Vertex AI | "Google's LLM" | Gemini-first platform with Model Garden for third-party models |
| PTU | "dedicated capacity" | Provisioned Throughput Unit — reserved inference GPUs, priced per hour |
| Application Inference Profile | "Bedrock tagging" | Per-product cost/usage profile with tags, CloudWatch-native |
| Model Garden | "Vertex catalog" | Vertex AI's third-party model section, separate from Gemini |
| Two-provider minimum | "LLM redundancy" | Policy of running every critical LLM path across ≥2 hyperscalers |
| BAA | "HIPAA paperwork" | Business Associate Agreement; required for PHI; provided by all three |
| Abuse monitoring | "the log watcher" | Provider-side safety scan on prompts/outputs; opt-out in enterprise |

## 进一步阅读

- [AWS Bedrock Pricing](https://aws.amazon.com/bedrock/pricing/)权威率卡和提供通量定价.
- [Azure OpenAI Service Pricing](https://azure.microsoft.com/en-us/pricing/details/azure-openai/) PTU经济学和利率卡
- [Vertex AI Generative AI Pricing](https://cloud.google.com/vertex-ai/generative-ai/pricing)双子座和模型园的附加费用.
- [Artificial Analysis LLM Leaderboard](https://artificialanalysis.ai/)提供商之间持续延迟和吞吐量基准.
- [The AI Journal — AWS Bedrock vs Azure OpenAI CTO Guide 2026](https://theaijournal.co/2026/03/aws-bedrock-vs-azure-openai/)企业决策框架
- [Finout — Bedrock vs Vertex vs Azure FinOps](https://www.finout.io/blog/bedrock-vs.-vertex-vs.-azure-cognitive-a-finops-comparison-for-ai-spend) 配属机制
