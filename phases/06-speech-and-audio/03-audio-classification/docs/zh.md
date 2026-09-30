# 音訊分類 —— 從 MFCC 上的 k-NN 到 AST 與 BEATs

> 從「狗叫聲對警笛聲」到「這是哪一種語言」，全都是音訊分類。特徵是梅爾。架構每十年換一輪。評估始終是 AUC、F1 與各類別的召回率。

**類型：** 實作
**程式語言：** Python
**先修單元：** 階段 6 · 02（頻譜圖與梅爾）、階段 3 · 06（CNN）、階段 5 · 08（用於文字的 CNN 與 RNN）
**時間：** 約 75 分鐘

## 問題所在

你拿到一段 10 秒的片段。你想知道：「這是什麼？」都市聲音（警笛、電鑽、狗）、語音指令（yes/no/stop）、語言識別（en/es/ar）、說話人情緒（憤怒／中性），或是環境音（室內／室外、人聲嘈雜）。這些全都是*音訊分類*，而 2026 年的基準架構已經成熟：對數梅爾 → CNN 或 Transformer → softmax。

核心困難不在網路，而在資料。音訊資料集有殘暴的類別不平衡、強烈的領域偏移（乾淨對吵雜），以及標籤噪音（誰決定那是「都市嘈雜聲」還是「餐廳噪音」？）。這個問題有 80% 在於資料整理、資料增強與評估，而不是把 CNN 換成 Transformer。

## 核心概念

![音訊分類的階梯：從 MFCC 上的 k-NN 到 AST 再到 BEATs](../assets/audio-classification.svg)

**MFCC 上的 k-NN（1990 年代的基準線）。** 把每段片段的 MFCC 攤平，跟一個有標籤的資料庫算餘弦相似度，回傳前 K 名的多數投票結果。在乾淨的小資料集上（Speech Commands、ESC-50）強得出乎意料。不需要 GPU 就能跑。

**對數梅爾上的 2D CNN（2015-2019）。** 把 `(T, n_mels)` 的對數梅爾當成一張影像。套上 ResNet-18 或 VGG 風格的架構。對時間軸做全域平均池化。對類別做 softmax。在 2026 年大多數的 kaggle 競賽裡仍是基準線。

**Audio Spectrogram Transformer，AST（2021-2024）。** 把對數梅爾切成小塊（例如 16×16 的 patch），加上位置嵌入，餵給一個 ViT。在監督式學習中，這是 AudioSet 上的最佳表現（mAP 0.485）。

**BEATs 與 WavLM-base（2024-2026）。** 用數百萬小時的資料做自監督預訓練。在你的任務上微調時，只需要原本所需監督資料的 1-10%。2026 年這是非語音音訊的預設起點。BEATs-iter3 在 AudioSet 上以 1/4 的運算量比 AST 高出 1-2 mAP。

**把 Whisper 編碼器當成凍結的骨幹（2024）。** 拿 Whisper 的編碼器，丟掉解碼器，接一個線性分類器。在語言識別與簡單的事件分類上，不做任何音訊增強就能逼近 SOTA。這就是「免費午餐」等級的基準線。

### 類別不平衡才是真正的挑戰

ESC-50：50 個類別，每類 40 段片段 —— 平衡、簡單。UrbanSound8K：10 個類別，不平衡程度 10:1。AudioSet：632 個類別，長尾比達 100,000:1。有效的技巧：

- 訓練時做平衡取樣（評估時不要）。
- Mixup：把兩段片段（及其標籤）線性內插，當成資料增強。
- SpecAugment：隨機遮蔽時間帶與頻率帶。簡單；但關鍵。

### 評估

- 多類別互斥（Speech Commands）：top-1 準確率、top-5 準確率。
- 多類別多標籤（AudioSet、UrbanSound 這一類）：平均精度均值（mAP）。
- 嚴重不平衡：各類別召回率 + macro F1。

2026 年你該知道的數字：

| 基準測試 | 基準線 | 2026 年 SOTA | 來源 |
|-----------|----------|-----------|--------|
| ESC-50 | 82%（AST） | 97.0%（BEATs-iter3） | BEATs 論文（2024） |
| AudioSet mAP | 0.485（AST） | 0.548（BEATs-iter3） | HEAR 排行榜 2026 |
| Speech Commands v2 | 98%（CNN） | 99.0%（Audio-MAE） | HEAR v2 結果 |

```figure
mfcc-pipeline
```

## 動手實作

### 步驟 1：特徵化

```python
def featurize_mfcc(signal, sr, n_mfcc=13, n_mels=40, frame_len=400, hop=160):
    mag = stft_magnitude(signal, frame_len, hop)
    fb = mel_filterbank(n_mels, frame_len, sr)
    mels = apply_filterbank(mag, fb)
    log = log_transform(mels)
    return [dct_ii(frame, n_mfcc) for frame in log]
```

### 步驟 2：固定長度的摘要

```python
def summarize(mfcc_frames):
    n = len(mfcc_frames[0])
    mean = [sum(f[i] for f in mfcc_frames) / len(mfcc_frames) for i in range(n)]
    var = [
        sum((f[i] - mean[i]) ** 2 for f in mfcc_frames) / len(mfcc_frames) for i in range(n)
    ]
    return mean + var
```

簡單但夠強：沿時間軸取平均 + 變異數，就把 13 個係數的 MFCC 變成一個 26 維的固定嵌入。瞬間就跑完。直到 2017 年，它在 ESC-50 上都還打得贏當時最好的神經網路基準線。

### 步驟 3：k-NN

