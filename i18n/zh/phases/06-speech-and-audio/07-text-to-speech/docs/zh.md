# 文字与语音 (TTS)  从塔科特朗到F5和科科罗

> 亚斯尔将语音转换为文字;TTS将文字转换为语音.2026堆由三个部分组成:文字 →代币,代币 → mel,mel →波形.每个部分都有一个默认模型,可以适合笔记本电脑.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 02 (Spectrograms & Mel), Phase 5 · 09 (Seq2Seq), Phase 7 · 05 (Full Transformer)
**Time:** ~75 minutes

## 问题

你有一个字符串:"请提醒我在晚上6点点点灌植物".你需要一个自然听起来的3秒钟音频剪辑,有正确的音声 (暂停,压力),用正确的音符发音"植物",并在CPU上运行在300ms以下,即即可使用直播语音助理.你还需要交换声音,处理代码交换输入 ("提醒我在晚上6点,大约布?"),而不要在名字上尬.

现代的TTS管道看起来像这样:

1. **Text frontend.**规范文本 (日期,数字,电子邮件),转换为音符或字幕标记,预测 prosody 功能.
2. **Acoustic model.**文字 → 梅尔谱图.塔科特龙2 (2017),快速讲话2 (2020),VITS (2021),F5-TTS (2024),科科罗 (2024).
3. **Vocoder.**波形:波网 (2016),波RNN,高清高清高清高清高清高清高清高清高清高清高清高清高清高清高清高清高清高清高清高清高清高清高清高清高清高清高清高清高清高清高清高清高清高清高清高清高清高清高清高清高清高清高清高清高清高清高清高清高清高清高清高清高清高清高清高清高清高清高清高清高清高清高清高清高清高清高清高清高清高清高清高清高清高清高清高清高清高清高清高清高清高清高清高清高清高清高清高清高清高清高清高清高清高清高清高清高清高清高清高清高清高清高清高清高清高清高清高清高清高清高清高清高清高清高清高清高清高清中高清高清高清中高清高清中高清高清中高清中高清中高清中高清中高清中高清中高清中高清中高清中高清中高清中高清中

2026年,音声+声码器的分离模糊,并与端到端的扩散和流量匹配模型相匹配.

## 概念

![Tacotron, FastSpeech, VITS, F5/Kokoro side-by-side](../assets/tts.svg)

**Tacotron 2 (2017).**序列2次:嵌入式 → BiLSTM编码器 →位置敏感注意 → 自动降低式LSTM解码器发射 mel 框架.慢 (AR),在长文中摇摆.仍然被引用为基线.

**FastSpeech 2 (2020).**无自行降低. 时间预测器输出每个音符的 mel 框架. 1 通过,比塔科特龙快10倍. 失去一些自然性 (单调的排列),但在任何地方都出发.

**VITS (2021).**联合训练编码器+基于流程的持续时间+高清高清高清高清单机型.主导的开源TTS 20222024.变体:YourTTS (多音箱零射击),XTTS v2 (2024,Coqui).

**F5-TTS (2024).**传输变压器与流量匹配.自然的声,零射击语音克隆, 5 秒的参考音频. 2026 年开源TTS 排名榜首. 335 亿参数.

**Kokoro (2024).**简单的英语语,只能使用闭口语库,Apache-2.0.

**OpenAI TTS-1-HD, ElevenLabs v2.5, Google Chirp-3.**商业技术状态.ElevenLabs v2.5情感标签 ("[低声]", "[笑]") 和角色声音在2026年占据了音频书制作的主导地位.

### 声码器的进化

| Era | Vocoder | Latency | Quality |
|-----|---------|---------|---------|
| 2016 | WaveNet | offline only | SOTA at release |
| 2018 | WaveRNN | ~realtime | good |
| 2020 | HiFi-GAN | 100× realtime | near-human |
| 2022 | BigVGAN | 50× realtime | generalizes across speakers/langs |
| 2024 | SNAC, DAC (neural codecs) | integrated with AR models | discrete tokens, bit-efficient |

到2026年,大多数"TTS"模型将从文本到波形的端到端;MEL谱系是一个内部表示.

### 评估

- **MOS (Mean Opinion Score).**现在,我在上,我在上,我在上.
- **CMOS (Comparative MOS).**对于每一个注释,更紧密的信任间隔.
- **UTMOS, DNSMOS.**没有参考的神经MOS预测器,用于排名表.
- **CER (Character Error Rate) via ASR.**通过Whisper运行TTS输出,计算CER与输入文本.
- **SECS (Speaker Embedding Cosine Similarity).**语音克隆质量.

2026年 LibriTTS试验清洁号码:

| Model | UTMOS | CER (via Whisper) | Size |
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

## 建立它

### 步骤1:调音输入

```python
from phonemizer import phonemize
ph = phonemize("Hello world", language="en-us", backend="espeak")
# 'həloʊ wɜːld'
```

