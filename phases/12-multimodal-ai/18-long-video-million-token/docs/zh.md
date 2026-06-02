# 百万 token context 下的长视频理解

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 一段 1 小时、24 FPS 的 4K 视频，切 patch 后做 embedding，量级在 6000 万 token。一档 2 小时的播客转写下来是 3 万 token。一部完整的蓝光电影，即便用激进的 pooling 压缩，也仍有几十万 token。Google 的 Gemini 1.5（2024 年 3 月）以 1000 万 token 的 context window 开启了这个时代，对一小时长度的视频做大海捞针（needle-in-a-haystack）召回都可靠。LWM（Liu 等人，2024 年 2 月）展示了 ring attention 的扩展路径。LongVILA 和 Video-XL 把摄入规模再往上推。VideoAgent 则用 agentic 检索替代了原始 context。每条路线在算力、召回率、工程复杂度上都是不同的取舍。本课把它们并排来读。

**Type:** Build
**Languages:** Python (stdlib, needle-in-haystack 模拟器 + agentic 检索路由器)
**Prerequisites:** Phase 12 · 17 (视频时间维 token)
**Time:** ~180 分钟

## 学习目标（Learning Objectives）

- 在不同 FPS 和 pooling 设置下，计算长视频的视觉总 token 数。
- 解释三条扩展路径：暴力 context（Gemini 1.5）、ring attention（LWM）、token 压缩（LongVILA / Video-XL）。
- 在准确率和延迟两个维度上，对比原始 context 视频 VLM 与 agentic 检索视频 VLM（VideoAgent）。
- 为一段 30 分钟视频设计大海捞针测试，并测量某一具体分钟点的召回率。

## 问题（The Problem）

在 384 原生分辨率下，Qwen2.5-VL 量级的 patch 切分让单帧约为 729 个 token。3x3 pooling 后变成每帧 81 个 token。一段 30 分钟、1 FPS 的片段 = 1800 帧 = 145,800 token。2025 年的开源 VLM 勉强吃得下。换成 2 FPS，就是 291,600 token——只有 context 最大的那几款才装得下。

一部 2 小时电影按 1 FPS 算就是 58.3 万 token。已经超过大多数 2026 年开源模型的能力范围；要么用 Gemini 2.5 Pro，要么把 pooling 做得更激进。

由此演化出三条扩展路径。

## 概念（The Concept）

### 路径 1：暴力 context（Gemini 1.5、Claude Opus）

砸硬件解决问题。把 context 扩到百万级 token，整段视频在一次前向传播里全部处理掉。

Gemini 1.5 Pro 上线时是 100 万 token；Gemini 1.5 Ultra 拉到 1000 万；Gemini 2.5 Pro 在 2026 年已经能可靠处理几小时长度的视频。论文（arXiv:2403.05530）记录的大海捞针召回率在约 950 万 token 以内可达 99.7%。

工程层面：定制的 attention 实现，带分级内存（local + global + sparse），再加上 MoE（混合专家）路由以保障长 context 下的效率。细节没有完整公开，也未开源。

### 路径 2：Ring attention（LWM、LongVILA）

Ring attention 把长序列分散到多台设备上，组成一个「环」，每台设备持有一段 chunk。要在整段序列上做 attention，每台设备就把自己的 chunk 按环形传给下一台，计算局部 attention，再聚合起来。

LWM（Liu 等人，2024）就是用这种方式训练出 100 万 token context 的模型。训练算力随 context 长度线性增长，而非平方增长——attention 的平方代价被环上多台设备摊薄了。

LongVILA（arXiv:2408.10188）把这一模式适配到 VLM。1400 帧视频、每帧 192 个 token = 26.8 万 context，配合 8 路并行的 ring attention 训练。

### 路径 3：Token 压缩（Video-XL、LongVA）

比暴力 context 便宜：在 LLM 看到序列之前，先做激进压缩。

Video-XL（arXiv:2409.14485）使用视觉摘要 token：每段 N 帧的 clip 产出一个「摘要」token，对这 N 帧做 attention。推理时，LLM 每个 clip 只看到一个摘要 token，context 大幅缩小。

LongVA 则用一种「long context transfer」技术，把 LLM 的 context 从 20 万扩到 200 万。先在长 context 文本上训练，再通过共享表示迁移到长 context 视频。

Token 压缩牺牲了具体时间戳上的召回精度，换取可扩展性。模型大体知道发生了什么，但有时会错过具体哪一帧。

### 路径 4：Agentic 检索（VideoAgent）

不要把整段视频喂给 LLM。把视频当作一个数据库，让 LLM 来查询它。

VideoAgent（arXiv:2403.10517）：

1. LLM 读取问题。
2. LLM 向检索工具索要相关 clip（「给我所有出现猫的片段」）。
3. 工具返回匹配的 clip 时间戳。
4. LLM 通过 VLM 阅读这些 clip。
5. LLM 综合给出答案，或者继续追问。

