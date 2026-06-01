# 14 · 语音活动检测与轮次交替——Silero、Cobra 与 Flush 技巧

> 每个语音智能体的生死都系于两个判断：用户现在是否在说话，以及他们是否说完了？「语音活动检测（VAD, Voice Activity Detection）」回答第一个问题。「轮次检测（Turn-detection）」（VAD + 静默挂起 + 语义端点模型）回答第二个问题。其中任何一个判断错误，你的助手要么打断用户，要么喋喋不休停不下来。

**类型：** 构建
**语言：** Python
**前置：** 阶段 6 · 11（实时音频）、阶段 6 · 12（语音助手）
**时长：** 约 45 分钟

## 问题所在

语音智能体对每个 20 ms 音频块要做出三个截然不同的判断：

1. **这一帧是语音吗？** —— VAD。逐帧的二元判断。
2. **用户是否开始了一段新的话语？** —— 「起始检测（onset detection）」。
3. **用户说完了吗？** —— 「端点判定（end-pointing）」（轮次结束）。

朴素的做法（能量阈值）在任何噪声面前都会失效——车流、键盘敲击、人群嘈杂声。2026 年的答案是：Silero VAD（开源、深度学习）+ 一个轮次检测模型（语义端点判定）+ 一个根据 VAD 校准的静默挂起时间。

## 核心概念

〔图：VAD 级联：能量门 → Silero → 轮次检测器 → flush 技巧〕

### 三层 VAD 级联

**第一层：能量门（energy gate）。** 最廉价。在 -40 dBFS 处对 RMS 设阈值。能滤掉明显的静默，但任何高于阈值的噪声都会触发。

**第二层：Silero VAD**（2020–2026，MIT 许可证）。100 万参数。在 6000 多种语言上训练。在单 CPU 线程上每 30 ms 音频块约耗时 1 ms。在 5% FPR 下达到 87.7% TPR。开源场景下的默认选择。

**第三层：语义轮次检测器（semantic turn detector）。** LiveKit 的轮次检测模型（2024–2026），或你自己的小型分类器。它能区分「句中停顿」和「说完了」。它依据语言上下文（语调 + 近期词语），而不仅仅是静默。

### 关键参数及其默认值

- **阈值（Threshold）。** Silero 输出一个概率；在 &gt; 0.5（默认）或 &gt; 0.3（敏感）时判定为语音。阈值越低 = 首词被截断越少，误报越多。
- **最小语音时长（Minimum speech duration）。** 拒绝短于 250 ms 的语音——通常是咳嗽或椅子噪声。
- **静默挂起（Silence hangover，端点判定）。** 在 VAD 回到 0 之后，等待 500–800 ms 再宣布轮次结束。太短 → 打断用户。太长 → 显得迟钝。
- **预滚缓冲（Pre-roll buffer）。** 在 VAD 触发之前保留 300–500 ms 的音频。防止「hey」被截掉。

### Flush 技巧（Kyutai 2025）

流式 STT 模型存在前瞻延迟（Kyutai STT-1B 为 500 ms，STT-2.6B 为 2.5 s）。通常你要在语音结束后等待这么久才能拿到转写结果。Flush 技巧：当 VAD 触发语音结束时，**向 STT 发送一个 flush 信号**，强制其立即输出。STT 以约 4 倍实时速度处理，因此 500 ms 的缓冲约在 125 ms 内处理完毕。

端到端：125 ms VAD + flush STT = 对话级延迟。

### 2026 年 VAD 对比

| VAD | TPR @ 5% FPR | 延迟 | 许可证 |
|-----|--------------|---------|---------|
| WebRTC VAD（Google，2013） | 50.0% | 30 ms | BSD |
| Silero VAD（2020–2026） | 87.7% | ~1 ms | MIT |
| Cobra VAD（Picovoice） | 98.9% | ~1 ms | 商业 |
| pyannote segmentation | 95% | ~10 ms | 类 MIT |

Silero 是正确的默认选择。Cobra 是合规 / 精度升级方案。纯能量 VAD 在 2026 年的生产环境中已无立足之地。

## 动手构建

### 第 1 步：能量门

