# 音频 Transformer — Whisper 架构

> 音频是频率随时间变化的图像。Whisper 是一个以 mel 频谱图为食、再输出文字的 ViT。

**Type:** Learn
**Languages:** Python
**Prerequisites:** Phase 7 · 05（完整 Transformer）、Phase 7 · 08（Encoder-Decoder）、Phase 7 · 09（ViT）
**Time:** 约 45 分钟

## 问题

在 Whisper（OpenAI，Radford 等，2022）出现之前，最先进的自动语音识别（ASR）意味着 wav2vec 2.0 和 HuBERT——自监督特征提取器加一个微调头。质量高，但数据管道昂贵、跨领域脆弱。多语言语音识别需要按语系分别训练模型。

Whisper 押了三个注：

1. **用所有数据训练。** 从互联网上抓取的 680,000 小时弱标注音频，覆盖 97 种语言。不用干净的学术语料库，不用音素标签。
2. **多任务单模型。** 一个解码器通过任务 token，联合训练转写、翻译、语音活动检测、语言识别和时间戳。
3. **标准 encoder-decoder transformer。** 编码器接收 log-mel 频谱图，解码器自回归地产出文本 token。不用 vocoder、不用 CTC、不用 HMM。

结果是：Whisper large-v3 在各种口音、噪声以及完全没有任何干净标注数据的语言上都表现稳健。到 2026 年，它是所有开源语音助手以及大多数商用语音助手默认的语音前端。

## 概念

![Whisper pipeline: audio → mel → encoder → decoder → text](../assets/whisper.svg)

### 第 1 步 — 重采样 + 分窗

音频为 16 kHz。裁剪/填充到 30 秒。计算 log-mel 频谱图：80 个 mel bin，10 ms 步长 → 约 3,000 帧 × 80 特征。这就是 Whisper 看到的“输入图像”。

### 第 2 步 — 卷积主干

两个 kernel 为 3、stride 为 2 的 Conv1D 层把 3,000 帧压缩到 1,500 帧。在不引入大量参数的情况下将序列长度减半。

### 第 3 步 — 编码器

针对 1,500 个时间步的 24 层（large 版）transformer 编码器。使用正弦位置编码、自注意力、GELU FFN。产出 1,500 × 1,280 的隐藏状态。

### 第 4 步 — 解码器

24 层 transformer 解码器。它从一个 BPE 词表自回归地产出 token；该词表是 GPT-2 词表的超集，外加几个音频专用特殊 token。

### 第 5 步 — 任务 token

解码器的提示以控制 token 开头，告诉模型要做什么：

```
<|startoftranscript|>  <|en|>  <|transcribe|>  <|0.00|>
```

或

```
<|startoftranscript|>  <|fr|>  <|translate|>   <|0.00|>
```

模型就是按这种约定训练的。你通过前缀控制任务。这是 2026 年 instruction-tuning 的前身，只是应用于语音。

### 第 6 步 — 输出

束搜索（宽度 5）加对数概率阈值。当 `<|notimestamps|>` token 缺失时，每 0.02 秒音频预测一次时间戳。

### Whisper 各规格

| 模型 | 参数量 | 层数 | d_model | 注意力头 | 显存（fp16） |
|-------|--------|--------|---------|-------|-------------|
| Tiny | 39M | 4 | 384 | 6 | ~1 GB |
| Base | 74M | 6 | 512 | 8 | ~1 GB |
| Small | 244M | 12 | 768 | 12 | ~2 GB |
| Medium | 769M | 24 | 1024 | 16 | ~5 GB |
| Large | 1550M | 32 | 1280 | 20 | ~10 GB |
| Large-v3 | 1550M | 32 | 1280 | 20 | ~10 GB |
| Large-v3-turbo | 809M | 32 | 1280 | 20 | ~6 GB（4 层解码器） |

Large-v3-turbo（2024）把解码器从 32 层砍到 4 层。解码速度提升 8 倍，WER 退化不足 1 个点。正是这一解码速度的突破，使 Whisper-turbo 成为 2026 年实时语音代理的默认选择。

### Whisper 不做的事

- 不做说话人分离（谁在说话）。需要的话配合 pyannote。
- 原生不支持实时流式——30 秒窗口是固定的。现代封装（`faster-whisper`、`WhisperX`）通过 VAD + 重叠来实现流式。
- 超过 30 秒的长音频没有外部分块就无法处理长上下文。实际效果不错，因为人类语音的转写很少需要长程上下文。

### 2026 年格局

| 任务 | 模型 | 说明 |
|------|-------|-------|
| 英语 ASR | Whisper-turbo, Moonshine | Moonshine 在边缘设备上快 4 倍 |
| 多语言 ASR | Whisper-large-v3 | 97 种语言 |
| 流式 ASR | faster-whisper + VAD | 可达到 150 ms 延迟目标 |
| TTS | Piper, XTTS-v2, Kokoro | encoder-decoder 模式，但非 Whisper 形态 |
| 音频 + 语言 | AudioLM, SeamlessM4T | 同一个 transformer 内同时使用文本 token + 音频 token |

```figure
n5-mel-decode
```

## 动手构建

见 `code/main.py`。我们不训练 Whisper——我们构建 log-mel 频谱图管道 + 任务 token 提示格式化器。这些才是你在生产环境中真正会接触的部分。

### 第 1 步：合成音频

生成一个 440 Hz、采样率 16 kHz 的 1 秒正弦波。16,000 个采样点。

### 第 2 步：log-mel 频谱图（简化版）

完整的 mel 频谱图需要 FFT。我们做一个简化的分帧 + 逐帧能量版本，展示整个管道而无需 `librosa`：

