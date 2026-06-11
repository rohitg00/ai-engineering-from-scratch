# Audio Classification — From k-NN on MFCCs to AST and BEATs

> 从“狗叫声与警笛”到“这是哪种语言”，一切都是音频分类。特征是融合的。建筑每十年都会发生变化。评估保持AUR、F1和每类回忆。

** 类型：** 构建
** 语言：** Python
** 先决条件：** 阶段6 · 02（Spectrograms & Mel）、阶段3 · 06（CNN）、阶段5 · 08（文本的CNN & RNN）
** 时间：** ~75分钟

## The Problem

您将获得一个10秒的片段。你想知道：“这是什么？“城市声音（警笛、演习、狗）、语音命令（是/否/停止）、语言ID（en/es/ar）、说话者情绪（愤怒/中性）或环境声音（室内/室外，胡言乱语）。所有这些都是 * 音频分类 *，2026年基线架构成熟：log-mel-CNN或Transformer-softmax。

核心困难不是网络。这是数据。音频数据集存在严重的阶级不平衡、强烈的域转移（干净与有噪音）和标签噪音（谁决定“城市胡言乱语”与“餐厅噪音”？）。80%的问题是策展、增强和评估，而不是将CNN换成Transformer。

## The Concept

![Audio classification ladder: k-NN on MFCCs to AST to BEATs](../assets/audio-classification.svg)

** 关于MFCC的k-NN（1990年代基线）。展平每个片段的MFCC，计算与标记库的余弦相似性，返回前K个的多数投票。在干净、小的数据集上非常强大（语音命令，ESC-50）。没有GPU的显卡。

**2D CNN关于原木的文章（2015-2019）。**将“（T，n_mels）”log-mel视为图像。应用ResNet-18或VGG风格。全球平均值汇集时间轴。Softmax超过课程。仍然是2026年大多数Kaggle比赛的基线。

** 音频频谱图Transformer，AST（2021-2024）。**修补log-mel（例如16 x 16补丁）、添加位置嵌入、反馈到ViT。AudioSet（mAP 0.485）的最新技术水平，用于监督学习。

** BEAT和WavLM-base（2024-2026）。**数百万小时的自我监督预培训。使用您所需的1-10%的监督数据对您的任务进行微调。2026年，这是非语音音频的默认起点。BEATs-iter 3在AudioSet上以1-2 mAP的速度击败AST，同时使用1/4的计算。

Whisper-encoder as a frozen backbone（2024）取下Whisper的编码器，去掉解码器，再加上一个线性分类器。接近SOTA的语言ID和简单的事件分类，零音频增强。“免费午餐”的底线。

### Class imbalance is the real challenge

ESM-50：50个课程，每个课程40个剪辑-平衡、简单。UrbanSound 8 K：10节课，不平衡10：1。AudioSet：632个班级，长尾为100，000：1。有效的技术：

- 培训期间（而不是评估中）平衡抽样。
- Mixup：线性内插两个剪辑（及其标签）作为增强。
- SpecAugment：屏蔽随机时间和频段。简单;关键。

### Evaluation

- 多类专用（语音命令）：前1级精度，前5级精度。
- 多类多标签（AudioSet，UrbanSound风格）：平均精度（mAP）。
- 严重不平衡：按级别召回+宏F1。

2026年您应该知道的数字：

| 基准 | 基线 | SOTA 2026 | 源 |
|-----------|----------|-----------|--------|
| ESM-50 | 82%（AST） | 97.0%（BEATs-iter3） | BEAT论文（2024） |
| AudioSet mAP | 0.485（AST） | 0.548（BEATs-iter3） | 聆听排行榜2026 |
| 语音命令v2 | 98%（CNN） | 99.0%（音频MAE） | 听到v2结果 |

## Build It

### Step 1: featurize

```python
def featurize_mfcc(signal, sr, n_mfcc=13, n_mels=40, frame_len=400, hop=160):
    mag = stft_magnitude(signal, frame_len, hop)
    fb = mel_filterbank(n_mels, frame_len, sr)
    mels = apply_filterbank(mag, fb)
    log = log_transform(mels)
    return [dct_ii(frame, n_mfcc) for frame in log]
```

