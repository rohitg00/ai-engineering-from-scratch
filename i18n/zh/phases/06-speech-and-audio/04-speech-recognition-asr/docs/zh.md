# 语音识别 (ASR) CTC,RNN-T,注意力

> 语音识别是每个时间步骤上的音频分类,由一个知道英语和沉默的序列模型粘在一起.CTC,RNN-T和注意力是这三个方法.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 02 (Spectrograms & Mel), Phase 5 · 08 (CNNs & RNNs for Text), Phase 5 · 10 (Attention)
**Time:** ~45 minutes

## 问题

你有一个10秒16kHz的剪辑.你想要一个字符串:"点燃厨房灯".挑战是结构性的:音频框架不会与字符一致. "好吧"字可能需要200ms或1200ms.沉默点击发言.有些音符比其他更长.输出代码的数量未知事先.

现在,我们有三种方法来解决这个问题:

1. **CTC (Connectionist Temporal Classification).**发射每个框架的代币概率,包括一个特殊的 *空白*. 解码时的崩重复和空白. 非自动降低,快速. 用于 wav2vec 2.0, MMS.
2. **RNN-T (Recurrent Neural Network Transducer).**联合网络预测下一个代码器框架和之前的代码. 流式. 谷歌的设备ASR,NVIDIA Parakeet使用.
3. **Attention encoder-decoder.**编码器将音频压缩到隐藏状态,解码器交叉处理以自动降低生成代币.

2026年,在 LibriSpeech 测试清洁度上,SOTA WER 是1.4% (Parakeet-TDT-1.1B,NVIDIA) 和1.58%.

## 概念

![Three ASR formulations: CTC, RNN-T, attention-encoder-decoder](../assets/asr-formulations.svg)

**CTC intuition.**让编码器输出`T`框架水平分布`V+1`标记 (V字符号 + 空格).`y`长度`U < T`任何的架配线都会崩到`y`输出:每的 argmax,崩重复,删除空白.

优点:非自行降低,可流动,视角零.缺点: *条件独立假设* 每个框架预测是独立的,因此没有内部语言模型.通过光束搜索或浅融合通过外部LM来解决.

**RNN-T intuition.**添加一个 *预测器* 网络,嵌入符号历史和一个 * 结合器* 结合预测器状态和编码器框架,成为一个共同分布`V+1`其他`+1`显然模型了CTC忽略的条件依赖性. 流动性,因为每个步骤只在过去的框架和过去的代币上.

优点:可流动+内部LM. 缺点:训练更复杂,更需要记忆 (3D损失网格);RNN-T损失内核本身是一个整体库类别.

**Attention encoder-decoder.**编码器 (6-32 个变压器层) 在日志邮件框架上. 编码器 (6-32 个变压器层) 交叉监督编码输出以自行降低代币. 没有对齐限制 注意力可以在音频中任何地方看. 除非你限制注意力外,无法流媒体 (碎片的声流, 2024).

优点:在线ASR上提供最高质量,使用标准seq2seq工具进行训练很容易.缺点:自动降低延迟与输出长度相比例;不能在没有工程的情况下流.

### 单个号码

**Word Error Rate**$(S + D + I) / N$在哪里$S$其他地方$D$除$I$入$N$字数: 字数: 字数: 字数: 字数: 字数: 字数: 字数: 字数: 字数: 字数: 字数: 字数: 字数: 字数: 字数: 字数: 字数: 字数: 字数: 字数: 字数: 字数: 字数: 字数: 字数: 字数: 字数: 字数: 字数: 字数: 字数: 字数: 字数: 字数: 字数: 字数: 字数: 字数: 字数: 字数: 字数: 字数: 字数: 字数: 字数: 字数: 字数: 字数: 字数: 字数: 字数: 字数: 字数: 字数: 字数:

| Model | LibriSpeech test-clean | LibriSpeech test-other | Size |
|-------|------------------------|------------------------|------|
| Parakeet-TDT-1.1B | 1.40% | 2.78% | 1.1B params |
| Whisper-Large-v3-turbo | 1.58% | 3.03% | 809M |
| Canary-1B Flash | 1.48% | 2.87% | 1B |
| Seamless M4T v2 | 1.7% | 3.5% | 2.3B |

