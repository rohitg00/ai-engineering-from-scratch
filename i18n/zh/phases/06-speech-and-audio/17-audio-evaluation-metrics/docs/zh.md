# 音频评估  WER,MOS,UTMOS,MMAU,FAD和开放的排名表

> 您不能运送您无法测量的东西.本课程列出了每个音频任务的2026个指标:ASR (WER, CER,RTFx),TTS (MOS,UTMOS,SECS,WER-on-ASR-round-trip),音频语言 (MMAU,LongAudioBench),音乐 (FAD,CLAP),音箱 (EER).

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 04, 06, 07, 09, 10; Phase 2 · 09 (Model Evaluation)
**Time:** ~60 minutes

## 问题

每个音频任务都有多个指标,每个指标都测量不同的轴.使用错误的指标是如何运送一个模型,看起来很好在仪表板上,而且生产非常糟糕.2026年经典列表:

| Task | Primary | Secondary |
|------|---------|-----------|
| ASR | WER | CER · RTFx · first-token latency |
| TTS | MOS / UTMOS | SECS · WER-on-ASR-round-trip · CER · TTFA |
| Voice cloning | SECS (ECAPA cosine) | MOS · CER |
| Speaker verification | EER | minDCF · FAR / FRR at operating point |
| Diarization | DER | JER · speaker confusion |
| Audio classification | top-1 · mAP | macro F1 · per-class recall |
| Music generation | FAD | CLAP · listening panel MOS |
| Audio language model | MMAU-Pro | LongAudioBench · AudioCaps FENSE |
| Streaming S2S | latency P50/P95 | WER · MOS |

## 概念

![Audio evaluation matrix — metrics vs tasks vs 2026 leaderboards](../assets/eval-landscape.svg)

### 标准标准

**WER (Word Error Rate).** `(S + D + I) / N`低文字,脱离分区,在得分之前正常化数字.`jiwer`或是OpenAI的`whisper_normalizer`,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,

**CER (Character Error Rate).**语音语言 (曼德林,堪敦语) 使用的语音语言,语音分类不明确.

**RTFx (inverse real-time factor).**音频秒钟是每秒钟的处理. 较高更好. 子-TDT 达到3380×. 声-大-v3 达到30×.

**First-token latency.**视频传输到转录代币的墙钟.

### 标准标准

**MOS (Mean Opinion Score).**测量量1-5人,金标准,但速度慢. 每个样本收藏20多名听者,每个模型收藏100多个样本.

**UTMOS (2022-2026).**已学习的MOS预测器.与标准基准的人类MOS相对应.F5-TTS:UTMOS3.95;基础真相:4.08.

**SECS (Speaker Encoder Cosine Similarity).**对于语音克隆.ECAPA 嵌入引用和克隆输出之间的共数. &gt; 0.75 =可识别的克隆.

**WER-on-ASR-round-trip.**运行Whisper在TTS输出上,计算WER与输入文本相比.捕获可理解性回归. 2026 SOTA:在英语测试组上&lt;2%WER (而不是曼德林组报告 CER).

**TTFA (time-to-first-audio).**长时间: 长时间: 短时间: 短时间: 短时间:

### 语音克隆特定

**SECS + MOS + CER**克隆中高SECS但低MOS的意思是对音调,但不自然;相反的意思是自然的声音,但错误的扬声器.

### 扬声器验证

**EER (Equal Error Rate).**假接受率等于假拒绝率的门值.

**minDCF (min Detection Cost).**在选择的运营点中,重量成本 (通常是FAR=0.01).

### 腹化

**DER (Diarization Error Rate).** `(FA + Miss + Confusion) / total_speaker_time`错失语音+假报警语音+扬声器混,每一个是小部分. AMI会议:DER ~10-20%是现实的. pyannote 3.1 +精确-2广告: &lt;10%DER在记录良好音频.

**JER (Jaccard Error Rate).**替代DER,强到短段偏见.

### 音频分类

多标签: **mAP (mean Average Precision)**音频组:BETs-iter3的 0.548mAP

多类独家: **top-1, top-5 accuracy**语音指令v2: 99.0% 顶-1 (音频-MAE).

失衡:**macro F1**其他**per-class recall**报告每类 总准确性隐藏了哪些类失败.

### 音乐产生的

**FAD (Fréchet Audio Distance).**视频集成直播器与生成音频之间的距离. MusicGen-small on MusicCaps:4.5. MusicLM:4.0.更低.

**CLAP Score.**通过CLAP嵌入式的文字音频配列分数.

**Listening panel MOS.**苏诺 V5 在苏诺自己的双重偏好基准上获得了ELO 1293分.这是一个供应商号码;TTS Arena排名了语音,而不是音乐.

### 音频语言基准指标

**MMAU (Massive Multi-Audio Understanding).**十万个音频QA对.

**MMAU-Pro.**1,800个硬件,四类:语音/声音/音乐/多音频. 随机机会25%在四方向. 双子 2.5 专用总体约60%; 多音频约22%在所有车型上.

**LongAudioBench.**音频Flamingo下一个比双子 2.5Pro更好.

**AudioCaps / Clotho.**标题标签:SPICE,CIDER,FENSE指标

### 流通语音

**Latency P50 / P95 / P99.**截止用户语音到首次听到的响应.

**WER / MOS**在输出.

**Barge-in responsiveness.**时间从用户中断到助理.目标&lt;150ms.

### 2026 年的排名榜

