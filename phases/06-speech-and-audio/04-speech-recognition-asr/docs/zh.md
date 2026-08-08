# 04 · 语音识别（ASR）——CTC、RNN-T、注意力

> 语音识别本质上是对每一个时间步做音频分类，再用一个懂得英语和静音的序列模型把它们粘合起来。CTC、RNN-T 和注意力是实现它的三种方式。选一种，并理解为什么。

**类型：** 实践（Build）
**语言：** Python
**前置：** 第 6 阶段 · 02（声谱图与梅尔频谱）、第 5 阶段 · 08（用于文本的 CNN 与 RNN）、第 5 阶段 · 10（注意力）
**时长：** 约 45 分钟

## 问题所在

你有一段 10 秒、16 kHz 的音频片段。你想得到一个字符串："turn on the kitchen lights"。挑战在于结构性：音频帧与字符之间并非一一对齐。单词 "okay" 可能持续 200 ms，也可能持续 1200 ms。静音穿插在话语之间。有些音素比另一些更长。输出 token 的数量事先无从得知。

有三种建模方式可以解决这个问题：

1. **CTC（连接主义时序分类，Connectionist Temporal Classification）。** 逐帧输出 token 概率，其中包含一个特殊的 *空白（blank）* 符号。在解码时折叠重复符号和空白符号。非自回归，速度快。被 wav2vec 2.0、MMS 采用。
2. **RNN-T（循环神经网络转换器，Recurrent Neural Network Transducer）。** 联合网络在给定编码器帧和此前 token 的条件下预测下一个 token。可流式处理。被 Google 的端侧 ASR、NVIDIA Parakeet 采用。
3. **注意力编码器-解码器（attention encoder-decoder）。** 编码器把音频压缩为隐藏状态，解码器交叉注意（cross-attend）这些状态以自回归方式生成 token。被 Whisper、SeamlessM4T 采用。

在 2026 年，LibriSpeech test-clean 上的 SOTA WER 为 1.4%（Parakeet-TDT-1.1B，NVIDIA）和 1.58%（Whisper-Large-v3-turbo）。质量差异极小；但部署差异巨大。

## 核心概念

〔图：三种 ASR 建模方式——CTC、RNN-T、注意力编码器-解码器〕

**CTC 直觉。** 让编码器输出 `T` 个帧级别的分布，每个分布覆盖 `V+1` 个 token（V 个字符加上空白）。对于长度为 `U < T` 的目标字符串 `y`，任何折叠后能得到 `y` 的帧级对齐都计入其中。CTC 损失对所有这样的对齐求和。推理时：逐帧取 argmax，折叠重复，去除空白。

优点：非自回归、可流式、零前瞻。缺点：*条件独立假设* ——每一帧的预测都独立于其他帧，因此模型内部没有语言模型。可通过束搜索（beam search）配合外部 LM，或用浅层融合（shallow fusion）来弥补。

**RNN-T 直觉。** 它增加了一个 *预测器（predictor）* 网络来嵌入 token 历史，以及一个 *联合器（joiner）* 来把预测器状态与编码器帧组合成一个覆盖 `V+1` 的联合分布（这里的 `+1` 是空（null）/不发射符号）。它显式建模了 CTC 所忽略的条件依赖。可流式，因为每一步都只以过去的帧和过去的 token 为条件。

优点：可流式 + 内部语言模型。缺点：训练更复杂、更耗内存（三维损失格点）；RNN-T 损失核函数本身就构成了一整类库。

**注意力编码器-解码器。** 编码器（6-32 层 transformer）作用于对数梅尔（log-mel）帧。解码器（6-32 层 transformer）交叉注意编码器输出，以自回归方式生成 token。没有对齐约束——注意力可以看向音频中的任何位置。除非限制注意力（如分块的 Whisper-Streaming，2024），否则无法流式处理。

