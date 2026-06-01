# 06 · 说话人识别与验证

> 「自动语音识别（ASR）」问的是「他们说了什么？」，说话人识别问的是「是谁说的？」。两者的数学看起来一样——嵌入加余弦相似度——但每一个生产决策都系于一个 EER 数字。

**类型：** 实践构建
**语言：** Python
**前置：** 第 6 阶段 · 02（频谱图与梅尔频谱）、第 5 阶段 · 22（嵌入模型）
**时长：** 约 45 分钟

## 问题所在

一位用户说出一句口令。你想知道：这个人是否确实是他声称的那个身份（「验证（verification）」，1:1），还是他是你登记库中的第一个人（「辨识（identification）」，1:N）？又或者两者皆非——这是一个未知的说话人（「开集（open-set）」）？

2018 年之前：GMM-UBM + i-vector。EER 尚可，但对信道变化（电话 vs 笔记本电脑）和情绪很脆弱。2018–2022 年：x-vector（以角度间隔训练的 TDNN 主干）。2022 年以后：ECAPA-TDNN 和 WavLM-large 嵌入。到 2026 年，这一领域由三个模型和一项指标主导。

这项指标就是 **EER**——「等错误率（Equal Error Rate）」。调整你的决策阈值，使得「误接受率（False Accept Rate）」=「误拒绝率（False Reject Rate）」。两者的交叉点就是 EER。它出现在每一篇论文、每一个排行榜、每一次采购评估中。

## 核心概念

〔图：登记 + 验证流程，含嵌入 + 余弦相似度 + EER〕

**整个流程。** 登记：录制目标说话人 5–30 秒的音频；计算一个固定维度的嵌入（ECAPA-TDNN 为 192 维，WavLM-large 为 256 维）。验证：得到测试语音的嵌入；计算余弦相似度；与阈值比较。

**ECAPA-TDNN（2020 年提出，到 2026 年仍占主导）。** 全称为 Emphasized Channel Attention, Propagation and Aggregation - Time-Delay Neural Network（强调信道注意力、传播与聚合的时延神经网络）。采用带「挤压-激励（squeeze-excitation）」的一维卷积块、多头注意力池化，再接一个线性层映射到 192 维。在 VoxCeleb 1+2（2,700 个说话人，110 万条语音）上以「加性角度间隔损失（Additive Angular Margin loss，AAM-softmax）」训练。

**WavLM-SV（2022 年以后）。** 在预训练的 WavLM-large 自监督学习（SSL）主干上用 AAM 损失进行微调。质量更高但更慢——300+ MB vs 15 MB。

**x-vector（基线）。** TDNN + 统计池化。经典方案；在 CPU / 边缘设备上仍然有用。

**AAM-softmax。** 在标准 softmax 的角度空间中加入间隔 `m`：对正确类别使用 `cos(θ + m)`。强制拉大类间角度间隔。典型取值 `m=0.2`，缩放系数 `s=30`。

### 打分

- 登记嵌入与测试嵌入之间的**余弦相似度（Cosine）**。基于阈值做决策。
- **PLDA（概率线性判别分析，Probabilistic LDA）。** 将嵌入投影到一个隐空间，在该空间中「同说话人 vs 不同说话人」拥有闭式的「似然比（likelihood ratio）」。叠加在余弦相似度之上，可带来 EER 降低 10–20%。2020 年前的标准做法；如今仅用于闭集场景。
- **得分归一化（Score normalization）。** `S-norm` 或 `AS-norm`：将每个得分相对于一组「冒充者（imposter）」的均值与标准差进行归一化。对跨域评估至关重要。

### 你应该知道的数字（2026）

| 模型 | VoxCeleb1-O EER | 参数量 | 吞吐量（A100） |
|-------|-----------------|--------|-------------------|
| x-vector（经典） | 3.10% | 5 M | 400× RT |
| ECAPA-TDNN | 0.87% | 15 M | 200× RT |
| WavLM-SV large | 0.42% | 316 M | 20× RT |
| Pyannote 3.1 分割 + 嵌入 | 0.65% | 6 M | 100× RT |
| ReDimNet（2024） | 0.39% | 24 M | 100× RT |

### 说话人分离（Diarization）

在多说话人片段中回答「谁在何时说话」。流程：「语音活动检测（VAD）」→ 切分片段 → 对每个片段计算嵌入 → 聚类（凝聚式或谱聚类）→ 平滑边界。现代技术栈：`pyannote.audio` 3.1，它把说话人分割 + 嵌入 + 聚类打包在一次调用之后。2026 年在 AMI 上的 SOTA「分离错误率（DER）」约为 15%（相比 2022 年的 23% 有所下降）。

## 动手构建

### 第 1 步：基于 MFCC 统计量的玩具嵌入

```python
def embed_mfcc_stats(signal, sr):
    frames = featurize_mfcc(signal, sr, n_mfcc=13)
    mean = [sum(f[i] for f in frames) / len(frames) for i in range(13)]
    std = [
        math.sqrt(sum((f[i] - mean[i]) ** 2 for f in frames) / len(frames))
        for i in range(13)
    ]
    return mean + std  # 26 维
```

