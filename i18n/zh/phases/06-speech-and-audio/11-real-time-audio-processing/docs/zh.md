# 实时音频处理

> 批处理管道处理一个文件。实时管道必须在下一个 20 毫秒到来之前处理完当前的 20 毫秒。每一个对话式 AI、广播工作室和电话机器人的成败都取决于这个延迟预算。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 6 · 02（频谱图）、Phase 6 · 04（ASR）、Phase 6 · 07（TTS）
**Time:** 约 75 分钟

## 问题所在

你想要一个感觉“活”的语音助手。人类对话轮替延迟约为 230 毫秒（从静音到响应）。超过 500 毫秒就显得机械；超过 1500 毫秒则像是坏了。在 2026 年，一个完整的 **听到 → 理解 → 响应 → 说话** 循环的预算是：

| 阶段 | 预算 |
|-------|--------|
| 麦克风 → 缓冲区 | 20 ms |
| VAD | 10 ms |
| ASR（流式） | 150 ms |
| LLM（首 token） | 100 ms |
| TTS（首个分块） | 100 ms |
| 渲染 → 扬声器 | 20 ms |
| **总计** | **~400 ms** |

Moshi（Kyutai，2024）实现了 200 毫秒的全双工。GPT-4o-realtime（2024）约为 320 毫秒。2022 年的级联管道则要 2500 毫秒。这 10 倍的改进来自三项技术：(1) 处处流式化，(2) 使用部分结果的异步流水线，(3) 可中断的生成。

## 核心概念

![Streaming audio pipeline with ring buffer, VAD gate, interruption](../assets/real-time.svg)

**帧 / 分块 / 窗口。** 实时音频以固定大小的块流动。常见选择：20 毫秒（16 kHz 下 320 个采样点）。下游所有环节都必须跟上这个节奏。

**环形缓冲区。** 固定大小的循环缓冲区。生产者线程写入新帧，消费者线程读取。避免在热路径上分配内存。大小 ≈ 最大延迟 × 采样率；一个 2 秒的 16 kHz 环形缓冲区 = 32,000 个采样点。

**VAD（语音活动检测）。** 在没人说话时阻止下游工作。Silero VAD 4.0（2024）在 CPU 上每个 30 毫秒帧耗时不到 1 毫秒。`webrtcvad` 是较老的替代方案。

**流式 ASR。** 在音频到达时输出部分转写文本的模型。流式模式下的 Parakeet-CTC-0.6B（NeMo，2024）在 320 毫秒延迟下达到 2–5% 的 WER。Whisper-Streaming（Macháček 等，2023）将 Whisper 分块，以约 2 秒延迟实现近流式。

**打断。** 当助手正在说话而用户开口时，你必须 (a) 检测到插入，(b) 停止 TTS，(c) 丢弃剩余的 LLM 输出。这一切要在 100 毫秒内完成，否则用户会觉得助手“聋了”。

**WebRTC Opus 传输。** 20 毫秒帧，48 kHz，自适应码率 8–128 kbps。浏览器和移动端的标准。LiveKit、Daily.co、Pion 是 2026 年构建语音应用的技术栈。

**抖动缓冲区。** 网络数据包会乱序 / 迟到。抖动缓冲区负责重排和平滑；太小 → 出现可闻的间隙，太大 → 延迟增加。典型值为 60–80 毫秒。

### 常见陷阱

- **线程争用。** Python 的 GIL 加上重型模型可能饿死音频线程。使用 C 回调音频库（sounddevice、PortAudio），让 Python 远离热路径。
- **采样率转换延迟。** 在管道内部重采样会增加 5–20 毫秒。要么预先重采样，要么使用零延迟重采样器（PolyPhase、`soxr_hq`）。
- **TTS 预热。** 即使是 Kokoro 这样的快速 TTS，首次请求也有 100–200 毫秒的预热时间。缓存模型，并在第一个真实轮次之前用一次空运行预热。
- **回声消除。** 没有 AEC，TTS 输出会重新进入麦克风，触发 ASR 识别机器人自己的声音。WebRTC AEC3 是开源默认方案。

```figure
nyquist-aliasing
```

## 动手构建

### 步骤 1：环形缓冲区

```python
import collections

class RingBuffer:
    def __init__(self, capacity):
        self.buf = collections.deque(maxlen=capacity)
    def write(self, frame):
        self.buf.extend(frame)
    def read(self, n):
        return [self.buf.popleft() for _ in range(min(n, len(self.buf)))]
    def level(self):
        return len(self.buf)
```

容量决定最大缓冲延迟。16 kHz 下 32,000 个采样点 = 2 秒。

### 步骤 2：VAD 门控

```python
def simple_energy_vad(frame, threshold=0.01):
    return sum(x * x for x in frame) / len(frame) > threshold ** 2
```

