# 百万Token上下文的长时间视频理解

> 一段1小时、24 FPS、经过分块（patch）和嵌入（embed）的4K视频，会产生约6000万个token。一段2小时的播客转写文本是3万个token。一部完整的蓝光电影，即使经过激进的池化（pooling）压缩，也有数十万个token。谷歌的Gemini 1.5（2024年3月）开创了这个时代，拥有1000万token的上下文，能够在一小时长的视频中可靠地完成大海捞针（Needle-in-a-haystack）召回。LWM（Liu等人，2024年2月）展示了环形注意力（Ring Attention）的扩展路径。LongVILA和Video-XL进一步扩展了输入处理能力。VideoAgent则用智能体检索（Agentic Retrieval）取代了原始上下文。每种方法在计算量、召回率和工程复杂度上都做出了不同的权衡。本课将逐一解读这些方法。

**类型：** 构建
**语言：** Python（标准库，大海捞针模拟器 + 智能体检索路由器）
**前置要求：** 第12阶段 · 17（视频时间token）
**时长：** ~180分钟

## 学习目标

- 计算不同帧率（FPS）和池化（pooling）下长视频的视觉token总数。
- 解释三种扩展路径：暴力上下文（Brute Context）（Gemini 1.5）、环形注意力（Ring Attention）（LWM）、token压缩（Token Compression）（LongVILA / Video-XL）。
- 比较原始上下文视频VLM与智能体检索视频VLM（VideoAgent）在准确性和延迟上的差异。
- 为30分钟视频设计大海捞针测试，并测量特定分钟处的召回率。

## 问题

一张Qwen2.5-VL尺寸、原生分辨率384的分块后的帧，约产生729个token。在3x3池化（pooling）下，每帧为81个token。一个30分钟的片段，以1 FPS采样，共1800帧，即145,800个token。到2025年，开源的VLM能够处理，但已经很紧张。在2 FPS下，则是291,600个token——只有最大的上下文才放得下。

一部2小时的电影，以1 FPS采样，是583k个token。这超出了大多数2026年的开源模型；需要使用Gemini 2.5 Pro或更激进的池化（pooling）。

出现了三种扩展路径。

## 概念

### 路径1：暴力上下文（Brute Context）（Gemini 1.5，Claude Opus）

用硬件硬扛。将上下文扩展到数百万token，一次前向传播处理所有内容。

Gemini 1.5 Pro推出时支持100万token；Gemini 1.5 Ultra支持到1000万；Gemini 2.5 Pro在2026年能可靠处理数小时的视频。论文（arXiv:2403.05530）记录了在高达~950万token的范围内，大海捞针（Needle-in-a-haystack）召回率达到99.7%。

工程实现：一种自定义注意力机制，带有内存层级结构（局部+全局+稀疏），再加上混合专家（MoE）路由以提升长上下文效率。未公开全部细节。非开源。

### 路径2：环形注意力（Ring Attention）（LWM，LongVILA）

环形注意力（Ring Attention）将长序列分布到多个设备上，形成一个“环”，每个设备持有一个块。完整序列上的注意力通过每个设备将其块发送给环中的下一个设备、计算部分注意力并聚合来完成。

LWM（Liu等人，2024年）用这种方式训练了一个拥有100万token上下文的模型。训练计算量随上下文线性增长，而非二次增长——注意力的二次方开销被环中多个设备分摊了。

LongVILA（arXiv:2408.10188）将该模式适配到VLM。1400帧的视频，每帧192个token，共268k上下文，使用8路并行环形注意力（Ring Attention）进行训练。

### 路径3：Token压缩（Token Compression）（Video-XL，LongVA）

比暴力上下文更便宜：在LLM看到序列之前进行激进的压缩。

Video-XL（arXiv:2409.14485）使用一种视觉摘要token：每个包含N帧的片段产生一个单一的“摘要”token，该token关注这N帧。在推理时，LLM每个片段只看到一个摘要token，从而大幅缩小上下文。

LongVA通过一种“长上下文迁移”技术，将LLM的上下文从200k扩展到200万。先在长上下文文本上训练，再通过共享表示迁移到长上下文视频。

Token压缩（Token Compression）以特定时间点的召回率为代价换取可扩展性。模型大致知道发生了什么，但有时会错过精确的帧。

### 路径4：智能体检索（Agentic Retrieval）（VideoAgent）

不把完整视频送入LLM。而是将视频视为一个数据库，让LLM来查询它。

VideoAgent（arXiv:2403.10517）：

1. LLM读取问题。
2. LLM向检索工具请求相关片段（“给我看有猫的片段”）。
3. 工具返回匹配的片段时间戳。
4. LLM通过VLM读取这些片段。
5. LLM组织答案或提出后续查询。

