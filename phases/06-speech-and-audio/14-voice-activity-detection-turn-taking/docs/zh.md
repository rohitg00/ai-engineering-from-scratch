# Voice Activity Detection & Turn-Taking — Silero, Cobra, and the Flush Trick

> 每个语音代理的生或死取决于两个决定：用户现在说话了吗？他们完成了吗？VAR回答了第一个问题。回合检测（VAR+沉默宿醉+语义端点模型）回答了第二个问题。如果你做错了，你的助手要么切断用户的联系，要么永远不会闭嘴。

** 类型：** 构建
** 语言：** Python
** 先决条件：** 阶段6 · 11（实时音频）、阶段6 · 12（语音助理）
** 时间：** ~45分钟

## The Problem

语音代理对每20 ms块做出三个不同的决定：

1. ** 这是框架演讲吗？** - VAR。二进制，每帧。
2. ** 用户是否开始新发声？** - 发病检测。
3. ** 用户完成了吗？** - 端点（转折）。

天真的答案（能量阈值）对任何噪音都无效--交通、键盘、人群胡言乱语。2026年的答案：Silero VAR（开放、深度学习）+回合检测模型（语义端点）+经过VAR校准的静音宿醉。

## The Concept

![VAD cascade: energy → Silero → turn-detector → flush trick](../assets/vad-turn-taking.svg)

### The three-tier VAD cascade

** 第一层：能量之门。**便宜的。阈值RMS为-40 dbFS。过滤明显的静音，但对阈值以上的任何噪音启动。

**Tier 2：Silero VAR **（2020-2026，麻省理工学院）。1 M参数。接受过6000多种语言培训。在单个中央处理器线程上，每30 ms块的初始化时间约为1 ms。87.7% TPR，5% FPR。开源默认值。

** 第3层：语义转向检测器。** LiveKit的回合检测模型（2024-2026）或您自己的小型分类器。区分“句子中暂停”与“谈话结束”。“使用语言背景（语调+最近的单词），而不仅仅是沉默。

### Key parameters and their defaults

- ** 阈值。** Silero输出概率;将语音分类为0.5（默认）或0.3（敏感）。较低的阈值=第一个词剪辑更少，误报更多。
- ** 最短演讲持续时间。**语音时间短于250 ms -通常是咳嗽或椅子噪音。
- ** 沉默宿醉（终点）。** VAR返回0后，等待500-800 ms然后宣布转弯结束。太短|中断用户。太长了-感觉迟钝。
- ** 滚动前缓冲区。** VAR触发前保留300-500 ms的音频。防止“嘿”被剪掉。

### The flush trick (Kyutai 2025)

流媒体STT模型具有超前延迟（Kyutai STT-1B为500 ms，STT-2.6B为2.5 s）。通常你会在演讲结束后等待那么长时间才能收到笔录。刷新技巧：当VAR触发语音结束时，** 向STT** 发送刷新信号，强制立即输出。STT处理速度约为4倍，因此500 ms缓冲区在约125 ms内完成。

端到端：125 ms VAD +刷新STT =会话延迟。

### 2026 VAD comparison

| VAD | TPA@5% FPR | 延迟 | 许可证 |
|-----|--------------|---------|---------|
| WebREC VAR（Google，2013） | 50.0% | 30 Ms | BSD |
| Silero VAR（2020-2026） | 87.7% | ~1 ms | MIT |
| Cobra VAR（Picovoice） | 98.9% | ~1 ms | 商业 |
| 拼音分割 | 95% | ~10 ms | 麻省理工学院式的 |

Silero是正确的默认值。Cobra是合规性/准确性升级。纯能源的VAR在2026年的生产中没有立足之地。

## Build It

### Step 1: the energy gate

```python
def energy_vad(chunk, threshold_dbfs=-40.0):
    rms = (sum(x * x for x in chunk) / len(chunk)) ** 0.5
    dbfs = 20.0 * math.log10(max(rms, 1e-10))
    return dbfs > threshold_dbfs
```

### Step 2: Silero VAD in Python

```python
from silero_vad import load_silero_vad, get_speech_timestamps

vad = load_silero_vad()
audio = torch.tensor(waveform_16k, dtype=torch.float32)
segments = get_speech_timestamps(
    audio, vad, sampling_rate=16000,
    threshold=0.5,
    min_speech_duration_ms=250,
    min_silence_duration_ms=500,
    speech_pad_ms=300,
)
for s in segments:
    print(f"{s['start']/16000:.2f}s - {s['end']/16000:.2f}s")
```

### Step 3: turn-end state machine

