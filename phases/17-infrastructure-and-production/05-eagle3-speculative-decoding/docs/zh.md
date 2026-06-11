# EAGLE-3生产中的投机解码

> 投机解码将快速草稿模型与目标模型配对。草稿提出K个token；目标模型在单次前向传递中验证；接受的token是免费的。2026年，EAGLE-3是生产级变体 —— 它在目标模型的隐藏状态上训练草稿头，而不是在原始token上，将通用聊天上的接受率alpha推入0.6-0.8区间。正确的问题不是"草稿多快"，而是"我的流量上alpha是多少？"如果alpha降至约0.55以下，投机解码在高并发下是净负面的，因为每个被拒绝的草稿花费第二次目标前向传递。本课程教你先测量alpha，再翻转标志。

**类型：** 学习
**语言：** Python（标准库，玩具接受率模拟器）
**前置知识：** 第17阶段 · 04（vLLM服务内部），第10阶段 · 18（多token预测）
**时间：** 约60分钟

## 学习目标

- 命名投机解码的三代，并解释EAGLE-3从EAGLE-2和经典草稿模型改变了什么。
- 定义接受率alpha，从alpha和K（草稿长度）计算预期加速，并识别目标并发的盈亏平衡alpha。
- 解释为什么投机解码在2026年vLLM中是选择加入（不是默认），以及为什么在不测量alpha的情况下打开它是生产反模式。
- 编写测量计划：哪个基准、哪个提示分布、哪个并发点、哪个指标来门控。

## 问题

解码是内存约束的。在H100上运行Llama 3.3 70B FP8，每个解码token读取约140 GB/s权重并发出一个token。GPU计算在解码期间几乎空闲 —— 瓶颈是HBM带宽，不是matmul吞吐量。

投机解码利用这个差距。用便宜的草稿模型生成K个候选token，然后要求目标模型在单次前向传递中验证所有K。每个验证的token实际上是免费的（摊销到目标本来就要做的K批次前向中）。

经典草稿模型方法使用同一家族的较小模型（Llama 3.2 1B为Llama 3.3 70B起草）。它有效但接受率平庸 —— 较小模型分布偏离目标。EAGLE、然后EAGLE-2、然后EAGLE-3直接在目标模型的内部状态上训练轻量草稿头，因此草稿分布更紧密地跟踪目标。这就是alpha从草稿模型的0.4到EAGLE-3的0.6-0.8的原因。

注意：EAGLE-3在2026年vLLM中是选择加入。必须显式设置`speculative_config`。没有标志，没有加速。在没有在其真实流量上测量alpha的情况下翻转它的团队经常看到尾部延迟变差，而不是更好。

## 概念

### 投机解码实际购买什么

没有投机解码，每token成本是一次目标前向。在草稿长度K和接受率alpha的投机解码下，每次目标前向的预期token是`1 + K * alpha`。加速是`(1 + K * alpha) / (1 + epsilon)`，其中epsilon是草稿加验证开销。对于K=5，alpha=0.7：`(1 + 5*0.7) / (1 + 0.1) = 4.5 / 1.1 = 4.1x`。现实世界数字聚集在2-3x左右，因为alpha在生产流量上很少那么高，且epsilon在高批次大小下增长。

### 为什么alpha是唯一重要的指标

被拒绝的token不会消失 —— 它们强制对第一个被拒绝的token进行第二次目标前向。在alpha降至0.4的工作负载上，你支付草稿开销加验证加重roll。在高并发（比如256并发）下，解码批次已经足够大，"单独目标"和"带验证的目标"之间的内存带宽差距缩小。在大多数2026年硬件上低于alpha 0.55，投机解码是净负面的。

Alpha因工作负载而异。在ShareGPT风格通用聊天上，在ShareGPT上训练的EAGLE-3命中0.6-0.8。在领域特定流量（代码、医疗、法律）上，在通用数据上训练的草稿头降至0.4-0.6。训练领域特定草稿头恢复alpha —— 与目标微调相比，它是一个轻量、快速的训练工作。

### EAGLE代际一览

- **经典草稿模型**：同一家族的较小模型。Alpha 0.3-0.5。基础设施简单 —— 加载两个模型，草稿每个目标前向运行K次前向。
- **EAGLE-1（2024）**：在目标隐藏状态（最后一层）上训练的单草稿头。Alpha约0.5-0.6。目标之上的小参数开销。
- **EAGLE-2（2025）**：自适应草稿长度和基于树的草稿（在单次目标传递中验证多个分支）。Alpha约0.6-0.7。更复杂的草稿调度器。
- **EAGLE-3（2025-2026）**：在多个目标层（不仅是最后一层）上训练的草稿头，更好的对齐。通用聊天上alpha约0.6-0.8。

### 2026年生产配方

1. 纯发布目标模型。测量目标并发下的基线TTFT、ITL、吞吐量。
2. 通过vLLM `speculative_config`启用EAGLE-3草稿。重新运行基准测试。
3. 记录接受率alpha。vLLM V1将其报告为`spec_decode_metrics.accepted_tokens_per_request`。除以请求的草稿长度得到alpha。
4. 如果在生产流量分布上alpha < 0.55，禁用投机解码或训练领域特定EAGLE-3草稿。
5. 在生产并发下，重新运行。确认P99 ITL没有变差。

