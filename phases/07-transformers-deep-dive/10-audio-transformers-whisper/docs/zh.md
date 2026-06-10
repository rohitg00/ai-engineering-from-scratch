# 10 · 音频 Transformer——Whisper 架构

> 音频是频率随时间变化的「图像」。Whisper 就是一个吃下梅尔频谱图、再把语言说回来的 ViT。

**类型：** 学习
**语言：** Python
**前置：** 阶段 7 · 05（完整 Transformer）、阶段 7 · 08（编码器-解码器）、阶段 7 · 09（ViT）
**时长：** 约 45 分钟

## 问题所在

在 Whisper（OpenAI，Radford 等人 2022）出现之前，最先进的「自动语音识别（automatic speech recognition, ASR）」意味着 wav2vec 2.0 和 HuBERT——自监督特征提取器加上一个微调后的识别头。质量很高，但数据管线昂贵，且对领域非常脆弱。多语言语音识别需要为每个语系单独训练模型。

Whisper 押了三个赌注：

1. **在一切数据上训练。** 从互联网抓取的 680,000 小时弱标注音频，覆盖 97 种语言。没有干净的学术语料库，也没有音素标签。
2. **多任务单一模型。** 一个解码器通过任务 token 联合训练，同时承担转写、翻译、「语音活动检测（voice activity detection）」、语言识别和时间戳标注。
3. **标准编码器-解码器 Transformer。** 编码器消费对数梅尔频谱图，解码器自回归地生成文本 token。没有声码器，没有 CTC，没有 HMM。

结果是：Whisper large-v3 在不同口音、噪声以及那些零干净标注数据的语言上都很鲁棒。它是 2026 年每一个开源语音助手、以及大多数商业语音助手的默认语音前端。

## 核心概念

〔图：Whisper 流水线——音频 → 梅尔频谱 → 编码器 → 解码器 → 文本〕

### 第 1 步——重采样 + 加窗

音频采样率 16 kHz。裁剪/填充到 30 秒。计算对数梅尔频谱图：80 个梅尔频带，10 ms 步长 → 约 3,000 帧 × 80 个特征。这就是 Whisper 看到的「输入图像」。

### 第 2 步——卷积茎（convolutional stem）

两个卷积核为 3、步长为 2 的 Conv1D 层，把 3,000 帧降到 1,500 帧。在不增加太多参数的情况下把序列长度减半。

### 第 3 步——编码器

一个作用于 1,500 个时间步的 24 层（large 版本）Transformer 编码器。采用正弦位置编码、自注意力和 GELU 前馈网络。产出 1,500 × 1,280 的隐藏状态。

### 第 4 步——解码器

一个 24 层 Transformer 解码器。它从一个 BPE 词表中自回归地生成 token，该词表是 GPT-2 词表的超集，外加少量音频专用的特殊 token。

### 第 5 步——任务 token

解码器提示以一组控制 token 开头，告诉模型要做什么：

```
<|startoftranscript|>  <|en|>  <|transcribe|>  <|0.00|>
```

或者

```
<|startoftranscript|>  <|fr|>  <|translate|>   <|0.00|>
```

模型就是按这个约定训练的。你通过前缀控制任务。这相当于 2026 年的指令微调，只不过应用在了语音上。

### 第 6 步——输出

带对数概率阈值的「束搜索（beam search）」（宽度为 5）。当 `<|notimestamps|>` token 缺席时，每 0.02 秒音频预测一次时间戳。

### Whisper 各尺寸

| 模型 | 参数量 | 层数 | d_model | 头数 | 显存（fp16） |
|-------|--------|--------|---------|-------|-------------|
| Tiny | 39M | 4 | 384 | 6 | ~1 GB |
| Base | 74M | 6 | 512 | 8 | ~1 GB |
| Small | 244M | 12 | 768 | 12 | ~2 GB |
| Medium | 769M | 24 | 1024 | 16 | ~5 GB |
| Large | 1550M | 32 | 1280 | 20 | ~10 GB |
| Large-v3 | 1550M | 32 | 1280 | 20 | ~10 GB |
| Large-v3-turbo | 809M | 32 | 1280 | 20 | ~6 GB（4 层解码器） |

