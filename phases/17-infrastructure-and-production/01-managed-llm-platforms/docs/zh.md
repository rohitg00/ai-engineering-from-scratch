# 托管 LLM 平台 — Bedrock、Vertex AI、Azure OpenAI

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 三家超大规模云厂商，三种截然不同的策略。AWS Bedrock 是模型市集 — Claude、Llama、Titan、Stability、Cohere 共用一个 API。Azure OpenAI 是与 OpenAI 的独家合作，外加 Provisioned Throughput Units（PTU，预留吞吐单元）来锁定专属容量。Vertex AI 以 Gemini 为先，长 context 与多模态故事讲得最好。2026 年 Artificial Analysis 在等价的 Llama 3.1 405B 部署上测得 Azure OpenAI 中位数延迟约 50 ms，Bedrock 约 75 ms — 差距来自 PTU，因为专属容量天然胜过共享按需容量。决策要点不是「谁最快」而是「哪家的模型目录和 FinOps 形态最匹配我的产品」。本课教你把权衡白纸黑字写下来再选，而不是凭感觉。

**Type:** Learn
**Languages:** Python (stdlib, toy cost-and-latency comparator)
**Prerequisites:** Phase 11 (LLM Engineering), Phase 13 (Tools & Protocols)
**Time:** ~60 minutes

## 学习目标（Learning Objectives）

- 说出三种平台策略（市集 vs 独家 vs Gemini 优先），并把每种对应到一类产品场景。
- 解释 Provisioned Throughput Units（PTU）在 Azure OpenAI 里到底买到了什么，以及为什么按需 Bedrock 在 405B 量级下通常慢约 25 ms。
- 画出每个平台的 FinOps 归因形态（Bedrock Application Inference Profiles vs Vertex 一团队一 project vs Azure scope + PTU 预留）。
- 写下一份「至少两家供应商」策略，并解释为什么单厂锁定是 2026 年最贵的错。

## 问题（The Problem）

你为产品选了 Claude 3.7 Sonnet。现在要把它跑起来对外服务。可以直接调 Anthropic API、可以走 AWS Bedrock，也可以走 gateway。直连 API 最简单；Bedrock 加上了 BAA、VPC 端点、IAM 和 CloudWatch 归因。Gateway 又加上了故障切换、统一计费和跨供应商的限流。

更深的问题是模型目录。如果你的产品同时需要 Claude、Llama 和 Gemini，你没法在一家全买齐 — 除非这一家是「Bedrock + Vertex + Azure OpenAI 三件套」。三家超大规模云厂商不可互换 — 各自押注了不同的「谁掌握模型层」。

本课就来梳理这三种押注、延迟差距、FinOps 差距和锁定风险。

## 概念（The Concept）

### 三种策略（Three strategies）

**AWS Bedrock** — 市集模式。Claude（Anthropic）、Llama（Meta）、Titan（AWS 自家）、Stability（图像）、Cohere（embedding）、Mistral，再加上图像和 embedding 的子目录。一个 API、一套 IAM、一份 CloudWatch 导出。Bedrock 的赌注是：客户更想要选择权，而不是单一某个模型。

**Azure OpenAI** — 独家合作模式。你能拿到 GPT-4 / 4o / 5 / o 系列、DALL·E、Whisper，以及在 Azure 数据中心里微调 OpenAI 模型。「Azure OpenAI Service」目录里没有非 OpenAI 模型 — 那些归 Azure AI Foundry（独立产品）。Azure 的赌注是：OpenAI 仍是前沿，客户需要在这条特定关系上获得企业级管控。

**Vertex AI** — Gemini 优先，其他靠后。Gemini 1.5 / 2.0 / 2.5 的 Flash 与 Pro，再加 Model Garden（第三方）。Vertex 的赌注是多模态长 context — 1M token 的 Gemini context 就是差异化武器。

### 规模上的延迟差（Latency gap at scale）

