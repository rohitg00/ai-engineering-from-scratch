# 17 · 音频评测——WER、MOS、UTMOS、MMAU、FAD 与公开排行榜

> 无法度量的东西就无法交付。本课为每一类音频任务列出 2026 年的关键指标：自动语音识别 ASR（WER、CER、RTFx）、语音合成 TTS（MOS、UTMOS、SECS、ASR 往返回测的 WER）、音频-语言（MMAU、LongAudioBench）、音乐（FAD、CLAP）以及说话人（EER）。此外还有供你横向对比的各类排行榜。

**类型：** 学习
**语言：** Python
**前置：** 第 6 阶段 · 04、06、07、09、10；第 2 阶段 · 09（模型评测）
**时长：** 约 60 分钟

## 问题所在

每一类音频任务都有多个指标，各自度量一个不同的维度。用错指标，就会交付出一个在仪表盘上光鲜亮丽、在生产环境却惨不忍睹的模型。2026 年的权威指标清单如下：

| 任务 | 主指标 | 次指标 |
|------|---------|-----------|
| ASR | WER | CER · RTFx · 首 token 延迟 |
| TTS | MOS / UTMOS | SECS · ASR 往返回测 WER · CER · TTFA |
| 声音克隆 | SECS（ECAPA 余弦相似度） | MOS · CER |
| 说话人验证 | EER | minDCF · 工作点处的 FAR / FRR |
| 说话人分离 | DER | JER · 说话人混淆 |
| 音频分类 | top-1 · mAP | 宏 F1 · 各类别召回率 |
| 音乐生成 | FAD | CLAP · 听感评审 MOS |
| 音频语言模型 | MMAU-Pro | LongAudioBench · AudioCaps FENSE |
| 流式 S2S | 延迟 P50/P95 | WER · MOS |

## 核心概念

〔图：音频评测矩阵——指标、任务与 2026 年排行榜对照〕

### ASR 指标

**WER（词错误率，Word Error Rate）。** `(S + D + I) / N`。打分前需转小写、去标点、归一化数字。可用 `jiwer` 或 OpenAI 的 `whisper_normalizer`。< 5% 即达到朗读语音的人类水平。

**CER（字符错误率，Character Error Rate）。** 公式相同，但在字符层面计算。用于词切分本就模糊的声调语言（普通话、粤语）。

**RTFx（实时因子的倒数，inverse real-time factor）。** 每一秒墙钟时间处理的音频秒数，越高越好。Parakeet-TDT 可达 3380×，Whisper-large-v3 约为 30×。

**首 token 延迟（First-token latency）。** 从音频输入到第一个转写 token 之间的墙钟时间，对流式场景至关重要。Deepgram Nova-3：约 150 ms。

### TTS 指标

**MOS（平均意见得分，Mean Opinion Score）。** 1-5 分的人工评分。是黄金标准，但速度慢。每个样本需收集 20 名以上听众评分，每个模型需 100 个以上样本。

**UTMOS（2022-2026）。** 学习得到的 MOS 预测器。在标准基准上与人工 MOS 的相关性约为 0.9。F5-TTS：UTMOS 3.95；真值：4.08。

**SECS（说话人编码器余弦相似度，Speaker Encoder Cosine Similarity）。** 用于声音克隆。计算参考音频与克隆输出之间 ECAPA 嵌入的余弦相似度。> 0.75 即为可辨识的克隆。

**ASR 往返回测的 WER（WER-on-ASR-round-trip）。** 用 Whisper 转写 TTS 输出，再与输入文本计算 WER。可捕捉可懂度的回退。2026 年 SOTA：< 2% CER。

**TTFA（首段音频时延，time-to-first-audio）。** 墙钟延迟。Kokoro-82M：约 100 ms；F5-TTS：约 1 s。

### 声音克隆专用指标

**SECS + MOS + CER** 三项组合。克隆若 SECS 高而 MOS 低，说明音色对了但不自然；反之则是声音自然但说话人不对。

### 说话人验证

**EER（等错误率，Equal Error Rate）。** 误受率（FAR）等于误拒率（FRR）时的阈值。ECAPA 在 VoxCeleb1-O 上：0.87%。

