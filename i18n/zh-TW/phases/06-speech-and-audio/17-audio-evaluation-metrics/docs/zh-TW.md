# 音訊評估：WER、MOS、UTMOS、MMAU、FAD，以及開放排行榜

> 量不到的東西不能交付。這一課點名 2026 年每個音訊任務的指標（metric）：語音辨識（speech recognition，WER、CER、RTFx）、語音合成（MOS、UTMOS、SECS、語音辨識來回的 WER）、音訊語言（MMAU、LongAudioBench）、音樂（FAD、CLAP）、說話人（EER）。再加上你拿來比較的排行榜。

**Type:** Learn
**Languages:** Python
**Prerequisites:** Phase 6 · 04, 06, 07, 09, 10; Phase 2 · 09 (Model Evaluation)
**Time:** ~60 minutes

## The Problem｜問題

每個音訊任務都有多個指標，各自衡量不同面向。用錯指標，就可能交付一個儀表板上看起來很好、正式環境裡很糟的模型。2026 年的標準清單：

| 任務 | 主要 | 次要 |
|------|---------|-----------|
| 語音辨識 | WER | CER · RTFx · 第一個 token 的延遲 |
| 語音合成 | MOS／UTMOS | SECS · 語音辨識來回的 WER · CER · TTFA |
| 聲音仿製 | SECS（ECAPA 餘弦） | MOS · CER |
| 說話人驗證 | EER | minDCF · 操作點上的錯誤接受率／錯誤拒絕率 |
| 說話人分離 | DER | JER · 說話人混淆 |
| 音訊分類 | top-1 · mAP | macro F1 · 每一類召回率 |
| 音樂生成 | FAD | CLAP · 聆聽小組 MOS |
| 音訊語言模型 | MMAU-Pro | LongAudioBench · AudioCaps FENSE |
| 串流語音到語音 | 延遲 P50／P95 | WER · MOS |

## The Concept｜核心概念

![Audio evaluation matrix — metrics vs tasks vs 2026 leaderboards](../assets/eval-landscape.svg)

### 語音辨識指標

**WER（詞錯誤率）。** `(S + D + I) / N`。評分前先小寫、去掉標點、把數字正規化。用 `jiwer` 或 OpenAI 的 `whisper_normalizer`。&lt; 5% 等於朗讀語音達到和人一樣。

**CER（字元錯誤率）。** 同一條公式，字元級。用於聲調語言（華語、粵語），因為斷詞有歧義。

**RTFx（即時因子的倒數）。** 每一牆鐘秒處理幾秒音訊。愈高愈好。Parakeet-TDT 到 3380 倍。Whisper-large-v3 大約 30 倍。

**第一個 token 的延遲。** 從音訊輸入到第一個逐字稿 token 的牆鐘時間。對串流很關鍵。Deepgram Nova-3 大約 150 毫秒。

### 語音合成指標

**MOS（平均意見分數）。** 1 到 5 的人類評分。黃金標準，但慢。每個樣本收 20 位以上聽者，每個模型 100 個以上樣本。

**UTMOS（2022 到 2026）。** 學來的 MOS 預測器。在標準基準上和人類 MOS 相關大約 0.9。F5-TTS 的 UTMOS 是 3.95。真實音訊的 UTMOS 為 4.08。

**SECS（說話人編碼器餘弦相似度，speaker encoder cosine similarity）。** 給聲音仿製用。參考和仿製輸出之間的 ECAPA embedding 餘弦。&gt; 0.75 等於認得出來的仿製。

**語音辨識來回的 WER。** 對 TTS 輸出跑 Whisper，再和輸入文字算 WER。抓可懂度退步。2026 年現況最好：CER &lt; 2%。

**TTFA（到第一段音訊的時間）。** 牆鐘延遲。Kokoro-82M 大約 100 毫秒。F5-TTS 大約 1 秒。

### 聲音仿製專用

**SECS 加 MOS 加 CER**，三個一起看。仿製的 SECS 高、MOS 低，意思是音色對、聽起來不自然。反過來是聲音自然、說話人錯了。

### 說話人驗證

**EER（等錯誤率）。** 錯誤接受率等於錯誤拒絕率的那個閾值。ECAPA 在 VoxCeleb1-O 上是 0.87%。

**minDCF（最小偵測成本）。** 選定操作點上的加權成本（常常是錯誤接受率 0.01）。比 EER 更貼近正式環境。

### 說話人分離

