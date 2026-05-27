# 推理平台经济学 — Fireworks、Together、Baseten、Modal、Replicate、Anyscale

> 2026 年的推理市场不再是 GPU 时间租赁。它分化为定制芯片（Groq、Cerebras、SambaNova）、GPU 平台（Baseten、Together、Fireworks、Modal）和 API 优先市场（Replicate、DeepInfra）。Fireworks 在 2026 年 5 月 1 日将 GPU 价格提高 1 美元/小时，400 亿美元估值和每天 10T+ token 说明量驱动模式有效。Baseten 在 2026 年 1 月以 50 亿美元估值完成 3 亿美元 E 轮融资。竞争定位规则很简单：Fireworks 优化延迟，Together 优化目录广度，Baseten 优化企业打磨，Modal 优化 Python 原生开发者体验，Replicate 优化多模态覆盖，Anyscale 优化分布式 Python。本课给你一个可以交给创始人的矩阵。

**类型：** 学习
**语言：** Python（标准库，简单的每次调用经济学比较器）
**先修要求：** 阶段 17 · 01（托管 LLM 平台）、阶段 17 · 04（vLLM 服务内部原理）
**时间：** 约 60 分钟

## 学习目标

- 说出三个细分市场（定制芯片、GPU 平台、API 优先）并将每个供应商映射到一个细分市场。
- 解释为什么"每 token"API 定价模型向服务引擎的成本曲线压缩，而不是硬件的成本曲线。
- 计算至少三家供应商的有效每次请求成本，并解释何时按分钟计费（Baseten、Modal）优于按 token 计费。
- 为给定工作负载（无服务器突发、稳定高吞吐量、微调变体、多模态）确定哪个平台是合适的默认选择。

## 问题

你评估了托管超大规模云厂商平台。你决定需要一个更窄、更快的提供商——Fireworks 用于延迟，Together 用于广度，Baseten 用于微调自定义模型。现在你有六个真正的选择，而定价页面对不上。Fireworks 显示美元/百万 token；Baseten 显示美元/分钟；Modal 显示美元/秒；Replicate 显示美元/预测。你无法在没有建模工作负载的情况下直接比较它们。

更糟糕的是，每个定价页面背后的商业模式都不同。Fireworks 在共享 GPU 上运行自己的定制引擎（FireAttention）；每 token 费率反映了他们的利用率曲线。Baseten 给你 Truss + 专用 GPU；按分钟计费反映了排他性。Modal 是真正的 Python 无服务器——按秒计费，亚秒级冷启动。相同的输出（一个 LLM 响应），三种不同的成本函数。

本课对这六家进行建模，并告诉你各自在何时胜出。

## 概念

### 三个细分市场

**定制芯片**——Groq（LPU）、Cerebras（WSE）、SambaNova（RDU）。在相同模型上，解码速度通常比基于 GPU 的集群快 5-10 倍。每 token 价格更高（Groq 在 2025 年底在 Llama-70B 上约 0.99 美元/百万 token），但对于延迟敏感的用例无可匹敌。Groq 是语音代理和实时翻译的生产选择。

**GPU 平台**——Baseten、Together、Fireworks、Modal、Anyscale。在 NVIDIA（2026 年的 H100、H200、B200）或有时是 AMD 上运行。"原始 GPU 租赁"（RunPod、Lambda）和"超大规模云厂商托管服务"（Bedrock）之间的经济层。

**API 优先市场**——Replicate、DeepInfra、OpenRouter、Fal。广泛的目录，按预测或按秒付费，强调首次调用时间。

### Fireworks——延迟优化的 GPU 平台

- FireAttention 引擎（定制）；在等效配置上比 vLLM 低 4 倍延迟（市场宣传）。
- 批处理层约为无服务器费率的 50%，用于非交互式工作负载。
- 微调模型以与基础模型相同的费率提供服务——与对 LoRA 收取溢价的提供商相比，这是一个真正的差异化因素。
- 2026 年中：自 2026 年 5 月 1 日起，按需 GPU 租赁提高 1 美元/小时。规模定价可协商。
- 财务信号：400 亿美元估值，每天处理 10T+ token。

### Together——广度优化

- 200+ 模型，包括上游发布后几天内的开源版本。
- 在等效 LLM 模型上比 Replicate 便宜 50-70%——"AI 原生云"定位是量和目录。
- 一个 API 中的推理 + 微调 + 训练。

### Baseten——企业打磨优化

- Truss 框架：带依赖项、密钥、服务配置在一个清单中的模型打包。
- GPU 范围从 T4 到 B200。按分钟计费，具有合理的冷启动缓解。
- SOC 2 Type II，支持 HIPAA。常见的金融科技和医疗保健选择。
- 2026 年 1 月 E 轮融资 50 亿美元估值（来自 CapitalG、IVP、NVIDIA 的 3 亿美元）。

### Modal——Python 原生优化

- 纯 Python 中的基础设施即代码。用 `@modal.function(gpu="A100")` 装饰函数，用一个命令部署。
- 按秒计费。冷启动 2-4 秒，带预热；小模型 <1 秒。
- 2025 年 B 轮融资 8700 万美元，估值 11 亿美元。独立调查中开发者体验得分最高。

