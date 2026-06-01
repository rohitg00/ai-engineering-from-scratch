# 02 · 推理平台经济学 —— Fireworks、Together、Baseten、Modal、Replicate、Anyscale

> 2026 年的推理市场已不再是单纯的 GPU 时间租赁，它正分化为三块：定制芯片（Groq、Cerebras、SambaNova）、GPU 平台（Baseten、Together、Fireworks、Modal）以及 API 优先的市场平台（Replicate、DeepInfra）。Fireworks 于 2026 年 5 月 1 日将每张 GPU 的单价上调 1 美元/小时，其在每日处理 10T+ tokens 的体量下获得 40 亿美元估值，说明这种由吞吐量驱动的模式确实跑得通。Baseten 在 2026 年 1 月完成 3 亿美元 E 轮融资，估值 50 亿美元。竞争定位的规律很简单：Fireworks 优化延迟，Together 优化目录广度，Baseten 优化企业级打磨，Modal 优化 Python 原生开发体验，Replicate 优化多模态覆盖，Anyscale 优化分布式 Python。这一课会给你一张可以直接递给创始人的对比矩阵。

**类型：** 学习
**语言：** Python（标准库，玩具级的单次调用经济性对比器）
**前置：** 第 17 阶段 · 01（托管 LLM 平台）、第 17 阶段 · 04（vLLM 服务内部原理）
**时长：** 约 60 分钟

## 学习目标

- 说出三个市场分段（定制芯片、GPU 平台、API 优先），并将每家厂商映射到对应分段。
- 解释为什么「按 token（per-token）」的 API 定价模型会向服务引擎的成本曲线收敛，而非向硬件的成本曲线收敛。
- 在至少三家厂商之间计算每次请求的有效成本，并说明何时「按分钟（per-minute）」（Baseten、Modal）会优于「按 token」。
- 针对给定工作负载（突发型 serverless、稳定高吞吐、微调变体、多模态），判断哪个平台是合理的默认选择。

## 问题所在

你已经评估过托管型超大规模云厂商（hyperscaler）平台。你决定需要一个更聚焦、更快的供应商 —— 用 Fireworks 追求延迟，用 Together 追求广度，用 Baseten 服务一个微调后的定制模型。现在你面前有六个真实选项，而它们的定价页根本对不上：Fireworks 给的是 $/M tokens；Baseten 给的是 $/minute；Modal 给的是 $/second；Replicate 给的是 $/prediction。不对工作负载建模，你根本无法把它们放在一起逐项比较。

更麻烦的是，每个定价页背后的商业模式都不一样。Fireworks 在共享 GPU 上运行自研引擎（FireAttention），其按 token 的费率反映的是自家的利用率曲线。Baseten 给你 Truss 加专属 GPU，按分钟计费反映的是独占性。Modal 是真正的 Python serverless —— 按秒计费，冷启动可达亚秒级。同样的产出（一段 LLM 响应），却对应三种不同的成本函数。

这一课对这六家进行建模，并告诉你各自在什么场景下胜出。

## 核心概念

### 三大分段

**定制芯片（Custom silicon）** —— Groq（LPU）、Cerebras（WSE）、SambaNova（RDU）。在同一模型上，其解码（decode）速度通常比基于 GPU 的集群快 5-10 倍。每 token 单价更高（2025 年底 Groq 在 Llama-70B 上约为 $0.99/M），但在对延迟敏感的用例上无可匹敌。Groq 是语音智能体和实时翻译的生产级首选。

**GPU 平台（GPU platforms）** —— Baseten、Together、Fireworks、Modal、Anyscale。运行在 NVIDIA（2026 年的 H100、H200、B200）上，有时也用 AMD。它们处在「裸 GPU 租赁」（RunPod、Lambda）与「超大规模云托管服务」（Bedrock）之间的经济层。

