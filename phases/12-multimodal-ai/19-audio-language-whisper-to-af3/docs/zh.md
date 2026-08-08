# 19 · 音频-语言模型：从 Whisper 到 Audio Flamingo 3 的演进脉络

> Whisper（Radford 等，2022 年 12 月）一举奠定了语音识别的格局——68 万小时弱监督的多语种语音、一个简洁的编码器-解码器 Transformer，以及一个让此后每一项「自动语音识别（ASR）」发布都不得不引用的基准。但识别并不等于推理。要回答「这段录音里有哪些乐器」「说话者表达了什么情绪」或「第 3 分钟发生了什么」，需要的是音频理解（audio understanding），而非转写。Qwen-Audio、SALMONN、LTU 以及 NVIDIA 的 Audio Flamingo 3（AF3，2025 年 7 月）一步步搭起了这套技术栈：沿用 Whisper 级别的编码器、外挂 Q-former、用音频-文本指令数据训练、再加上「思维链（chain-of-thought）」推理。本课就来走一遍这条脉络。

**类型：** 实战构建
**语言：** Python（标准库，对数梅尔频谱图 + 音频 Q-former 骨架）
**前置：** 阶段 6（语音与音频）、阶段 12 · 03（Q-Former）
**时长：** 约 180 分钟

## 学习目标

- 从波形计算「对数梅尔频谱图（log-Mel spectrogram）」：加窗、FFT、滤波器组、对数变换。
- 比较各种编码器选项：Whisper 编码器、BEATs、AF-Whisper 混合方案。各自的优势场景。
- 构建音频 Q-former：N 个可学习查询（learnable queries）对频谱图分块做交叉注意力。
- 解释级联式（先 Whisper 再 LLM）与端到端（end-to-end）音频-LLM 训练的区别：为何端到端在推理上更具可扩展性。

## 问题所在

语音识别已被 Whisper 解决。「音频版 OCR」已成为大宗商品化能力。但「商品化」止步于转写。如果模型无法对其所听内容进行推理——时序、说话人、情绪、音乐结构、环境声——单凭转写无法支撑产品功能。

三条显而易见的路线：

1. 级联（Cascade）：Whisper 负责转写，LLM 对转写文本进行推理。适用于纯语音场景。但在音乐、环境音、多说话人重叠、情绪等方面失效。

2. 端到端音频-LLM：由音频编码器直接将音频 token 喂给 LLM，跳过转写环节。保留了声学信息（情绪、说话人、环境）。需要新的训练数据。

3. 混合（Hybrid）：音频编码器 + 既能转写又能推理的文本解码器。Qwen-Audio 和 Audio Flamingo 走的就是这条路。

## 核心概念

### 对数梅尔频谱图：输入特征

每个音频编码器都从同一种特征开始：对数梅尔频谱图。

1. 重采样到 16 kHz。
2. 用 25ms 窗、10ms 跳步（hop）做「短时傅里叶变换（short-time Fourier transform）」。
3. 取 FFT 结果的幅值。
4. 应用「梅尔滤波器组（Mel filter banks）」（通常为 80 个滤波器，在 0-8000 Hz 上做对数间隔分布），将频率扭曲到感知尺度。
5. 做对数压缩（log(1 + x)）以适配动态范围。

结果：一个形状为 (T, 80) 的二维数组，其中 T 是时间帧数。对于一段帧率 100 Hz 的 30 秒片段：(3000, 80)。

### Whisper 的编码器

Whisper 的编码器是一个 12 层、ViT 风格的 Transformer，将对数梅尔频谱图作为一串时间帧序列来处理。输出：每个时间帧对应一个隐状态向量。

对于 ASR，Whisper 的解码器是一个交叉注意力 Transformer，以编码器输出为条件生成文本 token。这是标准的编码器-解码器结构。

对于「音频-LLM（ALM，audio-LLM）」，你希望把编码器输出作为另一个 LLM 的输入。其范式为：Whisper 编码器冻结、Q-former 可训练、LLM 冻结或微调。

### BEATs 与音频专用编码器

Whisper 是在以语音为主的数据上训练的，因此在音乐和环境音上较弱。

BEATs（Chen 等，2022）是一个在 AudioSet 上训练的「自监督（self-supervised）」Transformer。在相同参数量下，它对音乐和环境声的捕捉优于 Whisper。

AF-Whisper（Audio Flamingo 3 的混合方案）：把 Whisper + BEATs 的特征拼接（concat）作为音频输入。Whisper 承载语言信号，BEATs 承载声学信号。

### 音频 Q-former

与 BLIP-2 的视觉 Q-former 同一范式。固定数量的可学习查询（通常为 32 或 64 个）对音频编码器输出的帧做交叉注意力。这些查询便成为 LLM 所消费的音频 token。

训练对齐阶段：仅训练 Q-former，在音频-文本对（AudioCaps、Clotho）上施加对比损失 + 字幕损失。指令阶段：端到端训练，解冻 LLM，在指令数据上训练。

### 演进脉络——SALMONN、Qwen-Audio、AF3

SALMONN（Tang 等，2023）：Whisper + BEATs + Q-former + LLaMA。第一个具备认真推理能力的开源音频-LLM。在 MMAU 上的综合分约为 0.55。

Qwen-Audio（Chu 等，2023）：架构类似，在更丰富的数据集上训练，针对多轮对话做了调优。MMAU 约 0.60。

