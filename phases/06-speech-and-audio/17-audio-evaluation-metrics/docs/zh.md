# 音频评估 —— WER、MOS、UTMOS、MMAU、FAD 与各大公开榜单

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 没法度量的东西就没法上线。本课为 2026 年每一类音频任务点名所用指标：ASR（WER、CER、RTFx）、TTS（MOS、UTMOS、SECS、ASR 回环 WER）、audio-language（MMAU、LongAudioBench）、音乐（FAD、CLAP）和说话人识别（EER）。再加上你横向比拼的那些榜单。

**Type:** Learn
**Languages:** Python
**Prerequisites:** Phase 6 · 04, 06, 07, 09, 10；Phase 2 · 09（Model Evaluation）
**Time:** ~60 minutes

## 问题（The Problem）

每个音频任务都有多个指标，各自衡量不同的维度。用错指标，就会让你做出一个仪表盘上漂亮、生产环境却惨不忍睹的模型。2026 年的标准清单：

| 任务 | 主指标 | 副指标 |
|------|---------|-----------|
| ASR | WER | CER · RTFx · 首 token 延迟 |
| TTS | MOS / UTMOS | SECS · ASR 回环 WER · CER · TTFA |
| 声音克隆 | SECS（ECAPA 余弦） | MOS · CER |
| 说话人验证 | EER | minDCF · 工作点处的 FAR / FRR |
| 说话人分离（Diarization） | DER | JER · 说话人混淆 |
| 音频分类 | top-1 · mAP | macro F1 · 各类别召回 |
| 音乐生成 | FAD | CLAP · 听感评测组 MOS |
| 音频语言模型 | MMAU-Pro | LongAudioBench · AudioCaps FENSE |
| 流式 S2S | 延迟 P50/P95 | WER · MOS |

## 概念（The Concept）

![音频评估矩阵 —— 指标 vs 任务 vs 2026 榜单](../assets/eval-landscape.svg)

### ASR 指标（ASR metrics）

**WER（Word Error Rate，词错率）。** `(S + D + I) / N`。打分前要做小写化、去标点、数字归一化。用 `jiwer` 或 OpenAI 的 `whisper_normalizer`。&lt; 5% = 朗读语音达到人类水平。

**CER（Character Error Rate，字错率）。** 同样的公式，按字符算。用于声调语言（普通话、粤语），因为这类语言的分词本身就有歧义。

**RTFx（实时率倒数，inverse real-time factor）。** 每秒钟实际时间能处理多少秒音频。越高越好。Parakeet-TDT 能跑到 3380×。Whisper-large-v3 大约 30×。

**首 token 延迟（First-token latency）。** 从音频输入到首个转写 token 输出的实际时间。流式场景的命脉。Deepgram Nova-3：约 150 ms。

### TTS 指标（TTS metrics）

**MOS（Mean Opinion Score，平均意见分）。** 1-5 分人工打分。黄金标准但慢。每个样本至少 20 位听众，每个模型至少 100 个样本。

**UTMOS（2022-2026）。** 学得的 MOS 预测器。在标准 benchmark 上与人工 MOS 的相关性约 0.9。F5-TTS：UTMOS 3.95；ground truth：4.08。

**SECS（Speaker Encoder Cosine Similarity，说话人编码器余弦相似度）。** 用于声音克隆。参考音和克隆输出之间的 ECAPA embedding（嵌入）余弦。&gt; 0.75 = 可辨识的克隆。

**ASR 回环 WER（WER-on-ASR-round-trip）。** 把 TTS 的输出喂给 Whisper 转写，再与输入文本算 WER。专门抓可懂度退化。2026 SOTA：CER &lt; 2%。

**TTFA（time-to-first-audio，首音延迟）。** 实际等待时间。Kokoro-82M：约 100 ms；F5-TTS：约 1 s。

### 声音克隆专属指标

**SECS + MOS + CER** 三件套。SECS 高但 MOS 低，意味着音色对了但不自然；反过来则是声音自然但说话人错了。

### 说话人验证

**EER（Equal Error Rate，等错误率）。** 误接受率（FAR）等于误拒绝率（FRR）时的阈值。ECAPA 在 VoxCeleb1-O 上：0.87%。