| Leaderboard | Tracks | URL |
|------------|--------|-----|
| Open ASR Leaderboard (HF) | English + multilingual + long-form | `huggingface.co/spaces/hf-audio/open_asr_leaderboard` |
| TTS Arena (HF) | English TTS | `huggingface.co/spaces/TTS-AGI/TTS-Arena` |
| Artificial Analysis Speech | TTS + STT, ELO from paired votes | `artificialanalysis.ai/speech` |
| MMAU-Pro | LALM reasoning | `sonalkum.github.io/mmau-pro` |
| SpeakerBench / VoxSRC | Speaker recognition | `voxsrc.github.io` |
| MMAU music subset | Music LALM | (within MMAU) |
| HEAR benchmark | Self-supervised audio | `hearbenchmark.com` |

```figure
sp-wer-align
```

## 建立它

### 步骤1:WER与正常化

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

### 步骤2:TTS回路 WER

```python
def ttr_wer(tts_model, asr_model, texts):
    errors = []
    for txt in texts:
        audio = tts_model.synthesize(txt)
        recog = asr_model.transcribe(audio)
        errors.append(wer(truth=txt, hypothesis=recog))
    return sum(errors) / len(errors)
```

### 步骤3:语音克隆的SECS

```python
from speechbrain.inference.speaker import EncoderClassifier
sv = EncoderClassifier.from_hparams("speechbrain/spkrec-ecapa-voxceleb")

emb_ref = sv.encode_batch(load_wav("reference.wav"))
emb_clone = sv.encode_batch(load_wav("cloned.wav"))
secs = torch.nn.functional.cosine_similarity(emb_ref, emb_clone, dim=-1).item()
```

### 步骤4:音乐生成的FAD

```python
from frechet_audio_distance import FrechetAudioDistance
fad = FrechetAudioDistance()
score = fad.get_fad_score("generated_folder/", "reference_folder/")
```

### 步骤5:语音者验证的EER (与第6课相同的代码)

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

## 用它

通过每一个模型更新都运行的固定评估带来了每一个部署.

1. **Normalize before scoring.**简字,点击条,数字扩大,报告规则.
2. **Report distributions, not averages.**对于延迟,P50/P95/P99 类别回忆,类别回忆,类别回忆,类别回忆,类别回忆,类别回忆,类别回忆,类别回忆,类别回忆,类别回忆,类别回忆,类别回忆,类别回忆,类别回忆,类别回忆,类别回忆,类别回忆,类别回忆,类别回忆,类别回忆,类别回忆,类别回忆,类别回忆,类别回忆,类别回忆,类别回忆,类别回忆,类别回忆,类别回忆,类别回忆,类别回忆,类别回忆,类别回忆,类别回忆,类别回忆,类别回忆,类别回忆,类别回忆,类型回忆,类型回忆,类型回忆,类型回忆,类型回忆,类型等等.
3. **Run one canonical public benchmark.**即使您的生产数据不同, 报告在开放ASR/TTS Arena/MMAU让评论员比较果与果.

## 陷

- **UTMOS extrapolation.**训练于VCTK风格的清洁演讲; 评分噪音/克隆/情感音频差.
- **MOS panel bias.**亚马逊机械土耳其员工的目标用户为20名.
- **FAD depends on reference set.**较量模型中的参考分布相同.
- **Aggregate WER.**总体上5%的WER可以隐藏30%的WER在强调的语音.
- **Public benchmark saturation.**根据标准标准,大多数线路车型都接近天花板.

## 运送它

保存如`outputs/skill-audio-evaluator.md`选择任何音频模型发布的指标,基准和报告格式.

## 运动

1. **Easy.**跑步`code/main.py`计算玩具输入的 WER / CER / EER / SECS / FAD-ish / MMAU-ish.
2. **Medium.**建立一个TTS回路WER带.通过Whisper运行你的Kokoro或F5-TTS输出.计算WER超过50个提示.旗提示WER&gt; 10%.
3. **Hard.**评分您的10课 LALM选择在MMAU-Pro语音+多音频子组 (每个组分为50个). 报告每类别的准确性,并与公布的数字进行比较.

## 关键词

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| WER | ASR score | `(S+D+I)/N` at word level after normalization. |
| CER | Character WER | For tone languages or char-level systems. |
| MOS | Human opinion | 1-5 rating; 20+ listeners × 100 samples. |
| UTMOS | ML MOS predictor | Learned model; correlates ~0.9 with human MOS. |
| SECS | Voice-clone similarity | ECAPA cosine between reference and clone. |
| EER | Speaker verif score | Threshold where FAR = FRR. |
| DER | Diarization score | (FA + Miss + Confusion) / total. |
| FAD | Music-gen quality | Fréchet distance on VGGish embeddings. |
| RTFx | Throughput | Audio seconds per wall-clock second. |

## 进一步阅读

- [jiwer](https://github.com/jitsi/jiwer) WER/CER库,具有正常化工具.
- [UTMOS (Saeki et al. 2022)](https://arxiv.org/abs/2204.02152)学习了MOS预测器.
- [Fréchet Audio Distance (Kilgour et al. 2019)](https://arxiv.org/abs/1812.08466)音乐世代标准.
- [Open ASR Leaderboard](https://huggingface.co/spaces/hf-audio/open_asr_leaderboard)2026年现场排名.
- [TTS Arena](https://huggingface.co/spaces/TTS-AGI/TTS-Arena)人投票的TTS排名榜.
- [MMAU-Pro benchmark](https://sonalkum.github.io/mmau-pro/) LALM推理排名榜
- [HEAR benchmark](https://hearbenchmark.com/)音频SSL基准.
