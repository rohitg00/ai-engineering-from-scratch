# 语音活动检测与话轮转换 — Silero、Cobra 与 Flush 技巧

> 每个语音 Agent 的成败都取决于两个判断：用户现在是否在说话，以及用户是否说完了？VAD 回答第一个问题。话轮检测（VAD + 静音滞留 + 语义端点模型）回答第二个问题。任何一个判断出错，你的助手要么打断用户，要么永远说个不停。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 6 · 11 (Real-Time Audio), Phase 6 · 12 (Voice Assistant)
**Time:** ~45 分钟

## 问题

语音 Agent 在每个 20 ms 音频块上要做三个不同的判断：

1. **这一帧是语音吗？** — VAD。逐帧的二元判断。
2. **用户是否开始了一段新的发言？** — 起始检测。
3. **用户是否说完了？** — 端点检测（话轮结束）。

朴素的做法（能量阈值）在任何噪声下都会失效——车流、键盘声、人群嘈杂声。2026 年的答案是：Silero VAD（开源、深度学习）+ 话轮检测模型（语义端点检测）+ 由 VAD 校准的静音滞留。

## 核心概念

![VAD cascade: energy → Silero → turn-detector → flush trick](../assets/vad-turn-taking.svg)

### 三层 VAD 级联

**第 1 层：能量门限。** 最便宜。在 -40 dBFS 处设置 RMS 阈值。能过滤明显的静音，但任何高于阈值的噪声都会触发。

**第 2 层：Silero VAD**（2020-2026，MIT 许可）。100 万参数。训练数据覆盖 6000+ 种语言。单 CPU 线程上每 30 ms 音频块耗时约 1 ms。5% FPR 下 TPR 为 87.7%。开源方案中的默认选择。

**第 3 层：语义话轮检测器。** LiveKit 的话轮检测模型（2024-2026），或者你自己训练的小型分类器。能区分“句子中间的停顿”和“说完了”。利用语言学上下文（语调 + 最近的词），而不仅仅依靠静音。

### 关键参数及其默认值

- **阈值。** Silero 输出一个概率；在 &gt; 0.5（默认）或 &gt; 0.3（灵敏）时判定为语音。阈值越低，首字被截断越少，但误报越多。
- **最短语音时长。** 丢弃短于 250 ms 的语音——通常是咳嗽或椅子声响。
- **静音滞留（端点检测）。** VAD 归零后，等待 500-800 ms 再判定话轮结束。太短 → 打断用户。太长 → 感觉迟钝。
- **Pre-roll 缓冲。** 在 VAD 触发前保留 300-500 ms 音频。防止"hey"被截断。

### Flush 技巧（Kyutai 2025）

流式 STT 模型有一个前瞻延迟（Kyutai STT-1B 为 500 ms，STT-2.6B 为 2.5 s）。正常情况下，语音结束后你要等这么久才能拿到转录文本。Flush 技巧：当 VAD 判定语音结束时，**向 STT 发送 flush 信号**，强制其立即输出。STT 以约 4 倍实时速度处理，因此 500 ms 的缓冲约 125 ms 即可处理完。

端到端：125 ms VAD + flush STT = 会话级延迟。

### 2026 年 VAD 对比

| VAD | TPR @ 5% FPR | 延迟 | 许可证 |
|-----|--------------|---------|---------|
| WebRTC VAD (Google, 2013) | 50.0% | 30 ms | BSD |
| Silero VAD (2020-2026) | 87.7% | ~1 ms | MIT |
| Cobra VAD (Picovoice) | 98.9% | ~1 ms | 商业授权 |
| pyannote segmentation | 95% | ~10 ms | 类 MIT |

Silero 是正确的默认选择。Cobra 是合规性/准确性上的升级。仅靠能量的 VAD 在 2026 年的生产环境中没有立足之地。

```figure
sp-vad-cascade
```

## 动手实现

### 第 1 步：能量门限

```python
def energy_vad(chunk, threshold_dbfs=-40.0):
    rms = (sum(x * x for x in chunk) / len(chunk)) ** 0.5
    dbfs = 20.0 * math.log10(max(rms, 1e-10))
    return dbfs > threshold_dbfs
```

