# 音频评估 — WER、MOS、UTMOS、MMAU、FAD 与公开排行榜

> 你无法交付你无法衡量的东西。本课列出 2026 年每种音频任务的标准指标：ASR（WER、CER、RTFx）、TTS（MOS、UTMOS、SECS、WER-on-ASR-round-trip）、音频语言（MMAU、LongAudioBench）、音乐（FAD、CLAP）和说话人（EER）。外加用于对比的排行榜。

**Type:** Learn
**Languages:** Python
**Prerequisites:** Phase 6 · 04, 06, 07, 09, 10；Phase 2 · 09（Model Evaluation）
**Time:** 约 60 分钟

## 问题

每种音频任务都有多个指标，每个衡量不同的维度。用错指标的后果是：模型在你的仪表板上看起来很棒，在生产环境中却表现糟糕。2026 年的标准清单：

| 任务 | 主要指标 | 次要指标 |
|------|---------|-----------|
| ASR | WER | CER · RTFx · 首 token 延迟 |
| TTS | MOS / UTMOS | SECS · WER-on-ASR-round-trip · CER · TTFA |
| 语音克隆 | SECS（ECAPA 余弦） | MOS · CER |
| 说话人验证 | EER | minDCF · 工作点处的 FAR / FRR |
| 说话人分离 | DER | JER · 说话人混淆 |
| 音频分类 | top-1 · mAP | macro F1 · 每类召回率 |
| 音乐生成 | FAD | CLAP · 听测小组 MOS |
| 音频语言模型 | MMAU-Pro | LongAudioBench · AudioCaps FENSE |
| 流式 S2S | 延迟 P50/P95 | WER · MOS |

## 概念

![Audio evaluation matrix — metrics vs tasks vs 2026 leaderboards](../assets/eval-landscape.svg)

### ASR 指标

**WER（词错误率）。** `(S + D + I) / N`。评分前先小写化、去标点、归一化数字。使用 `jiwer` 或 OpenAI 的 `whisper_normalizer`。&lt; 5% = 达到朗读语音的人类水平。

**CER（字符错误率）。** 同样的公式，字符级别。用于声调语言（普通话、粤语）等词切分有歧义的场景。

**RTFx（逆实时率）。** 每挂钟秒处理的音频秒数。越高越好。Parakeet-TDT 达到 3380×。Whisper-large-v3 约为 30×。

**首 token 延迟。** 从音频输入到第一个转写 token 的挂钟时间。对流式场景至关重要。Deepgram Nova-3：约 150 ms。

### TTS 指标

**MOS（平均意见分）。** 1-5 分的人类评分。黄金标准但很慢。每个样本收集 20+ 名听测者，每个模型 100+ 个样本。

**UTMOS（2022-2026）。** 学习型 MOS 预测器。在标准基准上与人类 MOS 的相关性约 0.9。F5-TTS：UTMOS 3.95；真实值：4.08。

**SECS（说话人编码器余弦相似度）。** 用于语音克隆。参考音频与克隆输出之间 ECAPA 嵌入的余弦值。&gt; 0.75 = 可辨认的克隆。

**WER-on-ASR-round-trip。** 用 Whisper 处理 TTS 输出，对照输入文本计算 WER。可发现可懂度回退。2026 SOTA：&lt; 2% CER。

**TTFA（time-to-first-audio，首音频时间）。** 挂钟延迟。Kokoro-82M：约 100 ms；F5-TTS：约 1 s。

### 语音克隆专项

**SECS + MOS + CER** 作为三元组。克隆模型 SECS 高但 MOS 低意味着音色对但不自然；反之则意味着声音自然但说话人不对。

### 说话人验证

**EER（等错误率）。** 错误接受率等于错误拒绝率时的阈值。ECAPA 在 VoxCeleb1-O 上：0.87%。

**minDCF（最小检测代价）。** 在选定工作点（通常 FAR=0.01）的加权代价。比 EER 更贴近生产实际。

### 说话人分离

