# 音频-语言模型 — Qwen2.5-Omni、Audio Flamingo、GPT-4o Audio

> 2026 年的音频-语言模型可以跨语音 + 环境音 + 音乐进行推理。Qwen2.5-Omni-7B 在 MMAU-Pro 上与 GPT-4o Audio 相当。Audio Flamingo Next 在 LongAudioBench 上超过 Gemini 2.5 Pro。开源与闭源之间的差距基本已经消除——唯独在多音频任务上例外，所有模型在该项上都接近随机水平。

**Type:** Learn
**Languages:** Python
**Prerequisites:** Phase 6 · 04 (ASR)、Phase 12 · 03 (Vision-Language Models)、Phase 7 · 10 (Audio Transformers)
**Time:** 约 45 分钟

## 问题所在

你有 5 秒的音频：狗叫声，有人喊"停下！"，然后是安静。有用的问题横跨多个维度：

- **转录。**"说了什么？"——ASR 的领域。
- **语义推理。**"这个人有危险吗？"——需要联合理解狗叫 + 喊声 + 安静。
- **音乐推理。**"旋律由哪些乐器演奏？"
- **长音频检索。**"在这 90 分钟的讲座中，讲师在哪里讲解了梯度下降？"

用一次提示就能回答所有这些问题的单一模型，就是**音频-语言模型**(LALM / ALM)。它与纯 ASR 不同：LALM 生成自由格式的自然语言答案，而不仅仅是转录文本。

## 核心概念

![Audio-language model: audio encoder + projector + LLM decoder](../assets/alm-architecture.svg)

### 三组件模板

2026 年的每个 LALM 都有相同的骨架：

1. **音频编码器。** Whisper encoder · BEATs · CLAP · WavLM · 或各模型自定义的编码器。
2. **投影器。** 线性层或 MLP,将音频编码器的特征桥接到 LLM 的词元嵌入空间。
3. **LLM。** 基于 Llama / Qwen / Gemma 的解码器。接收交错的文本 + 音频词元；生成文本。

训练：

- **阶段 1。** 冻结编码器 + LLM;仅在 ASR / 描述(captioning)数据上训练投影器。
- **阶段 2。** 在指令遵循类音频任务(QA、推理、音乐理解)上进行全量 / LoRA 微调。
- **阶段 3(可选)。** 语音进 / 语音出需要增加一个语音解码器。Qwen2.5-Omni 和 AF3-Chat 就是这么做的。

### 2026 年模型地图

| 模型 | 主干 | 音频编码器 | 输出模态 | 获取方式 |
|-------|----------|---------------|-----------------|--------|
| Qwen2.5-Omni-7B | Qwen2.5-7B | 自定义 + Whisper | 文本 + 语音 | Apache-2.0 |
| Qwen3-Omni | Qwen3 | 自定义 | 文本 + 语音 | Apache-2.0 |
| Audio Flamingo 3 | Qwen2 | AF-CLAP | 文本 | NVIDIA 非商业许可 |
| Audio Flamingo Next | Qwen2 | AF-CLAP v2 | 文本 | NVIDIA 非商业许可 |
| SALMONN | Vicuna | Whisper + BEATs | 文本 | Apache-2.0 |
| LTU / LTU-AS | Llama | CAV-MAE | 文本 | Apache-2.0 |
| GAMA | Llama | AST + Q-Former | 文本 | Apache-2.0 |
| Gemini 2.5 Flash/Pro (闭源) | Gemini | 专有 | 文本 + 语音 | API |
| GPT-4o Audio (闭源) | GPT-4o | 专有 | 文本 + 语音 | API |

### 基准测试的真实现状 (2026)

**MMAU-Pro。** 1800 个 QA 对，覆盖语音 / 声音 / 音乐 / 混合。包含多音频子集。

| 模型 | 总体 | 语音 | 声音 | 音乐 | 多音频 |
|-------|---------|--------|-------|-------|-------------|
| Gemini 2.5 Pro | ~60% | 73.4% | 51.9% | 64.9% | ~22% |
| Gemini 2.5 Flash | ~57% | 73.4% | 50.5% | 64.9% | 21.2% |
| GPT-4o Audio | 52.5% | — | — | — | 26.5% |
| Qwen2.5-Omni-7B | 52.2% | 57.4% | 47.6% | 61.5% | ~20% |
| Audio Flamingo 3 | ~54% | — | — | — | — |
| Audio Flamingo Next | LongAudioBench SOTA | — | — | — | — |

**多音频列对所有人都很残酷。** 4 选项多项选择的随机概率 = 25%;大多数模型的得分就在这个水平附近。LALM 在比较两段音频片段时仍然力不从心。

### LALM 在 2026 年的有用场景

- **呼叫中心录音的合规审计。**"客服是否提到了要求的免责声明？"
- **无障碍访问。**向听障用户描述声音事件(而不仅是转录)。
- **内容审核。**检测暴力语言 + 威胁性语气 + 背景上下文。
- **播客 / 会议章节划分。**语义摘要，而不仅是说话人轮次。
- **音乐目录分析。**"找出所有 B 段有转调的曲目。"

### 尚(未)能胜任的场景

- 细粒度音乐理论(低于和弦层面)。
- 长对话中的说话人归属推理(超过 10 分钟后性能下降)。
- 多音频比较(22-26% 仅略高于随机水平)。
- 实时流式推理(大多数模型只支持离线批量推理)。

