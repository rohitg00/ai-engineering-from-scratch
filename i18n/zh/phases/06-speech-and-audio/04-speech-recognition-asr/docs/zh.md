# 语音识别（ASR）— CTC、RNN-T、Attention

> 语音识别就是每个时间步上的音频分类，再由一个懂得英语和静音的序列模型把它们粘合起来。CTC、RNN-T 和注意力机制是实现它的三种方式。选一种，并弄明白为什么选它。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 6 · 02（频谱图与 Mel）、Phase 5 · 08（面向文本的 CNN 与 RNN）、Phase 5 · 10（Attention）
**Time:** 约 45 分钟

## 问题

你有一段 10 秒、16 kHz 的音频。你想得到一个字符串："turn on the kitchen lights"。难点是结构性的：音频帧与字符并非一一对应。"okay" 这个词可能占 200 毫秒，也可能占 1200 毫秒。静音穿插在话语之中。有些音素比其他的更长。输出 token 的数量事先不可知。

三种建模方式解决了这个问题：

1. **CTC（Connectionist Temporal Classification）。** 逐帧输出 token 概率，其中包含一个特殊的 *blank*。在解码时合并重复与 blank。非自回归，速度快。被 wav2vec 2.0、MMS 使用。
2. **RNN-T（Recurrent Neural Network Transducer）。** 联合网络根据编码器帧和之前的 token 预测下一个 token。可流式处理。被 Google 的端侧 ASR、NVIDIA Parakeet 使用。
3. **Attention 编码器-解码器。** 编码器将音频压缩为隐藏状态，解码器通过交叉注意力自回归地生成 token。被 Whisper、SeamlessM4T 使用。

2026 年，LibriSpeech test-clean 上的 SOTA WER 为 1.4%（Parakeet-TDT-1.1B，NVIDIA）和 1.58%（Whisper-Large-v3-turbo）。数字差异微小；部署差异巨大。

## 概念

![Three ASR formulations: CTC, RNN-T, attention-encoder-decoder](../assets/asr-formulations.svg)

**CTC 直觉。** 让编码器对 `V+1` 个 token（V 个字符 + blank）输出 `T` 个帧级分布。对于长度为 `U < T` 的目标字符串 `y`，任何能折叠为 `y` 的帧对齐都算数。CTC 损失对所有这类对齐求和。推理：逐帧 argmax，合并重复，去除 blank。

优点：非自回归、可流式、零前瞻。缺点：*条件独立假设* —— 每帧的预测彼此独立，因此没有内部语言模型。可通过 beam search 或 shallow fusion 引入外部 LM 来弥补。

**RNN-T 直觉。** 增加一个嵌入 token 历史的 *predictor* 网络和一个 *joiner*，它将 predictor 状态与编码器帧结合，得到关于 `V+1` 的联合分布（其中 `+1` 表示空 / 不发射）。显式建模了 CTC 忽略的条件依赖。之所以可流式，是因为每一步只条件于过去的帧和过去的 token。

优点：可流式 + 内部 LM。缺点：训练更复杂且消耗内存（3D 损失格）；RNN-T 损失核函数本身就构成一个专门的库类别。

**Attention 编码器-解码器。** 编码器（6–32 层 Transformer）作用于 log-mel 帧。解码器（6–32 层 Transformer）对编码器输出做交叉注意力，自回归地生成 token。没有对齐约束 —— 注意力可以关注音频中的任意位置。不可流式，除非限制注意力（分块的 Whisper-Streaming，2024）。

优点：离线 ASR 质量最高，使用标准 seq2seq 工具即可轻松训练。缺点：自回归延迟与输出长度成正比；不经过工程改造无法流式。

### WER：那个唯一的数字

**词错误率（Word Error Rate）** = `(S + D + I) / N`，其中 S=替换数，D=删除数，I=插入数，N=参考词数。等同于词级别的 Levenshtein 编辑距离。越低越好。WER 高于 20% 通常不可用；低于 5% 对朗读语音即达到人类水平。2026 年标准基准上的数字：

| 模型 | LibriSpeech test-clean | LibriSpeech test-other | 大小 |
|-------|------------------------|------------------------|------|
| Parakeet-TDT-1.1B | 1.40% | 2.78% | 1.1B params |
| Whisper-Large-v3-turbo | 1.58% | 3.03% | 809M |
| Canary-1B Flash | 1.48% | 2.87% | 1B |
| Seamless M4T v2 | 1.7% | 3.5% | 2.3B |

这些模型全部基于编码器-解码器或 RNN-T。纯 CTC 系统（wav2vec 2.0）在 test-clean 上约为 1.8–2.1%。

```figure
ctc-collapse
```

## 动手实现

### 第 1 步：贪婪 CTC 解码

