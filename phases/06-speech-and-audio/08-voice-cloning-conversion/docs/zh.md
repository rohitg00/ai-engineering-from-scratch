# 08 · 声音克隆与语音转换

> 声音克隆让别人的声音读出你的文字。语音转换则在保留你所说内容的前提下，把你的声音改写成另一个人的声音。两者都依赖同一种分解思路：把说话人身份与内容分离开。

**类型：** 构建
**语言：** Python
**前置：** 阶段 6 · 06（说话人识别）、阶段 6 · 07（TTS）
**时长：** 约 75 分钟

## 问题所在

到了 2026 年，一段 5 秒的音频片段，配合一块消费级 GPU，就足以生成任何人声音的高质量克隆。ElevenLabs、F5-TTS、OpenVoice v2、VoiceBox 都提供了「零样本（zero-shot）」或「少样本（few-shot）」克隆能力。这项技术既是福音（无障碍 TTS、配音、辅助发声），也是武器（诈骗电话、政治深度伪造、知识产权盗用）。

两个密切相关的任务：

- **声音克隆（TTS 侧）：** 文本 + 5 秒参考声音 → 用该声音生成的音频。
- **语音转换（speech 侧）：** 源音频（A 说出 X）+ B 的参考声音 → B 说出 X 的音频。

两者都把波形分解为（内容、说话人、韵律），再把来自某一来源的内容与来自另一来源的说话人重新组合。

你如今在 2026 年交付时必须遵守的关键约束：**水印（watermarking）与同意门控（consent gates）在欧盟（《AI 法案》，2026 年 8 月起强制执行）和加利福尼亚州（AB 2905，2025 年生效）已是法律强制要求**。你的管线必须嵌入不可听的水印，并拒绝未经同意的克隆。

## 核心概念

〔图：声音克隆与语音转换：分解、替换说话人、重新组合〕

**零样本克隆。** 把一段 5 秒的片段传给一个在数千名说话人上训练过的模型。「说话人编码器（speaker encoder）」把该片段映射为「说话人嵌入（speaker embedding）」；TTS 解码器以该嵌入加文本为条件进行生成。

采用者：F5-TTS（2024）、YourTTS（2022）、XTTS v2（2024）、OpenVoice v2（2024）。

**少样本微调。** 录制 5–30 分钟的目标声音，用 LoRA 对一个基础模型微调一小时。质量会从「凑合」跃升到「难以分辨」。Coqui 与 ElevenLabs 都支持这种模式；社区会将其与 F5-TTS 配合使用。

**语音转换（VC）。** 两大流派：

- **识别-合成（recognition-synthesis）。** 运行一个类 ASR 的模型来提取内容表示（例如「软音素后验（soft phoneme posteriors）」、「音素后验图（PPGs）」），再用目标说话人嵌入重新合成。对语言和口音都很稳健。采用者：KNN-VC（2023）、Diff-HierVC（2023）。
- **解耦（disentanglement）。** 训练一个自编码器，在「瓶颈（bottleneck）」处的潜空间中分离内容、说话人与韵律。推理时替换说话人嵌入。质量较低但速度更快。采用者：AutoVC（2019）、VITS-VC 变体。

**基于神经编解码器的克隆（2024+）。** VALL-E、VALL-E 2、NaturalSpeech 3、VoiceBox —— 把音频视为来自 SoundStream / EnCodec 的离散 token，在这些编解码器 token 之上训练一个大型自回归或流匹配（flow-matching）模型。在短提示上质量可与 ElevenLabs 媲美。

### 伦理这一块，不是附加件

**水印。** PerTh（Perth）和 SilentCipher（2024）能把约 16–32 比特的 ID 不可感知地嵌入音频中，可在重新编码、流式传输和常见编辑后存活。已有可用于生产的开源实现。

**同意门控。** 每一份克隆输出都必须配套一条可验证的同意记录。「我，Rohit，于 2026-04-22，授权将此声音用于 X 用途。」存入防篡改日志。

**检测。** AASIST、RawNet2 和 Wav2Vec2-AASIST 都已作为检测器发布。ASVspoof 2025 挑战赛公布的数据显示，最先进的检测器在面对 ElevenLabs、VALL-E 2 和 Bark 的输出时，「等错误率（EER）」为 0.8%–2.3%。

### 数字（2026）

| 模型 | 零样本？ | SECS（目标相似度） | WER（可懂度） | 参数量 |
|-------|-----------|--------------------|--------------|--------|
| F5-TTS | 是 | 0.72 | 2.1% | 335M |
| XTTS v2 | 是 | 0.65 | 3.5% | 470M |
| OpenVoice v2 | 是 | 0.70 | 2.8% | 220M |
| VALL-E 2 | 是 | 0.77 | 2.4% | 370M |
| VoiceBox | 是 | 0.78 | 2.1% | 330M |

对大多数听者而言，SECS > 0.70 通常已与目标声音难以分辨。

## 动手构建

### 第 1 步：用识别-合成进行分解（main.py 中的纯代码演示）

```python
def clone_pipeline(ref_audio, text, target_embedder, tts_model):
    speaker_emb = target_embedder.encode(ref_audio)
    mel = tts_model(text, speaker=speaker_emb)
    return vocoder(mel)
```

概念上很简单；实现的重量都在 `tts_model` 和说话人编码器里。

