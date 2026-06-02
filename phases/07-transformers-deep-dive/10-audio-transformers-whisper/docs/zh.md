# 音频 transformer —— Whisper 架构

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 音频是「频率随时间变化」的一张图。Whisper 就是一个吃 mel 频谱图、然后把话说回来的 ViT。

**Type:** Learn
**Languages:** Python
**Prerequisites:** Phase 7 · 05 (Full Transformer), Phase 7 · 08 (Encoder-Decoder), Phase 7 · 09 (ViT)
**Time:** ~45 minutes

## 问题（The Problem）

在 Whisper（OpenAI，Radford 等 2022）出现之前，自动语音识别（automatic speech recognition，ASR）的 SOTA 路线是 wav2vec 2.0 和 HuBERT —— 自监督特征抽取器外挂一个 fine-tune 过的 head。质量高，但数据流水线昂贵，而且换个领域就翻车。多语言语音识别还得按语系分别训模型。

Whisper 押了三把：

1. **什么都拿来训。** 从互联网爬来的 68 万小时弱标注音频，覆盖 97 种语言。没有干净的学术语料，也没有音素标签。
2. **一个模型多任务。** 一个 decoder 同时训练转写、翻译、语音活动检测、语种识别和加时间戳，靠任务 token 切换。
3. **就用标准 encoder-decoder transformer。** Encoder 吃 log-mel 频谱图。Decoder autoregressive 输出文本 token。没有声码器（vocoder），没有 CTC，没有 HMM。

结果：Whisper large-v3 对各种口音、噪声、甚至完全没有干净标注数据的语言都很鲁棒。2026 年它是几乎所有开源语音助手、以及大多数商业语音助手的默认语音前端。

## 概念（The Concept）

![Whisper pipeline: audio → mel → encoder → decoder → text](../assets/whisper.svg)

### 第 1 步 —— 重采样 + 加窗

音频 16 kHz。裁剪 / pad 到 30 秒。算 log-mel 频谱图：80 个 mel bin，10 ms 步长 → 约 3,000 帧 × 80 维特征。这就是 Whisper 看到的「输入图像」。

### 第 2 步 —— 卷积 stem

两层 Conv1D，kernel = 3，stride = 2，把 3,000 帧降到 1,500。在不增加多少参数的前提下把序列长度砍半。

### 第 3 步 —— encoder

24 层（large 规格）transformer encoder 处理 1,500 个时间步。正弦位置编码，self-attention，GELU FFN。输出 1,500 × 1,280 的隐状态。

### 第 4 步 —— decoder

24 层 transformer decoder。autoregressive 地从一个 BPE 词表里产出 token，这个词表是 GPT-2 词表的超集，外加几个音频专用的特殊 token。

### 第 5 步 —— 任务 token

decoder 的 prompt 以一串控制 token 开头，告诉模型该干什么：

```
<|startoftranscript|>  <|en|>  <|transcribe|>  <|0.00|>
```

或者：

```
<|startoftranscript|>  <|fr|>  <|translate|>   <|0.00|>
```

模型就是按这个约定训的。靠前缀控制任务。这是 2026 年大家说的 instruction-tuning 在语音上的对应物。

### 第 6 步 —— 输出

Beam search（width = 5）配 log-prob 阈值。当 `<|notimestamps|>` token 不出现时，模型每 0.02 秒预测一次时间戳。

### Whisper 各档大小

| Model | Params | Layers | d_model | Heads | VRAM (fp16) |
|-------|--------|--------|---------|-------|-------------|
| Tiny | 39M | 4 | 384 | 6 | ~1 GB |
| Base | 74M | 6 | 512 | 8 | ~1 GB |
| Small | 244M | 12 | 768 | 12 | ~2 GB |
| Medium | 769M | 24 | 1024 | 16 | ~5 GB |
| Large | 1550M | 32 | 1280 | 20 | ~10 GB |
| Large-v3 | 1550M | 32 | 1280 | 20 | ~10 GB |
| Large-v3-turbo | 809M | 32 | 1280 | 20 | ~6 GB (4-layer decoder) |

Large-v3-turbo（2024）把 decoder 从 32 层砍到 4 层。解码快了 8 倍，WER 退化不到 1 个百分点。这个解码加速是 Whisper-turbo 在 2026 年成为实时语音 agent 默认选择的原因。

### Whisper 不做的事

- 不做 diarization（区分谁在说）。要这个就配 pyannote。
- 原生不支持实时流式 —— 30 秒窗口是写死的。现代封装（`faster-whisper`、`WhisperX`）通过 VAD + 重叠拼出流式。
- 30 s 之外没有长程上下文，需要外部分块。但实际转写里很少需要长程上下文，所以一般够用。

### 2026 年的全景

| Task | Model | Notes |
|------|-------|-------|
| English ASR | Whisper-turbo, Moonshine | Moonshine 在边端快 4 倍 |
| Multilingual ASR | Whisper-large-v3 | 97 语言 |
| Streaming ASR | faster-whisper + VAD | 可达 150 ms 延迟 |
| TTS | Piper, XTTS-v2, Kokoro | encoder-decoder 模式，但形状像 Whisper |
| Audio + language | AudioLM, SeamlessM4T | 文本 token + 音频 token 同进一个 transformer |

## 动手实现（Build It）

见 `code/main.py`。我们不训练 Whisper —— 我们搭 log-mel 频谱图流水线 + 任务 token prompt 格式化器。这才是你在生产里真正会动的部分。

### Step 1：合成音频

生成 1 秒 440 Hz 正弦波，采样率 16 kHz，一共 16,000 个样本。

### Step 2：log-mel 频谱图（简化版）

完整 mel 频谱图要算 FFT。我们做一个简化版的分帧 + 帧能量，把流水线串起来，不用上 `librosa`：

