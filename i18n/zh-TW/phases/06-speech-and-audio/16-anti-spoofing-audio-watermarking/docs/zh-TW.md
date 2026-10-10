# 語音反仿冒（anti-spoofing）與音訊浮水印（audio watermarking）：ASVspoof 5、AudioSeal、WaveVerify

> 聲音仿製交付得比防禦快。2026 年正式環境的語音系統需要兩樣東西：一個偵測器（AASIST、RawNet2），區分真實與合成語音；一個浮水印（AudioSeal），壓縮和編輯之後還在。兩樣都交付，否則不要交付聲音仿製。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 6 · 06 (Speaker Recognition), Phase 6 · 08 (Voice Cloning)
**Time:** ~75 minutes

## The Problem｜問題

三道相關的防禦：

1. **反仿冒／深偽偵測。** 給一段音訊，它是合成的還是真的？ASVspoof 基準（ASVspoof 2019 到 2021 再到 5）是公認標準。
2. **音訊浮水印。** 在生成的音訊裡寫進聽不出來的訊號，偵測器以後能抽出來。AudioSeal（Meta）和 WavMark 是開放選項。
3. **可驗證的出處（verifiable provenance）。** 音訊檔和中繼資料做密碼學簽章。C2PA／Content Authenticity Initiative。

偵測對付不配合的對手。浮水印對付合規：AI 生成的音訊應該能被認出來。2026 年兩樣都要。

## The Concept｜核心概念

![Anti-spoofing vs watermarking vs provenance — three defense layers](../assets/spoofing-watermark.svg)

### ASVspoof 5：2024 到 2025 的基準

和先前版本最大的差別：

- **群眾外包的資料**（不是錄音室乾淨的）。條件比較真實。
- **約 2000 位說話人**（以前大約 100 位）。
- **32 種攻擊演算法（algorithm）。** TTS、聲音轉換、對抗擾動。
- **兩條賽道。** 對抗措施（CM）單獨偵測。另一賽道是用於生物辨識系統的防仿冒 ASV（SASV）。

ASVspoof 5 上的現況最好大約 7.23% EER。較舊的 ASVspoof 2019 LA 是 0.42% EER。實際部署：野外片段預期 5% 到 10% EER。

### AASIST 和 RawNet2：偵測模型家族

**AASIST**（2021，一路更新到 2026）。頻譜特徵（feature）上的圖注意力。ASVspoof 5 對抗措施任務上目前的現況最好。

**RawNet2。** 原始波形上的卷積前端，加 TDNN 骨幹。比較單純的基準模型（baseline）。配上 fine-tune 仍然有競爭力。

**NeXt-TDNN 加自監督特徵。** 2025 變體：ECAPA 風格加 WavLM 特徵加 focal loss。在 ASVspoof 2019 LA 上達到 0.42% EER。

### AudioSeal：2024 年的浮水印預設

Meta 的 **AudioSeal**（2024 年 1 月，v0.2 在 2024 年 12 月）。關鍵設計：

- **局部的。** 以 16 kHz 取樣解析度（1/16000 秒）逐框偵測浮水印。
- **生成器和偵測器一起訓練。** 生成器學會寫進聽不見的訊號。偵測器學會在增強之後把它找出來。
- **穩。** 撐過 MP3／AAC 壓縮、等化、速度偏移 ±10%、混入雜訊加 10 dB SNR。
- **快。** 偵測器 485 倍即時。比 WavMark 快 1000 倍。
- **容量。** 16 位元承載資料（可以編碼模型 ID、生成時間戳、使用者 ID），每一句都能寫進去。

### WavMark

AudioSeal 之前的開放基準。可逆神經網路，每秒 32 位元。問題：

- 同步的暴力搜尋很慢。
- 高斯雜訊或 MP3 壓縮可移除浮水印。
- 對即時不友善。

### WaveVerify（2025 年 7 月）

補 AudioSeal 的弱點，特別是時間軸上的操作（倒放、變速）。用 FiLM 生成器加專家混合偵測器。標準攻擊上和 AudioSeal 差不多。時間編輯它處理得了。

### 對手利用的缺口

AudioMarkBench 寫的：「音高偏移之下，所有浮水印的位元回復準確率（bit recovery accuracy）都低於 0.6，等於幾乎被清掉。」**音高偏移是普遍的攻擊。** 2026 年沒有浮水印對強烈的音高修改完全穩健。所以浮水印旁邊還要偵測（AASIST）。

### C2PA／Content Authenticity Initiative

這不是機器學習手法，是一份清單格式。音訊檔帶著密碼學簽過的中繼資料：建立工具、作者、日期。Audobox／Seamless 在用。對出處有用。惡意的人重新編碼、把中繼資料剝掉後，它便失去作用。

```figure
v4-audio-watermark
```

## Build It｜動手實作

### 步驟 1：簡單的頻譜特徵偵測器（玩具）

```python
def spectral_rolloff(spec, percentile=0.85):
    cum = 0
    total = sum(spec)
    if total == 0:
        return 0
    threshold = total * percentile
    for k, v in enumerate(spec):
        cum += v
        if cum >= threshold:
            return k
    return len(spec) - 1

def is_suspicious(audio):
    spec = magnitude_spectrum(audio)
    rolloff = spectral_rolloff(spec)
    return rolloff / len(spec) > 0.92
```

合成語音的高頻能量分布常常異常平坦。正式環境的偵測器用 AASIST，不是這個。但直覺還在。

