# 音频Transformer——Whisper架构

> 音频是频率随时间变化的图像。Whisper是一个ViT，它消化梅尔频谱图并输出语音。

**类型：** 学习
**语言：** Python
**前置知识：** 阶段7·05（完整Transformer）、阶段7·08（编码器-解码器）、阶段7·09（ViT）
**时长：** ~45分钟

## 问题

在Whisper（OpenAI，Radford等，2022）出现之前，最先进的自动语音识别（Automatic Speech Recognition，ASR）是wav2vec 2.0和HuBERT——一种自监督特征提取器加上微调头。质量高，数据管道昂贵，领域脆弱。多语言语音识别需要为每个语系单独建模。

Whisper做出了三点突破：

1. **用一切数据训练。** 从互联网上收集了97种语言的68万小时弱标注音频。没有干净的学术语料库，没有音素标签。
2. **单一模型多任务。** 一个解码器通过任务令牌（task tokens）联合训练：转录、翻译、语音活动检测、语言识别和时间戳。
3. **标准编码器-解码器Transformer。** 编码器处理对数梅尔频谱图（log-mel spectrograms）。解码器自回归生成文本令牌。没有声码器、CTC或HMM。

结果：Whisper large-v3在口音、噪声和零干净标注数据的语言上表现稳健。它是2026年几乎所有开源语音助手和多数商业语音助手的默认语音前端。

## 概念

![Whisper管道：音频→梅尔→编码器→解码器→文本](../assets/whisper.svg)

### 步骤1——重采样+分窗

16 kHz音频。裁剪/填充到30秒。计算对数梅尔频谱图：80个梅尔频带（mel bins），10毫秒步进→约3000帧×80特征。这就是Whisper看到的"输入图像"。

### 步骤2——卷积茎（Convolutional Stem）

两个Conv1D层，核大小为3，步长为2，将3000帧减少到1500帧。在不大幅增加参数的情况下将序列长度减半。

### 步骤3——编码器

一个24层（large版本）Transformer编码器，处理1500个时间步。使用正弦位置编码、自注意力、GELU FFN。生成1500×1280的隐藏状态。

### 步骤4——解码器

一个24层Transformer解码器。它自回归地从一个BPE词汇表（GPT-2的超集，外加一些音频专用特殊令牌）生成令牌。

### 步骤5——任务令牌

解码器提示以一个控制令牌开头，告诉模型要做什么：

```
<|startoftranscript|>  <|en|>  <|transcribe|>  <|0.00|>
```

或

```
<|startoftranscript|>  <|fr|>  <|translate|>   <|0.00|>
```

模型就是按这种惯例训练的。通过前缀控制任务。相当于2026年的指令微调，但应用于语音。

### 步骤6——输出

基于对数概率阈值的波束搜索（宽度5）。当缺少 `<|notimestamps|>` 令牌时，每0.02秒音频预测一次时间戳。

### Whisper模型大小

| 模型 | 参数量 | 层数 | d_model | 注意力头数 | VRAM (fp16) |
|-------|--------|--------|---------|-------|-------------|
| Tiny | 39M | 4 | 384 | 6 | ~1 GB |
| Base | 74M | 6 | 512 | 8 | ~1 GB |
| Small | 244M | 12 | 768 | 12 | ~2 GB |
| Medium | 769M | 24 | 1024 | 16 | ~5 GB |
| Large | 1550M | 32 | 1280 | 20 | ~10 GB |
| Large-v3 | 1550M | 32 | 1280 | 20 | ~10 GB |
| Large-v3-turbo | 809M | 32 | 1280 | 20 | ~6 GB (4层解码器) |

Large-v3-turbo（2024）将解码器从32层削减至4层。解码速度提升8倍，词错误率（WER）退化不到1个百分点。这种解码速度上的飞跃正是Whisper-turbo成为2026年实时语音代理默认选择的原因。

### Whisper做不到的事

- 不进行说话人分离（谁在说话）。需配合pyannote。
- 原生不支持实时流式传输——30秒窗口是固定的。现代封装（`faster-whisper`、`WhisperX`）通过VAD+重叠添加了流式支持。
- 不处理超过30秒的长文本（需要外部切分）。在实践中效果良好，因为人类语音在转录时很少需要长距离上下文。

### 2026年全景

| 任务 | 模型 | 备注 |
|------|-------|-------|
| 英文ASR | Whisper-turbo, Moonshine | Moonshine在边缘设备上快4倍 |
| 多语言ASR | Whisper-large-v3 | 97种语言 |
| 流式ASR | faster-whisper + VAD | 可实现150毫秒延迟目标 |
| 文本转语音（TTS） | Piper, XTTS-v2, Kokoro | 编码器-解码器模式，但形状类似Whisper |
| 音频+语言 | AudioLM, SeamlessM4T | 文本令牌+音频令牌共用一个Transformer |

## 动手实现

参见 `code/main.py`。我们不训练Whisper——我们构建对数梅尔频谱图管道+任务令牌提示格式化器。这些是你在生产中实际会接触的部分。

### 步骤1：合成音频

生成一个440 Hz、采样率16 kHz、时长1秒的正弦波。共16,000个样本。

### 步骤2：对数梅尔频谱图（简化版）

完整的梅尔频谱图需要FFT。我们做一个简化的分帧+每帧能量版本，展示管道而不需要 `librosa`：