**minDCF（最小检测代价，min Detection Cost）。** 在选定工作点（通常 FAR=0.01）处的加权代价。比 EER 更贴近生产场景。

### 说话人分离

**DER（分离错误率，Diarization Error Rate）。** `(FA + Miss + Confusion) / total_speaker_time`。漏检语音 + 误报语音 + 说话人混淆，各自以占比表示。AMI 会议数据：DER 约 10-20% 是合理水平。pyannote 3.1 + Precision-2 商用方案：在录音质量良好的音频上 DER < 10%。

**JER（杰卡德错误率，Jaccard Error Rate）。** DER 的替代指标，对短片段偏差更稳健。

### 音频分类

多标签：在所有类别上计算 **mAP（平均精度均值，mean Average Precision）**。AudioSet：BEATs-iter3 为 0.548 mAP。

多类别互斥：**top-1、top-5 准确率**。Speech Commands v2：top-1 准确率 99.0%（Audio-MAE）。

类别不平衡：**宏 F1** + **各类别召回率**。要分类别报告——总体准确率会掩盖哪些类别失败了。

### 音乐生成

**FAD（Fréchet 音频距离，Fréchet Audio Distance）。** 真实音频与生成音频在 VGGish 嵌入分布之间的距离。MusicGen-small 在 MusicCaps 上：4.5。MusicLM：4.0。越低越好。

**CLAP 得分（CLAP Score）。** 用 CLAP 嵌入计算的文本-音频对齐分。> 0.3 即为合理对齐。

**听感评审 MOS（Listening panel MOS）。** 对消费级音乐而言仍是最终裁定。Suno v5 在 TTS Arena 上 ELO 1293（来自成对人工偏好）。

### 音频-语言基准

**MMAU（大规模多音频理解，Massive Multi-Audio Understanding）。** 1 万条音频问答对。

**MMAU-Pro。** 1800 道难题，分四类：语音 / 声音 / 音乐 / 多音频。四选一的随机猜测准确率为 25%。Gemini 2.5 Pro 总体约 60%；多音频项在所有模型上均约 22%。

**LongAudioBench。** 数分钟长的片段配以语义查询。Audio Flamingo Next 超越 Gemini 2.5 Pro。

**AudioCaps / Clotho。** 字幕生成基准。采用 SPICE、CIDEr、FENSE 指标。

### 流式语音到语音

**延迟 P50 / P95 / P99。** 从用户说话结束到第一声可听响应之间的墙钟时间。Moshi：200 ms；GPT-4o Realtime：300 ms。

输出上的 **WER / MOS**。

**插话响应性（Barge-in responsiveness）。** 从用户打断到助手静音之间的时间。目标 < 150 ms。

### 2026 年排行榜

| 排行榜 | 赛道 | 网址 |
|------------|--------|-----|
| Open ASR Leaderboard（HF） | 英语 + 多语言 + 长音频 | `huggingface.co/spaces/hf-audio/open_asr_leaderboard` |
| TTS Arena（HF） | 英语 TTS | `huggingface.co/spaces/TTS-AGI/TTS-Arena` |
| Artificial Analysis Speech | TTS + STT，基于成对投票的 ELO | `artificialanalysis.ai/speech` |
| MMAU-Pro | LALM 推理 | `mmaubenchmark.github.io` |
| SpeakerBench / VoxSRC | 说话人识别 | `voxsrc.github.io` |
| MMAU 音乐子集 | 音乐 LALM | （MMAU 内部） |
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

### 第 2 步：TTS 往返回测 WER

```python
def ttr_wer(tts_model, asr_model, texts):
    errors = []
    for txt in texts:
        audio = tts_model.synthesize(txt)
        recog = asr_model.transcribe(audio)
        errors.append(wer(truth=txt, hypothesis=recog))
    return sum(errors) / len(errors)
```

### 第 3 步：用于声音克隆的 SECS

```python
from speechbrain.inference.speaker import EncoderClassifier
sv = EncoderClassifier.from_hparams("speechbrain/spkrec-ecapa-voxceleb")

emb_ref = sv.encode_batch(load_wav("reference.wav"))
emb_clone = sv.encode_batch(load_wav("cloned.wav"))
secs = torch.nn.functional.cosine_similarity(emb_ref, emb_clone, dim=-1).item()
```

