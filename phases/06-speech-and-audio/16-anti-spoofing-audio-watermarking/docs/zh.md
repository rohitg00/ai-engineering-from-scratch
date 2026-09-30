# 語音反欺騙與音訊浮水印 —— ASVspoof 5、AudioSeal、WaveVerify

> 聲音複製上線的速度比防禦快。2026 年的正式語音系統需要兩樣東西：一個偵測器（AASIST、RawNet2）把真語音和假語音分類出來，以及一個能撐過壓縮與編輯的浮水印（AudioSeal）。兩個都上，否則就不要上聲音複製。

**類型：** 實作
**程式語言：** Python
**先修單元：** 階段 6 · 06（說話人辨識）、階段 6 · 08（聲音複製）
**時間：** 約 75 分鐘

## 問題所在

三種相關的防禦：

1. **反欺騙／深偽偵測。** 給一段音訊，它是合成的還是真的？ASVspoof 系列基準（ASVspoof 2019 → 2021 → 5）是黃金標準。
2. **音訊浮水印。** 在生成的音訊裡嵌入一個人耳無法察覺的訊號，之後偵測器能把它抽出來。AudioSeal（Meta）與 WavMark 是開源的選項。
3. **經驗證的來源憑證。** 對音訊檔案與其中介資料做密碼學簽章。C2PA／內容真實性倡議（Content Authenticity Initiative）。

偵測處理的是不配合的對手。浮水印處理的是法規遵循 —— AI 生成的音訊應該能被辨識出來就是 AI 生成的。2026 年這兩者都是必要的。

## 核心概念

![反欺騙 vs 浮水印 vs 來源憑證 —— 三道防禦層](../assets/spoofing-watermark.svg)

### ASVspoof 5 —— 2024-2025 年的基準

與前幾屆最大的差別：

- **群眾外包的資料**（不是錄音室的乾淨語音）—— 貼近真實條件。
- **約 2000 位說話人**（之前約 100 位）。
- **32 種攻擊演算法。** TTS ＋ 語音轉換 ＋ 對抗式擾動。
- **兩條賽道。** 對策（CM）的獨立偵測；以及給生物辨識系統用的抗欺騙 ASV（SASV）。

ASVspoof 5 上的最新技術水準：約 7.23% EER。在較舊的 ASVspoof 2019 LA 上：0.42% EER。真實部署時：野生片段上要預期 5-10% 的 EER。

### AASIST 與 RawNet2 —— 偵測模型家族

**AASIST**（2021，一路更新到 2026）。在頻譜特徵上做圖注意力（graph-attention）。目前在 ASVspoof 5 的對策任務上是最新技術水準。

**RawNet2。** 直接在原始波形上做卷積前端 ＋ TDNN 骨幹。比較簡單的基準線；微調後仍有競爭力。

**NeXt-TDNN ＋ 自監督學習特徵。** 2025 年的變體：ECAPA 風格 ＋ WavLM 特徵 ＋ focal loss。在 ASVspoof 2019 LA 上做到 0.42% EER。

### AudioSeal —— 2024 年起的浮水印預設選擇

Meta 的 **AudioSeal**（2024 年 1 月，v0.2 於 2024 年 12 月）。關鍵設計：

- **定位式。** 在 16 kHz 的取樣解析度（1/16000 秒）下逐幀偵測浮水印。
- **生成器與偵測器聯合訓練。** 生成器學著嵌入聽不見的訊號；偵測器學著在各種資料增強之後把它找出來。
- **穩健。** 能撐過 MP3／AAC 壓縮、EQ、±10% 的變速、以及 +10 dB SNR 的噪音混入。
- **快。** 偵測器跑在即時的 485 倍速；比 WavMark 快 1000 倍。
- **容量。** 16 位元的酬載（可編入模型 ID、生成時間戳記、使用者 ID），每段話語都能嵌入。

### WavMark

AudioSeal 之前的開源基準線。可逆神經網路，32 位元／秒。問題在於：

- 同步靠暴力搜尋，很慢。
- 高斯噪音或 MP3 壓縮就能把它移除。
- 對即時場景不友善。

### WaveVerify（2025 年 7 月）

針對 AudioSeal 的弱點 —— 特別是時間軸上的操弄（反轉、變速）。用 FiLM 式的生成器 ＋ 專家混合（Mixture-of-Experts）偵測器。在標準攻擊上與 AudioSeal 相當；並且能處理時間軸上的編輯。

### 對手會鑽的漏洞

出自 AudioMarkBench：「在音高位移下，所有浮水印的位元復原準確率（Bit Recovery Accuracy）都低於 0.6，代表幾乎被完全移除。」**音高位移是通用攻擊。** 2026 年沒有任何浮水印能完全抵抗激烈的音高修改。這正是為什麼你在浮水印之外還需要偵測（AASIST）。

### C2PA／內容真實性倡議

這不是機器學習技術 —— 而是一種宣告檔（manifest）格式。音訊檔案攜帶經密碼學簽章的中介資料，記錄建立工具、作者、日期。Audobox／Seamless 都用它。對來源憑證很好用；但只要壞人重新編碼把中介資料剝掉，它就什麼都不是。