**minDCF（min Detection Cost，最小检测代价）。** 在选定工作点（通常 FAR=0.01）下的加权代价。比 EER 更贴近生产环境。

### 说话人分离（Diarization）

**DER（Diarization Error Rate）。** `(FA + Miss + Confusion) / total_speaker_time`。漏检语音 + 虚警语音 + 说话人混淆，各自占比。AMI 会议：DER 10-20% 比较现实。pyannote 3.1 + Precision-2 商用版：录音良好时 DER &lt;10%。

**JER（Jaccard Error Rate）。** DER 的替代指标，对短片段偏置更鲁棒。

### 音频分类

多标签：所有类别上的 **mAP（mean Average Precision，平均精度均值）**。AudioSet：BEATs-iter3 取得 0.548 mAP。

多类互斥：**top-1、top-5 准确率**。Speech Commands v2：99.0% top-1（Audio-MAE）。

类别不平衡：**macro F1** + **各类别召回率**。一定要按类别报告 —— 总准确率会掩盖哪些类别在翻车。

### 音乐生成

**FAD（Fréchet Audio Distance）。** 真实音频与生成音频在 VGGish embedding 分布上的距离。MusicGen-small 在 MusicCaps 上：4.5。MusicLM：4.0。越低越好。

**CLAP Score。** 用 CLAP embedding 计算的文本-音频对齐分。&gt; 0.3 = 对齐还算合理。

**听感评测组 MOS（Listening panel MOS）。** 面向消费级音乐时，依然是最终判官。Suno v5 在 TTS Arena 上 ELO 1293（来自配对人类偏好）。

### audio-language 基准

**MMAU（Massive Multi-Audio Understanding）。** 1 万条音频-QA 对。

**MMAU-Pro。** 1800 道难题，分四类：speech / sound / music / multi-audio。四选一随机基线 25%。Gemini 2.5 Pro 总体约 60%；所有模型在 multi-audio 上都只有 ~22%。

**LongAudioBench。** 多分钟时长片段配语义查询。Audio Flamingo Next 在此项上击败 Gemini 2.5 Pro。

**AudioCaps / Clotho。** caption 基准。指标用 SPICE、CIDEr、FENSE。

### 流式语音对语音（streaming speech-to-speech）

**延迟 P50 / P95 / P99。** 从用户讲完到助手发出第一声响的实际时间。Moshi：200 ms；GPT-4o Realtime：300 ms。

**输出端的 WER / MOS。**

**抢话响应（Barge-in responsiveness）。** 从用户打断到助手静音的时间。目标 &lt; 150 ms。

### 2026 年的榜单

| 榜单 | 赛道 | URL |
|------------|--------|-----|
| Open ASR Leaderboard（HF） | 英文 + 多语 + 长音频 | `huggingface.co/spaces/hf-audio/open_asr_leaderboard` |
| TTS Arena（HF） | 英文 TTS | `huggingface.co/spaces/TTS-AGI/TTS-Arena` |
| Artificial Analysis Speech | TTS + STT，配对投票 ELO | `artificialanalysis.ai/speech` |
| MMAU-Pro | LALM 推理 | `mmaubenchmark.github.io` |
| SpeakerBench / VoxSRC | 说话人识别 | `voxsrc.github.io` |
| MMAU 音乐子集 | 音乐 LALM | （在 MMAU 内） |
| HEAR benchmark | 自监督音频 | `hearbenchmark.com` |

## 动手实现（Build It）

### Step 1：带归一化的 WER

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

### Step 2：TTS 回环 WER

```python
def ttr_wer(tts_model, asr_model, texts):
    errors = []
    for txt in texts:
        audio = tts_model.synthesize(txt)
        recog = asr_model.transcribe(audio)
        errors.append(wer(truth=txt, hypothesis=recog))
    return sum(errors) / len(errors)
```

### Step 3：声音克隆的 SECS

```python
from speechbrain.inference.speaker import EncoderClassifier
sv = EncoderClassifier.from_hparams("speechbrain/spkrec-ecapa-voxceleb")

emb_ref = sv.encode_batch(load_wav("reference.wav"))
emb_clone = sv.encode_batch(load_wav("cloned.wav"))
secs = torch.nn.functional.cosine_similarity(emb_ref, emb_clone, dim=-1).item()
```

