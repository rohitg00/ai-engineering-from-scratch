# 音频语言模型-Qwen 2.5-Omni、音频Flamingo、GPT-4 o音频

> 2026音频语言模型的原因超过语音+环境声音+音乐。Qwen2.5-Omni-7 B匹配MMAU-Pro上的GPT-4 o音频。音频火烈鸟下击败双子座2.5临上LongAudioBench。开放和封闭之间的差距基本上是封闭的-除了在多音频任务中，每个人都是随机的。

** 类型：** 学习
** 语言：** Python
** 先决条件：** 阶段6 · 04（ASB）、阶段12 · 03（视觉语言模型）、阶段7 · 10（音频变形金刚）
** 时间：** ~45分钟

## 问题

您有5秒的音频：狗叫，有人大喊“停！””，然后就安静了。有用的问题跨越多个轴：

- ** 抄写。**“说了什么？“-ASC领地。
- ** 语义推理。**“那个人有危险吗？“-需要共同理解吠叫+喊叫+沉默。
- ** 音乐推理。**“什么乐器演奏旋律？"
- ** 长音频检索。**“在这场90分钟的讲座中，讲师在哪里解释了梯度下降？"

只需一个提示即可回答所有这些问题的单个模型是 ** 音频语言模型 **（LALM /ILM）。与纯粹的ASB不同：LALM生成自由形式的自然语言答案，而不仅仅是成绩单。

## 概念

![Audio-language model: audio encoder + projector + LLM decoder](../assets/alm-architecture.svg)

### 三组分模板

每辆2026 LALM都有相同的骨架：

1. ** 音频编码器。** Whisper编码器·BEAT· CLAP · WavLM ·或每个型号的自定义编码器。
2. ** 投影仪。**线性或MLP将音频编码器功能桥入LLM的令牌嵌入空间。
3. ** 法学硕士 ** Llama / Qwen /Gemma解码器。接受交错文本+音频标记;生成文本。

培训：

- ** 第一阶段。**冻结编码器+ LLM;火车投影仪仅适用于ASO/字幕数据。
- ** 第二阶段。** Full / LoRA对遵循描述的音频任务（QA、推理、音乐理解）进行微调。
- ** 第3阶段（可选）。**声音输入/声音输出添加了语音解码器。Qwen 2.5-Omni和AF 3-Chat可以做到这一点。

### 2026年模型地图

| 模型 | 骨干 | 音频编码器 | 输出模态 | 接入 |
|-------|----------|---------------|-----------------|--------|
| Qwen2.5-Omni-7B | Qwen2.5-7B | 定制+耳语 | 文本+语音 | Apache-2.0 |
| Qwen 3-Omni | Qwen 3 | 自定义 | 文本+语音 | Apache-2.0 |
| 音频火烈鸟3 | Qwen 2 | AF-CLAP | 文本 | NVIDIA非商业 |
| 音频火烈鸟下一步 | Qwen 2 | AF-CLAP v2 | 文本 | NVIDIA非商业 |
| 萨蒙 | Vicuna | 耳语+节拍 | 文本 | Apache-2.0 |
| LTU / LTU-AS | 美洲驼 | CAV-MAE | 文本 | Apache-2.0 |
| Gama | 美洲驼 | AST + Q-Former | 文本 | Apache-2.0 |
| Gemini 2.5 Flash/Pro（已关闭） | 双子座 | 专有 | 文本+语音 | API |
| GPT-4 o音频（已关闭） | GPT-4o | 专有 | 文本+语音 | API |

### 基准现实检查（2026）

**MMAU-Pro。** 1800对QA，涵盖语音/声音/音乐/混音。包括多音频子集。

| 模型 | 整体 | 讲话 | 声音 | 音乐 | 多音频 |
|-------|---------|--------|-------|-------|-------------|
| 双子座2.5 Pro | ~60% | 73.4% | 51.9% | 百分之六十四点九 | ~22% |
| 双子座2.5 Flash | ~57% | 73.4% | 百分之五十点五 | 百分之六十四点九 | 21.2% |
| GPT-4 o音频 | 52.5% | - | - | - | 26.5% |
| Qwen2.5-Omni-7B | 52.2% | 57.4% | 47.6% | 61.5% | ~20% |
| 音频火烈鸟3 | ~54% | - | - | - | - |
| 音频火烈鸟下一步 | LongAudioBench上的SOTA | - | - | - | - |

** 多音频专栏对每个人来说都是诅咒。** 4选项多项选择的随机机会= 25%;大多数模特的得分在此附近。LALM仍然很难比较两个剪辑。