生产环境中替换为 Silero VAD：

```python
import torch
vad, _ = torch.hub.load("snakers4/silero-vad", "silero_vad")
is_speech = vad(torch.tensor(frame), 16000).item() > 0.5
```

### 步骤 3：流式 ASR

```python
# Parakeet-CTC-0.6B streaming via NeMo
from nemo.collections.asr.models import EncDecCTCModelBPE
asr = EncDecCTCModelBPE.from_pretrained("nvidia/parakeet-ctc-0.6b")
# chunk_ms=320 ms, look_ahead_ms=80 ms
for chunk in audio_stream():
    partial_text = asr.transcribe_streaming(chunk)
    print(partial_text, end="\r")
```

### 步骤 4：打断处理器

```python
class Dialog:
    def __init__(self):
        self.tts_task = None

    def on_user_speech(self, frame):
        if self.tts_task and not self.tts_task.done():
            self.tts_task.cancel()   # barge-in
        # then feed to streaming ASR

    def on_final_user_utterance(self, text):
        self.tts_task = asyncio.create_task(self.reply(text))

    async def reply(self, text):
        async for tts_chunk in llm_then_tts(text):
            speaker.write(tts_chunk)
```

关键在于异步 I/O 和可取消的 TTS 流。对音频轨道调用 WebRTC peerconnection.stop() 是标准做法。

## 实际应用

2026 年的技术栈：

| 层 | 选择 |
|-------|------|
| 传输 | LiveKit (WebRTC) 或 Pion (Go) |
| VAD | Silero VAD 4.0 |
| 流式 ASR | Parakeet-CTC-0.6B 或 Whisper-Streaming |
| LLM 首 token | Groq、Cerebras、vLLM-streaming |
| 流式 TTS | Kokoro 或 ElevenLabs Turbo v2.5 |
| 回声消除 | WebRTC AEC3 |
| 端到端原生 | OpenAI Realtime API 或 Moshi |

## 陷阱

- **为了保险缓冲 500 毫秒。** 缓冲区*就是*你的延迟下限。缩小它。
- **不固定线程。** 音频回调运行在优先级低于 UI 的线程上 = 高负载时出现卡顿。
- **TTS 分块太小。** 低于 200 毫秒的分块会让声码器的瑕疵变得可闻。320 毫秒的分块是最佳平衡点。
- **没有抖动缓冲区。** 真实网络充满抖动；没有平滑处理就会出现爆音。
- **单次执行的错误处理。** 音频管道必须防崩溃。一个异常就会杀死整个会话。

## 交付

保存为 `outputs/skill-realtime-designer.md`。设计一个实时音频管道，为每个阶段制定具体的延迟预算。

## 练习

1. **简单。** 运行 `code/main.py`。模拟环形缓冲区 + 能量 VAD；为一个虚构的 10 秒流打印各阶段延迟。
2. **中等。** 使用 `sounddevice`，构建一个透传循环，以 20 毫秒帧处理你的麦克风，并在每帧打印 VAD 状态。
3. **困难。** 用 `aiortc` 构建一个全双工回声测试：浏览器 → WebRTC → Python → WebRTC → 浏览器。用 1 kHz 脉冲测量端到端延迟。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------------|-----------------------|
| 环形缓冲区 | 循环队列 | 固定大小的、无锁（或 SPSC 锁定）的音频帧 FIFO。 |
| VAD | 静音门 | 标记语音与非语音的模型或启发式方法。 |
| 流式 ASR | 实时 STT | 音频到达时输出部分文本；有界前瞻。 |
| 抖动缓冲区 | 网络平滑器 | 重排乱序数据包的队列；典型值为 60–80 毫秒。 |
| AEC | 回声消除 | 减去扬声器到麦克风的反馈路径。 |
| Barge-in | 用户打断 | 系统在 TTS 播放中途检测到用户语音；必须取消播放。 |
| 全双工 | 双方同时进行 | 用户和机器人可以同时说话；Moshi 是全双工的。 |

## 延伸阅读

- [Macháček 等 (2023). Whisper-Streaming](https://arxiv.org/abs/2307.14743) — 分块的近流式 Whisper。
- [Kyutai (2024). Moshi](https://kyutai.org/Moshi.pdf) — 200 毫秒延迟的全双工。
- [LiveKit Agents framework (2024)](https://docs.livekit.io/agents/) — 生产级音频 agent 编排。
- [Silero VAD repo](https://github.com/snakers4/silero-vad) — 亚 1 毫秒 VAD，Apache 2.0。
- [WebRTC AEC3 paper](https://webrtc.googlesource.com/src/+/main/modules/audio_processing/aec3/) — 开源下的回声消除。