# 語者辨識與驗證

> ASR 問「他們說了什麼？」語者辨識問「是誰說的？」數學看起來一樣，embedding 加餘弦，但正式環境的每個決定都看那一個 EER 數字。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 6 · 02 (Spectrograms & Mel), Phase 5 · 22 (Embedding Models)
**Time:** ~45 minutes

## The Problem｜問題

使用者說一句通行片語。你想知道：這是不是他聲稱的那個人（*驗證*，1 對 1），還是你註冊庫裡的第一個人（*識別*，1 對 N）？或兩者都不是，這是未知的語者（*開放集合（open-set）*）？

2018 年以前：GMM-UBM 加 i-vector。EER 還可以，但容易受通道偏移（channel shift，電話對上筆電）和情緒影響。2018 到 2022：x-vector（用角度邊界（angular margin）訓練的 TDNN 骨幹（backbone））。2022 年之後：ECAPA-TDNN 和 WavLM-large 的 embedding。到 2026 年，這個領域由三個模型和一個指標主導。

那個指標是 **EER**，等錯誤率（Equal Error Rate）。把決策閾值（threshold）設成錯誤接受率等於錯誤拒絕率。交叉點就是 EER。每篇論文、每個排行榜、每一次採購都用它。

## The Concept｜核心概念

![Enrollment + verification pipeline with embedding + cosine + EER](../assets/speaker-verification.svg)

**管線（pipeline）。** 註冊：錄目標語者 5 到 30 秒，算出固定維度的 embedding（ECAPA-TDNN 是 192 維，WavLM-large 是 256 維）。驗證：取測試語句的 embedding，算餘弦相似度（cosine similarity），再和閾值比。

**ECAPA-TDNN（2020，到 2026 年仍然主導）。** Emphasized Channel Attention, Propagation and Aggregation，時延神經網路。1D 卷積區塊帶 squeeze-excitation、多頭注意力池化，再接線性層到 192 維。在 VoxCeleb 1 加 2 上訓練（2,700 位語者、110 萬句），損失是加性角度邊界（Additive Angular Margin，AAM-softmax）。

**WavLM-SV（2022 年之後）。** 用 AAM 損失 fine-tune 預訓練的 WavLM-large 自監督骨幹。品質更高，但比較慢。300 MB 以上，對上 15 MB。

**x-vector（基準模型）。** TDNN 加統計池化。傳統。CPU 和邊緣上仍然有用。

**AAM-softmax。** 標準 softmax，在角度空間加上邊界 `m`：正確類用 `cos(θ + m)`。強迫類別之間在角度上分開。典型是 `m=0.2`，尺度 `s=30`。

### 評分

- 註冊和測試 embedding 之間的**餘弦**。依閾值決定。
- **PLDA（機率 LDA）。** 把 embedding 投影到一個潛在空間，同一語者和不同語者有閉式的概似比。加在餘弦上面，EER 再降 10% 到 20%。2020 年以前的標準。現在只用在封閉集合。
- **分數正規化（score normalization）。** `S-norm` 或 `AS-norm`：把每個分數對一群冒充者的平均和標準差做正規化。跨領域評估不可少。

### 2026 年你該知道的數字

| 模型 | VoxCeleb1-O EER | 參數 | 吞吐量（A100） |
|-------|-----------------|--------|-------------------|
| x-vector（傳統） | 3.10% | 500 萬 | 400 倍即時 |
| ECAPA-TDNN | 0.87% | 1500 萬 | 200 倍即時 |
| WavLM-SV large | 0.42% | 3.16 億 | 20 倍即時 |
| Pyannote 3.1 切段加 embedding | 0.65% | 600 萬 | 100 倍即時 |
| ReDimNet（2024） | 0.39% | 2400 萬 | 100 倍即時 |

### 語者分離

多語者片段裡「誰在什麼時候說話」。管線：VAD，切段，每一段做 embedding，分群（凝聚或譜分群），再平滑邊界。現代堆疊是 `pyannote.audio` 3.1，一次呼叫就把語者切段、embedding、分群包在一起。2026 年 AMI 上目前最好的 DER 大約 15%，2022 年是 23%。

```figure
sp-eer-crossover
```

## Build It｜動手實作

### 步驟 1：用 MFCC 統計量做玩具 embedding

```python
def embed_mfcc_stats(signal, sr):
    frames = featurize_mfcc(signal, sr, n_mfcc=13)
    mean = [sum(f[i] for f in frames) / len(frames) for i in range(13)]
    std = [
        math.sqrt(sum((f[i] - mean[i]) ** 2 for f in frames) / len(frames))
        for i in range(13)
    ]
    return mean + std  # 26-d
```

離目前最好差很遠。只拿來教學。`code/main.py` 用它在合成的語者資料上做概念驗證。

### 步驟 2：餘弦相似度加閾值

```python
def cosine(a, b):
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(x * x for x in b))
    return dot / (na * nb) if na and nb else 0.0

def verify(enroll, test, threshold=0.75):
    return cosine(enroll, test) >= threshold
```

### 步驟 3：從相似度配對算 EER