### 2026年LALM有用的地方

- ** 呼叫中心录音的合规性审计。**“代理人提到了所需的披露吗？"
- ** 无障碍。**向聋人用户描述声音事件（而不仅仅是转录）。
- ** 内容审核。**检测暴力语言+威胁语气+背景背景。
- ** 播客/会议章节。**语义总结，而不仅仅是说话者转身。
- ** 音乐目录分析。**“查找所有B部分关键更改的曲目。"

### 在它们（尚未）没有用的地方

- 细粒度的音乐理论（和弦级以下）。
- 长时间对话中说话者归因的推理（超过10分钟会降级）。
- 多音频比较（22-26%略高于随机）。
- 实时流推理（大多数是离线批量推理）。

## 建设党

### 第1步：查询Qwen 2.5-Omni

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

### 第2步：投影仪图案

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

就是这样。投影仪通常是1-3层线性层。在ASB对上训练它（音频-文字记录）是第一阶段的借口任务。

### 第3步：对MMAU / LongAudioBench进行基准测试

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

按类别（语音/声音/音乐/多音频）分别报告。总数字隐藏了模型失败的地方。

## 使用它

| 任务 | 2026年选秀 |
|------|-----------|
| 自由形式的音频QA（开放） | Qwen2.5-Omni-7B |
| 最佳在长音频上打开 | 音频火烈鸟下一步 |
| 最好关闭 | 双子座2.5 Pro |
| 语音输入/语音输出代理 | Qwen 2.5-Omni或GPT-4 o音频 |
| 音乐推理 | 音频火烈鸟3或2（音乐专业AF-CLAP） |
| 呼叫中心审计 | Gemini 2.5 Pro，通过API，在保单文档上使用RAG |

## 陷阱

- ** 对多音频过度信任。**如果您的任务需要“哪个剪辑有X”，那么随机机会级别的性能是真实的。
- ** 长音频降级。**过去10分钟，大多数模特的发言者归因中断。先写日记（第6课），然后总结。
- ** 沉默中的幻觉。**使用Whisper编码器的LALM继承了相同的Whisper风格问题。VAR门。
- ** 樱桃采摘基准。**供应商博客文章强调了最佳情况类别。您自己运行MMAU-Pro多音频子集。

## 把它运

另存为“输出/skill-alm-picker.md”。为给定的音频理解任务选择LALM +基准子集+输出模式（文本vs语音）。

## 演习

1. ** 简单。**运行' code/main.py '查看玩具投影仪模式+假LALM路由（音频嵌入、文本令牌）-输出令牌。
2. ** 中等。**在100个MMAU-Pro语音项目上获得Qwen2.5-Omni-7 B。与报纸报道的数字相比。
3. ** 很难。**建立最低限度的音频字幕基线：BEAT编码器+ 2层投影仪+冷冻Llama-3.2-1B。仅对AudioCaps上的投影仪进行微调。与Clotho-AQA上的SALMONN进行比较。

## 关键术语

| Term | 别人怎么说 | 它实际上意味着什么 |
|------|-----------------|-----------------------|
| LALM | 音频聊天GPT | 音频编码器+投影仪+ LLM解码器。 |
| 投影仪 | 适配器 | 小型MLP将音频功能映射到LLM嵌入空间。 |
| MMAU | 基准 | 涵盖语音、声音、音乐的10，000个音频QA对。 |
| MMAU-Pro | 更硬的MMAU | 1800个多音频/推理较多的问题。 |
| 长音频长凳 | 长形式评估 | 带有语义查询的多分钟剪辑。 |
| 声音输入/声音输出 | 母语 | 模型吸收语音并发出语音，无需文本绕道。 |

## 进一步阅读

- [Chu等人（2024）。Qwen 2-音频]（https：//arxiv.org/abs/2407.10759）-参考架构。
- [阿里巴巴（2025）。Qwen2.5-Omni]（https：//huggingface.co/Qwen/Qwen2.5-Omni-7B）-speech-in-speech-out。
- [英伟达（2025）。音频火烈鸟3]（https：//arxiv.org/abs/2507.08128）-开放长音频领导者。
- [英伟达（2026）。音频火烈鸟下一步]（https：//arxiv.org/abs/2604.10905）- LongAudioBench SOTA。
- [Tang等人（2023）。SALMONN]（https：//arxiv.org/abs/2310.13289）-双编码器先驱。
- [MMAU-Pro排行榜]（https：//mmaubenchmark.github.io/）- live 2026 rankings.