### Step 2: fixed-length summary

```python
def summarize(mfcc_frames):
    n = len(mfcc_frames[0])
    mean = [sum(f[i] for f in mfcc_frames) / len(mfcc_frames) for i in range(n)]
    var = [
        sum((f[i] - mean[i]) ** 2 for f in mfcc_frames) / len(mfcc_frames) for i in range(n)
    ]
    return mean + var
```

简单但强大：平均值+随时间的方差为13 coef MFCC提供26-dim固定嵌入。立即删除。就在2017年，还在EC-50上超越了最先进的NN基线。

### Step 3: k-NN

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

### Step 4: upgrade to CNN on log-mels

在PyTorch中：

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

3M 参数只需使用一台RTX 4090即可在ECT-50上完成训练约10分钟。80%+准确性。

### Step 5: the 2026 default — fine-tune BEATs

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

对于BEAT，请通过“beats”库使用“Microsoft/BEATs-base”; transformers API的形状相同。

## Use It

2026年堆栈：

| 情况 | 开始 |
|-----------|-----------|
| 小数据集（<1000个剪辑） | MFCC上的k-NN意味着（您的基线）+音频增强 |
| 中等数据集（1 K-100 K） | BEAT或AST微调 |
| 大型数据集（> 100 K） | 从头开始训练或微调Whisper编码器 |
| 实时、边缘 | 40-MFCC CNN，量化为int8（KWS风格） |
| 多标签（AudioSet） | BEATs-iter 3，BCE丢失+ mixup + SpecAugment |
| 语言ID | MMS-LID，SpeechBrain VoxLingua 107基线 |

决策规则：** 从冷冻的脊柱开始，而不是新鲜的模型 **。微调BEAT头部即可在数小时内（而不是数周）内获得95%的SOTA。

## Ship It

另存为“输出/skill-classifier-designer.md”。为给定的音频分类任务选择架构、增强、类别平衡策略和评估指标。

## Exercises

1. ** 简单。**运行'代码/main.py '。它在4级合成数据集（不同音调的纯音调）上训练k-NN MFCC基线。报告混乱矩阵。
2. ** 中等。**将“summary”替换为[mean，var，skew，Kurtosis]。在同一合成数据集上，4时刻合并是否优于平均值+var？
3. ** 很难。**使用“Torchaudio”在ESM-50上训练2D CNN fold 1。报告5倍交叉验证准确性。添加SpecAugment（时间屏蔽= 20，频率屏蔽= 10）并报告增量。

## Key Terms

| Term | 别人怎么说 | 它实际上意味着什么 |
|------|-----------------|-----------------------|
| AudioSet | 音频ImageNet | Google的2 M剪辑、632级弱标签YouTube数据集。 |
| ESM-50 | 小分类基准 | 50个班级x 40个环境声音片段。 |
| AST | 音频频谱图Transformer | Log-mel贴片上的ViT; 2021 SOTA。 |
| BEATs | 自监督音频 | 微软模式，截至2026年iter3领先AudioSet。 |
| Mixup | 配对增加 | ' x =|·x1 +（1-|）·x2; y =|·y1 +（1-|）·y2 '。 |
| 片段增强 | 基于口罩的增强 | 调零频谱图的随机时间和频段。 |
| 地图 | 主要多标签指标 | 跨类别和阈值的平均平均精度。 |

## Further Reading

- [Gong，Chung，Glass（2021）。AST：音频频谱Transformer]（https：//arxiv.org/abs/2104.01778）-2021-2024年的记录架构。
- [Chen等人（2022年，2024年修订版）。BEAT：使用声学令牌器的音频预训练]（https：//arxiv.org/ab/2212.09058）-2024年以上默认值。
- [Park等人（2019）。SpecAugment]（https：//arxiv.org/abs/1904.08779）-主要的音频增强。
- [皮卡克（2015）。ESM-50数据集]（https：//github.com/karolpiczak/ESC-50）-持续存在的50级基准。
- [Gemmeke et al.（2017）. AudioSet]（https：//research.google.com/audioset/）- 632类YouTube分类;仍然是黄金标准。