```python
def cosine(a, b):
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a)) or 1e-12
    nb = math.sqrt(sum(x * x for x in b)) or 1e-12
    return dot / (na * nb)

def knn_classify(q, bank, labels, k=5):
    sims = sorted(range(len(bank)), key=lambda i: -cosine(q, bank[i]))[:k]
    votes = Counter(labels[i] for i in sims)
    return votes.most_common(1)[0][0]
```

### 步驟 4：升級成吃對數梅爾的 CNN

用 PyTorch：

```python
import torch.nn as nn

class AudioCNN(nn.Module):
    def __init__(self, n_mels=80, n_classes=50):
        super().__init__()
        self.body = nn.Sequential(
            nn.Conv2d(1, 32, 3, padding=1), nn.ReLU(), nn.MaxPool2d(2),
            nn.Conv2d(32, 64, 3, padding=1), nn.ReLU(), nn.MaxPool2d(2),
            nn.Conv2d(64, 128, 3, padding=1), nn.ReLU(),
            nn.AdaptiveAvgPool2d(1),
        )
        self.head = nn.Linear(128, n_classes)

    def forward(self, x):  # x: (B, 1, T, n_mels)
        return self.head(self.body(x).flatten(1))
```

300 萬個參數。用單張 RTX 4090 在 ESC-50 上約 10 分鐘就訓練完。準確率 80% 以上。

### 步驟 5：微調一個預訓練的音訊 transformer（以 AST 示範）

```python
from transformers import ASTFeatureExtractor, ASTForAudioClassification

ext = ASTFeatureExtractor.from_pretrained("MIT/ast-finetuned-audioset-10-10-0.4593")
model = ASTForAudioClassification.from_pretrained(
    "MIT/ast-finetuned-audioset-10-10-0.4593",
    num_labels=50,
    ignore_mismatched_sizes=True,
)

inputs = ext(audio, sampling_rate=16000, return_tensors="pt")
logits = model(**inputs).logits
```

這個範例從 Hub 微調 AST。BEATs 是 2026 年的預設選擇，但它不在 Hugging Face Hub 上：請從 [microsoft/unilm 裡的 BEATs 發布](https://github.com/microsoft/unilm/tree/master/beats) 下載檢查點，再用那個 repo 的 `BEATs` 與 `BEATsConfig` 類別載入；微調迴圈的形狀不變。

## 框架應用

2026 年的那一套：

| 情境 | 從什麼開始 |
|-----------|-----------|
| 極小資料集（<1000 段片段） | MFCC 平均值上的 k-NN（你的基準線）+ 音訊增強 |
| 中型資料集（1K–100K） | 微調 BEATs 或 AST |
| 大型資料集（>100K） | 從零訓練，或微調 Whisper 編碼器 |
| 即時、邊緣裝置 | 40 維 MFCC 的 CNN，量化到 int8（KWS 風格） |
| 多標籤（AudioSet） | BEATs-iter3 搭配 BCE 損失 + mixup + SpecAugment |
| 語言識別 | MMS-LID、SpeechBrain VoxLingua107 基準線 |

決策原則：**從凍結的骨幹開始，不要從全新的模型開始**。微調一個 BEATs 的分類頭，幾小時就能拿到 SOTA 的 95%，不用幾週。

## 產出交付

存成 `outputs/skill-classifier-designer.md`。針對指定的音訊分類任務，挑選架構、資料增強、類別平衡策略與評估指標。

## 練習

1. **簡單。** 跑 `code/main.py`。它會在一個 4 類別的合成資料集（不同音高的純音）上訓練 MFCC 的 k-NN 基準線。報告混淆矩陣。
2. **中等。** 把 `summarize` 換成 [mean, var, skew, kurtosis]。在同一個合成資料集上，四階動差池化有打贏平均 + 變異數嗎？
3. **困難。** 用 `torchaudio` 在 ESC-50 的 fold 1 上訓練一個 2D CNN。報告 5 折交叉驗證的準確率。加上 SpecAugment（time mask = 20、freq mask = 10），並報告差值。

## 關鍵術語

| 術語 | 大家怎麼說 | 實際上是什麼 |
|------|-----------------|-----------------------|
| AudioSet | 音訊界的 ImageNet | Google 的 200 萬段片段、632 類別的弱標籤 YouTube 資料集。 |
| ESC-50 | 小型分類基準測試 | 50 個類別 × 每類 40 段環境音片段。 |
| AST | Audio Spectrogram Transformer | 吃對數梅爾 patch 的 ViT；2021 年的 SOTA。 |
| BEATs | 自監督音訊模型 | 微軟的模型，到 2026 年 iter3 仍在 AudioSet 上領先。 |
| Mixup | 成對增強 | `x = λ·x1 + (1-λ)·x2; y = λ·y1 + (1-λ)·y2`。 |
| SpecAugment | 基於遮蔽的增強 | 把頻譜圖上隨機的時間帶與頻率帶歸零。 |
| mAP | 多標籤的主要指標 | 跨類別與跨閾值的平均精度均值。 |

## 延伸閱讀

- [Gong, Chung, Glass (2021). AST: Audio Spectrogram Transformer](https://arxiv.org/abs/2104.01778) —— 2021–2024 年具代表性的架構。
- [Chen et al. (2022, rev. 2024). BEATs: Audio Pre-Training with Acoustic Tokenizers](https://arxiv.org/abs/2212.09058) —— 2024 年之後的預設選擇。
- [Park et al. (2019). SpecAugment](https://arxiv.org/abs/1904.08779) —— 音訊增強的主流做法。
- [Piczak (2015). ESC-50 dataset](https://github.com/karolpiczak/ESC-50) —— 屹立不搖的 50 類別基準測試。
- [Gemmeke et al. (2017). AudioSet](https://research.google.com/audioset/) —— 632 類別的 YouTube 分類體系；仍是黃金標準。
