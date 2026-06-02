# 语音克隆与语音转换（Voice Cloning & Voice Conversion）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 语音克隆（voice cloning）让你的文本用别人的嗓音读出来。语音转换（voice conversion）则把你的音频改写成别人的嗓音，但保留你说的内容。两者都依赖同一种分解：把说话人身份和内容分开。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 6 · 06 (Speaker Recognition), Phase 6 · 07 (TTS)
**Time:** ~75 minutes

## 问题（Problem）

到 2026 年，一段 5 秒的音频片段就足以在消费级 GPU 上产出任何人嗓音的高质量克隆。ElevenLabs、F5-TTS、OpenVoice v2、VoiceBox 都已经上线 zero-shot 或 few-shot 克隆。这项技术既是福音（无障碍 TTS、配音、辅助嗓音），也是武器（诈骗电话、政治深伪、IP 盗用）。

两个紧密相关的任务：

- **语音克隆（TTS 侧）：** 文本 + 5 秒参考嗓音 → 用该嗓音说出的音频。
- **语音转换（语音侧）：** 源音频（A 说了 X）+ B 的参考嗓音 → B 说 X 的音频。

两者都把波形拆成（内容、说话人、韵律）三部分，再把一处的内容和另一处的说话人重新组合。

你 2026 年发布产品时绕不开的硬约束：**水印和同意闸门在欧盟（AI Act，2026 年 8 月起强制执行）和加州（AB 2905，2025 年生效）已是法律要求**。你的流水线必须打上不可听的水印，并拒绝未经同意的克隆。

## 概念（Concept）

![语音克隆 vs 语音转换：分解、替换说话人、重组](../assets/voice-cloning.svg)

**Zero-shot 克隆。** 把一段 5 秒片段送给一个在数千说话人上训练过的模型。说话人 encoder 把片段映射成说话人 embedding（嵌入）；TTS decoder 以该 embedding 加文本作为条件生成。

代表：F5-TTS（2024）、YourTTS（2022）、XTTS v2（2024）、OpenVoice v2（2024）。

**Few-shot 微调（fine-tune）。** 录 5–30 分钟目标嗓音，用 LoRA 微调一个基座模型一小时。质量从「凑合」跃升到「难以分辨」。Coqui 和 ElevenLabs 都支持这种范式；社区在 F5-TTS 上也是这么用。

**语音转换（VC）。** 两大流派：

- **识别 - 合成（recognition-synthesis）。** 跑一个类 ASR 模型抽取内容表示（例如软音素后验，PPG），然后用目标说话人 embedding 重新合成。对语种和口音稳健。代表：KNN-VC（2023）、Diff-HierVC（2023）。
- **解耦（disentanglement）。** 训练一个 autoencoder，在 bottleneck 的 latent（潜在）空间里把内容、说话人、韵律分开。推理时直接替换说话人 embedding。质量较低但更快。代表：AutoVC（2019）、VITS-VC 系列变体。

**基于神经 codec 的克隆（2024+）。** VALL-E、VALL-E 2、NaturalSpeech 3、VoiceBox —— 把音频视作 SoundStream / EnCodec 出来的离散 token，在 codec token 上训练一个大型 autoregressive 或 flow-matching 模型。短提示下质量与 ElevenLabs 相当。

### 伦理这一节，不是补丁而是骨架

**水印（Watermarking）。** PerTh（Perth）和 SilentCipher（2024）能在音频里不可感地嵌入 ~16-32 bit 的 ID。可在重新编码、流式传输和常见编辑中存活。已有可用于生产的开源实现。

**同意闸门（Consent gates）。** 每一份克隆输出都必须配套一份可验证的同意记录。「我，Rohit，于 2026-04-22，授权将本嗓音用于 X 用途。」存进防篡改日志。

**检测（Detection）。** AASIST、RawNet2、Wav2Vec2-AASIST 都已作为检测器发布。ASVspoof 2025 挑战赛公布的 SOTA 检测器在面对 ElevenLabs、VALL-E 2 和 Bark 输出时的 EER 为 0.8–2.3%。

### 数字（2026）

| Model | Zero-shot? | SECS (target sim) | WER (intel.) | Params |
|-------|-----------|--------------------|--------------|--------|
| F5-TTS | Yes | 0.72 | 2.1% | 335M |
| XTTS v2 | Yes | 0.65 | 3.5% | 470M |
| OpenVoice v2 | Yes | 0.70 | 2.8% | 220M |
| VALL-E 2 | Yes | 0.77 | 2.4% | 370M |
| VoiceBox | Yes | 0.78 | 2.1% | 330M |

SECS > 0.70 对大多数听众而言基本就和目标嗓音难以区分了。

## 动手实现（Build It）

### Step 1: decompose with recognition-synthesis (code-only demo in main.py)

```python
def clone_pipeline(ref_audio, text, target_embedder, tts_model):
    speaker_emb = target_embedder.encode(ref_audio)
    mel = tts_model(text, speaker=speaker_emb)
    return vocoder(mel)
```

概念上很简单；实现的体量都压在 `tts_model` 和说话人 encoder 上。

### Step 2: zero-shot clone with F5-TTS