避免给任何低于VITS水平的质量的原始文本.

### 步骤2:运行Kokoro (2026 CPU默认)

```python
from kokoro import KPipeline
tts = KPipeline(lang_code="a")  # "a" = American English
audio, sr = tts("Please remind me to water the plants at 6 pm.", voice="af_bella")
# audio: float32 tensor, sr=24000
```

运行离线,单个文件,82M参数.

### 步骤3:使用语音克隆运行F5-TTS

```python
from f5_tts.api import F5TTS
tts = F5TTS()
wav = tts.infer(
    ref_file="my_voice_5s.wav",
    ref_text="The quick brown fox jumps over the lazy dog.",
    gen_text="Please remind me to water the plants.",
)
```

通过5秒的参考片段+其转录;F5克隆了 prosody 和 timbre.

### 步骤4:从零开始的 HiFi-GAN 声码器

太大了,不能适合教程脚本,但形状是:

```python
class HiFiGAN(nn.Module):
    def __init__(self, mel_channels=80, upsample_rates=[8, 8, 2, 2]):
        super().__init__()
        # 4 upsample blocks, total 256x to go from mel-rate to audio-rate
        ...
    def forward(self, mel):
        return self.blocks(mel)  # -> waveform
```

培训:对抗性 (短窗上的歧视) + 黑色谱重建损失 + 功能匹配损失.`hifi-gan`投资者或NVIDIA-NeMo.

### 步骤5:全管道 (伪代码)

```python
text = "Please remind me at 6 pm."
phones = phonemize(text)
mel = acoustic_model(phones, speaker=alice)      # [T, 80]
wav = vocoder(mel)                                # [T * 256]
soundfile.write("out.wav", wav, 24000)
```

## 用它

现在,我们要做什么?

| Situation | Pick |
|-----------|------|
| Real-time English voice assistant | Kokoro (CPU) or XTTS v2 (GPU) |
| Voice cloning from 5 s reference | F5-TTS |
| Commercial character voices | ElevenLabs v2.5 |
| Audiobook narration | ElevenLabs v2.5 or XTTS v2 + fine-tune |
| Low-resource language | Train VITS on 5–20 h target-lang data |
| Expressive / emotion tags | ElevenLabs v2.5 or StyleTTS 2 fine-tune |

开源领导者到2026年: **F5-TTS for quality, Kokoro for efficiency**除非你是历史学家,就不要寻找塔科特朗.

## 陷

- **No text normalizer.**"史密斯博士"是"医生"或"驱动"? "2026"是"二十六"或"两零两六"?
- **OOV proper nouns.**运送一个反弹图形到音形模型,用于未知的代币.
- **Clipping.**声器输出很少剪辑,但在推断时的MEL尺度不匹配可以超越 ±1.0.`np.clip(wav, -1, 1)`现在,我们要去.
- **Sample-rate mismatch.**科科罗输出24kHz;下游管道预计16kHz →重新样本或获得号.

## 运送它

保存如`outputs/skill-tts-designer.md`设计一个针对特定语音,延迟和语言目标的TTS管道.

## 运动

1. **Easy.**跑步`code/main.py`根据玩具词汇,构建一个音符词典,估计每音符的持续时间,
2. **Medium.**安装Kokoro,在语音上合成同一个句子`af_bella`其他`am_adam`进行对比.
3. **Hard.**记录一个5秒的参考片,使用F5-TTS克隆它,报告SECS在参考和克隆输出之间.

## 关键词

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Phoneme | Sound unit | Abstract sound class; 39 in English (ARPABet). |
| Duration predictor | How long each phoneme lasts | Non-AR model output; integer frames per phoneme. |
| Vocoder | Mel → waveform | Neural net mapping mel-spec to raw samples. |
| HiFi-GAN | Standard vocoder | GAN-based; dominant 2020–2024. |
| MOS | Subjective quality | 1–5 mean opinion score from human raters. |
| SECS | Voice-clone metric | Cosine similarity between target and output speaker embedding. |
| F5-TTS | 2024 open-source SOTA | Flow-matching diffusion; zero-shot cloning. |
| Kokoro | CPU English leader | 82M-param model, Apache 2.0. |

## 进一步阅读

- [Shen et al. (2017). Tacotron 2](https://arxiv.org/abs/1712.05884) 后续后续的基线.
- [Kim, Kong, Son (2021). VITS](https://arxiv.org/abs/2106.06103)基于端到端流动.
- [Chen et al. (2024). F5-TTS](https://arxiv.org/abs/2410.06885)目前的开源SOTA.
- [Kong, Kim, Bae (2020). HiFi-GAN](https://arxiv.org/abs/2010.05646) Vocoder,仍然在2026年发射.
- [Kokoro-82M on HuggingFace](https://huggingface.co/hexgrad/Kokoro-82M) 2024 年的英语TTS,适用于 CPU.
