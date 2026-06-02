# 音频分类——从 MFCC 上的 k-NN 到 AST 与 BEATs

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 从「狗叫还是警笛」到「这是哪种语言」，统统都是音频分类。特征始终是 mel；架构每十年换一茬；评估指标始终是 AUC、F1，以及每一类的 recall。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 6 · 02 (Spectrograms & Mel), Phase 3 · 06 (CNNs), Phase 5 · 08 (CNNs & RNNs for Text)
**Time:** ~75 minutes

## 问题（Problem）

你拿到一段 10 秒的音频片段，想知道：「这是什么？」城市声响（警笛、电钻、狗叫）、语音命令（yes/no/stop）、语种识别（en/es/ar）、说话人情绪（愤怒/中性），或环境声（室内/室外、嘈杂人声）。这些全都属于*音频分类*；到了 2026 年，基线架构已经非常成熟：log-mel → CNN 或 Transformer → softmax。

核心难点不在网络，而在数据。音频数据集普遍存在严重的类别失衡、强烈的领域漂移（干净 vs 嘈杂），以及标签噪声（到底是「城市嘈杂声」还是「餐馆背景噪声」？谁说了算？）。问题的 80% 在于数据策划、增强与评估，而不是把 CNN 换成 Transformer。

## 概念（Concept）

![Audio classification ladder: k-NN on MFCCs to AST to BEATs](../assets/audio-classification.svg)

**MFCC 上的 k-NN（1990 年代基线）。** 把每段片段的 MFCC 拍平，对一个有标签的样本库计算余弦相似度，然后取 top-K 多数投票。在干净、小规模数据集（Speech Commands、ESC-50）上意外地强，而且不用 GPU 就能跑。

**log-mel 上的 2D CNN（2015–2019）。** 把 `(T, n_mels)` 的 log-mel 当成一张图片，套上 ResNet-18 或 VGG 风格网络，沿时间轴做全局平均池化，再 softmax 分类。直到 2026 年，这仍是大多数 Kaggle 比赛的基线。

**Audio Spectrogram Transformer（AST，2021–2024）。** 把 log-mel 切成 patch（比如 16×16），加上位置编码，喂给一个 ViT。在 AudioSet 上达到了监督学习的 SOTA（mAP 0.485）。

**BEATs 与 WavLM-base（2024–2026）。** 在数百万小时音频上做自监督预训练，再用你任务上 1–10% 的监督数据 fine-tune（微调）。到了 2026 年，这是非语音音频任务的默认起点。BEATs-iter3 在 AudioSet 上比 AST 高 1–2 mAP，而计算量只用了 1/4。

**把 Whisper encoder 当成冻结骨干（2024）。** 拿 Whisper 的 encoder，把 decoder 扔掉，接一个线性分类器。在语种识别和简单事件分类上无需任何音频增强就能逼近 SOTA。这是「免费午餐」级的基线。

### 类别失衡才是真正的挑战

ESC-50：50 类，每类 40 段——平衡，简单。UrbanSound8K：10 类，10:1 失衡。AudioSet：632 类，长尾比例高达 100,000:1。有效的技巧有：

- 训练时使用平衡采样（评估时不要这么做）。
- Mixup：把两段片段（连同标签）做线性插值作为数据增强。
- SpecAugment：随机遮挡时间段和频率带。简单，但至关重要。

### 评估（Evaluation）

- 多类互斥（Speech Commands）：top-1 准确率、top-5 准确率。
- 多类多标签（AudioSet、UrbanSound 风格）：平均精度均值（mAP）。
- 严重失衡：每类 recall + macro F1。

2026 年你应该知道的几个数字：

| Benchmark | Baseline | SOTA 2026 | Source |
|-----------|----------|-----------|--------|
| ESC-50 | 82% (AST) | 97.0% (BEATs-iter3) | BEATs paper (2024) |
| AudioSet mAP | 0.485 (AST) | 0.548 (BEATs-iter3) | HEAR leaderboard 2026 |
| Speech Commands v2 | 98% (CNN) | 99.0% (Audio-MAE) | HEAR v2 results |

## 动手实现（Build It）

### 第 1 步：特征提取（featurize）

```python
def featurize_mfcc(signal, sr, n_mfcc=13, n_mels=40, frame_len=400, hop=160):
    mag = stft_magnitude(signal, frame_len, hop)
    fb = mel_filterbank(n_mels, frame_len, sr)
    mels = apply_filterbank(mag, fb)
    log = log_transform(mels)
    return [dct_ii(frame, n_mfcc) for frame in log]
```

