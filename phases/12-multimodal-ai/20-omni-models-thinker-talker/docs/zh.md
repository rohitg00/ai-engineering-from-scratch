# 20 · 全能模型：Qwen2.5-Omni 与 Thinker-Talker 拆分

> GPT-4o 在 2024 年 5 月的产品演示之所以颠覆性，并不在于底层模型，而在于它的产品形态——一个语音界面：你说话，模型看到摄像头看到的画面，并在 250ms 以内回话。整个开源生态在 2024 年和 2025 年余下的时间里都在竞相追赶这个产品形态。Qwen2.5-Omni（2025 年 3 月）是这一开源设计的参考范式：一个 Thinker（大型文本生成 transformer）加上一个 Talker（并行的语音生成 transformer），二者通过流式语音 token 相连。Mini-Omni 对其做了简化，Moshi 在延迟上追平了它，GLM-4-Voice 将其扩展到了中文。本课将剖析 Thinker-Talker 架构，以及让流式实时对话得以成立的「延迟预算（latency budget）」。

**类型：** 实践构建
**语言：** Python（标准库，流式管线延迟模拟器 + VAD 循环）
**前置：** 阶段 12 · 19（音频 LLM）、阶段 12 · 16（任意到任意）
**时长：** 约 180 分钟

## 学习目标

- 将推理管线拆分为 Thinker（文本推理）和 Talker（语音合成），并解释为何并行流式能够奏效。
- 逐组件计算一次对话交互的「首个音频字节耗时（time-to-first-audio-byte，TTFAB）」预算。
- 描述 TMRoPE 如何在 Thinker 内部对视觉、音频、文本进行时间对齐的位置编码。
- 说出三种实时对话模式：「半双工（half-duplex）」、「轮流发言（turn-taking）」、「全双工（full-duplex）」。

## 问题所在

一个实时语音助手要快速完成大量工作：

1. 听见用户。实时语音 token 化，并通过「语音活动检测（voice activity detection，VAD）」判断用户何时说完。
2. 可选地看见。摄像头输入以 2-4 FPS 与音频一起流入 Thinker。
3. 思考。基于对话历史组织出一段回应。
4. 说话。合成音频 token，解码为波形，流式传送到用户的扬声器。

每一步都会增加延迟。要有对话感，总往返时延必须小于 500ms——低于这个值，用户就不再注意到滞后。GPT-4o 声称约 250ms，Moshi 约 160ms，Qwen2.5-Omni 约 350-500ms。

每个组件都必须能流式处理。任何环节都不能「全部攒齐再解码」。

## 核心概念

### Thinker 与 Talker

Qwen2.5-Omni 的分解方式：

- Thinker：一个 7B-80B 的文本生成 transformer。消费交错排列的文本 + 图像 + 音频 token，输出代表「要说什么」的文本 token。
- Talker：一个更小的语音生成 transformer（200M-1B）。消费 Thinker 的文本输出 token 加上近期的语音上下文 token，输出离散语音 token（残差向量量化（residual-VQ）索引）。
- 语音解码器：一个流式波形解码器（SNAC、MoVQGAN 家族），实时地把语音 token 转为音频采样。

这种分离很关键。Thinker 必须够大才能有良好的推理能力。Talker 可以很小，因为它的任务是局部的——把文本转成语音 token。Talker 更大并不会更有表现力，只会更慢。

二者并行运行：

1. Thinker 发出文本 token t_i。
2. Talker（通过流式）消费 t_i 并发出语音 token s_i、s_{i+1}、……、s_{i+k}。
3. 语音解码器随到随取地消费语音 token，并发出音频采样。
4. 当 Thinker 推进到文本 token t_{i+3} 时，Talker 已经为 t_0..t_{i+2} 流式输出了音频。

### TMRoPE——时间对齐的多模态位置

Thinker 需要整合图像帧（比如以 4 FPS 到达）、音频帧（以 50 帧/秒到达）以及来自对话历史的文本。朴素的序列排序（先放所有图像，再放所有音频，最后放文本）会丢失时间上的对齐关系。

TMRoPE 为每个 token 赋予绝对时间戳。视觉 token 在 t=2.3s，音频 token 在 t=2.32s，用户说出的「stop」这个文本 token 在 t=2.35s。RoPE 按时间戳旋转注意力，模型于是把它们视为时间上同时发生。

这正是让「他一边挥手一边说你好」得以成立的底层设施——模型在同一概念时刻同时看到视频帧和音频。

### 流式语音合成

语音 token 必须流式产出。Mini-Omni（Xie & Wu，2024）提出了「语言模型可以一边流式思考一边听、说」：Thinker 的输出 token 和 Talker 的输出 token 交错排列在同一个序列中。一旦 Thinker 确定下一个文本 token，Talker 便立即触发。没有批处理边界。

