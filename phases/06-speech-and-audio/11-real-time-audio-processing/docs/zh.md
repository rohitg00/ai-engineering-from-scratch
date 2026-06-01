# 11 · 实时音频处理

> 批处理管线处理的是一整个文件，而实时管线要在下一个 20 毫秒到达之前处理完当前的这 20 毫秒。每一个对话式 AI、广播工作室和电话机器人，都因这份延迟预算而生死攸关。

**类型：** 构建
**语言：** Python
**前置：** 阶段 6 · 02（频谱图）、阶段 6 · 04（ASR）、阶段 6 · 07（TTS）
**时长：** 约 75 分钟

## 问题所在

你想要一个有生命感的语音助手。人类对话轮换（turn-taking）的延迟约为 230 毫秒（从沉默到回应）。超过 500 毫秒就会显得机械；超过 1500 毫秒则像是坏掉了。在 2026 年，一整套「听见 → 理解 → 回应 → 说出」（hear → understand → respond → speak）循环的预算如下：

| 阶段 | 预算 |
|-------|--------|
| 麦克风 → 缓冲区 | 20 ms |
| VAD | 10 ms |
| ASR（流式） | 150 ms |
| LLM（首个 token） | 100 ms |
| TTS（首个分块） | 100 ms |
| 渲染 → 扬声器 | 20 ms |
| **总计** | **约 400 ms** |

Moshi（Kyutai，2024）实测达到 200 ms 的全双工（full-duplex）延迟。GPT-4o-realtime（2024）约为 320 ms。而 2022 年的级联式（cascaded）管线交付时高达 2500 ms。这 10 倍的提升来自三项技术：（1）全程流式处理；（2）带部分结果（partial results）的异步流水线；（3）可中断的生成。

## 核心概念

〔图：带环形缓冲区、VAD 门控与中断机制的流式音频管线〕

**帧 / 分块 / 窗口（Frame / chunk / window）。** 实时音频以固定大小的块为单位流动。常见选择：20 毫秒（16 kHz 下为 320 个采样点）。下游的所有环节都必须跟上这个节奏。

**环形缓冲区（Ring buffer）。** 固定大小的循环缓冲区。生产者线程写入新帧，消费者线程读取。可避免在热路径（hot path）上分配内存。其大小约等于「最大延迟 × 采样率」；一个 2 秒、16 kHz 的环形缓冲区 = 32,000 个采样点。

**VAD（Voice Activity Detection，语音活动检测）。** 在无人说话时关闭下游工作的门控。Silero VAD 4.0（2024）在 CPU 上处理每个 30 ms 帧仅需 <1 ms。`webrtcvad` 是较早期的替代方案。

**流式 ASR（Streaming ASR）。** 这类模型会随着音频到达而输出部分转写结果。Parakeet-CTC-0.6B 在流式模式下（NeMo，2024）以 320 ms 延迟达到 2–5% 的 WER。Whisper-Streaming（Macháček 等人，2023）将 Whisper 分块处理，以约 2 秒延迟实现近似流式。

**中断（Interruption）。** 当用户在助手说话时开口，你必须做到：（a）检测到插话（barge-in），（b）停止 TTS，（c）丢弃剩余的 LLM 输出。这一切都要在 100 ms 内完成，否则用户会觉得助手是个聋子。

**WebRTC Opus 传输。** 20 ms 帧，48 kHz，自适应码率 8–128 kbps。是浏览器和移动端的标准。LiveKit、Daily.co、Pion 是 2026 年构建语音应用的技术栈。

**抖动缓冲区（Jitter buffer）。** 网络数据包会乱序 / 延迟到达。抖动缓冲区负责重排序并平滑；太小 → 出现可听见的空白，太大 → 增加延迟。典型值为 60–80 ms。

### 常见陷阱

- **线程争用（Thread contention）。** Python 的 GIL 加上重型模型会饿死音频线程。应使用基于 C 回调的音频库（sounddevice、PortAudio），并让 Python 远离热路径。
- **采样率转换延迟。** 在管线内部重采样会增加 5–20 ms。要么在最前端就完成重采样，要么使用零延迟重采样器（PolyPhase、`soxr_hq`）。
- **TTS 预热（priming）。** 即便是 Kokoro 这样快速的 TTS，首次请求也有 100–200 ms 的预热时间。应缓存模型，并在第一个真实轮次之前用一次空跑（dummy run）来预热它。
- **回声消除（Echo cancellation）。** 没有 AEC，TTS 的输出会重新进入麦克风，触发 ASR 去识别机器人自己的声音。WebRTC AEC3 是开源领域的默认选择。

## 动手构建

### 第 1 步：环形缓冲区

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

容量决定了最大缓冲延迟。16 kHz 下 32,000 个采样点 = 2 秒。

### 第 2 步：VAD 门控

```python
def simple_energy_vad(frame, threshold=0.01):
    return sum(x * x for x in frame) / len(frame) > threshold ** 2
```

在生产环境中替换为 Silero VAD：

