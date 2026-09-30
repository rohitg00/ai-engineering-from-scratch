# 音訊評估 —— WER、MOS、UTMOS、MMAU、FAD 與公開排行榜

> 量不到的東西你就沒辦法上線。這一課把 2026 年每一項音訊任務該用的指標點名清楚：ASR（WER、CER、RTFx）、TTS（MOS、UTMOS、SECS、繞一圈跑 ASR 的 WER）、音訊語言模型（MMAU、LongAudioBench）、音樂（FAD、CLAP）、以及說話人（EER）。再加上你要拿去比較的那些排行榜。

**類型：** 學習
**程式語言：** Python
**先修單元：** 階段 6 · 04、06、07、09、10；階段 2 · 09（模型評估）
**時間：** 約 60 分鐘

## 問題所在

每一項音訊任務都有多個指標，各自量的是不同的軸向。用錯指標，就是你會做出一個在儀表板上很漂亮、在正式環境爛得可怕的模型的原因。2026 年的標準清單：

| 任務 | 主要 | 次要 |
|------|---------|-----------|
| ASR | WER | CER · RTFx · 首個詞元延遲 |
| TTS | MOS／UTMOS | SECS · 繞一圈跑 ASR 的 WER · CER · TTFA |
| 聲音複製 | SECS（ECAPA 餘弦） | MOS · CER |
| 說話人驗證 | EER | minDCF · 操作點上的 FAR／FRR |
| 語者分段 | DER | JER · 說話人混淆 |
| 音訊分類 | top-1 · mAP | macro F1 · 各類別召回率 |
| 音樂生成 | FAD | CLAP · 聽測小組的 MOS |
| 音訊語言模型 | MMAU-Pro | LongAudioBench · AudioCaps FENSE |
| 串流語音對語音 | 延遲 P50/P95 | WER · MOS |

## 核心概念

![音訊評估矩陣 —— 指標 vs 任務 vs 2026 年的排行榜](../assets/eval-landscape.svg)

### ASR 指標

**WER（字錯誤率）。** `(S + D + I) / N`。計分前要轉小寫、去標點、把數字正規化。用 `jiwer` 或 OpenAI 的 `whisper_normalizer`。&lt; 5% = 朗讀語音上的人類水準。

**CER（字元錯誤率）。** 同一個公式，但在字元層級。用在詞界模糊的聲調語言（華語、粵語）。

**RTFx（即時因子的倒數）。** 每一秒牆鐘時間能處理幾秒音訊。越高越好。Parakeet-TDT 達到 3380 倍。Whisper-large-v3 約 30 倍。

**首個詞元延遲。** 從音訊輸入到第一個轉錄詞元的牆鐘時間。對串流至關重要。Deepgram Nova-3：約 150 ms。

### TTS 指標

**MOS（平均意見分數）。** 1-5 分的人工自然度評分。黃金標準，但很慢。每個樣本要收 20 位以上的聽測者，每個模型要 100 個以上的樣本。

**UTMOS（2022-2026）。** 學出來的 MOS 預測器。在標準基準上與人類 MOS 的相關性約 0.9。F5-TTS：UTMOS 3.95；真實錄音：4.08。

**SECS（說話人編碼器餘弦相似度）。** 用在聲音複製。參考音與複製輸出之間 ECAPA 嵌入的餘弦相似度，也就是說話人相似度。&gt; 0.75 = 聽得出是同一個人的複製。

**繞一圈跑 ASR 的 WER。** 把 Whisper 跑在 TTS 的輸出上，再對輸入文字算 WER。能抓到可理解度的退步。2026 年的最新技術水準：CER &lt; 2%。

**TTFA（首個音訊產出時間）。** 牆鐘延遲。Kokoro-82M：約 100 ms；F5-TTS：約 1 秒。

### 聲音複製專屬

**SECS ＋ MOS ＋ CER** 三個一組看。複製結果 SECS 高但 MOS 低，代表音色對了但不自然；反過來則是聲音自然但說話人不對。

### 說話人驗證

**EER（等錯誤率）。** 錯誤接受率等於錯誤拒絕率的那個門檻。ECAPA 在 VoxCeleb1-O 上：0.87%。

