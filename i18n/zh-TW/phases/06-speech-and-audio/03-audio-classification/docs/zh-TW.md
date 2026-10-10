# 音訊分類：從 MFCC 上的 k-NN 到 AST 與 BEATs

> 從「狗叫對上警笛」到「這是哪一種語言」，都是音訊分類。特徵是 mel。架構每十年換一次。評估仍然是 AUC、F1，以及每一類的召回率。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 6 · 02 (Spectrograms & Mel), Phase 3 · 06 (CNNs), Phase 5 · 08 (CNNs & RNNs for Text)
**Time:** ~75 minutes

## The Problem｜問題

你拿到一段 10 秒的片段。你想知道：「這是什麼？」都市聲音（警笛、鑽孔、狗）、語音指令（yes／no／stop）、語言識別（en／es／ar）、說話人情緒（生氣／中性），或環境聲（室內／室外、嘈雜人聲）。這些都是*音訊分類*。2026 年的基準（baseline）架構已經成熟：對數 mel，到 CNN 或 transformer，再到 softmax。

核心難點不是網路。是資料。音訊資料集的類別極不平衡，領域偏移明顯（乾淨音訊與雜訊音訊），標籤有雜訊（誰決定「都市嘈雜」對上「餐廳噪音」？）。問題的八成是整理、增強和評估，不是把 CNN 換成 transformer。

## The Concept｜核心概念

![Audio classification ladder: k-NN on MFCCs to AST to BEATs](../assets/audio-classification.svg)

**MFCC 上的 k-NN（1990 年代的基準模型）。** 把每一段的 MFCC 攤平，與已標註的資料庫計算餘弦相似度（cosine similarity），再以前 K 名的多數決分類。在乾淨、小的資料集（Speech Commands、ESC-50）上意外地強。不用 GPU。

**對數 mel 上的 2D CNN（2015 到 2019）。** 把 `(T, n_mels)` 的對數 mel 當成影像。用 ResNet-18 或 VGG 風格。時間軸做全域平均池化。類別上做 softmax。2026 年大多數 kaggle 比賽裡，這仍然是基準模型。

**音訊頻譜圖 transformer，AST（2021 到 2024）。** 把對數 mel 切成小塊（例如 16×16），加上位置 embedding，送進 ViT。監督式學習（supervised learning）在 AudioSet 上是當時最好（mAP 0.485）。

**BEATs 和 WavLM-base（2024 到 2026）。** 在數百萬小時上做自監督預訓練。再用你本來需要的監督資料的 1% 到 10% 來 fine-tune。2026 年，非語音音訊的預設起點是這個。BEATs-iter3 在 AudioSet 上比 AST 高 1 到 2 個 mAP，計算量只有四分之一。

**凍結的 Whisper 編碼器當骨幹（2024）。** 拿 Whisper 的編碼器，拿掉解碼器，接一個線性分類器。語言識別和簡單事件分類上接近目前最好，而且完全不用音訊增強。這是「白送」的基準模型。

### 真正的挑戰是類別不平衡（class imbalance）

ESC-50：50 類，每類 40 段，平衡，容易。UrbanSound8K：10 類，不平衡到 10 比 1。AudioSet：632 類，長尾到 100,000 比 1。行得通的做法：

- 訓練時使用平衡抽樣（balanced sampling），評估時不用。
- Mixup：把兩段片段和它們的標籤線性內插，當增強。
- SpecAugment：遮掉隨機的時間帶和頻率帶。簡單，但是要緊。

### 評估

- 互斥的多類（Speech Commands）：top-1 準確率、top-5 準確率。
- 多標籤的多類（AudioSet、UrbanSound 風格）：平均精確率均值（mAP）。
- 嚴重不平衡：每一類的召回率加巨觀 F1（macro-F1）。

2026 年你該知道的數字：

| 基準 | 基準模型 | 2026 目前最好 | 來源 |
|-----------|----------|-----------|--------|
| ESC-50 | 82%（AST） | 97.0%（BEATs-iter3） | BEATs 論文（2024） |
| AudioSet mAP | 0.485（AST） | 0.548（BEATs-iter3） | HEAR 排行榜 2026 |
| Speech Commands v2 | 98%（CNN） | 99.0%（Audio-MAE） | HEAR v2 結果 |

```figure
mfcc-pipeline
```

## Build It｜動手實作

### 步驟 1：做特徵

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