```python
import torch
vad, _ = torch.hub.load("snakers4/silero-vad", "silero_vad")
is_speech = vad(torch.tensor(frame), 16000).item() > 0.5
```

### 第 3 步：流式 ASR

```python
# 通过 NeMo 实现 Parakeet-CTC-0.6B 流式
from nemo.collections.asr.models import EncDecCTCModelBPE
asr = EncDecCTCModelBPE.from_pretrained("nvidia/parakeet-ctc-0.6b")
# chunk_ms=320 ms, look_ahead_ms=80 ms
for chunk in audio_stream():
    partial_text = asr.transcribe_streaming(chunk)
    print(partial_text, end="\r")
```

### 第 4 步：中断处理器

```python
class Dialog:
    def __init__(self):
        self.tts_task = None

    def on_user_speech(self, frame):
        if self.tts_task and not self.tts_task.done():
            self.tts_task.cancel()   # 插话（barge-in）
        # 然后送入流式 ASR

    def on_final_user_utterance(self, text):
        self.tts_task = asyncio.create_task(self.reply(text))

    async def reply(self, text):
        async for tts_chunk in llm_then_tts(text):
            speaker.write(tts_chunk)
```

这依赖于异步 I/O 和可取消的 TTS 流式输出。在音频轨道上调用 WebRTC 的 peerconnection.stop() 是规范做法。

## 实战运用

2026 年的技术栈：

| 层级 | 选型 |
|-------|------|
| 传输 | LiveKit（WebRTC）或 Pion（Go） |
| VAD | Silero VAD 4.0 |
| 流式 ASR | Parakeet-CTC-0.6B 或 Whisper-Streaming |
| LLM 首 token | Groq、Cerebras、vLLM-streaming |
| 流式 TTS | Kokoro 或 ElevenLabs Turbo v2.5 |
| 回声消除 | WebRTC AEC3 |
| 端到端原生 | OpenAI Realtime API 或 Moshi |

## 易踩的坑

- **为了保险而缓冲 500 ms。** 缓冲区*就是*你的延迟下限。把它缩小。
- **不固定线程优先级。** 音频回调跑在低于 UI 的线程优先级上 = 高负载下出现卡顿。
- **TTS 分块太小。** 低于 200 ms 的分块会让声码器（vocoder）伪影变得可听见。320 ms 分块是最佳平衡点。
- **没有抖动缓冲区。** 真实网络是抖动的；没有平滑就会出现爆音。
- **一次性错误处理。** 音频管线必须做到崩溃免疫。一个异常就会杀死整个会话。

## 交付成果

保存为 `outputs/skill-realtime-designer.md`。设计一条实时音频管线，并为每个阶段给出具体的延迟预算。

## 练习

1. **简单。** 运行 `code/main.py`。它会模拟一个环形缓冲区 + 能量 VAD；针对一段虚构的 10 秒流打印各阶段的延迟。
2. **中等。** 使用 `sounddevice`，构建一个直通（passthrough）循环，以 20 ms 帧为单位处理你的麦克风输入，并在每一帧打印 VAD 状态。
3. **困难。** 用 `aiortc` 构建一个全双工回声测试：浏览器 → WebRTC → Python → WebRTC → 浏览器。用一个 1 kHz 脉冲测量端到端（glass-to-glass）延迟。

## 关键术语

| 术语 | 大家怎么说 | 它实际指什么 |
|------|-----------------|-----------------------|
| Ring buffer（环形缓冲区） | 那个循环队列 | 用于音频帧的固定大小、无锁（或 SPSC 加锁）FIFO。 |
| VAD | 静音门控 | 标记语音与非语音的模型或启发式方法。 |
| Streaming ASR（流式 ASR） | 实时 STT | 随音频到达输出部分文本；带有有界前瞻（lookahead）。 |
| Jitter buffer（抖动缓冲区） | 网络平滑器 | 对乱序数据包重排序的队列；典型值 60–80 ms。 |
| AEC | 回声消除 | 减去扬声器到麦克风的反馈路径。 |
| Barge-in（插话） | 用户打断 | 系统在 TTS 进行中检测到用户说话；必须取消播放。 |
| Full duplex（全双工） | 双向同时进行 | 用户和机器人可同时说话；Moshi 即为全双工。 |

## 延伸阅读

- [Macháček 等人（2023）。Whisper-Streaming](https://arxiv.org/abs/2307.14743) —— 分块的近似流式 Whisper。
- [Kyutai（2024）。Moshi](https://kyutai.org/Moshi.pdf) —— 全双工 200 ms 延迟。
- [LiveKit Agents 框架（2024）](https://docs.livekit.io/agents/) —— 生产级音频智能体编排。
- [Silero VAD 仓库](https://github.com/snakers4/silero-vad) —— 亚毫秒级 VAD，Apache 2.0。
- [WebRTC AEC3 论文](https://webrtc.googlesource.com/src/+/main/modules/audio_processing/aec3/) —— 开源的回声消除。
