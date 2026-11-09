# 发言人识别和验证

>  ASR问"他们说什么?"扬声器识别问"谁说?"数学看起来是相同的嵌体加上,但每个生产决定都依赖于一个EER号码.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 02 (Spectrograms & Mel), Phase 5 · 22 (Embedding Models)
**Time:** ~45 minutes

## 问题

您想知道:这是他们声称自己 (*验证*, 1:1),还是您的注册银行 (*识别*, 1:N) 的第一个人?

2018年前:GMM-UBM+i-向量.合理的EER但对道转移 (电话与笔记本电脑) 和情感很脆弱. 20182022:x向量 (TDNN脊柱训练有素的角差距). 2022+:ECAPA-TDNN和WavLM-大嵌入式.到2026年,该领域由三种模型和一个指标主导.

测量量是**EER**  错误率. 设定你的决定门,所以错误接受率 =错误拒绝率. 交叉是EER. 在每篇论文,每篇排名表,每次采购调用中都使用.

## 概念

![Enrollment + verification pipeline with embedding + cosine + EER](../assets/speaker-verification.svg)

**The pipeline.**录制:记录目标扬声器的530秒;计算固定维度嵌入 (192-d ECAPA-TDNN,256-d WavLM-大).验证:获取测试语音嵌入;计算共音相似性;与门进行比较.

**ECAPA-TDNN (2020, still dominant 2026).**强调频道关注,传播和聚合 - 时间延迟神经网络. 1D conv 块具有挤压激动,多头关注聚合,随后有一个直线层到192d.训练于 VoxCeleb 1+2 (2700扬声器,1.1M发言) 具有增量角利率损失 (AAM-软max).

**WavLM-SV (2022+).**精细调节预训练的WavLM大SSL背骨,AAM损失.更高质量,但更慢的300+MBvs15MB.

**x-vector (baseline).**传统;仍然在CPU/边缘上有用.

**AAM-softmax.**标准软max 附加边缘`m`在角空间中: `cos(θ + m)`对于正确的类别. 类别间的角分离. 典型`m=0.2`规模`s=30`现在,我们要去.

### 评分

- **Cosine**根据值决定.
- **PLDA (Probabilistic LDA).**项目嵌入在一个隐藏空间中,相同扬声器与不同扬声器具有闭式形式概率比.增加在可西因上以减少+1020%的EER.标准前-2020;现在仅用于闭式设置.
- **Score normalization.** `S-norm`或`AS-norm`对于跨领域评价来说,这是必不可少的.

### 你应该知道的数字 (2026)

| Model | VoxCeleb1-O EER | Params | Throughput (A100) |
|-------|-----------------|--------|-------------------|
| x-vector (classic) | 3.10% | 5 M | 400× RT |
| ECAPA-TDNN | 0.87% | 15 M | 200× RT |
| WavLM-SV large | 0.42% | 316 M | 20× RT |
| Pyannote 3.1 segmentation + embedding | 0.65% | 6 M | 100× RT |
| ReDimNet (2024) | 0.39% | 24 M | 100× RT |

### 腹化

管道:VAD → 段 → 嵌入每个段 → 集群 (聚合或光谱) → 滑的边界. 现代堆: `pyannote.audio`总体而言,在2026年,AMI的SOTA DER率为15% (从2022年的23%下降).

```figure
sp-eer-crossover
```

## 建立它

### 步骤1:从MFCC统计数据中嵌入玩具

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

只有教学.`code/main.py`使用这种方法作为合成扬声器数据的概念证明.

### 步骤2: 数相似性+门

```python
def cosine(a, b):
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(x * x for x in b))
    return dot / (na * nb) if na and nb else 0.0

def verify(enroll, test, threshold=0.75):
    return cosine(enroll, test) >= threshold
```

### 步骤3:从相似性对的EER

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

报表两者.

### 步骤4:使用SpeechBrain制作

