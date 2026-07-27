# 语音识别（ASR）——CTC、RNN-T、Attention

> 语音识别本质上是每个时间步的音频分类，再由一个通晓英语和静默的序列模型串联起来。CTC、RNN-T 和 Attention 是三种实现方式。选择一种并理解其原理。

**类型：** 动手构建
**语言：** Python
**前置知识：** 阶段 6 · 02（频谱图与 Mel），阶段 5 · 08（文本领域的 CNN 与 RNN），阶段 5 · 10（注意力机制）
**时间：** ~45 分钟

## 问题

你有一段 10 秒 16 kHz 的音频，想要得到字符串："turn on the kitchen lights"。挑战在于结构性的：音频帧与字符不是一一对应的。"okay"这个单词可能占 200 ms 或 1200 ms。静默分隔话语。有些音素比其他音素长。输出 token 的数量事先未知。

三种形式解决了这个问题：

1. **CTC（连接主义时间分类）。** 每帧输出包括特殊 *blank* 在内的 token 概率。解码时合并重复并移除 blank。非自回归、速度快。wav2vec 2.0、MMS 使用此方法。
2. **RNN-T（循环神经网络转录器）。** 联合网络根据编码器帧和前序 token 预测下一个 token。可流式处理。谷歌设备端 ASR、NVIDIA Parakeet 使用此方法。
3. **Attention 编码器-解码器。** 编码器将音频压缩为隐藏状态，解码器通过交叉注意力自回归生成 token。Whisper、SeamlessM4T 使用此方法。

2026 年，LibriSpeech test-clean 上的 SOTA WER 为 1.4%（Parakeet-TDT-1.1B，NVIDIA）和 1.58%（Whisper-Large-v3-turbo）。差异极小；部署差异巨大。

## 概念

![三种 ASR 形式：CTC、RNN-T、Attention 编码器-解码器](../assets/asr-formulations.svg)

**CTC 原理。** 让编码器输出 `T` 个帧级分布，覆盖 `V+1` 个 token（V 个字符 + blank）。对于长度为 `U < T` 的目标字符串 `y`，任何能折叠为 `y` 的帧对齐方式都算数。CTC 损失对所有这类对齐进行求和。推理：每帧 argmax、合并重复、移除 blank。

优点：非自回归、可流式处理、零预读。缺点：*条件独立性假设*——每帧预测独立于其他帧，因此没有内部语言模型。通过外部 LM 的 beam search 或 shallow fusion 来修复。

**RNN-T 原理。** 增加一个*预测器（predictor）*网络来嵌入 token 历史，以及一个*联合器（joiner）*将预测器状态与编码器帧结合为 `V+1` 上的联合分布（`+1` 是空/null 即不发射）。显式建模了 CTC 忽略的条件依赖。由于每一步只依赖于过去的帧和过去的 token，因此可流式处理。

优点：可流式 + 内部 LM。缺点：训练更复杂且内存消耗大（3D 损失网格）；RNN-T 损失核本身就是一个完整的库类别。

**Attention 编码器-解码器。** 编码器（6-32 层 Transformer）处理对数 Mel 帧。解码器（6-32 层 Transformer）通过交叉注意力关注编码器输出来自回归生成 token。无对齐约束——注意力可以查看音频的任何位置。不可流式处理，除非限制注意力范围（chunked Whisper-Streaming，2024）。

优点：离线 ASR 质量最高，使用标准 seq2seq 工具容易训练。缺点：自回归延迟与输出长度成正比；不经工程设计无法流式处理。

### WER：核心指标

**词错误率（Word Error Rate）** = `(S + D + I) / N`，其中 S=替换、D=删除、I=插入、N=参考词数。在词级别上匹配 Levenshtein 编辑距离。越低越好。WER 超过 20% 通常不可用；低于 5% 对于朗读语音相当于人类水平。2026 年标准基准上的数据：

| 模型 | LibriSpeech test-clean | LibriSpeech test-other | 参数量 |
|-------|------------------------|------------------------|------|
| Parakeet-TDT-1.1B | 1.40% | 2.78% | 1.1B |
| Whisper-Large-v3-turbo | 1.58% | 3.03% | 809M |
| Canary-1B Flash | 1.48% | 2.87% | 1B |
| Seamless M4T v2 | 1.7% | 3.5% | 2.3B |

以上都是基于编码器-解码器或 RNN-T。纯 CTC 系统（wav2vec 2.0）在 test-clean 上约为 1.8–2.1%。

## 动手实现

### 第 1 步：贪心 CTC 解码

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

两条规则：合并连续重复，丢弃 blank。示例：`a a _ _ a b b _ c` → `a a b c`。