**API 优先的市场平台（API-first marketplaces）** —— Replicate、DeepInfra、OpenRouter、Fal。目录广泛，按预测次数（per-prediction）或按秒计费，强调首次调用的上手时间（time-to-first-call）。

### Fireworks —— 延迟优化型 GPU 平台

- FireAttention 引擎（自研）；宣传在同等配置下比 vLLM 延迟低 4 倍。
- 面向非交互式工作负载的批处理档（batch tier），价格约为 serverless 费率的 50%。
- 微调模型按与基础模型相同的费率提供服务 —— 相比那些为你的 LoRA 额外收费的供应商，这是一个真正的差异化优势。
- 2026 年年中：自 2026 年 5 月 1 日起，按需 GPU 租赁实际上调 1 美元/小时。规模化场景下批量定价可议。
- 财务信号：40 亿美元估值，每日处理 10T+ tokens。

### Together —— 广度优化型

- 200+ 模型，包括上游发布后数天内即跟进的开源版本。
- 在同等 LLM 模型上比 Replicate 便宜 50-70% —— 「AI Native Cloud」的定位卖点正是体量与目录。
- 推理 + 微调 + 训练统一在一套 API 中。

### Baseten —— 企业级打磨优化型

- Truss 框架：把依赖、密钥（secrets）、服务配置打包进一份清单（manifest）完成模型封装。
- GPU 范围从 T4 一路覆盖到 B200。按分钟计费，并有合理的冷启动缓解机制。
- SOC 2 Type II 认证，HIPAA-ready。金融科技与医疗行业的常见选择。
- 50 亿美元估值，2026 年 1 月 E 轮（来自 CapitalG、IVP、NVIDIA 的 3 亿美元）。

### Modal —— Python 原生优化型

- 用纯 Python 实现基础设施即代码（infrastructure-as-code）。用 `@modal.function(gpu="A100")` 装饰一个函数，一条命令即可部署。
- 按秒计费。预热（pre-warming）下冷启动 2-4 秒；小模型 <1 秒。
- 8700 万美元 B 轮，估值 11 亿美元（2025 年）。在多项独立调研中获得最高的开发者体验评分。

### Replicate —— 多模态广度

- 按预测次数计费。是图像、视频和音频模型的默认平台。
- 集成生态丰富（Zapier、Vercel、CMS 插件）。
- 在 LLM 按 token 费率上竞争力较弱，但在多模态品类丰富度上胜出。

### Anyscale —— Ray 原生

- 基于 Ray 构建；RayTurbo 是 Anyscale 自有的推理引擎（与 vLLM 竞争）。
- 最适合分布式 Python 工作负载 —— 推理步骤只是更大计算图中的一个节点。
- 提供托管 Ray 集群；与 Ray AIR 和 Ray Serve 深度集成。

### 按 token 还是按分钟 —— 各自何时胜出

当工作负载对延迟不敏感且呈突发型时，按 token 更合理 —— 你只为实际用量付费。当利用率高且可预测时，按分钟更合理 —— 一旦你把 GPU 跑满，按分钟就会胜过按 token。

粗略规律：对于一张专属 GPU 持续利用率超过约 30% 的工作负载，按分钟（Baseten、Modal）开始优于按 token（Fireworks、Together）。低于这一阈值时，按 token 胜出，因为你避免了为空闲付费。

### 自研引擎才是真正的护城河

上面每个平台之上的 vLLM 与 SGLang 都声称自己有自研引擎：FireAttention、RayTurbo、Baseten 的推理栈。自研引擎的说法带有营销色彩 —— 更诚实的表述是：vLLM + SGLang 大约占据了生产环境开源推理的 80%，而平台层的差异化主要在于开发体验（DX）、用量归因（attribution）与服务级别协议（SLA）。

### 你该记住的数字

