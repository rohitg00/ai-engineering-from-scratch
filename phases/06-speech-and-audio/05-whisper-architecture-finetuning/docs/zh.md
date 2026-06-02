# Whisper —— 架构与微调（Architecture & Fine-Tuning）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> Whisper 是一个 30 秒窗口的 transformer encoder-decoder，在 68 万小时的多语种弱监督音频—文本对上训练而成。一套架构、多种任务，在 99 种语言上稳健可用。它是 2026 年的 ASR 参考标准。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 6 · 04 (ASR), Phase 5 · 10 (Attention), Phase 7 · 05 (Full Transformer)
**Time:** ~75 minutes

## 问题（The Problem）

Whisper 由 OpenAI 于 2022 年 9 月发布，是第一个把 ASR 当作大宗商品来交付的模型：把音频喂进去，文字出来，支持 99 种语言，对噪声稳健，笔记本就能跑。到 2024 年，OpenAI 又推出了 Large-v3 和 Turbo 变体；到 2026 年，从播客转写到语音助手再到 YouTube 字幕，Whisper 都是默认 baseline（基线）。

但 Whisper 不是一条你可以永远当黑盒使用的流水线。领域漂移会把它击垮——技术黑话、口音、专有名词、短片段、静音都是杀手。你必须知道：

1. 它内部到底是什么。
2. 怎么正确地把分块的、流式的、长格式的音频喂给它。
3. 什么时候该微调，怎么微调。

## 概念（The Concept）

![Whisper encoder-decoder, tasks, chunked inference, fine-tune](../assets/whisper.svg)

**架构。** 标准的 transformer encoder-decoder。

- 输入：30 秒 log-mel 谱图，80 mel，10 ms hop → 3000 帧。短于 30 秒的片段补零，长于 30 秒的切块。
- Encoder：卷积下采样（stride 2）+ `N` 个 transformer block。Large-v3：32 层，1280 维，20 个 head。
- Decoder：`N` 个 transformer block，causal self-attention + 对 encoder 输出做 cross-attention。规模与 encoder 相同。
- 输出：51,865 词表上的 BPE token。

Large-v3 有 1.55B 参数。Turbo 把 decoder 从 32 层砍到 4 层，延迟降低 8×，WER 损失不到 1%。

**Prompt 格式。** Whisper 是一个多任务模型，由 decoder prompt 中的特殊 token 来掌舵：

```
<|startoftranscript|><|en|><|transcribe|><|notimestamps|> Hello world.<|endoftext|>
```

- `<|en|>` —— 语言标签；强制 translate 还是 transcribe 的行为。
- `<|transcribe|>` 或 `<|translate|>` —— 把任意语言输入翻译成英文输出，或者逐字转写。
- `<|notimestamps|>` —— 跳过词级时间戳（更快）。

Prompt 就是让一个模型胜任多种任务的关键。把 `<|en|>` 换成 `<|fr|>`，它就转写法语。

**30 秒窗口。** 一切都被钉在 30 秒上。更长的片段需要切块；更短的片段要补齐。窗口本身不是原生流式——这正是 WhisperX、Whisper-Streaming 和 faster-whisper 存在的原因。

**Log-mel 归一化。** `(log_mel - mean) / std`，其中均值方差来自 Whisper 自己训练语料的统计量。你**必须**用 Whisper 的预处理（`whisper.audio.log_mel_spectrogram`），而不是 `librosa.feature.melspectrogram`。

### 2026 年的变体

| Variant | Params | Latency (A100) | WER (LibriSpeech-clean) |
|---------|--------|----------------|------------------------|
| Tiny | 39M | 1× realtime | 5.4% |
| Base | 74M | 1× | 4.1% |
| Small | 244M | 1× | 3.0% |
| Medium | 769M | 1× | 2.7% |
| Large-v3 | 1.55B | 2× | 1.8% |
| Large-v3-turbo | 809M | 8× | 1.58% |
| Whisper-Streaming (2024) | 1.55B | streaming | 2.0% |

### 微调（Fine-tuning）

2026 年的标准工作流：

1. 收集 10–100 小时目标领域音频，配齐转写文本。
2. 跑 `transformers.Seq2SeqTrainer`，配 `generate_with_loss` 回调。
3. 参数高效路线：在 attention 层的 `q_proj`、`k_proj`、`v_proj` 上加 LoRA，可把 GPU 显存占用降低 4×，WER 代价不到 0.3。
4. 数据少于 10 小时就冻结 encoder，只调 decoder。
5. 用 Whisper 自己的 tokenizer 和 prompt 格式；千万别换 tokenizer。

社区结果：在 20 小时医学口述上微调 Medium，可把医学词汇上的 WER 从 12% 降到 4.5%；在 4 小时冰岛语上微调 Turbo，可把 WER 从 18% 降到 6%。

## 动手实现（Build It）

### Step 1：开箱即用跑 Whisper

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

有几个默认值你应该永远手动覆盖：`temperature=0.0`（采样默认会按 0.0 → 0.2 → 0.4 …的回退链来）、`condition_on_previous_text=False`（防止级联 hallucination（幻觉）问题）、以及 `no_speech_threshold=0.6`（静音检测）。

