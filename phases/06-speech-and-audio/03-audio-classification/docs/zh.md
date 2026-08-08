# 03 · 音频分类——从 MFCC 上的 k-NN 到 AST 与 BEATs

> 从「狗叫还是警笛」到「这是哪种语言」，全都是音频分类。特征是梅尔谱，架构每隔十年就换一茬，而评估始终是 AUC、F1 和各类别召回率。

**类型：** 实践构建
**语言：** Python
**前置：** 阶段 6 · 02（声谱图与梅尔频谱）、阶段 3 · 06（CNN）、阶段 5 · 08（用于文本的 CNN 与 RNN）
**时长：** 约 75 分钟

## 问题所在

你拿到一段 10 秒的音频片段，想知道：「这是什么？」城市声音（警笛、电钻、狗叫）、语音命令（yes/no/stop）、语言识别（en/es/ar）、说话人情绪（愤怒/中性），或环境声音（室内/室外、嘈杂人声）。这些全都属于*音频分类*，而在 2026 年其基线架构已经相当成熟：对数梅尔谱（log-mel）→ CNN 或 Transformer → softmax。

核心难点不在网络，而在数据。音频数据集存在极端的类别不平衡、强烈的「领域漂移（domain shift）」（干净 vs 嘈杂），以及标签噪声（究竟是谁判定这是「城市人声嘈杂」而不是「餐厅噪声」？）。问题的 80% 在于数据筛选、数据增强与评估，而不是把 CNN 换成 Transformer。

## 核心概念

〔图：音频分类技术阶梯——从 MFCC 上的 k-NN 到 AST 再到 BEATs〕

**MFCC 上的 k-NN（1990 年代基线）。** 把每段片段的 MFCC 展平，与一个带标签的样本库计算余弦相似度，返回前 K 个近邻的多数投票结果。在干净的小数据集（Speech Commands、ESC-50）上表现强得出人意料，且无需 GPU 即可运行。

**对数梅尔谱上的 2D CNN（2015–2019）。** 把形状为 `(T, n_mels)` 的对数梅尔谱当作一张图像，套用 ResNet-18 或 VGG 风格网络，在时间轴上做全局平均池化，再对类别做 softmax。在 2026 年多数 kaggle 竞赛中它仍是基线。

**音频声谱图 Transformer（Audio Spectrogram Transformer，AST，2021–2024）。** 把对数梅尔谱切成图块（patchify，例如 16×16 的图块），加上位置嵌入，再喂给一个 ViT。在监督学习场景下，它在 AudioSet 上达到了当时的最高水平（mAP 0.485）。

**BEATs 与 WavLM-base（2024–2026）。** 在数百万小时数据上做自监督预训练，然后用本来所需监督数据量的 1%–10% 在你的任务上微调。2026 年，对于非语音音频，这是默认起点。BEATs-iter3 在 AudioSet 上比 AST 高出 1–2 个 mAP，而算力仅为后者的 1/4。

**把 Whisper 编码器当作冻结骨干网络（2024）。** 取 Whisper 的编码器，丢掉解码器，接上一个线性分类器。在语言识别和简单事件分类上，无需任何音频增强就能逼近最高水平。这是「免费午餐」式的基线。

### 类别不平衡才是真正的挑战

ESC-50：50 个类别，每类 40 段片段——均衡、简单。UrbanSound8K：10 个类别，不平衡比例 10:1。AudioSet：632 个类别，长尾分布高达 100,000:1。行之有效的技术包括：

- 训练时使用「均衡采样（balanced sampling）」（评估时不用）。
- Mixup：对两段片段（及其标签）做线性插值作为增强。
- SpecAugment：随机遮蔽时间和频率频带。简单，但至关重要。

### 评估

- 多类互斥（Speech Commands）：top-1 准确率、top-5 准确率。
- 多类多标签（AudioSet、UrbanSound 类）：平均精度均值（mean average precision，mAP）。
- 严重不平衡：各类别召回率 + 宏平均 F1（macro F1）。

你应当了解的 2026 年数据：

| 基准 | 基线 | 2026 最高水平 | 来源 |
|-----------|----------|-----------|--------|
| ESC-50 | 82%（AST） | 97.0%（BEATs-iter3） | BEATs 论文（2024） |
| AudioSet mAP | 0.485（AST） | 0.548（BEATs-iter3） | HEAR 排行榜 2026 |
| Speech Commands v2 | 98%（CNN） | 99.0%（Audio-MAE） | HEAR v2 结果 |

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

