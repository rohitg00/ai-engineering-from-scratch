# 音频-语言模型：从 Whisper 到 Audio Flamingo 3 的发展脉络

> Whisper(Radford 等人，2022 年 12 月)终结了语音识别的竞争——68 万小时弱监督多语言语音、一个简单的编码器-解码器 Transformer、一套让此后每一个 ASR 发布都必须引用的基准。但识别不等于推理。要回答“这段录音里有哪些乐器”、“说话人表达了什么情绪”、“第 3 分钟发生了什么”，需要的是音频理解，而非转录。Qwen-Audio、SALMONN、LTU 以及 NVIDIA 的 Audio Flamingo 3(AF3,2025 年 7 月)逐步构建了这一技术栈：保留 Whisper 级别的编码器，接上 Q-former,用音频-文本指令数据训练，并加入思维链推理。本课讲解这条发展脉络。

**Type:** Build
**Languages:** Python(标准库，log-Mel 频谱 + 音频 Q-former 骨架)
**Prerequisites:** Phase 6(Speech and Audio)、Phase 12 · 03(Q-Former)
**Time:** ~180 分钟

## 学习目标

- 从波形计算 log-Mel 频谱：加窗、FFT、滤波器组、对数变换。
- 比较编码器选项：Whisper 编码器、BEATs、AF-Whisper 混合方案。各自的适用场景。
- 构建音频 Q-former:N 个可学习查询对频谱 patch 做交叉注意力。
- 解释级联(先 Whisper 后 LLM)与端到端音频-LLM 训练：为什么端到端在推理任务上扩展性更好。

## 问题所在

语音识别已被 Whisper 解决。音频 OCR 已是大路货。但“大路货”止步于转录。如果模型无法对听到的内容进行推理——时间、说话人、情绪、音乐结构、环境声——仅靠转录无法支撑产品功能。

三条显而易见的路线：

1. 级联：Whisper 转录，LLM 对文本推理。适用于纯语音场景。对音乐、环境音频、多说话人重叠、情绪无能为力。

2. 端到端音频-LLM:音频编码器将音频 token 直接输入 LLM,跳过转录。保留声学信息(情绪、说话人、环境)。需要新的训练数据。

3. 混合：音频编码器 + 文本解码器，既能转录又能推理。Qwen-Audio 和 Audio Flamingo 选择这条路线。

## 核心概念

### Log-Mel 频谱：输入特征

所有音频编码器都从同一个特征开始：log-Mel 频谱。

1. 重采样至 16 kHz。
2. 短时傅里叶变换，25ms 窗口，10ms 帧移。
3. 取 FFT 结果的幅度。
4. 应用 Mel 滤波器组(通常 80 个滤波器，在 0-8000 Hz 上对数间隔)以映射到感知频率。
5. 对数压缩(log(1 + x))以处理动态范围。

结果：形状为 (T, 80) 的二维数组，其中 T 是时间帧数。对于 100 Hz 帧率的 30 秒片段:(3000, 80)。

### Whisper 的编码器

Whisper 的编码器是一个 12 层 ViT 风格的 Transformer,将 log-Mel 频谱作为时间帧序列处理。输出：每个时间帧一个隐状态向量。

对于 ASR,Whisper 的解码器是一个交叉注意力 Transformer,以编码器输出为条件生成文本 token。标准的编码器-解码器结构。

对于 ALM(音频-LLM),你需要将编码器输出作为另一个 LLM 的输入。模式：Whisper 编码器冻结，Q-former 可训练，LLM 冻结或微调。

### BEATs 与音频专用编码器

Whisper 在以语音为主的数据上训练。它对音乐和环境音频较弱。

BEATs(Chen 等人，2022)是在 AudioSet 上训练的自监督 Transformer。在相同参数量下，比 Whisper 更好地捕捉音乐和环境声。

AF-Whisper(Audio Flamingo 3 的混合方案)：将 Whisper + BEATs 特征拼接作为音频输入。Whisper 携带语言信号，BEATs 携带声学信号。

### 音频 Q-former

与 BLIP-2 的视觉 Q-former 相同的模式。固定数量的可学习查询(通常 32 或 64)对音频编码器的输出帧做交叉注意力。这些查询成为供 LLM 消费的音频 token。

对齐训练阶段：仅训练 Q-former,在音频-文本对(AudioCaps、Clotho)上使用对比 + 描述损失。指令训练阶段：端到端，解冻 LLM,在指令数据上训练。

### 发展脉络——SALMONN、Qwen-Audio、AF3

SALMONN(Tang 等人，2023):Whisper + BEATs + Q-former + LLaMA。首个具备严肃推理能力的开源音频-LLM。MMAU 基准综合得分约 0.55。

Qwen-Audio(Chu 等人，2023):类似架构，在更丰富的数据集上训练，针对多轮对话微调。MMAU 约 0.60。

LTU——Listen, Think, Understand(Gong 等人，2023):显式推理数据，聚焦音频片段上的思维链。规模更小但更专注。

