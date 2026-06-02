# 说话人识别与验证（Speaker Recognition & Verification）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> ASR 问的是「他们说了什么」；说话人识别问的是「是谁在说」。数学上看起来一样——embedding 加 cosine——但生产里的每一个决策，都拴在一个数字上：EER。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 6 · 02 (Spectrograms & Mel), Phase 5 · 22 (Embedding Models)
**Time:** ~45 minutes

## 问题（The Problem）

用户念了一句口令短语。你想知道：这是不是他声称的那个人（*verification*，1:1）？还是说，他是你 enrollment（注册）库里的哪一位（*identification*，1:N）？又或者两者都不是——是个未知说话人（*open-set*，开集）？

2018 之前：GMM-UBM + i-vectors。EER 还算可以，但对信道切换（手机 vs 笔记本）和情绪非常脆弱。2018–2022：x-vectors（TDNN backbone，配 angular margin 训练）。2022 之后：ECAPA-TDNN 和 WavLM-large embeddings。到 2026，整个领域被三个模型和一个指标主导。

那个指标就是 **EER**——Equal Error Rate（等错误率）。把决策阈值调到 False Accept Rate（误接受率）= False Reject Rate（误拒绝率）的位置，那个交叉点就是 EER。每篇论文、每张排行榜、每次招标都在用它。

## 概念（The Concept）

![Enrollment + verification pipeline with embedding + cosine + EER](../assets/speaker-verification.svg)

**整条流水线（pipeline）。** Enrollment：录目标说话人 5–30 秒的音频，算出一个固定维度的 embedding（ECAPA-TDNN 是 192 维，WavLM-large 是 256 维）。Verification：取出测试 utterance（语句）的 embedding，算 cosine 相似度，和阈值比较。

**ECAPA-TDNN（2020 年提出，2026 年仍是主力）。** Emphasized Channel Attention, Propagation and Aggregation - Time-Delay Neural Network。1D 卷积块加上 squeeze-excitation，再叠多头 attention pooling，最后过一层线性投到 192 维。在 VoxCeleb 1+2（2,700 个说话人，110 万条 utterances）上用 Additive Angular Margin loss（AAM-softmax）训练。

**WavLM-SV（2022+）。** 拿一个预训练好的 WavLM-large SSL backbone 用 AAM loss 微调（fine-tune）。质量更高但更慢——300+ MB 对比 15 MB。

**x-vector（baseline，基线）。** TDNN + 统计 pooling。经典老兵；在 CPU / 边缘设备上仍然好用。

**AAM-softmax。** 在角度空间里给标准 softmax 加一个 margin `m`：对正确类用 `cos(θ + m)`。强行把不同类之间的角度撑开。常用 `m=0.2`，scale `s=30`。

### 打分（Scoring）

- **Cosine**：注册 embedding 和测试 embedding 之间的 cosine。基于阈值做决策。
- **PLDA（Probabilistic LDA，概率线性判别分析）。** 把 embedding 投到一个隐空间（latent），在那里同人 vs 不同人有闭式形式的似然比。叠在 cosine 之上能再降 10–20% 的 EER。2020 之前是标配；现在只在闭集设置里用了。
- **Score normalization（分数归一化）。** `S-norm` 或 `AS-norm`：把每个分数对一组 imposter（冒充者）的均值和标准差做归一化。跨域评估必备。

### 你应该记住的几个数字（2026）

| 模型 | VoxCeleb1-O EER | 参数量 | 吞吐（A100） |
|-------|-----------------|--------|-------------------|
| x-vector（经典） | 3.10% | 5 M | 400× RT |
| ECAPA-TDNN | 0.87% | 15 M | 200× RT |
| WavLM-SV large | 0.42% | 316 M | 20× RT |
| Pyannote 3.1 segmentation + embedding | 0.65% | 6 M | 100× RT |
| ReDimNet (2024) | 0.39% | 24 M | 100× RT |

### 说话人日志（Diarization）

「谁在什么时候说话」——多说话人片段里的归属问题。流水线：VAD → 分段 → 给每段算 embedding → 聚类（agglomerative 层次聚类或 spectral 谱聚类）→ 平滑边界。现代的 stack 是 `pyannote.audio` 3.1，把说话人分段 + embedding + 聚类打包到一个调用里。2026 年 AMI 数据集上 SOTA 的 DER 大约 15%（2022 年还是 23%）。

## 动手实现（Build It）

### 第 1 步：用 MFCC 统计量做一个玩具 embedding

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

跟 SOTA 差着十万八千里——纯粹教学用。`code/main.py` 在合成的说话人数据上把这个当作概念验证（proof-of-concept）。

### 第 2 步：cosine 相似度 + 阈值

```python
def cosine(a, b):
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(x * x for x in b))
    return dot / (na * nb) if na and nb else 0.0

def verify(enroll, test, threshold=0.75):
    return cosine(enroll, test) >= threshold
```

