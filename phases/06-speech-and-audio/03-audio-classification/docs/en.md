# 音声分類 — MFCC 上の k-NN から AST と BEATs まで

> "dog barking vs siren" から "which language is this" まで、すべて音声分類です。特徴量は mels。アーキテクチャは時代ごとに移り変わります。評価は AUC、F1、per-class recall のままです。

**種別:** 構築
**言語:** Python
**前提条件:** Phase 6 · 02 (Spectrograms & Mel), Phase 3 · 06 (CNNs), Phase 5 · 08 (CNNs & RNNs for Text)
**所要時間:** 約75分

## 問題

10 秒のクリップを受け取ります。知りたいのは「これは何か」です。都市音 (サイレン、ドリル、犬)、音声コマンド (yes/no/stop)、言語 ID (en/es/ar)、話者感情 (angry/neutral)、環境音 (indoor/outdoor、babble) などがあります。これらはすべて *audio classification* であり、2026 年のベースラインアーキテクチャは成熟しています: log-mel → CNN または Transformer → softmax。

中心的な難しさはネットワークではありません。データです。音声データセットには、厳しいクラス不均衡、強いドメインシフト (クリーン vs ノイズあり)、ラベルノイズ (誰が "urban babble" と "restaurant noise" を決めたのか) があります。問題の 80% は CNN を Transformer に替えることではなく、キュレーション、augmentation、評価です。

## 概念

![音声分類の段階: MFCC 上の k-NN から AST、BEATs へ](../assets/audio-classification.svg)

**MFCC 上の k-NN (1990 年代のベースライン)。** クリップごとに MFCC を平坦化し、ラベル付きバンクとの cosine similarity を計算し、上位 K の多数決を返します。クリーンで小さなデータセット (Speech Commands, ESC-50) では驚くほど強力です。GPU なしで動きます。

**log-mels 上の 2D CNN (2015-2019)。** `(T, n_mels)` の log-mel を画像として扱います。ResNet-18 や VGG 風のモデルを適用します。時間軸を global mean pool します。クラスに対して softmax します。2026 年の kaggle 競技の多くで今もベースラインです。

**Audio Spectrogram Transformer, AST (2021-2024)。** Log-mel を patchify し (例: 16×16 patches)、位置埋め込みを加えて ViT に渡します。教師あり学習では AudioSet で state of the art (mAP 0.485) でした。

**BEATs と WavLM-base (2024-2026)。** 数百万時間で自己教師あり事前学習します。タスクに fine-tune すると、従来必要だった教師ありデータの 1-10% で済みます。2026 年には、非音声音声のデフォルト出発点です。BEATs-iter3 は、計算量を 1/4 にしながら AudioSet で AST を 1-2 mAP 上回ります。

**凍結バックボーンとしての Whisper-encoder (2024)。** Whisper の encoder を取り出し、decoder を捨て、線形分類器を付けます。言語 ID や単純なイベント分類で、音声 augmentation なしでも SOTA 近辺に届きます。「無料の昼食」ベースラインです。

### クラス不均衡が本当の課題

ESC-50: 50 クラス、各 40 クリップ。バランスしていて簡単です。UrbanSound8K: 10 クラス、10:1 の不均衡。AudioSet: 632 クラス、100,000:1 のロングテール。有効な手法:

- 学習時の balanced sampling (評価では使わない)。
- Mixup: 2 つのクリップ (とそのラベル) を線形補間する augmentation。
- SpecAugment: ランダムな時間帯と周波数帯をマスクします。単純ですが重要です。

### 評価

- 排他的 multiclass (Speech Commands): top-1 accuracy、top-5 accuracy。
- multi-label multiclass (AudioSet, UrbanSound-style): mean average precision (mAP)。
- 強い不均衡: per-class recall + macro F1。

知っておくべき 2026 年の数値:

| ベンチマーク | ベースライン | SOTA 2026 | 出典 |
|-----------|----------|-----------|--------|
| ESC-50 | 82% (AST) | 97.0% (BEATs-iter3) | BEATs paper (2024) |
| AudioSet mAP | 0.485 (AST) | 0.548 (BEATs-iter3) | HEAR leaderboard 2026 |
| Speech Commands v2 | 98% (CNN) | 99.0% (Audio-MAE) | HEAR v2 results |

## 作る

### 手順 1: 特徴量化する

```python
def featurize_mfcc(signal, sr, n_mfcc=13, n_mels=40, frame_len=400, hop=160):
    mag = stft_magnitude(signal, frame_len, hop)
    fb = mel_filterbank(n_mels, frame_len, sr)
    mels = apply_filterbank(mag, fb)
    log = log_transform(mels)
    return [dct_ii(frame, n_mfcc) for frame in log]
```

