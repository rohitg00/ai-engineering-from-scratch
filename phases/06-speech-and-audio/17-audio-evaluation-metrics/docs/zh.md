# 音频评估- WER、MOS、UTMOS、MMAU、FAD和开放排行榜

> 你无法运送你无法测量的东西。本课程列出了每个音频任务的2026年指标：ASB（WER、BER、RTFX）、TTC（MOS、UTMOS、SCES、WER on-ASB往返）、音频语言（MMAU、LongAudioBench）、音乐（FAD、CLAP）和扬声器（EER）。加上您比较的排行榜。

** 类型：** 学习
** 语言：** Python
** 先决条件：** 阶段6 · 04、06、07、09、10;阶段2 · 09（模型评估）
** 时间：** ~60分钟

## 问题

每个音频任务都有多个指标，每个指标测量不同的轴。使用错误的指标是您交付的模型在仪表板上看起来很棒但在生产中看起来很糟糕的方式。2026年经典名单：

| 任务 | 初级 | 二次 |
|------|---------|-----------|
| ASR | WER | CER · RTFx ·第一令牌延迟 |
| TTS | MOS / UTMOS | SCES· WER-on-ASB-往返·BER· TTFA |
| 语音克隆 | SCES（EAPA cos） | MOS ·BER |
| 说话者验证 | EER | minDCF ·工作点的FAR / FRR |
| Diarization | DER | JER ·扬声器混乱 |
| 音频分类 | top-1 · mAP | 宏F1 ·按类别召回 |
| 音乐生成 | FAD | CLAP ·聆听面板MOS |
| 音频语言模型 | MMAU-Pro | LongAudioBench · AudioCaps FENSE |
| 流媒体S2 S | 延迟P50/P95 | WER · MOS |

## 概念

![Audio evaluation matrix — metrics vs tasks vs 2026 leaderboards](../assets/eval-landscape.svg)

### ASB指标

**WER（字错误率）。** '（S + D + I）/ N '。大写字母，去掉标点符号，在评分前规范化数字。使用“jiwer”或OpenAI的“whisper_normalizer”。&lt;5% =人类同等阅读演讲。

** BER（字符错误率）。**相同的公式，字符级。用于分段模糊的语气语言（普通话、粤语）。

**RTFX（逆实时因子）。**每时钟秒处理的音频秒数。越高越好。长尾小鹦鹉TDT达到3380倍。Whisper-large-v3是~30×。

** 第一令牌延迟。**从音频输入到第一个文字记录令牌的时钟。对于流媒体至关重要。Deepgram Nova-3：~150 ms。

### TTC指标

**MOS（平均意见分数）。** 1-5人类评级。金本位但进展缓慢。每个样本收集20+个听众，每个模型收集100+个样本。

**UTMOS（2022-2026）。**学到的MOS预测器。标准基准上的人类MOS相关性约为0.9。F5-TTC：UTMOS 3.95;地面真相：4.08。

** SCES（扬声器编码器Cosine相似性）。**用于语音克隆。EAPA在参考和克隆输出之间嵌入cos。&gt;0.75 =可识别克隆。

**WER-on-ASS往返。**在TTC输出上运行Whisper，根据输入文本计算WER。捕捉清晰度回归。2026年SOTA：2%的减排量。

**TTFA（首次音频时间）。**时钟延迟。Kokoro-82 M：~100 ms; F5-TTC：~1 s。

### 特定于语音克隆

** SCES + MOS + BER ** 作为三重体。SICS得分高但MOS得分低的克隆意味着音色正确但不自然;相反意味着声音自然但说话者错误。

### 说话者验证

**EER（等错误率）。**假接受率等于假接受率的阈值。VoxCeleb 1-O上的EAPA：0.87%。

**minDCF（最小检测成本）。**选定操作点的加权成本（通常FAR=0.01）。比EER更与生产相关。

### Diarization

** BER（数字化错误率）。** '（FA + Miss + Confusion）/ total_speaker_time '。错过的语音+假警报语音+说话者混淆，每个都作为一个分数。AMI会议：BER ~10-20%是现实的。pyannote 3.1 +精度-2广告：录制良好的音频上的BER为10%。

**JER（贾卡德错误率）。** BER的替代品，对短段偏见具有鲁棒性。

### 音频分类

多标签：** 所有类别的 **mAP（平均精度）**。AudioSet：0.548 mAP，用于BEATs-iter 3。

多级别独家：** 前1名、前5名准确度 **。语音命令v2：99.0% top-1（Audio-MAE）。

不平衡：** 宏F1** + ** 每类召回 **。报告每个类的聚合准确性隐藏了哪些类失败。

### 音乐生成

**FAD（Fréchet音频距离）。**真实音频与生成音频的VGDish嵌入分布之间的距离。MusicGen-small on MusicCaps：4.5。MusicLM：4.0。低一点更好。

**CLAP评分。**使用CLAP嵌入的文本音频对齐评分。&gt;0.3 =合理对齐。

** 收听面板MOS。**仍然是消费级音乐的最终定义。RTS Arena上的Suno v5 ELO 1293（来自配对的人类偏好）。

### 音频语言基准

**MMAU（大规模多音频理解）。** 10，000个音频QA对。

**MMAU-Pro。** 1800个硬项，四大类别：语音/声音/音乐/多音频。4路随机几率25%。Gemini 2.5 Pro总体~60%;所有型号的多音频~22%。

**LongAudioBench。**带有语义查询的多分钟剪辑。音频Flamingo Next击败Gemini 2.5 Pro。

**AudioCaps / Clotho。**字幕基准。SPICE、CIDerer、FENSE指标。

### 流媒体语音对语音

