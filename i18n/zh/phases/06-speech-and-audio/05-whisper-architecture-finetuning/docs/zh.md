# Whisper — 架构与微调

> Whisper 是一个 30 秒窗口的 transformer 编码器-解码器，在 68 万小时的多语言弱监督音频-文本对上训练。一个架构，多种任务，在 99 种语言上保持稳健。2026 年的参考级 ASR。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 6 · 04 (ASR), Phase 5 · 10 (Attention), Phase 7 · 05 (Full Transformer)
**Time:** ~75 minutes

## 问题所在

Whisper 由 OpenAI 于 2022 年 9 月发布，是第一个以商品形式交付的 ASR 模型：粘贴音频，得到文本，支持 99 种语言，对噪声稳健，可以在笔记本电脑上运行。到 2024 年，OpenAI 已发布 Large-v3 和 Turbo 变体；到 2026 年，Whisper 已成为从播客转录到语音助手再到 YouTube 字幕等一切应用的默认基线。

但 Whisper 并不是一个可以永远当作黑盒的流水线。领域偏移会击垮它——技术术语、说话人口音、专有名词、短音频片段、静音。你需要知道：

1. 它内部到底是什么。
2. 如何正确地为它提供分块、流式或长格式音频。
3. 何时微调以及如何微调。

## 核心概念

![Whisper encoder-decoder, tasks, chunked inference, fine-tune](../assets/whisper.svg)

**架构。** 标准 transformer 编码器-解码器。

- 输入：30 秒 log-mel 频谱图，80 个 mel 频带，10 ms 帧移 → 3000 帧。较短的片段零填充，较长的片段分块。
- 编码器：卷积降采样(步长 2)+ `N` 个 transformer 块。Large-v3 为：32 层、1280 维、20 个头。
- 解码器：`N` 个 transformer 块，带因果自注意力 + 对编码器输出的交叉注意力。与编码器大小相同。
- 输出：BPE 词元，词表大小为 51,865。

Large-v3 有 15.5 亿参数。Turbo 使用 4 层解码器(从 32 层缩减)，将延迟降低 8 倍，WER 损失小于 1%。

**提示格式。** Whisper 是一个由解码器提示中特殊 token 控制的多任务模型：

```
<|startoftranscript|><|en|><|transcribe|><|notimestamps|> Hello world.<|endoftext|>
```

- `<|en|>` — 语言标签；强制翻译或转录行为。
- `<|transcribe|>` 或 `<|translate|>` — 将任意语言输入翻译为英文输出，或逐字转录。
- `<|notimestamps|>` — 跳过词级时间戳(更快)。

提示正是让一个模型执行多种任务的关键。把 `<|en|>` 改成 `<|fr|>`,它就会转录法语。

**30 秒窗口。** 一切都以 30 秒为固定单位。较长的音频需要分块；较短的音频需要填充。窗口不原生支持流式处理——这正是 WhisperX、Whisper-Streaming 和 faster-whisper 存在的原因。

**Log-mel 归一化。** `(log_mel - mean) / std`,其中统计量来自 Whisper 自己的训练语料库。你*必须*使用 Whisper 的预处理(`whisper.audio.log_mel_spectrogram`),而不是 `librosa.feature.melspectrogram`。

### 2026 年的变体

| 变体 | 参数量 | 延迟 (A100) | WER (LibriSpeech-clean) |
|---------|--------|----------------|------------------------|
| Tiny | 39M | 1× 实时 | 5.4% |
| Base | 74M | 1× | 4.1% |
| Small | 244M | 1× | 3.0% |
| Medium | 769M | 1× | 2.7% |
| Large-v3 | 1.55B | 2× | 1.8% |
| Large-v3-turbo | 809M | 8× | 1.58% |
| Whisper-Streaming (2024) | 1.55B | 流式 | 2.0% |

### 微调

2026 年的标准工作流：

1. 收集 10–100 小时带对齐转录的目标领域音频。
2. 运行 `transformers.Seq2SeqTrainer` 并使用 `generate_with_loss` 回调。
3. 参数高效方法：在注意力层的 `q_proj`、`k_proj`、`v_proj` 上使用 LoRA,可将 GPU 显存降低 4 倍，WER 损失小于 0.3。
4. 如果数据少于 10 小时，冻结编码器，只微调解码器。
5. 使用 Whisper 自己的分词器和提示格式；绝不更换分词器。

社区成果：在 20 小时医疗听写数据上微调 Medium,使医疗词汇的 WER 从 12% 降至 4.5%。在 4 小时冰岛语数据上微调 Turbo,WER 从 18% 降至 6%。

```figure
sp-asr-attention
```

## 动手构建

### 步骤 1:开箱即用地运行 Whisper

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

