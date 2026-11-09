#   建筑和精细调节

> 语是30秒钟的窗口变压器编码解码器,训练在多语言弱监督的音频文本对数的68万小时.一个架构,多任务,强大的99种语言.2026年参考ASR.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 04 (ASR), Phase 5 · 10 (Attention), Phase 7 · 05 (Full Transformer)
**Time:** ~75 minutes

## 问题

微声,由OpenAI于2022年9月发布,是首个作为商品的ASR模型:粘贴音频,获取文字,99种语言,强于噪音,运行在笔记本电脑上.到2024年,OpenAI已经发送了Large-v3和Turbo变体;到2026年,微声是自定义的基线,从播客转录到语音助手到YouTube字幕.

语不是一个管道,你可以永远把它当作一个黑盒子.域名转移杀了它.

1. 实际上是什么?
2. 如何正确地播放碎片,流媒体或长音频.
3. 什么时候和如何调整.

## 概念

![Whisper encoder-decoder, tasks, chunked inference, fine-tune](../assets/whisper.svg)

**Architecture.**标准变压器编码器-解码器.

- 输入:30秒钟的日志-邮件谱,80mels,10ms跳 →3000个框架.更短的剪辑是零,更长的剪辑是碎片.
- 编码器: conv-downsample (步骤2) + `N`对于大型V3: 32层, 1280层, 20头.
- 解码器:`N`变压器块具有因果自动接入 + 交叉接入到编码输出. 与编码器相同的尺寸.
- 输出:BPE代币超过51,865代币的词汇.

大型v3具有1.55B参数.Turbo使用4层解码器 (从32),切割延迟8x,WER击中<1% .

**The prompt format.**语是一个多任务模型,由解码器提示中的特殊代币控制:

```
<|startoftranscript|><|en|><|transcribe|><|notimestamps|> Hello world.<|endoftext|>
```

- `<|en|>`语文标签;在音频中所说的语言名称. 放弃它,然后Whisper先检测到语言.
- `<|transcribe|>`或`<|translate|>`:任务标签;将演讲转载到原始语言,或将其转换为英语文本.
- `<|notimestamps|>`: 跳过字面级时间标签 (更快).

提示是让一个模型完成多项任务的.`<|en|>`为了`<|fr|>`它们写成法语.

**30-second window.**长片需要分片,短片需要.窗户不会本地流,这就是为什么存在的WhisperX,Whisper-Streaming和快速的.

**Log-mel normalization.** `(log_mel - mean) / std`您必须使用Whisper的预处理 (`whisper.audio.log_mel_spectrogram`),没有`librosa.feature.melspectrogram`现在,我们要去.

### 2026年变种

| Variant | Params | Latency (A100) | WER (LibriSpeech-clean) |
|---------|--------|----------------|------------------------|
| Tiny | 39M | 1× realtime | 5.4% |
| Base | 74M | 1× | 4.1% |
| Small | 244M | 1× | 3.0% |
| Medium | 769M | 1× | 2.7% |
| Large-v3 | 1.55B | 2× | 1.8% |
| Large-v3-turbo | 809M | 8× | 1.58% |
| Whisper-Streaming (2024) | 1.55B | streaming | 2.0% |

### 调整

2026年可尼加工作流程:

1. 收集10100小时的目标域音频,并进行排列的转录.
2. 跑步`transformers.Seq2SeqTrainer`随着`generate_with_loss`呼叫回来.
3. 参数效率: 洛拉`q_proj`现在`k_proj`现在`v_proj`显著的GPU存储量4x,WER成本为<0.3
4. 如果有<10小时,请结编码器.
5. 使用Whisper自己的代币标记器和提示格式;永远不要交换代币标记器.

社区结果:调整:医疗指示20小时的中度调整降低了医疗词汇的WER12%至4.5%.

```figure
sp-asr-attention
```

## 建立它

### 步骤1: 运行Whisper

```python
import whisper
model = whisper.load_model("large-v3-turbo")
result = model.transcribe(
    "clip.wav",
    language="en",
    task="transcribe",
    temperature=0.0,
    condition_on_previous_text=False,  # prevents runaway repetition
)
print(result["text"])
for seg in result["segments"]:
    print(f"[{seg['start']:.2f}–{seg['end']:.2f}] {seg['text']}")
```

您应该总是取消关键默认问题: `temperature=0.0`(取样默认到0.0 → 0.2 → 0.4 ...反弹链), `condition_on_previous_text=False`(防止结幻觉问题),`no_speech_threshold=0.6`它们是的.

### 步骤2:长形碎片