**DER（說話人分離錯誤率）。** `(FA + Miss + Confusion) / total_speaker_time`。漏掉的語音、誤報的語音、說話人混淆，各自是一個比例。AMI 會議：DER 約 10% 到 20% 屬合理範圍。pyannote 3.1 加商業的 Precision-2：錄得好的音訊上 DER &lt; 10%。

**JER（Jaccard 錯誤率）。** DER 的替代。對短片段偏差比較穩。

### 音訊分類

多標籤：**mAP（平均精確率的平均值）**，對所有類。AudioSet：BEATs-iter3 是 0.548 mAP。

互斥的多類：**top-1、top-5 準確率**。Speech Commands v2：top-1 99.0%（Audio-MAE）。

不平衡：**macro F1** 加**每一類召回率**。要報每一類。總準確率會藏起哪些類失敗。

### 音樂生成

**FAD（Fréchet 音訊距離）。** 真實音訊和生成音訊的 VGGish embedding 分布之間的距離。MusicGen-small 在 MusicCaps 上是 4.5。MusicLM 是 4.0。愈低愈好。

**CLAP 分數。** 用 CLAP embedding 的文字和音訊對齊分數。&gt; 0.3 等於對齊還算合理。

**聆聽小組 MOS。** 消費級音樂評估仍以此為最終依據。Suno v5 在 TTS Arena 上 ELO 1293（來自配對的人類偏好）。

### 音訊語言基準

**MMAU（大規模多音訊理解）。** 1 萬筆音訊問答。

**MMAU-Pro。** 1800 道較難題目，四類：語音／聲音／音樂／多音訊。四選一隨機是 25%。Gemini 2.5 Pro 整體大約 60%。多音訊在所有模型上大約 22%。

**LongAudioBench。** 好幾分鐘的片段，加上語意查詢。Audio Flamingo Next 贏過 Gemini 2.5 Pro。

**AudioCaps／Clotho。** 音訊描述基準。指標是 SPICE、CIDEr、FENSE。

### 串流語音到語音

**延遲 P50／P95／P99。** 從使用者說完到第一個聽得見的回應的牆鐘時間。Moshi 200 毫秒。GPT-4o Realtime 300 毫秒。

輸出上的 **WER／MOS**。

**插話反應。** 從使用者打斷到助理靜音的時間。目標 &lt; 150 毫秒。

### 2026 年的排行榜

| 排行榜 | 賽道 | URL |
|------------|--------|-----|
| Open ASR Leaderboard（HF） | 英文加多語加長篇 | `huggingface.co/spaces/hf-audio/open_asr_leaderboard` |
| TTS Arena（HF） | 英文 TTS | `huggingface.co/spaces/TTS-AGI/TTS-Arena` |
| Artificial Analysis Speech | TTS 加語音轉文字，配對投票的 ELO | `artificialanalysis.ai/speech` |
| MMAU-Pro | 音訊語言模型推理 | `sonalkum.github.io/mmau-pro` |
| SpeakerBench／VoxSRC | 語者辨識 | `voxsrc.github.io` |
| MMAU 音樂子集 | 音樂語言模型 | （在 MMAU 裡） |
| HEAR 基準 | 自監督音訊 | `hearbenchmark.com` |

```figure
sp-wer-align
```

## Build It｜動手實作

### 步驟 1：正規化之後的 WER

```python
from jiwer import wer, Compose, ToLowerCase, RemovePunctuation, Strip

transform = Compose([ToLowerCase(), RemovePunctuation(), Strip()])
score = wer(
    truth="Please turn on the lights.",
    hypothesis="please turn on the light",
    truth_transform=transform,
    hypothesis_transform=transform,
)
# ~0.17
```

### 步驟 2：語音合成的來回 WER

```python
def ttr_wer(tts_model, asr_model, texts):
    errors = []
    for txt in texts:
        audio = tts_model.synthesize(txt)
        recog = asr_model.transcribe(audio)
        errors.append(wer(truth=txt, hypothesis=recog))
    return sum(errors) / len(errors)
```

### 步驟 3：聲音仿製的 SECS

```python
from speechbrain.inference.speaker import EncoderClassifier
sv = EncoderClassifier.from_hparams("speechbrain/spkrec-ecapa-voxceleb")

emb_ref = sv.encode_batch(load_wav("reference.wav"))
emb_clone = sv.encode_batch(load_wav("cloned.wav"))
secs = torch.nn.functional.cosine_similarity(emb_ref, emb_clone, dim=-1).item()
```

### 步驟 4：音樂生成的 FAD