### Step 4：音乐生成的 FAD

```python
from frechet_audio_distance import FrechetAudioDistance
fad = FrechetAudioDistance()
score = fad.get_fad_score("generated_folder/", "reference_folder/")
```

### Step 5：说话人验证的 EER（与 Lesson 6 同款代码）

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

## 用起来（Use It）

每次部署都要配一套固定的评估管道（pipeline），每次模型更新都跑一遍。三条铁律：

1. **打分前先归一化。** 小写、去标点、数字展开。把归一化规则写进报告。
2. **报告分布，而非平均值。** 延迟看 P50/P95/P99；分类看每类召回；MMAU 看每个子类别。
3. **必跑一个公开标杆。** 哪怕你的生产数据完全不同，在 Open ASR / TTS Arena / MMAU 上报告一份，能让评审者做苹果对苹果的横向比较。

## 坑（Pitfalls）

- **UTMOS 外推失真。** 训练数据是 VCTK 风格的干净语音；遇到噪声 / 克隆 / 情绪化音频会打偏。
- **MOS 评测组偏置。** 20 位 Amazon Mechanical Turk 工人 ≠ 20 位目标用户。利害大时请掏钱请专业评测组。
- **FAD 依赖参考集。** 跨模型比较时务必用同一份参考分布。
- **总体 WER 会骗人。** 整体 5% 的 WER 可能掩盖了带口音语音的 30% WER。要按人群切片报告。
- **公开 benchmark 已经饱和。** 大多数前沿模型在标准 benchmark 上都接近天花板。要自建一份反映你流量分布的内部 held-out 集。

## 上线部署（Ship It）

存为 `outputs/skill-audio-evaluator.md`。任何音频模型发版时，从中挑指标、挑 benchmark、挑报告格式。

## 练习（Exercises）

1. **入门。** 跑 `code/main.py`。在玩具输入上算 WER / CER / EER / SECS / 类 FAD / 类 MMAU。
2. **进阶。** 搭一个 TTS 回环 WER 流水线。把你的 Kokoro 或 F5-TTS 输出过一遍 Whisper。在 50 条 prompt 上算 WER。把 WER &gt; 10% 的 prompt 标出来。
3. **挑战。** 把你在 Lesson 10 选的 LALM 拿去跑 MMAU-Pro 的 speech + multi-audio 子集（各 50 题）。报告每类准确率，并与官方公布的数字比对。

## 关键术语（Key Terms）

| 术语 | 大家嘴上说的 | 它实际是什么 |
|------|-----------------|-----------------------|
| WER | ASR 分数 | 归一化后词级 `(S+D+I)/N`。 |
| CER | 字符版 WER | 用于声调语言或字符级系统。 |
| MOS | 人工评分 | 1-5 分；20+ 听众 × 100 样本。 |
| UTMOS | ML 版 MOS 预测器 | 学得的模型；与人工 MOS 相关性约 0.9。 |
| SECS | 声音克隆相似度 | 参考与克隆之间的 ECAPA 余弦。 |
| EER | 说话人验证分数 | FAR = FRR 时的阈值。 |
| DER | 说话人分离分数 | (FA + Miss + Confusion) / total。 |
| FAD | 音乐生成质量 | VGGish embedding 上的 Fréchet 距离。 |
| RTFx | 吞吐 | 每秒实际时间处理多少秒音频。 |

## 延伸阅读（Further Reading）

- [jiwer](https://github.com/jitsi/jiwer) —— 带归一化工具的 WER/CER 库。
- [UTMOS (Saeki et al. 2022)](https://arxiv.org/abs/2204.02152) —— 学得的 MOS 预测器。
- [Fréchet Audio Distance (Kilgour et al. 2019)](https://arxiv.org/abs/1812.08466) —— 音乐生成的标准指标。
- [Open ASR Leaderboard](https://huggingface.co/spaces/hf-audio/open_asr_leaderboard) —— 2026 年实时排名。
- [TTS Arena](https://huggingface.co/spaces/TTS-AGI/TTS-Arena) —— 人工投票 TTS 榜单。
- [MMAU-Pro benchmark](https://mmaubenchmark.github.io/) —— LALM 推理榜单。
- [HEAR benchmark](https://hearbenchmark.com/) —— 音频 SSL benchmark。
