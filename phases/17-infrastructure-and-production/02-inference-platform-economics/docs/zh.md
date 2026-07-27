# 推理平台经济学——Fireworks、Together、Baseten、Modal、Replicate、Anyscale

> 2026 年的推理市场已不再是 GPU 时间的租赁。它分化为三个赛道：定制芯片（Groq、Cerebras、SambaNova）、GPU 平台（Baseten、Together、Fireworks、Modal）和 API 优先的市场（Replicate、DeepInfra）。Fireworks 于 2026 年 5 月 1 日将每 GPU 价格上调 1 美元/小时，而 40 亿美元估值及每天处理 10 万亿+ token 的事实说明，量驱动模型行之有效。Baseten 于 2026 年 1 月以 50 亿美元估值完成 3 亿美元的 E 轮融资。竞争定位的规则很简单：Fireworks 优化延迟，Together 优化模型目录广度，Baseten 优化企业级体验，Modal 优化 Python 原生开发者体验，Replicate 优化多模态覆盖，Anyscale 优化分布式 Python。本课将为你提供一张可直接交给创始人的对比矩阵。

**类型：** 学习
**语言：** Python（标准库，简易每次调用成本对比器）
**前置知识：** 阶段 17 · 01（托管 LLM 平台），阶段 17 · 04（vLLM 服务内部原理）
**预计时间：** ~60 分钟

## 学习目标

- 说出三个细分市场（定制芯片、GPU 平台、API 优先）并将每个供应商对应到相应细分市场。
- 解释为什么"按 token"的 API 定价模型会向推理引擎的成本曲线（而非硬件成本曲线）收敛。
- 计算至少三个供应商的每请求有效成本，并说明何时按分钟计费（Baseten、Modal）优于按 token 计费。
- 识别给定工作负载（无服务器突发型、稳定高吞吐型、微调变体、多模态）的默认最佳平台。

## 问题

你已经评估了托管超大规模平台。你决定需要一个更窄更快更专注的提供商——Fireworks 用于低延迟，Together 用于模型广度，Baseten 用于微调定制模型。现在你有六个真正可选的方案，但它们的定价页面并不对齐。Fireworks 显示美元/百万 token；Baseten 显示美元/分钟；Modal 显示美元/秒；Replicate 显示美元/每次预测。如果不建模工作负载，你无法将它们进行直接对比。

更糟糕的是，每个定价页面背后的商业模式都不同。Fireworks 在共享 GPU 上运行自己的定制引擎（FireAttention）；按 token 的费率反映了其利用率曲线。Baseten 提供 Truss + 专用 GPU；按分钟计费反映了独占性。Modal 是真正的 Python 无服务器架构——按秒计费，冷启动在亚秒级。同样是 LLM 响应输出，三种完全不同的成本函数。

本课对这六个方案进行建模，并告诉你每种方案何时胜出。

## 核心概念

### 三个细分市场

**定制芯片**——Groq（LPU）、Cerebras（WSE）、SambaNova（RDU）。在相同模型上，解码速度通常比基于 GPU 的集群快 5-10 倍。按 token 的价格更高（Groq 在 2025 年底对 Llama-70B 约为 ~0.99 美元/百万 token），但在对延迟敏感的用例中无可匹敌。Groq 是语音代理和实时翻译领域的生产环境首选。

**GPU 平台**——Baseten、Together、Fireworks、Modal、Anyscale。运行在 NVIDIA（2026 年为 H100、H200、B200）或有时是 AMD 上。居于"原始 GPU 租赁"（RunPod、Lambda）和"超大规模托管服务"（Bedrock）之间的经济层。

**API 优先市场**——Replicate、DeepInfra、OpenRouter、Fal。模型目录广泛，按次或按秒付费，强调首次调用时间。

### Fireworks——延迟优化的 GPU 平台

- FireAttention 引擎（自研）；宣传称在同等配置下比 vLLM 延迟低 4 倍。
- 批处理层价格约为无服务器费率的 50%，适用于非交互式工作负载。
- 微调模型以与基础模型相同的费率提供服务——这与那些为您 LoRA 收取额外费用的提供商相比，是一个真正的差异化优势。
- 2026 年中：自 2026 年 5 月 1 日起，按需 GPU 租赁实际上调 1 美元/小时。批量定价可按用量协商。
- 财务信号：40 亿美元估值，每天处理 10 万亿+ token。

### Together——广度优化的平台

- 200+ 个模型，包括上游发布后几天内就上线的开源版本。
- 在同等 LLM 模型上比 Replicate 便宜 50-70%——"AI 原生云"的定位即规模和目录。
- 推理 + 微调 + 训练整合于一个 API。

### Baseten——企业级体验优化的平台

- Truss 框架：将模型打包为包含依赖、密钥和服务配置的单一清单。
- GPU 范围从 T4 到 B200。按分钟计费，冷启动缓解措施合理。
- SOC 2 Type II 认证，符合 HIPAA 要求。金融科技和医疗保健领域的常见选择。
- 50 亿美元估值，2026 年 1 月 E 轮融资（3 亿美元，投资方为 CapitalG、IVP、NVIDIA）。

### Modal——Python 原生优化的平台

- 以纯 Python 实现基础设施即代码。用 `@modal.function(gpu="A100")` 装饰一个函数，一条命令即可部署。
- 按秒计费。预热情况下冷启动 2-4 秒；小型模型 <1 秒。
- 8700 万美元 B 轮融资，估值 11 亿美元（2025 年）。在独立调查中开发者体验评分最高。

