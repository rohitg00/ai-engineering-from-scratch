# 音频评估——WER、MOS、UTMOS、MMAU、FAD 与开放排行榜

> 无法测量的东西就无法交付。本课列举了 2026 年每项音频任务的指标：ASR（WER、CER、RTFx）、TTS（MOS、UTMOS、SECS、ASR 往返 WER）、音频-语言（MMAU、LongAudioBench）、音乐（FAD、CLAP）和说话人（EER）。以及你可以进行排名的排行榜。

**类型：** 学习
**语言：** Python
**前置知识：** 阶段 6 · 04、06、07、09、10；阶段 2 · 09（模型评估）
**时间：** ~60 分钟

## 问题

每个音频任务都有多个指标，每个指标衡量不同的方面。使用错误的指标，你发布了一个在仪表板上看起来很棒但在生产中表现糟糕的模型。2026 年的规范列表：

| 任务 | 主要指标 | 次要指标 |
|------|---------|-----------|
| ASR | WER | CER · RTFx · 首个 token 延迟 |
| TTS | MOS / UTMOS | SECS · ASR 往返 WER · CER · TTFA |
| 语音克隆 | SECS（ECAPA 余弦） | MOS · CER |
| 说话人验证 | EER | minDCF · 操作点的 FAR / FRR |
| 说话人分离 | DER | JER · 说话人混淆率 |
| 音频分类 | top-1 · mAP | 宏平均 F1 · 每类召回率 |
| 音乐生成 | FAD | CLAP · 听评小组 MOS |
| 音频语言模型 | MMAU-Pro | LongAudioBench · AudioCaps FENSE |
| 流式 S2S | 延迟 P50/P95 | WER · MOS |

## 概念

![音频评估矩阵——指标 vs 任务 vs 2026 年排行榜](../assets/eval-landscape.svg)

### ASR 指标

**WER（词错误率）。** `(S + D + I) / N`。评分前先转小写、去除标点、归一化数字。使用 `jiwer` 或 OpenAI 的 `whisper_normalizer`。< 5% = 朗读语音的人类水平。

**CER（字符错误率）。** 相同公式，字符级别。用于词切分有歧义的声调语言（普通话、粤语）。

**RTFx（逆实时因子）。** 每壁钟秒处理的音频秒数。越高越好。Parakeet-TDT 达到 3380 倍。Whisper-large-v3 约 30 倍。

**首个 token 延迟。** 从音频输入到第一个转录 token 的壁钟时间。对流式处理至关重要。Deepgram Nova-3：约 150 ms。

### TTS 指标

**MOS（平均意见分）。** 1-5 分人类评分。黄金标准但缓慢。每个样本收集 20+ 个听众，每个模型 100+ 个样本。

**UTMOS（2022-2026）。** 学习型 MOS 预测器。在标准基准上与人类 MOS 的相关性约 0.9。F5-TTS：UTMOS 3.95；真实音频：4.08。

**SECS（说话者编码器余弦相似度）。** 用于语音克隆。参考与克隆输出之间的 ECAPA 嵌入余弦。> 0.75 = 可识别的克隆。

**ASR 往返 WER。** 在 TTS 输出上运行 Whisper，计算与输入文本的 WER。捕捉可懂度回归。2026 SOTA：< 2% CER。

**TTFA（首次音频输出时间）。** 壁钟延迟。Kokoro-82M：约 100 ms；F5-TTS：约 1 秒。

### 语音克隆专用指标

**SECS + MOS + CER** 三重指标。SECS 高但 MOS 低的克隆意味着音色正确但不自然；反之意味着自然的语音但错误的说话者。

### 说话人验证

**EER（等错误率）。** 误接受率等于误拒绝率时的阈值。ECAPA 在 VoxCeleb1-O 上：0.87%。

**minDCF（最小检测成本）。** 在选定操作点（通常 FAR=0.01）的加权成本。比 EER 更贴近生产。

### 说话人分离

