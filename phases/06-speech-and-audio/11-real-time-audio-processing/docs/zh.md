# 实时音频处理（Real-Time Audio Processing）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 批处理 pipeline 处理一个文件。实时 pipeline 要在下一个 20 毫秒到达之前处理完上一个 20 毫秒。每一个对话式 AI、广播演播室和电话机器人都被这条延迟预算决定生死。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 6 · 02 (Spectrograms), Phase 6 · 04 (ASR), Phase 6 · 07 (TTS)
**Time:** ~75 minutes

## 问题（The Problem）

你想要一个有生命感的语音助手。人类对话轮替的延迟约为 230 ms（从静默到回应）。任何超过 500 ms 的回应都会显得机械；超过 1500 ms 就会让人觉得坏掉了。2026 年完整的 **听 → 理解 → 回应 → 说** 闭环预算大致是：

| 阶段 | 预算 |
|-------|--------|
| Mic → buffer | 20 ms |
| VAD | 10 ms |
| ASR（streaming） | 150 ms |
| LLM（首 token） | 100 ms |
| TTS（首个 chunk） | 100 ms |
| Render → speaker | 20 ms |
| **合计** | **~400 ms** |

Moshi（Kyutai, 2024）做到了 200 ms 全双工。GPT-4o-realtime（2024）约 320 ms。2022 年的级联 pipeline 要 2500 ms。这 10× 的提升来自三种技术：(1) 处处 streaming，(2) 异步流水线 + 部分结果，(3) 可中断的生成。

## 概念（The Concept）

![Streaming audio pipeline with ring buffer, VAD gate, interruption](../assets/real-time.svg)

**Frame / chunk / window。** 实时音频以固定大小的块流动。常见选择：20 ms（16 kHz 下 320 个样本）。下游一切都必须跟上这个节拍。

**Ring buffer（环形缓冲区）。** 固定大小的循环缓冲区。生产者线程写入新帧，消费者线程读取。避免在热路径上做内存分配。容量 ≈ 最大延迟 × 采样率；2 秒的 16 kHz ring = 32,000 样本。

**VAD（Voice Activity Detection，语音活动检测）。** 在没人说话时关闭下游工作。Silero VAD 4.0（2024）在 CPU 上每 30 ms 帧 < 1 ms。`webrtcvad` 是更老的替代品。

**Streaming ASR。** 在音频到达时就吐出部分转写结果的模型。Parakeet-CTC-0.6B 的 streaming 模式（NeMo, 2024）在 320 ms 延迟下达到 2–5% WER。Whisper-Streaming（Macháček et al., 2023）把 Whisper 切块，达到约 2 s 延迟的近 streaming。

**Interruption（打断）。** 当助手在说话时用户开口，你必须 (a) 检测到 barge-in（插话），(b) 停止 TTS，(c) 丢弃剩下的 LLM 输出。一切都要在 100 ms 内完成，否则用户感觉助手是聋的。

**WebRTC Opus 传输。** 20 ms 帧、48 kHz、自适应码率 8–128 kbps。浏览器和移动端的标准。LiveKit、Daily.co、Pion 是 2026 年构建语音应用的栈。

**Jitter buffer（抖动缓冲）。** 网络包会乱序 / 迟到。jitter buffer 重排并平滑；太小 → 听到断续，太大 → 延迟。典型 60–80 ms。

### 常见坑（Common gotchas）

- **线程争抢。** Python 的 GIL + 重模型会饿死音频线程。使用 C 回调的音频库（sounddevice、PortAudio），让 Python 远离热路径。
- **采样率转换延迟。** 在 pipeline 里重采样会增加 5–20 ms。要么提前重采样，要么用零延迟重采样器（PolyPhase、`soxr_hq`）。
- **TTS 预热。** 即便是 Kokoro 这样的快速 TTS，首次请求也有 100–200 ms 的热身。在第一次真实对话之前缓存模型并用一次空跑预热它。
- **回声消除（Echo cancellation）。** 没有 AEC，TTS 输出会从喇叭重新进入麦克风，触发 ASR 听到机器人自己的声音。WebRTC AEC3 是开源默认方案。

## 动手实现（Build It）

### 第 1 步：ring buffer

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

容量决定最大缓冲延迟。16 kHz 下 32,000 样本 = 2 s。

### 第 2 步：VAD 闸门

```python
def simple_energy_vad(frame, threshold=0.01):
    return sum(x * x for x in frame) / len(frame) > threshold ** 2
```

