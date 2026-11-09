# 音频分类 从k-NN在MFCC到AST和BEAT

> 无论是"狗吠声与声"还是"这是什么语言",都在进行音频分类. 功能都是化. 架构每十年都在移动. 评估仍然是AUC,F1和每类回忆.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 02 (Spectrograms & Mel), Phase 3 · 06 (CNNs), Phase 5 · 08 (CNNs & RNNs for Text)
**Time:** ~75 minutes

## 问题

你得到一个10秒钟的剪辑.你想知道:"这是什么?"城市声音 (声,钻机,狗),语音命令 (是的/不/停止),语言识别 (en/es/ar),扬声器情绪 (愤怒/中性),或环境声音 (室内/室外,声).所有这些都是 *音频分类*,并在2026年基础架构成熟:log-mel → CNN或变压器 →软max.

音频数据集具有残酷的类失衡,强大的域名转移 (清洁与噪音),以及标签噪音 (谁决定"城市语"与"餐厅噪音"?).80%的问题是策展,增强和评估,而不是将CNN换为变压器.

## 概念

![Audio classification ladder: k-NN on MFCCs to AST to BEATs](../assets/audio-classification.svg)

**k-NN on MFCCs (the 1990s baseline).**按片段平坦的MFCC,计算与标记的银行相似的共数,返回顶部K的多数投票.在清洁的小数据集 (语音命令,ESC-50) 上,令人惊的强度.

**2D CNN on log-mels (2015-2019).**治疗`(T, n_mels)`通过RESNET-18或VGG方式,全球平均时间轴积分,课程上的软度,仍然是2026年大多数高格赛的基线.

**Audio Spectrogram Transformer, AST (2021-2024).**贴合日志邮件 (例如16×16补丁),添加位置嵌入,输入VIT. 视频组的最新状态 (mAP 0.485) 进行监督学习.

**BEATs and WavLM-base (2024-2026).**通过使用1-10%的监督数据,你需要完成任务.在2026年,这是非语音音的默认起点. BEATs-iter3在AudioSet上击败AST1-2mAP,同时使用1/4的计算.

**Whisper-encoder as a frozen backbone (2024).**接下来,我们将Whisper的编码器放下,将解码器放下,将线性分类器附加到.

### 阶级失衡是真正的挑战

标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签

- 在培训期间 (不在评估中) 进行均衡的采样.
- 混合:将两个剪辑 (及其标签) 线性插入为增强.
- 简单,关键. 现在,我们需要一个新的技术.

### 评估

- 多级独家 (语音命令):最高1-准确,最高5-准确.
- 多级多级标签 (AudioSet, UrbanSound-style):平均精度 (mAP).
- 严重失衡:每类召回+宏F1.

2026号码你应该知道:

| Benchmark | Baseline | SOTA 2026 | Source |
|-----------|----------|-----------|--------|
| ESC-50 | 82% (AST) | 97.0% (BEATs-iter3) | BEATs paper (2024) |
| AudioSet mAP | 0.485 (AST) | 0.548 (BEATs-iter3) | HEAR leaderboard 2026 |
| Speech Commands v2 | 98% (CNN) | 99.0% (Audio-MAE) | HEAR v2 results |

```figure
mfcc-pipeline
```

## 建立它

### 步骤1: 化

```python
def featurize_mfcc(signal, sr, n_mfcc=13, n_mels=40, frame_len=400, hop=160):
    mag = stft_magnitude(signal, frame_len, hop)
    fb = mel_filterbank(n_mels, frame_len, sr)
    mels = apply_filterbank(mag, fb)
    log = log_transform(mels)
    return [dct_ii(frame, n_mfcc) for frame in log]
```

### 步骤2:固定长度的总结

```python
def summarize(mfcc_frames):
    n = len(mfcc_frames[0])
    mean = [sum(f[i] for f in mfcc_frames) / len(mfcc_frames) for i in range(n)]
    var = [
        sum((f[i] - mean[i]) ** 2 for f in mfcc_frames) / len(mfcc_frames) for i in range(n)
    ]
    return mean + var
```

简单但强大:平均+时间变异为13个 MFCC提供26维固定嵌入.即时运行.在ESC-50上击败了最新的NN基线.

### 步骤3: k-NN

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

### 步骤4:升级到CNN在日志

在PyTorch:

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

列车在ESC-50上用单个RTX 4090的10分钟. 80%+精度.

### 步骤5:细调预训练的音频变压器 (AST显示)

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

接面孔中心的例子是从 Hub 调整 AST. 接,默认的2026,不在 Hugging Face Hub:下载一个检查点从 [BEATs release in microsoft/unilm](https://github.com/microsoft/unilm/tree/master/beats)接下来,我们就把它装上了.`BEATs`其他`BEATsConfig`细调循环保持相同的形状.

## 用它

现在,我们要做什么?

| Situation | Start with |
|-----------|-----------|
| Tiny dataset (<1000 clips) | k-NN on MFCC means (your baseline) + audio augmentation |
| Medium dataset (1K–100K) | BEATs or AST fine-tune |
| Large dataset (>100K) | Train from scratch or fine-tune Whisper-encoder |
| Real-time, edge | 40-MFCC CNN, quantized to int8 (KWS-style) |
| Multi-label (AudioSet) | BEATs-iter3 with BCE loss + mixup + SpecAugment |
| Language ID | MMS-LID, SpeechBrain VoxLingua107 baseline |

决策规则:**start with a frozen backbone, not a fresh model**精细调节BET头脑,会让你在几个小时内获得95%的SOTA,而不是几周.

## 运送它

保存如`outputs/skill-classifier-designer.md`选择一个特定的音频分类任务的架构,增强,类平衡策略和评估指标.

## 运动

1. **Easy.**跑步`code/main.py`根据4类合成数据集 (不同音调的纯色调) 训练k-NN MFCC基线. 报告混矩阵.
2. **Medium.**取代`summarize`它们的数据集中的4分钟聚合率比同一个合成数据集的 mean+var 值更高吗?
3. **Hard.**使用`torchaudio`报告交叉验证准确度为5倍. 添加规格增量 (时间面具=20,频率面具=10) 并报告三角形.

## 关键词

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| AudioSet | The ImageNet of audio | Google's 2M-clip, 632-class weakly-labeled YouTube dataset. |
| ESC-50 | Small classification benchmark | 50 classes × 40 clips of environmental sounds. |
| AST | Audio Spectrogram Transformer | ViT on log-mel patches; 2021 SOTA. |
| BEATs | Self-supervised audio | Microsoft model, iter3 leads AudioSet as of 2026. |
| Mixup | Pair augmentation | `x = λ·x1 + (1-λ)·x2; y = λ·y1 + (1-λ)·y2`. |
| SpecAugment | Mask-based augmentation | Zero-out random time and frequency bands of the spectrogram. |
| mAP | Main multi-label metric | Mean average precision across classes and thresholds. |

## 进一步阅读

- [Gong, Chung, Glass (2021). AST: Audio Spectrogram Transformer](https://arxiv.org/abs/2104.01778)从2021年到2024年记录的建筑.
- [Chen et al. (2022, rev. 2024). BEATs: Audio Pre-Training with Acoustic Tokenizers](https://arxiv.org/abs/2212.09058)2024+默认
- [Park et al. (2019). SpecAugment](https://arxiv.org/abs/1904.08779)主导的音频增强.
- [Piczak (2015). ESC-50 dataset](https://github.com/karolpiczak/ESC-50)50级的基准,活着.
- [Gemmeke et al. (2017). AudioSet](https://research.google.com/audioset/) 632 级YouTube类别;仍然是黄金标准.
