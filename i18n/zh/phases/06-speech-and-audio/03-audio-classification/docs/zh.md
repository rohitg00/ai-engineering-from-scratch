# 音频分类 — 从基于 MFCC 的 k-NN 到 AST 与 BEATs

> 从"狗叫还是警报"到"这是哪种语言"，都属于音频分类。特征是梅尔谱。架构每隔十年就更换一次。但评估始终是 AUC、F1 和每类召回率。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 6 · 02（频谱图与 Mel）、Phase 3 · 06（CNN）、Phase 5 · 08（用于文本的 CNN 与 RNN）
**Time:** 约 75 分钟

## 问题

你拿到一段 10 秒的音频片段。你想知道："这是什么？"城市声音（警报、电钻、狗叫）、语音指令（是/否/停止）、语言识别（英/西/阿）、说话人情绪（愤怒/中性），或环境声音（室内/室外、嘈杂声）。这些都是*音频分类*，到 2026 年，基线架构已经成熟：log-mel → CNN 或 Transformer → softmax。

核心难点不在于网络，而在于数据。音频数据集存在严重的类别不平衡、强烈的域偏移（干净 vs 噪声）和标签噪声（谁来决定"城市嘈杂声"与"餐厅噪声"的区分？）。问题的 80% 在于数据整理、增强和评估，而不是把 CNN 换成 Transformer。

## 概念

![Audio classification ladder: k-NN on MFCCs to AST to BEATs](../assets/audio-classification.svg)

**基于 MFCC 的 k-NN（1990 年代基线）。** 将每个片段的 MFCC 展平，与带标签的样本库计算余弦相似度，返回前 K 个的多数投票。在干净的小数据集（Speech Commands、ESC-50）上表现出乎意料地强。无需 GPU 即可运行。

**基于 log-mel 的 2D CNN（2015–2019）。** 把 `(T, n_mels)` 的 log-mel 当作图像处理。使用 ResNet-18 或 VGG 风格的网络。对时间轴做全局平均池化。对类别做 softmax。这在大多数 2026 年的 Kaggle 竞赛中仍是基线。

**Audio Spectrogram Transformer，AST（2021–2024）。** 将 log-mel 切分为 patch（例如 16×16 的 patch），加上位置嵌入，输入 ViT。这是 AudioSet（mAP 0.485）上监督学习的最先进水平。

**BEATs 与 WavLM-base（2024–2026）。** 在数百万小时的音频上进行自监督预训练。只需原本监督学习所需数据的 1–10% 即可在你的任务上微调。到 2026 年，这是非语音音频的默认起点。BEATs-iter3 在 AudioSet 上比 AST 高出 1–2 mAP，且只用了 1/4 的算力。

**Whisper 编码器作为冻结主干（2024）。** 取 Whisper 的编码器，去掉解码器，接一个线性分类器。在零音频增强的条件下，在语言识别和简单事件分类上接近最先进水平。这是"免费午餐"式的基线。

### 类别不平衡才是真正的挑战

ESC-50：50 个类别，每类 40 个片段——均衡、容易。UrbanSound8K：10 个类别，不平衡比例 10:1。AudioSet：632 个类别，长尾比例高达 100,000:1。有效的技术：

- 训练时均衡采样（评估时不用）。
- Mixup：将两个片段（及其标签）做线性插值作为增强。
- SpecAugment：随机遮蔽时间段和频段。简单但至关重要。

### 评估

- 多分类互斥（Speech Commands）：top-1 准确率、top-5 准确率。
- 多分类多标签（AudioSet、UrbanSound 风格）：平均精度均值（mAP）。
- 严重不平衡：每类召回率 + 宏 F1。

2026 年你应该知道的数字：

| 基准 | 基线 | 2026 SOTA | 来源 |
|-----------|----------|-----------|--------|
| ESC-50 | 82%（AST） | 97.0%（BEATs-iter3） | BEATs 论文（2024） |
| AudioSet mAP | 0.485（AST） | 0.548（BEATs-iter3） | HEAR 排行榜 2026 |
| Speech Commands v2 | 98%（CNN） | 99.0%（Audio-MAE） | HEAR v2 结果 |

```figure
mfcc-pipeline
```

## 动手构建

### 第 1 步：特征化

```python
def featurize_mfcc(signal, sr, n_mfcc=13, n_mels=40, frame_len=400, hop=160):
    mag = stft_magnitude(signal, frame_len, hop)
    fb = mel_filterbank(n_mels, frame_len, sr)
    mels = apply_filterbank(mag, fb)
    log = log_transform(mels)
    return [dct_ii(frame, n_mfcc) for frame in log]
```