### 手順 2: 固定長の要約

```python
def summarize(mfcc_frames):
    n = len(mfcc_frames[0])
    mean = [sum(f[i] for f in mfcc_frames) / len(mfcc_frames) for i in range(n)]
    var = [
        sum((f[i] - mean[i]) ** 2 for f in mfcc_frames) / len(mfcc_frames) for i in range(n)
    ]
    return mean + var
```

単純ですが強力です。時間方向の平均 + 分散により、13 係数 MFCC から 26 次元の固定埋め込みが得られます。即座に動きます。2017 年頃でさえ、ESC-50 で最新 NN ベースラインに勝っていました。

### 手順 3: k-NN

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

### 手順 4: log-mels 上の CNN にアップグレードする

PyTorch では:

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

3M パラメータです。単一 RTX 4090 なら ESC-50 を約 10 分で学習します。精度は 80%+ です。

### 手順 5: 2026 年のデフォルト — BEATs を fine-tune する

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

BEATs では `beats` ライブラリ経由で `microsoft/BEATs-base` を使います。transformers API は同じ形です。

## 使う

2026 年のスタック:

| 状況 | 出発点 |
|-----------|-----------|
| Tiny dataset (<1000 clips) | MFCC mean 上の k-NN (自分のベースライン) + audio augmentation |
| Medium dataset (1K–100K) | BEATs または AST fine-tune |
| Large dataset (>100K) | ゼロから学習、または Whisper-encoder fine-tune |
| Real-time, edge | 40-MFCC CNN、int8 量子化 (KWS-style) |
| Multi-label (AudioSet) | BEATs-iter3 with BCE loss + mixup + SpecAugment |
| Language ID | MMS-LID, SpeechBrain VoxLingua107 baseline |

判断規則: **新しいモデルではなく、凍結バックボーンから始める**。BEATs の head を fine-tuning すれば、数週間ではなく数時間で SOTA の 95% に到達できます。

## 出荷する

`outputs/skill-classifier-designer.md` として保存します。指定された音声分類タスクに対して、architecture、augmentations、class-balance strategy、eval metric を選びます。

## 演習

1. **Easy.** `code/main.py` を実行します。4 クラスの合成データセット (異なるピッチの純音) で k-NN MFCC ベースラインを学習します。confusion matrix を報告します。
2. **Medium.** `summarize` を [mean, var, skew, kurtosis] に置き換えます。同じ合成データセットで 4-moment pooling は mean+var に勝ちますか。
3. **Hard.** `torchaudio` を使って ESC-50 fold 1 上で 2D CNN を学習します。5-fold cross-validation accuracy を報告します。SpecAugment (time mask = 20, freq mask = 10) を追加し、差分を報告します。

## 重要用語

| 用語 | よく言われる説明 | 実際の意味 |
|------|-----------------|-----------------------|
| AudioSet | 音声の ImageNet | Google の 2M-clip、632-class の弱ラベル付き YouTube データセット。 |
| ESC-50 | 小さな分類ベンチマーク | 環境音 50 classes × 40 clips。 |
| AST | Audio Spectrogram Transformer | log-mel patches 上の ViT。2021 年の SOTA。 |
| BEATs | 自己教師あり audio | Microsoft モデル。2026 年時点で iter3 が AudioSet をリード。 |
| Mixup | ペア augmentation | `x = λ·x1 + (1-λ)·x2; y = λ·y1 + (1-λ)·y2`。 |
| SpecAugment | マスクベースの augmentation | スペクトログラムのランダムな時間帯と周波数帯をゼロにします。 |
| mAP | 主要な multi-label metric | クラスと閾値にわたる mean average precision。 |

## 参考資料

- [Gong, Chung, Glass (2021). AST: Audio Spectrogram Transformer](https://arxiv.org/abs/2104.01778) — 2021–2024 年の代表的アーキテクチャ。
- [Chen et al. (2022, rev. 2024). BEATs: Audio Pre-Training with Acoustic Tokenizers](https://arxiv.org/abs/2212.09058) — 2024 年以降のデフォルト。
- [Park et al. (2019). SpecAugment](https://arxiv.org/abs/1904.08779) — 支配的な音声 augmentation。
- [Piczak (2015). ESC-50 dataset](https://github.com/karolpiczak/ESC-50) — 今も使われる 50-class benchmark。
- [Gemmeke et al. (2017). AudioSet](https://research.google.com/audioset/) — 632-class YouTube taxonomy。今も gold standard です。
