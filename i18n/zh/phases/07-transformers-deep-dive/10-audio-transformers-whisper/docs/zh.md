# 音频变换器  语架构

> 音频是时间频率的图像. 语是一种吃掉光谱的 ViT,

**Type:** Learn
**Languages:** Python, Rust
**Prerequisites:** Phase 7 · 05 (Full Transformer), Phase 7 · 08 (Encoder-Decoder), Phase 7 · 09 (ViT)
**Time:** ~45 minutes

## 问题

在Whisper之前 (OpenAI,Radford等2022年) 最先进的自动语音识别 (ASR) 意味着 wav2vec 2.0和HuBERT 自主监督的特征提取器以及一个精细调的头.高质量,昂贵的数据管道,域名脆性.多语言语音识别需要每个语言家庭的单独模型.

声打了三张注:

1. **Train on everything.**没有清洁的学术资料,没有音符标签.
2. **Multi-task single model.**一个解码器通过任务代币共同训练成文 transcription,翻译,语音活动检测,语言识别和时刻标记.
3. **Standard encoder-decoder transformer.**编码器使用日志邮件谱谱. 解码器自动降低生成文本代码. 没有声码器,没有CTC,没有HMM.

结果:Whisper large-v3在零清洁标记数据的口音,噪音和语言中具有强度.它是2026年每个开源语音助理和大多数商业语言的默认语音前端.

## 概念

![Whisper pipeline: audio → mel → encoder → decoder → text](../assets/whisper.svg)

### 步骤 1 重复样本+窗口

音频 16 kHz. 剪辑/pad 30 秒. 计算日志-邮件谱: 80 个音符, 10 毫米步骤 → ~ 3,000 个框架 × 80 个功能.这是Whisper 看到的"输入图像".

### 步骤 2 卷积干

两个Conv1D层,内核3和步骤2将3000个框架缩小到1,500个.

### 步骤 3 编码器

转变器编码器24层 (大型) 超过1500个时间步骤. 静脉定位编码,自觉注意力,GELU FFN. 产生1500 × 1,280个隐藏状态.

### 步骤 4 解码器

它自动降低地从BPE词汇中生成代币,这是GPT-2的超集,有几个特定音频的特殊代币.

### 步骤 5 任务代币

解码提示开始使用控制代币告诉模型该怎么做:

```
<|startoftranscript|>  <|en|>  <|transcribe|>  <|0.00|>
```

或

```
<|startoftranscript|>  <|fr|>  <|translate|>   <|0.00|>
```

模型是根据这个公约训练的.你用前控制任务. 2026 相当于指令调整,但适用于语音.

### 步骤 6 输出

随着测试记录的值,随着测试记录的值,每0.02秒钟的音频时,`<|notimestamps|>`标志是缺失的.

### 语尺寸

| Model | Params | Layers | d_model | Heads | VRAM (fp16) |
|-------|--------|--------|---------|-------|-------------|
| Tiny | 39M | 4 | 384 | 6 | ~1 GB |
| Base | 74M | 6 | 512 | 8 | ~1 GB |
| Small | 244M | 12 | 768 | 12 | ~2 GB |
| Medium | 769M | 24 | 1024 | 16 | ~5 GB |
| Large | 1550M | 32 | 1280 | 20 | ~10 GB |
| Large-v3 | 1550M | 32 | 1280 | 20 | ~10 GB |
| Large-v3-turbo | 809M | 32 | 1280 | 20 | ~6 GB (4-layer decoder) |

大v3turbo (2024) 将解码器从32层缩小到4.8x更快的解码器,以 <1 WER 点回归.这解码速度解锁是为什么Whisper-turbo是2026年实时语音代理的默认.

### 语不做什么

- 没有日记,与笔记相对.
- 没有实时流媒体本地 30秒窗口是固定的.`faster-whisper`现在`WhisperX`) 通过VAD+重叠的流通.
- 没有长文本超过30秒,没有外部的碎片. 在实践中,它很好,因为人类的语言很少需要长文本来转录.

### 2026年景观

| Task | Model | Notes |
|------|-------|-------|
| English ASR | Whisper-turbo, Moonshine | Moonshine is 4× faster on edge |
| Multilingual ASR | Whisper-large-v3 | 97 languages |
| Streaming ASR | faster-whisper + VAD | 150 ms latency targets achievable |
| TTS | Piper, XTTS-v2, Kokoro | Encoder-decoder pattern, but Whisper-shaped |
| Audio + language | AudioLM, SeamlessM4T | Text tokens + audio tokens in one transformer |

```figure
n5-mel-decode
```

## 建立它

看到`code/main.py`我们不训练Whisper,我们构建了"日志邮件谱"管道,

### 步骤1:合成音频

产生1秒的光阴波,在440Hz,采用16kHz的样本.

### 步骤2:日志通讯谱 (简化)

我们做了一个简单的框架+每框架的能量版本,`librosa`其他:

```python
def frame_signal(x, frame_size=400, hop=160):
    frames = []
    for start in range(0, len(x) - frame_size + 1, hop):
        frames.append(x[start:start + frame_size])
    return frames
```

片的能量是教育的片.

### 步骤3: 到30秒

语总是处理30秒的块. 片或剪辑光谱到3000个图片.

### 步骤 4: 建立提示令牌

```python
def whisper_prompt(lang="en", task="transcribe", timestamps=True):
    tokens = ["<|startoftranscript|>", f"<|{lang}|>", f"<|{task}|>"]
    if not timestamps:
        tokens.append("<|notimestamps|>")
    return tokens
```

这就是整个任务控制表面.

## 用它

```python
import whisper
model = whisper.load_model("large-v3-turbo")
result = model.transcribe("meeting.wav", language="en", task="transcribe")
print(result["text"])
print(result["segments"][0]["start"], result["segments"][0]["end"])
```

快速,与OpenAI兼容:

```python
from faster_whisper import WhisperModel
model = WhisperModel("large-v3-turbo", compute_type="int8_float16")
segments, info = model.transcribe("meeting.wav", vad_filter=True)
for s in segments:
    print(f"{s.start:.2f} - {s.end:.2f}: {s.text}")
```

**When to pick Whisper in 2026:**

- 具有多语言的ASR,一个模型.
- 强大的音频转录.
- 研究/原型ASR 最快的起点.

**When to pick something else:**

- 极低延迟在边缘流 月光比语在匹配的质量.
- 需要200 ms 专用流媒体ASR的实时对话AI.
-  语不这样做; 在平笔上.

## 运送它

看到`outputs/skill-asr-configurator.md`技能选择一个ASR模型,解码参数,以及为新的语音应用程序进行预处理.

## 运动

1. **Easy.**跑步`code/main.py`确认一个秒钟信号的16kHz,10ms跳跃是~100个.30秒钟:~3,000个.
2. **Medium.**使用 构建完整的日志邮件谱`numpy.fft`检查80个桶的匹配`librosa.feature.melspectrogram(n_mels=80)`在数值错误中.
3. **Hard.**实现流传推断:将部分音频分为10秒的窗户,并进行2秒的重叠,在每个部分运行Whisper,并并并转录.在5分钟播客样本上测量文字错误率与单次传输率.

## 关键词

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Mel spectrogram | "Audio image" | 2D representation: frequency bins on one axis, time frames on the other; log-scaled energy per cell. |
| Log-mel | "What Whisper sees" | Mel spectrogram passed through log; approximates human perception of loudness. |
| Frame | "One time slice" | A 25 ms window of samples; overlapping at 10 ms stride. |
| Task token | "Prompt prefix for speech" | Special tokens like `<\|transcribe\|>` / `<\|translate\|>` in the decoder prompt. |
| Voice activity detection (VAD) | "Find the speech" | Gate that removes silence before ASR; cuts cost massively. |
| CTC | "Connectionist Temporal Classification" | Classic ASR loss for alignment-free training; Whisper does NOT use it. |
| Whisper-turbo | "Small decoder, full encoder" | large-v3 encoder + 4-layer decoder; 8× faster decoding. |
| Faster-whisper | "The production wrapper" | CTranslate2 reimplementation; int8 quantization; 4× faster than OpenAI's reference. |

## 进一步阅读

- [Radford et al. (2022). Robust Speech Recognition via Large-Scale Weak Supervision](https://arxiv.org/abs/2212.04356) 语纸.
- [OpenAI Whisper repo](https://github.com/openai/whisper)参考码+模型重量.`whisper/model.py`查看Conv1D干 +编码器 +解码器从上到下,在400行左右.
- [OpenAI Whisper — `whisper/decoding.py`](https://github.com/openai/whisper/blob/main/whisper/decoding.py)步骤56中描述的光束搜索+任务标志逻辑在这里;500行,可以完全阅读.
- [Baevski et al. (2020). wav2vec 2.0: A Framework for Self-Supervised Learning of Speech Representations](https://arxiv.org/abs/2006.11477)前;在某些设置中仍然具有SOTA功能.
- [SYSTRAN/faster-whisper](https://github.com/SYSTRAN/faster-whisper)生产包装,比参考快4倍.
- [Jia et al. (2024). Moonshine: Speech Recognition for Live Transcription and Voice Commands](https://arxiv.org/abs/2410.15608) 2024 边缘友好的ASR,有声形状但较小.
- [HuggingFace blog — "Fine-Tune Whisper For Multilingual ASR with 🤗 Transformers"](https://huggingface.co/blog/fine-tune-whisper)加нони化精细调节配方,包括MEL光谱预处理器和代币时刻标签处理.
- [HuggingFace `modeling_whisper.py`](https://github.com/huggingface/transformers/blob/main/src/transformers/models/whisper/modeling_whisper.py)完全实现 (编码器,解码器,交叉注意力,生成) 反映了课程的架构图图.