**DER（说话人分离错误率）。** `(FA + Miss + Confusion) / total_speaker_time`。漏检语音 + 误报语音 + 说话人混淆，各占比例。AMI 会议：DER 约 10-20% 是现实的。pyannote 3.1 + Precision-2 商业版：在良好录制的音频上 DER < 10%。

**JER（Jaccard 错误率）。** DER 的替代方案，对短片段偏差鲁棒。

### 音频分类

多标签：所有类别上的 **mAP（平均精度均值）**。AudioSet：BEATs-iter3 为 0.548 mAP。

多类互斥：**top-1、top-5 准确率**。Speech Commands v2：99.0% top-1（Audio-MAE）。

不平衡：**宏平均 F1** + **每类召回率**。按类别报告——聚合准确率会掩盖哪些类别失败。

### 音乐生成

**FAD（Fréchet Audio Distance）。** 真实与生成音频的 VGGish 嵌入分布之间的距离。MusicGen-small 在 MusicCaps 上：4.5。MusicLM：4.0。越低越好。

**CLAP 分数。** 使用 CLAP 嵌入的文本-音频对齐分数。> 0.3 = 合理对齐。

**听评小组 MOS。** 对于消费级音乐仍然是最终评判标准。Suno v5 在 TTS Arena 上 ELO 1293（来自配对人类偏好）。

### 音频语言基准

**MMAU（大规模多音频理解）。** 10k 个音频问答对。

**MMAU-Pro。** 1800 个难题，四个类别：语音 / 声音 / 音乐 / 多音频。4 选 1 的随机概率为 25%。Gemini 2.5 Pro 总体约 60%；多音频在所有模型上约 22%。

**LongAudioBench。** 数分钟的片段，含语义查询。Audio Flamingo Next 超越 Gemini 2.5 Pro。

**AudioCaps / Clotho。** 字幕基准。SPICE、CIDEr、FENSE 指标。

### 流式语音到语音

**延迟 P50 / P95 / P99。** 从用户说话结束到第一个可听响应的壁钟时间。Moshi：200 ms；GPT-4o Realtime：300 ms。

**输出的 WER / MOS。**

**闯入响应性。** 从用户打断到助手静音的时间。目标 < 150 ms。

### 2026 年排行榜

| 排行榜 | 赛道 | URL |
|------------|--------|-----|
| Open ASR Leaderboard (HF) | 英语 + 多语言 + 长篇 | `huggingface.co/spaces/hf-audio/open_asr_leaderboard` |
| TTS Arena (HF) | 英语 TTS | `huggingface.co/spaces/TTS-AGI/TTS-Arena` |
| Artificial Analysis Speech | TTS + STT，配对投票 ELO | `artificialanalysis.ai/speech` |
| MMAU-Pro | LALM 推理 | `mmaubenchmark.github.io` |
| SpeakerBench / VoxSRC | 说话人识别 | `voxsrc.github.io` |
| MMAU 音乐子集 | 音乐 LALM | （在 MMAU 内） |
| HEAR benchmark | 自监督音频 | `hearbenchmark.com` |

## 动手实现

### 第 1 步：带归一化的 WER

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

### 第 2 步：TTS 往返 WER

```python
def ttr_wer(tts_model, asr_model, texts):
    errors = []
    for txt in texts:
        audio = tts_model.synthesize(txt)
        recog = asr_model.transcribe(audio)
        errors.append(wer(truth=txt, hypothesis=recog))
    return sum(errors) / len(errors)
```

### 第 3 步：语音克隆的 SECS

```python
from speechbrain.inference.speaker import EncoderClassifier
sv = EncoderClassifier.from_hparams("speechbrain/spkrec-ecapa-voxceleb")

emb_ref = sv.encode_batch(load_wav("reference.wav"))
emb_clone = sv.encode_batch(load_wav("cloned.wav"))
secs = torch.nn.functional.cosine_similarity(emb_ref, emb_clone, dim=-1).item()
```

