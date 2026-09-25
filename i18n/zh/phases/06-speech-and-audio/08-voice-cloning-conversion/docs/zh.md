# 语音克隆与语音转换

> 语音克隆用别人的声音朗读你的文本。语音转换把你的声音改写成另一个人的声音，同时保留你说的内容。两者都依赖于同一个分解：将说话人身份与内容分离。

**Type:** Build
**Languages:** Python
**Prerequisites:** 阶段 6 · 06（说话人识别）、阶段 6 · 07（TTS）
**Time:** 约 75 分钟

## 问题

到 2026 年，一段 5 秒的音频片段，加上一块消费级 GPU，就足以生成任何人声音的高质量克隆。ElevenLabs、F5-TTS、OpenVoice v2、VoiceBox 都提供零样本或少样本克隆。这项技术既是福音（无障碍 TTS、配音、辅助语音），也是武器（诈骗电话、政治深伪、知识产权盗窃）。

两个密切相关的任务：

- **语音克隆（TTS 侧）：** 文本 + 5 秒参考声音 → 该声音朗读的音频。
- **语音转换（语音侧）：** 源音频（A 说的 X）+ B 的参考声音 → B 说 X 的音频。

两者都将波形分解为（内容、说话人、韵律），然后将来自一个源的内容与来自另一个源的说话人重新组合。

2026 年你需要遵守的关键约束：**在欧盟（AI Act，2026 年 8 月生效）和加利福尼亚州（AB 2905，2025 年生效），水印与同意门槛在法律上是强制的**。你的流水线必须嵌入不可闻的水印，并拒绝未经同意的克隆。

## 概念

![Voice cloning vs conversion: factorize, swap speaker, recombine](../assets/voice-cloning.svg)

**零样本克隆。** 将 5 秒的片段输入一个在数千名说话人上训练过的模型。说话人编码器将该片段映射为说话人嵌入；TTS 解码器以该嵌入加文本为条件。

使用者：F5-TTS（2024）、YourTTS（2022）、XTTS v2（2024）、OpenVoice v2（2024）。

**少样本微调。** 录制目标声音的 5–30 分钟音频。用 LoRA 微调一个基础模型一小时。质量从“尚可”跃升到“难以区分”。Coqui 和 ElevenLabs 都支持这种模式；社区在 F5-TTS 上使用它。

**语音转换（VC）。** 两大类：

- **识别-合成。** 运行类 ASR 模型提取内容表示（如软音素后验、PPG），然后用目标说话人嵌入重新合成。对语言和口音具有鲁棒性。使用者：KNN-VC（2023）、Diff-HierVC（2023）。
- **解耦。** 训练一个自编码器，在瓶颈处将内容、说话人和韵律在潜空间中分离。推理时替换说话人嵌入。质量较低但更快。使用者：AutoVC（2019）、VITS-VC 变体。

**基于神经编解码器的克隆（2024+）。** VALL-E、VALL-E 2、NaturalSpeech 3、VoiceBox——将音频视为来自 SoundStream / EnCodec 的离散 token，在编解码 token 上训练大型自回归或 flow-matching 模型。在短提示上质量可与 ElevenLabs 相媲美。

### 伦理部分，不是附加项

**水印。** PerTh（Perth）和 SilentCipher（2024）在音频中以不可感知的方式嵌入约 16–32 位 ID。可经受重编码、流式传输和常见编辑。生产级开源方案。

**同意门槛。** 每个克隆输出必须与可验证的同意记录配对。“我，Rohit，于 2026-04-22，授权该声音用于 X 用途。”存储在防篡改日志中。

**检测。** AASIST、RawNet2 和 Wav2Vec2-AASIST 可作为检测器使用。ASVspoof 2025 挑战赛显示，最先进的检测器对 ElevenLabs、VALL-E 2 和 Bark 输出的 EER 为 0.8–2.3%。

### 数据（2026）

| 模型 | 零样本？ | SECS（目标相似度） | WER（可懂度） | 参数量 |
|-------|-----------|--------------------|--------------|--------|
| F5-TTS | 是 | 0.72 | 2.1% | 335M |
| XTTS v2 | 是 | 0.65 | 3.5% | 470M |
| OpenVoice v2 | 是 | 0.70 | 2.8% | 220M |
| VALL-E 2 | 是 | 0.77 | 2.4% | 370M |
| VoiceBox | 是 | 0.78 | 2.1% | 330M |

SECS > 0.70 对大多数听者来说通常与目标难以区分。

```figure
sp-voice-factorize
```

## 动手构建

### 步骤 1：用识别-合成进行分解（main.py 中的纯代码演示）

```python
def clone_pipeline(ref_audio, text, target_embedder, tts_model):
    speaker_emb = target_embedder.encode(ref_audio)
    mel = tts_model(text, speaker=speaker_emb)
    return vocoder(mel)
```

概念上简单；实现的重头在 `tts_model` 和说话人编码器。

### 步骤 2：用 F5-TTS 进行零样本克隆