Artificial Analysis 在持续跑基准。在等价的 Llama 3.1 405B 部署（共享按需）上，Azure OpenAI 首 token 中位数延迟约 50 ms；Bedrock 约 75 ms。这不是 AWS 的问题 — 是容量模型的差异。Azure 卖 PTU（Provisioned Throughput Units），把 GPU 容量预留给你的租户。Bedrock 也有同类产品（Provisioned Throughput），但起步价约 21 美元/小时/单元，多数客户还是停留在共享按需上。

按需共享容量要和其他客户的流量抢。专属容量不用抢。如果你的产品 SLA 是 P99 TTFT < 100 ms，要么在 Azure 上买 PTU，要么买 Bedrock Provisioned Throughput，要么接受默认的方差。

### Provisioned Throughput 经济学（Provisioned Throughput economics）

Azure PTU：一块预留的推理算力。对可预测负载相比按需可省最多约 70%。每小时固定计费，无论流量多少 — 闲置时也付钱。盈亏平衡点通常落在持续利用率 40–60% 左右。

Bedrock Provisioned Throughput：依模型和 region 不同，21–50 美元/小时。算式类似 — 盈亏点在峰值利用率一半左右。需要按月承诺。

Vertex 的预留容量按 Gemini SKU 出售；定价随模型和 region 变化，公开宣传得也少。

### FinOps 形态 — 真正的差异化（FinOps surface — the real differentiator）

**Bedrock Application Inference Profiles** 是市集里最干净的归因方案。给一个 profile 打上 `team`、`product`、`feature` 标签；所有模型调用都路由经过它；CloudWatch 不用后处理就能按 profile 拆分成本。2025 年新增，至今仍是最细粒度的超大规模云原生方案。

**Vertex** 的归因是「一团队一 project + 全员打 label」。把每个团队建模成一个 GCP project，每个资源都打 label，再用 BigQuery Billing Export + DataStudio 做汇总。工作量更大，但 BigQuery 让你能对成本数据写任意 SQL。

**Azure** 依赖 subscription / resource-group 作用域加 tag，把 PTU 预留作为一等成本对象。tag 是从 resource group 继承下来的，不是从 request 来的，所以做单请求级归因得靠 Application Insights 自定义指标，或者一个会盖头部的 gateway。

规律：Bedrock 原生最干净，Vertex 借 BigQuery 最灵活，Azure 在不打桩的情况下最不透明。

### 锁定是 2026 年的风险（Lock-in is the 2026 risk）

当一个模型一统江湖时，绑死单一超大规模云厂商是没问题的。但 2026 年前沿月月在动 — 这季度 Claude 3.7、下季度 Gemini 2.5、再下季度 GPT-5。锁定一家平台就等于把自己挡在三分之二的前沿之外。

实战团队采用的范式是：任何对产品关键的 LLM 调用，都至少跑两家供应商。Bedrock + Azure OpenAI 是常见组合 — Claude 走一家、GPT 走另一家，互为故障切换，同一个 gateway。成本溢价可以忽略，因为 gateway 会路由到最优；而宕机时（比如 2025 年 1 月 Azure OpenAI 故障、AWS us-east-1 故障）的可用性提升是决定性的。

### 数据驻留、BAA 与受监管行业（Data residency, BAAs, and regulated industries）

Bedrock：多数 region 提供 BAA；VPC 端点；guardrails（护栏）。常见的金融科技默认选项。
Azure OpenAI：HIPAA、SOC 2、ISO 27001；欧盟数据驻留；受监管企业的默认选项。
Vertex：HIPAA、GDPR、按 region 数据驻留；Google Cloud 的合规栈。

三家都过基本打钩项。差异在数据保留策略、日志怎么处理、滥用监控（abuse monitoring）会不会读你的流量（多数默认开启；企业可关闭）。

### 你应该记住的数字（Numbers you should remember）

- Azure OpenAI 在 Llama 3.1 405B 等价部署上的 TTFT 中位数：~50 ms（带 PTU）。
- Bedrock 按需 TTFT 中位数：~75 ms。
- Bedrock Provisioned Throughput：21–50 美元/小时/单元。
- Azure PTU 盈亏平衡点：~40–60% 持续利用率。
- 高利用率下 PTU 相比按需的节省幅度：最多 70%。

