# 文本转语音（TTS）—— 从 Tacotron 到 F5 与 Kokoro

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> ASR 把语音转成文本；TTS 把文本转成语音。2026 年的技术栈分三段：text → tokens、tokens → mel、mel → 波形。每一段都有一个能塞进笔记本电脑的默认模型。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 6 · 02 (Spectrograms & Mel), Phase 5 · 09 (Seq2Seq), Phase 7 · 05 (Full Transformer)
**Time:** ~75 minutes

## 问题（The Problem）

你手上有一段字符串："Please remind me to water the plants at 6 pm."。你需要生成一段 3 秒的音频，听起来自然、韵律正确（停顿、重音得当）、把 "plants" 的元音读对，并且要在 CPU 上以低于 300 ms 的延迟跑完，好接到一个实时语音助手里。同时你还得能换声音、能处理夹杂语种的输入（"remind me at 6 pm, daijoubu?"），并且不要在念人名时丢人。

现代 TTS 流水线长这样：

1. **文本前端（Text frontend）。** 文本归一化（日期、数字、邮箱），转成音素或子词 token，预测韵律特征。
2. **声学模型（Acoustic model）。** 文本 → mel spectrogram（梅尔频谱）。Tacotron 2（2017）、FastSpeech 2（2020）、VITS（2021）、F5-TTS（2024）、Kokoro（2024）。
3. **声码器（Vocoder）。** Mel → 波形。WaveNet（2016）、WaveRNN、HiFi-GAN（2020）、BigVGAN（2022），以及 2024 之后的 neural codec vocoder。

到 2026 年，声学模型 + 声码器的分工边界，因为端到端 diffusion（扩散）和 flow-matching 模型而开始模糊。但用「三段」这个心智模型来调试问题仍然很好用。

## 概念（The Concept）

![Tacotron, FastSpeech, VITS, F5/Kokoro side-by-side](../assets/tts.svg)

**Tacotron 2（2017）。** Seq2seq 架构：char-embedding → BiLSTM encoder → location-sensitive attention（注意力）→ autoregressive LSTM decoder 逐帧吐 mel。慢（AR），长文本上 attention 容易抖。如今仍常被作为 baseline 引用。

**FastSpeech 2（2020）。** 非 autoregressive。duration predictor（时长预测器）输出每个音素分到几个 mel 帧。1-pass 完成，比 Tacotron 快 10×。代价是少了一些自然度（单调对齐），但好部署，到处能跑。

**VITS（2021）。** 端到端联合训练 encoder + 基于 flow 的时长建模 + HiFi-GAN 声码器，用变分推理串起来。质量高、单一模型即可部署。是 2022–2024 年最主流的开源 TTS。变体：YourTTS（多说话人 zero-shot）、XTTS v2（2024，Coqui）。

**F5-TTS（2024）。** Diffusion transformer，配 flow matching。韵律自然，靠 5 秒参考音频即可 zero-shot 克隆音色。位居 2026 年开源 TTS 排行榜首。335M 参数。

**Kokoro（2024）。** 体积小（82M），可跑在 CPU 上，是当下实时英文 TTS 中第一档。封闭词表、仅英文，apache-2.0 协议。

**OpenAI TTS-1-HD、ElevenLabs v2.5、Google Chirp-3。** 商业 SOTA。ElevenLabs v2.5 的情绪标签（"[whispered]"、"[laughing]"）和角色音色，主导了 2026 年有声书生产线。

### 声码器演进（Vocoder evolution）

| 时代 | Vocoder | 延迟 | 质量 |
|-----|---------|---------|---------|
| 2016 | WaveNet | 仅离线 | 发布时 SOTA |
| 2018 | WaveRNN | ~ 实时 | 不错 |
| 2020 | HiFi-GAN | 100× 实时 | 接近真人 |
| 2022 | BigVGAN | 50× 实时 | 跨说话人/语言泛化好 |
| 2024 | SNAC、DAC（neural codec） | 与 AR 模型一体 | 离散 token，比特效率高 |

到了 2026，多数「TTS」模型已经是端到端、文本直接到波形；mel spectrogram 退化成内部表示。

### 评估（Evaluation）

- **MOS（Mean Opinion Score）。** 1–5 分，众包打分。仍是金标准；慢得让人发指。
- **CMOS（Comparative MOS）。** A vs B 偏好对比。每条标注下置信区间更紧。
- **UTMOS、DNSMOS。** Reference-free 神经 MOS 预测器。排行榜常用。
- **CER（Character Error Rate）via ASR。** 把 TTS 输出喂回 Whisper，再对照原文本算 CER。可懂度的代理指标。
- **SECS（Speaker Embedding Cosine Similarity）。** 衡量音色克隆质量。

2026 年在 LibriTTS test-clean 上的数字：

| 模型 | UTMOS | CER（via Whisper） | 体积 |
|-------|-------|-------------------|------|
| Ground truth | 4.08 | 1.2% | — |
| F5-TTS | 3.95 | 2.1% | 335M |
| XTTS v2 | 3.81 | 3.5% | 470M |
| VITS | 3.62 | 3.1% | 25M |
| Kokoro v0.19 | 3.87 | 1.8% | 82M |
| Parler-TTS Large | 3.76 | 2.8% | 2.3B |

## 动手实现（Build It）

### Step 1：把输入音素化（phonemize）

```python
from phonemizer import phonemize
ph = phonemize("Hello world", language="en-us", backend="espeak")
# 'həloʊ wɜːld'
```

音素是通用的桥梁。质量在 VITS 以下的模型，基本不要直接喂原始文本。

### Step 2：跑 Kokoro（2026 年 CPU 默认选择）

