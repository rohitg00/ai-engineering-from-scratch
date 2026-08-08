# 语音识别（ASB）- CTC、RNN-T、注意

> 语音识别是每个时间步的音频分类，由了解英语和静音的序列模型粘合在一起。CSC、RNN-T和注意力是实现这一目标的三种方法。选择一种并了解原因。

** 类型：** 构建
** 语言：** Python
** 预测：** 阶段6 · 02（Spectrograms & Mel），阶段5 · 08（CNN & RNN for Text），阶段5 · 10（Attention）
** 时间：** ~45分钟

## 问题

您有一个10秒的16 GHz剪辑。你想要一个字符串：“打开厨房的灯”。挑战是结构性的：音频帧不能与字符一一对齐。“okay”一词可能需要200 ms或1200 ms。沉默会打断话语。有些音素比其他音素长。输出代币的数量事先并不知道。

有三种配方可以解决这个问题：

1. **CTC（连接主义时态分类）。**发射每帧令牌概率，包括特殊的 * 空白 *。解码时折叠重复并空白。非自回归，快速。由wav2vec 2.0、MMS使用。
2. **RNN-T（循环神经网络传感器）。**给定编码器帧和之前的令牌，联合网络预测下一个令牌。可流式传输。由Google的设备上ASO、NVIDIA Parakeet使用。
3. ** 编码解码器注意 **编码器将音频压缩为隐藏状态，解码器交叉参与以自回归方式生成令牌。使用Whisper，无障碍M4T。

到2026年，LibriSpeech测试清洁的SOTA WER为1.4%（Parakeet-TDT-1.1B，NVIDIA）和1.58%（Whisper-Large-v3-turbo）。差异很小;部署差异很大。

## 概念

![Three ASR formulations: CTC, RNN-T, attention-encoder-decoder](../assets/asr-formulations.svg)

**CTC直觉。**让编码器输出“V+1”令牌上的“T”帧级分布（V字符+空白）。对于长度为“U < T”的目标字符串“y”，任何折叠到“y”的帧对齐都算数。所有此类排列的CTC损失总和。推理：每帧argmax，重复折叠，删除空白。

优点：非自回归、可流传输、零前瞻。缺点：* 条件独立性假设 * -每个帧预测都独立于其他帧，因此没有内部语言模型。通过射束搜索或浅层融合使用外部LM进行修复。

**RNN-T直觉。**添加嵌入令牌历史的 * 预测器 * 网络和将预测器状态与编码器帧结合到“V+1”上的联合分布中的 * 加入者 *（“+1”是空/无发射）。明确地建模了CTE忽略的条件依赖性。可流化，因为每个步骤仅以过去的帧和过去的令牌为条件。

优点：可流媒体+内部LM。缺点：训练更复杂且内存消耗量更大（3D损失网格）; RNN-T损失内核本身就是一个完整的库类别。

** 编码解码器注意 ** log-mel框架上的编码器（6-32个Transformer层）。解码器（6-32个Transformer层）交叉关注编码器输出以自回归生成令牌。没有对齐限制-注意力可以看到音频中的任何地方。除非您限制注意力，否则不可流媒体（chunked Whisper-Streaming，2024）。

优点：离线ASB质量最高，易于使用标准seq 2 seq工具进行培训。缺点：自回归延迟与输出长度成正比;没有工程就无法流媒体。

### WER：一个数字

** 字错误率 ** ='（S + D + I）/ N '，其中S=替换，D=删除，I=插入，N=参考字数。匹配Levenshtein在单词级别编辑距离。低越好。高于20%的WER通常无法使用;低于5%的WER是阅读言语的人类等效。2026年标准基准数字：

| 模型 | LibriSpeech测试干净 | LibriSpeech测试-其他 | 大小 |
|-------|------------------------|------------------------|------|
| Parakeet-TDT-1.1B | 百分之一点四 | 2.78% | 1.1B参数 |
| Whisper-Large-v3-涡轮增压 | 1.58% | 3.03% | 809M |
| 金丝雀-1B闪光 | 1.48% | 2.87% | 1B |
| 无缝M4 T v2 | 1.7% | 3.5% | 2.3B |

所有这些都是基于编码器-解码器或RNN-T的。纯CTC系统（wav 2 vec 2.0）在测试清洁时约为1.8-2.1%。

## 建设党

### 第1步：贪婪的CTC解码

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