```python
class TurnDetector:
    def __init__(self, silence_hangover_ms=500, min_speech_ms=250):
        self.state = "idle"
        self.speech_ms = 0
        self.silence_ms = 0
        self.silence_hangover_ms = silence_hangover_ms
        self.min_speech_ms = min_speech_ms

    def update(self, is_speech, chunk_ms=20):
        if is_speech:
            self.speech_ms += chunk_ms
            self.silence_ms = 0
            if self.state == "idle" and self.speech_ms >= self.min_speech_ms:
                self.state = "speaking"
                return "START"
        else:
            self.silence_ms += chunk_ms
            if self.state == "speaking" and self.silence_ms >= self.silence_hangover_ms:
                self.state = "idle"
                self.speech_ms = 0
                return "END"
        return None
```

### Step 4: the flush trick skeleton

```python
def flush_on_end(stt_client, audio_buffer):
    stt_client.send_audio(audio_buffer)
    stt_client.send_flush()
    return stt_client.recv_transcript(timeout_ms=150)
```

STT（Kyutai、Deepgram、AssemblyAI）必须支持刷新才能发挥作用。Whisper流媒体则不然--它是基于块的，并且总是等待块。

## Use It

| 情况 | VAR选择 |
|-----------|-----------|
| 开放、快速、一般 | 西莱罗瓦德 |
| 商业呼叫中心 | 眼镜蛇瓦德 |
| 设备上（电话） | Silero VAR ONNX |
| 研究/日记化 | 拼音分割 |
| 零依赖性后备 | WebREC VAR（遗留） |
| 需要结局质量 | Silero + LiveKit旋转检测器分层 |

经验法则：除非您真的别无选择，否则永远不要运送纯能源的VAR。

## Pitfalls

- ** 固定阈值。**在安静中工作，在吵闹中失败。要么在设备上校准，要么切换到Silero。
- ** 宿醉太短暂的沉默。**特工打断了句子一半。500-800 ms是对话语音的最佳点。
- ** 宿醉太久。**感觉很迟钝。对目标用户进行A/B测试。
- ** 没有预滚动缓冲区。**前200-300 ms的用户音频丢失。始终保持滚动预卷。
- ** 忽略语义终结。**“嗯，让我想想……”包含长时间的停顿。用户讨厌中途被打断。使用LiveKit的转弯检测器或类似设备。

## Ship It

另存为“输出/skill-vad-tuner.md”。为工作负载选择VAR模型、阈值、宿醉、预滚动和转弯检测策略。

## Exercises

1. ** 简单。**运行'代码/main.py '。它模拟语音+静音+语音+咳嗽序列并测试三个VAR层。
2. ** 中等。**安装“silero-vad”，处理5分钟录音，调整阈值以最大限度地减少第一个词剪辑和错误触发。报告精确度/召回率。
3. ** 很难。**构建迷你回合检测器：Silero VAR+最后10个单词嵌入的3层MLP（使用字符转换器）。使用手工标记的最终数据集进行训练。F1以10%的优势击败Silero。

## Key Terms

| Term | 别人怎么说 | 它实际上意味着什么 |
|------|-----------------|-----------------------|
| VAD | 语音检测器 | 每帧二进制：这是语音吗？ |
| 转弯检测 | 终点指示 | VAR+沉默宿醉+语义端点。 |
| 沉默宿醉 | 演讲后等待 | 宣布转弯结束之前需要等待; 500-800 ms。 |
| 前贴片 | 语音前缓冲区 | VAR触发前保留300-500 ms音频。 |
| 冲水技巧 | 京都黑客 | VAR-刷新-STT-125 ms而不是500 ms延迟。 |
| 语义端点 | “他们是故意停下来的吗？" | ML分类器查看单词，而不仅仅是沉默。 |
| TPR @ FPR 5% | ROC点 | 标准VAR基准; Silero为87.7%，WebTTC为50%。 |

## Further Reading

- [Silero VAR]（https：//github.com/snakers4/silero-vad）-参考打开VAR。
- [Picovoice Cobra VAR]（https：//picovoice.ai/products/cobra/）-商业准确性领导者。
- [Kyutai -取消静音+刷新技巧]（https：//kyutai.org/stt）-低于200 ms的工程技巧。
- [LiveKit -转弯检测]（https：//docs.livekit.io/agents/logic/turs/）-生产中的语义端点。
- [WebREC VAR]（https：//webrtc.googleance.com/src/）-遗留基线。
- [pyannote分段]（https：//github.com/pyannote/pyannote-audio）-日记级分段。