离 SOTA 差得远——仅供教学。`code/main.py` 把它用作在合成说话人数据上的概念验证。

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

返回 (eer, threshold_at_eer)。两者都要报告。

### 第 4 步：用 SpeechBrain 上生产

```python
from speechbrain.pretrained import EncoderClassifier

clf = EncoderClassifier.from_hparams(source="speechbrain/spkrec-ecapa-voxceleb")

# 登记：对 3-5 段干净样本的嵌入取平均
enroll = torch.stack([clf.encode_batch(load(x)) for x in enrollment_clips]).mean(0)
# 验证
score = clf.similarity(enroll, clf.encode_batch(load("test.wav"))).item()
verdict = score > 0.25   # ECAPA 的典型阈值；请在你的数据上调参
```

### 第 5 步：用 pyannote 做说话人分离

```python
from pyannote.audio import Pipeline

pipe = Pipeline.from_pretrained("pyannote/speaker-diarization-3.1")
diarization = pipe("meeting.wav", num_speakers=None)
for turn, _, speaker in diarization.itertracks(yield_label=True):
    print(f"{turn.start:.1f}–{turn.end:.1f}  {speaker}")
```

## 实战运用

2026 年的技术栈：

| 场景 | 选型 |
|-----------|------|
| 闭集 1:1 验证，边缘端 | ECAPA-TDNN + 余弦阈值 |
| 开集验证，云端 | WavLM-SV + AS-norm |
| 说话人分离（会议、播客） | `pyannote/speaker-diarization-3.1` |
| 反欺骗（回放 / 深度伪造检测） | AASIST 或 RawNet2 |
| 微型嵌入式（KWS + 登记） | Titanet-Small（NeMo） |

## 常见陷阱

- **信道不匹配。** 在 VoxCeleb（网络视频）上训练的模型 ≠ 电话通话音频。务必在目标信道上评估。
- **过短的语音。** 测试音频低于 3 秒时，EER 会急剧恶化。
- **带噪声的登记。** 一段有噪声的登记就会污染锚点。请使用 ≥3 段干净样本并取平均。
- **跨条件沿用固定阈值。** 务必在来自目标域的留出开发集上调整阈值。
- **在未归一化的嵌入上算余弦相似度。** 先做 L2 归一化；否则幅值会主导结果。

## 交付落地

保存为 `outputs/skill-speaker-verifier.md`。确定模型、登记协议、阈值调优方案以及反欺诈保护措施。

## 练习

1. **简单。** 运行 `code/main.py`。它会构建合成的「说话人」（不同的音色画像），进行登记，并在一个 100 对的试验列表上计算 EER。
2. **中等。** 在 30 条 VoxCeleb1 语音（5 个说话人 × 每人 6 条）上使用 SpeechBrain ECAPA。分别用余弦相似度和 PLDA 计算 EER。
3. **困难。** 用 `pyannote.audio` 构建完整的登记 → 分离 → 验证流程。在 AMI 开发集上评估 DER。

## 关键术语

| 术语 | 人们怎么说 | 它实际指什么 |
|------|-----------------|-----------------------|
| EER | 头牌指标 | 误接受 = 误拒绝时的阈值。 |
| 验证（Verification） | 1:1 | 「这是 Alice 吗？」 |
| 辨识（Identification） | 1:N | 「现在说话的是谁？」 |
| 开集（Open-set） | 可能存在未知者 | 测试集中可能包含未登记的说话人。 |
| 登记（Enrollment） | 注册 | 计算某说话人的参考嵌入。 |
| AAM-softmax | 那个损失函数 | 带加性角度间隔的 softmax；强制拉开簇间距离。 |
| PLDA | 经典打分 | 概率线性判别分析；在嵌入之上做似然比打分。 |
| DER | 说话人分离指标 | 分离错误率（Diarization Error Rate）——漏检 + 误报 + 混淆。 |

## 延伸阅读

- [Snyder 等人（2018）。X-Vectors: Robust DNN Embeddings for Speaker Recognition](https://www.danielpovey.com/files/2018_icassp_xvectors.pdf) —— 经典的深度嵌入论文。
- [Desplanques 等人（2020）。ECAPA-TDNN](https://arxiv.org/abs/2005.07143) —— 2020–2026 年的主导架构。
- [Chen 等人（2022）。WavLM: Large-Scale Self-Supervised Pre-Training for Full Stack Speech Processing](https://arxiv.org/abs/2110.13900) —— 用于说话人验证与分离的 SSL 主干。
- [Bredin 等人（2023）。pyannote.audio 3.1](https://github.com/pyannote/pyannote-audio) —— 生产级的说话人分离 + 嵌入技术栈。
- [VoxCeleb 排行榜（2026 年更新）](https://www.robots.ox.ac.uk/~vgg/data/voxceleb/) —— 各模型当前的 EER 排名。