生产环境换成 Silero VAD：

```python
import torch
vad, _ = torch.hub.load("snakers4/silero-vad", "silero_vad")
is_speech = vad(torch.tensor(frame), 16000).item() > 0.5
```

### 第 3 步：streaming ASR

```python
# Parakeet-CTC-0.6B streaming via NeMo
from nemo.collections.asr.models import EncDecCTCModelBPE
asr = EncDecCTCModelBPE.from_pretrained("nvidia/parakeet-ctc-0.6b")
# chunk_ms=320 ms, look_ahead_ms=80 ms
for chunk in audio_stream():
    partial_text = asr.transcribe_streaming(chunk)
    print(partial_text, end="\r")
```

### 第 4 步：打断处理器

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

依赖异步 I/O 和可取消的 TTS streaming。在 WebRTC 中，调用音频 track 上的 peerconnection.stop() 是规范做法。

## 用起来（Use It）

2026 年的栈：

| 层 | 选型 |
|-------|------|
| 传输（Transport） | LiveKit（WebRTC）或 Pion（Go） |
| VAD | Silero VAD 4.0 |
| Streaming ASR | Parakeet-CTC-0.6B 或 Whisper-Streaming |
| LLM 首 token | Groq、Cerebras、vLLM-streaming |
| Streaming TTS | Kokoro 或 ElevenLabs Turbo v2.5 |
| 回声消除 | WebRTC AEC3 |
| 端到端原生 | OpenAI Realtime API 或 Moshi |

## 陷阱（Pitfalls）

- **「保险起见」缓冲 500 ms。** buffer 本身*就是*你的延迟下限。把它缩小。
- **不固定线程优先级。** 把音频回调放在低于 UI 的优先级线程 = 高负载下出现 glitch。
- **TTS chunk 太小。** 小于 200 ms 的 chunk 会让声码器（vocoder）的伪影变得可闻。320 ms chunk 是甜点。
- **没有 jitter buffer。** 真实网络是抖动的；不平滑就会有爆音（pop）。
- **单点错误处理。** 音频 pipeline 必须防崩溃。一个异常就会杀死整个会话。

## 上线部署（Ship It）

保存为 `outputs/skill-realtime-designer.md`。设计一个实时音频 pipeline，并为每个阶段标注具体的延迟预算。

## 练习（Exercises）

1. **简单。** 运行 `code/main.py`。模拟一个 ring buffer + energy VAD；为一段假的 10 秒流打印各阶段的延迟。
2. **中等。** 用 `sounddevice` 搭一个 passthrough 回路，按 20 ms 帧处理你的麦克风，并在每帧打印 VAD 状态。
3. **困难。** 用 `aiortc` 搭一个全双工回声测试：browser → WebRTC → Python → WebRTC → browser。用 1 kHz 脉冲测量端到端（glass-to-glass）延迟。

## 关键术语（Key Terms）

| 术语 | 大家怎么说 | 实际含义 |
|------|-----------------|-----------------------|
| Ring buffer | 循环队列 | 固定大小、无锁（或 SPSC 加锁）的音频帧 FIFO。 |
| VAD | 静默闸门 | 区分语音 / 非语音的模型或启发式。 |
| Streaming ASR | 实时 STT | 在音频到达时就吐出部分文本；有界 lookahead。 |
| Jitter buffer | 网络平滑器 | 重排乱序包的队列；典型 60–80 ms。 |
| AEC | 回声消除 | 减去喇叭到麦克风的反馈路径。 |
| Barge-in | 用户打断 | 系统在 TTS 中途检测到用户语音；必须取消播放。 |
| Full duplex | 双向同时 | 用户和机器人可以同时说话；Moshi 是全双工。 |

## 延伸阅读（Further Reading）

- [Macháček et al. (2023). Whisper-Streaming](https://arxiv.org/abs/2307.14743) — 切块的近 streaming Whisper。
- [Kyutai (2024). Moshi](https://kyutai.org/Moshi.pdf) — 200 ms 延迟的全双工。
- [LiveKit Agents framework (2024)](https://docs.livekit.io/agents/) — 生产级音频 agent 编排。
- [Silero VAD repo](https://github.com/snakers4/silero-vad) — 亚毫秒级 VAD，Apache 2.0。
- [WebRTC AEC3 paper](https://webrtc.googlesource.com/src/+/main/modules/audio_processing/aec3/) — 开源回声消除。
