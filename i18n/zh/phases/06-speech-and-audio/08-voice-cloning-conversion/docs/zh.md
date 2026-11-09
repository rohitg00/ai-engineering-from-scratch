# 语音克隆和语音转换

> 语音克隆读取你的文字在别人的声音中.语音转换将你的声音重写成别人的声音,同时保留了你所说的.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 06 (Speaker Recognition), Phase 6 · 07 (TTS)
**Time:** ~75 minutes

## 问题

2026年,一个5秒音频剪辑足以使用消费者GPU制作高质量的任何人的声音克隆.ElevenLabs,F5-TTS,OpenVoice v2,VoiceBox都提供零射击或少数射击克隆.该技术是一种祝福 (可访问性TTS,翻译,辅助声音) 和武器 (诈骗呼叫,政治深假,IP盗窃).

两个紧密相关的任务:

- **Voice cloning (TTS-side):**文字+5秒的参考语音 →在这个语音中的音频.
- **Voice conversion (speech-side):**源音频 (人 A 说 X) +人 B 的参考声音 → B 说 X 的音频.

两者都将波形 (内容,扬声器,声) 纳入一个形式,并将来自一个来源的内容重新组合到另一个来源的扬声器.

现在你在2026年将面临的关键限制:**watermarking and consent gates are legally required in the EU (AI Act, enforceable August 2026) and in California (AB 2905, effective 2025)**你的管道必须发出无声水印,拒绝非同意的克隆.

## 概念

![Voice cloning vs conversion: factorize, swap speaker, recombine](../assets/voice-cloning.svg)

**Zero-shot cloning.**传递一个5秒钟的剪辑到一个已经在数千个扬声器上训练的模型.扬声器编码器将剪辑映射到一个嵌入式扬声器;TTS解码器在嵌入式加上文本上设置条件.

已使用:F5-TTS (2024),YourTTS (2022),XTTS v2 (2024),OpenVoice v2 (2024).

**Few-shot fine-tuning.**记录目标声音的5-30分钟.LoRA-细调一个基本模型一个小时.质量从"好"跳到"不可分辨".科基和ElevenLabs都支持这种模式;社区使用它与F5-TTS.

**Voice conversion (VC).**两个家庭:

- **Recognition-synthesis.**运行ASR类似模型以提取内容表示 (例如软音响后面,PPG),然后再合成目标扬声器嵌入. 强有力的语言和口音. KNN-VC (2023),Diff-HierVC (2023).
- **Disentanglement.**训练一个自动编码器,在瓶中隐藏空间中分开内容,扬声器和声器.在推理时内嵌的音箱交换.质量较低但更快.由 AutoVC (2019) 应用,VITS-VC变体.

**Neural codec-based cloning (2024+).**视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视频视

### 伦理问题,不是一个子

**Watermarking.**珀斯 (珀斯) 和SilentCipher (2024) 嵌入了~16-32位ID无形地在音频中. 存活了重新编码,流媒体和常见编辑. 准备生产的开源.

**Consent gates.**必须将所有被克隆的输出与可验证的同意记录结合起来. "我,罗希特,在2026-04-22日,授权这个声音X目的.

**Detection.**美国ASIST,RawNet2和Wav2Vec2-AASIST作为探测器. ASVspoof 2025挑战发布了对ElevenLabs,VALL-E2和Bark输出的最先进探测器的0.82.3%的EER.

### 统计数 (2026)

| Model | Zero-shot? | SECS (target sim) | WER (intel.) | Params |
|-------|-----------|--------------------|--------------|--------|
| F5-TTS | Yes | 0.72 | 2.1% | 335M |
| XTTS v2 | Yes | 0.65 | 3.5% | 470M |
| OpenVoice v2 | Yes | 0.70 | 2.8% | 220M |
| VALL-E 2 | Yes | 0.77 | 2.4% | 370M |
| VoiceBox | Yes | 0.78 | 2.1% | 330M |

对于大多数听众来说,SECS > 0.70通常无法与目标区分.

```figure
sp-voice-factorize
```

## 建立它

### 步骤1:与识别合成分解 (仅在 main.py 中进行代码演示)

```python
def clone_pipeline(ref_audio, text, target_embedder, tts_model):
    speaker_emb = target_embedder.encode(ref_audio)
    mel = tts_model(text, speaker=speaker_emb)
    return vocoder(mel)
```

概念简单; 实施量为`tts_model`它们是"音器"的编码器.

### 步骤2:F5-TTS的零射击克隆

```python
from f5_tts.api import F5TTS
tts = F5TTS()
wav = tts.infer(
    ref_file="rohit_5s.wav",
    ref_text="The quick brown fox jumps over the lazy dog.",
    gen_text="Please add milk and bread to my list.",
)
```