## 用起来（Use It）

`code/main.py` 在一个合成负载上对比三家平台 — 它会建模按需 vs PTU 的经济学、TTFT 方差以及成本归因保真度。跑一遍看看 PTU 在哪儿划得来、市集的模型广度何时压过 TTFT 差距。

## 上线部署（Ship It）

本课产出 `outputs/skill-managed-platform-picker.md`。给定一份负载画像（需要的模型、TTFT SLA、日均量、合规要求），它会推荐一个主平台、一个备用平台和一份 FinOps 打桩方案。

## 练习（Exercises）

1. 跑 `code/main.py`。对一个 70B 量级模型，持续利用率到多少时 Azure PTU 才打得过按需？算出盈亏点并和宣传的 40–60% 区间对比。
2. 你的产品需要 Claude 3.7 Sonnet 和 GPT-4o。设计一份双供应商部署 — 哪个走哪家超大规模云？前面坐什么 gateway？故障切换策略是什么？
3. 一个受监管的医疗客户要求 BAA、美东数据驻留、P99 TTFT 低于 100 ms。挑一个平台，用三个具体功能为你的选择背书。
4. 你发现这个月 Bedrock 账单涨了 4 倍但流量没变。没有 Application Inference Profiles 时，你怎么揪出元凶？有 profiles 时又要多久？
5. 读一遍 Azure OpenAI 和 Bedrock 的定价页。对一个 1 亿 token/月的 Claude 负载，哪种更便宜 — 直连 Anthropic API、Bedrock 按需，还是 Bedrock Provisioned Throughput？

## 关键术语（Key Terms）

| 术语 | 大家通常这么说 | 实际含义 |
|------|----------------|------------------------|
| Bedrock | "AWS 的 LLM 服务" | 横跨 Claude、Llama、Titan、Mistral、Cohere 的模型市集 |
| Azure OpenAI | "Azure 的 ChatGPT" | OpenAI 模型独家在 Azure 数据中心运行，附带企业级管控 |
| Vertex AI | "Google 的 LLM" | Gemini 优先平台，第三方模型走 Model Garden |
| PTU | "专属容量" | Provisioned Throughput Unit，预留推理 GPU，按小时计费 |
| Application Inference Profile | "Bedrock 打标签" | 按产品维度的成本/用量 profile，带 tag，CloudWatch 原生 |
| Model Garden | "Vertex 目录" | Vertex AI 的第三方模型区，与 Gemini 分开 |
| Two-provider minimum | "LLM 冗余" | 关键 LLM 路径必须横跨 ≥2 家超大规模云的策略 |
| BAA | "HIPAA 的纸面手续" | Business Associate Agreement；处理 PHI 必备；三家都提供 |
| Abuse monitoring | "日志监工" | 供应商侧对 prompt / 输出做安全扫描；企业可关 |

## 延伸阅读（Further Reading）

- [AWS Bedrock Pricing](https://aws.amazon.com/bedrock/pricing/) — 权威费率表与 Provisioned Throughput 定价。
- [Azure OpenAI Service Pricing](https://azure.microsoft.com/en-us/pricing/details/cognitive-services/openai-service/) — PTU 经济学与费率表。
- [Vertex AI Generative AI Pricing](https://cloud.google.com/vertex-ai/generative-ai/pricing) — Gemini 分级与 Model Garden 加价。
- [Artificial Analysis LLM Leaderboard](https://artificialanalysis.ai/) — 各家供应商的延迟与吞吐持续基准。
- [The AI Journal — AWS Bedrock vs Azure OpenAI CTO Guide 2026](https://theaijournal.co/2026/03/aws-bedrock-vs-azure-openai/) — 企业决策框架。
- [Finout — Bedrock vs Vertex vs Azure FinOps](https://www.finout.io/blog/bedrock-vs.-vertex-vs.-azure-cognitive-a-finops-comparison-for-ai-spend) — 各家归因机制的并排对照。