### 步驟 2：AudioSeal 寫入和偵測

```python
from audioseal import AudioSeal
import torch

generator = AudioSeal.load_generator("audioseal_wm_16bits")
detector = AudioSeal.load_detector("audioseal_detector_16bits")

audio = load_wav("generated.wav", sr=16000)[None, None, :]
payload = torch.tensor([[1, 0, 1, 1, 0, 1, 0, 0, 1, 1, 0, 1, 0, 1, 1, 0]])
watermark = generator.get_watermark(audio, sample_rate=16000, message=payload)
watermarked = audio + watermark

result, decoded_payload = detector.detect_watermark(watermarked, sample_rate=16000)
# result: float in [0, 1] — probability of watermark presence
# decoded_payload: 16 bits; match against embedded payload
```

### 步驟 3：評估，EER

```python
def eer(real_scores, fake_scores):
    thresholds = sorted(set(real_scores + fake_scores))
    best = (1.0, 0.0)
    for t in thresholds:
        far = sum(1 for s in fake_scores if s >= t) / len(fake_scores)
        frr = sum(1 for s in real_scores if s < t) / len(real_scores)
        if abs(far - frr) < best[0]:
            best = (abs(far - frr), (far + frr) / 2)
    return best[1]
```

### 步驟 4：正式環境的接法

```python
def safe_tts(text, voice, clone_reference=None):
    if clone_reference is not None:
        verify_consent(user_id, clone_reference)
    audio = tts_model.synthesize(text, voice)
    audio_with_wm = audioseal_embed(audio, payload=build_payload(user_id, model_id))
    manifest = c2pa_sign(audio_with_wm, user_id, timestamp=now())
    return audio_with_wm, manifest
```

每次生成都附帶：(1) 浮水印，(2) 簽過的清單，(3) 符合保留政策的稽核紀錄。

## Use It｜實際應用

| 用途 | 防禦 |
|----------|---------|
| 交付 TTS／聲音仿製 | 每一次輸出都用 AudioSeal 寫入（不可妥協） |
| 生物辨識的語音解鎖 | AASIST 加 ECAPA 集成。活體挑戰 |
| 客服詐欺偵測 | 進線通話抽 20% 跑 AASIST |
| 播客真偽 | 上傳時 C2PA 簽章。若是 AI 生成再加 AudioSeal |
| 研究／訓練偵測器 | ASVspoof 5 的訓練／開發／評估集 |

## Pitfalls｜容易踩的坑

- **浮水印寫了，偵測器從來沒跑。** 沒意義。把偵測器放進 CI。
- **偵測沒有校正。** 在 ASVspoof LA 上訓練的 AASIST 會過擬合。真實準確度會掉。在你的領域上校正。
- **音高偏移的缺口。** 強烈的音高偏移會移除多數浮水印。要有偵測當退路。
- **中繼資料被剝掉再轉載。** C2PA 重新編碼就能輕易繞過。密碼學和知覺（浮水印）防禦要一起加。
- **把活體當偵測。** 請使用者說一句隨機的話。擋得住重放，擋不住即時仿製。

## Ship It｜交付成果

存成 `outputs/skill-spoof-defender.md`。依語音生成的部署，挑偵測模型、浮水印、出處清單，以及作業手冊。

## Exercises｜練習

1. **簡單。** 跑 `code/main.py`。玩具偵測器，加上玩具浮水印的寫入和偵測，用在合成音訊上。
2. **中等。** 安裝 `audioseal`，在 TTS 輸出裡寫進 16 位元承載資料，再解回來。用噪音破壞音訊，量位元回復準確率。
3. **困難。** 在 ASVspoof 2019 LA 上 fine-tune RawNet2 或 AASIST。量 EER。在留出的 F5-TTS 生成片段上測，看分布外偵測掉多少。

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|-----------------|-----------------------|
| ASVspoof | 那個基準 | 兩年一次的挑戰。2024 是 ASVspoof 5。 |
| CM（對抗措施） | 偵測器 | 分類器：真實語音對上合成或轉換過的。 |
| SASV | 語者驗證加 CM | 生物辨識和仿冒偵測合在一起。 |
| AudioSeal | Meta 的浮水印 | 局部的，16 位元承載資料，比 WavMark 快 485 倍。 |
| 位元回復準確率 | 浮水印還在不在 | 攻擊之後，承載位元被找回來的比例。 |
| C2PA | 出處清單 | 關於建立和作者的密碼學中繼資料。 |
| AASIST | 偵測器家族 | 以圖注意力為基礎的反仿冒現況最好。 |

## Further Reading｜延伸閱讀

- [Todisco et al. (2024). ASVspoof 5](https://dl.acm.org/doi/10.1016/j.csl.2025.101825) ——目前的基準。
- [Defossez et al. (2024). AudioSeal](https://arxiv.org/abs/2401.17264) ——浮水印的預設。
- [Chen et al. (2025). WaveVerify](https://arxiv.org/abs/2507.21150) ——對付時間攻擊的專家混合偵測器。
- [Jung et al. (2022). AASIST](https://arxiv.org/abs/2110.01200) ——現況最好的偵測骨幹。
- [AudioMarkBench (2024)](https://proceedings.neurips.cc/paper_files/paper/2024/file/5d9b7775296a641a1913ab6b4425d5e8-Paper-Datasets_and_Benchmarks_Track.pdf) ——穩健性評估。
- [C2PA specification](https://spec.c2pa.org/specifications/specifications/2.4/index.html) ——出處清單格式。