简单却强大：在时间轴上取均值 + 方差，能为 13 系数的 MFCC 得到一个 26 维的定长嵌入。运算瞬间完成。直到 2017 年它都还能在 ESC-50 上击败当时最先进的神经网络基线。

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

### 第 4 步：升级到对数梅尔谱上的 CNN

用 PyTorch 实现：

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

300 万参数。在单张 RTX 4090 上约 10 分钟即可在 ESC-50 上训练完成，准确率 80%+。

### 第 5 步：2026 年的默认方案——微调 BEATs

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

对于 BEATs，可通过 `beats` 库使用 `microsoft/BEATs-base`；其 transformers API 的形状是一致的。

## 实战运用

2026 年的技术栈：

| 场景 | 起手方案 |
|-----------|-----------|
| 极小数据集（<1000 段片段） | MFCC 均值上的 k-NN（你的基线）+ 音频增强 |
| 中等数据集（1K–100K） | 微调 BEATs 或 AST |
| 大数据集（>100K） | 从头训练，或微调 Whisper 编码器 |
| 实时、边缘端 | 40-MFCC CNN，量化为 int8（KWS 风格） |
| 多标签（AudioSet） | BEATs-iter3 配合 BCE 损失 + mixup + SpecAugment |
| 语言识别 | MMS-LID、SpeechBrain VoxLingua107 基线 |

决策准则：**从冻结的骨干网络起步，而不是从全新模型起步**。微调一个 BEATs 头部能让你在几小时（而非几周）内达到最高水平的 95%。

## 交付落地

将成果保存为 `outputs/skill-classifier-designer.md`。针对给定的音频分类任务，选定架构、增强方式、类别平衡策略与评估指标。

## 练习

1. **简单。** 运行 `code/main.py`。它在一个 4 类合成数据集（不同音高的纯音）上训练 k-NN MFCC 基线。请报告混淆矩阵。
2. **中等。** 把 `summarize` 替换为 [mean, var, skew, kurtosis]。在同一合成数据集上，四阶矩池化是否优于均值 + 方差？
3. **困难。** 使用 `torchaudio`，在 ESC-50 的 fold 1 上训练一个 2D CNN。报告 5 折交叉验证准确率。加入 SpecAugment（time mask = 20，freq mask = 10），并报告其带来的差值。

## 关键术语

| 术语 | 人们口中的说法 | 它实际的含义 |
|------|-----------------|-----------------------|
| AudioSet | 音频界的 ImageNet | 谷歌的 200 万段片段、632 类的弱标注 YouTube 数据集。 |
| ESC-50 | 小型分类基准 | 50 类 × 每类 40 段环境声音片段。 |
| AST | 音频声谱图 Transformer | 在对数梅尔谱图块上运行的 ViT；2021 年的最高水平。 |
| BEATs | 自监督音频模型 | 微软的模型，截至 2026 年其 iter3 版本在 AudioSet 上领先。 |
| Mixup | 成对增强 | `x = λ·x1 + (1-λ)·x2; y = λ·y1 + (1-λ)·y2`。 |
| SpecAugment | 基于遮蔽的增强 | 把声谱图的随机时间频带和频率频带置零。 |
| mAP | 多标签主指标 | 跨类别与跨阈值的平均精度均值。 |

## 延伸阅读

- [Gong, Chung, Glass (2021). AST: Audio Spectrogram Transformer](https://arxiv.org/abs/2104.01778) —— 2021–2024 年的标杆架构。
- [Chen et al. (2022, rev. 2024). BEATs: Audio Pre-Training with Acoustic Tokenizers](https://arxiv.org/abs/2212.09058) —— 2024 年起的默认方案。
- [Park et al. (2019). SpecAugment](https://arxiv.org/abs/1904.08779) —— 占据主导地位的音频增强方法。
- [Piczak (2015). ESC-50 dataset](https://github.com/karolpiczak/ESC-50) —— 经久不衰的 50 类基准。
- [Gemmeke et al. (2017). AudioSet](https://research.google.com/audioset/) —— 632 类的 YouTube 分类体系；至今仍是黄金标准。
