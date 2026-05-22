# 音频分类——从基于MFCC的k-NN到AST和BEATs

> 从"狗叫 vs 警笛"到"这是哪种语言"，一切都属于音频分类。特征使用梅尔谱。架构每十年演变一次。评估指标依旧是AUC、F1和各类别的召回率。

**类型：** 构建  
**语言：** Python  
**前置知识：** 阶段6·02（频谱图与梅尔谱），阶段3·06（CNN），阶段5·08（文本CNN与RNN）  
**用时：** ~75分钟

## 问题

你拿到一段10秒的音频。你想知道："这是什么？"城市声音（警笛、电钻、狗叫），语音指令（是/否/停止），语言识别（英语/西班牙语/阿拉伯语），说话者情绪（愤怒/中性），或环境声音（室内/室外，嘈杂人声）。所有这些都属于*音频分类*，到2026年基线架构已经成熟：对数梅尔谱 → CNN或Transformer → Softmax。

核心难点不在于网络，而在于数据。音频数据集存在严重的类别不均衡（Class Imbalance）、强烈的领域偏移（干净 vs 嘈杂）以及标签噪声（"城市嘈杂声"与"餐厅噪声"谁定的？）。80%的问题在于数据整理、增强和评估，而非把CNN换成Transformer。

## 概念

![音频分类阶梯：从MFCC的k-NN到AST再到BEATs](../assets/audio-classification.svg)

**基于MFCC的k-NN（1990年代基线）。** 将每个音频片段（clip）的MFCC展开，计算与已标注样本库的余弦相似度，返回前K个样本的多数投票结果。在干净、小规模数据集（如Speech Commands、ESC-50）上效果出奇地好，且无需GPU。

**对数梅尔谱上的2D CNN（2015–2019）。** 将对数梅尔谱 `(T, n_mels)` 视为图像，应用ResNet-18或VGG风格网络。沿时间轴进行全局均值池化，再通过Softmax输出类别。这仍然是2026年大多数Kaggle竞赛的基线方案。

**音频频谱变换器（Audio Spectrogram Transformer, AST）（2021–2024）。** 将对数梅尔谱分割成小块（如16×16），添加位置嵌入，输入ViT。在AudioSet上达到监督学习的最高水平（mAP 0.485）。

**BEATs和WavLM-base（2024–2026）。** 基于数百万小时音频进行自监督预训练，然后在你的任务上使用原本所需标注数据的1–10%进行微调。到2026年，这已成为非语音音频任务的默认起点。BEATs-iter3在AudioSet上比AST高出1–2个mAP点，同时计算量仅为后者的1/4。

**Whisper编码器作为冻结主干网络（2024）。** 取Whisper的编码器，丢弃解码器，附加一个线性分类器。在语言识别和简单事件分类上接近最高水平，且无需任何音频增强。这是一种"免费午餐"基线。

### 类别不均衡才是真正的挑战

ESC-50: 50个类别，每类40个片段——均衡、简单。UrbanSound8K: 10个类别，不均衡比例10:1。AudioSet: 632个类别，长尾分布达100,000:1。有效的技术包括：

- 训练时采用均衡采样（非评估时）。
- Mixup：对两个片段（及它们的标签）进行线性插值作为增强。
- SpecAugment：随机遮挡时间和频带。简单且关键。

### 评估

- 多分类互斥（如Speech Commands）：Top-1准确率、Top-5准确率。
- 多分类多标签（如AudioSet、UrbanSound风格）：平均精度均值（mean Average Precision, mAP）。
- 严重不均衡：各类别召回率 + 宏平均F1（Macro F1）。

2026年你应该了解的数字：

| 基准 | 基线 | 2026最高水平 | 来源 |
|------|------|--------------|------|
| ESC-50 | 82%（AST） | 97.0%（BEATs-iter3） | BEATs论文（2024） |
| AudioSet mAP | 0.485（AST） | 0.548（BEATs-iter3） | HEAR排行榜2026 |
| Speech Commands v2 | 98%（CNN） | 99.0%（Audio-MAE） | HEAR v2结果 |

## 构建它

### 第一步：特征提取

```python
def featurize_mfcc(signal, sr, n_mfcc=13, n_mels=40, frame_len=400, hop=160):
    mag = stft_magnitude(signal, frame_len, hop)
    fb = mel_filterbank(n_mels, frame_len, sr)
    mels = apply_filterbank(mag, fb)
    log = log_transform(mels)
    return [dct_ii(frame, n_mfcc) for frame in log]
```

