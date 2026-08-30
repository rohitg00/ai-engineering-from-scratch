# 全模态模型：Qwen2.5-Omni 与 Thinker-Talker 分离

> GPT-4o 在 2024 年 5 月的产品演示之所以具有颠覆性，不是因为底层模型，而是因为产品形态——一个语音界面，你说话，模型看到摄像头看到的内容，并在 250 毫秒内回话。开放生态系统在 2024 年和 2025 年剩余时间里竞相达到那个产品表面。Qwen2.5-Omni（2025 年 3 月）是参考开放设计：一个 Thinker（大型文本生成 transformer）加一个 Talker（并行语音生成 transformer），通过流式语音 token 连接。Mini-Omni 简化了它，Moshi 匹配了它的延迟，GLM-4-Voice 将其扩展到中文。本课解读 Thinker-Talker 架构和使流式实时对话工作的延迟预算。

**类型：** Build
**语言：** Python（stdlib，流式流水线延迟模拟器 + VAD 循环）
**前置知识：** Phase 12 · 19（音频-LLM），Phase 12 · 16（any-to-any）
**时间：** ~180 分钟

## 学习目标

- 将推理流水线拆分为 Thinker（文本推理）和 Talker（语音合成），并解释为什么并行流式有效。
- 逐组件计算对话交互的首次音频字节时间（TTFAB）预算。
- 描述 TMRoPE 在 Thinker 内部跨视觉、音频和文本的时间对齐位置编码。
- 命名三种实时对话模式：半双工、轮流、全双工。

## 问题所在

实时语音助手必须快速做很多事情：

1. 听到用户。实时语音 token 化，语音活动检测（VAD）以知道他们何时说完。
2. 可选地看到。摄像头输入以 2-4 FPS 流入 Thinker，与音频并行。
3. 思考。以对话历史为条件组合回应。
4. 说话。合成音频 token，解码为波形，流式传输到用户扬声器。

每一步都增加延迟。对话感要求总往返 < 500 毫秒——低于此，用户停止注意到滞后。GPT-4o 声称约 250 毫秒。Moshi 约 160 毫秒。Qwen2.5-Omni 约 350-500 毫秒。

每个组件都需要流式。不能"批量处理然后解码"。

## 核心概念

### Thinker 和 Talker

Qwen2.5-Omni 的分解：

- Thinker：7B-80B 文本生成 transformer。消费交错的文本 + 图像 + 音频 token。输出代表要说什么的文本 token。
- Talker：较小的语音生成 transformer（200M-1B）。消费 Thinker 的文本输出 token 加上最近的语音上下文 token。输出离散语音 token（残差-VQ 索引）。
- 语音解码器：流式波形解码器（SNAC、MoVQGAN 家族），实时将语音 token 转为音频样本。

分离很重要。Thinker 必须大才能有好的推理。Talker 可以小，因为它的工作是局部的——将文本转为语音 token。更大的 Talker 不是更有表现力；它更慢。

并行运行两者：

1. Thinker 发出文本 token t_i。
2. Talker 消费 t_i（通过流式）并发出语音 token s_i, s_{i+1}, ..., s_{i+k}。
3. 语音解码器随语音 token 到来消费它们并发出音频样本。
4. 当 Thinker 到达文本 token t_{i+3} 时，Talker 已经流式传输了 t_0..t_{i+2} 的音频。

### TMRoPE——时间对齐多模态位置

Thinker 需要整合图像帧（以例如 4 FPS 到达）、音频帧（以 50 帧/秒到达）和对话历史中的文本。朴素的序列顺序（所有图像，然后所有音频，然后文本）丢失时间对齐。

TMRoPE 为每个 token 分配绝对时间戳。视觉 token 在 t=2.3s。音频 token 在 t=2.32s。用户文本 token "stop" 在 t=2.35s。RoPE 按时间戳旋转注意力；模型将它们视为时间并发。

这是"他挥手时说你好"工作的基础设施——模型在同一概念时刻看到视频帧和音频。

### 流式语音合成

语音 token 必须流式。Mini-Omni（Xie & Wu，2024）引入"语言模型可以在流式中边听边想边说"：Thinker 输出 token 和 Talker 输出 token 在同一序列中交错。Thinker 提交下一个文本 token 时 Talker 立即触发。没有批量边界。

Moshi（Défossez 等人，2024 年 10 月）是最快的开放实现。单 A100 上 160 毫秒 TTFAB。架构：单个 7B transformer，在交替位置发出文本和语音 token，带有"内心独白"将思考流与说话流分离。这实际上是将 Thinker + Talker 融合到一个模型中，经过精心训练。