### Replicate——多模态广度

- 按次付费。用于图像、视频和音频模型的默认平台。
- 集成生态完善（Zapier、Vercel、CMS 插件）。
- 在 LLM 按 token 费率上竞争力较弱，但在多模态多样性方面胜出。

### Anyscale——Ray 原生平台

- 基于 Ray 构建；RayTurbo 是 Anyscale 的专有推理引擎（与 vLLM 竞争）。
- 最适合分布式 Python 工作负载，其中推理步骤是更大计算图中的一个节点。
- 托管 Ray 集群；与 Ray AIR 和 Ray Serve 紧密集成。

### 按 token 计费 vs 按分钟计费——何时胜出

按 token 计费适用于对延迟不敏感且突发的场景——你只需为实际使用付费。按分钟计费适用于利用率高且可预测的场景——一旦你使 GPU 饱和，按分钟计费就会优于按 token 计费。

粗略规则：当专用 GPU 的持续利用率超过约 30% 时，按分钟计费（Baseten、Modal）开始优于按 token 计费（Fireworks、Together）。低于该阈值，按 token 计费胜出，因为你无需为空闲付费。

### 定制引擎才是真正的护城河

每个在 vLLM 和 SGLang 之上的平台都声称拥有定制引擎。FireAttention、RayTurbo、Baseten 的推理栈。定制引擎的声称带有营销色彩——诚实的表述是，vLLM + SGLang 占据了约 80% 的生产环境开源推理市场，平台层的真正差异化在于开发者体验、归属权和 SLA。

### 你应该记住的数字

- Fireworks GPU 租赁：自 2026 年 5 月 1 日起实际上调 1 美元/小时。
- Fireworks 声称：同等配置下比 vLLM 延迟低 4 倍。
- Together：在 LLM 上比 Replicate 便宜 50-70%。
- Baseten 估值：50 亿美元（E 轮，2026 年 1 月，3 亿美元融资）。
- Modal 估值：11 亿美元（B 轮，2025 年）。
- 持续利用率约 30% 以上时，按分钟计费优于按 token 计费。

```figure
cost-per-token
```

## 使用它

`code/main.py` 在合成工作负载上比较六个供应商的不同定价模型，输出每日成本（美元/天）和有效每百万 token 成本（美元/百万 token）。运行它以找出按 token 计费和按分钟计费之间的平衡点。

## 交付它

本课产出 `outputs/skill-inference-platform-picker.md`。根据工作负载特征、SLA 和预算，选出主要推理平台并给出备选方案。

## 练习

1. 运行 `code/main.py`。对于 70B 模型在单张 H100 上，Baseten（按分钟计费）在多少持续利用率下会优于 Fireworks（按 token 计费）？自行推导交叉点并与经验法则进行比较。
2. 你的产品需要同时提供图像生成、聊天和语音转文字功能。为每种模态选择平台，并说出将它们统一起来的网关模式。
3. Fireworks 将你的主要模型价格上调 1 美元/小时。如果你的 40% 流量转移到批处理层（半价），建模混合成本影响。
4. 一个受监管客户要求 SOC 2 Type II + HIPAA + 专用 GPU。哪三个平台可行？其中哪个在 FinOps 方面胜出？
5. 比较 Fireworks 无服务器、Together 按需、Baseten 专用和 Replicate API 上 Llama 3.1 70B 的每千次预测成本。在每天 10 次预测时哪个最便宜？在每天 10,000 次时呢？

## 关键术语

| 术语 | 大家怎么说 | 实际含义 |
|------|-----------|---------|
| 定制芯片 | "非 GPU 芯片" | Groq LPU、Cerebras WSE、SambaNova RDU——为解码优化 |
| FireAttention | "Fireworks 引擎" | 定制注意力核；宣称比 vLLM 延迟低 4 倍 |
| Truss | "Baseten 的格式" | 模型打包清单；依赖 + 密钥 + 服务配置 |
| 按 token 计费 | "API 定价" | 按消耗的 token 收费；无需为空闲付费 |
| 按分钟计费 | "专用定价" | 按 GPU 挂钟时间收费；在高利用率下胜出 |
| 按次计费 | "Replicate 定价" | 按模型调用次数收费；常见于图像/视频场景 |
| RayTurbo | "Anyscale 引擎" | Ray 上的专有推理引擎；在 Ray 集群上与 vLLM 竞争 |
| 批处理层 | "五折优惠" | 非交互式队列以折扣价运行；常见于 Fireworks、OpenAI |
| 按基础模型费率提供微调 | "Fireworks LoRA" | LoRA 服务请求按基础模型费率收费（差异化优势） |

## 延伸阅读

- [Fireworks 定价](https://fireworks.ai/pricing)——按 token 费率、批处理层、GPU 租赁
- [Baseten 定价](https://www.baseten.co/pricing/)——按分钟费率、预留容量、企业级方案
- [Modal 定价](https://modal.com/pricing)——按秒 GPU 费率和免费层
- [Together AI 定价](https://www.together.ai/pricing)——模型目录和按 token 费率
- [Anyscale 定价](https://www.anyscale.com/pricing)——RayTurbo 和托管 Ray 定价
- [Northflank —— Fireworks AI 替代方案](https://northflank.com/blog/7-best-fireworks-ai-alternatives-for-inference)——对比评估
- [Infrabase —— 2026 年 AI 推理 API 提供商](https://infrabase.ai/blog/ai-inference-api-providers-compared)——供应商全景
