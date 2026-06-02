# 语音识别（ASR）— CTC、RNN-T、Attention

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 语音识别就是在每个时间步上做音频分类，再由一个懂英语、也懂沉默的序列模型把它们粘起来。CTC、RNN-T、attention 是三种做法。挑一种，并搞清楚为什么。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 6 · 02 (Spectrograms & Mel), Phase 5 · 08 (CNNs & RNNs for Text), Phase 5 · 10 (Attention)
**Time:** ~45 minutes

## 问题（The Problem）

你手上有一段 10 秒的 16 kHz 音频，想要拿到一个字符串："turn on the kitchen lights"。挑战是结构性的：音频帧与字符并不是一一对齐。"okay" 这个词可能持续 200 ms，也可能 1200 ms。沉默会切割整段话语。有些音素就是比另一些长。输出 token 的数量也无法事先知道。

有三种建模方式来解决这个问题：

1. **CTC（Connectionist Temporal Classification，连接时序分类）。** 在每一帧输出 token 概率分布，其中包含一个特殊的 *blank*。解码时折叠重复并丢掉 blank。非 autoregressive，速度快。被 wav2vec 2.0、MMS 采用。
2. **RNN-T（Recurrent Neural Network Transducer，循环神经网络转录器）。** 由一个联合网络在给定 encoder 帧和已输出 token 的条件下预测下一个 token。可以流式处理。被 Google 端侧 ASR、NVIDIA Parakeet 采用。
3. **Attention encoder-decoder。** Encoder 把音频压缩成隐藏状态，decoder 通过 cross-attention（交叉注意力）autoregressive 地生成 token。被 Whisper、SeamlessM4T 采用。

到 2026 年，LibriSpeech test-clean 上的 SOTA WER 是 1.4%（Parakeet-TDT-1.1B，NVIDIA）和 1.58%（Whisper-Large-v3-turbo）。质量差距微乎其微；但部署上的差距巨大。

## 概念（The Concept）

![Three ASR formulations: CTC, RNN-T, attention-encoder-decoder](../assets/asr-formulations.svg)

**CTC 直觉。** 让 encoder 输出 `T` 个帧级分布，每个分布在 `V+1` 个 token 上（V 个字符 + blank）。对长度 `U < T` 的目标字符串 `y`，任何能折叠成 `y` 的帧对齐都算数。CTC 损失对所有这样的对齐求和。推理：每帧 argmax，折叠重复，去掉 blank。

优点：非 autoregressive、可流式、零前瞻。缺点：*条件独立假设* —— 每帧预测彼此独立，因此模型内部没有语言模型。可以通过 beam search 或 shallow fusion（浅融合）外挂一个 LM 来弥补。

**RNN-T 直觉。** 加一个 *predictor* 网络对已输出 token 历史做 embedding，再加一个 *joiner* 把 predictor 状态和 encoder 帧结合，输出 `V+1` 上的联合分布（`+1` 是 null / 不发射）。它显式建模了 CTC 忽略的条件依赖。可以流式处理，因为每一步只依赖过去的帧和过去的 token。

优点：可流式 + 内置 LM。缺点：训练更复杂、更吃显存（3D 损失格点）；RNN-T 损失 kernel 本身就足以撑起一整个库。

**Attention encoder-decoder。** Encoder（6-32 层 transformer）作用在 log-mel 帧上。Decoder（6-32 层 transformer）通过 cross-attention 关注 encoder 输出，autoregressive 地生成 token。没有对齐约束 —— attention 可以看向音频里的任何地方。除非限制 attention（例如 2024 年的 chunked Whisper-Streaming），否则不可流式。

优点：在离线 ASR 上质量最高，用标准 seq2seq 工具就能轻松训练。缺点：autoregressive 的延迟与输出长度成正比；不做工程改造就无法流式。

### WER：唯一一个数字

**Word Error Rate（词错误率）** = `(S + D + I) / N`，其中 S=替换、D=删除、I=插入、N=参考词数。等价于词级别的 Levenshtein 编辑距离。越低越好。WER 高于 20% 基本不可用；低于 5% 在朗读语音上达到了人类水平。2026 年标准基准上的数字：

| 模型 | LibriSpeech test-clean | LibriSpeech test-other | 体量 |
|-------|------------------------|------------------------|------|
| Parakeet-TDT-1.1B | 1.40% | 2.78% | 1.1B 参数 |
| Whisper-Large-v3-turbo | 1.58% | 3.03% | 809M |
| Canary-1B Flash | 1.48% | 2.87% | 1B |
| Seamless M4T v2 | 1.7% | 3.5% | 2.3B |

这些都是 encoder-decoder 或 RNN-T 路线。纯 CTC 系统（wav2vec 2.0）在 test-clean 上大约 1.8–2.1%。

## 动手实现（Build It）

### Step 1: greedy CTC decode

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