```python
def ctc_greedy(frame_logits, blank=0, vocab=None):
    # frame_logits: list of per-frame probability vectors
    preds = [max(range(len(p)), key=lambda i: p[i]) for p in frame_logits]
    out = []
    prev = -1
    for p in preds:
        if p != prev and p != blank:
            out.append(p)
        prev = p
    return "".join(vocab[i] for i in out) if vocab else out
```

两条规则：合并连续重复，丢弃 blank。例如：`a a _ _ a b b _ c` → `a a b c`。

### 第 2 步：beam-search CTC

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

生产环境使用结合 LM 的前缀树 beam search；这里只是概念骨架。

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

### 第 4 步：用 Whisper 推理

```python
import whisper
model = whisper.load_model("large-v3-turbo")
result = model.transcribe("clip.wav")
print(result["text"])
```

一行代码调用 2026 年最强的通用 ASR。在 24 GB GPU 上以约 20 倍实时速度运行。

### 第 5 步：用 Parakeet 或 wav2vec 2.0 进行流式处理

```python
from transformers import pipeline
asr = pipeline("automatic-speech-recognition", model="nvidia/parakeet-tdt-1.1b")
for chunk in streaming_audio():
    print(asr(chunk, return_timestamps=True))
```

流式 ASR 需要分块的编码器注意力和状态延续；使用支持它的库（Parakeet 用 NeMo，或使用带 `chunk_length_s` 的 `transformers` pipeline）。

## 用起来

2026 年的技术选型：

| 场景 | 选择 |
|-----------|------|
| 英语、离线、最高质量 | Whisper-large-v3-turbo |
| 多语言、鲁棒 | SeamlessM4T v2 |
| 流式、低延迟 | Parakeet-TDT-1.1B 或 Riva |
| 边缘、移动端、<500 ms 延迟 | Whisper-Tiny 量化版或 Moonshine（2024） |
| 长音频 | Whisper 配合基于 VAD 的分块（WhisperX） |
| 特定领域（医疗、法律） | 微调 wav2vec 2.0 + 领域 LM 融合 |

## 2026 年仍会踩的坑

- **不用 VAD。** 对静音运行 Whisper 会产生幻觉（"Thanks for watching!"）。务必先用 VAD 过滤。
- **字符级 vs 词级 vs 子词级 WER。** 在归一化（转小写、去除标点）*之后*报告词级 WER。
- **语言识别漂移。** Whisper 的自动 LID 会把含噪音频误判为日语或威尔士语；当你知道语言时，强制指定 `language="en"`。
- **长音频不分块。** Whisper 只有 30 秒窗口。更长的内容请使用 `chunk_length_s=30, stride=5`。

## 交付

保存为 `outputs/skill-asr-picker.md`。针对给定部署目标，选定模型、解码策略、分块方式和 LM 融合。

## 练习

1. **简单。** 运行 `code/main.py`。它对一个手工构造的 CTC 输出做贪婪解码，并计算与参考文本的 WER。
2. **中等。** 正确实现第 2 步中的前缀树 beam search（处理 blank 合并规则）。在一个 10 条样本的合成数据集上与贪婪解码对比。
3. **困难。** 在 [LibriSpeech test-clean](https://www.openslr.org/12) 上使用 `whisper-large-v3-turbo`。计算前 100 条话语的 WER。与已发表数字对比。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------------|-----------------------|
| CTC | 带 blank token 的损失 | 对所有帧到 token 对齐求边际；非自回归。 |
| RNN-T | 流式损失 | CTC + 下一 token 预测器；处理词序。 |
| Attention enc-dec | Whisper 风格 | 编码器 + 交叉注意力解码器；离线质量最佳。 |
| WER | 你报告的那个数字 | 词级别的 `(S+D+I)/N`。 |
| Blank | 那个空白 | CTC 中的特殊 token，表示"本帧不发射"。 |
| LM fusion | 外部语言模型 | 在 beam search 期间加入加权 LM 对数概率。 |
| VAD | 静音门控 | 语音活动检测器；裁剪非语音段。 |

## 延伸阅读

- [Graves et al. (2006). Connectionist Temporal Classification](https://www.cs.toronto.edu/~graves/icml_2006.pdf) — CTC 原始论文。
- [Graves (2012). Sequence Transduction with RNNs](https://arxiv.org/abs/1211.3711) — RNN-T 原始论文。
- [Radford et al. / OpenAI (2022). Whisper: Robust Speech Recognition via Large-Scale Weak Supervision](https://arxiv.org/abs/2212.04356) — 2022 年的权威论文；v3-turbo 扩展于 2024 年发布。
- [NVIDIA NeMo — Parakeet-TDT card](https://huggingface.co/nvidia/parakeet-tdt-1.1b) — 2026 Open ASR Leaderboard 榜首。
- [Hugging Face — Open ASR Leaderboard](https://huggingface.co/spaces/hf-audio/open_asr_leaderboard) — 覆盖 25+ 模型的实时基准。