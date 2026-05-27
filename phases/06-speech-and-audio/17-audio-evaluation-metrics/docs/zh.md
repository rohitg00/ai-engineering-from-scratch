# 音频评估——WER、MOS、UTMOS、MMAU、FAD 与开源排行榜

> 无法量化，就无法交付。本课列出2026年各项音频任务的核心指标：ASR（WER、CER、RTFx）、TTS（MOS、UTMOS、SECS、WER-on-ASR-round-trip）、音频语言模型（MMAU、LongAudioBench）、音乐（FAD、CLAP）、说话人（EER）。同时介绍可供对比的排行榜。

**类型:** 学习
**语言:** Python
**前置知识:** 第6阶段 · 04、06、07、09、10；第2阶段 · 09（模型评估）
**时间:** ~60分钟

## 问题

每个音频任务都有多种指标，每种指标衡量不同维度。用错指标，你就会交付一个在仪表盘上表现优秀、但在生产环境中表现糟糕的模型。2026年标准指标列表如下：

| 任务 | 主要指标 | 次要指标 |
|------|----------|----------|
| ASR | WER | CER · RTFx · 首词延迟 |
| TTS | MOS / UTMOS | SECS · WER-on-ASR-round-trip · CER · TTFA |
| 语音克隆 | SECS（ECAPA余弦相似度） | MOS · CER |
| 说话人验证 | EER | minDCF · 工作点FAR/FRR |
| 说话人日志化 | DER | JER · 说话人混淆度 |
| 音频分类 | top-1 · mAP | macro F1 · 每类召回率 |
| 音乐生成 | FAD | CLAP · 听感小组MOS |
| 音频语言模型 | MMAU-Pro | LongAudioBench · AudioCaps FENSE |
| 流式语音到语音 | 延迟P50/P95 | WER · MOS |

## 概念

![音频评估矩阵——指标 vs 任务 vs 2026排行榜](../assets/eval-landscape.svg)

### ASR指标

**WER（Word Error Rate，词错误率）**。公式：`(S + D + I) / N`。评分前需小写化、去除标点、标准化数字。使用 `jiwer` 或 OpenAI 的 `whisper_normalizer`。小于5% = 人类水平的朗读语音。

**CER（Character Error Rate，字符错误率）**。公式相同，基于字符级别。用于词边界模糊的声调语言（普通话、粤语）。

**RTFx（inverse real-time factor，逆实时因子）**。每墙上时钟秒处理的音频秒数。越高越好。Parakeet-TDT 达到3380倍。Whisper-large-v3 约30倍。

**首词延迟（First-token latency）**。从音频输入到第一个转录词的墙上时钟时间。对流式至关重要。Deepgram Nova-3：约150毫秒。

### TTS指标

**MOS（Mean Opinion Score，平均意见分）**。1-5分人工评分。黄金标准但速度慢。每个样本至少20位听者，每个模型至少100个样本。

**UTMOS（2022-2026）**。基于学习的MOS预测器。在标准基准上与人评MOS的相关性约0.9。F5-TTS：UTMOS 3.95；真实录音：4.08。

**SECS（Speaker Encoder Cosine Similarity，说话人编码器余弦相似度）**。用于语音克隆。参考音频与克隆输出音频的ECAPA嵌入余弦相似度。大于0.75 = 可识别的克隆。

**WER-on-ASR-round-trip（ASR往返WER）**。用Whisper识别TTS输出，计算输出与输入文本的WER。用于捕捉可懂度退化。2026 SOTA：< 2% CER。

**TTFA（time-to-first-audio，首次音频输出时间）**。墙上时钟延迟。Kokoro-82M：约100毫秒；F5-TTS：约1秒。

### 语音克隆专用指标

**SECS + MOS + CER** 三者联合。SECS高但MOS低意味着音色正确但不自然；反之则自然但说话人错误。

### 说话人验证

**EER（Equal Error Rate，等错误率）**。错误接受率等于错误拒绝率的阈值。ECAPA在VoxCeleb1-O上：0.87%。

**minDCF（min Detection Cost，最小检测代价）**。在选定工作点（通常FAR=0.01）的加权代价。比EER更贴近生产实际。

### 说话人日志化