```figure
v4-alm-tokens
```

## 动手构建

### 步骤 1:查询 Qwen2.5-Omni

```python
from transformers import AutoModelForCausalLM, AutoProcessor

processor = AutoProcessor.from_pretrained("Qwen/Qwen2.5-Omni-7B")
model = AutoModelForCausalLM.from_pretrained("Qwen/Qwen2.5-Omni-7B", torch_dtype="auto")

audio, sr = load_wav("clip.wav", sr=16000)
messages = [{
    "role": "user",
    "content": [
        {"type": "audio", "audio": audio},
        {"type": "text", "text": "What sounds do you hear, and what's happening?"},
    ],
}]
inputs = processor.apply_chat_template(messages, tokenize=True, return_tensors="pt")
output = model.generate(**inputs, max_new_tokens=200)
print(processor.decode(output[0], skip_special_tokens=True))
```

### 步骤 2:投影器模式

```python
import torch.nn as nn

class AudioProjector(nn.Module):
    def __init__(self, audio_dim=1280, llm_dim=4096):
        super().__init__()
        self.down = nn.Linear(audio_dim, llm_dim)
        self.act = nn.GELU()
        self.up = nn.Linear(llm_dim, llm_dim)

    def forward(self, audio_features):
        return self.up(self.act(self.down(audio_features)))
```

就这么简单。投影器通常是 1-3 个线性层。在 ASR 配对(音频 → 转录文本)上训练它，就是阶段 1 的预训练任务。

### 步骤 3:在 MMAU / LongAudioBench 上做基准评测

```python
from datasets import load_dataset
mmau = load_dataset("MMAU/MMAU-Pro")

correct = 0
for item in mmau["test"]:
    answer = call_model(item["audio"], item["question"], item["choices"])
    if answer == item["correct_choice"]:
        correct += 1
print(f"Accuracy: {correct / len(mmau['test']):.3f}")
```

按类别(语音 / 声音 / 音乐 / 多音频)分别报告结果。聚合数字会掩盖模型的失败点。

## 实际使用

| 任务 | 2026 年首选 |
|------|-----------|
| 自由格式音频 QA(开源) | Qwen2.5-Omni-7B |
| 长音频最佳开源 | Audio Flamingo Next |
| 最佳闭源 | Gemini 2.5 Pro |
| 语音进 / 语音出智能体 | Qwen2.5-Omni 或 GPT-4o Audio |
| 音乐推理 | Audio Flamingo 3 或 2(音乐专用的 AF-CLAP) |
| 呼叫中心审计 | Gemini 2.5 Pro(经 API),配合针对你的政策文档的 RAG |

## 常见陷阱

- **对多音频的过度信任。** 如果你的任务需要"哪段音频含有 X",随机概率级别的性能是真实存在的。
- **长音频性能退化。** 超过 10 分钟后，大多数模型的说话人归属会失效。先做说话人分离(第 6 课)，再做摘要。
- **在静音上产生幻觉。** 这是使用 Whisper 编码器的 LALM 继承的 Whisper 式老问题。用 VAD 做门槛过滤。
- **基准挑选性引用。** 厂商博客会突出展示最优类别的成绩。自己跑一遍 MMAU-Pro 多音频子集。

## 上线交付

保存为 `outputs/skill-alm-picker.md`。针对给定的音频理解任务，选择 LALM + 基准子集 + 输出模态(文本 vs 语音)。

## 练习

1. **简单。** 运行 `code/main.py`,观察一个玩具投影器模式 + 对(音频嵌入， 文本词元) → 输出词元的伪 LALM 路由。
2. **中等。** 在 100 个 MMAU-Pro 语音题目上评测 Qwen2.5-Omni-7B。与论文报告的数字进行比较。
3. **困难。** 构建一个最小化的音频描述基线：BEATs 编码器 + 2 层投影器 + 冻结的 Llama-3.2-1B。仅在 AudioCaps 上微调投影器。在 Clotho-AQA 上与 SALMONN 比较。

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|-----------------|-----------------------|
| LALM | 音频版 ChatGPT | 音频编码器 + 投影器 + LLM 解码器。 |
| Projector | 适配器 | 将音频特征映射到 LLM 嵌入空间的小型 MLP。 |
| MMAU | 那个基准 | 跨语音、声音、音乐的 10k 个音频 QA 对。 |
| MMAU-Pro | 更难的 MMAU | 1800 道多音频 / 重推理的问题。 |
| LongAudioBench | 长音频评测 | 带语义查询的数分钟长片段。 |
| 语音进 / 语音出 | 语音原生 | 模型直接接收语音并输出语音，不经过文本中转。 |

## 延伸阅读

- [Chu et al. (2024). Qwen2-Audio](https://arxiv.org/abs/2407.10759) — 参考架构。
- [Alibaba (2025). Qwen2.5-Omni](https://huggingface.co/Qwen/Qwen2.5-Omni-7B) — 语音进语音出。
- [NVIDIA (2025). Audio Flamingo 3](https://arxiv.org/abs/2507.08128) — 开源长音频的领跑者。
- [NVIDIA (2026). Audio Flamingo Next](https://arxiv.org/abs/2604.10905) — LongAudioBench SOTA。
- [Tang et al. (2023). SALMONN](https://arxiv.org/abs/2310.13289) — 双编码器先驱。
- [MMAU-Pro 排行榜](https://mmaubenchmark.github.io/) — 2026 年实时排名。