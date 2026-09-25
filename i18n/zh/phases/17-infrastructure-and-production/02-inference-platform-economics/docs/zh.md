# 推理平台经济学 — Fireworks、Together、Baseten、Modal、Replicate、Anyscale

> 2026 年的推理市场已不再是单纯的 GPU 时间租赁。它分化为三大板块：定制芯片(Groq、Cerebras、SambaNova)、GPU 平台(Baseten、Together、Fireworks、Modal),以及 API 优先的市场(Replicate、DeepInfra)。Fireworks 以 $1/hr per GPU on May 1, 2026, and $40 亿美元的估值融资，每日处理超过 10 万亿 token,这说明以吞吐量驱动的模式是行得通的。Baseten 于 2026 年 1 月完成了 $300M Series E at $5 亿美元的融资。竞争定位规则很简单：Fireworks 优化延迟，Together 优化目录广度，Baseten 优化企业级品质，Modal 优化 Python 原生开发者体验，Replicate 优化多模态覆盖，Anyscale 优化分布式 Python。本课为你提供一个可以直接交给创始人的决策矩阵。

**Type:** Learn
**Languages:** Python (标准库，简易的单次调用经济性比较器)
**Prerequisites:** 阶段 17 · 01(托管 LLM 平台)、阶段 17 · 04(Serving Engine 内部机制)
**Time:** 约 60 分钟

## 学习目标

- 说出三大市场细分(定制芯片、GPU 平台、API 优先)，并将每个供应商映射到对应细分。
- 解释为什么“按 token 计费”的 API 定价模式是向 serving engine 的成本曲线收敛，而不是向硬件成本收敛。
- 计算至少三家供应商的每请求有效成本，并解释何时按分钟计费(Baseten、Modal)优于按 token 计费。
- 针对给定的工作负载(serverless 突发型、稳定高吞吐、微调变体、多模态)，判断哪个平台是正确的默认选择。

## 问题所在

你已经评估过托管型超大规模云平台。你决定需要一个更专注、更快的供应商——用 Fireworks 是为了延迟，用 Together 是为了广度，用 Baseten 是为了部署微调过的定制模型。现在你面前有六个真实的选择，而它们的定价页面根本无法直接对齐。Fireworks 显示 $/M tokens; Baseten shows $/分钟；Modal 显示 $/second; Replicate shows $/次预测。如果不建立工作负载模型，你无法对它们进行逐项对比。

更麻烦的是，每个定价页面背后的商业模式也不同。Fireworks 在共享 GPU 上运行自研引擎(FireAttention);其按 token 计费的费率反映的是他们的利用率曲线。Baseten 给你 Truss + 独占 GPU;按分钟计费反映的是独占性。Modal 是真正的 Python serverless——按秒计费，且冷启动时间不到一秒。同样的输出(一次 LLM 响应)，却对应三种完全不同的成本函数。

本课将对这六家进行建模，并告诉你每家分别在什么时候是赢家。

## 核心概念

### 三大细分市场

**定制芯片** — Groq (LPU)、Cerebras (WSE)、SambaNova (RDU)。在相同模型上，其解码速度通常比基于 GPU 的集群快 5-10 倍。单 token 价格更高(Groq 在 2025 年底 Llama-70B 上约为 $0.99/百万 token),但对于延迟敏感的使用场景来说是无可匹敌的。Groq 是语音智能体和实时翻译场景下的生产首选。

**GPU 平台** — Baseten、Together、Fireworks、Modal、Anyscale。运行在 NVIDIA(H100、H200、2026 年的 B200)或有时是 AMD 上。它们是处于“原始 GPU 租赁”(RunPod、Lambda)和“超大规模云托管服务”(Bedrock)之间的经济层。

**API 优先的市场** — Replicate、DeepInfra、OpenRouter、Fal。目录广泛，按次预测或按秒付费，强调首次调用的时间成本。

### Fireworks — 延迟优化的 GPU 平台

- FireAttention 引擎(定制)；宣称在同等配置下，延迟比 vLLM 低 4 倍。
- 针对非交互式工作负载，提供约为 serverless 费率 50% 的批量(Batch)档位。
- 微调后的模型以与基础模型相同的费率提供服务——这是相比那些对 LoRA 收取溢价的供应商的真正差异化优势。
- 2026 年中：自 2026 年 5 月 1 日起，按需 GPU 租赁价格上调至 $1/小时。规模采购价格可议。
- 财务信号：估值 $40 亿，每日处理超过 10 万亿 token。

### Together — 广度优化

- 提供 200 多个模型，其中开源模型在上游发布后几天内即可上线。
- 在等效 LLM 模型上比 Replicate 便宜 50-70%——“AI 原生云(AI Native Cloud)”的定位核心在于吞吐量和目录广度。
- 推理 + 微调 + 训练，一个 API 全搞定。

### Baseten — 企业级品质优化

- Truss 框架：在一个清单(manifest)中搞定模型打包、依赖、密钥和 serving 配置。
- GPU 范围从 T4 到 B200。按分钟计费，并有合理的冷启动缓解措施。
- 通过 SOC 2 Type II,支持 HIPAA。是金融科技和医疗健康领域的常见选择。
- 从 CapitalG、IVP、NVIDIA 处融资 $5B valuation, January 2026 Series E ($3 亿美元)。

### Modal — Python 原生优化

- 纯 Python 中的基础设施即代码(Infrastructure-as-code)。用 `@modal.function(gpu="A100")` 修饰一个函数，一条命令即可完成部署。
- 按秒计费。配合预热，冷启动时间 2-4 秒；小型模型 <1 秒。
- $87M Series B at $11 亿美元估值(2025 年)。在独立调查中拥有最强的开发者体验评分。