```python
from f5_tts.api import F5TTS
tts = F5TTS()
wav = tts.infer(
    ref_file="rohit_5s.wav",
    ref_text="The quick brown fox jumps over the lazy dog.",
    gen_text="Please add milk and bread to my list.",
)
```

参考转录必须和音频完全对得上；不一致会破坏对齐。

### Step 3: voice conversion with KNN-VC

```python
import torch
from knnvc import KNNVC  # 2023 model, https://github.com/bshall/knn-vc
vc = KNNVC.load("wavlm-base-plus")
out_wav = vc.convert(source="my_voice.wav", target_pool=["alice_1.wav", "alice_2.wav"])
```

KNN-VC 用 WavLM 给源音频和目标池抽取逐帧 embedding，然后把每一源帧替换成目标池里最近邻的那一帧。非参数化，目标侧只要一分钟语音就够。

### Step 4: embed a watermark

```python
from silentcipher import SilentCipher
sc = SilentCipher(model="2024-06-01")
payload = b"consent_id:abc123;ts:1745353200"
watermarked = sc.embed(wav, sr=24000, message=payload)
detected = sc.detect(watermarked, sr=24000)   # returns payload bytes
```

~32 bit 的 payload，过 MP3 重新编码和轻度噪声后仍可检出。

### Step 5: consent gate

```python
def cloned_inference(text, ref_audio, consent_record):
    assert verify_signature(consent_record), "Signed consent required"
    assert consent_record["speaker_id"] == hash_speaker(ref_audio)
    wav = tts.infer(ref_file=ref_audio, gen_text=text)
    wav = watermark(wav, payload=consent_record["id"])
    return wav
```

## 用起来（Use It）

2026 年的技术栈：

| Situation | Pick |
|-----------|------|
| 5-sec zero-shot clone, open-source | F5-TTS or OpenVoice v2 |
| Commercial production cloning | ElevenLabs Instant Voice Clone v2.5 |
| Voice conversion (rewriting) | KNN-VC or Diff-HierVC |
| Many-speaker fine-tune | StyleTTS 2 + speaker adapter |
| Cross-lingual cloning | XTTS v2 or VALL-E X |
| Deepfake detection | Wav2Vec2-AASIST |

## 坑（Pitfalls）

- **参考转录没对齐。** F5-TTS 这类模型要求参考文本和参考音频精确一致，连标点也算。
- **参考音频带混响。** 回声会毁掉克隆。要干声、近距离麦克风录。
- **情绪错位。** 训练参考是「欢快」，那么克隆出来的所有内容都欢快。参考的情绪要和目标用途匹配。
- **语种泄漏。** 用英语说话人去克隆然后让模型说法语，往往还是带着原口音；用跨语种模型（XTTS、VALL-E X）。
- **没水印。** 2026 年 8 月起在欧盟法律上不可发货。

## 上线部署（Ship It）

存为 `outputs/skill-voice-cloner.md`。设计一条带同意闸门 + 水印 + 质量目标的克隆或转换流水线。

## 练习（Exercises）

1. **Easy.** 跑 `code/main.py`。它通过计算「说话人」替换前后两个 embedding 之间的余弦相似度，演示说话人 embedding 的替换效果。
2. **Medium.** 用 OpenVoice v2 克隆自己的嗓音。测量参考与克隆之间的 SECS。用 Whisper 测 CER。
3. **Hard.** 给 20 个克隆样本打上 SilentCipher 水印，让它们过一遍 128 kbps MP3 编解码，再检测 payload。报告 bit 准确率。

## 关键术语（Key Terms）

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Zero-shot clone | 5 seconds is enough | Pretrained model + speaker embedding; no training. |
| PPG | Phonetic posteriorgram | Per-frame ASR posteriors used as language-agnostic content rep. |
| KNN-VC | Nearest-neighbor conversion | Replace each source frame with nearest target-pool frame. |
| Neural codec TTS | VALL-E style | AR model over EnCodec/SoundStream tokens. |
| Watermark | Inaudible signature | Bits embedded in audio, survive re-encode. |
| SECS | Cloning fidelity | Cosine between target and clone speaker embeddings. |
| AASIST | Deepfake detector | Anti-spoof model; detects synthesized speech. |

## 延伸阅读（Further Reading）

- [Chen et al. (2024). F5-TTS](https://arxiv.org/abs/2410.06885) — 开源 SOTA zero-shot 克隆。
- [Baevski et al. / Microsoft (2023). VALL-E](https://arxiv.org/abs/2301.02111) 和 [VALL-E 2 (2024)](https://arxiv.org/abs/2406.05370) — 神经 codec TTS。
- [Qian et al. (2019). AutoVC](https://arxiv.org/abs/1905.05879) — 基于解耦的语音转换。
- [Baas, Waubert de Puiseau, Kamper (2023). KNN-VC](https://arxiv.org/abs/2305.18975) — 基于检索的 VC。
- [SilentCipher (2024) — Audio Watermarking](https://github.com/sony/silentcipher) — 可用于生产的 32 bit 音频水印。
- [ASVspoof 2025 results](https://www.asvspoof.org/) — 检测器 vs 合成器军备竞赛，2026 年更新。
