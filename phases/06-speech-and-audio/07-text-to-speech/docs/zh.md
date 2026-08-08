# 文本转语音（TTC）-从Tacotron到F5和Kokoro

> ASB将语音转换为文本; TTC将文本转换为语音。2026年堆栈由三部分组成：文本、令牌、mel、mel、wel。每个部件都有一个适合笔记本电脑的默认型号。

** 类型：** 构建
** 语言：** Python
** 先决条件：** 阶段6 · 02（Spectrograms & Mel）、阶段5 · 09（Seq 2Seq）、阶段7 · 05（全Transformer）
** 时间：** ~75分钟

## 问题

你有一串：“请提醒我下午6点给植物浇水。“您需要一个3秒的音频片段，听起来自然，具有正确的韵律（停顿、重读），用正确的元音发音‘plants’，并且在实时语音助手的中央处理器上运行时间低于300 ms。您还需要交换语音，处理代码交换输入（“下午6点提醒我，dajðu？”），不要在名字上让自己难堪。

现代TTS管道看起来像这样：

1. ** 文本前端。**规范文本（日期、数字、电子邮件）、转换为音素或子词标记、预测韵律特征。
2. ** 声学模型。**文本-梅尔光谱图。Tacotron 2（2017）、FastSpeech 2（2020）、VITS（2021）、F5-TTC（2024）、Kokoro（2024）。
3. ** 声码器。**梅尔-波浪。WaveNet（2016）、WaveRNN、HiFi-GAN（2020）、BigVGAN（2022）、2024年以上的神经编解码器声码器。

2026年，声学+声码器利用端到端扩散和流匹配模型分割模糊。但三个部分的心理模型仍然适用于调试。

## 概念

![Tacotron, FastSpeech, VITS, F5/Kokoro side-by-side](../assets/tts.svg)

**Tacotron 2（2017）。** Seq 2 seq：字符嵌入| BiLSTM编码器|位置敏感注意力|自回归LSTM解码器发射梅尔帧。慢（AR），长文本不稳定。仍被引用为基线。

**FastSpeech 2（2020）.**非自回归。持续时间预测器输出每个音素得到多少mel帧。1次通过，比Tacotron快10倍。失去了一些自然性（单调对齐），但到处都是船。

**VITS（2021）。**联合训练编码器+基于流的持续时间+ HiFi-GAN声码器，具有变分推理。高品质，单一型号。占主导地位的开源TTC 2022-2024。变体：YourTTC（多扬声器零发射）、XTTC v2（2024，Coqui）。

**F5-TTC（2024）。**扩散Transformer器流匹配。自然韵律、零镜头语音克隆，具有5秒的参考音频。2026年开源TTC排行榜榜首。335 M参数。

** 科科罗（2024年）。**小巧（82 M）、CPU可运行、一流的英语TTS，可实时使用。封闭式词汇表，仅限英语，apache-2.0。

**OpenAI https-1-HD，ElevenLabs v2.5，Google Chirp-3。**商业最先进。ElevenLabs v2.5情感标签（“[低声]”、“[笑]”）和角色声音主导2026年有声读物制作。

### 声码器演进

| 时代 | 声码 | 延迟 | 质量 |
|-----|---------|---------|---------|
| 2016 | WaveNet | 仅限离线 | SOTA发布时 |
| 2018 | WaveRNN | ~实时 | 好 |
| 2020 | 高保真GAN | 100×实时 | 接近人类 |
| 2022 | BigVGAN | 50倍实时 | 在扬声器/长耳中推广 |
| 2024 | SNAC、ADC（神经编解码器） | 集成AR模型 | 离散代币，位高效 |

到2026年，大多数“TTC”模型都是从文本到波浪的端到端的;梅尔频谱图是一种内部表示。

### 评价

- **MOS（平均意见分数）。** 1-5规模、众包。仍然是金本位;缓慢得令人痛苦。
- ** MOS（比较型MOS）。** A-vs-B偏好。每个注释的置信区间更紧。
- **UTMOS、DNSMOS。**无参考神经MOS预测器。用于排行榜。
- ** 通过ASB获得的BER（字符错误率）。**通过Whisper运行TTC输出，根据输入文本计算BER。可理解性代理。
- ** SCES（扬声器嵌入Cosine相似性）。**语音克隆质量。

LibriTTC测试干净的2026年数字：

| 模型 | UTMOS | BER（通过Whisper） | 大小 |
|-------|-------|-------------------|------|
| 地面实况 | 4.08 | 1.2% | - |
| F5-TTC | 3.95 | 2.1% | 335M |
| XTTC v2 | 3.81 | 3.5% | 470M |
| VITS | 3.62 | 3.1% | 25M |
| 科科罗v0.19 | 3.87 | 1.8% | 82M |
| Parler-TTC大号 | 3.76 | 2.8% | 2.3B |

## 建设党

### 第一步：音素化输入

```python
from phonemizer import phonemize
ph = phonemize("Hello world", language="en-us", backend="espeak")
# 'həloʊ wɜːld'
```

音素是通用的桥梁。避免将原始文本提供给低于VITS级别质量的任何内容。

