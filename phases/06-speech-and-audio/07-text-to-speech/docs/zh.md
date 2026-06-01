# 07 · 文本转语音（TTS）——从 Tacotron 到 F5 与 Kokoro

> 「自动语音识别（ASR）」把语音逆向转为文本；「文本转语音（TTS）」则把文本逆向转为语音。2026 年的技术栈分三部分：文本 → token，token → mel，mel → 波形。每一部分都有一个能塞进笔记本电脑运行的默认模型。

**类型：** 实践构建
**语言：** Python
**前置：** 第 6 阶段 · 02（频谱图与梅尔频谱）、第 5 阶段 · 09（Seq2Seq）、第 7 阶段 · 05（完整 Transformer）
**时长：** 约 75 分钟

## 问题所在

你有一个字符串："Please remind me to water the plants at 6 pm."。你需要生成一段 3 秒的音频，听起来要自然、要有正确的「韵律（prosody）」（停顿、重音），把 "plants" 读成正确的元音，并且为了支持实时语音助手，要在 CPU 上以低于 300 毫秒的时延运行。你还需要能切换声音、处理「混码（code-switched）」输入（"remind me at 6 pm, daijoubu?"），并且不能在念人名时出洋相。

现代 TTS 流水线长这样：

1. **文本前端（text frontend）。** 对文本做规范化（日期、数字、邮箱），转换为「音素（phoneme）」或子词 token，并预测韵律特征。
2. **声学模型（acoustic model）。** 文本 → mel 频谱图。Tacotron 2（2017）、FastSpeech 2（2020）、VITS（2021）、F5-TTS（2024）、Kokoro（2024）。
3. **声码器（vocoder）。** mel → 波形。WaveNet（2016）、WaveRNN、HiFi-GAN（2020）、BigVGAN（2022），以及 2024 年之后的神经编解码声码器。

到 2026 年，随着端到端「扩散（diffusion）」与「流匹配（flow-matching）」模型的出现，声学模型与声码器之间的分界变得模糊。但用于调试时，三段式的心智模型依然成立。

## 核心概念

〔图：Tacotron、FastSpeech、VITS、F5/Kokoro 架构并排对比〕

**Tacotron 2（2017）。** Seq2seq 架构：字符嵌入 → BiLSTM 编码器 → 位置敏感注意力 → 自回归 LSTM 解码器逐帧产出 mel。速度慢（自回归），在长文本上不稳定。如今仍常被当作基线引用。

**FastSpeech 2（2020）。** 非自回归。「时长预测器（duration predictor）」输出每个音素分配多少个 mel 帧。单趟推理，比 Tacotron 快 10 倍。损失了一些自然度（单调对齐），但落地无处不在。

**VITS（2021）。** 用「变分推断（variational inference）」端到端联合训练编码器 + 基于流的时长模型 + HiFi-GAN 声码器。质量高，单一模型搞定。2022–2024 年开源 TTS 的统治者。变体有：YourTTS（多说话人零样本）、XTTS v2（2024，Coqui）。

**F5-TTS（2024）。** 在流匹配之上构建的「扩散 Transformer（diffusion transformer）」。韵律自然，仅凭 5 秒参考音频即可零样本「克隆声音（voice cloning）」。在 2026 年开源 TTS 排行榜中名列前茅。335M 参数。

**Kokoro（2024）。** 体积小（82M），可在 CPU 上运行，是实时场景下同类最佳的英语 TTS。封闭词表、仅支持英语，apache-2.0 许可。

**OpenAI TTS-1-HD、ElevenLabs v2.5、Google Chirp-3。** 商业领域的顶尖水平。ElevenLabs v2.5 的情绪标签（"[whispered]"、"[laughing]"）和角色音色在 2026 年主导着有声书制作。

### 声码器的演进

