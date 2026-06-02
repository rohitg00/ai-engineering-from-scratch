# Omni 模型：Qwen2.5-Omni 与 Thinker-Talker 拆分

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 2024 年 5 月 GPT-4o 的产品演示之所以颠覆，不在于底层模型，而在于产品形态——一个语音界面：你说话，模型看着摄像头里的画面，再在 250ms 内回话。开源生态接下来用 2024 年和 2025 年一整年来追赶这个产品形态。Qwen2.5-Omni（2025 年 3 月）是开源界的参考设计：一个 Thinker（大型文本生成 transformer）加一个 Talker（并行的语音生成 transformer），靠 streaming 的 speech token 串起来。Mini-Omni 把它简化了，Moshi 把延迟追平了，GLM-4-Voice 把它扩展到了中文。本课读 Thinker-Talker 架构，以及让 streaming 实时对话能跑起来的延迟预算。

**Type:** Build
**Languages:** Python (stdlib, streaming pipeline latency simulator + VAD loop)
**Prerequisites:** Phase 12 · 19 (audio-LLMs), Phase 12 · 16 (any-to-any)
**Time:** ~180 minutes

## 学习目标（Learning Objectives）

- 把推理流水线拆成 Thinker（文本推理）和 Talker（语音合成），并解释为什么并行 streaming 能跑通。
- 逐组件计算一次对话交互的 time-to-first-audio-byte（TTFAB，首音频字节时间）预算。
- 描述 TMRoPE 如何在 Thinker 内部对视觉、音频、文本做时间对齐的位置编码。
- 说出三种实时对话模式：half-duplex（半双工）、turn-taking（轮流发言）、full-duplex（全双工）。

## 问题（The Problem）

一个实时语音助手要做的事很多，而且都得快：

1. 听到用户。实时 speech tokenization，再加 voice activity detection（VAD，语音活动检测）来判断他什么时候说完。
2. 可能还要看到。摄像头以 2-4 FPS 输入，与音频一起 stream 进 Thinker。
3. 思考。基于对话历史组织出回复内容。
4. 说出来。合成 speech token，解码成波形，stream 到用户的扬声器。

每一步都加延迟。要有「对话感」总往返必须 < 500ms——低于这个值，用户就不会再注意到延迟。GPT-4o 号称约 250ms。Moshi 约 160ms。Qwen2.5-Omni 约 350-500ms。

每个组件都得 streaming。任何一步都不能是「先批量算完再解码」。

## 概念（The Concept）

### Thinker 与 Talker

Qwen2.5-Omni 的拆分方式：

- Thinker：一个 7B-80B 的文本生成 transformer。吃交错的 text + image + audio token，输出代表「要说什么」的 text token。
- Talker：一个更小的语音生成 transformer（200M-1B）。吃 Thinker 输出的 text token，再加上最近的语音上下文 token，输出离散的 speech token（residual-VQ 索引）。
- 语音解码器（Speech decoder）：一个 streaming 波形解码器（SNAC、MoVQGAN 这类），把 speech token 实时转成音频采样。

这种拆分很关键。Thinker 必须够大，推理才好；Talker 可以小，因为它的活儿是局部的——把文本转成 speech token。Talker 大并不会更有表现力，只会更慢。

让两者并行跑：

1. Thinker 发出 text token t_i。
2. Talker 通过 streaming 拿到 t_i，然后发出 speech token s_i, s_{i+1}, ..., s_{i+k}。
3. 语音解码器边来边吃 speech token，边输出音频采样。
4. 等到 Thinker 走到 text token t_{i+3} 时，Talker 已经把 t_0..t_{i+2} 的音频 stream 出去了。

### TMRoPE——时间对齐的多模态位置

Thinker 要把图像帧（比如 4 FPS 进来）、音频帧（50 帧/秒进来）、对话历史里的文本整合在一起。如果朴素地按顺序排（先所有图像、再所有音频、再文本），时间对齐就丢了。

TMRoPE 给每个 token 都赋一个绝对时间戳。视觉 token 在 t=2.3s。音频 token 在 t=2.32s。用户说出 “stop” 的文本 token 在 t=2.35s。RoPE 按时间戳来旋转 attention；模型就把它们看成是时间上同时发生的。

这就是「他一边挥手一边说你好」能跑通的基础设施——模型在同一个概念时刻看到了视频帧和音频。

### Streaming 语音合成

Speech token 必须能 stream。Mini-Omni（Xie & Wu, 2024）提出「语言模型可以一边思考一边以 streaming 方式听和说」：Thinker 输出 token 和 Talker 输出 token 在同一个序列里交错排布。Thinker 一旦提交下一个 text token，Talker 立刻发车。没有批次边界。

Moshi（Défossez 等，2024 年 10 月）是开源里最快的实现。在单卡 A100 上 TTFAB 160ms。架构：单个 7B transformer 在交替位置上同时输出 text 和 speech token，再加一条「inner monologue（内心独白）」把思考流和说话流分开。这等效于把 Thinker + Talker 融合在一个模型里，靠精心训练让它工作。