### 第 2 步：在 Python 中使用 Silero VAD

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

### 第 3 步：话轮结束状态机

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

### 第 4 步：flush 技巧骨架

```python
def flush_on_end(stt_client, audio_buffer):
    stt_client.send_audio(audio_buffer)
    stt_client.send_flush()
    return stt_client.recv_transcript(timeout_ms=150)
```

STT（Kyutai、Deepgram、AssemblyAI）必须支持 flush 才能奏效。Whisper 流式模式不支持——它是基于块的，总是要等完整的块。

## 选型建议

| 场景 | VAD 选择 |
|-----------|-----------|
| 开放、快速、通用 | Silero VAD |
| 商业呼叫中心 | Cobra VAD |
| 端侧运行（手机） | Silero VAD ONNX |
| 研究 / 说话人分离 | pyannote segmentation |
| 零依赖后备方案 | WebRTC VAD（遗留方案） |
| 需要高质量话轮结束判定 | Silero + LiveKit turn-detector 叠加 |

经验法则：除非真的别无选择，否则绝不上线仅靠能量的 VAD。

## 常见陷阱

- **固定阈值。** 安静环境下可用，嘈杂环境下失效。要么在端侧校准，要么换用 Silero。
- **静音滞留太短。** Agent 在句子中间打断用户。500-800 ms 是对话语音的最佳区间。
- **滞留太长。** 感觉迟钝。与目标用户做 A/B 测试。
- **没有 pre-roll 缓冲。** 用户音频的前 200-300 ms 丢失。务必保留滚动 pre-roll。
- **忽略语义端点检测。** "Hmm, let me think..." 包含长停顿。用户讨厌在思考中途被打断。使用 LiveKit 的 turn-detector 或类似方案。

## 上线

保存为 `outputs/skill-vad-tuner.md`。针对你的工作负载选定 VAD 模型、阈值、滞留、pre-roll 以及话轮检测策略。

## 练习

1. **简单。** 运行 `code/main.py`。它模拟一段语音 + 静音 + 语音 + 咳嗽的序列，并测试三个 VAD 层级。
2. **中等。** 安装 `silero-vad`，处理一段 5 分钟录音，调节阈值以同时最小化首字截断和误触发。报告精确率/召回率。
3. **困难。** 构建一个迷你话轮检测器：Silero VAD + 一个基于最后 10 个词嵌入的 3 层 MLP（使用 sentence-transformers）。在人工标注的话轮结束数据集上训练。F1 比 Silero 单独使用高出 10%。

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|-----------------|-----------------------|
| VAD | 语音检测器 | 逐帧二元判断：这是语音吗？ |
| 话轮检测 | 端点检测 | VAD + 静音滞留 + 语义端点。 |
| 静音滞留 | 语音后等待 | 判定话轮结束前等待的时间；500-800 ms。 |
| Pre-roll | 语音前缓冲 | 在 VAD 触发前保留 300-500 ms 音频。 |
| Flush 技巧 | Kyutai 妙招 | VAD → flush-STT → 125 ms 而非 500 ms 延迟。 |
| 语义端点 | “他们是想说完吗？” | 看词而不只是看静音的机器学习分类器。 |
| TPR @ FPR 5% | ROC 上的点 | 标准 VAD 基准；Silero 为 87.7%，WebRTC 为 50%。 |

## 延伸阅读

- [Silero VAD](https://github.com/snakers4/silero-vad) — 参考级开源 VAD。
- [Picovoice Cobra VAD](https://picovoice.ai/products/cobra/) — 商业准确性领先者。
- [Kyutai — Unmute + flush 技巧](https://kyutai.org/stt) — 低于 200 ms 的工程技巧。
- [LiveKit — 话轮检测](https://docs.livekit.io/agents/logic/turns/) — 生产环境中的语义端点检测。
- [WebRTC VAD](https://webrtc.googlesource.com/src/) — 遗留基线。
- [pyannote segmentation](https://github.com/pyannote/pyannote-audio) — 说话人分离级分割。