### 第 4 步：用于音乐生成的 FAD

```python
from frechet_audio_distance import FrechetAudioDistance
fad = FrechetAudioDistance()
score = fad.get_fad_score("generated_folder/", "reference_folder/")
```

### 第 5 步：用于说话人验证的 EER（与第 6 课代码相同）

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

## 实战运用

为每一次部署配一套固定的评测框架，在每次模型更新时都运行一遍。三条铁律：

1. **打分前先归一化。** 转小写、去标点、展开数字。并报告所用的归一化规则。
2. **报告分布，而非平均值。** 延迟用 P50/P95/P99；分类用各类别召回率；MMAU 用各类别得分。
3. **跑一个权威公开基准。** 即便你的生产数据有所不同，在 Open ASR / TTS Arena / MMAU 上报告结果，能让评审者做到同口径对比。

## 常见陷阱

- **UTMOS 外推。** 它在 VCTK 风格的干净语音上训练，对带噪声 / 克隆 / 带情感的音频打分很差。
- **MOS 评审偏差。** 20 名 Amazon Mechanical Turk 众包工人 ≠ 20 名目标用户。如果事关重大，请付费组建领域评审团。
- **FAD 依赖参考集。** 跨模型对比时务必使用同一参考分布。
- **总体 WER。** 总体 5% 的 WER 可能掩盖了口音语音上 30% 的 WER。请按人群切片分别报告。
- **公开基准饱和。** 大多数前沿模型在标准基准上已逼近天花板。请构建一套贴合你自身流量的内部留出集。

## 交付物

保存为 `outputs/skill-audio-evaluator.md`。为任意一次音频模型发布选定指标、基准与报告格式。

## 练习

1. **简单。** 运行 `code/main.py`。在玩具输入上计算 WER / CER / EER / SECS / 近似 FAD / 近似 MMAU。
2. **中等。** 搭建一套 TTS 往返回测 WER 框架。把你的 Kokoro 或 F5-TTS 输出送入 Whisper，在 50 条提示上计算 WER，并标记出 WER > 10% 的提示。
3. **困难。** 在 MMAU-Pro 的语音 + 多音频子集（各 50 项）上为你在第 10 课选定的 LALM 打分。报告各类别准确率，并与已公布数字对比。

## 关键术语

| 术语 | 人们口中的说法 | 它实际的含义 |
|------|-----------------|-----------------------|
| WER | ASR 得分 | 归一化后词级别的 `(S+D+I)/N`。 |
| CER | 字符级 WER | 用于声调语言或字符级系统。 |
| MOS | 人工意见 | 1-5 评分；20 名以上听众 × 100 个样本。 |
| UTMOS | 机器学习 MOS 预测器 | 学习得到的模型；与人工 MOS 相关性约 0.9。 |
| SECS | 声音克隆相似度 | 参考与克隆之间的 ECAPA 余弦相似度。 |
| EER | 说话人验证得分 | FAR = FRR 时的阈值。 |
| DER | 说话人分离得分 | (FA + Miss + Confusion) / total。 |
| FAD | 音乐生成质量 | VGGish 嵌入上的 Fréchet 距离。 |
| RTFx | 吞吐量 | 每秒墙钟时间处理的音频秒数。 |

## 延伸阅读

- [jiwer](https://github.com/jitsi/jiwer) —— 带归一化工具的 WER/CER 库。
- [UTMOS（Saeki 等，2022）](https://arxiv.org/abs/2204.02152) —— 学习得到的 MOS 预测器。
- [Fréchet 音频距离（Kilgour 等，2019）](https://arxiv.org/abs/1812.08466) —— 音乐生成的标准指标。
- [Open ASR Leaderboard](https://huggingface.co/spaces/hf-audio/open_asr_leaderboard) —— 2026 实时榜单。
- [TTS Arena](https://huggingface.co/spaces/TTS-AGI/TTS-Arena) —— 人工投票的 TTS 排行榜。
- [MMAU-Pro 基准](https://mmaubenchmark.github.io/) —— LALM 推理排行榜。
- [HEAR benchmark](https://hearbenchmark.com/) —— 音频自监督学习基准。
