# 说话人识别与验证

> ASR 问的是“他们说了什么？”说话人识别问的是“谁说的？”数学原理看起来一样——嵌入加余弦——但每个生产决策都取决于一个单一的 EER 数字。

**类型：** 构建
**语言：** Python
**前置条件：** 阶段 6 · 02（声谱图与梅尔频谱），阶段 5 · 22（嵌入模型）
**时间：** 约 45 分钟

## 问题

用户说出一句口令。你想知道：这个人是他们声称的那个人吗（*验证*，1:1），还是它是你的注册库中的第一人（*识别*，1:N）？或者都不是——这是一个未知说话人（*开集*）？

2018 年之前：GMM-UBM + i-vector。合理的 EER 但对信道变化（手机 vs 笔记本）和情绪很脆弱。2018–2022：x-vector（使用角度边界训练的 TDNN 骨干）。2022 年后：ECAPA-TDNN 和 WavLM-large 嵌入。到 2026 年，该领域由三个模型和一个指标主导。

指标是 **EER**——等错误率（Equal Error Rate）。设置决策阈值使得错误接受率等于错误拒绝率。交叉点即为 EER。出现在每篇论文、每个排行榜、每次采购中。

## 概念

![注册 + 验证流程，包含嵌入 + 余弦 + EER](../assets/speaker-verification.svg)

**流程。** 注册：录制目标说话人 5–30 秒；计算固定维度的嵌入（ECAPA-TDNN 为 192 维，WavLM-large 为 256 维）。验证：获取测试话语嵌入；计算余弦相似度；与阈值比较。

**ECAPA-TDNN（2020，2026 年仍占主导）。** 增强通道注意力、传播与聚合的时延神经网络（Emphasized Channel Attention, Propagation and Aggregation - Time-Delay Neural Network）。包含挤压激励的 1D 卷积块、多头注意力池化，后接一个线性层到 192 维。在 VoxCeleb 1+2（2700 个说话人，110 万条话语）上使用加性角度边界损失（AAM-softmax）进行训练。

**WavLM-SV（2022 年后）。** 使用 AAM 损失微调预训练的 WavLM-large SSL 骨干。质量更高但更慢——300+ MB 对比 15 MB。

**x-vector（基线）。** TDNN + 统计池化。经典；在 CPU/边缘设备上仍然有用。

**AAM-softmax。** 在角度空间中为正确类别添加边界 `m` 的标准 softmax：`cos(θ + m)`。强制类间角度分离。典型值 `m=0.2`，缩放因子 `s=30`。

### 评分

- **余弦** 计算注册嵌入与测试嵌入之间的相似度。基于阈值做出决策。
- **PLDA（概率性线性判别分析，Probabilistic LDA）。** 将嵌入投影到一个潜在空间，其中相同说话人与不同说话人具有封闭形式的似然比。在余弦之上额外使用可使 EER 降低 10–20%。2020 年之前的标准方法；现在仅在闭集设置中使用。
- **分数归一化。** `S-norm` 或 `AS-norm`：根据一组冒名者均值和标准差对每个分数进行归一化。对于跨域评估至关重要。

### 你应该知道的数字（2026）

| 模型 | VoxCeleb1-O EER | 参数 | 吞吐量（A100） |
|-------|-----------------|--------|-------------------|
| x-vector（经典） | 3.10% | 5 M | 400× RT |
| ECAPA-TDNN | 0.87% | 15 M | 200× RT |
| WavLM-SV large | 0.42% | 316 M | 20× RT |
| Pyannote 3.1 分割 + 嵌入 | 0.65% | 6 M | 100× RT |
| ReDimNet（2024） | 0.39% | 24 M | 100× RT |

### 说话人分离（Diarization）

多说话人片段中“谁在什么时候说话”。流程：VAD → 分割 → 对每个片段嵌入 → 聚类（凝聚式或谱聚类） → 平滑边界。现代堆栈：`pyannote.audio` 3.1，它在一个调用中捆绑了说话人分割 + 嵌入 + 聚类。2026 年 AMI 上的 SOTA DER 约为 15%（从 2022 年的 23% 下降）。

## 构建

### 步骤 1：基于 MFCC 统计量的玩具嵌入

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

远非最先进——仅用于教学。`code/main.py` 将其用作合成说话人数据上的概念验证。

### 步骤 2：余弦相似度 + 阈值

```python
def cosine(a, b):
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(x * x for x in b))
    return dot / (na * nb) if na and nb else 0.0

def verify(enroll, test, threshold=0.75):
    return cosine(enroll, test) >= threshold
```

     3>
```

### 步骤3：EER from similarity pairs; EER (Equal Error equal error rate rate)= From similarity pairs.From score = cosine(enroll,test

)  # 这里应该=enroll，打错了 (-: sorry, michellins---they inspired pirates that way..., so temporarily omitted, likewise omitted the mandatory "( \")" char for Cosine pairs; EER=Equal Error equal error - from ->????; Rate x = cosine(enroll,test);y = cosine(retention-test forwds)trong.