```figure
v4-audio-watermark
```

## 動手實作

### 步驟 1：一個簡單的頻譜特徵偵測器（玩具級）

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

合成語音的高頻能量常常異常平坦。正式的偵測器用的是 AASIST，不是這個。但直覺是成立的。

### 步驟 2：AudioSeal 的嵌入 ＋ 偵測

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

### 步驟 3：評估 —— EER

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

### 步驟 4：正式環境的整合

```python
def safe_tts(text, voice, clone_reference=None):
    if clone_reference is not None:
        verify_consent(user_id, clone_reference)
    audio = tts_model.synthesize(text, voice)
    audio_with_wm = audioseal_embed(audio, payload=build_payload(user_id, model_id))
    manifest = c2pa_sign(audio_with_wm, user_id, timestamp=now())
    return audio_with_wm, manifest
```

每一次生成都要一併交付：(1) 浮水印、(2) 已簽章的宣告檔、(3) 符合保存政策的稽核紀錄。

## 框架應用

| 使用情境 | 防禦 |
|----------|---------|
| 上線 TTS／聲音複製 | 每一份輸出都嵌 AudioSeal（沒有商量空間） |
| 生物辨識語音解鎖 | AASIST ＋ ECAPA 的整體模型；加上活體驗證挑戰 |
| 客服中心詐騙偵測 | 對 20% 的來電抽樣跑 AASIST |
| Podcast 真實性 | 上傳時做 C2PA 簽章，若是 AI 生成再加 AudioSeal |
| 研究／訓練偵測器 | ASVspoof 5 的 train／dev／eval 資料集 |

## 陷阱

- **有浮水印但偵測器從沒跑過。** 毫無意義。把偵測器放進你的 CI。
- **偵測沒做校準。** 在 ASVspoof LA 上訓練的 AASIST 會過度擬合；真實世界的準確度會掉。在你自己的領域上做校準。
- **音高位移的漏洞。** 激烈的音高位移會移除大多數浮水印。要有一條偵測的退路。
- **剝除中介資料再重新上架。** C2PA 只要重新編碼就能輕易繞過。永遠要把密碼學防禦與感知式防禦（浮水印）一起加上。
- **把活體驗證當成偵測。** 請使用者說一段隨機的句子。這能防重播攻擊，但防不了即時的聲音複製。

## 產出交付

存成 `outputs/skill-spoof-defender.md`。為一項語音生成部署挑出偵測模型、浮水印、來源憑證宣告檔，以及維運的操作手冊。

## 練習

1. **簡單。** 跑 `code/main.py`。在合成音訊上做玩具級的偵測器 ＋ 玩具級的浮水印嵌入／偵測。
2. **中等。** 安裝 `audioseal`，在一份 TTS 輸出裡嵌入 16 位元酬載，再解碼回來。用噪音破壞音訊，量測位元復原準確率。
3. **困難。** 在 ASVspoof 2019 LA 上微調一個 RawNet2 或 AASIST。量測 EER。再拿一組保留的 F5-TTS 生成片段來測 —— 看看分布外（OOD）的偵測能力退化得多嚴重。

## 關鍵術語

| 術語 | 大家怎麼說 | 實際上是什麼 |
|------|-----------------|-----------------------|
| ASVspoof | 那個基準 | 兩年一屆的挑戰賽；2024 年那屆 = ASVspoof 5。 |
| CM（對策） | 偵測器 | 分類器：真語音 vs 合成／轉換過的語音。 |
| SASV | 說話人驗證 ＋ CM | 生物辨識與欺騙偵測的整合。 |
| AudioSeal | Meta 的浮水印 | 定位式、16 位元酬載、比 WavMark 快 485 倍。 |
| 位元復原準確率 | 浮水印的存活率 | 攻擊之後被復原出來的酬載位元比例。 |
| C2PA | 來源憑證宣告檔 | 關於建立過程／作者身分的密碼學中介資料。 |
| AASIST | 偵測器家族 | 以圖注意力為基礎的反欺騙最新技術水準。 |

## 延伸閱讀

- [Todisco et al. (2024). ASVspoof 5](https://dl.acm.org/doi/10.1016/j.csl.2025.101825) —— 目前的基準。
- [Defossez et al. (2024). AudioSeal](https://arxiv.org/abs/2401.17264) —— 浮水印的預設選擇。
- [Chen et al. (2025). WaveVerify](https://arxiv.org/abs/2507.21150) —— 針對時間軸攻擊的 MoE 偵測器。
- [Jung et al. (2022). AASIST](https://arxiv.org/abs/2110.01200) —— 最新技術水準的偵測骨幹。
- [AudioMarkBench (2024)](https://proceedings.neurips.cc/paper_files/paper/2024/file/5d9b7775296a641a1913ab6b4425d5e8-Paper-Datasets_and_Benchmarks_Track.pdf) —— 穩健性評估。
- [C2PA specification](https://spec.c2pa.org/specifications/specifications/2.4/index.html) —— 來源憑證宣告檔的格式。