Moshi（Défossez 等人，2024 年 10 月）是最快的开源实现。在单张 A100 上 TTFAB 为 160ms。其架构是：单个 7B transformer，在交替位置上发出文本 token 和语音 token，并带有一条「内心独白（inner monologue）」，将思考流与说话流分开。这实际上是把 Thinker + Talker 通过精心训练融合进了一个模型。

### VAD 与轮流发言

语音活动检测运行在输入侧。两种模式：

- 半双工：用户说话，模型聆听；模型说话，用户聆听。通过 VAD 静音检测（约 200ms）明确交接。
- 全双工：双方可以同时说话。模型可以「反馈应答（backchannel）」（「嗯哼」）或打断。这要难得多。Moshi 支持这种模式。

Qwen2.5-Omni 默认支持半双工，通过静音阈值实现轮流发言。全双工则需要应用层来处理。

### Qwen3-Omni（2025 年 11 月）

后继者。Qwen3-80B Thinker、更大的 Talker、改进的 TMRoPE-v2。延迟接近 GPT-4o 的 250ms。开放权重。在 OmniBench 上的基准成绩与 Gemini 2.0 Live 相当。

### 生产环境延迟预算

对于一次典型的流式交互：

- 麦克风 -> 音频 token：40-80ms。
- 预填充（prompt + 历史）：在 7B 上 100-200ms，在 70B 上要多得多。
- 第一个 Thinker 文本 token：40ms。
- Talker 处理第一个文本 token：20ms。
- 首批语音 token 确定：40ms。
- 残差向量量化解码：30ms。
- 语音波形解码：50-80ms。

TTFAB 合计：7B 上 320-510ms，70B 上 600-900ms。前沿质量通常意味着 70B 以上，因此存在前沿延迟差距。

### Token 速率的数学

在 16kHz 语音、基础语音 token 速率为 50 Hz 的情况下，每秒输出需要 50 个语音 token。Talker 必须发出 ≥50 tok/s 才能跟上。以 H100 上典型 LLM 30-80 tok/s 的吞吐来看，一个小（200-300M）的 Talker 足够快，而一个 7B 的 Talker 会跟不上。

这就是为什么会存在小型专用 Talker 模型，而不是「直接用主模型就好」。

## 动手用

`code/main.py`：

- 用模拟的 token 发射速率仿真一个 Thinker-Talker 管线。
- 为可配置的模型规模和麦克风采样率计算 TTFAB。
- 用 VAD 静音阈值演示半双工轮流发言。

## 交付物

本课产出 `outputs/skill-omni-streaming-budget.md`。给定一个实时语音产品的目标 TTFAB 和功能集合（视觉输入、双语、全双工），从中选定 Qwen2.5-Omni、Qwen3-Omni、Moshi 或 Mini-Omni，并确定 Thinker/Talker 的规模。

## 练习

1. 你的目标 TTFAB 是 300ms。在 7B Thinker 和 300M Talker 上，写出每个组件的延迟。

2. Qwen2.5-Omni 使用 TMRoPE。描述这样一个 prompt：用户在 t=1s 开始说话，摄像头在 t=1.2s 捕捉到一个手势，模型看到的是什么。

3. 全双工支持要求模型在聆听的同时发出音频。提出一种能教会模型这一点的训练数据格式。

4. 阅读 Moshi 论文第 4 节。描述「内心独白」分离机制，以及它为何避免了 Thinker-Talker 的拆分。

5. 计算吞吐预算：在 16kHz 语音、基础层 50 token/秒的条件下，Talker 必须以多快的速度发出 token 才能跟上？

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------------|------------------------|
| Thinker | 「推理大脑」 | 产生「要说什么」的大型文本生成 transformer |
| Talker | 「语音生成之口」 | 从 Thinker 的文本产生离散语音 token 的小型 transformer |
| TTFAB | 「延迟预算」 | 首个音频字节耗时：从用户说话结束到第一个音频采样输出的时间 |
| TMRoPE | 「时间对齐的 RoPE」 | 使用跨视觉、音频、文本绝对时间戳的位置编码 |
| Half-duplex | 「轮流发言」 | 用户与模型交替；VAD 静音检测判断用户说完 |
| Full-duplex | 「同时进行」 | 模型可同时说话与聆听；具备反馈应答能力 |
| Inner monologue | 「Moshi 分离」 | 单模型设计，思考流与说话流交错排列 |

## 延伸阅读

- [Xu et al. — Qwen2.5-Omni (arXiv:2503.20215)](https://arxiv.org/abs/2503.20215)
- [Qwen Team — Qwen3-Omni (arXiv:2509.17765)](https://arxiv.org/html/2509.17765v1)
- [Xie & Wu — Mini-Omni (arXiv:2408.16725)](https://arxiv.org/abs/2408.16725)
- [Défossez et al. — Moshi (arXiv:2410.00037)](https://arxiv.org/abs/2410.00037)
- [Zeng et al. — GLM-4-Voice (arXiv:2412.02612)](https://arxiv.org/abs/2412.02612)