两条规则：折叠连续重复，丢掉 blank。例如：`a a _ _ a b b _ c` → `a a b c`。

### Step 2: beam-search CTC

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

生产环境会用前缀树 beam search 加 LM fusion；这里是概念骨架。

### Step 3: WER

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

### Step 4: 用 Whisper 做推理

```python
import whisper
model = whisper.load_model("large-v3-turbo")
result = model.transcribe("clip.wav")
print(result["text"])
```

2026 年最强通用 ASR 的一行调用。在 24 GB GPU 上以约 20× 实时速度运行。

### Step 5: 用 Parakeet 或 wav2vec 2.0 做流式

```python
from transformers import pipeline
asr = pipeline("automatic-speech-recognition", model="nvidia/parakeet-tdt-1.1b")
for chunk in streaming_audio():
    print(asr(chunk, return_timestamps=True))
```

流式 ASR 需要分块的 encoder attention 以及状态延续；用支持这件事的库（Parakeet 用 NeMo，或 `transformers` pipeline 加 `chunk_length_s`）。

## 用起来（Use It）

2026 年的技术栈：

| 场景 | 选什么 |
|-----------|------|
| 英文、离线、追求最高质量 | Whisper-large-v3-turbo |
| 多语种、鲁棒 | SeamlessM4T v2 |
| 流式、低延迟 | Parakeet-TDT-1.1B 或 Riva |
| 边缘、移动端、<500 ms 延迟 | 量化后的 Whisper-Tiny 或 Moonshine（2024） |
| 长音频 | Whisper 配 VAD 切分（WhisperX） |
| 领域特化（医疗、法律） | 微调 wav2vec 2.0 + 领域 LM fusion |

## 2026 年仍在踩的坑

- **没接 VAD。** 在沉默上跑 Whisper 会产生 hallucination（幻觉），比如 "Thanks for watching!"。永远先用 VAD 把关。
- **字符级 vs 词级 vs subword WER。** 报告的应该是 *归一化之后*（小写化、去标点）的词级 WER。
- **语种识别漂移。** Whisper 的自动 LID 会把噪声片段误判成日语或威尔士语；已知语言时强制 `language="en"`。
- **长片段没切分。** Whisper 的窗口是 30 秒。超过的，用 `chunk_length_s=30, stride=5`。

## 上线部署（Ship It）

存为 `outputs/skill-asr-picker.md`。针对给定的部署目标，挑选模型、解码策略、切分方式和 LM fusion 方案。

## 练习（Exercises）

1. **Easy.** 运行 `code/main.py`。它会贪心解码一个手工构造的 CTC 输出，并对参考文本计算 WER。
2. **Medium.** 把 Step 2 的前缀树 beam search 实现严谨（正确处理 blank 合并规则）。在一个 10 条样本的合成数据集上与贪心解码对比。
3. **Hard.** 在 [LibriSpeech test-clean](https://www.openslr.org/12) 上用 `whisper-large-v3-turbo`。在前 100 条话语上计算 WER。和已发布的数字对比。

## 关键术语（Key Terms）

| 术语 | 大家口头怎么说 | 它真正的意思 |
|------|-----------------|-----------------------|
| CTC | 那个有 blank token 的损失 | 在所有帧到 token 对齐上的边缘概率；非 AR。 |
| RNN-T | 那个流式损失 | CTC + 下一 token predictor；处理词序。 |
| Attention enc-dec | Whisper 那种 | Encoder + cross-attention 的 decoder；离线质量最佳。 |
| WER | 你最后报告的那个数字 | 词级别的 `(S+D+I)/N`。 |
| Blank | 那个"空" | CTC 中表示"本帧不发射"的特殊 token。 |
| LM fusion | 外挂语言模型 | 在 beam search 中加权混入 LM 的 log 概率。 |
| VAD | 那个静音闸门 | 语音活动检测器；裁掉非语音段。 |

## 延伸阅读（Further Reading）

- [Graves et al. (2006). Connectionist Temporal Classification](https://www.cs.toronto.edu/~graves/icml_2006.pdf) — CTC 论文。
- [Graves (2012). Sequence Transduction with RNNs](https://arxiv.org/abs/1211.3711) — RNN-T 论文。
- [Radford et al. / OpenAI (2022). Whisper: Robust Speech Recognition via Large-Scale Weak Supervision](https://arxiv.org/abs/2212.04356) — 2022 年的奠基论文；2024 年扩展出 v3-turbo。
- [NVIDIA NeMo — Parakeet-TDT card](https://huggingface.co/nvidia/parakeet-tdt-1.1b) — 2026 年 Open ASR Leaderboard 榜首。
- [Hugging Face — Open ASR Leaderboard](https://huggingface.co/spaces/hf-audio/open_asr_leaderboard) — 25+ 模型的实时基准对比。
