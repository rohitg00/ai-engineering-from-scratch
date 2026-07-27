# 说话人识别与验证

> ASR 问的是"他们说了什么？"说话人识别问的是"谁说的？"数学看起来一样——嵌入向量加余弦——但每个生产决策都取决于一个 EER 数字。

**类型：** 动手构建
**语言：** Python
**前置知识：** 阶段 6 · 02（频谱图与 Mel），阶段 5 · 22（嵌入模型）
**时间：** ~45 分钟

## 问题

用户说了一句口令。你想知道：这是他们声称的那个人吗（*验证*，1:1）？或者是你注册库中的第一个人（*识别*，1:N）？或者都不是——这是一个未知说话者（*开集*）？

2018 年之前：GMM-UBM + i-vectors。EER 尚可但对信道变化（电话 vs 笔记本）和情绪敏感。2018–2022：x-vectors（使用角度间隔训练的 TDNN 主干）。2022 年以后：ECAPA-TDNN 和 WavLM-large 嵌入。到 2026 年，该领域由三个模型和一个指标主导。

这个指标是 **EER**——等错误率（Equal Error Rate）。设定决策阈值，使误接受率（False Accept Rate）等于误拒绝率（False Reject Rate）。交叉点就是 EER。每篇论文、每个排行榜、每次采购都会用到这个指标。

## 概念

![注册 + 验证流水线：嵌入 + 余弦 + EER](../assets/speaker-verification.svg)

**流水线。** 注册：录制 5–10 秒目标说话者音频；计算固定维度的嵌入（ECAPA-TDNN 为 192 维，WavLM-large 为 256 维）。验证：获取测试话语的嵌入；计算余弦相似度；与阈值比较。

**ECAPA-TDNN（2020，2026 年仍占主导）。** 强调通道注意力、传播与聚合的时延神经网络。使用挤压激励的 1D 卷积块、多头注意力池化，后接线性层到 192 维。在 VoxCeleb 1+2（2,700 个说话者，110 万条话语）上使用加性角度间隔损失（AAM-softmax）训练。

**WavLM-SV（2022+）。** 使用 AAM 损失微调预训练的 WavLM-large SSL 主干。质量更高但速度更慢——300+ MB 对比 15 MB。

**x-vector（基线）。** TDNN + 统计池化。经典方案；在 CPU/边缘设备上仍有用。

**AAM-softmax。** 标准 softmax，在角度空间中添加间隔 `m`：对正确类别使用 `cos(θ + m)`。强制类间角度分离。典型值 `m=0.2`，缩放因子 `s=30`。

### 评分

- 注册嵌入和测试嵌入之间的**余弦**相似度。基于阈值的决策。
- **PLDA（概率线性判别分析）。** 将嵌入投影到潜在空间，其中同说话者 vs 不同说话者有闭式似然比。在余弦之上增加，可降低 EER 10–20%。2020 年之前的标准方法；现在仅在闭集设置中使用。
- **分数归一化。** `S-norm` 或 `AS-norm`：相对于一群冒充者的均值和标准差对每个分数进行归一化。对跨领域评估至关重要。

### 你应该了解的 2026 年数据

| 模型 | VoxCeleb1-O EER | 参数量 | 吞吐量（A100） |
|-------|-----------------|--------|-------------------|
| x-vector（经典） | 3.10% | 5 M | 400 倍实时 |
| ECAPA-TDNN | 0.87% | 15 M | 200 倍实时 |
| WavLM-SV large | 0.42% | 316 M | 20 倍实时 |
| Pyannote 3.1 分割 + 嵌入 | 0.65% | 6 M | 100 倍实时 |
| ReDimNet (2024) | 0.39% | 24 M | 100 倍实时 |

### 说话人分离（Diarization）

在多说话者片段中"谁在什么时候说话"。流水线：VAD → 分割 → 嵌入每个片段 → 聚类（凝聚式或谱聚类）→ 平滑边界。现代技术栈：`pyannote.audio` 3.1，它将说话人分割 + 嵌入 + 聚类整合在一个调用中。2026 年 AMI 上的 SOTA DER 约为 15%（低于 2022 年的 23%）。

## 动手实现

### 第 1 步：基于 MFCC 统计量的玩具嵌入

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

远非 SOTA——仅用于教学。`code/main.py` 在合成说话者数据上将其作为概念验证使用。

### 第 2 步：余弦相似度 + 阈值

```python
def cosine(a, b):
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(x * x for x in b))
    return dot / (na * nb) if na and nb else 0.0

def verify(enroll, test, threshold=0.75):
    return cosine(enroll, test) >= threshold
```