### 第 3 步：从相似度对里算 EER

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

返回 (eer, threshold_at_eer)。两个都要报。

### 第 4 步：用 SpeechBrain 上生产

```python
from speechbrain.pretrained import EncoderClassifier

clf = EncoderClassifier.from_hparams(source="speechbrain/spkrec-ecapa-voxceleb")

# enroll: average the embeddings of 3-5 clean samples
enroll = torch.stack([clf.encode_batch(load(x)) for x in enrollment_clips]).mean(0)
# verify
score = clf.similarity(enroll, clf.encode_batch(load("test.wav"))).item()
verdict = score > 0.25   # ECAPA typical threshold; tune on your data
```

### 第 5 步：用 pyannote 做说话人日志

```python
from pyannote.audio import Pipeline

pipe = Pipeline.from_pretrained("pyannote/speaker-diarization-3.1")
diarization = pipe("meeting.wav", num_speakers=None)
for turn, _, speaker in diarization.itertracks(yield_label=True):
    print(f"{turn.start:.1f}–{turn.end:.1f}  {speaker}")
```

## 用起来（Use It）

2026 年的标配 stack：

| 场景 | 选什么 |
|-----------|------|
| 闭集 1:1 verification，边缘端 | ECAPA-TDNN + cosine 阈值 |
| 开集 verification，云端 | WavLM-SV + AS-norm |
| 说话人日志（会议、播客） | `pyannote/speaker-diarization-3.1` |
| 反欺骗（重放 / 深伪检测） | AASIST 或 RawNet2 |
| 极小嵌入式（KWS + 注册） | Titanet-Small（NeMo） |

## 坑（Pitfalls）

- **信道不匹配。** 在 VoxCeleb（网络视频）上训的模型 ≠ 电话音频。一定要在目标信道上评估。
- **utterance 太短。** 测试音频低于 3 秒，EER 会断崖式恶化。
- **带噪声的 enrollment。** 一条带噪的 enrollment 会污染整个锚点。用 ≥3 条干净样本取平均。
- **跨条件用同一个阈值。** 永远在目标域留出来的 dev set 上调阈值。
- **没归一化就做 cosine。** 先 L2 归一化；否则向量模长会主导结果。

## 上线部署（Ship It）

存到 `outputs/skill-speaker-verifier.md`。挑模型、写 enrollment 协议、定阈值调优计划、列防欺诈措施。

## 练习（Exercises）

1. **简单。** 跑 `code/main.py`。它会构造合成的「说话人」（不同的音色 profile），做 enrollment，在一份 100 对的 trial list 上算 EER。
2. **中等。** 用 SpeechBrain 的 ECAPA 跑 30 条 VoxCeleb1 utterances（5 个说话人，每人 6 条）。分别用 cosine 和 PLDA 算 EER。
3. **困难。** 用 `pyannote.audio` 搭完整的「enroll → diarize → verify」流水线。在 AMI dev set 上评估 DER。

## 关键术语（Key Terms）

| 术语 | 大家平时怎么说 | 实际含义 |
|------|-----------------|-----------------------|
| EER | 头条指标 | False Accept = False Reject 时的那个阈值。 |
| Verification | 1:1 | 「这是 Alice 吗？」 |
| Identification | 1:N | 「是谁在说话？」 |
| Open-set | 可能有未知人 | 测试集里可以混进没注册过的说话人。 |
| Enrollment | 注册 | 给某个说话人算出参考 embedding。 |
| AAM-softmax | 那个 loss | 带加性角度 margin 的 softmax，强行撑开类簇。 |
| PLDA | 经典打分 | Probabilistic LDA；在 embedding 之上做似然比打分。 |
| DER | 说话人日志的指标 | Diarization Error Rate——漏检 + 误检 + 混淆。 |

## 延伸阅读（Further Reading）

- [Snyder et al. (2018). X-Vectors: Robust DNN Embeddings for Speaker Recognition](https://www.danielpovey.com/files/2018_icassp_xvectors.pdf) —— 经典的深度 embedding 论文。
- [Desplanques et al. (2020). ECAPA-TDNN](https://arxiv.org/abs/2005.07143) —— 2020–2026 主导架构。
- [Chen et al. (2022). WavLM: Large-Scale Self-Supervised Pre-Training for Full Stack Speech Processing](https://arxiv.org/abs/2110.13900) —— SV 和 diarization 的 SSL backbone。
- [Bredin et al. (2023). pyannote.audio 3.1](https://github.com/pyannote/pyannote-audio) —— 生产级的 diarization + embedding stack。
- [VoxCeleb leaderboard (updated 2026)](https://www.robots.ox.ac.uk/~vgg/data/voxceleb/) —— 各模型当前 EER 排名。
