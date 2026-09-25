# 文本转语音(TTS)——从 Tacotron 到 F5 与 Kokoro

> ASR 将语音转换为文本;TTS 将文本转换为语音。2026 年的技术栈分为三个部分:文本 → token,token → mel,mel → 波形。每个部分都有一个能在一台笔记本上运行的默认模型。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 6 · 02(频谱图与 Mel),Phase 5 · 09(Seq2Seq),Phase 7 · 05(完整 Transformer)
**Time:** 约 75 分钟

## 问题

你有一个字符串:"Please remind me to water the plants at 6 pm."。你需要一段 3 秒的音频,听起来自然,韵律正确(停顿、重音),把 "plants" 中的元音发音正确,并且在 CPU 上 300 毫秒内运行完,以满足实时语音助手的需求。你还需要支持切换音色,处理语码转换输入("remind me at 6 pm, daijoubu?"),并且不能在人名上出丑。

现代 TTS 流水线如下:

1. **文本前端。** 归一化文本(日期、数字、邮箱),转换为音素或子词 token,预测韵律特征。
2. **声学模型。** 文本 → mel 频谱图。Tacotron 2(2017)、FastSpeech 2(2020)、VITS(2021)、F5-TTS(2024)、Kokoro(2024)。
3. **声码器。** Mel → 波形。WaveNet(2016)、WaveRNN、HiFi-GAN(2020)、BigVGAN(2022),以及 2024 年以后的神经编解码声码器。

到 2026 年,随着端到端扩散模型和流匹配模型的出现,声学模型 + 声码器的分界变得模糊。但"三个部分"的心智模型在调试时仍然适用。

## 核心概念

![Tacotron, FastSpeech, VITS, F5/Kokoro side-by-side](../assets/tts.svg)

**Tacotron 2(2017)。** Seq2seq:字符嵌入 → BiLSTM 编码器 → 位置敏感注意力 → 自回归 LSTM 解码器输出 mel 帧。速度慢(自回归),长文本上不稳定。仍常被作为基线引用。

**FastSpeech 2(2020)。** 非自回归。时长预测器输出每个音素对应多少 mel 帧。一次前向,比 Tacotron 快 10 倍。损失了一些自然度(单调对齐),但部署极为广泛。

**VITS(2021)。** 通过变分推断端到端联合训练编码器 + 基于流的时长模块 + HiFi-GAN 声码器。高质量,单一模型。2022–2024 年间的开源 TTS 主流。变体:YourTTS(多说话人零样本)、XTTS v2(2024,Coqui)。

**F5-TTS(2024)。** 基于流匹配的扩散 Transformer。韵律自然,用 5 秒参考音频即可零样本克隆声音。位居 2026 年开源 TTS 排行榜前列。335M 参数。

**Kokoro(2024)。** 小型(82M),可在 CPU 上运行,实时场景下最佳英语 TTS。封闭词表、仅英语,Apache-2.0 许可。

**OpenAI TTS-1-HD、ElevenLabs v2.5、Google Chirp-3。** 商业化顶尖水平。ElevenLabs v2.5 的情感标签("[whispered]"、"[laughing]")和角色音色在 2026 年主导有声书制作。

### 声码器演进

| 时期 | 声码器 | 延迟 | 质量 |
|-----|---------|---------|---------|
| 2016 | WaveNet | 仅离线 | 发布时 SOTA |
| 2018 | WaveRNN | 约实时 | 良好 |
| 2020 | HiFi-GAN | 100× 实时 | 接近人类 |
| 2022 | BigVGAN | 50× 实时 | 跨说话人/语言泛化 |
| 2024 | SNAC、DAC(神经编解码) | 与自回归模型集成 | 离散 token,比特高效 |

到 2026 年,大多数 "TTS" 模型已经从文本端到端直接生成波形;mel 频谱图只是内部表示。

### 评估

- **MOS(平均意见得分)。** 1–5 分制,众包评分。仍是黄金标准,但极其缓慢。
- **CMOS(对比 MOS)。** A vs B 的偏好选择。每次标注的置信区间更紧。
- **UTMOS、DNSMOS。** 无参考的神经 MOS 预测器。用于排行榜。
- **通过 ASR 计算 CER(字符错误率)。** 将 TTS 输出送入 Whisper,与输入文本计算 CER。可懂度的代理指标。
- **SECS(说话人嵌入余弦相似度)。** 声音克隆质量。

2026 年在 LibriTTS test-clean 上的数据:

| 模型 | UTMOS | CER(经 Whisper) | 规模 |
|-------|-------|-------------------|------|
| Ground truth | 4.08 | 1.2% | — |
| F5-TTS | 3.95 | 2.1% | 335M |
| XTTS v2 | 3.81 | 3.5% | 470M |
| VITS | 3.62 | 3.1% | 25M |
| Kokoro v0.19 | 3.87 | 1.8% | 82M |
| Parler-TTS Large | 3.76 | 2.8% | 2.3B |

```figure
sp-tts-stack
```

## 动手实现

### 第 1 步:输入音素化

```python
from phonemizer import phonemize
ph = phonemize("Hello world", language="en-us", backend="espeak")
# 'həloʊ wɜːld'
```

音素是通用桥梁。除非模型质量达到 VITS 水平,否则不要直接喂入原始文本。

### 第 2 步:运行 Kokoro(2026 年 CPU 默认选择)