**DER（Diarization Error Rate，日志化错误率）**。`(FA + Miss + Confusion) / total_speaker_time`。漏检语音 + 虚警语音 + 说话人混淆，各占比例。AMI会议：DER约10-20%为合理水平。pyannote 3.1 + Precision-2商业版：良好录音条件下DER <10%。

**JER（Jaccard Error Rate，贾卡德错误率）**。DER的替代指标，对短片段偏差更鲁棒。

### 音频分类

多标签：**mAP（mean Average Precision，平均精度均值）** 覆盖所有类别。AudioSet：BEATs-iter3达到0.548 mAP。

多类别互斥：**top-1、top-5准确率**。Speech Commands v2：99.0% top-1（Audio-MAE）。

类别不均衡：**macro F1** + **每类召回率**。逐类报告——聚合准确率会掩盖哪些类别失败。

### 音乐生成

**FAD（Fréchet Audio Distance，弗雷歇音频距离）**。真实音频与生成音频的VGGish嵌入分布之间的距离。MusicGen-small在MusicCaps上：4.5。MusicLM：4.0。越低越好。

**CLAP Score（CLAP分数）**。使用CLAP嵌入的文本-音频对齐分数。大于0.3 = 合理对齐。

**听感小组MOS**。消费级音乐的最终评判标准。Suno v5在TTS Arena上的ELO为1293（基于配对人工偏好）。

### 音频语言模型基准

**MMAU（Massive Multi-Audio Understanding，大规模多音频理解）**。10k个音频问答对。

**MMAU-Pro**。1800个困难项，四类：语音/声音/音乐/多音频。四选一随机基线25%。Gemini 2.5 Pro整体约60%；多音频子项约22%（跨所有模型）。

**LongAudioBench**。数分钟长的音频片段，附带语义查询。Audio Flamingo Next 超越 Gemini 2.5 Pro。

**AudioCaps / Clotho**。字幕生成基准。指标：SPICE、CIDEr、FENSE。

### 流式语音到语音

**延迟P50 / P95 / P99**。从用户语音结束到首次可听响应的墙上时钟时间。Moshi：200毫秒；GPT-4o Realtime：300毫秒。

**输出WER / MOS**。

**打断响应时间（Barge-in responsiveness）**。从用户打断到助手静音的时间。目标 < 150毫秒。

### 2026年排行榜

| 排行榜 | 赛道 | 链接 |
|--------|------|------|
| Open ASR Leaderboard（HF） | 英语 + 多语言 + 长语音 | `huggingface.co/spaces/hf-audio/open_asr_leaderboard` |
| TTS Arena（HF） | 英语TTS | `huggingface.co/spaces/TTS-AGI/TTS-Arena` |
| Artificial Analysis Speech | TTS + STT，基于配对投票的ELO | `artificialanalysis.ai/speech` |
| MMAU-Pro | 音频语言模型推理 | `mmaubenchmark.github.io` |
| SpeakerBench / VoxSRC | 说话人识别 | `voxsrc.github.io` |
| MMAU音乐子集 | 音乐音频语言模型 | （位于MMAU内） |
| HEAR基准 | 自监督音频 | `hearbenchmark.com` |

## 构建

### 第一步：带标准化的WER

```python
from jiwer import wer, Compose, ToLowerCase, RemovePunctuation, Strip

transform = Compose([ToLowerCase(), RemovePunctuation(), Strip()])
score = wer(
    truth="Please turn on the lights.",
    hypothesis="please turn on the light",
    truth_transform=transform,
    hypothesis_transform=transform,
)
# ~0.17
```

### 第二步：TTS往返WER

```python
def ttr_wer(tts_model, asr_model, texts):
    errors = []
    for txt in texts:
        audio = tts_model.synthesize(txt)
        recog = asr_model.transcribe(audio)
        errors.append(wer(truth=txt, hypothesis=recog))
    return sum(errors) / len(errors)
```

### 第三步：语音克隆SECS

```python
from speechbrain.inference.speaker import EncoderClassifier
sv = EncoderClassifier.from_hparams("speechbrain/spkrec-ecapa-voxceleb")

emb_ref = sv.encode_batch(load_wav("reference.wav"))
emb_clone = sv.encode_batch(load_wav("cloned.wav"))
secs = torch.nn.functional.cosine_similarity(emb_ref, emb_clone, dim=-1).item()
```