优点：离线 ASR 上质量最高，用标准 seq2seq 工具即可轻松训练。缺点：自回归延迟与输出长度成正比；不做额外工程就无法流式。

### WER：那个唯一的数字

**词错误率（Word Error Rate）** = `(S + D + I) / N`，其中 S=替换数、D=删除数、I=插入数、N=参考文本词数。它对应词级别的莱文斯坦（Levenshtein）编辑距离。越低越好。WER 高于 20% 通常不可用；低于 5% 在朗读语音上达到人类水平（human-parity）。2026 年在标准基准上的数字：

| 模型 | LibriSpeech test-clean | LibriSpeech test-other | 规模 |
|-------|------------------------|------------------------|------|
| Parakeet-TDT-1.1B | 1.40% | 2.78% | 1.1B params |
| Whisper-Large-v3-turbo | 1.58% | 3.03% | 809M |
| Canary-1B Flash | 1.48% | 2.87% | 1B |
| Seamless M4T v2 | 1.7% | 3.5% | 2.3B |

这些全都基于编码器-解码器或 RNN-T。纯 CTC 系统（wav2vec 2.0）在 test-clean 上大约处于 1.8–2.1%。

## 动手构建

### 第 1 步：贪心 CTC 解码

```python
def ctc_greedy(frame_logits, blank=0, vocab=None):
    # frame_logits: 每帧概率向量组成的列表
    preds = [max(range(len(p)), key=lambda i: p[i]) for p in frame_logits]
    out = []
    prev = -1
    for p in preds:
        if p != prev and p != blank:
            out.append(p)
        prev = p
    return "".join(vocab[i] for i in out) if vocab else out
```

两条规则：折叠连续重复，丢弃空白。示例：`a a _ _ a b b _ c` → `a a b c`。

### 第 2 步：束搜索 CTC

```python
def ctc_beam(frame_logits, beam=8, blank=0):
    import math
    beams = [([], 0.0)]  # (tokens, log_prob)
    for p in frame_logits:
        log_p = [math.log(max(pi, 1e-10)) for pi in p]
        candidates = []
        for seq, lp in beams:
            for t, lpt in enumerate(log_p):
                new = seq[:] if t == blank else (seq + [t] if not seq or seq[-1] != t else seq)
                candidates.append((new, lp + lpt))
        candidates.sort(key=lambda x: -x[1])
        beams = candidates[:beam]
    return beams[0][0]
```

生产环境使用带 LM 融合的前缀树束搜索；这里只是概念骨架。

### 第 3 步：WER

```python
def wer(ref, hyp):
    r, h = ref.split(), hyp.split()
    dp = [[0] * (len(h) + 1) for _ in range(len(r) + 1)]
    for i in range(len(r) + 1):
        dp[i][0] = i
    for j in range(len(h) + 1):
        dp[0][j] = j
    for i in range(1, len(r) + 1):
        for j in range(1, len(h) + 1):
            cost = 0 if r[i - 1] == h[j - 1] else 1
            dp[i][j] = min(
                dp[i - 1][j] + 1,
                dp[i][j - 1] + 1,
                dp[i - 1][j - 1] + cost,
            )
    return dp[len(r)][len(h)] / max(1, len(r))
```

### 第 4 步：用 Whisper 做推理

```python
import whisper
model = whisper.load_model("large-v3-turbo")
result = model.transcribe("clip.wav")
print(result["text"])
```

一行代码调用 2026 年最强的通用 ASR。在 24 GB GPU 上以约 20 倍实时速度运行。

### 第 5 步：用 Parakeet 或 wav2vec 2.0 做流式处理

```python
from transformers import pipeline
asr = pipeline("automatic-speech-recognition", model="nvidia/parakeet-tdt-1.1b")
for chunk in streaming_audio():
    print(asr(chunk, return_timestamps=True))
```