簡單但強：沿時間的平均加變異，給 13 係數 MFCC 一個 26 維的固定 embedding。馬上跑完。直到 2017 年，這種方法在 ESC-50 上仍勝過當時最佳的神經網路基準。

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

### 步驟 4：升級成對數 mel 上的 CNN

在 PyTorch：

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

300 萬參數（parameter）。ESC-50 上一張 RTX 4090 大約 10 分鐘訓完。準確率 80% 以上。

### 步驟 5：fine-tune 預訓練的音訊 transformer（這裡用 AST）

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

這個例子從 Hub fine-tune AST。2026 年的預設 BEATs 不在 Hugging Face Hub 上：從 [BEATs release in microsoft/unilm](https://github.com/microsoft/unilm/tree/master/beats) 下載檢查點，用那個儲存庫的 `BEATs` 和 `BEATsConfig` 類別載入。fine-tuning 迴圈的形狀相同。

## Use It｜實際應用

2026 年的堆疊：

| 情況 | 從這裡開始 |
|-----------|-----------|
| 很小的資料集（不到 1000 段） | MFCC 平均上的 k-NN（你的基準模型）加音訊增強 |
| 中等資料集（1,000 到 10 萬） | BEATs 或 AST fine-tune |
| 大資料集（超過 10 萬） | 從零訓練，或 fine-tune Whisper 編碼器 |
| 即時、邊緣 | 40 個 MFCC 的 CNN，量化成 int8（關鍵詞偵測風格） |
| 多標籤（AudioSet） | BEATs-iter3，BCE 損失加 mixup 加 SpecAugment |
| 語言識別 | MMS-LID、SpeechBrain VoxLingua107 基準模型 |

決策規則：**從凍結的骨幹開始，不要從全新的模型開始**。只要 fine-tune BEATs 的分類頭，幾小時內就能達到 SOTA 表現的 95%，不用幾週。

## Ship It｜交付成果

存成 `outputs/skill-classifier-designer.md`。依給定的音訊分類任務，挑架構、增強、類別平衡策略，以及評估指標。

## Exercises｜練習

1. **簡單。** 跑 `code/main.py`。它在 4 類合成資料集（不同音高的純音）上訓練 k-NN MFCC 基準模型。回報混淆矩陣（confusion matrix）。
2. **中等。** 把 `summarize` 換成［平均、變異、偏度、峰度］。在同一份合成資料集上，四階動差池化會不會贏過平均加變異？
3. **困難。** 用 `torchaudio` 在 ESC-50 第 1 折上訓練 2D CNN。回報 5 折交叉驗證（cross-validation）準確率。加上 SpecAugment（時間遮罩 20、頻率遮罩 10），回報差多少。

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|-----------------|-----------------------|
| AudioSet | 音訊的 ImageNet | Google 的 200 萬段、632 類、弱標籤的 YouTube 資料集。 |
| ESC-50 | 小的分類基準 | 50 類乘 40 段環境聲。 |
| AST | 音訊頻譜圖 transformer | 對數 mel 小塊上的 ViT。2021 年的目前最好。 |
| BEATs | 自監督音訊 | Microsoft 的模型。iter3 到 2026 年在 AudioSet 領先。 |
| Mixup | 成對增強 | `x = λ·x1 + (1-λ)·x2; y = λ·y1 + (1-λ)·y2`。 |
| SpecAugment | 以遮罩為基礎的增強 | 把頻譜圖上隨機的時間帶和頻率帶歸零。 |
| mAP | 主要的多標籤指標 | 跨類別和閾值的平均精確率均值。 |

## Further Reading｜延伸閱讀

- [Gong, Chung, Glass (2021). AST: Audio Spectrogram Transformer](https://arxiv.org/abs/2104.01778) ——2021 到 2024 的紀錄架構。
- [Chen et al. (2022, rev. 2024). BEATs: Audio Pre-Training with Acoustic Tokenizers](https://arxiv.org/abs/2212.09058) ——2024 年之後的預設。
- [Park et al. (2019). SpecAugment](https://arxiv.org/abs/1904.08779) ——主力的音訊增強。
- [Piczak (2015). ESC-50 dataset](https://github.com/karolpiczak/ESC-50) ——50 類基準，現在還在。
- [Gemmeke et al. (2017). AudioSet](https://research.google.com/audioset/) ——632 類的 YouTube 分類。仍然是黃金標準。