引用文本必须与音频完全匹配;不匹配打断了对齐.

### 步骤3:使用 KNN-VC 进行语音转换

```python
import torch
from knnvc import KNNVC  # 2023 model, https://github.com/bshall/knn-vc
vc = KNNVC.load("wavlm-base-plus")
out_wav = vc.convert(source="my_voice.wav", target_pool=["alice_1.wav", "alice_2.wav"])
```

KNN-VC运行WavLM以提取源和目标池的每个框架嵌入,然后将每个源框架替换成池中的最近邻居.非参数,使用一个分钟的目标语音.

### 步骤 4:嵌入一个水印

```python
from silentcipher import SilentCipher
sc = SilentCipher(model="2024-06-01")
payload = b"consent_id:abc123;ts:1745353200"
watermarked = sc.embed(wav, sr=24000, message=payload)
detected = sc.detect(watermarked, sr=24000)   # returns payload bytes
```

通过MP3重新编码和轻噪声可检测到的32位的有效载荷.

### 步骤5:同意门

```python
def cloned_inference(text, ref_audio, consent_record):
    assert verify_signature(consent_record), "Signed consent required"
    assert consent_record["speaker_id"] == hash_speaker(ref_audio)
    wav = tts.infer(ref_file=ref_audio, gen_text=text)
    wav = watermark(wav, payload=consent_record["id"])
    return wav
```

## 用它

现在,我们要做什么?

| Situation | Pick |
|-----------|------|
| 5-sec zero-shot clone, open-source | F5-TTS or OpenVoice v2 |
| Commercial production cloning | ElevenLabs Instant Voice Clone v2.5 |
| Voice conversion (rewriting) | KNN-VC or Diff-HierVC |
| Many-speaker fine-tune | StyleTTS 2 + speaker adapter |
| Cross-lingual cloning | XTTS v2 or VALL-E X |
| Deepfake detection | Wav2Vec2-AASIST |

## 陷

- **Misaligned reference transcript.**要求引用文本与引用音频精确一致,包括分分.
- **Reverberant reference.**声声杀了克隆,记录干燥,近距离麦克风.
- **Emotional mismatch.**训练参考"欢乐"产生欢乐的克隆, 匹配参考情感与目标使用.
- **Language leakage.**克隆一个英语发音者,然后要求模型说法语,通常都带着口音;使用跨语言模型 (XTTS,VALL-E X).
- **No watermark.**从2026年8月起,在欧盟合法不可出货.

## 运送它

保存如`outputs/skill-voice-cloner.md`设计一个具有同意门+水标+质量目标的克隆或转换管道.

## 运动

1. **Easy.**跑步`code/main.py`通过计算两个"扬声器"之间的前后和后的代价,证明了扬声器嵌入式交换.
2. **Medium.**通过OpenVoice v2来克隆自己的声音. 测量引用和克隆之间的SECS. 测量通过声的 CER.
3. **Hard.**应用SilentCipher水标到20个克隆,运行它们通过128 kbps MP3编码+解码,检测有效载荷.报告位准确性.

## 关键词

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Zero-shot clone | 5 seconds is enough | Pretrained model + speaker embedding; no training. |
| PPG | Phonetic posteriorgram | Per-frame ASR posteriors used as language-agnostic content rep. |
| KNN-VC | Nearest-neighbor conversion | Replace each source frame with nearest target-pool frame. |
| Neural codec TTS | VALL-E style | AR model over EnCodec/SoundStream tokens. |
| Watermark | Inaudible signature | Bits embedded in audio, survive re-encode. |
| SECS | Cloning fidelity | Cosine between target and clone speaker embeddings. |
| AASIST | Deepfake detector | Anti-spoof model; detects synthesized speech. |

## 进一步阅读

- [Chen et al. (2024). F5-TTS](https://arxiv.org/abs/2410.06885)开源SOTA零射击克隆.
- [Baevski et al. / Microsoft (2023). VALL-E](https://arxiv.org/abs/2301.02111)其他[VALL-E 2 (2024)](https://arxiv.org/abs/2406.05370)神经编码器TTS.
- [Qian et al. (2019). AutoVC](https://arxiv.org/abs/1905.05879)基于解脱的语音转换.
- [Baas, Waubert de Puiseau, Kamper (2023). KNN-VC](https://arxiv.org/abs/2305.18975)基于检索的风险投资.
- [SilentCipher (2024) — Audio Watermarking](https://github.com/sony/silentcipher) 已准备生产的32位音频水标.
- [ASVspoof 2025 results](https://www.asvspoof.org/)检测器与合成器武器竞赛,更新于2026年.