你应该始终覆盖的关键默认值：`temperature=0.0`(采样默认采用 0.0 → 0.2 → 0.4 … 的回退链)、`condition_on_previous_text=False`(防止级联幻觉问题)和 `no_speech_threshold=0.6`(静音检测)。

### 步骤 2:分块长格式处理

```python
# whisperx is the 2026 reference for long-form with word-level timestamps
import whisperx
model = whisperx.load_model("large-v3-turbo", device="cuda", compute_type="float16")
segments = model.transcribe("1hour.mp3", batch_size=16, chunk_size=30)
```

WhisperX 增加了:(1) Silero VAD 门控，(2) 通过 wav2vec 2.0 进行词级对齐，(3) 通过 `pyannote.audio` 进行说话人分离。这是 2026 年生产转录的主力工具。

### 步骤 3:使用 LoRA 微调

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

然后是标准的 Trainer 循环。每 1000 步保存一次检查点。用 WER 在留出集上评估。

### 步骤 4:检查每一层学到了什么

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

用热力图可视化——你会看到当解码器步骤扫过编码器帧时出现的对角线对齐。那条对角线就是 Whisper 对词时间戳的理解。

## 使用场景

2026 年的技术栈：

| 场景 | 选择 |
|-----------|------|
| 通用英语，离线 | 通过 `whisperx` 使用 Large-v3-turbo |
| 移动 / 边缘设备 | Whisper-Tiny 量化版 (int8) 或 Moonshine |
| 多语言长格式 | 通过 `whisperx` 使用 Large-v3 + 说话人分离 |
| 低资源语言 | 使用 LoRA 微调 Medium 或 Turbo |
| 流式(2 秒延迟)| Whisper-Streaming 或 Parakeet-TDT |
| 词级时间戳 | WhisperX(通过 wav2vec 2.0 强制对齐)|

`faster-whisper`(CTranslate2 后端)是 2026 年最快的 CPU+GPU 推理运行时——比原版快 4 倍，输出完全相同。

## 2026 年仍然存在的问题

- **静音时产生幻觉文本。** Whisper 的字幕训练数据包含“感谢观看！”、“订阅！”、歌词。调用前务必做 VAD 门控。
- **`condition_on_previous_text` 级联。** 一个幻觉会污染后续窗口。除非你需要跨块流畅性，否则应设置 `False`。
- **短片段填充。** 一个填充到 30 秒的 2 秒片段可能在末尾的静音中产生幻觉。使用 `pad=False` 或 VAD 门控。
- **错误的 mel 统计量。** 使用 librosa 的 mel 而非 Whisper 的会产生近乎随机的输出。使用 `whisper.audio.log_mel_spectrogram`。

## 交付实践

保存为 `outputs/skill-whisper-tuner.md`。为给定领域设计一个 Whisper 微调或推理流水线。

## 练习

1. **简单。** 运行 `code/main.py`。它会分词一个 Whisper 风格的提示，计算解码后的形状预算，并打印 10 分钟片段的分块计划。
2. **中等。** 安装 `faster-whisper`,转录一个 10 分钟播客，与人工转录稿比较 WER。尝试 `language="auto"` 与强制使用 `language="en"` 的对比。
3. **困难。** 使用 HF 的 `datasets`,选择一种 Whisper 表现不佳的语言(例如乌尔都语)，使用 LoRA 在 2 小时数据上微调 Medium 2 个 epoch,并报告 WER 变化。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------------|-----------------------|
| 30 秒窗口 | Whisper 的限制 | 硬性输入上限；较长的音频需要分块。 |
| SOT | 转录开始 | `<\|startoftranscript\|>` 启动解码器提示。 |
| 时间戳 token | 时间对齐 | 每 0.02 秒偏移对应 51k 词表中的一个特殊 token。 |
| Turbo | 快速变体 | 4 层解码器，快 8 倍，WER 回退小于 1%。 |
| WhisperX | 长格式封装 | VAD + Whisper + wav2vec 对齐 + 说话人分离。 |
| LoRA 微调 | 高效调优 | 在注意力层添加低秩适配器；仅训练约 0.3% 的参数。 |
| 幻觉 | 无声的失败 | Whisper 从噪声/静音中生成流畅的英文。 |

## 延伸阅读

- [Radford et al. (2022). Whisper 论文](https://arxiv.org/abs/2212.04356) — 原始架构与训练配方。
- [OpenAI (2024). Whisper Large-v3-turbo 发布](https://github.com/openai/whisper/discussions/2363) — 4 层解码器，8 倍加速。
- [Bain et al. (2023). WhisperX](https://arxiv.org/abs/2303.00747) — 长格式、词级对齐、说话人分离。
- [Systran — faster-whisper 仓库](https://github.com/SYSTRAN/faster-whisper) — 基于 CTranslate2,快 4 倍。
- [HuggingFace — Whisper 微调教程](https://huggingface.co/blog/fine-tune-whisper) — 标准的 LoRA / 全量微调指南。