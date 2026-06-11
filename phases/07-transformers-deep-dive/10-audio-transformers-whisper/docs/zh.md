# Audio Transformers — Whisper Architecture

> 音频是频率随时间变化的图像。Whisper是一个ViT，可以吃掉梅尔光谱图并进行反击。

** 类型：** 学习
** 语言：** Python
** 先决条件：** 阶段7 · 05（全Transformer）、阶段7 · 08（编码器-解码器）、阶段7 · 09（ViT）
** 时间：** ~45分钟

## The Problem

在Whisper（OpenAI，Radford等人，2022）之前，最先进的自动语音识别（ASB）意味着wav 2 vec 2.0和HuBERT -自监督特征提取器加上微调头部。高质量、昂贵的数据管道、域脆弱。多语言语音识别需要每个语言家族单独的模型。

Whisper下了三个赌注：

1. ** 训练一切。**从互联网上抓取了680，000小时的弱标签音频，跨越97种语言。没有干净的学术文集。没有音素标签。
2. ** 多任务单一型号。**一名解码器通过任务令牌联合训练转录、翻译、语音活动检测、语言ID和时间戳。
3. ** 标准编码器-解码器Transformer。**编码器消耗log-mel光谱图。解码器自回归生成文本令牌。没有声码器、没有CTC、没有HMM。

结果：Whisper large-v3在带有零干净标签数据的口音、噪音和语言中都很强大。它是2026年所有开源语音助理和大多数商业语音助理的默认语音前端。

## The Concept

![Whisper pipeline: audio → mel → encoder → decoder → text](../assets/whisper.svg)

### Step 1 — resample + window

音频为16 GHz。剪辑/填充至30秒。计算log-mel频谱图：80个梅尔箱，10 ms跨度-~ 3，000帧x 80个特征。这是Whisper看到的“输入图像”。

### Step 2 — convolutional stem

具有内核3和stride 2的两个Conv 1D层将3，000帧减少到1，500帧。将序列长度减半，无需添加大量参数。

### Step 3 — encoder

超过1，500个时间步的24层（大型）Transformer编码器。鼻窦位置编码、自我注意力、GELU FFN。产生1，500 x 1，280个隐藏状态。

### Step 4 — decoder

24层Transformer解码器。它从BPE词汇表中自回归生成令牌，BPE词汇表是GPT-2的超集，带有一些特定于音频的特殊令牌。

### Step 5 — task tokens

解码器提示符以控制令牌开始，告诉模型要做什么：

```
<|startoftranscript|>  <|en|>  <|transcribe|>  <|0.00|>
```

或

```
<|startoftranscript|>  <|fr|>  <|translate|>   <|0.00|>
```

该模型是根据该惯例进行训练的。您通过前置控制任务。2026年相当于语音调谐，但适用于语音。

### Step 6 — output

具有log prob阈值的射束搜索（宽度5）。当'<时，每0.02秒音频预测时间戳|无时间戳|>'代币不存在。

### Whisper sizes

| 模型 | Params | 层 | d_模型 | 头 | VRAM（fp 16） |
|-------|--------|--------|---------|-------|-------------|
| 微小 | 39M | 4 | 384 | 6 | ~1 GB |
| 基地 | 74M | 6 | 512 | 8 | ~1 GB |
| 小 | 244M | 12 | 768 | 12 | ~2 GB |
| 介质 | 小行星769 | 24 | 1024 | 16 | ~5 GB |
| 大 | 1550 M | 32 | 1280 | 20 | ~10 GB |
| 大v3 | 1550 M | 32 | 1280 | 20 | ~10 GB |
| 大型v3涡轮增压 | 809M | 32 | 1280 | 20 | ~6 GB（4层解码器） |

Large-v3-Turbo（2024）将解码器从32层削减到4层。解码速度快8倍，WER点回归<1。解码速度解锁就是Whisper-Turbo成为2026年实时语音代理默认的原因。

### What Whisper does not do

- 没有日记化（谁在说话）。与pyannote配对。
- 本地没有实时流媒体-30秒窗口是固定的。现代包装器（“faster-whisper”、“WhisperX”）通过VAR+重叠在流媒体上发布。
- 没有外部分块，超过30岁的长篇背景。在实践中效果很好，因为人类言语很少需要远程上下文来转录。

### 2026 landscape

| 任务 | 模型 | 注意到 |
|------|-------|-------|
| 英语ASB | 耳语涡轮、私酒 | Moonshine边缘速度快4倍 |
| 多语言ASB | Whisper-large-v3 | 97种语言 |
| 流媒体ASB | 更快的耳语+VAR | 可实现150 ms延迟目标 |
| TTS | Piper，XTTS-v2，Kokoro | 编码器-解码器模式，但是耳语形状的 |
| 音频+语言 | AudioLM，无障碍M4 T | 文本令牌+音频令牌在一个Transformer中 |

## Build It

请参阅' code/main.py '。我们不训练Whisper -我们构建log-mel频谱管道+任务令牌提示格式器。这些是您在生产中实际接触到的部分。

### Step 1: synthesize audio

生成440 Hz 1秒的频率为16 GHz的频率为440 Hz的频谱。16，000个样本。

### Step 2: log-mel spectrogram (simplified)

完整的梅尔谱图需要快速傅里叶变换。我们做了一个简化的取景+每帧能量版本，显示管道而不需要“librosa”：

