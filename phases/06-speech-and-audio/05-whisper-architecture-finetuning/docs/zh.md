# 05 · Whisper —— 架构与微调

> Whisper 是一个以 30 秒为窗口的「编码器-解码器（encoder-decoder）」Transformer，在 68 万小时多语种、弱监督的「音频-文本」配对上训练而成。一套架构，多种任务，跨 99 种语言依然稳健。它是 2026 年事实上的「自动语音识别（ASR）」基准。

**类型：** 构建
**语言：** Python
**前置：** 第 6 阶段 · 04（ASR）、第 5 阶段 · 10（注意力）、第 7 阶段 · 05（完整 Transformer）
**时长：** 约 75 分钟

## 问题所在

Whisper 由 OpenAI 于 2022 年 9 月发布，是第一个作为「通用商品」交付的 ASR 模型：粘贴音频，得到文本，支持 99 种语言，抗噪稳健，且能在笔记本上运行。到 2024 年，OpenAI 已发布 Large-v3 与 Turbo 变体；到 2026 年，从播客转录、语音助手到 YouTube 字幕，Whisper 已是一切场景的默认基线。

但 Whisper 并不是一条你可以永远当作黑箱对待的流水线。「领域漂移（domain shift）」会让它崩溃 —— 技术行话、说话人口音、专有名词、短片段、静音都会出问题。你需要搞清楚：

1. 它内部到底是什么。
2. 如何正确地给它分块、流式或长音频输入。
3. 何时该微调，以及怎么微调。

## 核心概念

〔图：Whisper 编码器-解码器结构、任务、分块推理与微调〕

**架构。** 标准的 Transformer 编码器-解码器。

- 输入：30 秒的「对数梅尔频谱图（log-mel spectrogram）」，80 个梅尔频带，10 ms 跳步 → 3000 帧。更短的片段会被零填充，更长的片段会被分块。
- 编码器：卷积下采样（stride 2）+ `N` 个 Transformer 块。以 Large-v3 为例：32 层，1280 维，20 个注意力头。
- 解码器：`N` 个 Transformer 块，包含因果自注意力（causal self-attn）+ 对编码器输出的交叉注意力（cross-attn）。规模与编码器相同。
- 输出：基于 51,865 词表的「字节对编码（BPE）」token。

Large-v3 有 15.5 亿参数。Turbo 使用 4 层解码器（原本是 32 层），将延迟削减为原来的 1/8，而「词错误率（WER）」损失小于 1%。

**提示词格式。** Whisper 是一个由解码器提示词中的特殊 token 来引导的多任务模型：

```
<|startoftranscript|><|en|><|transcribe|><|notimestamps|> Hello world.<|endoftext|>
```

- `<|en|>` —— 语言标签；用于强制选择「翻译还是转录」的行为。
- `<|transcribe|>` 或 `<|translate|>` —— 把任意语言输入翻译为英文输出，或逐字转录。
- `<|notimestamps|>` —— 跳过词级时间戳（更快）。

正是这个提示词让单一模型能够完成多种任务。把 `<|en|>` 换成 `<|fr|>`，它就会转录法语。

**30 秒窗口。** 一切都被固定在 30 秒上。更长的片段需要分块；更短的片段需要填充。窗口并不原生支持流式 —— 这正是 WhisperX、Whisper-Streaming 与 faster-whisper 存在的原因。

**对数梅尔归一化。** `(log_mel - mean) / std`，其中统计量来自 Whisper 自己的训练语料。你*必须*使用 Whisper 的预处理（`whisper.audio.log_mel_spectrogram`），而不是 `librosa.feature.melspectrogram`。

### 2026 年的各种变体

| 变体 | 参数量 | 延迟（A100） | WER（LibriSpeech-clean） |
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

1. 收集 10–100 小时目标领域音频，并配有对齐的转录文本。
2. 用 `transformers.Seq2SeqTrainer` 运行，配合 `generate_with_loss` 回调。
3. 参数高效方案：在注意力层的 `q_proj`、`k_proj`、`v_proj` 上使用 LoRA，可将 GPU 显存降低为原来的 1/4，而 WER 代价小于 0.3。
4. 如果你只有不到 10 小时的数据，就冻结编码器，仅微调解码器。
5. 使用 Whisper 自己的分词器与提示词格式；切勿替换分词器。

社区结果：在 20 小时医学口述上微调 Medium，可将医学词汇上的 WER 从 12% 降到 4.5%。在 4 小时冰岛语上微调 Turbo，可将 WER 从 18% 降到 6%。

## 动手构建

### 第 1 步：直接开箱运行 Whisper

```python
import whisper
model = whisper.load_model("large-v3-turbo")
result = model.transcribe(
    "clip.wav",
    language="en",
    task="transcribe",
    temperature=0.0,
    condition_on_previous_text=False,  # 防止失控的重复输出
)
print(result["text"])
for seg in result["segments"]:
    print(f"[{seg['start']:.2f}–{seg['end']:.2f}] {seg['text']}")
```

你应该始终覆盖的关键默认值：`temperature=0.0`（采样默认走 0.0 → 0.2 → 0.4 … 的回退链）、`condition_on_previous_text=False`（防止级联式幻觉问题），以及 `no_speech_threshold=0.6`（静音检测）。

### 第 2 步：分块处理长音频

```python
# whisperx 是 2026 年处理长音频并带词级时间戳的参考方案
import whisperx
model = whisperx.load_model("large-v3-turbo", device="cuda", compute_type="float16")
segments = model.transcribe("1hour.mp3", batch_size=16, chunk_size=30)
```