### Replicate——多模态广度

- 按预测付费。图像、视频和音频模型的默认平台。
- 集成生态系统（Zapier、Vercel、CMS 插件）。
- LLM 每 token 费率竞争力较弱，但在多模态多样性上胜出。

### Anyscale——Ray 原生

- 基于 Ray 构建；RayTurbo 是 Anyscale 的专有推理引擎（与 vLLM 竞争）。
- 最适合分布式 Python 工作负载，其中推理步骤是更大图中的一个节点。
- 托管 Ray 集群；与 Ray AIR 和 Ray Serve 紧密集成。

### 每 token vs 每分钟——各自胜出的时机

当工作负载对延迟不敏感且突发时，每 token 有意义——你只为使用的内容付费。当利用率高且可预测时，每分钟有意义——一旦你使 GPU 饱和，你就会击败每 token。

粗略规则：对于专用 GPU 上约 30% 以上的持续利用率，按分钟计费（Baseten、Modal）开始击败按 token 计费（Fireworks、Together）。低于此值，每 token 胜出，因为你避免了为空闲付费。

### 定制引擎是真正的护城河

vLLM 和 SGLang 之上的每个平台都声称拥有定制引擎。FireAttention、RayTurbo、Baseten 的推理栈。定制引擎的说法带有营销色彩——诚实的框架是 vLLM + SGLang 约占生产开源推理的 80%，平台层的差异化因素是开发者体验、归因和 SLA。

### 你应该记住的数字

- Fireworks GPU 租赁：2026 年 5 月 1 日起提高 1 美元/小时。
- Fireworks 声称：在等效配置上比 vLLM 低 4 倍延迟。
- Together：在 LLM 上比 Replicate 便宜 50-70%。
- Baseten 估值：50 亿美元（2026 年 1 月 E 轮，3 亿美元轮次）。
- Modal 估值：11 亿美元（2025 年 B 轮）。
- 持续利用率约 30% 以上时，按分钟计费击败按 token 计费。

## 使用它

`code/main.py`在跨定价模型的合成工作负载上比较六家供应商。报告美元/天和有效美元/百万 token。运行它以找到每 token 和每 minutes 之间的盈亏平衡点。

## 交付它

本课生成 `outputs/skill-inference-platform-picker.md`。给定工作负载配置文件、SLA 和预算，选择主要推理平台并命名亚军。

## 练习

1. 运行 `code/main.py`。对于一块 H100 上的 70B 模型，Baseten（按分钟）在何种持续利用率下击败 Fireworks（按 token）？自己推导交叉点，并与经验法则进行比较。
2. 你的产品提供图像生成 + 聊天 + 语音转文本。为每个模态选择平台，并命名统一它们的网关模式。
3. Fireworks 对主要模型提价 1 美元/小时。如果 40% 的流量转移到批处理层（50% 折扣），建模混合成本影响。
4. 受监管的客户需要 SOC 2 Type II + HIPAA + 专用 GPU。哪三个平台可行，哪个在 FinOps 上胜出？
5. 比较 Fireworks 无服务器、Together 按需、Baseten 专用和 Replicate API 上 Llama 3.1 70B 的每 1,000 次预测成本。在 10 次预测/天时哪个最便宜？在 10,000 次时呢？

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|----------------|------------------------|
| Custom silicon | "非 GPU 芯片" | Groq LPU、Cerebras WSE、SambaNova RDU——针对解码优化 |
| FireAttention | "Fireworks 引擎" | 定制注意力内核；市场宣传比 vLLM 低 4 倍延迟 |
| Truss | "Baseten 的格式" | 模型打包清单；依赖项 + 密钥 + 服务配置 |
| Per-token | "API 定价" | 按消耗 token 收费；不为空闲付费 |
| Per-minute | "专用定价" | 按挂钟 GPU 时间收费；在高利用率时胜出 |
| Per-prediction | "Replicate 定价" | 按模型调用收费；常见于图像/视频 |
| RayTurbo | "Anyscale 引擎" | Ray 上的专有推理；在 Ray 集群上与 vLLM 竞争 |
| Batch tier | "50% 折扣" | 以降低的费率提供的非交互式队列；Fireworks、OpenAI 常见 |
| Fine-tuned at base rate | "Fireworks LoRA" | 以基础模型费率收取 LoRA 服务请求（差异化因素） |

## 延伸阅读

- [Fireworks 定价](https://fireworks.ai/pricing)——每 token 费率、批处理层、GPU 租赁。
- [Baseten 定价](https://www.baseten.co/pricing/)——每 minute 费率、承诺容量、企业层级。
- [Modal 定价](https://modal.com/pricing)——每 second GPU 费率和免费层级。
- [Together AI 定价](https://www.together.ai/pricing)——模型目录和每 token 费率。
- [Anyscale 定价](https://www.anyscale.com/pricing)——RayTurbo 和托管 Ray 定价。
- [Northflank——Fireworks AI 替代品](https://northflank.com/blog/7-best-fireworks-ai-alternatives-for-inference)——比较评估。
- [Infrabase——AI 推理 API 提供商 2026](https://infrabase.ai/blog/ai-inference-api-providers-compared)——供应商格局。