| 时代 | 声码器 | 时延 | 质量 |
|-----|---------|---------|---------|
| 2016 | WaveNet | 仅离线 | 发布时的 SOTA |
| 2018 | WaveRNN | ~实时 | 良好 |
| 2020 | HiFi-GAN | 100× 实时 | 接近真人 |
| 2022 | BigVGAN | 50× 实时 | 跨说话人/语言泛化 |
| 2024 | SNAC、DAC（神经编解码器） | 与自回归模型集成 | 离散 token，比特效率高 |

到 2026 年，大多数「TTS」模型都是从文本到波形的端到端模型；mel 频谱图只是一个内部表示。

### 评估

- **MOS（平均意见得分，Mean Opinion Score）。** 1–5 分制，众包评分。仍是黄金标准；但慢得令人痛苦。
- **CMOS（对比平均意见得分，Comparative MOS）。** A 对 B 的偏好评分。每次标注的置信区间更窄。
- **UTMOS、DNSMOS。** 无参考的神经 MOS 预测器。用于排行榜。
- **CER（字符错误率，Character Error Rate），经由 ASR 计算。** 把 TTS 输出送入 Whisper，再对照输入文本计算 CER。可理解度的代理指标。
- **SECS（说话人嵌入余弦相似度，Speaker Embedding Cosine Similarity）。** 衡量声音克隆质量。

2026 年在 LibriTTS test-clean 上的数据：

| 模型 | UTMOS | CER（经由 Whisper） | 大小 |
|-------|-------|-------------------|------|
| Ground truth | 4.08 | 1.2% | — |
| F5-TTS | 3.95 | 2.1% | 335M |
| XTTS v2 | 3.81 | 3.5% | 470M |
| VITS | 3.62 | 3.1% | 25M |
| Kokoro v0.19 | 3.87 | 1.8% | 82M |
| Parler-TTS Large | 3.76 | 2.8% | 2.3B |

## 动手构建

### 第 1 步：对输入做音素化

```python
from phonemizer import phonemize
ph = phonemize("Hello world", language="en-us", backend="espeak")
# 'həloʊ wɜːld'
```

音素是通用的桥梁。不要把原始文本直接喂给任何质量低于 VITS 级别的模型。

### 第 2 步：运行 Kokoro（2026 年的 CPU 默认选择）

```python
from kokoro import KPipeline
tts = KPipeline(lang_code="a")  # "a" = 美式英语
audio, sr = tts("Please remind me to water the plants at 6 pm.", voice="af_bella")
# audio: float32 张量, sr=24000
```

离线运行，单文件，82M 参数。

### 第 3 步：运行带声音克隆的 F5-TTS

```python
from f5_tts.api import F5TTS
tts = F5TTS()
wav = tts.infer(
    ref_file="my_voice_5s.wav",
    ref_text="The quick brown fox jumps over the lazy dog.",
    gen_text="Please remind me to water the plants.",
)
```

传入一段 5 秒的参考片段及其转录文本；F5 会克隆其韵律与音色。

### 第 4 步：从零实现 HiFi-GAN 声码器

完整代码太大，塞不进教程脚本，但其结构大致如下：

```python
class HiFiGAN(nn.Module):
    def __init__(self, mel_channels=80, upsample_rates=[8, 8, 2, 2]):
        super().__init__()
        # 4 个上采样块，总共 256 倍，从 mel 速率提升到音频速率
        ...
    def forward(self, mel):
        return self.blocks(mel)  # -> 波形
```

训练：对抗损失（在短窗口上的判别器）+ mel 频谱图重建损失 + 特征匹配损失。该技术已商品化——直接使用 `hifi-gan` 仓库或 nvidia-NeMo 提供的预训练检查点。

### 第 5 步：完整流水线（伪代码）

```python
text = "Please remind me at 6 pm."
phones = phonemize(text)
mel = acoustic_model(phones, speaker=alice)      # [T, 80]
wav = vocoder(mel)                                # [T * 256]
soundfile.write("out.wav", wav, 24000)
```