Large-v3-turbo（2024）把解码器从 32 层削减到 4 层，解码速度提升 8 倍，而「词错误率（WER）」回退不到 1 个百分点。正是这一解码提速，让 Whisper-turbo 成为 2026 年实时语音智能体的默认选择。

### Whisper 不做什么

- 不做「说话人分离（diarization）」（谁在说话）。需要的话搭配 pyannote。
- 原生不支持实时流式——30 秒窗口是固定的。现代封装（`faster-whisper`、`WhisperX`）通过 VAD + 重叠的方式外挂上流式能力。
- 在没有外部分块的情况下，无法处理超过 30 秒的长篇上下文。实践中效果不错，因为人类语音在转写时很少需要长程上下文。

### 2026 全景

| 任务 | 模型 | 备注 |
|------|-------|-------|
| 英语 ASR | Whisper-turbo、Moonshine | Moonshine 在边缘端快 4 倍 |
| 多语言 ASR | Whisper-large-v3 | 97 种语言 |
| 流式 ASR | faster-whisper + VAD | 可实现 150 ms 延迟目标 |
| TTS | Piper、XTTS-v2、Kokoro | 编码器-解码器模式，但形态类似 Whisper |
| 音频 + 语言 | AudioLM、SeamlessM4T | 在同一个 Transformer 里同时处理文本 token 和音频 token |

## 动手构建

参见 `code/main.py`。我们不训练 Whisper——我们构建对数梅尔频谱图流水线 + 任务 token 提示格式化器。这些才是你在生产中真正会动手处理的部分。

### 第 1 步：合成音频

生成一段 1 秒、440 Hz、采样率 16 kHz 的正弦波。共 16,000 个采样点。

### 第 2 步：对数梅尔频谱图（简化版）

完整的梅尔频谱图需要 FFT。我们做一个简化的分帧 + 逐帧能量版本，在不依赖 `librosa` 的情况下展示整条流水线：

```python
def frame_signal(x, frame_size=400, hop=160):
    frames = []
    for start in range(0, len(x) - frame_size + 1, hop):
        frames.append(x[start:start + frame_size])
    return frames
```

帧长 = 25 ms，跳步 = 10 ms。与 Whisper 的加窗方式一致。出于教学目的，用逐帧能量代替梅尔频带。

### 第 3 步：填充到 30 秒

Whisper 始终以 30 秒为单位处理。把频谱图填充（或裁剪）到 3,000 帧。

### 第 4 步：构建提示 token

```python
def whisper_prompt(lang="en", task="transcribe", timestamps=True):
    tokens = ["<|startoftranscript|>", f"<|{lang}|>", f"<|{task}|>"]
    if not timestamps:
        tokens.append("<|notimestamps|>")
    return tokens
```

这就是全部的任务控制面：一个 4-token 前缀。

## 实际使用

```python
import whisper
model = whisper.load_model("large-v3-turbo")
result = model.transcribe("meeting.wav", language="en", task="transcribe")
print(result["text"])
print(result["segments"][0]["start"], result["segments"][0]["end"])
```

更快、且与 OpenAI 兼容的版本：

```python
from faster_whisper import WhisperModel
model = WhisperModel("large-v3-turbo", compute_type="int8_float16")
segments, info = model.transcribe("meeting.wav", vad_filter=True)
for s in segments:
    print(f"{s.start:.2f} - {s.end:.2f}: {s.text}")
```

**2026 年何时选择 Whisper：**

- 用一个模型搞定多语言 ASR。
- 对嘈杂、多样化音频做鲁棒转写。
- 研究 / 原型阶段的 ASR——最快的起步方案。

**何时选择别的方案：**

- 边缘端超低延迟流式——在同等质量下 Moonshine 胜过 Whisper。
- 需要小于 200 ms 的实时对话式 AI——用专用的流式 ASR。
- 说话人分离——Whisper 不做这件事，外挂 pyannote。

