# 聲音仿製（voice cloning）與聲音轉換（voice conversion）

> 聲音仿製用別人的聲音念你的文字。聲音轉換把你的聲音改成別人的，你說的內容留著。兩者都靠同一個分解：把說話人身分和內容分開。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 6 · 06 (Speaker Recognition), Phase 6 · 07 (TTS)
**Time:** ~75 minutes

## The Problem｜問題

2026 年，5 秒音訊就夠用消費級 GPU 高品質仿製任何人的聲音。ElevenLabs、F5-TTS、OpenVoice v2、VoiceBox 都交付零樣本（zero-shot）或少樣本仿製。這項技術是恩惠（無障礙 TTS、配音、輔助聲音），也是武器（詐騙電話、政治深偽、智慧財產竊取）。

兩個緊鄰的任務：

- **聲音仿製（TTS 這一側）。** 文字加 5 秒參考聲音，得到那個聲音的音訊。
- **聲音轉換（語音這一側）。** 來源音訊（A 說 X）加 B 的參考聲音，得到 B 說 X 的音訊。

兩者都把波形分解成（內容、說話人、韻律），再用一邊的內容配另一邊的說話人。

2026 年你交付時的硬限制：**浮水印和同意閘在歐盟（AI Act，2026 年 8 月起可執行）和加州（AB 2905，2025 年生效）是法律要求**。你的管線（pipeline）必須打上聽不到的浮水印，並拒絕沒有同意的仿製。

## The Concept｜核心概念

![Voice cloning vs conversion: factorize, swap speaker, recombine](../assets/voice-cloning.svg)

**零樣本仿製。** 把 5 秒片段交給一個在數千位說話人上訓練過的模型。說話人編碼器把片段映成說話人 embedding。TTS 解碼器的條件是那個 embedding 加上文字。

在用的有：F5-TTS（2024）、YourTTS（2022）、XTTS v2（2024）、OpenVoice v2（2024）。

**少樣本 fine-tuning。** 錄目標聲音 5 到 30 分鐘。用 LoRA fine-tune 一個基模型，大約一小時。品質從「還可以」跳到「分不出來」。Coqui 和 ElevenLabs 都支援這個模式。社群把它用在 F5-TTS 上。

**聲音轉換（VC）。** 兩個家族：

- **辨識再合成。** 跑類似 ASR 的模型，抽出內容表示（例如軟音素後驗、PPG），再用目標說話人 embedding 重新合成。不易受語言和口音影響。KNN-VC（2023）、Diff-HierVC（2023）用這個。
- **解開。** 訓練一個自編碼器（autoencoder），在瓶頸的潛在空間（latent space）把內容、說話人、韻律分開。推論時把說話人 embedding 換掉。品質較低，但比較快。AutoVC（2019）、VITS-VC 變體用這個。

**以神經編解碼器（neural codec）為基礎的仿製（2024 年之後）。** VALL-E、VALL-E 2、NaturalSpeech 3、VoiceBox 把音訊當成 SoundStream／EnCodec 的離散 token，在編解碼器 token 上訓練大型自迴歸或流匹配模型。短 prompt 的品質可媲美 ElevenLabs。

### 倫理不是事後補上的

**浮水印。** PerTh（Perth）和 SilentCipher（2024）把大約 16 到 32 位元的 ID 聽不出來地寫進音訊。重編碼、串流、常見編輯之後還在。正式環境能用的開放原始碼。

**同意閘。** 每一份仿製輸出都必須配一份可驗證的同意紀錄（consent record）。「我，Rohit，在 2026-04-22，授權這個聲音用於 X 目的。」記錄在可偵測竄改的日誌中。

**偵測。** AASIST、RawNet2、Wav2Vec2-AASIST 當偵測器交付。ASVspoof 2025 挑戰賽公布，面對 ElevenLabs、VALL-E 2、Bark 的輸出，目前最好的偵測器 EER 是 0.8% 到 2.3%。

### 數字（2026）

| 模型 | 零樣本？ | SECS（和目標的相似度） | WER（可懂度） | 參數 |
|-------|-----------|--------------------|--------------|--------|
| F5-TTS | 是 | 0.72 | 2.1% | 3.35 億 |
| XTTS v2 | 是 | 0.65 | 3.5% | 4.7 億 |
| OpenVoice v2 | 是 | 0.70 | 2.8% | 2.2 億 |
| VALL-E 2 | 是 | 0.77 | 2.4% | 3.7 億 |
| VoiceBox | 是 | 0.78 | 2.1% | 3.3 億 |

SECS 大於 0.70，對大多數聽者來說和目標分不出來。

```figure
sp-voice-factorize
```

## Build It｜動手實作

### 步驟 1：用辨識再合成來分解（main.py 裡只有程式示範）

```python
def clone_pipeline(ref_audio, text, target_embedder, tts_model):
    speaker_emb = target_embedder.encode(ref_audio)
    mel = tts_model(text, speaker=speaker_emb)
    return vocoder(mel)
```

概念上簡單。實作的份量在 `tts_model` 和說話人編碼器。

### 步驟 2：用 F5-TTS 做零樣本仿製