LTU——Listen, Think, Understand（Gong 等，2023）：使用显式推理数据，专注于对音频片段做思维链。规模更小但更聚焦。

Audio Flamingo 3（Goel 等，2025 年 7 月）：当前开源 SOTA。8B 的 LLM 主干（Qwen2 7B），Whisper-large 编码器拼接 BEATs，64 查询 Q-former，在 100 万以上音频-文本指令对上训练。MMAU 0.72，在部分子任务上比肩专有前沿模型。

AF3 还为音频引入了「按需思维链（on-demand chain-of-thought）」：模型可以在给出最终答案前选择性地发出思考 token（「让我先识别一下乐器：……」）。启用思考后，复杂推理任务上的准确率提升 3-5 个百分点。

### 级联式 vs 端到端

级联式管线：

1. Whisper 把音频转写为文本。
2. LLM 对文本进行推理。

对于「总结这期播客」这类任务完美胜任。但在以下情形失效：
- 「这首歌的情绪是怎样的？」——情绪在声音里，不在文字里。
- 「正在说话的是 Alice 还是 Bob？」——需要说话人识别。
- 「爆炸发生在第几秒？」——时间定位在文本中丢失了。
- 「这是真实音频还是生成音频？」——「深度伪造（deepfake）」检测需要声学特征。

端到端保留了声学信号。Qwen-Audio 和 AF3 能原生处理音乐、环境与情绪。

### 2026 年的生产配方

针对一个全新的音频理解产品：

- 选级联式：若目标只是转写，没有音乐、不需要情绪推断。
- 选 AF3 / Qwen-Audio 系列：若涉及音乐、情绪、多说话人，或复杂的音频推理。

级联式更便宜、更简单。端到端能力更强。

### MMAU——音频推理基准

MMAU（Massive Multimodal Audio Understanding，海量多模态音频理解）是 2024-2025 年的音频推理基准：

- 10,000 个音频-文本问答对，覆盖语音、音乐、环境声。
- 涵盖分类、时序推理、因果推理、开放式问答。
- 专门测试级联式管线系统性遗漏的内容。

开源 SOTA（AF3）为 0.72；专有前沿约 0.78（Gemini 2.5 Pro、Claude Opus 4.7）。这一差距小于 VideoMME 上开源与闭源的落差，表明音频-LLM 正在走向成熟。

## 动手用起来

`code/main.py`：

- 用标准库实现对数梅尔频谱图计算：加窗、朴素 DFT、梅尔滤波器组。
- 音频 Q-former 骨架：给定编码器输出帧，计算 Q、K、V、注意力，并发出 N 个 token。
- 在一个玩具任务上做级联式 vs 端到端的对比。

## 交付成果

本课产出 `outputs/skill-audio-llm-pipeline-picker.md`。给定一个音频任务（转写、音乐标注、情绪推断、多说话人「说话人分离（diarization）」、环境分类），它会从级联式、端到端 AF3 或混合方案中做出选择。

## 练习

1. 计算一段 30 秒片段在 16kHz、25ms 窗、10ms 跳步、80 个梅尔频带下的对数梅尔频谱图维度。换成 48kHz 后这个维度如何变化？

2. 为什么 Whisper 在音乐上表现欠佳？BEATs 捕捉到了哪些 Whisper 没有捕捉到的音频特征？

3. 64 查询的音频 Q-former 与 32 查询相比：在多高的任务复杂度下，64 查询才划算？32 查询又在哪些场景下省下算力？

4. 阅读 AF3 第 4 节关于按需思考的内容。提出三个思维链帮助最大的音频任务。

5. 利用 AF3 的输出实现一个最小化的说话人分离管线。你如何标示说话人切换？

## 关键术语

| 术语 | 大家怎么说 | 实际含义 |
|------|-----------------|------------------------|
| 对数梅尔频谱图 | 「Mel 特征」 | 经梅尔滤波器组处理后、由对数幅值构成的二维（时间，频率）数组 |
| 音频 Q-former | 「Audio Perceiver」 | 从音频编码器输出到喂给 LLM 的定长查询之间的交叉注意力瓶颈 |
| 级联式 | 「ASR-then-LLM」 | Whisper 转写、文本 LLM 推理的管线；会丢失声学信息 |
| 端到端 | 「Audio-LLM」 | 音频特征经 Q-former 直接进入 LLM；保留声学信号 |
| BEATs | 「Audio AudioSet encoder」 | 在 AudioSet 上训练的 SSL Transformer；在音乐 + 环境声上很强 |
| MMAU | 「Audio reasoning bench」 | 覆盖语音、音乐、环境的 1 万问答对；2024 年评测标准 |
| 按需思考 | 「Audio CoT」 | 模型可在最终答案前选择性发出推理 token，准确率提升 3-5 个百分点 |

## 延伸阅读

- [Radford 等 — Whisper (arXiv:2212.04356)](https://arxiv.org/abs/2212.04356)
- [Chu 等 — Qwen-Audio (arXiv:2311.07919)](https://arxiv.org/abs/2311.07919)
- [Goel 等 — Audio Flamingo 3 (arXiv:2507.08128)](https://arxiv.org/abs/2507.08128)
- [Tang 等 — SALMONN (arXiv:2310.13289)](https://arxiv.org/abs/2310.13289)
- [Gong 等 — LTU (arXiv:2305.10790)](https://arxiv.org/abs/2305.10790)