## 上线交付

参见 `outputs/skill-asr-configurator.md`。该技能会为一个新的语音应用挑选 ASR 模型、解码参数和预处理流水线。

## 练习

1. **简单。** 运行 `code/main.py`。确认在 16 kHz、10 ms 跳步下，1 秒信号的帧数约为 100 帧；30 秒则约为 3,000 帧。
2. **中等。** 用 `numpy.fft` 构建完整的对数梅尔频谱图。在数值误差范围内验证 80 个梅尔频带与 `librosa.feature.melspectrogram(n_mels=80)` 一致。
3. **困难。** 实现流式推理：把音频切成 10 秒窗口、2 秒重叠，对每个分块运行 Whisper，再合并转写结果。在一段 5 分钟的播客样本上，对比它与单次通过（single-pass）的词错误率。

## 关键术语

| 术语 | 大家怎么说 | 它实际是什么意思 |
|------|-----------------|-----------------------|
| 梅尔频谱图（Mel spectrogram） | 「音频图像」 | 二维表示：一个轴是频率频带，另一个轴是时间帧；每个格子是对数缩放的能量。 |
| 对数梅尔（Log-mel） | 「Whisper 看到的东西」 | 经过对数处理的梅尔频谱图；近似人类对响度的感知。 |
| 帧（Frame） | 「一个时间切片」 | 一个 25 ms 的采样窗口；以 10 ms 步长相互重叠。 |
| 任务 token（Task token） | 「语音的提示前缀」 | 解码器提示中的特殊 token，例如 `<\|transcribe\|>` / `<\|translate\|>`。 |
| 语音活动检测（VAD） | 「找出语音」 | 在 ASR 之前去除静音的门控；能大幅削减成本。 |
| CTC | 「联结主义时序分类（Connectionist Temporal Classification）」 | 经典的 ASR 损失，用于无需对齐的训练；Whisper 并不使用它。 |
| Whisper-turbo | 「小解码器，完整编码器」 | large-v3 编码器 + 4 层解码器；解码快 8 倍。 |
| Faster-whisper | 「生产级封装」 | 基于 CTranslate2 的重新实现；int8 量化；比 OpenAI 的参考实现快 4 倍。 |

## 延伸阅读

- [Radford et al. (2022). Robust Speech Recognition via Large-Scale Weak Supervision](https://arxiv.org/abs/2212.04356)——Whisper 论文。
- [OpenAI Whisper 仓库](https://github.com/openai/whisper)——参考代码 + 模型权重。阅读 `whisper/model.py`，可在约 400 行内自上而下看到 Conv1D 茎 + 编码器 + 解码器。
- [OpenAI Whisper——`whisper/decoding.py`](https://github.com/openai/whisper/blob/main/whisper/decoding.py)——第 5–6 步描述的束搜索 + 任务 token 逻辑就在这里；500 行，完全可读。
- [Baevski et al. (2020). wav2vec 2.0: A Framework for Self-Supervised Learning of Speech Representations](https://arxiv.org/abs/2006.11477)——前身；在某些场景下仍是 SOTA 特征。
- [SYSTRAN/faster-whisper](https://github.com/SYSTRAN/faster-whisper)——生产级封装，比参考实现快 4 倍。
- [Jia et al. (2024). Moonshine: Speech Recognition for Live Transcription and Voice Commands](https://arxiv.org/abs/2410.15608)——2024 年面向边缘端的 ASR，形态类似 Whisper 但更小。
- [HuggingFace 博客——「Fine-Tune Whisper For Multilingual ASR with 🤗 Transformers」](https://huggingface.co/blog/fine-tune-whisper)——权威的微调配方，包含梅尔频谱图预处理器和 token 级时间戳处理。
- [HuggingFace `modeling_whisper.py`](https://github.com/huggingface/transformers/blob/main/src/transformers/models/whisper/modeling_whisper.py)——完整实现（编码器、解码器、交叉注意力、生成），与本课的架构图一一对应。
