# 语音克隆与语音转换

> 语音克隆是用他人的声音朗读你的文本。语音转换是将你的声音改写成他人的声音，同时保留你所说的内容。两者都依赖于同一个基本原理：将说话者身份与内容分离。

**类型：** 构建
**语言：** Python
**前置知识：** 第六阶段·第06课（说话人识别），第六阶段·第07课（文本转语音）
**时间：** 约75分钟

## 问题所在

到了2026年，一段5秒的音频片段就足以用消费级GPU高质量克隆任何人的声音。ElevenLabs、F5-TTS、OpenVoice v2、VoiceBox 都提供了零样本或少样本克隆功能。这项技术既是福音（无障碍TTS、配音、辅助声音），也是武器（诈骗电话、政治深度伪造、知识产权窃取）。

两个密切相关的任务：

- **语音克隆（TTS侧）：** 文本 + 5秒参考语音 → 以该语音生成的音频。
- **语音转换（语音侧）：** 源音频（人A说X）+ 人B的参考语音 → 人B说X的音频。

两者都将波形分解为（内容、说话者、韵律），然后将一个源的内容与另一个源的说话者重新组合。

你在2026年面临的关键限制：**水印和同意门控在法律上是欧盟（《人工智能法案》，2026年8月生效）和加利福尼亚州（AB 2905，2025年生效）要求的**。你的管线必须输出不可听的水印，并拒绝未经同意的克隆。

## 概念

![语音克隆与转换：分解、交换说话者、重新组合](../assets/voice-cloning.svg)

**零样本克隆（Zero-shot cloning）。** 将一段5秒的片段输入到一个经过数千说话者训练的模型。说话人编码器将片段映射为说话人嵌入（Speaker Embedding）；TTS解码器在该嵌入加上文本的条件下生成音频。

使用该技术的模型：F5-TTS（2024）、YourTTS（2022）、XTTS v2（2024）、OpenVoice v2（2024）。

**少样本微调（Few-shot fine-tuning）。** 录制5-30分钟的目标语音。对基础模型进行一小时的LoRA微调。质量从“还行”跃升至“无法区分”。Coqui和ElevenLabs都支持这种模式；社区也将其用于F5-TTS。

**语音转换（Voice Conversion，VC）。** 两个家族：

- **识别-合成（Recognition-synthesis）。** 运行类似ASR的模型提取内容表示（如软音素后验概率，PPG），然后用目标说话人嵌入重新合成。对语言和口音鲁棒。用于KNN-VC（2023）、Diff-HierVC（2023）。
- **解耦（Disentanglement）。** 训练一个自编码器，在瓶颈处的潜空间中分离内容、说话者和韵律。推理时交换说话人嵌入。质量较低但速度更快。用于AutoVC（2019）、VITS-VC变体。

**基于神经编解码器的克隆（2024+）。** VALL-E、VALL-E 2、NaturalSpeech 3、VoiceBox——将音频视为来自SoundStream/EnCodec的离散令牌，在编解码器令牌上训练大型自回归或流匹配模型。在短提示上质量与ElevenLabs相当。

### 伦理部分，而非附加组件

**水印（Watermarking）。** PerTh和SilentCipher（2024）在音频中不可察觉地嵌入大约16-32比特的ID。能抵抗重新编码、流媒体传输和常见编辑。生产级开源方案。

**同意门控（Consent gates）。** 必须将每个克隆输出与可验证的同意记录配对。“我，Rohit，于2026-04-22日，授权此声音用于X目的。”存储在防篡改日志中。

**检测（Detection）。** AASIST、RawNet2和Wav2Vec2-AASIST作为检测器使用。ASVspoof 2025挑战赛公布，最先进的检测器对ElevenLabs、VALL-E 2和Bark输出的等错误率（EER）为0.8–2.3%。

### 数据（2026年）

| 模型 | 零样本？ | SECS（目标相似度） | WER（可懂度） | 参数量 |
|-------|-----------|--------------------|--------------|--------|
| F5-TTS | 是 | 0.72 | 2.1% | 335M |
| XTTS v2 | 是 | 0.65 | 3.5% | 470M |
| OpenVoice v2 | 是 | 0.70 | 2.8% | 220M |
| VALL-E 2 | 是 | 0.77 | 2.4% | 370M |
| VoiceBox | 是 | 0.78 | 2.1% | 330M |

SECS > 0.70 对于大多数听众来说通常无法与目标区分。

## 构建它

### 步骤1：用识别-合成进行分解（仅代码演示，在 main.py 中）

```python
def clone_pipeline(ref_audio, text, target_embedder, tts_model):
    speaker_emb = target_embedder.encode(ref_audio)
    mel = tts_model(text, speaker=speaker_emb)
    return vocoder(mel)
```

概念上很简单；实现工作量主要在 `tts_model` 和说话人编码器上。

### 步骤2：用F5-TTS进行零样本克隆