```python
def frame_signal(x, frame_size=400, hop=160):
    frames = []
    for start in range(0, len(x) - frame_size + 1, hop):
        frames.append(x[start:start + frame_size])
    return frames
```

帧 = 25 ms，hop = 10 ms。和 Whisper 的加窗一致。教学起见用每帧能量代替 mel bin。

### Step 3：pad 到 30 s

Whisper 永远以 30 秒块为单位处理。把频谱图 pad（或裁）到 3,000 帧。

### Step 4：构造 prompt token

```python
def whisper_prompt(lang="en", task="transcribe", timestamps=True):
    tokens = ["<|startoftranscript|>", f"<|{lang}|>", f"<|{task}|>"]
    if not timestamps:
        tokens.append("<|notimestamps|>")
    return tokens
```

整个任务控制接口就这么大。一个 4-token 前缀。

## 用起来（Use It）

```python
import whisper
model = whisper.load_model("large-v3-turbo")
result = model.transcribe("meeting.wav", language="en", task="transcribe")
print(result["text"])
print(result["segments"][0]["start"], result["segments"][0]["end"])
```

更快、API 兼容 OpenAI 的版本：

```python
from faster_whisper import WhisperModel
model = WhisperModel("large-v3-turbo", compute_type="int8_float16")
segments, info = model.transcribe("meeting.wav", vad_filter=True)
for s in segments:
    print(f"{s.start:.2f} - {s.end:.2f}: {s.text}")
```

**2026 年什么时候选 Whisper：**

- 一个模型搞定多语言 ASR。
- 鲁棒地转写嘈杂、形态各异的音频。
- 研究 / 原型 ASR —— 起步最快。

**什么时候选别的：**

- 边端超低延迟流式 —— 同等质量下 Moonshine 比 Whisper 强。
- 实时对话式 AI 要 <200 ms —— 上专门的流式 ASR。
- 说话人分离 —— Whisper 不做这事，配 pyannote。

## 上线部署（Ship It）

见 `outputs/skill-asr-configurator.md`。这个 skill 会为一个新的语音应用挑选 ASR 模型、解码参数和预处理流水线。

## 练习（Exercises）

1. **简单。** 跑 `code/main.py`。确认 16 kHz 下 1 秒信号、10 ms hop 时帧数大约是 100；30 秒时大约是 3,000。
2. **中等。** 用 `numpy.fft` 实现完整的 log-mel 频谱图。验证 80 个 mel bin 与 `librosa.feature.melspectrogram(n_mels=80)` 在数值误差范围内一致。
3. **困难。** 实现流式推理：把音频切成 10 s 窗口，2 s 重叠，每块跑 Whisper，再合并转写结果。在一个 5 分钟的播客样本上测它的词错误率（WER）相对于一次性整段跑的差距。

## 关键术语（Key Terms）

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Mel spectrogram | "音频图像" | 二维表示：一轴是频率 bin，一轴是时间帧；每个格子里是 log 缩放的能量。 |
| Log-mel | "Whisper 看到的东西" | mel 频谱图取 log；近似人耳对响度的感知。 |
| Frame | "一个时间切片" | 25 ms 的样本窗口；以 10 ms 步长重叠。 |
| Task token | "语音的 prompt 前缀" | decoder prompt 里 `<\|transcribe\|>` / `<\|translate\|>` 这类特殊 token。 |
| Voice activity detection (VAD) | "把语音找出来" | 把静音段过滤掉再喂 ASR；能省一大笔成本。 |
| CTC | "Connectionist Temporal Classification" | 经典 ASR 用的对齐无关训练损失；Whisper **不用** 它。 |
| Whisper-turbo | "小 decoder + 完整 encoder" | large-v3 encoder + 4 层 decoder；解码快 8 倍。 |
| Faster-whisper | "生产环境封装" | 用 CTranslate2 重写；int8 量化；比 OpenAI 参考实现快 4 倍。 |

## 延伸阅读（Further Reading）

- [Radford et al. (2022). Robust Speech Recognition via Large-Scale Weak Supervision](https://arxiv.org/abs/2212.04356) —— Whisper 论文。
- [OpenAI Whisper repo](https://github.com/openai/whisper) —— 参考代码 + 模型权重。读 `whisper/model.py`，约 400 行就能从上到下看完 Conv1D stem + encoder + decoder。
- [OpenAI Whisper —— `whisper/decoding.py`](https://github.com/openai/whisper/blob/main/whisper/decoding.py) —— 第 5–6 步讲的 beam search + 任务 token 逻辑就在这里；500 行，完全读得动。
- [Baevski et al. (2020). wav2vec 2.0: A Framework for Self-Supervised Learning of Speech Representations](https://arxiv.org/abs/2006.11477) —— 前驱工作；在某些场景下其特征仍是 SOTA。
- [SYSTRAN/faster-whisper](https://github.com/SYSTRAN/faster-whisper) —— 生产封装，比参考实现快 4 倍。
- [Jia et al. (2024). Moonshine: Speech Recognition for Live Transcription and Voice Commands](https://arxiv.org/abs/2410.15608) —— 2024 年面向边端的 ASR，形状仿 Whisper 但更小。
- [HuggingFace 博客 —— "Fine-Tune Whisper For Multilingual ASR with 🤗 Transformers"](https://huggingface.co/blog/fine-tune-whisper) —— 标准的微调配方，包含 mel 频谱图预处理器和 token-时间戳处理。
- [HuggingFace `modeling_whisper.py`](https://github.com/huggingface/transformers/blob/main/src/transformers/models/whisper/modeling_whisper.py) —— 完整实现（encoder、decoder、cross-attention、生成），与本课的架构图一一对应。