### 第 2 步：beam search CTC

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

生产环境使用带 LM 融合的前缀树 beam search；这里是概念骨架。

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

### 第 4 步：使用 Whisper 进行推理

```python
import whisper
model = whisper.load_model("large-v3-turbo")
result = model.transcribe("clip.wav")
print(result["text"])
```

2026 年最强大的通用 ASR 一行代码搞定。在 24 GB GPU 上以约 20 倍实时速度运行。

### 第 5 步：使用 Parakeet 或 wav2vec 2.0 流式处理

```python
from transformers import pipeline
asr = pipeline("automatic-speech-recognition", model="nvidia/parakeet-tdt-1.1b")
for chunk in streaming_audio():
    print(asr(chunk, return_timestamps=True))
```

流式 ASR 需要分块编码器注意力和状态继承；使用支持此功能的库（NeMo 用于 Parakeet，带 `chunk_length_s` 参数的 `transformers` pipeline）。

## 使用建议

2026 年技术栈：

| 场景 | 选择 |
|-----------|------|
| 英语、离线、最高质量 | Whisper-large-v3-turbo |
| 多语言、鲁棒性 | SeamlessM4T v2 |
| 流式、低延迟 | Parakeet-TDT-1.1B 或 Riva |
| 边缘设备、移动端、<500 ms 延迟 | Whisper-Tiny 量化版或 Moonshine (2024) |
| 长语音 | 基于 VAD 分块的 Whisper（WhisperX） |
| 领域特定（医疗、法律） | 微调 wav2vec 2.0 + 领域 LM 融合 |

## 2026 年仍然常见的陷阱

- **没有 VAD。** 在静默上运行 Whisper 会产生幻觉（"Thanks for watching!"）。务必使用 VAD 进行门控。
- **字符 vs 词 vs 子词 WER。** 报告经过归一化（小写、去除标点）后的词级 WER。
- **语言 ID 漂移。** Whisper 的自动 LID 会将噪声片段误判为日语或威尔士语；在已知语言时强制指定 `language="en"`。
- **长片段不分块。** Whisper 有 30 秒窗口限制。对于超过 30 秒的音频，使用 `chunk_length_s=30, stride=5`。

## 交付物

保存为 `outputs/skill-asr-picker.md`。针对给定部署目标选择模型、解码策略、分块方式和 LM 融合。

## 练习

1. **简单。** 运行 `code/main.py`。它对一个人工构造的 CTC 输出进行贪心解码，并计算与参考文本的 WER。
2. **中等。** 正确实现第 2 步中的前缀树 beam search（考虑 blank 合并规则）。在 10 个示例的合成数据集上与贪心方法比较。
3. **困难。** 在 [LibriSpeech test-clean](https://www.openslr.org/12) 上使用 `whisper-large-v3-turbo`。计算前 100 条话语的 WER。与已发布的数据进行比较。

## 关键词汇

| 术语 | 通常说法 | 实际含义 |
|------|-----------------|-----------------------|
| CTC | 带 blank token 的损失函数 | 所有帧到 token 对齐的边缘求和；非自回归。 |
| RNN-T | 流式损失函数 | CTC + 下一个 token 预测器；处理词序。 |
| Attention enc-dec | Whisper 风格 | 编码器 + 交叉注意力解码器；离线质量最佳。 |
| WER | 你报告的指标 | `(S+D+I)/N`，词级别。 |
| Blank | 空 | CTC 中表示"该帧不发射"的特殊 token。 |
| LM fusion | 外部语言模型 | beam search 时加入加权 LM 对数概率。 |
| VAD | 静默门控 | 语音活动检测器；修剪非语音部分。 |

## 延伸阅读

- [Graves et al. (2006). Connectionist Temporal Classification](https://www.cs.toronto.edu/~graves/icml_2006.pdf)——CTC 论文。
- [Graves (2012). Sequence Transduction with RNNs](https://arxiv.org/abs/1211.3711)——RNN-T 论文。
- [Radford et al. / OpenAI (2022). Whisper: Robust Speech Recognition via Large-Scale Weak Supervision](https://arxiv.org/abs/2212.04356)——2022 年经典论文；2024 年 v3-turbo 扩展版。
- [NVIDIA NeMo——Parakeet-TDT card](https://huggingface.co/nvidia/parakeet-tdt-1.1b)——2026 年开放 ASR 排行榜领导者。
- [Hugging Face——Open ASR Leaderboard](https://huggingface.co/spaces/hf-audio/open_asr_leaderboard)——含 25+ 模型的实时基准测试。