```python
# whisperx is the 2026 reference for long-form with word-level timestamps
import whisperx
model = whisperx.load_model("large-v3-turbo", device="cuda", compute_type="float16")
segments = model.transcribe("1hour.mp3", batch_size=16, chunk_size=30)
```

微声X增加了 (1) Silero VAD 盖特, (2) 通过 wav2vec 2.0 进行文字水平排列, (3) 通过 日记化`pyannote.audio`作为2026年生产转录的工作马.

### 步骤3:使用LoRA进行细调

```python
from transformers import WhisperForConditionalGeneration, WhisperProcessor
from peft import LoraConfig, get_peft_model

model = WhisperForConditionalGeneration.from_pretrained("openai/whisper-large-v3-turbo")
lora = LoraConfig(
    r=16, lora_alpha=32, target_modules=["q_proj", "v_proj"],
    lora_dropout=0.1, bias="none", task_type="SEQ_2_SEQ_LM",
)
model = get_peft_model(model, lora)
# model.print_trainable_parameters()  -> ~3M trainable / 809M total
```

然后是标准训练者循环,每1000步就有一个检查点,然后用WER来评估.

### 步骤4:检查每个层学到什么

```python
# Grab cross-attention weights during decode to see what the decoder attends to.
with torch.inference_mode():
    out = model.generate(
        input_features=features,
        return_dict_in_generate=True,
        output_attentions=True,
    )
# out.cross_attentions: layer × head × step × src_len
```

通过热图可视化,您将看到对角的对齐,因为解码器步骤通过编码器框架扫描.

## 用它

现在,我们要做什么?

| Situation | Pick |
|-----------|------|
| General English, offline | Large-v3-turbo via `whisperx` |
| Mobile / edge | Whisper-Tiny quantized (int8) or Moonshine |
| Multilingual long-form | Large-v3 via `whisperx` + diarization |
| Low-resource language | Fine-tune Medium or Turbo with LoRA |
| Streaming (2 s latency) | Whisper-Streaming or Parakeet-TDT |
| Word-level timestamps | WhisperX (forced alignment via wav2vec 2.0) |

`faster-whisper`(CTranslate2后端) 是2026年最快的CPU+GPU推断运行时间,比尼拉快4x,具有相同输出.

## 陷在2026年仍存在

- **Hallucinated text on silence.**语训练在标题包括"谢谢你观看!","订阅!",歌词.
- **`condition_on_previous_text` cascade.**一个幻觉会污染后续的窗户.`False`除非你需要流动的分块.
- **Short-clip padding.**两秒钟的剪辑,被成30秒钟,可以在后续的沉默中产生幻觉.`pad=False`或是VAD-gate.
- **Wrong mel stats.**通过使用Librosa的而不是Whisper的,产生了近乎随机的输出.`whisper.audio.log_mel_spectrogram`现在,我们要去.

## 运送它

保存如`outputs/skill-whisper-tuner.md`设计一个特定域的微声细调或推断管道.

## 运动

1. **Easy.**跑步`code/main.py`它标记了一个像"声"这样的提示,计算解码的形状预算,
2. **Medium.**安装`faster-whisper`试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试试`language="auto"`强迫的`language="en"`现在,我们要去.
3. **Hard.**使用HF`datasets`选择一个语言,Whisper与它所斗争的语言 (例如乌尔都),在两个小时内调整中度与洛拉两个时代,并报告WER的三角形.

## 关键词

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| 30-sec window | Whisper's limit | Hard input cap; chunk longer audio. |
| SOT | Start-of-transcript | `<\|startoftranscript\|>` kicks off the decoder prompt. |
| Timestamps token | Temporal alignment | Every 0.02 s offset is a special token in the 51k vocab. |
| Turbo | The fast variant | 4-decoder layers, 8× faster, <1% WER regression. |
| WhisperX | The long-form wrapper | VAD + Whisper + wav2vec alignment + diarization. |
| LoRA fine-tune | Efficient tuning | Add low-rank adapters to attention; train ~0.3% of params. |
| Hallucination | The silent failure | Whisper produces fluent English from noise/silence. |

## 进一步阅读

- [Radford et al. (2022). Whisper paper](https://arxiv.org/abs/2212.04356)原始的建筑和培训配方.
- [OpenAI (2024). Whisper Large-v3-turbo release](https://github.com/openai/whisper/discussions/2363)四层解码器,8倍加快.
- [Bain et al. (2023). WhisperX](https://arxiv.org/abs/2303.00747)长长的形式,词汇一致,日记化.
- [Systran — faster-whisper repo](https://github.com/SYSTRAN/faster-whisper) CTranslate2支持,速度快4倍.
- [HuggingFace — Whisper fine-tune tutorial](https://huggingface.co/blog/fine-tune-whisper)法规LoRA/全FT通行.