### 第 4 步：音乐生成的 FAD

```python
from frechet_audio_distance import FrechetAudioDistance
fad = FrechetAudioDistance()
score = fad.get_fad_score("generated_folder/", "reference_folder/")
```

### 第 5 步：说话人验证的 EER（与第 6 课代码相同）

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

## 使用建议

将每次部署与一个固定的评估框架配对，每次模型更新都运行它。三条基本原则：

1. **评分前先归一化。** 小写、去除标点、展开数字。报告归一化规则。
2. **报告分布而非平均值。** 延迟的 P50/P95/P99。分类的每类召回率。MMAU 的每个类别。
3. **运行一个规范的公开基准。** 即使你的生产数据不同，在 Open ASR / TTS Arena / MMAU 上报告也让评审者能进行同类比较。

## 常见陷阱

- **UTMOS 外推。** 在 VCTK 风格的清洁语音上训练；对嘈杂/克隆/情绪化音频评分不佳。
- **MOS 小组偏差。** 20 名 Amazon Mechanical Turk 工作者 ≠ 20 名目标用户。如果风险很高，请支付领域专家小组费用。
- **FAD 依赖于参考集。** 跨模型比较时要针对相同的参考分布。
- **聚合 WER。** 总体 5% 的 WER 可能掩盖带口音语音上 30% 的 WER。按人口统计分组报告。
- **公共基准饱和。** 大多数前沿模型在标准基准上已接近天花板。构建反映你流量的内部留出集。

## 交付物

保存为 `outputs/skill-audio-evaluator.md`。为任何音频模型发布选择指标、基准和报告格式。

## 练习

1. **简单。** 运行 `code/main.py`。在玩具输入上计算 WER / CER / EER / SECS / FAD 类 / MMAU 类指标。
2. **中等。** 构建一个 TTS 往返 WER 框架。将你的 Kokoro 或 F5-TTS 输出通过 Whisper 运行。在 50 个提示上计算 WER。标记 WER > 10% 的提示。
3. **困难。** 在第 10 课选择的 LALM 上，在 MMAU-Pro 语音 + 多音频子集（各 50 项）上评分。报告每类准确率并与已发布数字比较。

## 关键词汇

| 术语 | 通常说法 | 实际含义 |
|------|-----------------|-----------------------|
| WER | ASR 分数 | 归一化后的词级 `(S+D+I)/N`。 |
| CER | 字符级 WER | 用于声调语言或字符级系统。 |
| MOS | 人类意见 | 1-5 评分；20+ 听众 × 100 样本。 |
| UTMOS | ML MOS 预测器 | 学习型模型；与人类 MOS 相关性约 0.9。 |
| SECS | 语音克隆相似度 | 参考与克隆之间的 ECAPA 余弦。 |
| EER | 说话人验证分数 | FAR = FRR 时的阈值。 |
| DER | 说话人分离分数 | (FA + Miss + Confusion) / total。 |
| FAD | 音乐生成质量 | VGGish 嵌入上的 Fréchet 距离。 |
| RTFx | 吞吐量 | 每壁钟秒的音频秒数。 |

## 延伸阅读

- [jiwer](https://github.com/jitsi/jiwer)——带归一化工具的 WER/CER 库。
- [UTMOS (Saeki et al. 2022)](https://arxiv.org/abs/2204.02152)——学习型 MOS 预测器。
- [Fréchet Audio Distance (Kilgour et al. 2019)](https://arxiv.org/abs/1812.08466)——音乐生成标准。
- [Open ASR Leaderboard](https://huggingface.co/spaces/hf-audio/open_asr_leaderboard)——2026 年实时排名。
- [TTS Arena](https://huggingface.co/spaces/TTS-AGI/TTS-Arena)——人类投票 TTS 排行榜。
- [MMAU-Pro benchmark](https://mmaubenchmark.github.io/)——LALM 推理排行榜。
- [HEAR benchmark](https://hearbenchmark.com/)——音频 SSL 基准。