```python
def frame_signal(x, frame_size=400, hop=160):
    frames = []
    for start in range(0, len(x) - frame_size + 1, hop):
        frames.append(x[start:start + frame_size])
    return frames
```

帧= 25 ms，跳频= 10 ms。匹配Whisper的窗口化。每帧能量代表教学法的梅尔垃圾箱。

### Step 3: pad to 30 s

Whisper始终处理30秒的块。将频谱图填充（或剪辑）到3，000帧。

### Step 4: build the prompt tokens

```python
def whisper_prompt(lang="en", task="transcribe", timestamps=True):
    tokens = ["<|startoftranscript|>", f"<|{lang}|>", f"<|{task}|>"]
    if not timestamps:
        tokens.append("<|notimestamps|>")
    return tokens
```

这就是整个任务控制表面。4个令牌前置。

## Use It

```python
import whisper
model = whisper.load_model("large-v3-turbo")
result = model.transcribe("meeting.wav", language="en", task="transcribe")
print(result["text"])
print(result["segments"][0]["start"], result["segments"][0]["end"])
```

更快、兼容OpenAI：

```python
from faster_whisper import WhisperModel
model = WhisperModel("large-v3-turbo", compute_type="int8_float16")
segments, info = model.transcribe("meeting.wav", vad_filter=True)
for s in segments:
    print(f"{s.start:.2f} - {s.end:.2f}: {s.text}")
```

** 2026年何时选择Whisper：**

- 具有一个模型的多语言ASB。
- 对嘈杂、多样化的音频进行稳健的转录。
- 研究/原型ASR -最快的起点。

** 何时选择其他东西：**

- 边缘上的超低延迟流媒体- Moonshine以匹配的质量击败Whisper。
- 实时对话AI需要<200 ms -专用流媒体ASB。
- 扬声器日记化- Whisper不会这样做;螺栓上。

## Ship It

请参阅“输出/skill-asr-configurator.md”。该技能为新的语音应用程序选择ASB模型、解码参数和预处理管道。

## Exercises

1. ** 简单。**运行'代码/main.py '。确认16 GHz、10 ms跳跃的1秒信号的帧计数约为100帧。30秒：~ 3，000帧。
2. ** 中等。**使用“numpy.fft”构建完整的log-mel频谱图。验证80个mel bin匹配' librosa.feature.melspectrogram（n_mels=80）'在数字误差内。
3. ** 很难。**实现流推理：将音频块分成10秒的窗口，重叠2秒，对每个块运行Whisper，合并文字记录。在5分钟播客示例中测量误字率与单次传递。

## Key Terms

| Term | 别人怎么说 | 它实际上意味着什么 |
|------|-----------------|-----------------------|
| 梅尔频谱图 | “音频图像” | 2D表示：频率点在一个轴上，时间帧在另一个轴上;每个单元的日志缩放能量。 |
| 洛梅尔 | “低语者所看到的” | 梅尔频谱图穿过原木;接近人类对响度的感知。 |
| 帧 | “一个时间片” | 25 ms的样本窗口;以10 ms的跨度重叠。 |
| 任务令牌 | “语音提示前缀” | 特殊代币，例如' | 转录 | >'/' | 翻译 | >'在解码器提示符中。 |
| 语音活动检测（VAR） | “找到演讲稿” | 在ASR之前消除沉默的门;大幅削减成本。 |
| CTC | “连接主义时间分类” | 无限制训练的经典ASO损失; Whisper不使用它。 |
| 低语涡轮 | “小解码器，全编码器” | 大型v3编码器+ 4层解码器;解码速度快8倍。 |
| 更快的耳语 | “生产包装” | CTranslate 2重新实现; int 8量化;比OpenAI的参考快4倍。 |

## Further Reading

- [雷德福等人（2022）。通过大规模弱监督实现稳健语音识别]（https：//arxiv.org/ab/2212.04356）- Whisper论文。
- [OpenAI Whisper repo]（https：//github.com/openai/whisper）-参考代码+模型权重。阅读' whisper/model.py '可从上到下查看Conv 1D主干+编码器+解码器，共约400行。
- [OpenAI Whisper -' whisper/decoding.py ']（https：//github.com/openai/whisper/blob/main/whisper/decoding.py）-步骤5-6中描述的beam-search + task-token逻辑在这里; 500行，完全可读。
- [Baevski等人（2020）。wav2vec 2.0：语音表示的自我监督学习框架]（https：//arxiv.org/ab/2006.11477）-前身;在某些设置中仍然具有SOTA功能。
- [CLARRAN/faster-whisper]（https：//github.com/CLARRAN/faster-whisper）-生产包装，比参考快4倍。
- [Jia等人（2024）。私酿酒：用于实时转录和语音命令的语音识别]（https：//arxiv.org/ab/2410.15608）- 2024年边缘友好的ASB，Whisper形状，但更小。
- [HuggingFace博客-“针对带InboxTransformers的多语言ASB的微调Whisper”]（https：//huggingface.co/blog/fine-tune-whisper）-典型的微调食谱，包括梅尔光谱图预处理器和标记时间戳处理。
- [HuggingFace ' modeling_whisper.py ']（https：//github.com/huggingface/transformers/bob/main/SRC/transformers/modeling_whisper.py）-完整实现（编码器、解码器、交叉注意力、生成），反映了课程的架构图。