### Step 2：分块的长格式音频

```python
# whisperx is the 2026 reference for long-form with word-level timestamps
import whisperx
model = whisperx.load_model("large-v3-turbo", device="cuda", compute_type="float16")
segments = model.transcribe("1hour.mp3", batch_size=16, chunk_size=30)
```

WhisperX 加上了三件事：(1) Silero VAD 门控；(2) 通过 wav2vec 2.0 做词级对齐；(3) 通过 `pyannote.audio` 做说话人分离（diarization）。这是 2026 年生产级转写的主力。

### Step 3：用 LoRA 微调

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

然后接标准的 Trainer 循环。每 1000 步存一次 checkpoint。在留出集上用 WER 评估。

### Step 4：观察各层学到了什么

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

用热力图可视化——你会看到 decoder 一步步扫过 encoder 帧时，呈现出对角线对齐。这条对角线就是 Whisper 关于词时间戳的内在概念。

## 用起来（Use It）

2026 年的技术栈：

| 场景 | 选型 |
|-----------|------|
| 通用英文、离线 | 通过 `whisperx` 用 Large-v3-turbo |
| 移动端 / 边缘端 | Whisper-Tiny 量化（int8）或 Moonshine |
| 多语种长格式 | 通过 `whisperx` 用 Large-v3 + diarization |
| 低资源语言 | 用 LoRA 微调 Medium 或 Turbo |
| 流式（2 秒延迟） | Whisper-Streaming 或 Parakeet-TDT |
| 词级时间戳 | WhisperX（通过 wav2vec 2.0 做强制对齐） |

`faster-whisper`（CTranslate2 后端）是 2026 年最快的 CPU+GPU 推理运行时——比原版快 4×，输出完全相同。

## 2026 年仍然踩得到的坑

- **静音上的 hallucination 文本。** Whisper 在带字幕的语料上训练，里面混了 "Thanks for watching!"、"Subscribe!"、歌词等。调用前一定要先做 VAD 门控。
- **`condition_on_previous_text` 级联。** 一次 hallucination 会污染后续所有窗口。除非你需要跨块的语义连贯，否则设为 `False`。
- **短片段补齐。** 一个 2 秒的片段被补齐到 30 秒后，可能会在尾部静音里幻觉出文字。用 `pad=False` 或者 VAD 门控。
- **错误的 mel 统计量。** 用 librosa 的 mel 而不是 Whisper 的，会得到近乎随机的输出。用 `whisper.audio.log_mel_spectrogram`。

## 上线部署（Ship It）

保存为 `outputs/skill-whisper-tuner.md`。为给定领域设计一条 Whisper 微调或推理流水线。

## 练习（Exercises）

1. **Easy.** 跑 `code/main.py`。它会 tokenize 一段 Whisper 风格的 prompt，计算 decode 后的形状预算，并打印一段 10 分钟片段的切块时间表。
2. **Medium.** 安装 `faster-whisper`，转写一段 10 分钟的播客，把 WER 与人工转写对比。试一下 `language="auto"` 与强制 `language="en"` 的差异。
3. **Hard.** 用 HF `datasets`，挑一种 Whisper 比较吃力的语言（如乌尔都语），用 LoRA 在 2 小时数据上跑 2 个 epoch 微调 Medium，并报告 WER 变化。

## 关键术语（Key Terms）

| 术语 | 大家都怎么说 | 实际含义 |
|------|-----------------|-----------------------|
| 30-sec window | Whisper 的限制 | 硬性输入上限；更长的音频要切块。 |
| SOT | Start-of-transcript | `<\|startoftranscript\|>` 启动 decoder prompt。 |
| Timestamps token | 时间对齐 | 每 0.02 s 偏移就是 51k 词表里的一个特殊 token。 |
| Turbo | 快速版 | 4 层 decoder，快 8×，WER 退化 <1%。 |
| WhisperX | 长格式包装层 | VAD + Whisper + wav2vec 对齐 + diarization。 |
| LoRA fine-tune | 高效微调 | 在 attention 上加低秩 adapter；只训练约 0.3% 参数。 |
| Hallucination | 沉默的失败 | Whisper 从噪声/静音里编出流利的英文。 |

## 延伸阅读（Further Reading）

- [Radford et al. (2022). Whisper paper](https://arxiv.org/abs/2212.04356) —— 原始架构与训练配方。
- [OpenAI (2024). Whisper Large-v3-turbo release](https://github.com/openai/whisper/discussions/2363) —— 4 层 decoder，8× 加速。
- [Bain et al. (2023). WhisperX](https://arxiv.org/abs/2303.00747) —— 长格式、词级对齐、说话人分离。
- [Systran — faster-whisper repo](https://github.com/SYSTRAN/faster-whisper) —— CTranslate2 后端，快 4×。
- [HuggingFace — Whisper fine-tune tutorial](https://huggingface.co/blog/fine-tune-whisper) —— 经典的 LoRA / 全参微调走读。