Audio Flamingo 3(Goel 等人，2025 年 7 月)：当前开源 SOTA。8B LLM 骨干(Qwen2 7B)、Whisper-large 编码器拼接 BEATs、64 查询 Q-former、在 100 万+ 音频-文本指令对上训练。MMAU 0.72,在某些子任务上与专有前沿模型持平。

AF3 还为音频引入了按需思维链：模型可以选择性地在最终答案前输出思考 token(“让我先识别乐器：……”)。启用思考后，复杂推理任务的准确率提升 3-5 个百分点。

### 级联 vs 端到端

级联流水线：

1. Whisper 将音频转录为文本。
2. LLM 对文本推理。

对“总结这个播客”效果完美。但对以下问题无能为力：
- “这首歌的情绪是什么？”——情绪在声音里，不在文字里。
- “谁在说话，Alice 还是 Bob?"——需要说话人识别。
- “爆炸发生在第几秒？"—时间定位在文本中丢失。
- “这是真实音频还是生成音频？"—深伪检测需要声学特征。

端到端保留声学信号。Qwen-Audio 和 AF3 原生处理音乐、环境和情绪。

### 2026 年生产配方

对于新的音频理解产品：

- 如果：目标就是转录，无音乐，无情绪推断 → 级联。
- 如果：音乐、情绪、多说话人或复杂音频推理 → AF3 / Qwen-Audio 系。

级联更便宜、更简单。端到端能力更强。

### MMAU——音频推理基准

MMAU(Massive Multimodal Audio Understanding)是 2024-2025 年的音频推理基准：

- 10,000 个音频-文本问答对，覆盖语音、音乐、环境声。
- 涵盖分类、时间推理、因果推理、开放式问答。
- 检验级联流水线系统性缺失的能力。

开源 SOTA(AF3)为 0.72;专有前沿约 0.78(Gemini 2.5 Pro、Claude Opus 4.7)。差距小于 VideoMME 的开源-闭源差距，说明音频-LLM 正在走向成熟。

```figure
audio-text-ctc
```

## 动手实践

`code/main.py`:

- 在标准库中实现 log-Mel 频谱计算：加窗、朴素 DFT、Mel 滤波器组。
- 音频 Q-former 骨架：给定编码器输出帧，计算 Q、K、V、注意力，并输出 N 个 token。
- 在玩具任务上比较级联与端到端。

## 成果交付

本课产出 `outputs/skill-audio-llm-pipeline-picker.md`。给定一个音频任务(转录、音乐标签、情绪推断、多说话人分离、环境分类)，它会选择级联、端到端 AF3 或混合方案。

## 练习

1. 对于 16kHz 采样率、25ms 窗口、10ms 帧移、80 个 Mel 频带的 30 秒片段，计算 log-Mel 频谱的维度。48kHz 时如何变化？

2. 为什么 Whisper 在音乐上表现不佳？BEATs 捕捉到了哪些 Whisper 没有捕捉的音频特征？

3. 64 查询 vs 32 查询的音频 Q-former:在什么样的任务复杂度下 64 值得？32 为什么任务节省算力？

4. 阅读 AF3 第 4 节关于按需思考的内容。提出三个思维链帮助最大的音频任务。

5. 使用 AF3 的输出实现一个最小化的说话人分离流水线。如何标记说话人切换？

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------------|------------------------|
| Log-Mel 频谱 | "Mel 特征" | 经 Mel 滤波器组处理后，由对数幅度值构成的二维(时间，频率)数组 |
| 音频 Q-former | "Audio Perceiver" | 从音频编码器输出到固定长度查询的交叉注意力瓶颈，查询输入 LLM |
| 级联 | "先 ASR 后 LLM" | Whisper 转录、文本 LLM 推理的流水线；丢失声学信息 |
| 端到端 | "Audio-LLM" | 音频特征经 Q-former 直接进入 LLM;保留声学信号 |
| BEATs | "AudioSet 音频编码器" | 在 AudioSet 上训练的 SSL Transformer;在音乐 + 环境声上表现强 |
| MMAU | "音频推理基准" | 覆盖语音、音乐、环境的 10k 问答对；2024 年评测标准 |
| 按需思考 | "音频 CoT" | 模型可选择在最终答案前输出推理 token,准确率提升 3-5 个百分点 |

## 延伸阅读

- [Radford 等人 — Whisper (arXiv:2212.04356)](https://arxiv.org/abs/2212.04356)
- [Chu 等人 — Qwen-Audio (arXiv:2311.07919)](https://arxiv.org/abs/2311.07919)
- [Goel 等人 — Audio Flamingo 3 (arXiv:2507.08128)](https://arxiv.org/abs/2507.08128)
- [Tang 等人 — SALMONN (arXiv:2310.13289)](https://arxiv.org/abs/2310.13289)
- [Gong 等人 — LTU (arXiv:2305.10790)](https://arxiv.org/abs/2305.10790)