## 实际使用

2026 年的技术栈：

| 场景 | 选择 |
|-----------|------|
| 实时英语语音助手 | Kokoro（CPU）或 XTTS v2（GPU） |
| 仅凭 5 秒参考做声音克隆 | F5-TTS |
| 商业角色音色 | ElevenLabs v2.5 |
| 有声书旁白 | ElevenLabs v2.5，或 XTTS v2 + 微调 |
| 低资源语言 | 用 5–20 小时目标语数据训练 VITS |
| 富表现力 / 情绪标签 | ElevenLabs v2.5，或 StyleTTS 2 微调 |

截至 2026 年的开源领先者：**质量看 F5-TTS，效率看 Kokoro**。除非你是个历史考据者，否则别去碰 Tacotron。

## 常见陷阱

- **缺少文本规范化器。** "Dr. Smith" 是念成 "Doctor" 还是 "Drive"？"2026" 是念 "twenty twenty six" 还是 "two zero two six"？要在音素化之前就完成规范化。
- **未登录（OOV）专有名词。** "Ghumare" → "ghyu-mair"？为未知 token 准备一个兜底的「字素到音素（grapheme-to-phoneme）」模型。
- **削顶（clipping）。** 声码器输出很少削顶，但推理时 mel 缩放不匹配可能会越过 ±1.0。务必执行 `np.clip(wav, -1, 1)`。
- **采样率不匹配。** Kokoro 输出 24 kHz；如果你的下游流水线期望 16 kHz，则需重采样，否则会产生混叠。

## 交付成果

保存为 `outputs/skill-tts-designer.md`。针对给定的声音、时延和语言目标，设计一条 TTS 流水线。

## 练习

1. **简单。** 运行 `code/main.py`。它会从一个玩具词表构建音素字典，估算每个音素的时长，并打印一份假的 "mel" 时间表。
2. **中等。** 安装 Kokoro，用 `af_bella` 和 `am_adam` 两种声音合成同一个句子。对比音频时长与主观质量。
3. **困难。** 录制一段你自己的 5 秒参考片段。用 F5-TTS 克隆它。报告参考与克隆输出之间的 SECS。

## 关键术语

| 术语 | 人们怎么说 | 它实际指什么 |
|------|-----------------|-----------------------|
| Phoneme（音素） | 声音单元 | 抽象的声音类别；英语中有 39 个（ARPABet）。 |
| Duration predictor（时长预测器） | 每个音素持续多久 | 非自回归模型的输出；每个音素对应的整数帧数。 |
| Vocoder（声码器） | mel → 波形 | 将 mel 频谱图映射为原始采样点的神经网络。 |
| HiFi-GAN | 标准声码器 | 基于 GAN；2020–2024 年的主流。 |
| MOS | 主观质量 | 来自人类评分者的 1–5 平均意见得分。 |
| SECS | 声音克隆指标 | 目标与输出说话人嵌入之间的余弦相似度。 |
| F5-TTS | 2024 开源 SOTA | 流匹配扩散；零样本克隆。 |
| Kokoro | CPU 英语领跑者 | 82M 参数模型，Apache 2.0。 |

## 延伸阅读

- [Shen et al. (2017). Tacotron 2](https://arxiv.org/abs/1712.05884) —— seq2seq 基线。
- [Kim, Kong, Son (2021). VITS](https://arxiv.org/abs/2106.06103) —— 端到端、基于流。
- [Chen et al. (2024). F5-TTS](https://arxiv.org/abs/2410.06885) —— 当前开源 SOTA。
- [Kong, Kim, Bae (2020). HiFi-GAN](https://arxiv.org/abs/2010.05646) —— 那个到 2026 年仍在落地的声码器。
- [Kokoro-82M on HuggingFace](https://huggingface.co/hexgrad/Kokoro-82M) —— 2024 年对 CPU 友好的英语 TTS。
