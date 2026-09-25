# 全模态模型：Qwen2.5-Omni 与 Thinker-Talker 分离架构

> GPT-4o 在 2024 年 5 月的产品演示之所以具有颠覆性，不在于底层模型，而在于产品形态——一个语音界面：你说话，模型看到摄像头所见的画面，并在 250 毫秒内回应。开放生态在 2024 年和 2025 年的其余时间里都在竞相达到这一产品形态。Qwen2.5-Omni（2025 年 3 月）是参考性的开源设计：一个 Thinker（大型文本生成 Transformer）加一个 Talker（并行的语音生成 Transformer），通过流式语音 token 相连。Mini-Omni 对其进行了简化，Moshi 匹配了它的延迟，GLM-4-Voice 将其扩展到中文。本课解读 Thinker-Talker 架构，以及让流式实时对话成为可能的延迟预算。

**Type:** Build
**Languages:** Python（标准库，流式管线延迟模拟器 + VAD 循环）
**Prerequisites:** Phase 12 · 19（audio-LLMs）、Phase 12 · 16（any-to-any）
**Time:** ~180 minutes

## 学习目标

- 将推理管线拆分为 Thinker（文本推理）和 Talker（语音合成），并解释为什么并行流式处理可行。
- 按组件逐一计算对话交互的 time-to-first-audio-byte（TTFAB）预算。
- 描述 TMRoPE 在 Thinker 内部对视觉、音频和文本的时间对齐位置编码。
- 说出三种实时对话模式：半双工、轮替对话、全双工。

## 问题

一个实时语音助手必须快速完成很多事情：

1. 听到用户。实时语音 token 化，用语音活动检测（VAD）判断用户何时说完。
2. 可选地看到。以 2-4 FPS 的速率获取摄像头输入，与音频一起流入 Thinker。
3. 思考。基于对话历史生成回复。
4. 说话。合成音频 token，解码为波形，流式传输到用户扬声器。

每一步都会增加延迟。对话感要求总往返延迟 < 500 毫秒——低于这个阈值，用户就不会察觉到滞后。GPT-4o 宣称约 250ms，Moshi 约 160ms，Qwen2.5-Omni 约 350-500ms。

每个组件都必须流式处理。不能“先全部批处理，再解码”。

## 概念

### Thinker 与 Talker

Qwen2.5-Omni 的分解方式：

- Thinker：一个 7B-80B 的文本生成 Transformer。消费交错的文本 + 图像 + 音频 token，输出表示“说什么”的文本 token。
- Talker：一个较小的语音生成 Transformer（200M-1B）。消费 Thinker 的文本输出 token 以及近期的语音上下文 token，输出离散语音 token（residual-VQ 索引）。
- 语音解码器：一个流式波形解码器（SNAC、MoVQGAN 一族），实时地将语音 token 转换为音频采样。

这种分离很重要。Thinker 必须足够大才能有良好的推理能力。Talker 可以很小，因为它的任务是局部的——把文本转换为语音 token。更大的 Talker 并不会更有表现力，只会更慢。

两者并行运行：

1. Thinker 输出文本 token t_i。
2. Talker 消费 t_i（通过流式传输），并输出语音 token s_i、s_{i+1}、...、s_{i+k}。
3. 语音解码器随语音 token 的到达即时消费并输出音频采样。
4. 当 Thinker 处理到文本 token t_{i+3} 时，Talker 已经把 t_0..t_{i+2} 的音频流式输出了。

### TMRoPE — 时间对齐的多模态位置编码

Thinker 需要整合图像帧（以约 4 FPS 到达）、音频帧（以每秒 50 帧到达）以及来自对话历史的文本。朴素的序列顺序（先所有图像、再所有音频、最后文本）会丢失时间对齐。

TMRoPE 为每个 token 分配绝对时间戳。t=2.3s 处的视觉 token，t=2.32s 处的音频 token，t=2.35s 处用户说的“停”的文本 token。RoPE 按时间戳旋转注意力，模型据此把它们视为时间上并发的。

这是“他一边挥手一边说你好”能生效的基础设施——模型在同一个概念时刻看到视频帧和音频。

### 流式语音合成

语音 token 必须流式处理。Mini-Omni（Xie & Wu，2024）提出了“语言模型可以边听边在流式思考的同时说话”：Thinker 的输出 token 和 Talker 的输出 token 交错在同一条序列中。Talker 在 Thinker 提交下一个文本 token 时立即触发。没有批处理边界。

Moshi（Défossez et al.，2024 年 10 月）是最快的开源实现。在单张 A100 上达到 160ms TTFAB。架构：单个 7B Transformer 在交替位置上输出文本 token 和语音 token，并利用一个“内心独白”将思考流与说话流分开。这实际上是把 Thinker + Talker 通过精心的训练融合成一个模型。