- Fireworks GPU 租赁：自 2026 年 5 月 1 日起上调 1 美元/小时。
- Fireworks 宣称：同等配置下比 vLLM 延迟低 4 倍。
- Together：在 LLM 上比 Replicate 便宜 50-70%。
- Baseten 估值：50 亿美元（E 轮，2026 年 1 月，3 亿美元一轮）。
- Modal 估值：11 亿美元（B 轮，2025 年）。
- 持续利用率超过约 30% 时，按分钟胜过按 token。

## 上手实践

`code/main.py` 在一个合成工作负载上、跨多种定价模型对这六家厂商进行比较。它会报告 $/day 和有效的 $/M tokens。运行它，找出按 token 与按分钟之间的盈亏平衡点。

## 交付产出

这一课会产出 `outputs/skill-inference-platform-picker.md`。给定工作负载画像、SLA 与预算，它会选出首选推理平台并指出次选方案。

## 练习

1. 运行 `code/main.py`。对于运行在单张 H100 上的 70B 模型，在多大的持续利用率下 Baseten（按分钟）会胜过 Fireworks（按 token）？自己推导这个交叉点，并与经验法则对比。
2. 你的产品同时提供图像生成、聊天和语音转文字。为每种模态各选一个平台，并指出能将它们统一起来的网关（gateway）模式。
3. Fireworks 对你的主力模型每小时涨价 1 美元。如果 40% 的流量转移到批处理档（5 折），请对混合后的成本影响建模。
4. 一个受监管的客户要求 SOC 2 Type II + HIPAA + 专属 GPU。哪三个平台可行，又是哪一个在 FinOps 上胜出？
5. 比较 Llama 3.1 70B 在 Fireworks serverless、Together 按需、Baseten 专属、Replicate API 上每 1,000 次预测的成本。在每天 10 次预测时哪个最便宜？每天 10,000 次时呢？

## 关键术语

| 术语 | 大家怎么说 | 实际含义 |
|------|----------------|------------------------|
| 定制芯片（Custom silicon） | "非 GPU 芯片" | Groq LPU、Cerebras WSE、SambaNova RDU —— 为解码优化 |
| FireAttention | "Fireworks 的引擎" | 自研注意力内核；宣传比 vLLM 延迟低 4 倍 |
| Truss | "Baseten 的格式" | 模型封装清单；依赖 + 密钥 + 服务配置 |
| 按 token（Per-token） | "API 定价" | 按消耗的 token 计费；不为空闲付费 |
| 按分钟（Per-minute） | "专属定价" | 按 GPU 的实际占用时间（wall-clock）计费；高利用率下胜出 |
| 按预测次数（Per-prediction） | "Replicate 定价" | 按模型调用次数计费；图像/视频常用 |
| RayTurbo | "Anyscale 的引擎" | 基于 Ray 的自有推理；在 Ray 集群上与 vLLM 竞争 |
| 批处理档（Batch tier） | "5 折" | 以更低费率排队的非交互式队列；Fireworks、OpenAI 常见 |
| 微调按基础费率（Fine-tuned at base rate） | "Fireworks LoRA" | 对 LoRA 服务的请求按基础模型费率计费（差异化优势） |

## 延伸阅读

- [Fireworks Pricing](https://fireworks.ai/pricing) —— 按 token 费率、批处理档、GPU 租赁。
- [Baseten Pricing](https://www.baseten.co/pricing/) —— 按分钟费率、承诺容量、企业档。
- [Modal Pricing](https://modal.com/pricing) —— 按秒 GPU 费率与免费额度。
- [Together AI Pricing](https://www.together.ai/pricing) —— 模型目录与按 token 费率。
- [Anyscale Pricing](https://www.anyscale.com/pricing) —— RayTurbo 与托管 Ray 定价。
- [Northflank — Fireworks AI Alternatives](https://northflank.com/blog/7-best-fireworks-ai-alternatives-for-inference) —— 对比评估。
- [Infrabase — AI Inference API Providers 2026](https://infrabase.ai/blog/ai-inference-api-providers-compared) —— 厂商格局。
