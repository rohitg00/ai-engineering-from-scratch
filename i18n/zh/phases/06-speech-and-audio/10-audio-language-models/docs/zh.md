# 音频语言模型  Qwen2.5-Omni,音频弗拉明戈,GPT-4o音频

> 2026年音频语言模型推理语音+环境声音+音乐.Qwen2.5-Omni-7B与MMAU-Pro的GPT-4o音频相匹配.Audio Flamingo Next在LongAudioBench上超过了Gemini 2.5 Pro.开放和关闭之间的差距基本上是关闭的除了多音频任务,每个人都几乎是随机的.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 04 (ASR), Phase 12 · 03 (Vision-Language Models), Phase 7 · 10 (Audio Transformers)
**Time:** ~45 minutes

## 问题

您有5秒的音频:狗吠叫,有人喊"停止!",然后沉默.

- **Transcription.**"有什么说?" 阿斯里亚地区.
- **Semantic reasoning.**"人是否处于危险之中?" 需要共同理解叫+喊叫+沉默.
- **Music reasoning.**"什么乐器演奏这首歌曲?"
- **Long-audio retrieval.**"在这90分钟的讲座中,教师在哪里解释了梯度下降?"

一个单个模型,只能用一个提示来回答所有这些问题,**audio-language model**单独与纯ASR:LALM产生自由形式的自然语言答案,而不是仅仅是转录.

## 概念

![Audio-language model: audio encoder + projector + LLM decoder](../assets/alm-architecture.svg)

### 三个组成部分的模板

每个2026年的LALM都具有相同的骨:

1. **Audio encoder.**语编码器 · BEATs · CLAP · WavLM ·或每款车型的定制编码器.
2. **Projector.**线性或MLP桥接音频编码器功能在LLM的代币嵌入空间.
3. **LLM.**基于Llama/Qwen/Gemma的解码器. 接收交织的文本 + 音频代币;生成文本.

培训:

- **Stage 1.**结编码器 + LLM;仅使用ASR/字幕数据的火车投影机.
- **Stage 2.**完成/LoRA细节调整后续指令的音频任务 (QA,推理,音乐理解).
- **Stage 3 (optional).**语音输入/发音增加语音解码器. Qwen2.5Omni和AF3聊天这样做.

### 2026年模型地图

| Model | Backbone | Audio encoder | Output modality | Access |
|-------|----------|---------------|-----------------|--------|
| Qwen2.5-Omni-7B | Qwen2.5-7B | Custom + Whisper | text + speech | Apache-2.0 |
| Qwen3-Omni | Qwen3 | Custom | text + speech | Apache-2.0 |
| Audio Flamingo 3 | Qwen2 | AF-CLAP | text | NVIDIA non-commercial |
| Audio Flamingo Next | Qwen2 | AF-CLAP v2 | text | NVIDIA non-commercial |
| SALMONN | Vicuna | Whisper + BEATs | text | Apache-2.0 |
| LTU / LTU-AS | Llama | CAV-MAE | text | Apache-2.0 |
| GAMA | Llama | AST + Q-Former | text | Apache-2.0 |
| Gemini 2.5 Flash/Pro (closed) | Gemini | proprietary | text + speech | API |
| GPT-4o Audio (closed) | GPT-4o | proprietary | text + speech | API |

### 实实况检查标准 (2026)

**MMAU-Pro.**1800 个QA对涵盖语音/声音/音乐/混合.多音频子集包括在内.

| Model | Overall | Speech | Sound | Music | Multi-audio |
|-------|---------|--------|-------|-------|-------------|
| Gemini 2.5 Pro | ~60% | 73.4% | 51.9% | 64.9% | ~22% |
| Gemini 2.5 Flash | ~57% | 73.4% | 50.5% | 64.9% | 21.2% |
| GPT-4o Audio | 52.5% | — | — | — | 26.5% |
| Qwen2.5-Omni-7B | 52.2% | 57.4% | 47.6% | 61.5% | ~20% |
| Audio Flamingo 3 | ~54% | — | — | — | — |
| Audio Flamingo Next | SOTA on LongAudioBench | — | — | — | — |

其他**multi-audio column is damning for everyone.**随机机会在4选项多选项=25%;大多数模型在此处得分.LALM仍然难以比较两个剪辑.

### 2026年LALM的使用

- **Compliance audit of call-center recordings.**"代理人提及了必要的披露吗?"
- **Accessibility.**描述听力障碍者听力障碍者听力障碍者听力障碍者听力障碍者听力障碍者听力障碍者听力障碍者听力障碍者听力障碍者听力障碍者听力障碍者听力障碍者听力障碍者听力障碍者听力障碍者听力障碍者听力障碍者听力障碍者听力障碍者听力障碍者听力障碍者听力障碍者听力障碍者听力障碍者听力障碍者听力障碍者听力障碍者听力障碍者听力障碍者听力障碍者听力者听力障碍者听力障碍者听力障碍者听力障碍者听力障碍者听力障碍者听力者听力障碍者听力障碍者听力者听力障碍者听力者听力障碍者听力者听力障碍者听力者听力障碍者听力障碍者听力障碍者听力者听力障碍者听力者听力障碍者听力障碍者听力障碍者听力者听力障碍者听力障碍者听力障碍者听力障碍者听力障碍者听力障碍者听力者听力障碍者听力障碍者听力障碍者听力障碍者听力者听力障碍者听力者听力障碍者听力者听力.
- **Content moderation.**检测暴力语言+威胁性语调+背景背景.
- **Podcast / meeting chaptering.**语义概述,而不是演讲者转转.
- **Music catalog analysis.**"用B部分键变换找到所有轨道".