```python
def frame_signal(x, frame_size=400, hop=160):
    frames = []
    for start in range(0, len(x) - frame_size + 1, hop):
        frames.append(x[start:start + frame_size])
    return frames
```

帧长=25毫秒，步长=10毫秒。与Whisper的分窗匹配。每帧能量在此教学场景中代表梅尔频带。

### 步骤3：填充到30秒

Whisper始终处理30秒的块。将频谱图填充（或裁剪）到3000帧。

### 步骤4：构建提示令牌

```python
def whisper_prompt(lang="en", task="transcribe", timestamps=True):
    tokens = ["<|startoftranscript|>", f"<|{lang}|>", f"<|{task}|>"]
    if not timestamps:
        tokens.append("<|notimestamps|>")
    return tokens
```

这就是整个任务控制接口。一个4令牌的前缀。

## 使用方式

```python
import whisper
model = whisper.load_model("large-v3-turbo")
result = model.transcribe("meeting.wav", language="en", task="transcribe")
print(result["text"])
print(result["segments"][0]["start"], result["segments"][0]["end"])
```

更快、兼容OpenAI的方式：

```python
from faster_whisper import WhisperModel
model = WhisperModel("large-v3-turbo", compute_type="int8_float16")
segments, info = model.transcribe("meeting.wav", vad_filter=True)
for s in segments:
    print(f"{s.start:.2f} - {s.end:.2f}: {s.text}")
```

**2026年选择Whisper的场景：**

- 使用单一模型进行多语言ASR。
- 对噪声、多样音频进行稳健转录。
- 研究/原型ASR——最快的起点。

**选择其他方案的场景：**

- 边缘设备超低延迟流式传输——Moonshine在相同质量下优于Whisper。
- 需要<200毫秒的实时对话AI——专用流式ASR。
- 说话人分离——Whisper不支持；需配合pyannote。

## 部署

参见 `outputs/skill-asr-configurator.md`。该技能为新的语音应用选择ASR模型、解码参数和预处理管道。

## 练习

1. **简单。** 运行 `code/main.py`。确认16 kHz、10毫秒步进、1秒信号的帧数约为100帧。30秒信号约为3000帧。
2. **中等。** 使用 `numpy.fft` 构建完整对数梅尔频谱图。验证80个梅尔频带在数值误差范围内与 `librosa.feature.melspectrogram(n_mels=80)` 一致。
3. **困难。** 实现流式推理：将音频切分为10秒窗口，重叠2秒，在每个窗口上运行Whisper，合并转录。在一个5分钟播客样本上测量与单次通过的词错误率对比。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------------|-----------------------|
| 梅尔频谱图（Mel spectrogram） | "音频图像" | 二维表示：一个轴为频率带，另一个轴为时间帧；每个单元格采用对数缩放的能量。 |
| 对数梅尔（Log-mel） | "Whisper看到的" | 经过对数变换的梅尔频谱图；近似于人类对响度的感知。 |
| 帧（Frame） | "一个时间片" | 一段25毫秒的样本窗口；以10毫秒步进重叠。 |
| 任务令牌（Task token） | "语音的提示前缀" | 解码器提示中的特殊令牌，如 `<|transcribe|>` / `<|translate|>`。 |
| 语音活动检测（Voice Activity Detection，VAD） | "找到语音" | 在ASR前去除静音的网关；大幅降低成本。 |
| CTC | "连接主义时间分类（Connectionist Temporal Classification）" | 无需对齐的经典ASR损失函数；Whisper不使用它。 |
| Whisper-turbo | "小解码器，完整编码器" | large-v3编码器+4层解码器；解码速度快8倍。 |
| Faster-whisper | "生产级封装" | CTranslate2重新实现；int8量化；比OpenAI参考实现快4倍。 |

## 延伸阅读

- [Radford et al. (2022). Robust Speech Recognition via Large-Scale Weak Supervision](https://arxiv.org/abs/2212.04356) — Whisper论文。
- [OpenAI Whisper仓库](https://github.com/openai/whisper) — 参考代码+模型权重。阅读 `whisper/model.py` 可在大约400行代码中自上而下看到Conv1D茎+编码器+解码器。
- [OpenAI Whisper — `whisper/decoding.py`](https://github.com/openai/whisper/blob/main/whisper/decoding.py) — 步骤5–6中描述的波束搜索+任务令牌逻辑在此；500行，完全可读。
- [Baevski et al. (2020). wav2vec 2.0: A Framework for Self-Supervised Learning of Speech Representations](https://arxiv.org/abs/2006.11477) — 前身；在某些设置下仍是最先进的特征提取器。
- [SYSTRAN/faster-whisper](https://github.com/SYSTRAN/faster-whisper) — 生产级封装，比参考实现快4倍。
- [Jia et al. (2024). Moonshine: Speech Recognition for Live Transcription and Voice Commands](https://arxiv.org/abs/2410.15608) — 2024年边缘友好型ASR，形状类似Whisper但更小。
- [HuggingFace博客 — "Fine-Tune Whisper For Multilingual ASR with 🤗 Transformers"](https://huggingface.co/blog/fine-tune-whisper) — 经典的微调教程，包含梅尔频谱图预处理器和令牌-时间戳处理。
- [HuggingFace `modeling_whisper.py`](https://github.com/huggingface/transformers/blob/main/src/transformers/models/whisper/modeling_whisper.py) — 完整实现（编码器、解码器、交叉注意力、生成），与课程架构图一致。