```python
from frechet_audio_distance import FrechetAudioDistance
fad = FrechetAudioDistance()
score = fad.get_fad_score("generated_folder/", "reference_folder/")
```

### 步驟 5：說話人驗證的 EER（和第 6 課同一段程式）

```python
def eer(same_scores, diff_scores):
    thresholds = sorted(set(same_scores + diff_scores))
    best = (1.0, 0.0)
    for t in thresholds:
        far = sum(1 for s in diff_scores if s >= t) / len(diff_scores)
        frr = sum(1 for s in same_scores if s < t) / len(same_scores)
        if abs(far - frr) < best[0]:
            best = (abs(far - frr), (far + frr) / 2)
    return best[1]
```

## Use It｜實際應用

每一次部署都配一套固定的評估套件，每次模型更新都跑。三條硬規則：

1. **評分前先正規化。** 小寫、去掉標點、把數字展開。把正規化規則寫出來。
2. **報分布，不報平均。** 延遲報 P50／P95／P99。分類報每一類召回率。MMAU 報每一類。
3. **跑一個標準的公開基準。** 就算你的正式環境資料不一樣，在 Open ASR、TTS Arena、MMAU 上報，審查的人才能用同一把尺比。

## Pitfalls｜容易踩的坑

- **UTMOS 外推。** 在 VCTK 風格的乾淨語音上訓練。吵的、仿製的、有情緒的音訊，分數會差。
- **MOS 小組的偏差。** 20 位 Amazon Mechanical Turk 工人不等於 20 位目標使用者。付費委託領域專家評分。
- **FAD 看參考集。** 跨模型要比，參考分布要同一套。
- **總 WER。** 整體 5% WER 可以藏起口音語音上的 30% WER。依不同人口群體分層回報。
- **公開基準飽和。** 多數前線模型在標準基準上接近天花板。做一套反映你流量的內部留出集。

## Ship It｜交付成果

存成 `outputs/skill-audio-evaluator.md`。任何音訊模型釋出，挑指標、基準，以及報告格式。

## Exercises｜練習

1. **簡單。** 跑 `code/main.py`。在玩具輸入上算 WER、CER、EER、SECS、FAD 風格、MMAU 風格。
2. **中等。** 做一套語音合成來回 WER。把你的 Kokoro 或 F5-TTS 輸出送進 Whisper。在 50 個 prompt 上算 WER。標出 WER &gt; 10% 的 prompt。
3. **困難。** 用你第 10 課選的音訊語言模型，在 MMAU-Pro 的語音和多音訊子集上評分（各 50 題）。報每一類準確率，並和公開數字比。

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|-----------------|-----------------------|
| WER | 語音辨識分數 | 正規化之後、詞級的 `(S+D+I)/N`。 |
| CER | 字元版 WER | 給聲調語言或字元級系統。 |
| MOS | 人類意見 | 1 到 5 的評分。20 位以上聽者乘 100 個樣本。 |
| UTMOS | 機器學習（machine learning）的 MOS 預測器 | 學來的模型。和人類 MOS 相關大約 0.9。 |
| SECS | 聲音仿製相似度 | 參考和仿製之間的 ECAPA 餘弦。 |
| EER | 說話人驗證分數 | 錯誤接受率等於錯誤拒絕率的閾值。 |
| DER | 說話人分離分數 | （FA + Miss + Confusion）除以總時間。 |
| FAD | 音樂生成品質 | VGGish embedding 上的 Fréchet 距離。 |
| RTFx | 吞吐 | 每一牆鐘秒處理幾秒音訊。 |

## Further Reading｜延伸閱讀

- [jiwer](https://github.com/jitsi/jiwer) ——帶正規化工具的 WER／CER 函式庫（library）。
- [UTMOS (Saeki et al. 2022)](https://arxiv.org/abs/2204.02152) ——學來的 MOS 預測器。
- [Fréchet Audio Distance (Kilgour et al. 2019)](https://arxiv.org/abs/1812.08466) ——音樂生成的標準。
- [Open ASR Leaderboard](https://huggingface.co/spaces/hf-audio/open_asr_leaderboard) ——2026 年的即時排名。
- [TTS Arena](https://huggingface.co/spaces/TTS-AGI/TTS-Arena) ——人類投票的 TTS 排行榜。
- [MMAU-Pro benchmark](https://sonalkum.github.io/mmau-pro/) ——音訊語言模型推理排行榜。
- [HEAR benchmark](https://hearbenchmark.com/) ——音訊自監督基準。