```python
from f5_tts.api import F5TTS
tts = F5TTS()
wav = tts.infer(
    ref_file="rohit_5s.wav",
    ref_text="The quick brown fox jumps over the lazy dog.",
    gen_text="Please add milk and bread to my list.",
)
```

參考逐字稿必須和音訊完全一致。對不上就會破壞對齊。

### 步驟 3：用 KNN-VC 做聲音轉換

```python
import torch
from knnvc import KNNVC  # 2023 model, https://github.com/bshall/knn-vc
vc = KNNVC.load("wavlm-base-plus")
out_wav = vc.convert(source="my_voice.wav", target_pool=["alice_1.wav", "alice_2.wav"])
```

KNN-VC 用 WavLM 抽出來源和目標池每一框的 embedding，再把每一個來源框換成池裡的最近鄰。非參數。一分鐘的目標語音就行。

### 步驟 4：打上浮水印

```python
from silentcipher import SilentCipher
sc = SilentCipher(model="2024-06-01")
payload = b"consent_id:abc123;ts:1745353200"
watermarked = sc.embed(wav, sr=24000, message=payload)
detected = sc.detect(watermarked, sr=24000)   # returns payload bytes
```

大約 32 位元的承載資料。MP3 重編碼和輕雜訊之後仍偵測得到。

### 步驟 5：同意閘

```python
def cloned_inference(text, ref_audio, consent_record):
    assert verify_signature(consent_record), "Signed consent required"
    assert consent_record["speaker_id"] == hash_speaker(ref_audio)
    wav = tts.infer(ref_file=ref_audio, gen_text=text)
    wav = watermark(wav, payload=consent_record["id"])
    return wav
```

## Use It｜實際應用

2026 年的堆疊：

| 情況 | 挑 |
|-----------|------|
| 5 秒零樣本仿製、開放原始碼 | F5-TTS 或 OpenVoice v2 |
| 商業正式環境的仿製 | ElevenLabs Instant Voice Clone v2.5 |
| 聲音轉換（改寫） | KNN-VC 或 Diff-HierVC |
| 多說話人 fine-tune | StyleTTS 2 加說話人轉接器 |
| 跨語言仿製 | XTTS v2 或 VALL-E X |
| 深偽偵測 | Wav2Vec2-AASIST |

## Pitfalls｜容易踩的坑

- **參考逐字稿沒對齊。** F5-TTS 和類似模型要求參考文字和參考音訊完全一致，標點也要。
- **參考有殘響。** 回音會讓仿製失敗。錄乾的、麥克風靠近。
- **情緒不合。** 訓練參考是「開心」，出來的一切都開心。參考情緒要對上目標用途。
- **語言洩漏。** 仿製英文說話人再叫模型說法文，口音常常還在。用跨語言模型（XTTS、VALL-E X）。
- **沒有浮水印。** 2026 年 8 月起在歐盟法律上不能交付。

## Ship It｜交付成果

存成 `outputs/skill-voice-cloner.md`。設計一條仿製或轉換管線，含同意閘、浮水印和品質目標。

## Exercises｜練習

1. **簡單。** 跑 `code/main.py`。它用兩個「說話人」在交換前後的餘弦，示範說話人 embedding 的交換。
2. **中等。** 用 OpenVoice v2 仿製你自己的聲音。量參考和仿製之間的 SECS。用 Whisper 量 CER。
3. **困難。** 對 20 份仿製打上 SilentCipher 浮水印，跑 128 kbps 的 MP3 編碼再解碼，偵測承載資料。回報位元準確率。

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|-----------------|-----------------------|
| 零樣本仿製 | 5 秒就夠 | 預訓練模型加說話人 embedding。不用再訓練。 |
| PPG | 音素後驗圖 | 每一框的 ASR 後驗，當與語言無關的內容表示。 |
| KNN-VC | 最近鄰轉換 | 把每一個來源框換成目標池裡最近的框。 |
| 神經編解碼器 TTS | VALL-E 風格 | 在 EnCodec／SoundStream token 上的自迴歸模型。 |
| 浮水印 | 聽不到的簽名 | 寫進音訊的位元，重編碼之後還在。 |
| SECS | 仿製的保真 | 目標和仿製說話人 embedding 之間的餘弦。 |
| AASIST | 深偽偵測器 | 反仿冒模型。偵測合成語音。 |

## Further Reading｜延伸閱讀

- [Chen et al. (2024). F5-TTS](https://arxiv.org/abs/2410.06885) ——開放原始碼、目前最好的零樣本仿製。
- [Baevski et al. / Microsoft (2023). VALL-E](https://arxiv.org/abs/2301.02111) 和 [VALL-E 2 (2024)](https://arxiv.org/abs/2406.05370) ——神經編解碼器 TTS。
- [Qian et al. (2019). AutoVC](https://arxiv.org/abs/1905.05879) ——以解開為基礎的聲音轉換。
- [Baas, Waubert de Puiseau, Kamper (2023). KNN-VC](https://arxiv.org/abs/2305.18975) ——以檢索為基礎的聲音轉換。
- [SilentCipher (2024) — Audio Watermarking](https://github.com/sony/silentcipher) ——正式環境能用的 32 位元音訊浮水印。
- [ASVspoof 2025 results](https://www.asvspoof.org/) ——偵測器和合成器的對決，2026 年更新。