### 第 2 步：定长摘要

```python
def summarize(mfcc_frames):
    n = len(mfcc_frames[0])
    mean = [sum(f[i] for f in mfcc_frames) / len(mfcc_frames) for i in range(n)]
    var = [
        sum((f[i] - mean[i]) ** 2 for f in mfcc_frames) / len(mfcc_frames) for i in range(n)
    ]
    return mean + var
```

简单但强大：对时间维度取均值 + 方差，即可将 13 系数的 MFCC 转为 26 维的定长嵌入。运行瞬间完成。直到 2017 年，它还能在 ESC-50 上击败最先进的神经网络基线。

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

### 第 4 步：升级为基于 log-mel 的 CNN

在 PyTorch 中：

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

300 万参数。在单块 RTX 4090 上训练 ESC-50 约需 10 分钟。准确率 80% 以上。

### 第 5 步：2026 年的默认方案 — 微调 BEATs

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

对于 BEATs，通过 `beats` 库使用 `microsoft/BEATs-base`；transformers API 的形式相同。

## 实践应用

2026 年的技术选型：

| 场景 | 从这里开始 |
|-----------|-----------|
| 微型数据集（<1000 个片段） | 基于 MFCC 均值的 k-NN（你的基线）+ 音频增强 |
| 中型数据集（1K–100K） | BEATs 或 AST 微调 |
| 大型数据集（>100K） | 从头训练或微调 Whisper 编码器 |
| 实时、边缘设备 | 40-MFCC CNN，量化为 int8（KWS 风格） |
| 多标签（AudioSet） | BEATs-iter3 + BCE 损失 + mixup + SpecAugment |
| 语言识别 | MMS-LID、SpeechBrain VoxLingua107 基线 |

决策原则：**从冻结主干开始，而不是从头训练新模型**。微调一个 BEATs 头，几小时（而非几周）就能达到 SOTA 的 95%。

## 上线部署

保存为 `outputs/skill-classifier-designer.md`。为给定的音频分类任务选择架构、增强方法、类别平衡策略和评估指标。

## 练习

1. **简单。** 运行 `code/main.py`。它在一个 4 类合成数据集（不同音高的纯音）上训练 k-NN MFCC 基线。报告混淆矩阵。
2. **中等。** 将 `summarize` 替换为 [均值、方差、偏度、峰度]。在同一合成数据集上，4 矩量池化是否优于均值+方差？
3. **困难。** 使用 `torchaudio`，在 ESC-50 的第 1 折上训练一个 2D CNN。报告 5 折交叉验证的准确率。加入 SpecAugment（时间遮蔽 = 20，频率遮蔽 = 10）并报告提升幅度。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------------|-----------------------|
| AudioSet | 音频界的 ImageNet | Google 的 200 万片段、632 类弱标注 YouTube 数据集。 |
| ESC-50 | 小型分类基准 | 环境声音的 50 类 × 40 片段。 |
| AST | Audio Spectrogram Transformer | 基于log-mel patch 的 ViT；2021 年 SOTA。 |
| BEATs | 自监督音频 | Microsoft 的模型，截至 2026 年 iter3 领跑 AudioSet。 |
| Mixup | 成对增强 | `x = λ·x1 + (1-λ)·x2; y = λ·y1 + (1-λ)·y2`。 |
| SpecAugment | 基于遮蔽的增强 | 将频谱图上随机的时间段和频段置零。 |
| mAP | 主要的多标签指标 | 跨类别和阈值的平均精度均值。 |

## 延伸阅读

- [Gong, Chung, Glass (2021). AST: Audio Spectrogram Transformer](https://arxiv.org/abs/2104.01778) — 2021–2024 年间的事实标准架构。
- [Chen et al. (2022, rev. 2024). BEATs: Audio Pre-Training with Acoustic Tokenizers](https://arxiv.org/abs/2212.09058) — 2024 年起的默认选择。
- [Park et al. (2019). SpecAugment](https://arxiv.org/abs/1904.08779) — 占主导地位的音频增强方法。
- [Piczak (2015). ESC-50 dataset](https://github.com/karolpiczak/ESC-50) — 至今仍在使用的 50 类基准。
- [Gemmeke et al. (2017). AudioSet](https://research.google.com/audioset/) — 632 类的 YouTube 分类体系；仍是黄金标准。