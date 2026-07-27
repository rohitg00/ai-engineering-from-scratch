# 语音活动检测与轮次控制——Silero、Cobra 与 Flush Trick

> 每个语音智能体都取决于两个决策：用户现在在说话吗？他们说完了吗？VAD 回答第一个问题。轮次检测（VAD + 静默挂起 + 语义端点模型）回答第二个。任何一个搞错了，你的助手要么打断用户，要么永远说个不停。

**类型：** 动手构建
**语言：** Python
**前置知识：** 阶段 6 · 11（实时音频），阶段 6 · 12（语音助手）
**时间：** ~45 分钟

## 问题

语音智能体在每个 20 ms 块上做出三个不同的决策：

1. **这一帧是语音吗？**——VAD。二值，每帧判断。
2. **用户开始新的发言了吗？**——起始检测。
3. **用户说完了吗？**——端点检测（轮次结束）。

天真的做法（能量阈值）在任何噪声下都会失败——交通声、键盘声、人群嘈杂声。2026 年的答案：Silero VAD（开源、深度学习）+ 轮次检测模型（语义端点）+ VAD 校准的静默挂起。

## 概念

![VAD 级联：能量 → Silero → 轮次检测器 → flush trick](../assets/vad-turn-taking.svg)

### 三层 VAD 级联

**第一层：能量门控。** 最便宜。设置 RMS 阈值在 -40 dBFS。过滤明显的静默，但任何超过阈值的噪声都会触发。

**第二层：Silero VAD**（2020-2026，MIT）。100 万参数。在 6000+ 种语言上训练。在单个 CPU 线程上每 30 ms 块运行约 1 ms。在 5% FPR 下 TPR 为 87.7%。开源默认选择。

**第三层：语义轮次检测器。** LiveKit 的轮次检测模型（2024-2026）或你自己训练的小型分类器。区分"句中停顿"和"说完了"。使用语言上下文（语调 + 最近词语），而不仅仅是静默。

### 关键参数及其默认值

- **阈值。** Silero 输出概率；在 > 0.5（默认）或 > 0.3（灵敏）时分类为语音。更低的阈值 = 更少的首词被切，更多的误报。
- **最小语音时长。** 拒绝短于 250 ms 的语音——通常是咳嗽或椅子噪音。
- **静默挂起（端点检测）。** VAD 回到 0 后，等待 500-800 ms 再宣布轮次结束。太短 → 打断用户。太长 → 感觉迟钝。
- **预卷缓冲区。** 在 VAD 触发前保留 300-500 ms 音频。防止"嘿"被切掉。

### Flush trick（Kyutai 2025）

流式 STT 模型有预读延迟（Kyutai STT-1B 为 500 ms，STT-2.6B 为 2.5 秒）。通常你需要在说话结束后等待那么久才能拿到转录。Flush trick：当 VAD 触发说话结束时，**向 STT 发送一个 flush 信号**，强制立即输出。STT 以约 4 倍实时速度处理，因此 500 ms 的缓冲区在约 125 ms 内完成。

端到端：125 ms VAD + flush STT = 会话级延迟。

### 2026 VAD 比较

| VAD | 5% FPR 时的 TPR | 延迟 | 许可 |
|-----|--------------|---------|---------|
| WebRTC VAD（Google，2013） | 50.0% | 30 ms | BSD |
| Silero VAD（2020-2026） | 87.7% | ~1 ms | MIT |
| Cobra VAD（Picovoice） | 98.9% | ~1 ms | 商业 |
| pyannote segmentation | 95% | ~10 ms | MIT 类 |

Silero 是正确的默认选择。Cobra 是合规性/准确率升级版。纯能量 VAD 在 2026 年生产中已无立足之地。

## 动手实现

### 第 1 步：能量门控

```python
def energy_vad(chunk, threshold_dbfs=-40.0):
    rms = (sum(x * x for x in chunk) / len(chunk)) ** 0.5
    dbfs = 20.0 * math.log10(max(rms, 1e-10))
    return dbfs > threshold_dbfs
```