### 它们 (尚未) 有用处

- 精细的音乐理论 (低于合唱水平).
- 长时间对话 (过去10分钟的程度) 时,讲者所归功的推理.
- 无线电和无线电的比较 (22-26%几乎不超过随机).
- 实时流媒体推理 (大多数是离线批量推理).

```figure
v4-alm-tokens
```

## 建立它

### 步骤1:查询Qwen2.5-Omni

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

### 步骤2:投影仪模式

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

预测器通常是1-3个线性层.在ASR对 (音频 →转录) 上训练它是第一阶段的借口任务.

### 步骤3:MMAU/LongAudioBench的基准评估

```python
from datasets import load_dataset
mmau = load_dataset("gamma-lab-umd/MMAU-Pro", split="test")
mcq = mmau.filter(lambda item: len(item["choices"] or []) > 1)

correct = 0
for item in mcq:
    answer = call_model(item["audio_path"], item["question"], item["choices"])
    if answer == item["answer"]:
        correct += 1
print(f"Accuracy: {correct / len(mcq):.3f}")
```

`audio_path`数据集的回报`data.zip`打分前,下载和打开zip. 这种精确匹配循环是智能检查,而不是基准得分符,因此其数量与已发布的MMAU-Pro结果是无法比较的. 官方评价者通过嵌入类似性 (NV-Embed-v2) 来匹配多选择答案,与LLM法官评分开放式答案,并通过regex规则检查指示后的答案:写预测给一个`model_output`列和运行`evaluate_mmau_pro_comprehensive.py`其他[MMAU-Pro repo](https://github.com/sonalkum/MMAUPro)报告每一个`category`总数隐藏在模型失败的地方.

## 用它

| Task | 2026 pick |
|------|-----------|
| Free-form audio QA (open) | Qwen2.5-Omni-7B |
| Best open on long audio | Audio Flamingo Next |
| Best closed | Gemini 2.5 Pro |
| Voice-in / voice-out agent | Qwen2.5-Omni or GPT-4o Audio |
| Music reasoning | Audio Flamingo 3 or 2 (music-specialized AF-CLAP) |
| Call-center audit | Gemini 2.5 Pro via API, with RAG over your policy docs |

## 陷

- **Over-trust on multi-audio.**如果你的任务需要"哪个剪辑有X", 随机运算水平的性能是真实的.
- **Long-audio degradation.**过去10分钟,大多数模型的扬声器属性断裂.
- **Hallucinations on silence.**像LALM一样,使用Whisper编码器的Whisper样式问题.
- **Benchmark cherry-picking.**销售商博客文章突出了最佳类别.

## 运送它

保存如`outputs/skill-alm-picker.md`选择LALM+基准子集+输出模式 (文字与语音) 为特定的音频理解任务.

## 运动

1. **Easy.**跑步`code/main.py`查看玩具投影器模式 + 输出代币的虚假 LALM 路由 (音频嵌入,文本代币) →
2. **Medium.**根据100个MMAU-Pro语音项目, 评分Qwen2.5Omni-7B.
3. **Hard.**建立一个最小的音频标题基线:BEAT编码器+2层投影器+结的Llama-3.2-1B. 仅在AudioCaps上调整投影器.比较Clotho-AQA上的SALMONN.

## 关键词

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| LALM | Audio ChatGPT | Audio encoder + projector + LLM decoder. |
| Projector | Adapter | Small MLP mapping audio features into LLM embedding space. |
| MMAU | The benchmark | 10k audio-QA pairs across speech, sound, music. |
| MMAU-Pro | Harder MMAU | 1800 multi-audio / reasoning-heavy questions. |
| LongAudioBench | Long-form eval | Multi-minute clips with semantic queries. |
| Voice-in / voice-out | Speech-native | Model ingests speech and emits speech without text detour. |

## 进一步阅读

- [Chu et al. (2024). Qwen2-Audio](https://arxiv.org/abs/2407.10759)参考架构.
- [Alibaba (2025). Qwen2.5-Omni](https://huggingface.co/Qwen/Qwen2.5-Omni-7B)说话中说话.
- [NVIDIA (2025). Audio Flamingo 3](https://arxiv.org/abs/2507.08128)开放长音频领导者.
- [NVIDIA (2026). Audio Flamingo Next](https://arxiv.org/abs/2604.10905)长音频.
- [Tang et al. (2023). SALMONN](https://arxiv.org/abs/2310.13289)双码码开创者
- [MMAU-Pro leaderboard](https://sonalkum.github.io/mmau-pro/)2026年现场排名.