```python
def eer(same_scores, diff_scores):
    thresholds = sorted(set(same_scores + diff_scores))
    best = (1.0, 1.0, 0.0)  # (fa, fr, threshold)
    for t in thresholds:
        fr = sum(1 for s in same_scores if s < t) / len(same_scores)
        fa = sum(1 for s in diff_scores if s >= t) / len(diff_scores)
        if abs(fa - fr) < abs(best[0] - best[1]):
            best = (fa, fr, t)
    return (best[0] + best[1]) / 2, best[2]
```

回傳 (eer, threshold_at_eer)。兩個都要報。

### 步驟 4：用 SpeechBrain 做正式環境

```python
from speechbrain.pretrained import EncoderClassifier

clf = EncoderClassifier.from_hparams(source="speechbrain/spkrec-ecapa-voxceleb")

# enroll: average the embeddings of 3-5 clean samples
enroll = torch.stack([clf.encode_batch(load(x)) for x in enrollment_clips]).mean(0)
# verify
score = clf.similarity(enroll, clf.encode_batch(load("test.wav"))).item()
verdict = score > 0.25   # ECAPA typical threshold; tune on your data
```

### 步驟 5：用 pyannote 做語者分離

```python
from pyannote.audio import Pipeline

pipe = Pipeline.from_pretrained("pyannote/speaker-diarization-3.1")
diarization = pipe("meeting.wav", num_speakers=None)
for turn, _, speaker in diarization.itertracks(yield_label=True):
    print(f"{turn.start:.1f}–{turn.end:.1f}  {speaker}")
```

## Use It｜實際應用

2026 年的堆疊：

| 情況 | 挑 |
|-----------|------|
| 封閉集合、1 對 1 驗證、邊緣 | ECAPA-TDNN 加餘弦閾值 |
| 開放集合驗證、雲端 | WavLM-SV 加 AS-norm |
| 語者分離（會議、podcast） | `pyannote/speaker-diarization-3.1` |
| 反仿冒（重播／深偽偵測） | AASIST 或 RawNet2 |
| 很小的裝置（關鍵詞加註冊） | Titanet-Small（NeMo） |

## Pitfalls｜容易踩的坑

- **通道不合。** 在 VoxCeleb（網頁影片）上訓練的模型，不等於電話音訊。一定要在目標通道上評估。
- **短語句。** 測試音訊低於 3 秒，EER 會急劇變差。
- **註冊時有雜訊。** 單次含雜訊的註冊會污染參考 embedding。用至少 3 段乾淨樣本再平均。
- **各種條件共用一個固定閾值。** 一定要在目標領域的留出開發集上調閾值。
- **在沒有正規化的 embedding 上算餘弦。** 先做 L2 正規化。否則幅度會主導。

## Ship It｜交付成果

存成 `outputs/skill-speaker-verifier.md`。挑模型、註冊協定、閾值調校計畫，以及防詐措施。

## Exercises｜練習

1. **簡單。** 跑 `code/main.py`。它做合成的「語者」（不同的音色），註冊，並在 100 對的試驗清單上算 EER。
2. **中等。** 用 SpeechBrain 的 ECAPA，在 30 句 VoxCeleb1 上（5 位語者各 6 句）算 EER。比較餘弦和 PLDA。
3. **困難。** 用 `pyannote.audio` 做完整的註冊、分離、驗證管線。在 AMI 開發集上評估 DER。

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|-----------------|-----------------------|
| EER | 標題指標 | 錯誤接受等於錯誤拒絕的那個閾值。 |
| 驗證 | 1 對 1 | 「這是 Alice 嗎？」 |
| 識別 | 1 對 N | 「誰在說話？」 |
| 開放集合 | 可能有未知的人 | 測試集可以有沒註冊的語者。 |
| 註冊 | 登錄 | 算出語者的參考 embedding。 |
| AAM-softmax | 那個損失 | 帶加性角度邊界的 softmax。強迫群分開。 |
| PLDA | 傳統評分 | 機率 LDA。在 embedding 上做概似比評分。 |
| DER | 分離指標 | 語者分離錯誤率。漏掉加誤報加混淆。 |

## Further Reading｜延伸閱讀

- [Snyder et al. (2018). X-Vectors: Robust DNN Embeddings for Speaker Recognition](https://www.danielpovey.com/files/2018_icassp_xvectors.pdf) ——傳統的深度 embedding 論文。
- [Desplanques et al. (2020). ECAPA-TDNN](https://arxiv.org/abs/2005.07143) ——2020 到 2026 的主導架構。
- [Chen et al. (2022). WavLM: Large-Scale Self-Supervised Pre-Training for Full Stack Speech Processing](https://arxiv.org/abs/2110.13900) ——語者驗證和分離的自監督骨幹。
- [Bredin et al. (2023). pyannote.audio 3.1](https://github.com/pyannote/pyannote-audio) ——正式環境的分離加 embedding 堆疊。
- [VoxCeleb leaderboard (updated 2026)](https://www.robots.ox.ac.uk/~vgg/data/voxceleb/) ——各模型目前的 EER 排名。
