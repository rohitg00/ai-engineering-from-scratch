# 文本转语音（Text-to-Speech，TTS）——从 Tacotron 到 F5 和 Kokoro

> ASR 将语音转为文本；TTS 将文本转为语音。2026 年的技术栈分为三部分：文本 → 令牌、令牌 → 梅尔谱、梅尔谱 → 波形。每部分都有一个默认模型，可运行在笔记本电脑上。

**类型：** 构建  
**语言：** Python  
**前置知识：** 阶段 6 · 02（频谱图与梅尔谱）、阶段 5 · 09（序列到序列）、阶段 7 · 05（完整 Transformer）  
**时长：** ~75 分钟

## 问题

你有一个字符串："Please remind me to water the plants at 6 pm." 你需要一个 3 秒的音频片段，听起来自然、韵律正确（停顿、重音）、正确发音 "plants" 的元音，并且能在 CPU 上 300 ms 内运行，用于实时语音助手。你还需要切换语音、处理代码切换输入（"remind me at 6 pm, daijoubu?"），并且在名字上不出丑。

现代 TTS 管线如下所示：

1. **文本前端。** 规范化文本（日期、数字、电子邮件），转换为音素或子词令牌，预测韵律特征。
2. **声学模型（Acoustic Model）。** 文本 → 梅尔频谱图（Mel Spectrogram）。Tacotron 2（2017）、FastSpeech 2（2020）、VITS（2021）、F5-TTS（2024）、Kokoro（2024）。
3. **声码器（Vocoder）。** 梅尔谱 → 波形。WaveNet（2016）、WaveRNN、HiFi-GAN（2020）、BigVGAN（2022）、2024 年后的神经编解码器声码器。

到 2026 年，随着端到端扩散和流匹配模型的出现，声学模型与声码器的界限变得模糊。但三部分的心智模型对于调试仍然有效。

## 概念

![Tacotron、FastSpeech、VITS、F5/Kokoro 并排对比](../assets/tts.svg)

**Tacotron 2（2017）。** 序列到序列（Seq2Seq）：字符嵌入 → 双向 LSTM 编码器 → 位置敏感注意力 → 自回归 LSTM 解码器生成梅尔帧。速度慢（自回归），长文本不稳定。仍被引用为基线。

**FastSpeech 2（2020）。** 非自回归（Non-autoregressive）。时长预测器输出每个音素对应多少梅尔帧。单次前向，比 Tacotron 快 10 倍。牺牲了一定的自然度（单调对齐），但广泛部署。

**VITS（2021）。** 联合训练编码器 + 基于流的时长 + HiFi-GAN 声码器，端到端使用变分推理（Variational Inference）。质量高，单模型。2022–2024 年主导开源 TTS。变体：YourTTS（多说话人零样本）、XTTS v2（2024，Coqui）。

**F5-TTS（2024）。** 基于流匹配（Flow Matching）的扩散 Transformer。韵律自然，5 秒参考音频即可实现零样本语音克隆。2026 年开源 TTS 排行榜顶尖。参数规模 335M。

**Kokoro（2024）。** 小型模型（82M），可在 CPU 上运行，实时场景下英语 TTS 最佳。闭词汇表仅英文，Apache-2.0 许可。

**OpenAI TTS-1-HD、ElevenLabs v2.5、Google Chirp-3。** 商业顶尖水平。ElevenLabs v2.5 的情感标签（"[whispered]", "[laughing]"）和角色语音在 2026 年主导有声书制作。

### 声码器演进

| 时期  | 声码器 | 延迟 | 质量 |
|-------|--------|------|------|
| 2016  | WaveNet | 仅离线 | 发布时 SOTA |
| 2018  | WaveRNN | ~实时 | 良好 |
| 2020  | HiFi-GAN | 100 倍实时 | 接近人类 |
| 2022  | BigVGAN | 50 倍实时 | 跨说话人/语言泛化 |
| 2024  | SNAC、DAC（神经编解码器） | 与自回归模型集成 | 离散令牌，比特效率高 |

到 2026 年，大多数 "TTS" 模型是从文本到波形的端到端模型；梅尔频谱图只是内部表示。

### 评估