** 延迟P50 / P95 / P99。**从用户语音结束到第一次可听响应的时钟。Moshi：200 ms; GPT-4 o实时：300 ms。

输出上的 **WER / MOS**。

** 介入响应能力。**从用户中断到助理静音的时间。目标150 ms。

### 2026年排行榜

| 排行榜 | 轨道 | URL |
|------------|--------|-----|
| 打开ASB排行榜（HF） | 英语+多语言+长篇 | ' huggingface.co/spaces/hf-audio/open_asr_leaderboard ' |
| TTC竞技场（HF） | 英语TTC | ' huggingface.co/spaces/TTS-AGI/TTS-Arena ' |
| 人工分析语音 | 来自成对投票的DTS + STT、ELO | ' artificalAnalysis.ai/speech ' |
| MMAU-Pro | LALM推理 | ' mmaubenchmark.github.io ' |
| SpeakerBench / VoxSRC | 说话人识别 | ' voxsrc.github.io ' |
| MMAU音乐子集 | 音乐LALM | （MMAU内） |
| HEAR基准 | 自监督音频 | “hearbenchmark.com” |

## 建设党

### 第1步：WER规范化

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

### 第2步：TTC往返WER

```python
def ttr_wer(tts_model, asr_model, texts):
    errors = []
    for txt in texts:
        audio = tts_model.synthesize(txt)
        recog = asr_model.transcribe(audio)
        errors.append(wer(truth=txt, hypothesis=recog))
    return sum(errors) / len(errors)
```

### 第3步：SCES进行语音克隆

```python
from speechbrain.inference.speaker import EncoderClassifier
sv = EncoderClassifier.from_hparams("speechbrain/spkrec-ecapa-voxceleb")

emb_ref = sv.encode_batch(load_wav("reference.wav"))
emb_clone = sv.encode_batch(load_wav("cloned.wav"))
secs = torch.nn.functional.cosine_similarity(emb_ref, emb_clone, dim=-1).item()
```

### 第4步：音乐生成的时尚

```python
from frechet_audio_distance import FrechetAudioDistance
fad = FrechetAudioDistance()
score = fad.get_fad_score("generated_folder/", "reference_folder/")
```

### 第5步：说话者验证的EER（代码与第6课相同）

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

## 使用它

将每个部署与在每次模型更新时运行的固定评估工具配对。三条基本规则：

1. ** 评分前标准化。**小写，标点，数字扩展。报告规范化规则。
2. ** 报告分布，而不是平均值。** P50/P95/P99代表延迟。按类别召回以进行分类。MMAU按类别计算。
3. ** 运行一个规范的公共基准。**即使您的生产数据不同，在Open ASB/TTC Arena / MMAU上进行报告也可以让审查人员进行苹果与苹果的比较。

## 陷阱

- **UTMOS外推。**接受过VCTK风格的干净言语培训;噪音/克隆/情感音频评分不佳。
- **MOS面板偏置。** 20名Amazon Machine Turk员工搜索20名目标用户。如果风险很高，则支付域名面板费用。
- **FAD取决于参考集。**与模型之间相同的参考分布进行比较。
- ** 合计。**总体而言，5%的WER可以隐藏30%的WER。按人口统计部分报告。
- ** 公共基准饱和。**大多数前沿模型都接近标准基准的上限。建立一个反映您流量的内部托管设置。

## 把它运

另存为“输出/skill-audio-evaluator.md”。为任何音频模型版本选择指标、基准和报告格式。

## 演习

1. ** 简单。**运行'代码/main.py '。在玩具输入上计算WER /BER/ EER /SCES/ FAD-ish / MMAU-ish。
2. ** 中等。**构建一个TTC往返WER背带。通过Whisper运行Kokoro或F5-TTC输出。计算超过50个提示。标记WER 10%提示。
3. ** 很难。**为您在MMAU-Pro语音+多音频子集（每个50个项目）上的第10课LALM选择评分。报告每个类别的准确性并与已发布的数字进行比较。

## 关键术语

| Term | 别人怎么说 | 它实际上意味着什么 |
|------|-----------------|-----------------------|
| WER | ASB评分 | 规范化后单词级别的“（S+D+I）/N”。 |
| CER | 字符WER | 用于语气语言或字符级系统。 |
| MOS | 人类观点 | 1-5评级; 20+听众x 100个样本。 |
| UTMOS | ML MOS预测器 | 习得模型;与人类MOS相关性约为0.9。 |
| SECS | 语音克隆相似性 | 参考和克隆之间的EAPA cos。 |
| EER | 发言者验证分数 | 阈值，其中FAR = FRR。 |
| DER | 日记化分数 | (FA+小姐+困惑）/总数。 |
| FAD | 音乐世代品质 | VGG嵌入上的Fréchet距离。 |
| RTFX | 吞吐量 | 每时钟秒的音频秒数。 |

## 进一步阅读

- [jiwer]（https：//github.com/jiwer）-具有规范化实用程序的WER/BER库。
- [UTMOS（Saeki et al. 2022）]（https：//arxiv.org/ab/2204.02152）-学习的MOS预测器。
- [Fréchet音频距离（Kilgour等人。2019）]（https：//arxiv.org/ab/1812.08466）-音乐世代标准。
- [Open ASB排行榜]（https：//huggingface.co/spaces/hf-audio/open_asr_leaderboard）- 2026年实时排名。
- [TTS Arena]（https：//huggingface.co/spaces/TTS-AGI/TTS-Arena）-人类投票TTC排行榜。
- [MMAU-Pro基准]（https：//mmaubenchmark.github.io/）- LALM推理排行榜。
- [HEAR基准测试]（https：//hearbenchmark.com/）-音频SSL基准测试。