### VAD 和轮流

语音活动检测在输入侧运行。两种模式：

- 半双工：用户说话，模型听。模型说话，用户听。通过 VAD 静音检测（约 200 毫秒）清晰切换。
- 全双工：双方可以同时说话。模型可以回话（"嗯哼"）或打断。困难得多。Moshi 支持这个。

Qwen2.5-Omni 默认支持半双工，通过静音阈值轮流。全双工需要应用层处理。

### Qwen3-Omni（2025 年 11 月）

后继者。Qwen3-80B Thinker，更大的 Talker，改进的 TMRoPE-v2。延迟接近 GPT-4o 的 250 毫秒。开放权重。OmniBench 基准测试与 Gemini 2.0 Live 竞争。

### 生产延迟预算

对于典型流式交互：

- 麦克风 -> 音频 token：40-80 毫秒。
- 预填充（提示 + 历史）：7B 上 100-200 毫秒，70B 上多得多。
- 首个 Thinker 文本 token：40 毫秒。
- Talker 处理首个文本 token：20 毫秒。
- 首个语音 token 提交：40 毫秒。
- 残差-VQ 解码：30 毫秒。
- 语音波形解码：50-80 毫秒。

7B 上总 TTFAB：320-510 毫秒，70B 上 600-900 毫秒。前沿质量通常意味着 70B+；因此前沿延迟差距。

### Token 速率数学

16kHz 语音以 50 Hz 基础语音 token，每秒输出需要 50 个语音 token。Talker 必须发出 ≥50 tok/s 才能跟上。H100 上典型 LLM 吞吐量为 30-80 tok/s，小型（200-300M）Talker 足够快；7B Talker 会落后。

这就是为什么存在小型专用 Talker 模型，而不是"只用主模型"。

## 使用它

`code/main.py`：

- 用模拟 token 发射速率模拟 Thinker-Talker 流水线。
- 为可配置模型大小和麦克风采样率计算 TTFAB。
- 用 VAD 静音阈值演示半双工轮流。

## 交付它

本课产出 `outputs/skill-omni-streaming-budget.md`。给定实时语音产品的目标 TTFAB 和功能集（视觉输入、双语、全双工），选择 Qwen2.5-Omni、Qwen3-Omni、Moshi 或 Mini-Omni 并确定 Thinker/Talker 大小。

## 练习

1. 你的目标 TTFAB 是 300 毫秒。在 7B Thinker 和 300M Talker 上，写出每个组件的延迟。

2. Qwen2.5-Omni 使用 TMRoPE。描述用户在 t=1s 开始说话且摄像头在 t=1.2s 捕捉手势时模型看到什么。

3. 全双工支持要求模型在听的同时发出音频。提出教授此功能的训练数据格式。

4. 阅读 Moshi 论文第 4 节。描述"内心独白"分离以及为什么它避免了 Thinker-Talker 拆分。

5. 计算吞吐量预算：Talker 必须以多快速度发出 token 才能跟上 16kHz 语音在 50 基础层 token/秒？

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------------|------------------------|
| Thinker | "推理大脑" | 产生要说什么的 大型文本生成 transformer |
| Talker | "语音生成嘴" | 从 Thinker 的文本产生离散语音 token 的小型 transformer |
| TTFAB | "延迟预算" | 首次音频字节时间：从用户语音结束到首个音频样本输出 |
| TMRoPE | "时间对齐 RoPE" | 跨视觉、音频、文本使用绝对时间戳的位置编码 |
| 半双工 | "轮流" | 用户和模型交替；VAD 静音检测用户说完 |
| 全双工 | "同时" | 模型可以同时说话和听；支持回话 |
| 内心独白 | "Moshi 分离" | 单模型设计，思考流和说话流交错 |

## 延伸阅读

- [Xu et al. — Qwen2.5-Omni (arXiv:2503.20215)](https://arxiv.org/abs/2503.20215)
- [Qwen Team — Qwen3-Omni (arXiv:2509.17765)](https://arxiv.org/html/2509.17765v1)
- [Xie & Wu — Mini-Omni (arXiv:2408.16725)](https://arxiv.org/abs/2408.16725)
- [Défossez et al. — Moshi (arXiv:2410.00037)](https://arxiv.org/abs/2410.00037)
- [Zeng et al. — GLM-4-Voice (arXiv:2412.02612)](https://arxiv.org/abs/2412.02612)