- **MOS（Mean Opinion Score，平均意见分）。** 1–5 分制，众包。仍是黄金标准；但速度极慢。
- **CMOS（Comparative MOS，比较 MOS）。** A-vs-B 偏好测试。每次标注的置信区间更窄。
- **UTMOS、DNSMOS。** 无参考神经 MOS 预测器。用于排行榜。
- **CER（Character Error Rate，字符错误率）通过 ASR 计算。** 将 TTS 输出通过 Whisper 识别，计算与输入文本的 CER。作为可懂度的代理。
- **SECS（Speaker Embedding Cosine Similarity，说话人嵌入余弦相似度）。** 语音克隆质量。

2026 年在 LibriTTS test-clean 上的数据：

| 模型 | UTMOS | CER（通过 Whisper） | 参数规模 |
|-------|-------|-------------------|------|
| 真实音频 | 4.08 | 1.2% | — |
| F5-TTS | 3.95 | 2.1% | 335M |
| XTTS v2 | 3.81 | 3.5% | 470M |
| VITS | 3.62 | 3.1% | 25M |
| Kokoro v0.19 | 3.87 | 1.8% | 82M |
| Parler-TTS Large | 3.76 | 2.8% | 2.3B |

## 构建

### 步骤 1：音素化输入

```python
from phonemizer import phonemize
ph = phonemize("Hello world", language="en-us", backend="espeak")
# 'həloʊ wɜːld'
```

音素是通用桥梁。避免将原始文本直接喂入任何低于 VITS 质量水平的模型。

### 步骤 2：运行 Kokoro（2026 年 CPU 默认选择）

```python
from kokoro import KPipeline
tts = KPipeline(lang_code="a")  # "a" = 美式英语
audio, sr = tts("Please remind me to water the plants at 6 pm.", voice="af_bella")
# audio: float32 张量, sr=24000
```

离线运行，单个文件，82M 参数。

### 步骤 3：使用语音克隆运行 F5-TTS

```python
from f5_tts.api import F5TTS
tts = F5TTS()
wav = tts.infer(
    ref_file="my_voice_5s.wav",
    ref_text="The quick brown fox jumps over the lazy dog.",
    gen_text="Please remind me to water the plants.",
)
```

传入 5 秒参考片段及其转录文本；F5 克隆韵律和音色。

### 步骤 4：从头实现 HiFi-GAN 声码器

代码量太大无法放入教程脚本，但结构如下：

```python
class HiFiGAN(nn.Module):
    def __init__(self, mel_channels=80, upsample_rates=[8, 8, 2, 2]):
        super().__init__()
        # 4 个上采样块，总共 256 倍，从梅尔率到音频率
        ...
    def forward(self, mel):
        return self.blocks(mel)  # -> 波形
```

训练：对抗训练（判别器在短窗口上） + 梅尔频谱图重建损失 + 特征匹配损失。已商品化 —— 使用 `hifi-gan` 仓库或 nvidia-NeMo 的预训练检查点。

### 步骤 5：完整管线（伪代码）

```python
text = "Please remind me at 6 pm."
phones = phonemize(text)
mel = acoustic_model(phones, speaker=alice)      # [T, 80]
wav = vocoder(mel)                                # [T * 256]
soundfile.write("out.wav", wav, 24000)
```

## 使用

2026 年的选择：

| 场景 | 选择 |
|------|------|
| 实时英语语音助手 | Kokoro（CPU）或 XTTS v2（GPU） |
| 5 秒参考语音克隆 | F5-TTS |
| 商业角色语音 | ElevenLabs v2.5 |
| 有声书旁白 | ElevenLabs v2.5 或 XTTS v2 + 微调 |
| 低资源语言 | 在 5–20 小时目标语言数据上训练 VITS |
| 富有表现力 / 情感标签 | ElevenLabs v2.5 或 StyleTTS 2 微调 |

截至 2026 年的开源领导者：**F5-TTS 在质量上领先，Kokoro 在效率上领先**。除非你是历史学家，否则不要使用 Tacotron。

## 陷阱

- **缺少文本规范化器。** "Dr. Smith" 读成 "Doctor" 还是 "Drive"？#28 "2026"读成 "twenty twenty-six or two zero two-six ? Normalize BEFORE phonemizer.Normalize? #   
 实际上 ManyNormalizer #29 may help you to understand the formula better
- **OOV 专有名词。** "Ghumare“  读成 "ghyu-mairi透過? UtilizeUni-normalizer to avoid confusion between languages etc. # 'ghyu-mairi orp]129in
# API: overall MOSLMRstralyke-Xout捆包 in the pipelineSample of the model -osh-V Wait - login ’felt word (ReceiveT -3starsia TiNaN but Landsopp:U |24 hAudd