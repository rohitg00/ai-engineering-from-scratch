# 推理平台经济学 —— Fireworks、Together、Baseten、Modal、Replicate、Anyscale

> 2026年推理市场不再是GPU时间租赁。它分化为定制芯片（Groq、Cerebras、SambaNova）、GPU平台（Baseten、Together、Fireworks、Modal）和API优先市场（Replicate、DeepInfra）。Fireworks在2026年5月1日将价格提高每小时1美元每GPU，40亿美元估值基于每天10万亿+ token告诉你量驱动模型有效。Baseten在2026年1月以50亿美元估值完成3亿美元E轮融资。竞争定位规则很简单：Fireworks优化延迟，Together优化目录广度，Baseten优化企业精致度，Modal优化Python原生开发者体验，Replicate优化多模态覆盖，Anyscale优化分布式Python。本课程给你一个可以交给创始人的矩阵。

**类型：** 学习
**语言：** Python（标准库，玩具每次调用经济学比较器）
**前置知识：** 第17阶段 · 01（托管LLM平台），第17阶段 · 04（vLLM服务内部）
**时间：** 约60分钟

## 学习目标

- 命名三个市场细分（定制芯片、GPU平台、API优先），并将每个供应商映射到一个细分。
- 解释为什么"每token"API定价模型压缩向服务引擎的成本曲线，而不是硬件的。
- 计算至少三个供应商的有效每次请求成本，并解释何时每分钟（Baseten、Modal）击败每token。
- 识别给定工作负载的正确默认平台（无服务器突发、稳定高吞吐量、微调变体、多模态）。

## 问题

你评估了托管超大规模云服务商平台。你决定你需要更窄、更快的提供商 —— Fireworks用于延迟，Together用于广度，Baseten用于微调自定义模型。现在你有六个真实选择，定价页面对不齐。Fireworks显示$/M token；Baseten显示$/分钟；Modal显示$/秒；Replicate显示$/预测。没有建模工作负载你无法正面比较它们。

更糟的是，每个定价页面背后的商业模式不同。Fireworks在共享GPU上运行自己的定制引擎（FireAttention）；每token费率反映它们的利用率曲线。Baseten给你Truss + 专用GPU；每分钟反映排他性。Modal是真正的Python无服务器 —— 每秒计费，亚秒冷启动。相同输出（LLM响应），三种不同成本函数。

本课程建模六个并告诉你每种何时获胜。

## 概念

### 三个细分

**定制芯片** —— Groq（LPU）、Cerebras（WSE）、SambaNova（RDU）。通常比相同模型上的GPU集群快5-10倍解码。更高每token价格（Groq在2025年末Llama-70B上约$0.99/M），但对延迟敏感用例无可匹敌。Groq是语音智能体和实时翻译的生产选择。

**GPU平台** —— Baseten、Together、Fireworks、Modal、Anyscale。在NVIDIA（2026年H100、H200、B200）或有时AMD上运行。"原始GPU租赁"（RunPod、Lambda）和"超大规模云服务商托管服务"（Bedrock）之间的经济层。

**API优先市场** —— Replicate、DeepInfra、OpenRouter、Fal。广泛目录，按预测或按秒付费，强调首次调用时间。

### Fireworks —— 延迟优化GPU平台

- FireAttention引擎（定制）；宣传为等效配置上比vLLM低4倍延迟。
- 批处理层级约服务器less费率的50%，用于非交互式工作负载。
- 微调模型与基础模型相同费率服务 —— 相比对LoRA收取溢价的提供商是真实差异化因素。
- 2026年中：将按需GPU租赁提高每小时1美元，2026年5月1日生效。大规模可协商批量定价。
- 财务信号：40亿美元估值，每天处理10万亿+ token。

### Together —— 广度优化

- 200+模型，包括上游发布后数天内的开源发布。
- 等效LLM模型上比Replicate便宜50-70% —— "AI原生云"定位是量和目录。
- 推理 + 微调 + 训练在一个API中。

### Baseten —— 企业精致度优化

- Truss框架：模型打包，依赖、秘密、服务配置在一个清单中。
- GPU范围从T4到B200。每分钟计费，合理的冷启动缓解。
- SOC 2 Type II、HIPAA就绪。常见金融科技和医疗保健选择。
- 50亿美元估值，2026年1月E轮融资（3亿美元来自CapitalG、IVP、NVIDIA）。

### Modal —— Python原生优化

- 纯Python基础设施即代码。用`@modal.function(gpu="A100")`装饰函数，一个命令部署。
- 每秒计费。预预热冷启动2-4秒；小模型<1秒。
- 2025年B轮融资8700万美元，估值11亿美元。独立调查中开发者体验评分最强。

### Replicate —— 多模态广度