WhisperX 增加了 (1) 基于 Silero 的 VAD 门控，(2) 通过 wav2vec 2.0 实现的词级对齐，(3) 通过 `pyannote.audio` 实现的说话人分离。它是 2026 年生产级转录的主力工具。

### 第 3 步：用 LoRA 微调

```python
from transformers import WhisperForConditionalGeneration, WhisperProcessor
from peft import LoraConfig, get_peft_model

model = WhisperForConditionalGeneration.from_pretrained("openai/whisper-large-v3-turbo")
lora = LoraConfig(
    r=16, lora_alpha=32, target_modules=["q_proj", "v_proj"],
    lora_dropout=0.1, bias="none", task_type="SEQ_2_SEQ_LM",
)
model = get_peft_model(model, lora)
# model.print_trainable_parameters()  -> 约 3M 可训练 / 总计 809M
```

然后接标准的 Trainer 循环。每 1000 步保存一次检查点。用留出集上的 WER 进行评估。

### 第 4 步：观察每一层学到了什么

```python
# 在解码过程中抓取交叉注意力权重，看看解码器关注什么。
with torch.inference_mode():
    out = model.generate(
        input_features=features,
        return_dict_in_generate=True,
        output_attentions=True,
    )
# out.cross_attentions: layer × head × step × src_len
```

用热力图可视化 —— 你会看到随着解码器逐步扫描编码器帧，呈现出对角线对齐。这条对角线就是 Whisper 对词级时间戳的理解。

## 实际使用

2026 年的技术栈：

| 场景 | 选择 |
|-----------|------|
| 通用英语，离线 | 通过 `whisperx` 使用 Large-v3-turbo |
| 移动端 / 边缘端 | 量化后的 Whisper-Tiny（int8）或 Moonshine |
| 多语种长音频 | 通过 `whisperx` 使用 Large-v3 + 说话人分离 |
| 低资源语言 | 用 LoRA 微调 Medium 或 Turbo |
| 流式（2 秒延迟） | Whisper-Streaming 或 Parakeet-TDT |
| 词级时间戳 | WhisperX（通过 wav2vec 2.0 进行强制对齐） |

`faster-whisper`（CTranslate2 后端）是 2026 年最快的 CPU+GPU 推理运行时 —— 比原版快 4 倍，且输出完全一致。

## 2026 年仍会踩到的坑

- **静音处的幻觉文本。** Whisper 在含字幕的数据上训练，其中包含「Thanks for watching!」「Subscribe!」以及歌词。调用前务必先做 VAD 门控。
- **`condition_on_previous_text` 级联。** 一次幻觉会污染后续所有窗口。除非你需要跨块的流畅性，否则设为 `False`。
- **短片段填充。** 一段 2 秒的片段被填充到 30 秒，可能会在尾部的静音中产生幻觉。使用 `pad=False` 或做 VAD 门控。
- **错误的梅尔统计量。** 使用 librosa 的梅尔特征而非 Whisper 的，会产生近乎随机的输出。请使用 `whisper.audio.log_mel_spectrogram`。

## 交付物

保存为 `outputs/skill-whisper-tuner.md`。为某个给定领域设计一条 Whisper 微调或推理流水线。

## 练习

1. **简单。** 运行 `code/main.py`。它会对一个 Whisper 风格的提示词分词，计算解码后的形状预算，并打印一段 10 分钟片段的分块计划。
2. **中等。** 安装 `faster-whisper`，转录一段 10 分钟的播客，并与人工转录文本对比 WER。试试 `language="auto"` 与强制 `language="en"` 的区别。
3. **困难。** 使用 HF 的 `datasets`，挑一种 Whisper 表现吃力的语言（例如乌尔都语），用 LoRA 在 2 小时数据上微调 Medium 共 2 个 epoch，并报告 WER 的变化量。

## 关键术语

| 术语 | 人们常说 | 实际含义 |
|------|-----------------|-----------------------|
| 30 秒窗口 | Whisper 的限制 | 硬性输入上限；更长的音频需分块。 |
| SOT | 转录起始（Start-of-transcript） | `<\|startoftranscript\|>` 启动解码器提示词。 |
| 时间戳 token | 时间对齐 | 每 0.02 秒的偏移量都是 51k 词表中的一个特殊 token。 |
| Turbo | 快速变体 | 4 层解码器，快 8 倍，WER 退化小于 1%。 |
| WhisperX | 长音频封装层 | VAD + Whisper + wav2vec 对齐 + 说话人分离。 |
| LoRA 微调 | 高效微调 | 给注意力加上低秩适配器；只训练约 0.3% 的参数。 |
| 幻觉 | 沉默的失败 | Whisper 从噪声/静音中生成流畅的英文。 |

## 延伸阅读

- [Radford et al. (2022). Whisper 论文](https://arxiv.org/abs/2212.04356) —— 原始架构与训练配方。
- [OpenAI (2024). Whisper Large-v3-turbo 发布](https://github.com/openai/whisper/discussions/2363) —— 4 层解码器，8 倍加速。
- [Bain et al. (2023). WhisperX](https://arxiv.org/abs/2303.00747) —— 长音频、词级对齐、说话人分离。
- [Systran —— faster-whisper 仓库](https://github.com/SYSTRAN/faster-whisper) —— 基于 CTranslate2，快 4 倍。
- [HuggingFace —— Whisper 微调教程](https://huggingface.co/blog/fine-tune-whisper) —— 标准的 LoRA / 全量微调演练。