这就是把 LLM-as-agent 模式套到长视频上。推理更便宜（只编码相关 clip），但工程更难（检索质量成了瓶颈）。

### 大海捞针基准（Needle-in-a-haystack benchmarks）

长 context 的标准测试：在视频的某个随机位置插入一个独特的视觉或文本标记，然后提一个需要回忆该标记的问题。

指标：在不同视频长度、不同标记位置下的 Recall@k。

Gemini 2.5 Pro 在最长 90 分钟视频上 recall 超过 99%。开源 72B 模型（Qwen2.5-VL-72B、InternVL3-78B）在 30 分钟段位是 85–90%，过了 60 分钟开始衰减。

在 2 小时以上场景，VideoAgent 可以追平甚至超过原始 context 模型——只要工具足够好，检索就能命中那根针。

### 怎么选路径

15 分钟以内的片段，要前沿精度：开源 72B + 原生 context 通常够用。选 Qwen2.5-VL-72B。

30 分钟到 1 小时的内容：开源选 LongVILA 或 Video-XL；闭源选 Gemini 2.5 Pro。质量门槛拉高的话，前沿能力还是闭源占优。

2 小时以上的内容：VideoAgent 这类检索模式。或者退而求其次，先压成更小的 chunk，再做层级摘要喂给模型。

### 2026 年的生产模式

实际生产中，长视频流水线（pipeline）通常是混合架构：

1. 对整段视频跑动态 FPS 采样 + 激进 pooling，拿到一个 10 万 token 量级的全局表示。
2. 把它喂给 72B VLM，得到全局摘要。
3. 用户提细节问题时，用全局摘要作为索引，跑 agentic 检索。

这样既能用暴力 context 拿到全局理解，又能用检索补上局部细节。

## 用起来（Use It）

`code/main.py`：

- 计算从 1 分钟到 3 小时、不同 FPS 与 pooling 组合下视频的 token 预算。
- 模拟一次大海捞针：在随机时间戳注入标记，提出问题，给 recall 打分。
- 包含一个 agentic 检索路由器模拟器，会挑选具体 clip 喂给下游 VLM。

跑一下预算表，自己感受一下规模上的鸿沟。

## 上线部署（Ship It）

本课产出 `outputs/skill-long-video-strategy-planner.md`。给定视频时长和查询复杂度，它会在暴力 context、压缩、agentic 检索之间做选择，并估算延迟和质量预期。

## 练习（Exercises）

1. 一段 45 分钟讲座，1 FPS，每帧 81 token。总 token 数是多少？能塞进哪些模型的 context？

2. 设计一次大海捞针测试：在第几分钟注入标记？查询的具体格式是什么？

3. 在一段 1 小时视频上对比暴力 context 的 Qwen2.5-VL-72B（8 万 context）与 VideoAgent（Claude 3.5 + 检索）。recall 谁赢？延迟谁赢？

4. Ring attention 的内存开销在序列长度和设备数量上都线性增长。解释为什么，并说明如果去掉 ring 轮转阶段会失败在哪里。

5. 读 Gemini 1.5 论文第 5 节关于大海捞针的部分。论文在 100 万 vs 1000 万 token 边界上对召回率有何发现？

## 关键术语（Key Terms）

| 术语 | 大家是怎么说的 | 实际含义 |
|------|-----------------|------------------------|
| Brute context（暴力 context） | "再多塞点 token 就行" | 把 LLM 的 context 扩到百万级 token，一次前向传播里把所有内容处理完 |
| Ring attention | "LWM 风格的并行" | 分布式 attention 模式，每台设备持有一段 chunk 并轮转 |
| Token 压缩（Token compression） | "摘要 token" | 在送进 LLM 之前，用一个学到的压缩器减少每段 clip 的 token 数 |
| Needle-in-haystack（大海捞针） | "NIH 测试" | 在随机位置插入独特标记，测试时让模型回忆 |
| Agentic 检索（Agentic retrieval） | "LLM 当查询规划器" | LLM 向检索工具索要相关 clip，通过 VLM 阅读，综合给出答案 |
| VideoAgent | "视频版的检索模式" | agentic 检索的经典设计：问题 -> 工具 -> clip -> 答案 |

## 延伸阅读（Further Reading）

- [Gemini Team — Gemini 1.5 (arXiv:2403.05530)](https://arxiv.org/abs/2403.05530)
- [Liu et al. — LWM / RingAttention (arXiv:2402.08268)](https://arxiv.org/abs/2402.08268)
- [Xue et al. — LongVILA (arXiv:2408.10188)](https://arxiv.org/abs/2408.10188)
- [Shu et al. — Video-XL (arXiv:2409.14485)](https://arxiv.org/abs/2409.14485)
- [Wang et al. — VideoAgent (arXiv:2403.10517)](https://arxiv.org/abs/2403.10517)
