# 推理平台经济学 — Fireworks、Together、Baseten、Modal、Replicate、Anyscale

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 2026 年的推理（inference）市场已经不再是单纯出租 GPU 时间。它分化为三块：定制硅（Groq、Cerebras、SambaNova）、GPU 平台（Baseten、Together、Fireworks、Modal）、以及 API 优先的市场型平台（Replicate、DeepInfra）。Fireworks 在 2026 年 5 月 1 日把单 GPU 租金涨了 1 美元/小时，凭着每天 10T+ tokens 的吞吐拿到 40 亿美元估值，告诉你这种「跑量」模型是行得通的。Baseten 在 2026 年 1 月以 50 亿美元估值完成 3 亿美元 E 轮。竞争定位的规律很简单：Fireworks 优化 latency（延迟），Together 优化目录广度，Baseten 优化企业级打磨，Modal 优化 Python 原生开发体验，Replicate 优化多模态覆盖，Anyscale 优化分布式 Python。本课给你一张可以直接递给创始人的对比矩阵。

**Type:** Learn
**Languages:** Python（标准库，玩具版按调用对比成本）
**Prerequisites:** Phase 17 · 01（Managed LLM Platforms），Phase 17 · 04（vLLM Serving Internals）
**Time:** ~60 分钟

## 学习目标（Learning Objectives）

- 说出三个市场分段（定制硅、GPU 平台、API 优先）并把每家厂商对号入座。
- 解释为什么「按 token 计费」的 API 定价模型会向 serving 引擎的成本曲线、而不是硬件成本曲线收敛。
- 在至少三家厂商上算出每次请求的有效成本，并解释什么时候按分钟计费（Baseten、Modal）会赢过按 token 计费。
- 针对给定负载（serverless 突发型、稳定高吞吐、微调变体、多模态）判断哪个平台是合理的默认选项。

## 问题（Problem）

你已经评估过托管型超大规模厂商（hyperscaler）平台。你决定换一家更窄、更快的供应商——Fireworks 拼延迟、Together 拼广度、Baseten 跑一个微调过的定制模型。现在你手上有六个真实选项，但定价页根本对不齐。Fireworks 给的是 $/M tokens；Baseten 给的是 $/minute；Modal 给的是 $/second；Replicate 给的是 $/prediction。不建模负载，你根本没法把它们摆到一起比。

更糟的是，每个定价页背后的商业模式都不一样。Fireworks 在共享 GPU 上跑自家定制引擎（FireAttention）；按 token 计费反映的是它们的利用率曲线。Baseten 给你 Truss + 独占 GPU；按分钟计费反映的是独占性。Modal 是真正的 Python serverless——按秒计费，亚秒级冷启动。同样一个产出（一段 LLM 回复），三种完全不同的成本函数。

本课就是把这六家建模出来，告诉你每家什么时候赢。

## 概念（Concept）

### 三个分段（The three segments）

**定制硅（Custom silicon）**——Groq（LPU）、Cerebras（WSE）、SambaNova（RDU）。在同一个模型上，decode 一般比基于 GPU 的集群快 5–10 倍。每 token 单价更高（2025 年底 Groq 在 Llama-70B 上约为 $0.99/M），但在延迟敏感场景下无可匹敌。Groq 是语音 agent 和实时翻译的生产首选。

**GPU 平台（GPU platforms）**——Baseten、Together、Fireworks、Modal、Anyscale。跑在 NVIDIA（2026 年 H100、H200、B200）或偶尔 AMD 上。位于「裸 GPU 出租」（RunPod、Lambda）和「hyperscaler 托管服务」（Bedrock）之间的经济层。

**API 优先的市场型平台（API-first marketplaces）**——Replicate、DeepInfra、OpenRouter、Fal。目录广，按 prediction 或按秒收费，主打首次调用的上手时间。

### Fireworks——延迟优化的 GPU 平台

- FireAttention 引擎（自研）；宣传相同配置下延迟比 vLLM 低 4 倍。
- Batch（批量）层价格约为 serverless 的 50%，针对非交互负载。
- 微调模型与基础模型同价——这是相对那些为你的 LoRA 加价的厂商一个真正的差异化点。
- 2026 年中：5 月 1 日起按需 GPU 租金每小时上调 1 美元。规模大的可以谈量价。
- 财务信号：估值 40 亿美元，每天处理 10T+ tokens。

### Together——广度优化

- 200+ 模型，包括上游发布数天内就跟进的开源模型。
- 同等 LLM 模型上比 Replicate 便宜 50–70%——所谓「AI Native Cloud」定位拼的是量和目录。
- 推理 + 微调 + 训练统一在一个 API 里。

### Baseten——企业级打磨优化

- Truss 框架：把模型打包、依赖、secrets、serving 配置写在同一个 manifest 里。
- GPU 范围从 T4 到 B200。按分钟计费，配合合理的冷启动缓解。
- SOC 2 Type II、HIPAA-ready。是金融科技和医疗健康的常见选择。
- 估值 50 亿美元，2026 年 1 月 E 轮 3 亿美元（CapitalG、IVP、NVIDIA）。

### Modal——Python 原生优化

- 基础设施即代码，纯 Python 写。给函数加个 `@modal.function(gpu="A100")`，一条命令部署。
- 按秒计费。预热后冷启动 2–4 秒；小模型 <1 秒。
- 2025 年 B 轮 8700 万美元，估值 11 亿美元。独立调研中开发者体验得分最高。

### Replicate——多模态广度