**minDCF（最小偵測代價）。** 在選定的操作點（常用 FAR=0.01）上的加權代價。比 EER 更貼近正式環境。

### 語者分段

**DER（語者分段錯誤率）。** `(FA + Miss + Confusion) / total_speaker_time`。漏掉的語音 ＋ 誤報的語音 ＋ 說話人混淆，各自算成一個比例。AMI 會議資料：DER 約 10-20% 是務實的水準。pyannote 3.1 ＋ 商業版 Precision-2：在錄製良好的音訊上 DER &lt;10%。

**JER（Jaccard 錯誤率）。** DER 的替代品，對短片段偏誤比較穩健。

### 音訊分類

多標籤：對所有類別算 **mAP（平均精確度均值）**。AudioSet：BEATs-iter3 為 0.548 mAP。

多類別互斥：**top-1、top-5 準確率**。Speech Commands v2：99.0% top-1（Audio-MAE）。

不平衡：**macro F1** ＋ **各類別召回率**。要逐類別回報 —— 總體準確率會藏起哪些類別失敗了。

### 音樂生成

**FAD（Fréchet 音訊距離）。** 真實音訊與生成音訊在 VGGish 嵌入分布之間的距離。MusicGen-small 在 MusicCaps 上：4.5。MusicLM：4.0。越低越好。

**CLAP 分數。** 用 CLAP 嵌入算的文字-音訊對齊分數。&gt; 0.3 = 對齊算合理。

**聽測小組 MOS。** 對消費級的音樂來說仍然是最終定論。Suno v5 在 TTS Arena 上 ELO 1293（來自成對的人類偏好）。

### 音訊語言模型的基準

**MMAU（Massive Multi-Audio Understanding）。** 1 萬組音訊問答對。

**MMAU-Pro。** 1800 道難題，四個類別：語音／聲音／音樂／多音訊。四選一的隨機猜中率是 25%。Gemini 2.5 Pro 整體約 60%；多音訊項目在所有模型上都只有約 22%。

**LongAudioBench。** 數分鐘長的片段搭配語意查詢。Audio Flamingo Next 勝過 Gemini 2.5 Pro。

**AudioCaps／Clotho。** 音訊描述（captioning）基準。用 SPICE、CIDEr、FENSE 指標。

### 串流語音對語音

**延遲 P50／P95／P99。** 從使用者說完到第一聲可聽見回應的牆鐘時間。Moshi：200 ms；GPT-4o Realtime：300 ms。

輸出上的 **WER／MOS**。

**打斷的反應速度。** 從使用者插話到助理靜音所需的時間。目標 &lt; 150 ms。

### 2026 年的排行榜

| 排行榜 | 賽道 | URL |
|------------|--------|-----|
| Open ASR Leaderboard（HF） | 英語 ＋ 多語言 ＋ 長音訊 | `huggingface.co/spaces/hf-audio/open_asr_leaderboard` |
| TTS Arena（HF） | 英語 TTS | `huggingface.co/spaces/TTS-AGI/TTS-Arena` |
| Artificial Analysis Speech | TTS ＋ STT，由成對投票算 ELO | `artificialanalysis.ai/speech` |
| MMAU-Pro | 音訊語言模型的推論能力 | `sonalkum.github.io/mmau-pro` |
| SpeakerBench／VoxSRC | 說話人辨識 | `voxsrc.github.io` |
| MMAU 音樂子集 | 音樂類音訊語言模型 | （在 MMAU 之內） |
| HEAR benchmark | 自監督音訊 | `hearbenchmark.com` |

```figure
sp-wer-align
```

## 動手實作

### 步驟 1：帶正規化的 WER

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

### 步驟 2：TTS 繞一圈的 WER

```python
def ttr_wer(tts_model, asr_model, texts):
    errors = []
    for txt in texts:
        audio = tts_model.synthesize(txt)
        recog = asr_model.transcribe(audio)
        errors.append(wer(truth=txt, hypothesis=recog))
    return sum(errors) / len(errors)
```

### 步驟 3：聲音複製的 SECS

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