这是将LLM作为智能体的模式应用于长视频。推理成本更低（只编码相关片段），工程难度更大（检索质量成为瓶颈）。

### 大海捞针（Needle-in-a-haystack）基准测试

标准的长上下文测试：在视频中随机位置插入一个唯一的视觉或文本标记，然后提出需要回忆该标记的问题。

指标：在不同视频长度和标记位置下的Recall@k。

Gemini 2.5 Pro在长达90分钟的视频上召回率>99%。开源的72B模型（Qwen2.5-VL-72B，InternVL3-78B）在30分钟时得分约85-90%，超过60分钟后性能下降。

VideoAgent在2小时以上的视频中能够匹配甚至超越原始上下文模型，因为如果检索工具足够好，它能准确命中目标。

### 选择哪种路径

对于15分钟片段，追求前沿精度：开源72B + 原生上下文通常可行。选择Qwen2.5-VL-72B。

对于30分钟到1小时的内容：开源选择LongVILA或Video-XL；闭源选择Gemini 2.5 Pro。质量门槛决定了前沿属于闭源。

对于2小时以上的内容：采用VideoAgent或类似的检索模式。或者，将视频总结成更小的块，并输入层级摘要。

### 2026年生产模式

在实践中，生产环境中的长视频流水线是混合的：

1. 对整个视频运行动态帧率（FPS）采样 + 激进池化（pooling）（得到一个100k token的全局表示）。
2. 送入72B VLM进行全局总结。
3. 如果用户提出详细问题，使用该总结作为索引运行智能体检索（Agentic Retrieval）。

这结合了暴力上下文（Brute Context）用于全局理解，和检索用于局部细节。

## 使用它

`code/main.py`：

- 计算从1分钟到3小时的视频在不同FPS + 池化（pooling）下的token预算。
- 模拟一次大海捞针（Needle-in-a-haystack）运行：在随机时间戳注入一个标记，提出问题，记录召回得分。
- 包含一个智能体检索（Agentic Retrieval）路由器模拟器，用于选择特定片段送入下游VLM。

运行预算表格，感受一下规模差距。

## 交付它

本课产出`outputs/skill-long-video-strategy-planner.md`。给定视频时长和查询复杂度，它会选择暴力上下文（Brute Context）、压缩（Compression）或智能体检索（Agentic Retrieval），并计算相应的延迟和质量预期。

## 练习

1. 一段45分钟的讲座，1 FPS，每帧81个token。总token数是多少？适合哪些模型的上下文？

2. 设计一个大海捞针（Needle-in-a-haystack）测试：在什么分钟注入标记？确切的查询格式是什么？

3. 比较暴力上下文（Brute Context）的Qwen2.5-VL-72B（80k上下文）和VideoAgent（Claude 3.5 + 检索）在一小时视频上的表现。哪个在召回率上胜出？哪个在延迟上胜出？

4. 环形注意力（Ring Attention）的内存成本随序列长度和设备数量线性增长。解释原因，并说明如果跳过环旋转阶段会发生什么问题。

5. 阅读Gemini 1.5论文第5节关于大海捞针（Needle-in-a-haystack）的内容。论文发现了在100万token和1000万token边界上召回率有什么差异？

## 关键术语

| 术语 | 人们常说的 | 实际含义 |
|------|------------|----------|
| 暴力上下文（Brute Context） | “只是更多token” | 将LLM上下文扩展到数百万token；一次处理所有内容 |
| 环形注意力（Ring Attention） | “LWM风格的并行” | 分布式注意力模式，每个设备持有一个块并旋转传递 |
| Token压缩（Token Compression） | “摘要token” | 在送入LLM之前，通过一个学习到的压缩器减少每个片段的token数 |
| 大海捞针（Needle-in-haystack） | “NIH测试” | 在随机位置插入一个唯一标记，测试时要求模型回忆它 |
| 智能体检索（Agentic Retrieval） | “LLM作为查询规划器” | LLM向检索工具请求相关片段，通过VLM读取，组织答案 |
| VideoAgent | “视频的检索模式” | 规范的智能体检索设计：问题 -> 工具 -> 片段 -> 答案 |

## 延伸阅读

- [Gemini Team — Gemini 1.5 (arXiv:2403.05530)](https://arxiv.org/abs/2403.05530)
- [Liu et al. — LWM / RingAttention (arXiv:2402.08268)](https://arxiv.org/abs/2402.08268)
- [Xue et al. — LongVILA (arXiv:2408.10188)](https://arxiv.org/abs/2408.10188)
- [Shu et al. — Video-XL (arXiv:2409.14485)](https://arxiv.org/abs/2409.14485)
- [Wang et al. — VideoAgent (arXiv:2403.10517)](https://arxiv.org/abs/2403.10517)