### 第 2 步：定长摘要（fixed-length summary）

```python
def summarize(mfcc_frames):
    n = len(mfcc_frames[0])
    mean = [sum(f[i] for f in mfcc_frames) / len(mfcc_frames) for i in range(n)]
    var = [
        sum((f[i] - mean[i]) ** 2 for f in mfcc_frames) / len(mfcc_frames) for i in range(n)
    ]
    return mean + var
```

简单但有效：在时间维上取 mean + variance，就能为 13 维 MFCC 得到一个 26 维的定长 embedding。瞬间跑完。直到 2017 年，这种做法在 ESC-50 上还能击败当时最强的神经网络基线。

### 第 3 步：k-NN

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

### 第 4 步：升级到 log-mel 上的 CNN

PyTorch 实现：

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

3M 参数。在单块 RTX 4090 上跑 ESC-50 大约 10 分钟。准确率 80%+。

### 第 5 步：2026 年的默认选项——fine-tune BEATs

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

如果用 BEATs，通过 `beats` 库加载 `microsoft/BEATs-base`；transformers 那套 API 形态完全一致。

## 用起来（Use It）

2026 年的技术栈：

| Situation | Start with |
|-----------|-----------|
| Tiny dataset (<1000 clips) | k-NN on MFCC means (your baseline) + audio augmentation |
| Medium dataset (1K–100K) | BEATs or AST fine-tune |
| Large dataset (>100K) | Train from scratch or fine-tune Whisper-encoder |
| Real-time, edge | 40-MFCC CNN, quantized to int8 (KWS-style) |
| Multi-label (AudioSet) | BEATs-iter3 with BCE loss + mixup + SpecAugment |
| Language ID | MMS-LID, SpeechBrain VoxLingua107 baseline |

决策原则：**先用冻结骨干，再考虑全新训练**。fine-tune 一个 BEATs head，几个小时就能拿到 SOTA 的 95%，而不是几个星期。

## 上线部署（Ship It）

存为 `outputs/skill-classifier-designer.md`。针对一个给定的音频分类任务，挑选架构、增强方式、类别平衡策略和评估指标。

## 练习（Exercises）

1. **简单。** 跑一下 `code/main.py`，它会在一个 4 类合成数据集（不同音高的纯音）上训练 MFCC + k-NN 基线。给出混淆矩阵。
2. **中等。** 把 `summarize` 替换成 [mean, var, skew, kurtosis]。在同一个合成数据集上，4 阶矩池化能否打败 mean+var？
3. **困难。** 用 `torchaudio` 在 ESC-50 fold 1 上训练一个 2D CNN，报告 5 折交叉验证准确率。再加上 SpecAugment（time mask = 20, freq mask = 10），报告增益。

## 关键术语（Key Terms）

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| AudioSet | 音频界的 ImageNet | Google 的 200 万段、632 类弱标注 YouTube 数据集。 |
| ESC-50 | 小型分类基准 | 50 类 × 每类 40 段环境声。 |
| AST | Audio Spectrogram Transformer | 在 log-mel patch 上跑 ViT；2021 年 SOTA。 |
| BEATs | 自监督音频模型 | 微软出品，iter3 截至 2026 年在 AudioSet 上领先。 |
| Mixup | 成对增强 | `x = λ·x1 + (1-λ)·x2; y = λ·y1 + (1-λ)·y2`。 |
| SpecAugment | 基于遮挡的增强 | 把频谱图上随机的时间和频率带置零。 |
| mAP | 多标签的主指标 | 跨类别和阈值的平均精度均值。 |

## 延伸阅读（Further Reading）

- [Gong, Chung, Glass (2021). AST: Audio Spectrogram Transformer](https://arxiv.org/abs/2104.01778)——2021–2024 年的标杆架构。
- [Chen et al. (2022, rev. 2024). BEATs: Audio Pre-Training with Acoustic Tokenizers](https://arxiv.org/abs/2212.09058)——2024 年起的默认选项。
- [Park et al. (2019). SpecAugment](https://arxiv.org/abs/1904.08779)——主流的音频数据增强方法。
- [Piczak (2015). ESC-50 dataset](https://github.com/karolpiczak/ESC-50)——经久不衰的 50 类基准。
- [Gemmeke et al. (2017). AudioSet](https://research.google.com/audioset/)——632 类 YouTube 分类体系；至今仍是金标准。