### Replicate — 多模态广度

- 按次预测付费。是图像、视频和音频模型的默认平台。
- 拥有强大的集成生态(Zapier、Vercel、CMS 插件)。
- 在 LLM 单 token 费率上竞争力较弱，但在多模态多样性上处于领先。

### Anyscale — Ray 原生

- 基于 Ray 构建；RayTurbo 是 Anyscale 的专有推理引擎(与 vLLM 竞争)。
- 最适合分布式 Python 工作负载，推理只是更大计算图中的一个节点。
- 提供 Ray 集群托管；与 Ray AIR 和 Ray Serve 紧密集成。

### 按 token 计费对比按分钟计费 — 何时谁赢

当工作负载对延迟不敏感且呈突发型时，按 token 计费是合理的——用多少付多少。当利用率高且可预测时，按分钟计费是合理的——一旦你让 GPU 饱和运行，它就会优于按 token 计费。

粗略规则：对于在专属 GPU 上持续利用率超过 30% 的工作负载，按分钟计费(Baseten、Modal)开始优于按 token 计费(Fireworks、Together)。低于该值，按 token 计费胜出，因为你可以避免为闲置时间付费。

### 定制引擎才是真正的护城河

上文所有基于 vLLM 和 SGLang 之上的平台都声称拥有定制引擎。FireAttention、RayTurbo、Baseten 的推理栈。定制引擎的声明带有营销色彩——更客观的说法是：vLLM + SGLang 占据了生产级开源推理约 80% 的份额，平台层的差异化因素在于 DX、溯源能力和 SLA。

### 需要记住的关键数据

- Fireworks GPU 租赁：自 2026 年 5 月 1 日起，价格上调至 $1/小时。
- Fireworks 宣称：在同等配置下，延迟比 vLLM 低 4 倍。
- Together:在 LLM 上比 Replicate 便宜 50-70%。
- Baseten 估值：$5B (Series E, Jan 2026, $3 亿美元融资轮)。
- Modal 估值：$11 亿(B 轮，2025 年)。
- 在持续利用率超过约 30% 时，按分钟计费优于按 token 计费。

```figure
cost-per-token
```

## 实际应用

`code/main.py` 在不同计费模式下，基于模拟工作负载对这六家供应商进行了对比。它会输出 $/day and effective $/百万 token 的结果。运行它以寻找按 token 计费和按分钟计费之间的盈亏平衡点。

## 上线部署

本课会产出 `outputs/skill-inference-platform-picker.md`。它根据工作负载画像、SLA 和预算，选出首选推理平台，并指出备选方案。

## 练习

1. 运行 `code/main.py`。在单张 H100 上运行一个 70B 模型时，持续利用率达到多少，Baseten(按分钟计费)才能超越 Fireworks(按 token 计费)？自己推导出交叉点，并与经验法则进行比较。
2. 你的产品同时包含图像生成、聊天和语音转文字。为每种模态选择平台，并命名一个能够将它们统一起来的网关(gateway)模式。
3. Fireworks 将你的主力模型价格上调了 $1/小时。假设你 40% 的流量转移到批量档位(半价)，请建立混合成本影响模型。
4. 一位受监管的客户要求同时具备 SOC 2 Type II + HIPAA + 专属 GPU。哪三个平台符合条件？在 FinOps 层面谁表现最佳？
5. 对比 Llama 3.1 70B 在 Fireworks serverless、Together 按需、Baseten 专属和 Replicate API 上每 1,000 次预测的成本。在每天 10 次预测时哪个最便宜？在每天 10,000 次时呢？

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|----------------|------------------------|
| 定制芯片 (Custom silicon) | “非 GPU 芯片” | Groq LPU、Cerebras WSE、SambaNova RDU — 专为解码优化 |
| FireAttention | “Fireworks 引擎” | 定制注意力核；宣称延迟比 vLLM 低 4 倍 |
| Truss | “Baseten 的格式” | 模型打包清单；依赖 + 密钥 + serving 配置 |
| 按 token 计费 (Per-token) | “API 定价” | 按消耗的 token 计费；不为闲置付费 |
| 按分钟计费 (Per-minute) | “专属定价” | 按墙钟时间 GPU 时长计费；在高利用率下胜出 |
| 按次预测计费 (Per-prediction) | “Replicate 定价” | 按模型调用次数计费；常见于图像/视频 |
| RayTurbo | “Anyscale 引擎” | 基于 Ray 的专有推理；在 Ray 集群上与 vLLM 竞争 |
| 批量档位 (Batch tier) | “五折” | 非交互式队列的优惠费率；常见于 Fireworks、OpenAI |
| 基础费率微调 (Fine-tuned at base rate) | “Fireworks LoRA” | 对由 LoRA 服务的请求按基础模型费率计费(差异化优势) |

## 延伸阅读

- [Fireworks 定价](https://fireworks.ai/pricing) — 按 token 费率、批量档位、GPU 租赁。
- [Baseten 定价](https://www.baseten.co/pricing/) — 按分钟费率、预承诺容量、企业级档位。
- [Modal 定价](https://modal.com/pricing) — 按秒 GPU 费率及免费额度。
- [Together AI 定价](https://www.together.ai/pricing) — 模型目录及按 token 费率。
- [Anyscale 定价](https://www.anyscale.com/pricing) — RayTurbo 及 Ray 托管定价。
- [Northflank — Fireworks AI 替代方案](https://northflank.com/blog/7-best-fireworks-ai-alternatives-for-inference) — 对比评估。
- [Infrabase — 2026 年 AI 推理 API 供应商](https://infrabase.ai/blog/ai-inference-api-providers-compared) — 供应商全景图。