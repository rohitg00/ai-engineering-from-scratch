# 低语-建筑与微调

> Whisper是一个30秒窗口的Transformer编码器-解码器，在68万小时的多语言弱监督音频-文本对上训练。一种架构，多种任务，支持99种语言。2026年参考ASC。

** 类型：** 构建
** 语言：** Python
** 先决条件：** 阶段6 · 04（ASC）、阶段5 · 10（注意）、阶段7 · 05（全Transformer）
** 时间：** ~75分钟

## 问题

Whisper由OpenAI于2022年9月发布，是第一款作为商品推出的ASB型号：粘贴音频、获取文本、99种语言、抗噪音能力强，在笔记本电脑上运行。到2024年，OpenAI已经推出了Large-v3和Turbo变体;到2026年，Whisper成为从播客转录到语音助手再到YouTube字幕等所有内容的默认基线。

但Whisper并不是一个可以永远视为黑匣子的管道。领域转移杀死了它--技术行话、说话者口音、专有名词、短剪辑、沉默。您需要知道：

1. 里面到底是什么。
2. 如何正确地为其提供分块、流媒体或长格式音频。
3. 何时微调以及如何微调。

## 概念

![Whisper encoder-decoder, tasks, chunked inference, fine-tune](../assets/whisper.svg)

** 建筑。**标准Transformer编码器-解码器。

- 输入：30秒对数梅尔频谱图，80梅尔，10毫秒跳→ 3000帧。较短的剪辑为零填充，较长的剪辑为块。
- 编码器：conv-down sample（跨度2）+' N ' Transformer块。对于Large-v3：32层，1280-dim，20个头。
- 解码器：“N”个Transformer块，具有因果自attn + cross-attn到编码器输出。与编码器大小相同。
- 输出：BPE令牌超过51，865个令牌的vocab。

Large-v3具有1.55B参数。Turbo使用4层解码器（从32层开始），将延迟降低8倍，WER命中率<1%。

** 提示格式。** Whisper是一个由解码器提示符中的特殊令牌引导的多任务模型：

```
<|startoftranscript|><|en|><|transcribe|><|notimestamps|> Hello world.<|endoftext|>
```