### 第2步：运行Kokoro（2026年默认处理器）

```python
from kokoro import KPipeline
tts = KPipeline(lang_code="a")  # "a" = American English
audio, sr = tts("Please remind me to water the plants at 6 pm.", voice="af_bella")
# audio: float32 tensor, sr=24000
```

离线，单文件，82M参数。

### 第3步：通过语音克隆运行F5-TTC

```python
from f5_tts.api import F5TTS
tts = F5TTS()
wav = tts.infer(
    ref_file="my_voice_5s.wav",
    ref_text="The quick brown fox jumps over the lazy dog.",
    gen_text="Please remind me to water the plants.",
)
```

传递5秒参考剪辑+其文字记录; F5克隆韵律和音色。

### 第4步：从头开始HiFi-GAN声码器

太大了，无法容纳教程脚本，但形状是：

```python
class HiFiGAN(nn.Module):
    def __init__(self, mel_channels=80, upsample_rates=[8, 8, 2, 2]):
        super().__init__()
        # 4 upsample blocks, total 256x to go from mel-rate to audio-rate
        ...
    def forward(self, mel):
        return self.blocks(mel)  # -> waveform
```

训练：对抗性（短窗口上）+梅尔频谱图重建损失+特征匹配损失。商品化-使用来自'hifi-gan' repo或nvidia-NeMo的预训练检查点。

### 第5步：完整管道（伪代码）

```python
text = "Please remind me at 6 pm."
phones = phonemize(text)
mel = acoustic_model(phones, speaker=alice)      # [T, 80]
wav = vocoder(mel)                                # [T * 256]
soundfile.write("out.wav", wav, 24000)
```

## 使用它

2026年堆栈：

| 情况 | 接 |
|-----------|------|
| 实时英语语音助手 | Kokoro（CPU）或XTTS v2（GPU） |
| 来自5 s参考的语音克隆 | F5-TTC |
| 商业人物声音 | ElevenLabs v2.5 |
| 有声读物旁白 | ElevenLabs v2.5或XTTC v2 +微调 |
| 低资源语言 | 根据5-20小时目标数据训练VITS |
| 表达/情感标签 | ElevenLabs v2.5或StyleTTC 2微调 |

截至2026年的开源领导者：**F5-TTC代表质量，Kokoro代表效率 **。除非您是一名历史学家，否则不要伸手去拿塔科特隆。

## 陷阱

- ** 没有文本规范器。**“史密斯博士”读作“博士”还是“Drive”？“2026”是“2026年”还是“二零零二六”？在音素发生器之前规范化。
- **OOV专有名词。**“古马雷”-“ghyu-mair”？为未知令牌提供后备字形到音素模型。
- ** 剪辑。**声码器输出很少剪辑，但推断时的梅尔缩放不匹配可能超过±1.0。始终' mp.clip（wav，-1，1）'。
- ** 样本率不匹配。** Kokoro输出24 GHz;您的下游管道预计为16 GHz;重新采样或出现混叠。

## 把它运

另存为“输出/skill-tts-designer.md”。为给定的语音、延迟和语言目标设计一个TTC管道。

## 演习

1. ** 简单。**运行'代码/main.py '。从玩具词汇构建音素词典，估计每个音素的持续时间，并打印假的“mel”时间表。
2. ** 中等。**安装Kokoro，在语音“af_bella”和“am_adam”中合成相同的句子。比较音频持续时间和主观质量。
3. ** 很难。**录制自己的5秒参考片段。使用F5-TTC克隆它。报告引用和克隆输出之间的SCES。

## 关键术语

| Term | 别人怎么说 | 它实际上意味着什么 |
|------|-----------------|-----------------------|
| 音素 | 声音单元 | 抽象声音类;英语39（ARPABet）。 |
| 持续时间预测器 | 每个音素持续多长时间 | 非AR模型输出;每个音素的整帧。 |
| 声码 | 梅尔·波 | 将mel-spec映射到原始样本的神经网络。 |
| 高保真GAN | 标准声码器 | 基于GAN; 2020-2024年占主导地位。 |
| MOS | 主观质量 | 1-5人类评分者的平均意见评分。 |
| SECS | 语音克隆指标 | 目标和输出扬声器嵌入之间的Cosine相似性。 |
| F5-TTC | 2024年开源SOTA | 流动匹配扩散;零射克隆。 |
| Kokoro | 中央处理器英语负责人 | 82 M-param模型，Apache 2.0。 |

## 进一步阅读

- [Shen等人（2017）。Tacotron 2]（https：//arxiv.org/abs/1712.05884）-seq 2seq基线。
- [Kim，Kong，Son（2021）。VITS]（https：//arxiv.org/ins/2106.06103）-端到端基于流的。
- [Chen等人（2024）。F5-TTC]（https：//arxiv.org/abs/2410.06885）-当前开源SOTA。
- [Kong、Kim，Bae（2020）。HiFi-GAN]（https：//arxiv.org/ab/2010.05646）-仍将于2026年发货的声码器。
- [Kokoro-82 M on HuggingFace]（https：//huggingface.co/hexgrad/Kokoro-82M）- 2024 CPU友好的英语TTS。