### 第 3 步：从相似度对计算 EER

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

返回 (eer, threshold_at_eer)。两个都要报告。

### 第 4 步：使用 SpeechBrain 的生产级方案

```python
from speechbrain.pretrained import EncoderClassifier

clf = EncoderClassifier.from_hparams(source="speechbrain/spkrec-ecapa-voxceleb")

# enroll: 对 3-5 个干净样本的嵌入取平均
enroll = torch.stack([clf.encode_batch(load(x)) for x in enrollment_clips]).mean(0)
# verify
score = clf.similarity(enroll, clf.encode_batch(load("test.wav"))).item()
verdict = score > 0.25   # ECAPA 典型阈值；在你的数据上调整
```

### 第 5 步：使用 pyannote 进行说话人分离

```python
from pyannote.audio import Pipeline

pipe = Pipeline.from_pretrained("pyannote/speaker-diarization-3.1")
diarization = pipe("meeting.wav", num_speakers=None)
for turn, _, speaker in diarization.itertracks(yield_label=True):
    print(f"{turn.start:.1f}–{turn.end:.1f}  {speaker}")
```

## 使用建议

2026 年技术栈：

| 场景 | 选择 |
|-----------|------|
| 闭集 1:1 验证、边缘设备 | ECAPA-TDNN + 余弦阈值 |
| 开集验证、云端 | WavLM-SV + AS-norm |
| 说话人分离（会议、播客） | `pyannote/speaker-diarization-3.1` |
| 反欺骗（重放/深度伪造检测） | AASIST 或 RawNet2 |
| 微小嵌入式（KWS + 注册） | Titanet-Small (NeMo) |

## 常见陷阱

- **信道不匹配。** 在 VoxCeleb（网络视频）上训练的模型 ≠ 电话音频。始终在目标信道上评估。
- **短话语。** 测试音频低于 3 秒时 EER 急剧退化。
- **带噪声的注册。** 一次带噪声的注册会毒化锚点。使用 ≥3 个干净样本并取平均。
- **跨条件使用固定阈值。** 始终在目标领域的留出开发集上调整阈值。
- **对未归一化的嵌入使用余弦。** 先做 L2 归一化；否则向量大小会主导结果。

## 交付物

保存为 `outputs/skill-speaker-verifier.md`。选择模型、注册协议、阈值调整计划和安全防护措施。

## 练习

1. **简单。** 运行 `code/main.py`。构建合成"说话者"（不同音调特征），进行注册，在 100 对测试列表上计算 EER。
2. **中等。** 在 30 条 VoxCeleb1 话语（5 个说话者 × 6 条）上使用 SpeechBrain ECAPA。用余弦 vs PLDA 计算 EER。
3. **困难。** 使用 `pyannote.audio` 构建完整的注册 → 说话人分离 → 验证流水线。在 AMI 开发集上评估 DER。

## 关键词汇

| 术语 | 通常说法 | 实际含义 |
|------|-----------------|-----------------------|
| EER | 核心指标 | 误接受率 = 误拒绝率时的阈值。 |
| Verification（验证） | 1:1 | "这是 Alice 吗？" |
| Identification（识别） | 1:N | "谁在说话？" |
| Open-set（开集） | 可能包含未知 | 测试集可包含未注册的说话者。 |
| Enrollment（注册） | 登记 | 计算说话者参考嵌入的过程。 |
| AAM-softmax | 损失函数 | 带加性角度间隔的 softmax；强制聚类分离。 |
| PLDA | 经典评分 | 概率 LDA；基于嵌入的似然比评分。 |
| DER | 说话人分离指标 | 说话人分离错误率——漏检 + 误报 + 混淆。 |

## 延伸阅读

- [Snyder et al. (2018). X-Vectors: Robust DNN Embeddings for Speaker Recognition](https://www.danielpovey.com/files/2018_icassp_xvectors.pdf)——经典深度嵌入论文。
- [Desplanques et al. (2020). ECAPA-TDNN](https://arxiv.org/abs/2005.07143)——2020–2026 年的主导架构。
- [Chen et al. (2022). WavLM: Large-Scale Self-Supervised Pre-Training for Full Stack Speech Processing](https://arxiv.org/abs/2110.13900)——用于 SV 和说话人分离的 SSL 主干。
- [Bredin et al. (2023). pyannote.audio 3.1](https://github.com/pyannote/pyannote-audio)——生产级说话人分离 + 嵌入技术栈。
- [VoxCeleb leaderboard (updated 2026)](https://www.robots.ox.ac.uk/~vgg/data/voxceleb/)——各模型的当前 EER 排名。