**DER（分离错误率）。** `(FA + Miss + Confusion) / total_speaker_time`。漏检语音 + 虚警语音 + 说话人混淆，各按比例计算。AMI 会议：DER 约 10-20% 是现实的。pyannote 3.1 + Precision-2 商用：在录制良好的音频上 &lt;10% DER。

**JER（Jaccard 错误率）。** DER 的替代方案，对短片段偏差更稳健。

### 音频分类

多标签：所有类别上的 **mAP（平均精度均值）**。AudioSet：BEATs-iter3 为 0.548 mAP。

多类别互斥：**top-1、top-5 准确率**。Speech Commands v2：99.0% top-1（Audio-MAE）。

不平衡数据：**macro F1** + **每类召回率**。报告每类数据——聚合准确率会掩盖哪些类别失败。

### 音乐生成

**FAD（Fréchet Audio Distance）。** 真实音频与生成音频的 VGGish 嵌入分布之间的距离。MusicGen-small 在 MusicCaps 上：4.5。MusicLM：4.0。越低越好。

**CLAP 分数。** 使用 CLAP 嵌入的文本-音频对齐分数。&gt; 0.3 = 对齐合理。

**听测小组 MOS。** 对消费级音乐而言仍是最终标准。Suno v5 在 TTS Arena 上 ELO 1293（基于成对人类偏好）。

### 音频语言基准

**MMAU（Massive Multi-Audio Understanding）。** 1 万个音频-问答对。

**MMAU-Pro。** 1800 个困难条目，四个类别：语音 / 声音 / 音乐 / 多音频。四选一随机猜测 25%。Gemini 2.5 Pro 总体约 60%；多音频在所有模型上约 22%。

**LongAudioBench。** 带语义查询的数分钟长片段。Audio Flamingo Next 胜过 Gemini 2.5 Pro。

**AudioCaps / Clotho。** 字幕生成基准。SPICE、CIDEr、FENSE 指标。

### 流式语音到语音

**延迟 P50 / P95 / P99。** 从用户语音结束到第一个可听响应的挂钟时间。Moshi：200 ms；GPT-4o Realtime：300 ms。

对输出计算 **WER / MOS**。

**插话响应性。** 从用户打断到助手静音的时间。目标 &lt; 150 ms。

### 2026 年排行榜

| 排行榜 | 赛道 | URL |
|------------|--------|-----|
| Open ASR Leaderboard (HF) | 英语 + 多语言 + 长音频 | `huggingface.co/spaces/hf-audio/open_asr_leaderboard` |
| TTS Arena (HF) | 英语 TTS | `huggingface.co/spaces/TTS-AGI/TTS-Arena` |
| Artificial Analysis Speech | TTS + STT，基于成对投票的 ELO | `artificialanalysis.ai/speech` |
| MMAU-Pro | LALM 推理 | `mmaubenchmark.github.io` |
| SpeakerBench / VoxSRC | 说话人识别 | `voxsrc.github.io` |
| MMAU 音乐子集 | 音乐 LALM | （在 MMAU 内） |
| HEAR benchmark | 自监督音频 | `hearbenchmark.com` |

```figure
sp-wer-align
```

## 动手实现

### 步骤 1：带归一化的 WER

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

### 步骤 2：TTS 往返 WER

```python
def ttr_wer(tts_model, asr_model, texts):
    errors = []
    for txt in texts:
        audio = tts_model.synthesize(txt)
        recog = asr_model.transcribe(audio)
        errors.append(wer(truth=txt, hypothesis=recog))
    return sum(errors) / len(errors)
```

### 步骤 3：语音克隆的 SECS

```python
from speechbrain.inference.speaker import EncoderClassifier
sv = EncoderClassifier.from_hparams("speechbrain/spkrec-ecapa-voxceleb")

emb_ref = sv.encode_batch(load_wav("reference.wav"))
emb_clone = sv.encode_batch(load_wav("cloned.wav"))
secs = torch.nn.functional.cosine_similarity(emb_ref, emb_clone, dim=-1).item()
```