两个规则：折叠连续重复，删除空白。示例：' a a_ _ a b b _ c '-' a a b c '。

### 第2步：射束搜索CTC

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

制作使用带有LM融合的前置树束搜索;这是概念框架。

### 第3步：WER

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

### 第4步：对Whisper的推断

```python
import whisper
model = whisper.load_model("large-v3-turbo")
result = model.transcribe("clip.wav")
print(result["text"])
```

2026年最强将军ASC的一句话。在24 GB图形处理器上以约20倍的实时速度运行。

### 第5步：使用长尾鹦鹉或wav2vec 2.0进行流媒体

```python
from transformers import pipeline
asr = pipeline("automatic-speech-recognition", model="nvidia/parakeet-tdt-1.1b")
for chunk in streaming_audio():
    print(asr(chunk, return_timestamps=True))
```

流媒体ASB需要分块编码器关注和结转状态;使用支持它的库（NeMo for Parakeet，带有“chunk_size_s”的“transformers”管道）。

## 使用它

2026年堆栈：

| 情况 | 接 |
|-----------|------|
| 英语，离线，最高质量 | Whisper-large-v3-turbo |
| 多语言、强大 | 无障碍M4 T v2 |
| 流媒体、低延迟 | 长尾小鹦鹉-TDT-1.1B或Riva |
| 边缘、移动、延迟< 500 ms | Whisper-Tiny quantized or Moonshine (2024) |
| 长式 | 具有基于VAR的分块的Whisper（WhisperX） |
| 特定领域（医疗、法律） | 微调wav2vec 2.0 +域LM融合 |

## 2026年仍存在的陷阱

- ** 没有VAR。**静音运行低语会产生幻觉（“谢谢观看！").始终使用VAR进行门控。
- ** 字符vs单词vs子单词WER。** * 规范化后报告单词级WER *（RST，标点符号删除）。
- ** 语言ID漂移。** Whisper的自动LID会将嘈杂的片段错误地传输到日语或威尔士语;当您知道时，强制' langue =' en '。
- ** 没有分块的长片段。** Whisper有30秒的窗口期。对于更长的时间，使用“chunk_long_s=30，stride=5”。

## 把它运

另存为“输出/skill-asr-picker.md”。针对给定部署目标的选择模型、解码策略、分块和LM融合。

## 演习

1. ** 简单。**运行'代码/main.py '。它贪婪地解码手工制作的CTC输出并根据参考计算WER。
2. ** 中等。**正确实施步骤2中的后缀树射束搜索（考虑空白合并规则）。在10个示例的合成数据集上与贪婪进行比较。
3. ** 很难。**在[LibriSpeech test-clean]（https：//www.openslr.org/12）上使用“whisper-large-v3-rio”。计算前100个话语的WER。与已发布的数字进行比较。

## 关键术语

| Term | 别人怎么说 | 它实际上意味着什么 |
|------|-----------------|-----------------------|
| CTC | 空白代币损失 | 在所有帧到标记的对齐中处于边缘;非AR。 |
| RNN-T | 流媒体损失 | CTC +下一个令牌预测器;处理词序。 |
| 注意en-dec | 耳语风格 | 编码器+交叉参与解码器;最佳离线质量。 |
| WER | 您报告的数字 | （S+D+I）/N。 |
| 空白 | 的空虚 | CTC中的特殊令牌发出“此帧没有发射”的信号。 |
| LM融合 | 外部语言模型 | 在射束搜索期间添加加权LM log-probs。 |
| VAD | 沉默之门 | 语音活动检测器;修剪非语音。 |

## 进一步阅读

- [Graves等人（2006）。连接主义时态分类]（https：//www.cs.toronto.edu/guardgraves/icml_2006.pdf）-反恐委员会论文。
- [格雷夫斯（2012）。使用RNN的序列转换]（https：//arxiv.org/ab/1211.3711）-RNN-T论文。
- [Radford等人/ OpenAI（2022）。低语：通过大规模弱监督实现稳健语音识别]（https：//arxiv.org/ab/2212.04356）-2022年规范论文; v3- 2024年的涡轮扩展。
- [英伟达NeMo - Parakeet-TDT卡]（https：//huggingface.co/nvidia/parakeet-tdt-1.1b）- 2026年开放式SVR排行榜领先者。
- [Hugging Face -打开ASB排行榜]（https：//huggingface.co/spaces/hf-audio/open_asr_leaderboard）-25+款车型的实时基准测试。