```python
from speechbrain.pretrained import EncoderClassifier

clf = EncoderClassifier.from_hparams(source="speechbrain/spkrec-ecapa-voxceleb")

# enroll: average the embeddings of 3-5 clean samples
enroll = torch.stack([clf.encode_batch(load(x)) for x in enrollment_clips]).mean(0)
# verify
score = clf.similarity(enroll, clf.encode_batch(load("test.wav"))).item()
verdict = score > 0.25   # ECAPA typical threshold; tune on your data
```

### 步骤5:用笔记记记本日记

```python
from pyannote.audio import Pipeline

pipe = Pipeline.from_pretrained("pyannote/speaker-diarization-3.1")
diarization = pipe("meeting.wav", num_speakers=None)
for turn, _, speaker in diarization.itertracks(yield_label=True):
    print(f"{turn.start:.1f}–{turn.end:.1f}  {speaker}")
```

## 用它

现在,我们要做什么?

| Situation | Pick |
|-----------|------|
| Closed-set 1:1 verification, edge | ECAPA-TDNN + cosine threshold |
| Open-set verification, cloud | WavLM-SV + AS-norm |
| Diarization (meetings, podcasts) | `pyannote/speaker-diarization-3.1` |
| Anti-spoofing (replay / deepfake detection) | AASIST or RawNet2 |
| Tiny embedded (KWS + enrollment) | Titanet-Small (NeMo) |

## 陷

- **Channel mismatch.**通过VoxCeleb (网络视频) 训练的模型 ≠电话呼叫音频.
- **Short utterances.**测试音频的EER明显降低到测试音频的3秒以下.
- **Enrollment with noise.**声的接毒了.使用 ≥3 清洁样本和平均.
- **Fixed threshold across conditions.**总是调整目标域的开发设置.
- **Cosine on non-normalized embeddings.**首先将L2正常化;否则大小占主导地位.

## 运送它

保存如`outputs/skill-speaker-verifier.md`选择模式,注册协议,值调整计划,以及欺诈保障措施.

## 运动

1. **Easy.**跑步`code/main.py`构建合成"扬声器" (不同音调配置),在100对试验列表中注册,计算EER.
2. **Medium.**使用SpeechBrain ECAPA在30个 VoxCeleb1语音中 (每个5个扬声器 × 6个).使用Cosine vs PLDA计算EER.
3. **Hard.**建立全报 →日记 → 验证管道`pyannote.audio`在 AMI 开发装置上评估DER.

## 关键词

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| EER | The headline metric | Threshold where False Accept = False Reject. |
| Verification | 1:1 | "Is this Alice?" |
| Identification | 1:N | "Who is speaking?" |
| Open-set | Unknown possible | Test set can contain unenrolled speakers. |
| Enrollment | Registering | Computing a speaker's reference embedding. |
| AAM-softmax | The loss | Softmax with additive angular margin; forces cluster separation. |
| PLDA | Classic scoring | Probabilistic LDA; likelihood-ratio scoring on top of embeddings. |
| DER | Diarization metric | Diarization Error Rate — miss + false alarm + confusion. |

## 进一步阅读

- [Snyder et al. (2018). X-Vectors: Robust DNN Embeddings for Speaker Recognition](https://www.danielpovey.com/files/2018_icassp_xvectors.pdf)经典的深入嵌入式纸.
- [Desplanques et al. (2020). ECAPA-TDNN](https://arxiv.org/abs/2005.07143)主导建筑 20202026
- [Chen et al. (2022). WavLM: Large-Scale Self-Supervised Pre-Training for Full Stack Speech Processing](https://arxiv.org/abs/2110.13900)SV和日记化的SSL脊柱.
- [Bredin et al. (2023). pyannote.audio 3.1](https://github.com/pyannote/pyannote-audio)生产日记化+嵌入堆.
- [VoxCeleb leaderboard (updated 2026)](https://www.robots.ox.ac.uk/~vgg/data/voxceleb/)各车型的EER现行排名.
