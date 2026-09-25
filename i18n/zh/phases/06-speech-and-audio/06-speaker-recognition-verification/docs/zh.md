# 说话人识别与验证

> ASR 回答的是"说了什么?"说话人识别回答的是"谁说的?"数学看起来一样——都是嵌入加余弦相似度——但每个生产决策都取决于一个 EER 数字。

**Type:** Build
**Languages:** Python
**Prerequisites:** 阶段 6 · 02(频谱图与 Mel),阶段 5 · 22(嵌入模型)
**Time:** 约 45 分钟

## 问题

用户说一句口令。你想知道:这是否是他们声称的那个人(*验证*,1:1),还是你的注册库中的第一个人(*识别*,1:N)?或者都不是——这是一个未知说话人(*开集*)?

2018 年以前:GMM-UBM + i-vectors。EER 尚可,但对信道变化(手机 vs 笔记本)和情绪很脆弱。2018–2022:x-vectors(TDNN 骨干,用角度间隔损失训练)。2022 年以后:ECAPA-TDNN 和 WavLM-large 嵌入。到 2026 年,该领域由三个模型和一个指标主导。

这个指标就是 **EER**——等错误率。设定决策阈值,使错误接受率 = 错误拒绝率。交叉点即为 EER。它出现在每篇论文、每个排行榜、每次采购会议中。

## 核心概念

![Enrollment + verification pipeline with embedding + cosine + EER](../assets/speaker-verification.svg)

**流水线。** 注册:录制目标说话人 5–30 秒的音频;计算固定维度的嵌入(ECAPA-TDNN 为 192 维,WavLM-large 为 256 维)。验证:获取测试语音的嵌入;计算余弦相似度;与阈值比较。

**ECAPA-TDNN(2020 年,2026 年仍是主流)。** Emphasized Channel Attention, Propagation and Aggregation - Time-Delay Neural Network。带 squeeze-excitation 的一维卷积块、多头注意力池化,随后接一个映射到 192 维的线性层。在 VoxCeleb 1+2(2,700 个说话人,110 万条语音)上用 Additive Angular Margin 损失(AAM-softmax)训练。

**WavLM-SV(2022 年以后)。** 用 AAM 损失微调预训练的 WavLM-large SSL 骨干。质量更高但更慢——300+ MB vs 15 MB。

**x-vector(基线)。** TDNN + 统计池化。经典方法;在 CPU / 边缘设备上仍然有用。

**AAM-softmax。** 标准 softmax 在角度空间中加上间隔 `m`:对正确类别为 `cos(θ + m)`。强制类间角度分离。典型 `m=0.2`,scale `s=30`。

### 打分

- **余弦相似度**:注册嵌入与测试嵌入之间的余弦。基于阈值的决策。
- **PLDA(概率性 LDA)。** 将嵌入投影到一个潜空间,使"同一说话人 vs 不同说话人"具有闭式似然比。在余弦之上叠加,可降低 10–20% 的 EER。2020 年前的标准做法;现在只用于闭集场景。
- **分数归一化。** `S-norm` 或 `AS-norm`:用一组冒名者的均值和标准差对每个分数进行归一化。跨域评估时必不可少。

### 你应该知道的数字(2026)

| 模型 | VoxCeleb1-O EER | 参数量 | 吞吐量(A100) |
|-------|-----------------|--------|-------------------|
| x-vector(经典) | 3.10% | 5 M | 400× RT |
| ECAPA-TDNN | 0.87% | 15 M | 200× RT |
| WavLM-SV large | 0.42% | 316 M | 20× RT |
| Pyannote 3.1 segmentation + embedding | 0.65% | 6 M | 100× RT |
| ReDimNet (2024) | 0.39% | 24 M | 100× RT |

### 说话人分离(Diarization)

"谁在什么时候说话",针对多说话人音频。流水线:VAD → 分段 → 对每段计算嵌入 → 聚类(凝聚聚类或谱聚类)→ 平滑边界。现代技术栈:`pyannote.audio` 3.1,它在一次调用中集成了说话人分段 + 嵌入 + 聚类。2026 年 AMI 上的 SOTA DER 约为 15%(从 2022 年的 23% 下降)。

```figure
sp-eer-crossover
```

## 动手实现

### 步骤 1:基于 MFCC 统计的玩具嵌入

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

离 SOTA 差得远——仅用于教学。`code/main.py` 将其作为合成说话人数据上的概念验证。

### 步骤 2:余弦相似度 + 阈值