### 第 2 步：用 F5-TTS 做零样本克隆

```python
from f5_tts.api import F5TTS
tts = F5TTS()
wav = tts.infer(
    ref_file="rohit_5s.wav",
    ref_text="The quick brown fox jumps over the lazy dog.",
    gen_text="Please add milk and bread to my list.",
)
```

参考文本必须与音频完全一致；不匹配会破坏对齐。

### 第 3 步：用 KNN-VC 做语音转换

```python
import torch
from knnvc import KNNVC  # 2023 年的模型，https://github.com/bshall/knn-vc
vc = KNNVC.load("wavlm-base-plus")
out_wav = vc.convert(source="my_voice.wav", target_pool=["alice_1.wav", "alice_2.wav"])
```

KNN-VC 运行 WavLM 来为源和目标池提取逐帧嵌入，然后用目标池中最近邻的帧替换每一个源帧。非参数化方法，用一分钟的目标语音即可工作。

### 第 4 步：嵌入水印

```python
from silentcipher import SilentCipher
sc = SilentCipher(model="2024-06-01")
payload = b"consent_id:abc123;ts:1745353200"
watermarked = sc.embed(wav, sr=24000, message=payload)
detected = sc.detect(watermarked, sr=24000)   # 返回 payload 字节
```

约 32 比特的 payload，在 MP3 重新编码和轻微噪声之后仍可被检测出来。

### 第 5 步：同意门控

```python
def cloned_inference(text, ref_audio, consent_record):
    assert verify_signature(consent_record), "Signed consent required"
    assert consent_record["speaker_id"] == hash_speaker(ref_audio)
    wav = tts.infer(ref_file=ref_audio, gen_text=text)
    wav = watermark(wav, payload=consent_record["id"])
    return wav
```

## 实战运用

2026 年的技术栈：

| 场景 | 选择 |
|-----------|------|
| 5 秒零样本克隆、开源 | F5-TTS 或 OpenVoice v2 |
| 商业级生产克隆 | ElevenLabs Instant Voice Clone v2.5 |
| 语音转换（改写） | KNN-VC 或 Diff-HierVC |
| 多说话人微调 | StyleTTS 2 + 说话人适配器 |
| 跨语言克隆 | XTTS v2 或 VALL-E X |
| 深度伪造检测 | Wav2Vec2-AASIST |

## 常见陷阱

- **参考文本未对齐。** F5-TTS 及类似模型要求参考文本与参考音频完全一致，包括标点。
- **带混响的参考。** 回声会毁掉克隆效果。请在干声、近麦条件下录制。
- **情绪不匹配。** 训练参考是「欢快」的，就会把一切都克隆成欢快的。让参考情绪与目标用途相匹配。
- **语言泄漏。** 克隆一个英语说话人后再要求模型说法语，往往仍会带上原有口音；请使用跨语言模型（XTTS、VALL-E X）。
- **没有水印。** 自 2026 年 8 月起在欧盟法律上不可交付。

## 交付产物

保存为 `outputs/skill-voice-cloner.md`。设计一条带有同意门控 + 水印 + 质量目标的克隆或转换管线。

## 练习

1. **简单。** 运行 `code/main.py`。它通过计算替换前后两个「说话人」之间的余弦相似度，演示说话人嵌入的替换。
2. **中等。** 用 OpenVoice v2 克隆你自己的声音。测量参考与克隆之间的 SECS。通过 Whisper 测量 CER。
3. **困难。** 对 20 份克隆应用 SilentCipher 水印，让它们经过 128 kbps 的 MP3 编码+解码，再检测 payload。报告比特准确率。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------------|-----------------------|
| 零样本克隆（Zero-shot clone） | 5 秒就够了 | 预训练模型 + 说话人嵌入；无需训练。 |
| PPG | 音素后验图 | 逐帧 ASR 后验，用作与语言无关的内容表示。 |
| KNN-VC | 最近邻转换 | 用最近的目标池帧替换每个源帧。 |
| 神经编解码器 TTS（Neural codec TTS） | VALL-E 风格 | 在 EnCodec/SoundStream token 上的自回归模型。 |
| 水印（Watermark） | 不可听的签名 | 嵌入音频中的比特，可在重新编码后存活。 |
| SECS | 克隆保真度 | 目标与克隆说话人嵌入之间的余弦相似度。 |
| AASIST | 深度伪造检测器 | 反欺骗模型；检测合成语音。 |

## 延伸阅读

- [Chen et al.（2024）. F5-TTS](https://arxiv.org/abs/2410.06885) —— 开源的 SOTA 零样本克隆。
- [Baevski et al. / Microsoft（2023）. VALL-E](https://arxiv.org/abs/2301.02111) 与 [VALL-E 2（2024）](https://arxiv.org/abs/2406.05370) —— 神经编解码器 TTS。
- [Qian et al.（2019）. AutoVC](https://arxiv.org/abs/1905.05879) —— 基于解耦的语音转换。
- [Baas, Waubert de Puiseau, Kamper（2023）. KNN-VC](https://arxiv.org/abs/2305.18975) —— 基于检索的 VC。
- [SilentCipher（2024）—— 音频水印](https://github.com/sony/silentcipher) —— 可用于生产的 32 比特音频水印。
- [ASVspoof 2025 结果](https://www.asvspoof.org/) —— 检测器与合成器的军备竞赛，2026 年更新。
