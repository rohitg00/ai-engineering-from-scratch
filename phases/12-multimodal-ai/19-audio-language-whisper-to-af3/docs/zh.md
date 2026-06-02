# 音频语言模型：从 Whisper 到 Audio Flamingo 3 这条弧线

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> Whisper（Radford 等，2022 年 12 月）把语音识别这件事一锤定音——68 万小时弱监督多语种语音、一个简洁的 encoder-decoder transformer，一个让后续每一篇 ASR 论文都得引用的基准。但是识别不等于推理。问「这段录音里有哪些乐器」「说话人正在表达什么情绪」「第 3 分钟发生了什么」——这些需要的是音频理解，不是转写。Qwen-Audio、SALMONN、LTU，以及 NVIDIA 的 Audio Flamingo 3（AF3，2025 年 7 月）一步步把这套堆栈搭起来：保留 Whisper 级别的 encoder，挂上 Q-former，在音频-文本指令数据上训练，再加上链式推理（chain-of-thought）。本节就走这条弧线。

**Type:** Build
**Languages:** Python（stdlib，log-Mel 频谱图 + 音频 Q-former 骨架）
**Prerequisites:** Phase 6（语音与音频），Phase 12 · 03（Q-Former）
**Time:** ~180 minutes

## 学习目标（Learning Objectives）

- 从波形计算 log-Mel 频谱图：加窗、FFT、滤波器组、log 变换。
- 对比 encoder 选项：Whisper encoder、BEATs、AF-Whisper 混合方案。各自适用的场景。
- 搭一个音频 Q-former：N 个可学习 query 对频谱图 patch 做 cross-attention。
- 解释级联（cascaded，Whisper-然后-LLM）和端到端音频-LLM 训练的差异：为什么端到端在推理任务上扩展性更好。

## 问题（The Problem）

语音识别已经被 Whisper 解决了。「把音频 OCR 成文字」已经是日用商品级别的能力。但「商品级」止步于转写。如果模型不能对它听到的内容进行推理——时序、说话人、情绪、音乐结构、环境声——光靠转写是没法驱动产品功能的。

三条显而易见的路：

1. 级联（Cascade）：Whisper 转写，LLM 在转写文本上做推理。在纯语音场景里行得通。但在音乐、环境音频、多说话人重叠、情绪这些任务上就跪了。

2. 端到端音频-LLM：音频 encoder 直接把音频 token 喂给 LLM，跳过转写。保留了声学信息（情绪、说话人、环境）。需要新的训练数据。

3. 混合方案：音频 encoder + 文本 decoder，既能转写也能推理。Qwen-Audio 和 Audio Flamingo 走的就是这条路。

## 概念（The Concept）

### Log-Mel 频谱图：输入特征

每个音频 encoder 都从同一个特征出发：log-Mel 频谱图。

1. 重采样到 16 kHz。
2. 短时傅里叶变换（STFT），25ms 窗，10ms 跳。
3. 取 FFT 结果的幅值。
4. 应用 Mel 滤波器组（典型是 80 个滤波器，在 0-8000 Hz 上做对数间隔），把频率扭到感知频率上。
5. log 压缩（log(1 + x)）来压缩动态范围。

结果：一个形状为 (T, 80) 的二维数组，其中 T 是时间帧数。30 秒片段、100 Hz 帧率下：(3000, 80)。

### Whisper 的 encoder

Whisper 的 encoder 是一个 12 层 ViT 风格的 transformer，把 log-Mel 频谱图当作时间帧序列处理。输出：每个时间帧一个隐藏状态向量。

做 ASR 时，Whisper 的 decoder 是一个 cross-attention transformer，以 encoder 输出为条件生成文本 token。标准 encoder-decoder。

做 ALMs（音频-LLM）时，你想把 encoder 输出作为另一个 LLM 的输入。套路是：Whisper encoder 冻结，Q-former 可训，LLM 冻结或者微调。

### BEATs 与音频专用 encoder

Whisper 是在以语音为主的数据上训出来的。它在音乐和环境音频上偏弱。

BEATs（Chen 等，2022）是在 AudioSet 上自监督训练的 transformer。在相同参数量下，它对音乐和环境音的捕捉比 Whisper 强。

AF-Whisper（Audio Flamingo 3 的混合方案）：把 Whisper + BEATs 的特征拼起来作为音频输入。Whisper 携带语言信号，BEATs 携带声学信号。

### 音频 Q-former

和 BLIP-2 的视觉 Q-former 同一套路。固定数量（常见 32 或 64）的可学习 query 对音频 encoder 的输出帧做 cross-attention。这些 query 就成为被 LLM 消费的音频 token。

训练对齐阶段：只训 Q-former，在音频-文本对上跑对比 + 描述损失（AudioCaps、Clotho）。指令阶段：端到端，解冻 LLM，在指令数据上训。

### 这条弧线 —— SALMONN、Qwen-Audio、AF3

SALMONN（Tang 等，2023）：Whisper + BEATs + Q-former + LLaMA。第一个真正具备推理能力的开源音频-LLM。MMAU 综合分约 0.55。

Qwen-Audio（Chu 等，2023）：架构类似，训练数据更丰富，针对多轮对话做了调优。MMAU ~0.60。