```python
def cosine(a, b):
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(x * x for x in b))
    return dot / (na * nb) if na and nb else 0.0

def verify(enroll, test, threshold=0.75):
    return cosine(enroll, test) >= threshold
```

### 步骤 3:从相似度对计算 EER

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

### 步骤 4:用 SpeechBrain 实现生产级方案

```python
from speechbrain.pretrained import EncoderClassifier

clf = EncoderClassifier.from_hparams(source="speechbrain/spkrec-ecapa-voxceleb")

# enroll: average the embeddings of 3-5 clean samples
enroll = torch.stack([clf.encode_batch(load(x)) for x in enrollment_clips]).mean(0)
# verify
score = clf.similarity(enroll, clf.encode_batch(load("test.wav"))).item()
verdict = score > 0.25   # ECAPA typical threshold; tune on your data
```

### 步骤 5:用 pyannote 做说话人分离

```python
from pyannote.audio import Pipeline

pipe = Pipeline.from_pretrained("pyannote/speaker-diarization-3.1")
diarization = pipe("meeting.wav", num_speakers=None)
for turn, _, speaker in diarization.itertracks(yield_label=True):
    print(f"{turn.start:.1f}–{turn.end:.1f}  {speaker}")
```

## 应用选型

2026 年的技术栈:

| 场景 | 选择 |
|-----------|------|
| 闭集 1:1 验证,边缘设备 | ECAPA-TDNN + 余弦阈值 |
| 开集验证,云端 | WavLM-SV + AS-norm |
| 说话人分离(会议、播客) | `pyannote/speaker-diarization-3.1` |
| 反欺骗(重放 / 深度伪造检测) | AASIST 或 RawNet2 |
| 微型嵌入式(KWS + 注册) | Titanet-Small (NeMo) |

## 常见陷阱

- **信道失配。** 在 VoxCeleb(网络视频)上训练的模型 ≠ 电话音频。务必在目标信道上评估。
- **短语音。** 测试音频低于 3 秒时,EER 会急剧恶化。
- **带噪注册。** 一条带噪的注册音频会污染锚点。使用 ≥3 条干净样本并取平均。
- **跨条件使用固定阈值。** 始终在目标域的留出开发集上调整阈值。
- **对未归一化的嵌入做余弦。** 先做 L2 归一化;否则模长会占主导。

## 交付

保存为 `outputs/skill-speaker-verifier.md`。确定模型、注册协议、阈值调优方案和欺诈防护措施。

## 练习

1. **简单。** 运行 `code/main.py`。构建合成的"说话人"(不同的音调特征),注册,并在 100 对的试验列表上计算 EER。
2. **中等。** 在 30 条 VoxCeleb1 语音上使用 SpeechBrain ECAPA(5 个说话人 × 每人 6 条)。分别用余弦和 PLDA 计算 EER 并比较。
3. **困难。** 用 `pyannote.audio` 构建完整的 注册 → 分离 → 验证 流水线。在 AMI 开发集上评估 DER。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------------|-----------------------|
| EER | 头条指标 | 错误接受 = 错误拒绝时的阈值。 |
| 验证 | 1:1 | "这是 Alice 吗?" |
| 识别 | 1:N | "谁在说话?" |
| 开集 | 可能出现未知者 | 测试集可能包含未注册的说话人。 |
| 注册 | 登记 | 计算某说话人的参考嵌入。 |
| AAM-softmax | 那个损失函数 | 带加性角度间隔的 softmax;强制簇间分离。 |
| PLDA | 经典打分方法 | 概率性 LDA;在嵌入之上做似然比打分。 |
| DER | 分离指标 | Diarization Error Rate——漏检 + 虚警 + 混淆。 |

## 延伸阅读

- [Snyder et al. (2018). X-Vectors: Robust DNN Embeddings for Speaker Recognition](https://www.danielpovey.com/files/2018_icassp_xvectors.pdf) — 深度嵌入的经典论文。
- [Desplanques et al. (2020). ECAPA-TDNN](https://arxiv.org/abs/2005.07143) — 2020–2026 年的主导架构。
- [Chen et al. (2022). WavLM: Large-Scale Self-Supervised Pre-Training for Full Stack Speech Processing](https://arxiv.org/abs/2110.13900) — 用于 SV 和说话人分离的 SSL 骨干。
- [Bredin et al. (2023). pyannote.audio 3.1](https://github.com/pyannote/pyannote-audio) — 生产级分离 + 嵌入技术栈。
- [VoxCeleb leaderboard (updated 2026)](https://www.robots.ox.ac.uk/~vgg/data/voxceleb/) — 各模型当前的 EER 排名。