### 步骤 4：音乐生成的 FAD

```python
from frechet_audio_distance import FrechetAudioDistance
fad = FrechetAudioDistance()
score = fad.get_fad_score("generated_folder/", "reference_folder/")
```

### 步骤 5：说话人验证的 EER（与第 6 课相同代码）

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

为每次部署配备一个固定评估套件，在每次模型更新时运行。三条铁律：

1. **评分前先归一化。** 小写化、去标点、数字展开。报告所用的归一化规则。
2. **报告分布，而非平均值。** 延迟用 P50/P95/P99。分类用每类召回率。MMAU 用每类别分数。
3. **至少运行一个标准公开基准。** 即使你的生产数据不同，在 Open ASR / TTS Arena / MMAU 上报告能让评审者公平对比。

## 常见陷阱

- **UTMOS 外推。** 在 VCTK 风格的干净语音上训练；对嘈杂 / 克隆 / 情感化音频评分不佳。
- **MOS 小组偏差。** 20 名 Amazon Mechanical Turk 工人 ≠ 20 名目标用户。利害大时应付费聘请领域听测小组。
- **FAD 依赖参考集。** 跨模型比较时须使用相同的参考分布。
- **聚合 WER。** 总体 5% 的 WER 可能掩盖带口音语音上 30% 的 WER。按人群切片报告。
- **公开基准饱和。** 大多数前沿模型在标准基准上已接近天花板。构建一个反映你实际流量的内部留出集。

## 上线

保存为 `outputs/skill-audio-evaluator.md`。为任何音频模型发布选定指标、基准和报告格式。

## 练习

1. **简单。** 运行 `code/main.py`。在玩具输入上计算 WER / CER / EER / SECS / 类 FAD / 类 MMAU。
2. **中等。** 构建一个 TTS 往返 WER 套件。将你的 Kokoro 或 F5-TTS 输出通过 Whisper 处理。对 50 个提示计算 WER。标记 WER &gt; 10% 的提示。
3. **困难。** 在 MMAU-Pro 语音 + 多音频子集（各 50 个条目）上给你的第 10 课 LALM 选择评分。报告每类别准确率并与已发表数字比较。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------------|-----------------------|
| WER | ASR 分数 | 归一化后词级别的 `(S+D+I)/N`。 |
| CER | 字符 WER | 用于声调语言或字符级系统。 |
| MOS | 人类意见 | 1-5 评分；20+ 听测者 × 100 样本。 |
| UTMOS | ML MOS 预测器 | 学习型模型；与人类 MOS 相关性约 0.9。 |
| SECS | 语音克隆相似度 | 参考与克隆之间 ECAPA 余弦。 |
| EER | 说话人验证分数 | FAR = FRR 时的阈值。 |
| DER | 说话人分离分数 | (FA + Miss + Confusion) / 总量。 |
| FAD | 音乐生成质量 | VGGish 嵌入上的 Fréchet 距离。 |
| RTFx | 吞吐量 | 每挂钟秒处理的音频秒数。 |

## 延伸阅读

- [jiwer](https://github.com/jitsi/jiwer) — 带归一化工具的 WER/CER 库。
- [UTMOS (Saeki et al. 2022)](https://arxiv.org/abs/2204.02152) — 学习型 MOS 预测器。
- [Fréchet Audio Distance (Kilgour et al. 2019)](https://arxiv.org/abs/1812.08466) — 音乐生成标准。
- [Open ASR Leaderboard](https://huggingface.co/spaces/hf-audio/open_asr_leaderboard) — 2026 实时排名。
- [TTS Arena](https://huggingface.co/spaces/TTS-AGI/TTS-Arena) — 人类投票 TTS 排行榜。
- [MMAU-Pro benchmark](https://mmaubenchmark.github.io/) — LALM 推理排行榜。
- [HEAR benchmark](https://hearbenchmark.com/) — 音频 SSL 基准。