- 按预测付费。图像、视频和音频模型的默认平台。
- 集成生态系统（Zapier、Vercel、CMS插件）。
- LLM每token费率竞争力较弱，但在多模态多样性上获胜。

### Anyscale —— Ray原生

- 基于Ray构建；RayTurbo是Anyscale的专有推理引擎（与vLLM竞争）。
- 最适合分布式Python工作负载，其中推理步骤是更大图中的一个节点。
- 托管Ray集群；与Ray AIR和Ray Serve紧密集成。

### 每token vs 每分钟 —— 每种何时获胜

每token在延迟不敏感且突发的工作负载时有意义 —— 你只为你使用的付费。每分钟在利用率高且可预测时有意义 —— 一旦你饱和GPU，你就击败每token。

粗略规则：对于高于约30%专用GPU持续利用率的工作负载，每分钟（Baseten、Modal）开始击败每token（Fireworks、Together）。低于该值，每token获胜，因为你避免为空闲付费。

### 定制引擎是真正的护城河

上述每个平台都声称有vLLM和SGLang之外的定制引擎。FireAttention、RayTurbo、Baseten的推理栈。定制引擎声明带有营销色彩 —— 诚实的框架是vLLM + SGLang代表约80%的生产开源推理，平台层的差异化因素是开发者体验、归因和SLA。

### 你应该记住的数字

- Fireworks GPU租赁：2026年5月1日生效每小时提高1美元。
- Fireworks声明：等效配置上比vLLM低4倍延迟。
- Together：LLM上比Replicate便宜50-70%。
- Baseten估值：50亿美元（E轮，2026年1月，3亿美元融资）。
- Modal估值：11亿美元（B轮，2025年）。
- 每分钟在约30%以上持续利用率时击败每token。

## 使用它

`code/main.py`在合成工作负载上比较六个供应商的定价模型。报告$/天和有效$/M token。运行它以找到每token和每分钟之间的盈亏平衡。

## 交付它

本课程产出`outputs/skill-inference-platform-picker.md`。给定工作负载配置文件、SLA和预算，选择主要推理平台并命名亚军。

## 练习

1. 运行`code/main.py`。在一个H100上的70B模型上，Baseten（每分钟）在什么持续利用率下击败Fireworks（每token）？自己推导交叉点并与经验法则比较。
2. 你的产品提供图像生成加聊天加语音转文本。为每种模态选择平台，并命名统一它们的网关模式。
3. Fireworks将价格提高每小时1美元在你的主要模型上。如果40%的流量移动到批处理层级（50%折扣），建模混合成本影响。
4. 受监管客户需要SOC 2 Type II + HIPAA + 专用GPU。哪三个平台可行，哪个在FinOps上获胜？
5. 比较Llama 3.1 70B在Fireworks无服务器、Together按需、Baseten专用和Replicate API上的每1000预测成本。在10预测/天时哪个最便宜？在10,000时？

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------|---------|
| 定制芯片 | "非GPU芯片" | Groq LPU、Cerebras WSE、SambaNova RDU —— 优化解码 |
| FireAttention | "Fireworks引擎" | 定制注意力内核；宣传为比vLLM低4倍延迟 |
| Truss | "Baseten的格式" | 模型打包清单；依赖 + 秘密 + 服务配置 |
| 每token | "API定价" | 按消耗的token收费；不为空闲付费 |
| 每分钟 | "专用定价" | 按挂钟GPU时间收费；高利用率时获胜 |
| 每预测 | "Replicate定价" | 按模型调用收费；图像/视频常见 |
| RayTurbo | "Anyscale引擎" | Ray上的专有推理；与Ray集群上的vLLM竞争 |
| 批处理层级 | "50%折扣" | 非交互式队列降低费率；Fireworks、OpenAI常见 |
| 按基础费率微调 | "Fireworks LoRA" | 按基础模型费率收取LoRA服务请求（差异化因素） |

## 延伸阅读

- [Fireworks定价](https://fireworks.ai/pricing) —— 每token费率、批处理层级、GPU租赁。
- [Baseten定价](https://www.baseten.co/pricing/) —— 每分钟费率、承诺容量、企业层级。
- [Modal定价](https://modal.com/pricing) —— 每秒GPU费率和免费层级。
- [Together AI定价](https://www.together.ai/pricing) —— 模型目录和每token费率。
- [Anyscale定价](https://www.anyscale.com/pricing) —— RayTurbo和托管Ray定价。
- [Northflank —— Fireworks AI替代品](https://northflank.com/blog/7-best-fireworks-ai-alternatives-for-inference) —— 比较评估。
- [Infrabase —— 2026年AI推理API提供商](https://infrabase.ai/blog/ai-inference-api-providers-compared) —— 供应商格局。