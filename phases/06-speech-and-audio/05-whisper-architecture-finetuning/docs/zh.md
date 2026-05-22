# Whisper — 架构与微调

> Whisper 是一个30秒窗口的Transformer编码器-解码器，在68万小时的多语言弱监督音频-文本对上训练而成。单一架构，多任务，对99种语言鲁棒。2026年的ASR参考基准。

**类型：** 构建
**语言：** Python
**前置知识：** 第六阶段·04（ASR），第五阶段·10（注意力机制），第七阶段·05（完整Transformer）
**时长：** ~75分钟

## 问题

Whisper 由 OpenAI 于2022年9月发布，是第一个以商品形式推出的ASR模型：粘贴音频，获取文本，支持99种语言，对噪声鲁棒，可在笔记本电脑上运行。到2024年，OpenAI 已推出 Large-v3 和 Turbo 变体；到2026年，Whisper 已成为从播客转录到语音助手再到YouTube字幕等所有任务的默认基线。

但 Whisper 不是一个可以永久作为黑盒使用的流水线。领域偏移会使其失效——技术术语、说话人口音、专有名词、短片段、静音。你需要知道：

1. 它内部实际上是什么。
2. 如何正确向其提供分块、流式或长音频。
3. 何时微调以及如何微调。

## 概念

![Whisper 编码器-解码器、任务、分块推理、微调](../assets/whisper.svg)

**架构。** 标准Transformer编码器-解码器。

- 输入：30秒对数梅尔频谱图，80个梅尔滤波器，10ms跳跃 → 3000帧。较短的片段进行零填充，较长的片段进行分块。
- 编码器：卷积下采样（步长2）+ `N`个Transformer块。对于Large-v3：32层，1280维，20个注意力头。
- 解码器：`N`个Transformer块，包含因果自注意力 + 与编码器输出的交叉注意力。大小与编码器相同。
- 输出：基于51,865个标记的词汇表的BPE（字节对编码）标记。

Large-v3有15.5亿参数。Turbo使用4层解码器（从32层减少），将延迟降低8倍，而词错误率（WER）增加不到1%。

**提示格式。** Whisper 是一个多任务模型，通过解码器提示中的特殊标记进行控制：

```
<|startoftranscript|><|en|><|transcribe|><|notimestamps|> Hello world.<|endoftext|>
```

- `<|en|>` — 语言标签；强制翻译与转录行为。
- `<|transcribe|>` 或 `<|translate|>` — 从任何语言输入翻译成英文输出，或逐字转录。
- `<|notimestamps|>` — 跳过词级时间戳（更快）。

提示使得一个模型可以执行多个任务。将 `<|en|>` 改为 `<|fr|>` 即可转录法语。

**30秒窗口。** 所有内容都固定在30秒。较长的片段需要分块；较短的片段进行填充。窗口本身不支持流式传输——这就是 WhisperX、Whisper-Streaming 和 faster-whisper 存在的原因。

**对数梅尔归一化。** `(log_mel - mean) / std`，其中统计量来自Whisper自己的训练语料库。你*必须*使用 Whisper 的预处理（`whisper.audio.log_mel_spectrogram`），而不是 `librosa.feature.melspectrogram`。

### 2026年的变体

| 变体 | 参数量 | 延迟（A100） | 词错误率（LibriSpeech-clean） |
|---------|--------|----------------|------------------------|
| Tiny | 39M | 1× 实时 | 5.4% |
| Base | 74M | 1× | 4.1% |
| Small | 244M | 1× | 3.0% |
| Medium | 769M | 1× | 2.7% |
| Large-v3 | 1.55B | 2× | 1.8% |
| Large-v3-turbo | 809M | 8× | 1.58% |
| Whisper-Streaming (2024) | 1.55B | 流式 | 2.0% |

### 微调

2026年的标准工作流程：

1. 收集10–100小时的目标领域音频及其对齐的转录文本。
2. 使用 `generate_with_loss` 回调运行 `transformers.Seq2SeqTrainer`。
3. 参数高效：在注意力层的 `q_proj`、`k_proj`、`v_proj` 上应用 LoRA（低秩适应），可将GPU内存减少4倍，且词错误率增加小于0.3。
4. 如果音频数据少于10小时，冻结编码器。仅微调解码器。
5. 使用 Whisper 自己的分词器和提示格式；切勿更换分词器。

社区结果：在20小时的医疗口述数据上微调Medium，使医疗词汇的词错误率从12%降至4.5%。在4小时的冰岛语数据上微调Turbo，使词错误率从18%降至6%。

## 构建

### 第一步：开箱即用运行 Whisper

```python
import whisper
model = whisper.load_model("large-v3-turbo")
result = model.transcribe(
    "clip.wav",
    language="en",
    task="transcribe",
    temperature=0.0,
    condition_on_previous_text=False,  # 防止失控重复
)
print(result["text"])
for seg in result["segments"]:
    print(f"[{seg['start']:.2f}–{seg['end']:.2f}] {seg['text']}")
```

你应该始终覆盖的关键默认值：`temperature=0.0`（采样默认为 0.0 → 0.2 → 0.4 … 回退链）、`condition_on_previous_text=False`（防止级联幻觉问题）以及 `no_speech_threshold=0.6`（静音检测）。

### 第二步：分块长音频

```python
# whisperx 是2026年用于长音频且带词级时间戳的参考实现
import whisperx
model = whisperx.load_model("large-v3-turbo", device="cuda", compute_type="float16")
segments = model.transcribe("1hour.mp3", batch_size=16, chunk_size=30)
```