- `<|en|>'-语言标签;强制描述与转录行为。
- `<|转录|>'或'|翻译|>'-翻译来自任何语言输入的英语输出，或逐字翻译。
- `<|无时间戳|>'-跳过单词级时间戳（更快）。

提示可以让一个模型执行多项任务。改变'<|en| ' to ''| fr| '而且它转录了法语。

**30秒窗口。**一切都被固定在30秒内。较长的剪辑需要分块;较短的剪辑需要填充。Windows不是本地流媒体-这就是WhisperX、Whisper-Streaming和Faster-whisper存在的原因。

**Log-mel正常化。** '（log_mel - mean）/ std '其中统计数据来自Whisper自己的训练数据库。您 * 必须 * 使用Whisper的预处理（' whisper.audio.log_mel_spectrogram '），而不是' librosa.feature.melspectrogram '。

### 2026年的变体

| 变体 | Params | 延迟（A100） | WER（LibriSpeech-clean） |
|---------|--------|----------------|------------------------|
| 微小 | 39M | 1 x实时 | 5.4% |
| 基地 | 74M | 1× | 4.1% |
| 小 | 244M | 1× | 3.0% |
| 介质 | 小行星769 | 1× | 2.7% |
| 大v3 | 1.55B | 2× | 1.8% |
| 大型v3涡轮增压 | 809M | 8× | 1.58% |
| 耳语流媒体（2024） | 1.55B | 流 | 2.0% |

### 微调

2026年规范工作流程：

1. Collect 10–100 hours of target-domain audio with aligned transcripts.
2. 使用“generate_with_loss”回调运行“transformers.Seq2SeqTrainer”。
3. 参数高效：注意力层的“q_proj”、“k_proj”、“v_proj”上的LoRA可减少4倍，WER成本<0.3。
4. 如果您的时间<10小时，请冻结编码器。仅调整解码器。
5. 使用Whisper自己的标记器和提示格式;切勿交换标记器。

社区结果：对20小时的医疗口述进行微调，医疗词汇的WER从12%下降到4.5%。对4小时冰岛语进行微调后，WER从18%降至6%。

## 建设党

### 第1步：从盒子里运行Whisper

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

您应该始终重写的关键默认值：“temperature=0.0”（采样默认为0.0 - 0.2 - 0.4.后备链）、“condition_on_previous_text=False”（防止级联幻觉问题）和“no_speech_thield =0.6”（静音检测）。

### 2.分块的长格式

```python
# whisperx is the 2026 reference for long-form with word-level timestamps
import whisperx
model = whisperx.load_model("large-v3-turbo", device="cuda", compute_type="float16")
segments = model.transcribe("1hour.mp3", batch_size=16, chunk_size=30)
```

WhisperX添加了（1）Silero VAR门控，（2）通过wav2vec 2.0进行单词级对齐，（3）通过“pyannote.audio”进行日记化。2026年制作转录的主力。

### 第3步：与LoRA进行微调

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

然后是标准培训师循环。每1000步检查一次。使用WER进行评估。

### 第4步：检查每层学到了什么

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

使用热图可视化-当解码器步骤扫描编码器帧时，您将看到对角线对齐。该对角线是Whisper的单词时间戳概念。

## 使用它

2026年堆栈：

| 情况 | 接 |
|-----------|------|
| 普通英语，离线 | 通过“whisperx”进行大v3涡轮增压 |
| 移动/边缘 | 耳语微小量子化（int 8）或月光 |
| 多语言长形式 | 通过“whisperx”+日记化的大v3 |
| 低资源语言 | 使用LoRA微调Medium或Turbine |
| 流媒体（2秒延迟） | 耳语流媒体或长尾小鹦鹉TDT |
| 单词级时间戳 | WhisperX（通过wav2vec 2.0强制对齐） |

“faster-whisper”（CTranslate 2后台）是2026年最快的中央处理器+图形处理器推理运行时-比输出相同的vanilla快4倍。

## 2026年仍存在的陷阱

- ** 关于沉默的幻觉文本。**低语者接受过字幕训练，包括“谢谢观看！”、“订阅！”，歌词。在呼叫之前始终打开VAR门。
- **' condition_on_previous_text ' cascade。**一种幻觉污染了后续的窗户。设置“False”，除非您需要跨块流畅。
- ** 短剪辑填充。**一个2秒的剪辑填充到30秒可以在尾随的沉默幻觉。使用'pad=False'或VAD门。
- ** 错误的梅尔统计 **使用librosa的mels而不是Whisper的mels会产生近乎随机的输出。使用`whisper.audio.log_mel_spectrogram`。

## 把它运

另存为“输出/skill-whisper-tuner.md”。为给定域设计Whisper微调或推理管道。

## 演习

1. ** 简单。**运行'代码/main.py '。它对Whisper风格的提示进行标记化，计算解码的形状预算，并打印10分钟剪辑的块时间表。
2. ** 中等。**安装“Faster-whisper”，转录10分钟的播客，将WER与人类文字记录进行比较。尝试' languages =“Auto”' vs强制' languages =“en”'。
3. **Hard.** Using HF `datasets`, pick a language Whisper struggles with (e.g., Urdu), fine-tune Medium with LoRA for 2 epochs on 2 hours, and report WER delta.

## 关键术语

| Term | 别人怎么说 | 它实际上意味着什么 |
|------|-----------------|-----------------------|
| 30-秒窗口 | Whisper's limit | 硬输入上限;块更长的音频。 |
| SOT | 转录起始 | `< | 开始文字记录 | >'启动解码器提示。 |
| 时间戳令牌 | 时间对准 | 每0.02秒的偏差都是51k词汇中的一个特殊代币。 |
| Turbo | The fast variant | 4-解码器层，速度快8倍，WER回归<1%。 |
| WhisperX | 长包装纸 | VAR + Whisper + wav2vec对齐+dialization。 |
| LoRA微调 | 高效的调谐 | 添加低级别适配器引起注意;训练约0.3%的参数。 |
| 幻觉 | 无声的失败 | Whisper从噪音/沉默中产生流利的英语。 |

## 进一步阅读

- [雷德福等人（2022）。耳语纸]（https：//arxiv.org/abs/2212.04356）-原始架构和培训食谱。
- [OpenAI（2024）。Whisper Large-v3-涡轮发布]（https：//github.com/openai/whisper/discussions/2363）- 4层解码器，8倍加速。
- [Bain等人（2023）。WhisperX]（https：//arxiv.org/ab/2303.00747）-长格式、单词对齐、日记化。
- [Systran - faster-whisper repo]（https：//github.com/CLARRAN/faster-whisper）-CTranslate 2-支持，速度快4倍。
- [HuggingFace - Whisper微调教程]（https：//huggingface.co/blog/fine-tune-whisper）-典型的LoRA / full-FT演练。