```python
def energy_vad(chunk, threshold_dbfs=-40.0):
    rms = (sum(x * x for x in chunk) / len(chunk)) ** 0.5
    dbfs = 20.0 * math.log10(max(rms, 1e-10))
    return dbfs > threshold_dbfs
```

### 第 2 步：用 Python 跑 Silero VAD

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

### 第 4 步：Flush 技巧骨架

```python
def flush_on_end(stt_client, audio_buffer):
    stt_client.send_audio(audio_buffer)
    stt_client.send_flush()
    return stt_client.recv_transcript(timeout_ms=150)
```

要让它生效，STT（Kyutai、Deepgram、AssemblyAI）必须支持 flush。Whisper 的流式处理不支持——它是基于块（block）的，且总是等待音频块。

## 实战应用

| 场景 | VAD 选择 |
|-----------|-----------|
| 开源、快速、通用 | Silero VAD |
| 商业呼叫中心 | Cobra VAD |
| 端侧（手机） | Silero VAD ONNX |
| 研究 / 说话人分离 | pyannote segmentation |
| 零依赖兜底 | WebRTC VAD（遗留方案） |
| 需要高质量的轮次结束判定 | Silero + LiveKit 轮次检测器分层叠加 |

经验法则：除非你真的别无选择，否则永远不要上线纯能量 VAD。

## 常见陷阱

- **固定阈值。** 在安静环境可用，在嘈杂环境失效。要么在端侧校准，要么改用 Silero。
- **静默挂起太短。** 智能体在句子中途打断用户。对于对话式语音，500–800 ms 是最佳区间。
- **挂起太长。** 显得迟钝。用目标用户做 A/B 测试。
- **没有预滚缓冲。** 用户音频的前 200–300 ms 丢失。务必保留一个滚动的预滚缓冲。
- **忽略语义端点判定。** 「嗯，让我想想……」中包含很长的停顿。用户最讨厌在思考中途被打断。请使用 LiveKit 的轮次检测器或类似方案。

## 交付产出

保存为 `outputs/skill-vad-tuner.md`。为某个工作负载选定 VAD 模型、阈值、挂起时间、预滚以及轮次检测策略。

## 练习

1. **简单。** 运行 `code/main.py`。它会模拟一段「语音 + 静默 + 语音 + 咳嗽」序列，并测试三层 VAD。
2. **中等。** 安装 `silero-vad`，处理一段 5 分钟的录音，调节阈值，使首词截断和误触发都最小化。报告精确率 / 召回率。
3. **困难。** 构建一个迷你轮次检测器：Silero VAD + 在最后 10 个词的嵌入上接一个 3 层 MLP（使用 sentence-transformers）。在手工标注的轮次结束数据集上训练。在 F1 上比纯 Silero 高 10%。

## 关键术语

| 术语 | 人们怎么说 | 它实际指什么 |
|------|-----------------|-----------------------|
| VAD | 语音检测器 | 逐帧的二元判断：这是语音吗？ |
| 轮次检测 | 端点判定 | VAD + 静默挂起 + 语义端点。 |
| 静默挂起 | 语音后等待 | 宣布轮次结束前的等待时间；500–800 ms。 |
| 预滚 | 语音前缓冲 | 在 VAD 触发前保留 300–500 ms 音频。 |
| Flush 技巧 | Kyutai 的妙招 | VAD → flush-STT → 延迟从 500 ms 降到 125 ms。 |
| 语义端点 | 「他们是有意停下吗？」 | 关注词语而非仅静默的 ML 分类器。 |
| TPR @ FPR 5% | ROC 点 | 标准 VAD 基准；Silero 为 87.7%，WebRTC 为 50%。 |

## 延伸阅读

- [Silero VAD](https://github.com/snakers4/silero-vad) —— 参考级开源 VAD。
- [Picovoice Cobra VAD](https://picovoice.ai/products/cobra/) —— 商业精度领先者。
- [Kyutai —— Unmute + flush 技巧](https://kyutai.org/stt) —— 亚 200 ms 的工程妙招。
- [LiveKit —— 轮次检测](https://docs.livekit.io/agents/logic/turns/) —— 生产环境中的语义端点判定。
- [WebRTC VAD](https://webrtc.googlesource.com/src/) —— 遗留的基线方案。
- [pyannote segmentation](https://github.com/pyannote/pyannote-audio) —— 说话人分离级别的分段。