### 步驟 5：說話人驗證的 EER（跟單元 6 是同一份程式碼）

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

## 框架應用

每次部署都要配一套固定的評估工具，每次模型更新都跑一次。三條基本原則：

1. **計分前先正規化。** 轉小寫、去標點、展開數字。並且把正規化規則寫出來。
2. **回報分布，不是平均值。** 延遲看 P50/P95/P99。分類看各類別召回率。MMAU 看各類別。
3. **至少跑一個公認的公開基準。** 即使你的正式資料不一樣，在 Open ASR／TTS Arena／MMAU 上回報，能讓審閱者拿同樣的尺去比。

## 陷阱

- **UTMOS 的外推。** 它是在 VCTK 那類乾淨語音上訓練的；對吵雜／複製／帶情緒的音訊給分很不準。
- **MOS 小組偏誤。** 20 個 Amazon Mechanical Turk 工作者 ≠ 20 個目標使用者。如果風險很高，就花錢找領域內的小組。
- **FAD 取決於參考集。** 跨模型比較時要對同一個參考分布。
- **總體 WER。** 整體 5% 的 WER，可能藏著帶口音語音上的 30% WER。要依人口統計切片回報。
- **公開基準飽和。** 大多數前沿模型在標準基準上都接近天花板了。自己建一個能反映你真實流量的內部保留集。

## 產出交付

存成 `outputs/skill-audio-evaluator.md`。為任何一次音訊模型的發布挑出指標、基準與回報格式。

## 練習

1. **簡單。** 跑 `code/main.py`。在玩具輸入上算 WER／CER／EER／SECS／近似 FAD／近似 MMAU。
2. **中等。** 做一套 TTS 繞一圈的 WER 工具。把你的 Kokoro 或 F5-TTS 輸出丟給 Whisper。在 50 個提示詞上算 WER。把 WER &gt; 10% 的提示詞標記出來。
3. **困難。** 拿你在單元 10 選的音訊語言模型，在 MMAU-Pro 的語音 ＋ 多音訊子集上評分（各 50 題）。回報各類別準確率，並與已發表的數字比較。

## 關鍵術語

| 術語 | 大家怎麼說 | 實際上是什麼 |
|------|-----------------|-----------------------|
| WER | ASR 的分數 | 正規化之後在詞層級算 `(S+D+I)/N`。 |
| CER | 字元版的 WER | 給聲調語言或字元層級的系統用。 |
| MOS | 人類的意見 | 1-5 分的自然度評分；20 位以上聽測者 × 100 個樣本。 |
| UTMOS | 機器學習的 MOS 預測器 | 學出來的模型；與人類 MOS 的相關性約 0.9。 |
| SECS | 聲音複製的相似度 | 參考音與複製結果之間的 ECAPA 餘弦，即說話人相似度。 |
| EER | 說話人驗證的分數 | FAR = FRR 的那個門檻。 |
| DER | 語者分段的分數 | （FA ＋ Miss ＋ Confusion）／總時長。 |
| FAD | 音樂生成的品質 | 在 VGGish 嵌入上算的 Fréchet 距離。 |
| RTFx | 吞吐量 | 每秒牆鐘時間處理幾秒音訊。 |

## 延伸閱讀

- [jiwer](https://github.com/jitsi/jiwer) —— 附正規化工具的 WER／CER 函式庫。
- [UTMOS (Saeki et al. 2022)](https://arxiv.org/abs/2204.02152) —— 學出來的 MOS 預測器。
- [Fréchet Audio Distance (Kilgour et al. 2019)](https://arxiv.org/abs/1812.08466) —— 音樂生成的標準指標。
- [Open ASR Leaderboard](https://huggingface.co/spaces/hf-audio/open_asr_leaderboard) —— 2026 年的即時排名。
- [TTS Arena](https://huggingface.co/spaces/TTS-AGI/TTS-Arena) —— 人類投票的 TTS 排行榜。
- [MMAU-Pro benchmark](https://sonalkum.github.io/mmau-pro/) —— 音訊語言模型推論能力的排行榜。
- [HEAR benchmark](https://hearbenchmark.com/) —— 音訊自監督學習的基準。