```python
from f5_tts.api import F5TTS
tts = F5TTS()
wav = tts.infer(
    ref_file="rohit_5s.wav",
    ref_text="The quick brown fox jumps over the lazy dog.",
    gen_text="Please add milk and bread to my list.",
)
```

参考文本必须与音频完全匹配；不匹配会破坏对齐。

### 步骤 3：用 KNN-VC 进行语音转换

```python
import torch
from knnvc import KNNVC  # 2023 model, https://github.com/bshall/knn-vc
vc = KNNVC.load("wavlm-base-plus")
out_wav = vc.convert(source="my_voice.wav", target_pool=["alice_1.wav", "alice_2.wav"])
```

KNN-VC 运行 WavLM 为源语音和目标池提取逐帧嵌入，然后将每个源帧替换为池中最近的邻居。非参数化方法，只需一分钟目标语音即可工作。

### 步骤 4：嵌入水印

```python
from silentcipher import SilentCipher
sc = SilentCipher(model="2024-06-01")
payload = b"consent_id:abc123;ts:1745353200"
watermarked = sc.embed(wav, sr=24000, message=payload)
detected = sc.detect(watermarked, sr=24000)   # returns payload bytes
```

约 32 位载荷，可在 MP3 重编码和轻度噪声后检测到。

### 步骤 5：同意门槛

```python
def cloned_inference(text, ref_audio, consent_record):
    assert verify_signature(consent_record), "Signed consent required"
    assert consent_record["speaker_id"] == hash_speaker(ref_audio)
    wav = tts.infer(ref_file=ref_audio, gen_text=text)
    wav = watermark(wav, payload=consent_record["id"])
    return wav
```

## 实际使用

2026 年的技术栈：

| 场景 | 选择 |
|-----------|------|
| 5 秒零样本克隆，开源 | F5-TTS 或 OpenVoice v2 |
| 商业生产级克隆 | ElevenLabs Instant Voice Clone v2.5 |
| 语音转换（改写声音） | KNN-VC 或 Diff-HierVC |
| 多说话人微调 | StyleTTS 2 + 说话人适配器 |
| 跨语言克隆 | XTTS v2 或 VALL-E X |
| 深伪检测 | Wav2Vec2-AASIST |

## 常见陷阱

- **参考文本未对齐。** F5-TTS 及类似模型要求参考文本与参考音频完全匹配，包括标点。
- **参考音频有混响。** 回声会毁掉克隆。使用近讲麦克风干声录制。
- **情绪不匹配。** 参考样本“欢快”会让所有克隆都欢快。参考情绪需与目标用途匹配。
- **语言泄漏。** 克隆英语说话人后让模型说法语，往往仍带口音；使用跨语言模型（XTTS、VALL-E X）。
- **没有水印。** 2026 年 8 月起在欧盟无法合法发布。

## 交付

保存为 `outputs/skill-voice-cloner.md`。设计一个带同意门槛 + 水印 + 质量目标的克隆或转换流水线。

## 练习

1. **简单。** 运行 `code/main.py`。通过计算替换前后两个“说话人”之间的余弦相似度，演示说话人嵌入的替换。
2. **中等。** 用 OpenVoice v2 克隆你自己的声音。测量参考与克隆之间的 SECS。用 Whisper 测量 CER。
3. **困难。** 对 20 个克隆应用 SilentCipher 水印，经过 128 kbps MP3 编码+解码后检测载荷。报告位准确率。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------------|-----------------------|
| 零样本克隆 | 5 秒就够了 | 预训练模型 + 说话人嵌入；无需训练。 |
| PPG | 音素后验图 | 逐帧 ASR 后验，用作语言无关的内容表示。 |
| KNN-VC | 最近邻转换 | 用目标池中最近的帧替换每个源帧。 |
| 神经编解码 TTS | VALL-E 风格 | 在 EnCodec/SoundStream token 上的自回归模型。 |
| 水印 | 不可闻的签名 | 嵌入音频中的比特，可经受重编码。 |
| SECS | 克隆保真度 | 目标与克隆说话人嵌入之间的余弦相似度。 |
| AASIST | 深伪检测器 | 反欺骗模型；检测合成语音。 |

## 延伸阅读

- [Chen et al. (2024). F5-TTS](https://arxiv.org/abs/2410.06885) — 开源 SOTA 零样本克隆。
- [Baevski et al. / Microsoft (2023). VALL-E](https://arxiv.org/abs/2301.02111) 与 [VALL-E 2 (2024)](https://arxiv.org/abs/2406.05370) — 神经编解码 TTS。
- [Qian et al. (2019). AutoVC](https://arxiv.org/abs/1905.05879) — 基于解耦的语音转换。
- [Baas, Waubert de Puiseau, Kamper (2023). KNN-VC](https://arxiv.org/abs/2305.18975) — 基于检索的 VC。
- [SilentCipher (2024) — Audio Watermarking](https://github.com/sony/silentcipher) — 生产级 32 位音频水印。
- [ASVspoof 2025 results](https://www.asvspoof.org/) — 检测器与合成器的军备竞赛，2026 年更新。