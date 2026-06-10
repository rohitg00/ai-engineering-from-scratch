# 10 · 音频-语言模型 —— Qwen2.5-Omni、Audio Flamingo、GPT-4o Audio

> 2026 年的音频-语言模型能够对语音、环境声以及音乐进行推理。Qwen2.5-Omni-7B 在 MMAU-Pro 上与 GPT-4o Audio 持平。Audio Flamingo Next 在 LongAudioBench 上击败了 Gemini 2.5 Pro。开源与闭源之间的差距基本已被抹平——唯独在多音频任务上例外，在那里所有模型都接近随机水平。

**类型：** 学习
**语言：** Python
**前置：** 阶段 6 · 04（ASR）、阶段 12 · 03（视觉-语言模型）、阶段 7 · 10（音频 Transformer）
**时长：** 约 45 分钟

## 问题所在

你手上有 5 秒音频：狗叫声、有人喊「停！」，然后是一片寂静。围绕它能提出的有用问题横跨多个维度：

- **转录（Transcription）。**「说了什么？」——属于 ASR 的范畴。
- **语义推理（Semantic reasoning）。**「这个人是否处于危险中？」——需要对狗叫 + 呼喊 + 寂静进行联合理解。
- **音乐推理（Music reasoning）。**「哪些乐器在演奏主旋律？」
- **长音频检索（Long-audio retrieval）。**「在这段 90 分钟的讲座里，讲师在哪里讲解了梯度下降？」

能用单个提示词回答上述所有问题的单一模型，就是**音频-语言模型（audio-language model，LALM / ALM）**。它与纯 ASR 的区别在于：LALM 产出自由形式的自然语言答案，而不仅仅是转录文本。

## 核心概念

〔图：音频-语言模型架构——音频编码器 + 投影器 + LLM 解码器〕

### 三组件模板

每一个 2026 年的 LALM 都具有相同的骨架：

1. **音频编码器（Audio encoder）。** Whisper 编码器 · BEATs · CLAP · WavLM · 或各模型自定义的编码器。
2. **投影器（Projector）。** 线性层或 MLP，把音频编码器的特征桥接进 LLM 的词元嵌入空间。
3. **LLM。** 基于 Llama / Qwen / Gemma 的解码器。接收交错的文本 + 音频词元，生成文本。

训练：

- **阶段 1。** 冻结编码器 + LLM；仅在 ASR / 字幕数据上训练投影器。
- **阶段 2。** 在指令遵循类音频任务（问答、推理、音乐理解）上进行全量 / LoRA 微调。
- **阶段 3（可选）。** 语音输入 / 语音输出，额外增加一个语音解码器。Qwen2.5-Omni 和 AF3-Chat 都采用了这种做法。

### 2026 年模型版图

| 模型 | 主干 | 音频编码器 | 输出模态 | 获取方式 |
|-------|----------|---------------|-----------------|--------|
| Qwen2.5-Omni-7B | Qwen2.5-7B | 自定义 + Whisper | 文本 + 语音 | Apache-2.0 |
| Qwen3-Omni | Qwen3 | 自定义 | 文本 + 语音 | Apache-2.0 |
| Audio Flamingo 3 | Qwen2 | AF-CLAP | 文本 | NVIDIA 非商用 |
| Audio Flamingo Next | Qwen2 | AF-CLAP v2 | 文本 | NVIDIA 非商用 |
| SALMONN | Vicuna | Whisper + BEATs | 文本 | Apache-2.0 |
| LTU / LTU-AS | Llama | CAV-MAE | 文本 | Apache-2.0 |
| GAMA | Llama | AST + Q-Former | 文本 | Apache-2.0 |
| Gemini 2.5 Flash/Pro（闭源） | Gemini | 专有 | 文本 + 语音 | API |
| GPT-4o Audio（闭源） | GPT-4o | 专有 | 文本 + 语音 | API |

### 基准现状核查（2026）

**MMAU-Pro。** 1800 组问答，覆盖语音 / 声音 / 音乐 / 混合。包含多音频子集。

| 模型 | 总体 | 语音 | 声音 | 音乐 | 多音频 |
|-------|---------|--------|-------|-------|-------------|
| Gemini 2.5 Pro | ~60% | 73.4% | 51.9% | 64.9% | ~22% |
| Gemini 2.5 Flash | ~57% | 73.4% | 50.5% | 64.9% | 21.2% |
| GPT-4o Audio | 52.5% | — | — | — | 26.5% |
| Qwen2.5-Omni-7B | 52.2% | 57.4% | 47.6% | 61.5% | ~20% |
| Audio Flamingo 3 | ~54% | — | — | — | — |
| Audio Flamingo Next | LongAudioBench 上 SOTA | — | — | — | — |

**多音频这一列对所有模型而言都很难堪。** 四选一选择题的随机命中率为 25%；大多数模型的得分就在这附近徘徊。LALM 在比较两段音频片段这件事上仍然力不从心。