### 第二步：固定长度摘要

```python
def summarize(mfcc_frames):
    n = len(mfcc_frames[0])
    mean = [sum(f[i] for f in mfcc_frames) / len(mfcc_frames) for i in range(n)]
    var = [
        sum((f[i] - mean[i]) ** 2 for f in mfcc_frames) / len(mfcc_frames) for i in range(n)
    ]
    return mean + var
```

简单但强大：对13维MFCC的每一维在时间上取均值和方差，得到26维固定嵌入。运行极快。直到2017年，该方法在ESC-50上仍然能击败当时最先进的神经网络基线。

### 第三步：k-NN

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

### 第四步：升级为对数梅尔谱上的CNN

使用PyTorch：

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

    def forward(self, x):  # x: 形状 (B, 1, T, n_mels)
        return self.head(self.body(x).flatten(1))
```

300万参数。在ESC-50上用单张RTX 4090训练约10分钟，准确率可达80%以上。

### 第五步：2026年默认方案——微调BEATs

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

对于BEATs，使用`microsoft/BEATs-base`，通过`beats`库调用，transformers的API结构相同。

## 使用它

2026年技术栈：

| 场景 | 起始方案 |
|------|----------|
| 极小数据集（<1000个片段） | MFCC均值的k-NN（你的基线）+ 音频增强 |
| 中等数据集（1K–100K） | 微调BEATs或AST |
| 大数据集（>100K） | 从头训练或微调Whisper编码器 |
| 实时/边缘设备 | 40维MFCC的CNN，量化至int8（KWS风格） |
| 多标签（如AudioSet） | BEATs-iter3 + BCE损失 + Mixup + SpecAugment |
| 语言识别 | MMS-LID、SpeechBrain VoxLingua107基线 |

决策规则：**从冻结的主干网络开始，而不是从头构建新模型**。微调一个BEATs头部，只需数小时而非数周即可达到95%的最高水平。

## 交付它

保存为 `outputs/skill-classifier-designer.md`。针对给定的音频分类任务，选择架构、增强策略、类别平衡策略和评估指标。

## 练习

1. **简单。** 运行 `code/main.py`。该脚本在一个4类合成数据集（不同音高的纯音）上训练基于MFCC的k-NN基线。报告混淆矩阵。
2. **中等。** 将 `summarize` 替换为 [均值、方差、偏度、峰度]。在相同合成数据集上，四阶矩池化是否优于均值+方差？
3. **困难。** 使用 `torchaudio`，在ESC-50的Fold 1上训练一个2D CNN。报告5折交叉验证准确率。加入SpecAugment（时间掩码=20，频率掩码=10），报告变化量。

## 关键术语

| 术语 | 人们常说的 | 实际含义 |
|------|------------|----------|
| AudioSet | 音频领域的ImageNet | 谷歌的200万片段、632类弱标注YouTube数据集。 |
| ESC-50 | 小型分类基准 | 50类×40条环境声音片段。 |
| AST | 音频频谱变换器 | 将ViT应用于对数梅尔谱小块；2021年最高水平。 |
| BEATs | 自监督音频 | 微软模型，截至2026年iter3在AudioSet上领先。 |
| Mixup | 配对增强 | `x = λ·x1 + (1-λ)·x2; y = λ·y1 + (1-λ)·y2`。 |
| SpecAugment | 基于掩码的增强 | 将频谱图的随机时间和频带置零。 |
| mAP | 多标签的主要指标 | 按类别和阈值平均的精度均值。 |

## 进一步阅读

- [Gong, Chung, Glass (2021). AST: Audio Spectrogram Transformer](https://arxiv.org/abs/2104.01778) — 2021–2024年的标准架构。
- [Chen et al. (2022, rev. 2024). BEATs: Audio Pre-Training with Acoustic Tokenizers](https://arxiv.org/abs/2212.09058) — 2024年后的默认方案。
- [Park et al. (2019). SpecAugment](https://arxiv.org/abs/1904.08779) — 主流的音频增强方法。
- [Piczak (2015). ESC-50 dataset](https://github.com/karolpiczak/ESC-50) — 经久不衰的50类基准数据集。
- [Gemmeke et al. (2017). AudioSet](https://research.google.com/audioset/) — 632类YouTube分类体系；至今仍是黄金标准。