- 按 prediction 计费。图像、视频、音频模型的默认平台。
- 集成生态丰富（Zapier、Vercel、CMS 插件）。
- LLM 按 token 单价上不太有竞争力，但在多模态品类上赢。

### Anyscale——Ray 原生

- 基于 Ray 构建；RayTurbo 是 Anyscale 自研的推理引擎（与 vLLM 竞争）。
- 适合分布式 Python 负载，其中推理只是更大计算图里的一个节点。
- 托管 Ray 集群；与 Ray AIR、Ray Serve 紧密集成。

### 按 token vs. 按分钟——各自什么时候赢（Per-token versus per-minute — when each wins）

按 token 计费适合延迟不敏感、突发型的负载——你只为实际用量付钱。按分钟计费适合利用率高且可预测的场景——一旦你把 GPU 跑满，按分钟就比按 token 划算。

经验法则：对于专属 GPU 上持续利用率超过 ~30% 的负载，按分钟（Baseten、Modal）开始赢过按 token（Fireworks、Together）。低于这个阈值，按 token 赢，因为你能避开为闲置付费。

### 真正的护城河是定制引擎（Custom engine is the real moat）

vLLM 和 SGLang 之上的每一家平台都声称自己有定制引擎：FireAttention、RayTurbo、Baseten 的推理栈。这些「定制引擎」说法多半带有营销成分——更诚实的说法是：vLLM + SGLang 大约占了生产环境开源推理的 80%，平台层真正的差异化在于开发体验（DX）、归因、和 SLA。

### 你应该记住的几个数字（Numbers you should remember）

- Fireworks GPU 租金：2026 年 5 月 1 日起每小时上调 1 美元。
- Fireworks 宣称：相同配置下延迟比 vLLM 低 4 倍。
- Together：在 LLM 上比 Replicate 便宜 50–70%。
- Baseten 估值：50 亿美元（2026 年 1 月 E 轮，3 亿美元）。
- Modal 估值：11 亿美元（2025 年 B 轮）。
- 持续利用率超过 ~30% 时，按分钟开始赢过按 token。

## 用起来（Use It）

`code/main.py` 在一个合成负载上、跨多种定价模型对六家厂商做对比。报出 $/day 和折算成的 $/M tokens。跑一下，找到按 token 与按分钟的盈亏平衡点。

## 上线部署（Ship It）

本课产出 `outputs/skill-inference-platform-picker.md`。给定负载画像、SLA 和预算，挑选首选推理平台并指定备选。

## 练习（Exercises）

1. 跑 `code/main.py`。在单张 H100 上跑 70B 模型时，持续利用率多少时 Baseten（按分钟）会赢过 Fireworks（按 token）？自己推导这个交叉点，并和经验法则对比。
2. 你的产品同时提供图像生成 + 聊天 + 语音转文字。给每个模态挑平台，并指出把它们统一起来的 gateway 模式。
3. Fireworks 把你主用模型每小时涨价 1 美元。如果你 40% 的流量切到 batch 层（5 折），建模混合后的成本影响。
4. 一个受监管客户要求 SOC 2 Type II + HIPAA + 独占 GPU。哪三个平台可行，FinOps 上谁赢？
5. 比较 Llama 3.1 70B 在 Fireworks serverless、Together 按需、Baseten 独占、Replicate API 上每 1,000 次 prediction 的成本。10 次/天时谁最便宜？10,000 次/天时谁最便宜？

## 关键术语（Key Terms）

| 术语 | 大家平时怎么说 | 实际是什么 |
|------|----------------|------------|
| Custom silicon（定制硅） | "非 GPU 芯片" | Groq LPU、Cerebras WSE、SambaNova RDU——为 decode 优化 |
| FireAttention | "Fireworks 引擎" | 定制 attention kernel；宣传延迟比 vLLM 低 4 倍 |
| Truss | "Baseten 的格式" | 模型打包 manifest；依赖 + secrets + serving 配置 |
| Per-token（按 token） | "API 定价" | 按消费的 tokens 收费；不为闲置付费 |
| Per-minute（按分钟） | "独占定价" | 按 GPU 墙钟时间收费；高利用率时赢 |
| Per-prediction（按 prediction） | "Replicate 定价" | 按模型调用次数收费；图像/视频常见 |
| RayTurbo | "Anyscale 引擎" | Ray 上的自研推理引擎；在 Ray 集群上和 vLLM 竞争 |
| Batch tier（批量层） | "5 折" | 非交互队列，价格降低；Fireworks、OpenAI 常见 |
| Fine-tuned at base rate | "Fireworks LoRA" | 把 LoRA 服务的请求按基础模型价收费（差异化点） |

## 延伸阅读（Further Reading）

- [Fireworks Pricing](https://fireworks.ai/pricing) — 按 token 价格、batch 层、GPU 租金。
- [Baseten Pricing](https://www.baseten.co/pricing/) — 按分钟价格、承诺容量、企业层级。
- [Modal Pricing](https://modal.com/pricing) — 按秒 GPU 价格和免费额度。
- [Together AI Pricing](https://www.together.ai/pricing) — 模型目录和按 token 价格。
- [Anyscale Pricing](https://www.anyscale.com/pricing) — RayTurbo 和托管 Ray 价格。
- [Northflank — Fireworks AI Alternatives](https://northflank.com/blog/7-best-fireworks-ai-alternatives-for-inference) — 对比评估。
- [Infrabase — AI Inference API Providers 2026](https://infrabase.ai/blog/ai-inference-api-providers-compared) — 厂商版图。