```python
from kokoro import KPipeline
tts = KPipeline(lang_code="a")  # "a" = American English
audio, sr = tts("Please remind me to water the plants at 6 pm.", voice="af_bella")
# audio: float32 tensor, sr=24000
```

离线运行,单文件,82M 参数。

### 第 3 步:运行带声音克隆的 F5-TTS

```python
from f5_tts.api import F5TTS
tts = F5TTS()
wav = tts.infer(
    ref_file="my_voice_5s.wav",
    ref_text="The quick brown fox jumps over the lazy dog.",
    gen_text="Please remind me to water the plants.",
)
```

传入 5 秒参考片段及其转写文本;F5 会克隆韵律和音色。

### 第 4 步:从零实现 HiFi-GAN 声码器

规模太大,无法放进一个教程脚本,但其结构是:

```python
class HiFiGAN(nn.Module):
    def __init__(self, mel_channels=80, upsample_rates=[8, 8, 2, 2]):
        super().__init__()
        # 4 upsample blocks, total 256x to go from mel-rate to audio-rate
        ...
    def forward(self, mel):
        return self.blocks(mel)  # -> waveform
```

训练:对抗损失(在短窗口上的判别器)+ mel 频谱图重建损失 + 特征匹配损失。已经商品化——直接使用 `hifi-gan` 仓库或 nvidia-NeMo 中的预训练权重。

### 第 5 步:完整流水线(伪代码)

```python
text = "Please remind me at 6 pm."
phones = phonemize(text)
mel = acoustic_model(phones, speaker=alice)      # [T, 80]
wav = vocoder(mel)                                # [T * 256]
soundfile.write("out.wav", wav, 24000)
```

## 应用场景

2026 年的技术栈:

| 场景 | 选择 |
|-----------|------|
| 实时英语语音助手 | Kokoro(CPU)或 XTTS v2(GPU) |
| 从 5 秒参考克隆声音 | F5-TTS |
| 商业角色音色 | ElevenLabs v2.5 |
| 有声书朗读 | ElevenLabs v2.5 或 XTTS v2 + 微调 |
| 低资源语言 | 用 5–20 小时目标语言数据训练 VITS |
| 表现力 / 情感标签 | ElevenLabs v2.5 或 StyleTTS 2 微调 |

截至 2026 年的开源领先者:**追求质量选 F5-TTS,追求效率选 Kokoro**。除非你是历史研究者,否则不要碰 Tacotron。

## 常见陷阱

- **没有文本归一化器。** "Dr. Smith" 会被读成 "Doctor" 还是 "Drive"?"2026" 会被读成 "twenty twenty six" 还是 "two zero two six"?在音素化之前先做归一化。
- **未登录专有名词。** "Ghumare" → "ghyu-mair"?为未知词提供一个回退的字素转音素模型。
- **削波。** 声码器输出很少削波,但推理时 mel 缩放不匹配可能超出 ±1.0。务必使用 `np.clip(wav, -1, 1)`。
- **采样率不匹配。** Kokoro 输出 24 kHz;而你的下游流水线期望 16 kHz → 需要重采样,否则会产生混叠。

## 上线部署

保存为 `outputs/skill-tts-designer.md`。为给定的音色、延迟和语言目标设计一个 TTS 流水线。

## 练习

1. **简单。** 运行 `code/main.py`。从一个小型词表构建音素词典,估计每个音素的时长,并打印一个模拟的 "mel" 调度表。
2. **中等。** 安装 Kokoro,用音色 `af_bella` 和 `am_adam` 合成同一句话。比较音频时长和主观质量。
3. **困难。** 录制一段你自己 5 秒的参考音频。用 F5-TTS 克隆它。报告参考音频与克隆输出之间的 SECS。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------------|-----------------------|
| Phoneme | 声音单元 | 抽象声音类别;英语有 39 个(ARPABet)。 |
| Duration predictor | 每个音素持续多久 | 非自回归模型的输出;每个音素对应的整数帧数。 |
| Vocoder | Mel → 波形 | 将 mel 频谱图映射到原始采样的神经网络。 |
| HiFi-GAN | 标准声码器 | 基于 GAN;2020–2024 年的主流。 |
| MOS | 主观质量 | 人类评分者给出的 1–5 平均意见得分。 |
| SECS | 声音克隆指标 | 目标说话人嵌入与输出说话人嵌入之间的余弦相似度。 |
| F5-TTS | 2024 年开源 SOTA | 流匹配扩散;零样本克隆。 |
| Kokoro | CPU 英语领先者 | 82M 参数模型,Apache 2.0。 |

## 延伸阅读

- [Shen et al. (2017). Tacotron 2](https://arxiv.org/abs/1712.05884) —— seq2seq 基线。
- [Kim, Kong, Son (2021). VITS](https://arxiv.org/abs/2106.06103) —— 端到端基于流的方法。
- [Chen et al. (2024). F5-TTS](https://arxiv.org/abs/2410.06885) —— 当前开源 SOTA。
- [Kong, Kim, Bae (2020). HiFi-GAN](https://arxiv.org/abs/2010.05646) —— 到 2026 年仍在广泛部署的声码器。
- [Kokoro-82M on HuggingFace](https://huggingface.co/hexgrad/Kokoro-82M) —— 2024 年对 CPU 友好的英语 TTS。