### VAD 与轮流发言

Voice activity detection 跑在输入侧。两种模式：

- Half-duplex：用户说话时模型听着，模型说话时用户听着。靠 VAD 检测静音（约 200ms）来交接。
- Full-duplex：双方可以同时说。模型可以反向应答（”嗯哼“）或者打断。难度大得多。Moshi 支持这个。

Qwen2.5-Omni 默认支持 half-duplex，用静音阈值做轮流发言。Full-duplex 要在应用层自己处理。

### Qwen3-Omni（2025 年 11 月）

后继版本。Qwen3-80B 的 Thinker、更大的 Talker、改进版 TMRoPE-v2。延迟逼近 GPT-4o 的 250ms。开源权重。OmniBench 上的成绩与 Gemini 2.0 Live 旗鼓相当。

### 生产环境延迟预算

一次典型 streaming 交互：

- 麦克风 -> audio token：40-80ms。
- Prefill（prompt + 历史）：7B 上 100-200ms，70B 上多得多。
- 第一个 Thinker text token：40ms。
- Talker 处理第一个 text token：20ms。
- 第一批 speech token 提交：40ms。
- Residual-VQ 解码：30ms。
- 语音波形解码：50-80ms。

合计 TTFAB：7B 上 320-510ms，70B 上 600-900ms。前沿质量通常意味着 70B+，所以前沿水平有这么个延迟差距。

### Token 速率算账

16kHz 语音、50 Hz 基础 speech token 速率下，每秒输出需要 50 个 speech token。Talker 必须发到 ≥50 tok/s 才跟得上。一张 H100 上典型 LLM 吞吐 30-80 tok/s，小型（200-300M）Talker 够快；7B 的 Talker 就跟不上了。

这就是为什么要有专门的小 Talker，而不是「直接用主模型搞定」。

## 用起来（Use It）

`code/main.py`：

- 用 mock 的 token 发射速率模拟一条 Thinker-Talker 流水线。
- 在可配置的模型尺寸和麦克风采样率下计算 TTFAB。
- 演示带 VAD 静音阈值的 half-duplex 轮流发言。

## 上线部署（Ship It）

本课产出 `outputs/skill-omni-streaming-budget.md`。给定一个实时语音产品的目标 TTFAB 和功能集（vision-in、双语、full-duplex），从 Qwen2.5-Omni、Qwen3-Omni、Moshi、Mini-Omni 中挑一个，并定 Thinker/Talker 的尺寸。

## 练习（Exercises）

1. 你的目标 TTFAB 是 300ms。在 7B Thinker + 300M Talker 上，写出每个组件的延迟。

2. Qwen2.5-Omni 用了 TMRoPE。描述一下：用户在 t=1s 开始说话，摄像头在 t=1.2s 抓到一个手势，模型看到的是什么。

3. Full-duplex 支持要求模型能边听边发音频。设计一种训练数据格式来教它这件事。

4. 读 Moshi 论文 Section 4。描述「inner monologue」的分流方式，以及为什么它绕开了 Thinker-Talker 拆分。

5. 算一下吞吐预算：要跟上 16kHz 语音、基础层 50 token/秒，Talker 必须以多快的速度发 token？

## 关键术语（Key Terms）

| 术语 | 大家怎么说 | 实际意思 |
|------|-----------|---------|
| Thinker | 「推理大脑」 | 大型文本生成 transformer，决定要说什么 |
| Talker | 「发音的嘴」 | 小型 transformer，根据 Thinker 的文本生成离散 speech token |
| TTFAB | 「延迟预算」 | Time-to-first-audio-byte：从用户说话结束到第一个音频采样输出 |
| TMRoPE | 「时间对齐 RoPE」 | 用绝对时间戳跨视觉、音频、文本做位置编码 |
| Half-duplex | 「轮流发言」 | 用户和模型交替；VAD 静音判定用户说完 |
| Full-duplex | 「同时说」 | 模型可以一边说一边听；具备反向应答能力 |
| Inner monologue | 「Moshi 的分流」 | 单模型设计，思考流和说话流在序列上交错 |

## 延伸阅读（Further Reading）

- [Xu et al. — Qwen2.5-Omni (arXiv:2503.20215)](https://arxiv.org/abs/2503.20215)
- [Qwen Team — Qwen3-Omni (arXiv:2509.17765)](https://arxiv.org/html/2509.17765v1)
- [Xie & Wu — Mini-Omni (arXiv:2408.16725)](https://arxiv.org/abs/2408.16725)
- [Défossez et al. — Moshi (arXiv:2410.00037)](https://arxiv.org/abs/2410.00037)
- [Zeng et al. — GLM-4-Voice (arXiv:2412.02612)](https://arxiv.org/abs/2412.02612)