所有这些都是基于编码器-解码器或RNN-T的.纯CTC系统 (wav2vec 2.0) 在测试清洁时约为1.82.1%.

```figure
ctc-collapse
```

## 建立它

### 步骤1:贪的CTC解码

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

两条规则: 连续重复,放空.`a a _ _ a b b _ c`其他`a a b c`现在,我们要去.

### 步骤2:光束检查CTC

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

制作使用LM融合的先树束搜索;这是概念骨架.

### 步骤3: WER

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

### 步骤4:推断与语

```python
import whisper
model = whisper.load_model("large-v3-turbo")
result = model.transcribe("clip.wav")
print(result["text"])
```

单线器为2026年最强的一般ASR. 运行在24GB的GPU上以20x实时.

### 步骤5:使用Parakeet或 wav2vec 2.0 流媒体

```python
from transformers import pipeline
asr = pipeline("automatic-speech-recognition", model="nvidia/parakeet-tdt-1.1b")
for chunk in streaming_audio():
    print(asr(chunk, return_timestamps=True))
```

流媒体ASR需要分片编码器注意和运输状态;使用支持它的库 (NeMo为Parakeet,`transformers`配合的管道`chunk_length_s`)

## 用它

现在,我们要做什么?

| Situation | Pick |
|-----------|------|
| English, offline, max quality | Whisper-large-v3-turbo |
| Multilingual, robust | SeamlessM4T v2 |
| Streaming, low latency | Parakeet-TDT-1.1B or Riva |
| Edge, mobile, <500 ms latency | Whisper-Tiny quantized or Moonshine (2024) |
| Long-form | Whisper with VAD-based chunking (WhisperX) |
| Domain-specific (medical, legal) | Fine-tune wav2vec 2.0 + domain LM fusion |

## 陷在2026年仍存在

- **No VAD.**语在沉默中产生幻觉 ("谢谢你观看!").
- **Character vs word vs subword WER.**报告词级 WER *后*正常化 (小字母,切符符删除).
- **Language ID drift.**声的自动LID误导噪音的视频到日本语或威尔士语;`language="en"`当你知道的时候.
- **Long clips without chunking.**语有30秒的时间.`chunk_length_s=30, stride=5`任何更长时间.

## 运送它

保存如`outputs/skill-asr-picker.md`选择模型,解码策略,分化和LM融合,

## 运动

1. **Easy.**跑步`code/main.py`它贪地解读了手工制作的CTC输出,并将WER计算在参考中.
2. **Medium.**按照第2步的前树束搜索进行正确执行 (考虑空格合并规则).在10个合成数据集中,比较贪.
3. **Hard.**使用`whisper-large-v3-turbo`现在[LibriSpeech test-clean](https://www.openslr.org/12)计算第100次发言的WER.

## 关键词

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| CTC | The blank-token loss | Marginal over all frame-to-token alignments; non-AR. |
| RNN-T | The streaming loss | CTC + next-token predictor; handles word-order. |
| Attention enc-dec | Whisper-style | Encoder + cross-attending decoder; best offline quality. |
| WER | The number you report | `(S+D+I)/N` at word level. |
| Blank | The emptiness | Special token in CTC signalling "no emission this frame". |
| LM fusion | External language model | Add weighted LM log-probs during beam search. |
| VAD | The silence gate | Voice activity detector; trims non-speech. |

## 进一步阅读

- [Graves et al. (2006). Connectionist Temporal Classification](https://www.cs.toronto.edu/~graves/icml_2006.pdf)CTC文件.
- [Graves (2012). Sequence Transduction with RNNs](https://arxiv.org/abs/1211.3711)RNN-T的报纸.
- [Radford et al. / OpenAI (2022). Whisper: Robust Speech Recognition via Large-Scale Weak Supervision](https://arxiv.org/abs/2212.04356)2022年法典文件;2024年将扩展到v3轮机.
- [NVIDIA NeMo — Parakeet-TDT card](https://huggingface.co/nvidia/parakeet-tdt-1.1b) 2026年开放ASR排名榜领导人.
- [Hugging Face — Open ASR Leaderboard](https://huggingface.co/spaces/hf-audio/open_asr_leaderboard)25多个模型的现场基准.