### VAD 与轮替对话

语音活动检测在输入侧运行。有两种模式：

- 半双工：用户说话时模型监听；模型说话时用户监听。通过 VAD 静音检测（约 200ms）进行清晰的交接。
- 全双工：双方可以同时说话。模型可以插话反馈（“嗯嗯”）或打断。难度大得多。Moshi 支持这一模式。

Qwen2.5-Omni 默认支持半双工，通过静音阈值实现轮替对话。全双工需要在应用层处理。

### Qwen3-Omni（2025 年 11 月）

后继者。Qwen3-80B Thinker，更大的 Talker，改进的 TMRoPE-v2。延迟接近 GPT-4o 的 250ms。开放权重。在 OmniBench 上的基准成绩与 Gemini 2.0 Live 相当。

### 生产级延迟预算

对于典型的流式交互：

- 麦克风 -> 音频 token：40-80ms。
- Prefill（提示词 + 历史）：7B 下 100-200ms，70B 下要多得多。
- Thinker 的首个文本 token：40ms。
- Talker 处理首个文本 token：20ms。
- 首批语音 token 提交：40ms。
- Residual-VQ 解码：30ms。
- 语音波形解码：50-80ms。

总 TTFAB：7B 下 320-510ms，70B 下 600-900ms。前沿质量通常意味着 70B+，因此存在前沿延迟差距。

### Token 速率计算

在 16kHz 语音、50 Hz 基础语音 token 的条件下，每秒输出需要 50 个语音 token。Talker 必须达到 ≥50 tok/s 才能跟上。在 H100 上典型的 LLM 吞吐量为 30-80 tok/s，一个小的（200-300M）Talker 足够快；而 7B 的 Talker 会跟不上。

这就是为什么存在小型专用 Talker 模型，而不是“直接用主模型”。

```figure
l5-thinker-talker
```

## 使用

`code/main.py`：

- 用模拟的 token 输出速率仿真 Thinker-Talker 管线。
- 计算可配置模型大小和麦克风采样率下的 TTFAB。
- 演示带 VAD 静音阈值的半双工轮替对话。

## 交付

本课产出 `outputs/skill-omni-streaming-budget.md`。给定一个实时语音产品的目标 TTFAB 和功能集（视觉输入、双语、全双工），从中选择 Qwen2.5-Omni、Qwen3-Omni、Moshi 或 Mini-Omni，并确定 Thinker/Talker 的规模。

## 练习

1. 你的目标 TTFAB 是 300ms。在 7B Thinker 和 300M Talker 上，写出每个组件的延迟。

2. Qwen2.5-Omni 使用 TMRoPE。描述在用户于 t=1s 开始说话、摄像头在 t=1.2s 捕捉到一个手势的提示中，模型看到的是什么。

3. 全双工支持要求模型在监听的同时输出音频。提出一种能教会这一能力的训练数据格式。

4. 阅读 Moshi 论文第 4 节。描述“内心独白”的分离方式，以及它为什么避免了 Thinker-Talker 拆分。

5. 计算吞吐量预算：Talker 的 token 输出速度必须多快，才能跟上 16kHz 语音在 50 个基础层 token/秒下的需求？

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|-----------------|------------------------|
| Thinker | “推理大脑” | 生成“说什么”的大型文本生成 Transformer |
| Talker | “生成语音的嘴巴” | 从 Thinker 的文本生成离散语音 token 的小型 Transformer |
| TTFAB | “延迟预算” | Time-to-first-audio-byte：从用户语音结束到第一个音频采样输出 |
| TMRoPE | “时间对齐的 RoPE” | 使用绝对时间戳、跨越视觉/音频/文本的位置编码 |
| 半双工 | “轮替对话” | 用户与模型交替说话；VAD 静音检测判断用户说完 |
| 全双工 | “同时进行” | 模型可以同时说话和监听；具备插话反馈能力 |
| 内心独白 | “Moshi 的分离方式” | 思考流与说话流交织的单模型设计 |

## 延伸阅读

- [Xu et al. — Qwen2.5-Omni (arXiv:2503.20215)](https://arxiv.org/abs/2503.20215)
- [Qwen Team — Qwen3-Omni (arXiv:2509.17765)](https://arxiv.org/html/2509.17765v1)
- [Xie & Wu — Mini-Omni (arXiv:2408.16725)](https://arxiv.org/abs/2408.16725)
- [Défossez et al. — Moshi (arXiv:2410.00037)](https://arxiv.org/abs/2410.00037)
- [Zeng et al. — GLM-4-Voice (arXiv:2412.02612)](https://arxiv.org/abs/2412.02612)