### 生产陷阱：P99尾部

平均ITL随投机解码下降。如果不调整，P99可能变差。被拒绝的草稿触发两pass序列（草稿 + 验证失败 + reroll）。在满批次下，这两pass串行化。观察P99 ITL，不是P50。

### EAGLE-3已部署的地方

Google在2025年将投机解码部署在AI Overviews中（相同质量，更快响应）。vLLM V1将`speculative_config`作为记录接口；V1中的N-gram GPU投机解码是与分块预填充兼容的变体。SGLang支持EAGLE-3作为前缀重工作负载的推荐草稿路径。

### 一行盈亏平衡数学

预期加速：`S(alpha, K) = (1 + K*alpha) / (1 + verify_overhead)`。设`S = 1`求解alpha：`alpha_breakeven = verify_overhead / K`。对于典型verify_overhead约0.15和K=5：`alpha_breakeven = 0.03`。但这是原始解码数学。在高并发下验证开销上升，解码批次已经跨序列摊销内存读取，因此有效alpha_breakeven在实践中攀升至约0.45-0.55。

### 何时不使用投机解码

- 延迟不重要的批次1离线生成。使用纯目标。
- 非常短输出（低于50 token）。草稿开销和验证成本主导。
- 没有领域训练草稿头的专业领域。Alpha太低。
- vLLM v0.18.0加草稿模型投机解码加`--enable-chunked-prefill`。这种组合不编译。记录的例外是V1中的N-gram GPU投机解码。

## 使用它

`code/main.py`模拟一系列alpha值和草稿长度K下有无投机解码的解码循环。它打印盈亏平衡alpha、测量加速和尾部行为。在几个(alpha, K)组合上运行它以查看投机解码停止回报的确切位置。

## 交付它

本课程产出`outputs/skill-eagle3-rollout.md`。给定目标模型、流量分布描述和并发目标，它产生分阶段EAGLE-3推出计划 —— 基准基线、启用配置、测量alpha、在alpha >= 0.55上门控、观察P99 ITL。

## 练习

1. 运行`code/main.py`。在K=5时，2x加速需要什么alpha？3x加速呢？这对verify_overhead有多敏感？
2. 想象生产流量分割70%通用聊天，30%代码。通用聊天用ShareGPT上训练的EAGLE-3命中alpha 0.7；代码命中alpha 0.4。混合alpha是多少，投机解码是净正面的吗？
3. 阅读vLLM `speculative_config`文档。命名三种模式（草稿模型、EAGLE、N-gram）以及哪种与分块预填充兼容。
4. 启用EAGLE-3后你看到平均ITL下降25%但P99 ITL上升15%。诊断并提出缓解措施。
5. 计算Llama 3.3 70B的EAGLE-3草稿头的内存成本。与运行Llama 3.2 1B作为经典草稿相比如何？

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------|---------|
| 投机解码 | "草稿加验证" | 用便宜模型提出K个token，在单次目标前向中验证所有K |
| 接受率alpha | "投机接受率" | 目标接受的草稿token比例；唯一重要的指标 |
| 草稿长度K | "投机k" | 草稿每个目标前向提出的token数；典型4-8 |
| 验证开销epsilon | "投机开销" | 验证并重roll vs 纯目标前向的额外成本；随批次增长 |
| EAGLE-3 | "最新EAGLE" | 2025-2026变体；在多个目标层上训练草稿头；通用聊天上alpha 0.6-0.8 |
| `speculative_config` | "vLLM投机配置" | vLLM V1中的显式选择加入；没有默认意味着没有加速 |
| N-gram投机解码 | "N-gram草稿" | 使用提示中N-gram查找的GPU端草稿；与分块预填充兼容 |
| 盈亏平衡alpha | "无操作alpha" | 投机解码给出零加速的alpha；在生产并发下观察这个 |
| 被拒绝草稿两pass | "reroll成本" | 草稿拒绝时的两次目标前向；驱动P99尾部 |

## 延伸阅读

- [vLLM —— 投机解码文档](https://docs.vllm.ai/en/latest/features/spec_decode/) —— `speculative_config`和V1中分块预填充兼容性的权威来源。
- [vLLM投机配置API](https://docs.vllm.ai/en/latest/api/vllm/config/speculative/) —— 确切字段集。
- [EAGLE论文（arXiv:2401.15077）](https://arxiv.org/abs/2401.15077) —— 原始EAGLE草稿头公式。
- [EAGLE-2论文（arXiv:2406.16858）](https://arxiv.org/abs/2406.16858) —— 自适应草稿和树。
- [UC Berkeley EECS-2025-224](https://www2.eecs.berkeley.edu/Pubs/TechRpts/2025/EECS-2025-224.html) —— 带投机解码的高效LLM系统。
- [BentoML —— 投机解码](https://bentoml.com/llm/inference-optimization/speculative-decoding) —— 生产推出清单。