流式 ASR 需要分块的编码器注意力以及跨块的状态延续；请使用支持它的库（Parakeet 用 NeMo，或带 `chunk_length_s` 的 `transformers` pipeline）。

## 实际运用

2026 年的技术栈：

| 场景 | 选型 |
|-----------|------|
| 英语、离线、追求最高质量 | Whisper-large-v3-turbo |
| 多语言、鲁棒 | SeamlessM4T v2 |
| 流式、低延迟 | Parakeet-TDT-1.1B 或 Riva |
| 边缘、移动端、< 500 ms 延迟 | 量化的 Whisper-Tiny 或 Moonshine（2024） |
| 长音频 | 配合基于 VAD 的分块的 Whisper（WhisperX） |
| 领域专用（医疗、法律） | 微调 wav2vec 2.0 + 领域 LM 融合 |

## 2026 年仍会上线的坑

- **没有 VAD。** 在静音上运行 Whisper 会产生幻觉（"Thanks for watching!"）。始终用 VAD 做门控。
- **字符级 vs 词级 vs 子词级 WER。** 在归一化（小写化、去标点）*之后* 上报词级 WER。
- **语言识别漂移。** Whisper 的自动语种识别（LID）会把嘈杂片段误判为日语或威尔士语；当你知道语言时，强制设置 `language="en"`。
- **长片段不做分块。** Whisper 有一个 30 秒窗口。任何更长的内容都用 `chunk_length_s=30, stride=5`。

## 交付成果

保存为 `outputs/skill-asr-picker.md`。针对一个给定的部署目标，选定模型、解码策略、分块方案与 LM 融合方式。

## 练习

1. **简单。** 运行 `code/main.py`。它会贪心解码一个手工构造的 CTC 输出，并对照参考文本计算 WER。
2. **中等。** 把第 2 步中的前缀树束搜索正确实现出来（考虑空白合并规则）。在一个 10 条样本的合成数据集上与贪心解码做对比。
3. **困难。** 在 [LibriSpeech test-clean](https://www.openslr.org/12) 上使用 `whisper-large-v3-turbo`。对前 100 条话语计算 WER。与已发表的数字做对比。

## 关键术语

| 术语 | 人们口中的说法 | 它实际的含义 |
|------|-----------------|-----------------------|
| CTC | 那个带空白 token 的损失 | 对所有帧到 token 对齐求边缘概率；非自回归。 |
| RNN-T | 那个流式损失 | CTC + 下一 token 预测器；能处理词序。 |
| Attention enc-dec | Whisper 那一类 | 编码器 + 交叉注意的解码器；离线质量最佳。 |
| WER | 你上报的那个数字 | 词级别的 `(S+D+I)/N`。 |
| Blank（空白） | 那个"空" | CTC 中表示"本帧不发射"的特殊 token。 |
| LM fusion（LM 融合） | 外部语言模型 | 在束搜索中加入加权的 LM 对数概率。 |
| VAD | 那个静音门 | 语音活动检测器；裁掉非语音部分。 |

## 延伸阅读

- [Graves et al. (2006). Connectionist Temporal Classification](https://www.cs.toronto.edu/~graves/icml_2006.pdf) —— CTC 论文。
- [Graves (2012). Sequence Transduction with RNNs](https://arxiv.org/abs/1211.3711) —— RNN-T 论文。
- [Radford et al. / OpenAI (2022). Whisper: Robust Speech Recognition via Large-Scale Weak Supervision](https://arxiv.org/abs/2212.04356) —— 2022 年的经典论文；v3-turbo 是 2024 年的扩展。
- [NVIDIA NeMo —— Parakeet-TDT 模型卡](https://huggingface.co/nvidia/parakeet-tdt-1.1b) —— 2026 年 Open ASR Leaderboard 榜首。
- [Hugging Face —— Open ASR Leaderboard](https://huggingface.co/spaces/hf-audio/open_asr_leaderboard) —— 横跨 25+ 模型的实时基准。