LTU —— Listen, Think, Understand（Gong 等，2023）：显式的推理数据，重点放在对音频片段的链式推理上。规模更小但更聚焦。

Audio Flamingo 3（Goel 等，2025 年 7 月）：当前开源 SOTA。8B LLM 主干（Qwen2 7B），Whisper-large encoder 拼接 BEATs，64-query Q-former，在 1M+ 音频-文本指令对上训练。MMAU 0.72，在某些子任务上追平闭源前沿。

AF3 还引入了音频上的按需链式推理（on-demand chain-of-thought）：模型可以选择在最终答案之前发出思考 token（"让我先识别一下乐器：……"）。在复杂推理任务上开启 thinking 时，准确率能提升 3-5 个点。

### 级联 vs 端到端

级联流水线：

1. Whisper 把音频转写成文本。
2. LLM 在文本上做推理。

对「总结这期播客」这类任务完美。但在以下任务上跪：
- 「这首歌是什么情绪？」—— 情绪在声音里，不在词里。
- 「现在说话的是 Alice 还是 Bob？」—— 需要说话人识别。
- 「爆炸发生在第几秒？」—— 时间定位在文本里丢了。
- 「这是真人录音还是 AI 生成的？」—— 深度伪造检测需要声学特征。

端到端保留了声学信号。Qwen-Audio 和 AF3 原生处理音乐、环境、情绪。

### 2026 生产配方（recipe）

如果你要做一个新的音频理解产品：

- 选级联：如果转写就是目标，没有音乐、不需要情绪推断。
- 选 AF3 / Qwen-Audio 系：如果有音乐、情绪、多说话人，或者复杂的音频推理。

级联更便宜更简单。端到端能力更强。

### MMAU —— 音频推理基准

MMAU（Massive Multimodal Audio Understanding）是 2024-2025 年的音频推理基准：

- 10,000 个音频-文本 QA 对，覆盖语音、音乐、环境声。
- 涵盖分类、时序推理、因果推理、开放式 QA。
- 测的就是级联流水线系统性会漏掉的东西。

开源 SOTA（AF3）0.72；闭源前沿 ~0.78（Gemini 2.5 Pro、Claude Opus 4.7）。这个差距比 VideoMME 上的开源-闭源差距要小，说明音频-LLM 正在走向成熟。

## 用起来（Use It）

`code/main.py`：

- 用 stdlib 实现 log-Mel 频谱图计算：加窗、朴素 DFT、Mel 滤波器组。
- 音频 Q-former 骨架：给定 encoder 输出帧，计算 Q、K、V、attention，发出 N 个 token。
- 在玩具任务上做级联 vs 端到端的对比。

## 上线部署（Ship It）

本节会产出 `outputs/skill-audio-llm-pipeline-picker.md`。给定一个音频任务（转写、音乐打标、情绪推断、多说话人 diarization、环境分类），它会挑出该用级联、端到端 AF3，还是混合方案。

## 练习（Exercises）

1. 算一下 30 秒片段、16kHz、25ms 窗、10ms 跳、80 个 Mel bin 下 log-Mel 频谱图的维度。换到 48kHz 会怎么变？

2. 为什么 Whisper 在音乐上表现不佳？BEATs 捕捉到的哪些音频特征是 Whisper 没有的？

3. 64 query 的音频 Q-former 对比 32 query：在什么任务复杂度下 64 才有回报？32 又能在什么场景下省算力？

4. 读 AF3 论文第 4 节关于按需 thinking 的部分。提出三个链式推理帮助最大的音频任务。

5. 用 AF3 的输出实现一个最小的 diarization 流水线。你怎么标记说话人切换？

## 关键术语（Key Terms）

| 术语 | 大家怎么说 | 实际是什么 |
|------|-----------------|------------------------|
| Log-Mel 频谱图 | "Mel 特征" | 经过 Mel 滤波器组后的对数幅值二维数组（时间，频率） |
| 音频 Q-former | "Audio Perceiver" | 从音频 encoder 输出到固定长度 query 的 cross-attention 瓶颈，结果喂给 LLM |
| 级联（Cascaded） | "ASR-然后-LLM" | Whisper 转写、文本 LLM 推理的流水线；丢失声学信息 |
| 端到端（End-to-end） | "Audio-LLM" | 音频特征通过 Q-former 直接进 LLM；保留声学信号 |
| BEATs | "AudioSet encoder" | 在 AudioSet 上自监督训练的 transformer；在音乐 + 环境声上很强 |
| MMAU | "音频推理基准" | 10k QA 对，覆盖语音、音乐、环境；2024 评测标准 |
| 按需 thinking | "Audio CoT" | 模型可选择在最终答案前发出推理 token，准确率提升 3-5 个点 |

## 延伸阅读（Further Reading）

- [Radford et al. — Whisper (arXiv:2212.04356)](https://arxiv.org/abs/2212.04356)
- [Chu et al. — Qwen-Audio (arXiv:2311.07919)](https://arxiv.org/abs/2311.07919)
- [Goel et al. — Audio Flamingo 3 (arXiv:2507.08128)](https://arxiv.org/abs/2507.08128)
- [Tang et al. — SALMONN (arXiv:2310.13289)](https://arxiv.org/abs/2310.13289)
- [Gong et al. — LTU (arXiv:2305.10790)](https://arxiv.org/abs/2305.10790)