```python
from f5_tts.api import F5TTS
tts = F5TTS()
wav = tts.infer(
    ref_file="rohit_5s.wav",
    ref_text="The quick brown fox jumps over the lazy dog.",
    gen_text="Please add milk and bread to my list.",
)
```

参考转录必须与音频完全匹配；不匹配会破坏对齐。

### 步骤3：用KNN-VC进行语音转换

```python
import torch
from knnvc import KNNVC  # 2023 model, https://github.com/bshall/knn-vc
vc = KNNVC.load("wavlm-base-plus")
out_wav = vc.convert(source="my_voice.wav", target_pool=["alice_1.wav", "alice_2.wav"])
```

KNN-VC运行WavLM提取源和目标池的逐帧嵌入，然后将每个源帧替换为其在池中的最近邻。非参数化，只需目标语音一分钟即可工作。

### 步骤4：嵌入水印

```python
from silentcipher import SilentCipher
sc = SilentCipher(model="2024-06-01")
payload = b"consent_id:abc123;ts:1745353200"
watermarked = sc.embed(wav, sr=24000, message=payload)
detected = sc.detect(watermarked, sr=24000)   # returns payload bytes
```

约32比特的有效载荷，能在MP3重新编码和轻度噪声后检测出来。

### 步骤5：同意门控

```python
def cloned_inference(text, ref_audio, consent_record):
    assert verify_signature(consent_record), "需要签名同意"
    assert consent_record["speaker_id"] == hash_speaker(ref_audio)
    wav = tts.infer(ref_file=ref_audio, gen_text=text)
    wav = watermark(wav, payload=consent_record["id"])
    return wav
```

## 使用它

2026年的技术栈：

| 情景 | 选择 |
|-----------|------|
| 5秒零样本克隆，开源 | F5-TTS 或 OpenVoice v2 |
| 商业生产克隆 | ElevenLabs Instant Voice Clone v2.5 |
| 语音转换（改写） | KNN-VC 或 Diff-HierVC |
| 多说话者微调 | StyleTTS 2 + 说话人适配器 |
| 跨语言克隆 | XTTS v2 或 VALL-E X |
| 深度伪造检测 | Wav2Vec2-AASIST |

## 陷阱

- **参考转录不对齐。** F5-TTS及类似模型要求参考文本与参考音频精确匹配，包括标点符号。
- **混响参考。** 回声会破坏克隆。录制时需干声、近麦克风。
- **情感不匹配。** 训练参考“欢快”会导致所有克隆都欢快。使参考情感与目标用途匹配。
- **语言泄漏。** 克隆英语说话者后要求模型说法语，通常仍带英语口音；应使用跨语言模型（XTTS、VALL-E X）。
- **无水印。** 从2026年8月起，在欧盟法律上无法发布。

## 发布它

保存为 `outputs/skill-voice-cloner.md`。设计一个包含同意门控 + 水印 + 质量目标的克隆或转换管线。

## 练习

1. **简单。** 运行 `code/main.py`。通过计算两个“说话者”在交换前后的余弦相似度，演示说话人嵌入的交换。
2. **中等。** 使用OpenVoice v2克隆你自己的声音。测量参考与克隆之间的SECS。通过Whisper测量CER。
3. **困难。** 对20个克隆应用SilentCipher水印，通过128 kbps MP3编码+解码后检测有效载荷。报告比特准确率。

## 关键术语

| 术语 | 通常说法 | 实际含义 |
|------|---------|---------|
| 零样本克隆 | 5秒就够了 | 预训练模型 + 说话人嵌入；无需训练。 |
| PPG | 音素后验概率图 | 逐帧ASR后验，用作语言无关的内容表示。 |
| KNN-VC | 最近邻转换 | 将每个源帧替换为目标池中的最近邻帧。 |
| 神经编解码器TTS | VALL-E风格 | 在EnCodec/SoundStream令牌上的自回归模型。 |
| 水印 | 不可听签名 | 嵌入在音频中的比特，能抵抗重新编码。 |
| SECS | 克隆保真度 | 目标与克隆的说话人嵌入之间的余弦相似度。 |
| AASIST | 深度伪造检测器 | 反欺骗模型，检测合成语音。 |

## 延伸阅读

- [Chen等人（2024）。F5-TTS](https://arxiv.org/abs/2410.06885) — 开源SOTA零样本克隆。
- [Baevski等人/微软（2023）。VALL-E](https://arxiv.org/abs/2301.02111) 和 [VALL-E 2 (2024)](https://arxiv.org/abs/2406.05370) — 神经编解码器TTS。
- [Qian等人（2019）。AutoVC](https://arxiv.org/abs/1905.05879) — 基于解耦的语音转换。
- [Baas, Waubert de Puiseau, Kamper (2023)。KNN-VC](https://arxiv.org/abs/2305.18975) — 基于检索的VC。
- [SilentCipher (2024) — 音频水印](https://github.com/sony/silentcipher) — 生产级32比特音频水印。
- [ASVspoof 2025结果](https://www.asvspoof.org/) — 检测器与合成器的军备竞赛，2026年更新。