WhisperX 增加了（1）Silero VAD（语音活动检测）门控，（2）通过 wav2vec 2.0 进行词级对齐，（3）通过 `pyannote.audio` 进行说话人日记化。这是2026年生产转录的主力。

### 第三步：使用 LoRA 进行微调

```python
from transformers import WhisperForConditionalGeneration, WhisperProcessor
from peft import LoraConfig, get_peft_model

model = WhisperForConditionalGeneration.from_pretrained("openai/whisper-large-v3-turbo")
lora = LoraConfig(
    r=16, lora_alpha=32, target_modules=["q_proj", "v_proj"],
    lora_dropout=0.1, bias="none", task_type="SEQ_2_SEQ_LM",
)
model = get_peft_model(model, lora)
# model.print_trainable_parameters()  -> ~300万可训练 / 8.09亿总参
```

然后使用标准的 Trainer 循环。每1000步保存一次检查点。在留出集上使用词错误率进行评估。

### 第四步：检查每层学到了什么

```python
# 在解码过程中获取交叉注意力权重，观察解码器关注的内容。
with torch.inference_mode():
    out = model.generate(
        input_features=features,
        return_dict_in_generate=True,
        output_attentions=True,
    )
# out.cross_attentions: 层 × 注意力头 × 解码步 × 源长度
```

使用热力图进行可视化——你会看到解码器步进扫描编码器帧时形成对角线对齐。该对角线就是 Whisper 对词时间戳的理解。

## 使用

2026年的技术栈：

| 场景 | 选择 |
|-----------|------|
| 通用英语，离线 | 通过 `whisperx` 使用 Large-v3-turbo |
| 移动端 / 边缘设备 | 量化的 Whisper-Tiny（int8）或 Moonshine |
| 多语言长音频 | 通过 `whisperx` 使用 Large-v3 + 说话人日记化 |
| 低资源语言 | 使用 LoRA 微调 Medium 或 Turbo |
| 流式传输（2秒延迟） | Whisper-Streaming 或 Parakeet-TDT |
| 词级时间戳 | WhisperX（通过 wav2vec 2.0 强制对齐） |

`faster-whisper`（CTranslate2 后端）是2026年最快的 CPU+GPU 推理运行时——比原生版本快4倍，输出完全相同。

## 2026年仍然存在的陷阱

- **在静音处产生幻觉文本。** Whisper 在字幕上训练，会包含“感谢观看！”、“订阅！”、歌词。调用前务必进行 VAD 门控。
- **`condition_on_previous_text` 级联。** 一个幻觉会污染后续窗口。设置为 `False`，除非你需要跨分块的流畅性。
- **短片段填充。** 一个2秒的片段填充到30秒可能会在尾部静音处产生幻觉。使用 `pad=False` 或 VAD 门控。
- **错误的梅尔统计量。** 使用 librosa 的梅尔频谱图而不是 Whisper 的会产生接近随机的结果。使用 `whisper.audio.log_mel_spectrogram`。

## 交付

保存为 `outputs/skill-whisper-tuner.md`。为特定领域设计 Whisper 微调或推理流水线。

## 练习

1. **简单。** 运行 `code/main.py`。它会分词一个 Whisper 风格的提示，计算解码形状预算，并打印一个10分钟片段的分块计划。
2. **中等。** 安装 `faster-whisper`，转录一个10分钟的播客，与人工转录文本比较词错误率。尝试 `language="auto"` 与强制 `language="en"` 的对比。
3. **困难。** 使用 Hugging Face 的 `datasets`，选择一个 Whisper 表现不佳的语言（例如乌尔都语），在2小时数据上用 LoRA 微调 Medium 2个 epoch，并报告词错误率的变化。

## 关键术语

| 术语 | 常用说法 | 实际含义 |
|------|-----------------|-----------------------|
| 30秒窗口 | Whisper 的限制 | 硬性输入上限；对应长音频进行分块。 |
| SOT | 转录起始标记 | `<|startoftranscript|>` 启动解码器提示。 |
| 时间戳标记 | 时间对齐 | 每0.02秒的偏移是5.1万词汇表中的特殊标记。 |
| Turbo | 快速变体 | 4层解码器，速度提升8倍，词错误率增加不到1%。 |
| WhisperX | 长音频包装器 | VAD + Whisper + wav2vec 对齐 + 说话人日记化。 |
| LoRA 微调 | 高效微调 | 向注意力层添加低秩适配器；训练约0.3%的参数。 |
| 幻觉 | 静默失败 | Whisper 从噪声/静音中生成流畅的英文。 |

## 进一步阅读

- [Radford 等人 (2022). Whisper 论文](https://arxiv.org/abs/2212.04356) — 原始架构和训练方法。
- [OpenAI (2024). Whisper Large-v3-turbo 发布](https://github.com/openai/whisper/discussions/2363) — 4层解码器，8倍加速。
- [Bain 等人 (2023). WhisperX](https://arxiv.org/abs/2303.00747) — 长音频、词级对齐、说话人日记化。
- [Systran — faster-whisper 仓库](https://github.com/SYSTRAN/faster-whisper) — 基于 CTranslate2，速度快4倍。
- [HuggingFace — Whisper 微调教程](https://huggingface.co/blog/fine-tune-whisper) — 标准 LoRA / 全量微调实践指南。