### 2026 年 LALM 的有用场景

- **呼叫中心录音的合规审计。**「客服是否提到了规定的免责声明？」
- **无障碍支持。** 向聋人用户描述声音事件（而不仅仅是转录）。
- **内容审核。** 检测暴力语言 + 威胁性语气 + 背景上下文。
- **播客 / 会议章节划分。** 语义摘要，而不仅仅是说话人轮次。
- **音乐曲库分析。**「找出所有 B 段有转调的曲目。」

### 它们（目前）尚不擅长的场景

- 细粒度乐理（和弦级别以下）。
- 长对话中按说话人归属的推理（超过 10 分钟即退化）。
- 多音频比较（22–26% 仅略高于随机）。
- 实时流式推理（大多数是离线批量推理）。

## 动手构建

### 步骤 1：查询 Qwen2.5-Omni

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

### 步骤 2：投影器范式

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

就这么简单。投影器通常是 1–3 个线性层。在 ASR 配对数据（音频 → 转录）上训练它，就是阶段 1 的预备任务（pretext task）。

### 步骤 3：在 MMAU / LongAudioBench 上做基准测试

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

按类别（语音 / 声音 / 音乐 / 多音频）分别上报结果。汇总数字会掩盖模型究竟在哪里出错。

## 实际运用

| 任务 | 2026 年的选择 |
|------|-----------|
| 自由形式音频问答（开源） | Qwen2.5-Omni-7B |
| 长音频上的最佳开源模型 | Audio Flamingo Next |
| 最佳闭源模型 | Gemini 2.5 Pro |
| 语音输入 / 语音输出智能体 | Qwen2.5-Omni 或 GPT-4o Audio |
| 音乐推理 | Audio Flamingo 3 或 2（专精音乐的 AF-CLAP） |
| 呼叫中心审计 | 通过 API 调用 Gemini 2.5 Pro，并对你的政策文档做 RAG |

## 常见陷阱

- **过度信任多音频结果。** 如果你的任务需要判断「哪段片段含有 X」，那么随机水平的表现是真实存在的。
- **长音频退化。** 超过 10 分钟后，大多数模型的说话人归属会失效。先做说话人分离（第 6 课），再做摘要。
- **静音上的幻觉。** 使用 Whisper 编码器的 LALM 继承了同样的 Whisper 式问题。用 VAD 做门控。
- **基准结果的精挑细选。** 厂商博客文章只突出最理想的类别。请自己跑一遍 MMAU-Pro 的多音频子集。

## 交付成果

保存为 `outputs/skill-alm-picker.md`。针对给定的音频理解任务，挑选 LALM + 基准子集 + 输出模态（文本还是语音）。

## 练习

1. **简单。** 运行 `code/main.py`，观察一个玩具级投影器范式 + 假 LALM 将（音频嵌入、文本词元）路由 → 输出词元的过程。
2. **中等。** 在 100 条 MMAU-Pro 语音条目上为 Qwen2.5-Omni-7B 打分。与论文报告的数字进行对比。
3. **困难。** 构建一个最小的音频字幕基线：BEATs 编码器 + 2 层投影器 + 冻结的 Llama-3.2-1B。只在 AudioCaps 上微调投影器。在 Clotho-AQA 上与 SALMONN 对比。

## 关键术语

| 术语 | 人们口中的说法 | 实际含义 |
|------|-----------------|-----------------------|
| LALM | 音频版 ChatGPT | 音频编码器 + 投影器 + LLM 解码器。 |
| Projector（投影器） | 适配器 | 把音频特征映射进 LLM 嵌入空间的小型 MLP。 |
| MMAU | 那个基准 | 涵盖语音、声音、音乐的 1 万组音频问答。 |
| MMAU-Pro | 更难的 MMAU | 1800 道多音频 / 重推理类问题。 |
| LongAudioBench | 长篇评测 | 配有语义查询的数分钟级片段。 |
| Voice-in / voice-out（语音进 / 语音出） | 语音原生 | 模型摄入语音并直接输出语音，不绕道文本。 |

## 延伸阅读

- [Chu et al. (2024). Qwen2-Audio](https://arxiv.org/abs/2407.10759) —— 参考架构。
- [Alibaba (2025). Qwen2.5-Omni](https://huggingface.co/Qwen/Qwen2.5-Omni-7B) —— 语音进-语音出。
- [NVIDIA (2025). Audio Flamingo 3](https://arxiv.org/abs/2507.08128) —— 开源长音频领跑者。
- [NVIDIA (2026). Audio Flamingo Next](https://arxiv.org/abs/2604.10905) —— LongAudioBench SOTA。
- [Tang et al. (2023). SALMONN](https://arxiv.org/abs/2310.13289) —— 双编码器先驱。
- [MMAU-Pro 排行榜](https://mmaubenchmark.github.io/) —— 2026 年实时榜单。