```python
def frame_signal(x, frame_size=400, hop=160):
    frames = []
    for start in range(0, len(x) - frame_size + 1, hop):
        frames.append(x[start:start + frame_size])
    return frames
```

帧长 = 25 ms，步长 = 10 ms。与 Whisper 的加窗一致。为教学目的，用逐帧能量代替 mel bin。

### 第 3 步：填充到 30 秒

Whisper 总是处理 30 秒的块。将频谱图填充（或裁剪）到 3,000 帧。

### 第 4 步：构建提示 token

```python
def whisper_prompt(lang="en", task="transcribe", timestamps=True):
    tokens = ["<|startoftranscript|>", f"<|{lang}|>", f"<|{task}|>"]
    if not timestamps:
        tokens.append("<|notimestamps|>")
    return tokens
```

这就是全部的任务控制面。一个 4 token 的前缀。

## 使用

```python
import whisper
model = whisper.load_model("large-v3-turbo")
result = model.transcribe("meeting.wav", language="en", task="transcribe")
print(result["text"])
print(result["segments"][0]["start"], result["segments"][0]["end"])
```

更快、OpenAI 兼容的：

```python
from faster_whisper import WhisperModel
model = WhisperModel("large-v3-turbo", compute_type="int8_float16")
segments, info = model.transcribe("meeting.wav", vad_filter=True)
for s in segments:
    print(f"{s.start:.2f} - {s.end:.2f}: {s.text}")
```

**2026 年什么时候选 Whisper：**

- 一个模型搞定多语言 ASR。
- 对嘈杂、多样化的音频进行稳健转写。
- 研究 / 原型 ASR——最快的起步方式。

**什么时候选别的：**

- 边缘设备上的超低延迟流式——同等质量下 Moonshine 胜过 Whisper。
- 需要 <200 ms 的实时对话式 AI——专用流式 ASR。
- 说话人分离——Whisper 不做这个；需加装 pyannote。

## 上线

见 `outputs/skill-asr-configurator.md`。该技能为新的语音应用挑选 ASR 模型、解码参数和预处理管道。

## 练习

1. **简单。** 运行 `code/main.py`。确认 16 kHz、10 ms 步长的 1 秒信号帧数约为 100 帧。30 秒：约 3,000 帧。
2. **中等。** 使用 `numpy.fft` 构建完整的 log-mel 频谱图。验证 80 个 mel bin 与 `librosa.feature.melspectrogram(n_mels=80)` 在数值误差范围内一致。
3. **困难。** 实现流式推理：将音频切成 10 秒窗口、2 秒重叠，对每个块运行 Whisper，合并转写结果。在 5 分钟播客样本上测量相对单次推理的词错误率。

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|-----------------|-----------------------|
| Mel 频谱图 | “音频图像” | 二维表示：一个轴是频率 bin，另一个轴是时间帧；每个单元为对数刻度的能量。 |
| Log-mel | “Whisper 看到的东西” | 经过对数变换的 mel 频谱图；近似人耳对响度的感知。 |
| 帧 | “一个时间切片” | 25 ms 的采样窗口；以 10 ms 步长重叠。 |
| 任务 token | “语音的提示前缀” | 解码器提示中诸如 `<\|transcribe\|>` / `<\|translate\|>` 之类的特殊 token。 |
| 语音活动检测（VAD） | “找出语音在哪” | 在 ASR 之前去除静音的门控；大幅削减成本。 |
| CTC | “Connectionist Temporal Classification” | 经典的无对齐训练 ASR 损失；Whisper 并不使用它。 |
| Whisper-turbo | “小解码器，全编码器” | large-v3 编码器 + 4 层解码器；解码快 8 倍。 |
| Faster-whisper | “生产级封装” | CTranslate2 重实现；int8 量化；比 OpenAI 参考实现快 4 倍。 |

## 延伸阅读

- [Radford 等（2022）。Robust Speech Recognition via Large-Scale Weak Supervision](https://arxiv.org/abs/2212.04356) — Whisper 论文。
- [OpenAI Whisper 仓库](https://github.com/openai/whisper) — 参考代码 + 模型权重。读 `whisper/model.py`，约 400 行即可从上到下看懂 Conv1D 主干 + 编码器 + 解码器。
- [OpenAI Whisper — `whisper/decoding.py`](https://github.com/openai/whisper/blob/main/whisper/decoding.py) — 第 5–6 步描述的束搜索 + 任务 token 逻辑就在这里；500 行，完全可读。
- [Baevski 等（2020）。wav2vec 2.0: A Framework for Self-Supervised Learning of Speech Representations](https://arxiv.org/abs/2006.11477) — 前身；在某些设置下仍是 SOTA 特征。
- [SYSTRAN/faster-whisper](https://github.com/SYSTRAN/faster-whisper) — 生产级封装，比参考实现快 4 倍。
- [Jia 等（2024）。Moonshine: Speech Recognition for Live Transcription and Voice Commands](https://arxiv.org/abs/2410.15608) — 2024 年面向边缘设备的 ASR，Whisper 形态但更小。
- [HuggingFace 博客 — "Fine-Tune Whisper For Multilingual ASR with 🤗 Transformers"](https://huggingface.co/blog/fine-tune-whisper) — 权威微调方案，包含 mel 频谱图预处理器和 token 时间戳处理。
- [HuggingFace `modeling_whisper.py`](https://github.com/huggingface/transformers/blob/main/src/transformers/models/whisper/modeling_whisper.py) — 完整实现（编码器、解码器、交叉注意力、生成），与本课的架构图一一对应。