### 第四步：音乐生成FAD

```python
from frechet_audio_distance import FrechetAudioDistance
fad = FrechetAudioDistance()
score = fad.get_fad_score("generated_folder/", "reference_folder/")
```

### 第五步：说话人验证EER（与第6课代码相同）

```python
def eer(same_scores, diff_scores):
    thresholds = sorted(set(same_scores + diff_scores))
    best = (1.0, 0.0)
    for t in thresholds:
        far = sum(1 for s in diff_scores if s >= t) / len(diff_scores)
        frr = sum(1 for s in same_scores if s < t) / len(same_scores)
        if abs(far - frr) < best[0]:
            best = (abs(far - frr), (far + frr) / 2)
    return best[1]
```

## 使用

每次部署都搭配一个固定的评估框架，并在每次模型更新时运行。三条核心规则：

1. **评分前先标准化。** 小写化、去标点、数字展开。报告标准化规则。
2. **报告分布，而非平均值。** 延迟报告P50/P95/P99。分类报告每类召回率。MMAU报告每类别结果。
3. **运行一个标准的公开基准。** 即使你的生产数据不同，在Open ASR/TTS Arena/MMAU上报告也能让评审者进行公平对比。

## 陷阱

- **UTMOS外推。** 在VCTK风格干净语音上训练；对噪声/克隆/情感语音评分不佳。
- **MOS小组偏见。** 20名Amazon Mechanical Turk工人 ≠ 20名目标用户。如果风险高，应付费招募领域小组。
- **FAD依赖参考集。** 跨模型比较时必须使用相同的参考分布。
- **聚合WER。** 整体5%的WER可能掩盖带口音语音30%的WER。按人口统计细分报告。
- **公开基准饱和。** 大多数前沿模型在标准基准上已接近天花板。构建反映你流量分布的内部保留集。

## 交付

保存为 `outputs/skill-audio-evaluator.md`。为任何音频模型发布选择指标、基准和报告格式。

## 练习

1. **简单。** 运行 `code/main.py`。在玩具输入上计算WER/CER/EER/SECS/近似FAD/近似MMAU。
2. **中等。** 构建一个TTS往返WER框架。将你生成的Kokoro或F5-TTS输出通过Whisper识别。在50个提示上计算WER。标记WER > 10%的提示。
3. **困难。** 用第10课选择的音频语言模型在MMAU-Pro的语音+多音频子集上评分（各50项）。报告每类别准确率并与已发表数值比较。

## 关键术语

| 术语 | 通常说法 | 实际含义 |
|------|----------|----------|
| WER | ASR得分 | 标准化后单词级别的 `(S+D+I)/N`。 |
| CER | 字符WER | 用于声调语言或字符级系统。 |
| MOS | 人工意见 | 1-5分；20+听者 × 100样本。 |
| UTMOS | 机器学习MOS预测器 | 学习模型；与人工MOS相关性约0.9。 |
| SECS | 语音克隆相似度 | 参考与克隆之间的ECAPA余弦。 |
| EER | 说话人验证得分 | FAR等于FRR时的阈值。 |
| DER | 说话人日志化得分 | (FA + Miss + Confusion) / 总量。 |
| FAD | 音乐生成质量 | VGGish嵌入上的弗雷歇距离。 |
| RTFx | 吞吐量 | 每秒墙上时钟处理的音频秒数。 |

## 延伸阅读

- [jiwer](https://github.com/jitsi/jiwer) — 带标准化工具的WER/CER库。
- [UTMOS（Saeki等人，2022）](https://arxiv.org/abs/2204.02152) — 学习型MOS预测器。
- [弗雷歇音频距离（Kilgour等人，2019）](https://arxiv.org/abs/1812.08466) — 音乐生成标准。
- [Open ASR排行榜](https://huggingface.co/spaces/hf-audio/open_asr_leaderboard) — 2026实时排名。
- [TTS Arena](https://huggingface.co/spaces/TTS-AGI/TTS-Arena) — 人工投票TTS排行榜。
- [MMAU-Pro基准](https://mmaubenchmark.github.io/) — 音频语言模型推理排行榜。
- [HEAR基准](https://hearbenchmark.com/) — 音频自监督学习基准。