### 第 2 步：Python 中的 Silero VAD

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

### 第 3 步：轮次结束状态机

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

### 第 4 步：flush trick 骨架

```python
def flush_on_end(stt_client, audio_buffer):
    stt_client.send_audio(audio_buffer)
    stt_client.send_flush()
    return stt_client.recv_transcript(timeout_ms=150)
```

STT（Kyutai、Deepgram、AssemblyAI）必须支持 flush 才能工作。Whisper 流式不支持——它是基于块的，总是等待块。

## 使用建议

| 场景 | VAD 选择 |
|-----------|-----------|
| 开源、快速、通用 | Silero VAD |
| 商业呼叫中心 | Cobra VAD |
| 设备端（手机） | Silero VAD ONNX |
| 研究 / 说话人分离 | pyannote segmentation |
| 零依赖备选 | WebRTC VAD（旧版） |
| 需要高质量轮次结束 | Silero + LiveKit 轮次检测器叠加 |

经验法则：除非真的别无选择，否则绝对不要发布纯能量 VAD。

## 常见陷阱

- **固定阈值。** 安静环境可用，噪声环境失效。要么在设备上校准，要么切换到 Silero。
- **静默挂起太短。** 智能体在句子中间打断。500-800 ms 是对话语音的最佳点。
- **挂起太长。** 感觉迟钝。与目标用户进行 A/B 测试。
- **没有预卷缓冲区。** 用户音频的前 200-300 ms 丢失。始终保留滚动预卷。
- **忽略语义端点检测。**"嗯，让我想想……"包含长停顿。用户讨厌在思考中被切断。使用 LiveKit 的轮次检测器或类似方案。

## 交付物

保存为 `outputs/skill-vad-tuner.md`。为工作负载选择 VAD 模型、阈值、挂起时间、预卷和轮次检测策略。

## 练习

1. **简单。** 运行 `code/main.py`。它模拟一个语音 + 静默 + 语音 + 咳嗽序列，并测试三层 VAD。
2. **中等。** 安装 `silero-vad`，处理一个 5 分钟的录音，调整阈值以最小化首词被切和误触发。报告精确率/召回率。
3. **困难。** 构建一个小型轮次检测器：Silero VAD + 在最后 10 个词的嵌入上（使用 sentence-transformers）加一个 3 层 MLP。在手工标注的轮次结束数据集上训练。以 10% F1 超过纯 Silero。

## 关键词汇

| 术语 | 通常说法 | 实际含义 |
|------|-----------------|-----------------------|
| VAD | 语音检测器 | 每帧二值：这是语音吗？ |
| Turn detection（轮次检测） | 端点检测 | VAD + 静默挂起 + 语义端点。 |
| Silence hangover（静默挂起） | 等待说话结束 | 宣布轮次结束前的等待时间；500-800 ms。 |
| Pre-roll（预卷） | 语音前缓冲 | 在 VAD 触发前保留 300-500 ms 音频。 |
| Flush trick | Kyutai 技巧 | VAD → flush-STT → 125 ms 而非 500 ms 延迟。 |
| Semantic endpoint（语义端点） | "他们打算停了吗？" | 查看词语而不仅仅是静默的 ML 分类器。 |
| TPR @ FPR 5% | ROC 点 | 标准 VAD 基准；Silero 87.7%，WebRTC 50%。 |

## 延伸阅读

- [Silero VAD](https://github.com/snakers4/silero-vad)——参考开源 VAD。
- [Picovoice Cobra VAD](https://picovoice.ai/products/cobra/)——商业准确率领导者。
- [Kyutai——Unmute + flush trick](https://kyutai.org/stt)——亚 200 ms 工程技巧。
- [LiveKit——turn detection](https://docs.livekit.io/agents/logic/turns/)——生产环境中的语义端点检测。
- [WebRTC VAD](https://webrtc.googlesource.com/src/)——旧版基线。
- [pyannote segmentation](https://github.com/pyannote/pyannote-audio)——说话人分离级别的分割。