```python
from kokoro import KPipeline
tts = KPipeline(lang_code="a")  # "a" = American English
audio, sr = tts("Please remind me to water the plants at 6 pm.", voice="af_bella")
# audio: float32 tensor, sr=24000
```

离线运行，单文件，82M 参数。

### Step 3：用 F5-TTS 做音色克隆

```python
from f5_tts.api import F5TTS
tts = F5TTS()
wav = tts.infer(
    ref_file="my_voice_5s.wav",
    ref_text="The quick brown fox jumps over the lazy dog.",
    gen_text="Please remind me to water the plants.",
)
```

传入一段 5 秒参考音频 + 它的转写文本；F5 会克隆其韵律和音色。

### Step 4：从零写 HiFi-GAN 声码器

教学脚本里塞不下，但骨架是这样：

```python
class HiFiGAN(nn.Module):
    def __init__(self, mel_channels=80, upsample_rates=[8, 8, 2, 2]):
        super().__init__()
        # 4 upsample blocks, total 256x to go from mel-rate to audio-rate
        ...
    def forward(self, mel):
        return self.blocks(mel)  # -> waveform
```

训练目标：对抗损失（短窗判别器）+ mel-spectrogram 重建损失 + feature-matching 损失。这一块已经商品化 —— 直接用 `hifi-gan` 仓库或 nvidia-NeMo 里的预训练 checkpoint 即可。

### Step 5：完整流水线（伪代码）

```python
text = "Please remind me at 6 pm."
phones = phonemize(text)
mel = acoustic_model(phones, speaker=alice)      # [T, 80]
wav = vocoder(mel)                                # [T * 256]
soundfile.write("out.wav", wav, 24000)
```

## 用起来（Use It）

2026 年的技术栈：

| 场景 | 选型 |
|-----------|------|
| 实时英文语音助手 | Kokoro（CPU）或 XTTS v2（GPU） |
| 5 秒参考克隆音色 | F5-TTS |
| 商用角色音色 | ElevenLabs v2.5 |
| 有声书旁白 | ElevenLabs v2.5 或 XTTS v2 + 微调 |
| 低资源语言 | 在 5–20 小时目标语料上训 VITS |
| 表现力 / 情绪标签 | ElevenLabs v2.5 或 StyleTTS 2 微调 |

截至 2026 年的开源王者：**质量看 F5-TTS，效率看 Kokoro**。除非你是历史学家，否则别再去碰 Tacotron。

## 陷阱（Pitfalls）

- **没有文本归一化。** "Dr. Smith" 是读成 "Doctor" 还是 "Drive"？"2026" 是 "twenty twenty six" 还是 "two zero two six"？归一化要放在 phonemizer **之前**。
- **OOV 专有名词。** "Ghumare" → "ghyu-mair"？给未知 token 配一个兜底的 grapheme-to-phoneme（G2P）模型。
- **削顶（Clipping）。** 声码器输出本身很少削顶，但推理时 mel 的归一化尺度对不上，可能跑出 ±1.0 之外。养成 `np.clip(wav, -1, 1)` 的习惯。
- **采样率不匹配。** Kokoro 输出 24 kHz；下游流水线如果期待 16 kHz，记得重采样，否则会吃到混叠（aliasing）。

## 上线部署（Ship It）

存为 `outputs/skill-tts-designer.md`。针对给定的目标音色、延迟与语言，设计一条 TTS 流水线。

## 练习（Exercises）

1. **入门。** 跑一遍 `code/main.py`。它从一个玩具词表里建音素字典，估每个音素的时长，并打印一份假的 "mel" 时间表。
2. **进阶。** 安装 Kokoro，用 `af_bella` 和 `am_adam` 这两种 voice 合成同一句话。对比时长与主观听感。
3. **挑战。** 录一段 5 秒的自己说话的参考音频。用 F5-TTS 克隆它。报告参考音频与克隆输出之间的 SECS 分数。

## 关键术语（Key Terms）

| 术语 | 大众说法 | 实际含义 |
|------|-----------------|-----------------------|
| Phoneme | 发音单位 | 抽象的发音类别；英文 ARPABet 共 39 个。 |
| Duration predictor | 每个音素持续多久 | 非 AR 模型输出；每个音素对应几帧（整数）。 |
| Vocoder | Mel → 波形 | 把 mel-spec 映射到原始采样的神经网络。 |
| HiFi-GAN | 标准声码器 | 基于 GAN；2020–2024 年的主力。 |
| MOS | 主观质量 | 1–5 分，由人类评分员打的平均意见分。 |
| SECS | 音色克隆指标 | 目标说话人 embedding 与输出 embedding 的余弦相似度。 |
| F5-TTS | 2024 开源 SOTA | Flow-matching diffusion；zero-shot 克隆。 |
| Kokoro | CPU 英文 TTS 王者 | 82M 参数，Apache 2.0 协议。 |

## 延伸阅读（Further Reading）

- [Shen et al. (2017). Tacotron 2](https://arxiv.org/abs/1712.05884) —— seq2seq baseline。
- [Kim, Kong, Son (2021). VITS](https://arxiv.org/abs/2106.06103) —— 端到端、基于 flow。
- [Chen et al. (2024). F5-TTS](https://arxiv.org/abs/2410.06885) —— 当前开源 SOTA。
- [Kong, Kim, Bae (2020). HiFi-GAN](https://arxiv.org/abs/2010.05646) —— 至 2026 年仍在生产环境跑的声码器。
- [Kokoro-82M on HuggingFace](https://huggingface.co/hexgrad/Kokoro-82M) —— 2024 年的 CPU 友好英文 TTS。
