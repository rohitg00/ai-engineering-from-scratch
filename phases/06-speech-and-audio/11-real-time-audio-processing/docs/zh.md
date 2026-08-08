# 实时音频处理

> 批处理管道处理文件。实时管道在下一个20毫秒到达之前处理下一个20毫秒。每个对话人工智能、广播工作室和电话机器人的生存和消亡都取决于这个延迟预算。

** 类型：** 构建
** 语言：** Python、Rust
** 先决条件：** 阶段6 · 02（光谱图）、阶段6 · 04（ASB）、阶段6 · 07（TTC）
** 时间：** ~75分钟

## 问题

您想要一个感觉充满活力的语音助理。人类对话的轮流等待时间约为230 ms（静音响应）。超过500 ms的时间感觉像机器人一样;超过1500 ms的时间感觉像破碎一样。2026年完整的 ** 听到、理解、回应、说话 ** 循环的预算是：

| 阶段 | 预算 |
|-------|--------|
| 麦克风→缓冲液 | 20毫秒 |
| VAD | 10 ms |
| ASB（流媒体） | 150 Ms |
| LLM（第一个代币） | 100 ms |
| TTS（第一个块） | 100 ms |
| 渲染-扬声器 | 20毫秒 |
| ** 总数 ** | **~400 ms** |

Moshi（Kyutai，2024）时钟为200 ms的双环。GPT-4 o-realtime（2024）时钟~320 ms。2022年的级联管道出货时间为2500 ms。10倍的改进来自三种技术：（1）无处不在的流式传输，（2）具有部分结果的同步流水线，（3）可中断生成。

## 概念

![Streaming audio pipeline with ring buffer, VAD gate, interruption](../assets/real-time.svg)

** 框架/块/窗口。**实时音频以固定大小的块形式流动。常见选择：20 ms（16 GHz时320个样本）。下游的一切都必须跟上这种节奏。

** 环形缓冲区。**固定大小的循环缓冲区。生产者线程编写新框架，消费者线程读取。防止热路径中的分配。大小：最大延迟x采样率; 2秒16 GHz环= 32，000个采样。

** VAR（语音活动检测）。**下游的盖茨在没有人说话时工作。Silero VAR 4.0（2024）在中央处理器上每30 ms帧运行时间<1 ms。“webrtcvad”是较旧的选择。

** 流媒体ASB。**音频到达时发出部分文字记录的模型。流媒体模式下的Parakeet-CTC-0.6B（NeMo，2024）在320 ms延迟时产生2-5%的WER。耳语流媒体（Macháček等人，2023）块Whisper，以约2秒的延迟接近流媒体。

** 中断。**当用户在助理说话时说话，您必须（a）检测到闯入，（b）停止TTC，（c）丢弃剩余的LLM输出。全部在100 ms内，或者用户感知到聋人助手。

** WebTTC Opus传输。** 20 ms帧，48 GHz，自适应比特率8-128 kps。浏览器和移动设备的标准。LiveKit、Daily.co、Pion是2026年构建语音应用程序的堆栈。

** 抖动缓冲区。**网络数据包无序/迟到。抖动缓冲区重新排序和平滑;太小-可听间隙，太大-延迟。典型值为60-80 ms。

### 常见陷阱

- ** 线程争用。** Python的GIL +重模型可能会导致音频线程挨饿。使用C-回调音频库（sounduser、PortAudio）并阻止Python进入热路径。
- ** 样本率转换延迟。**管道内的重新采样会增加5-20 ms。可以提前重新采样，也可以使用零延迟重新采样器（PolyPhase，' soxr_hq '）。
- ** TTC预充。**即使是像Kokoro这样的快速TTC，也会在首次请求时进行100-200 ms的预热。缓存模型+在第一次真正转弯之前通过虚拟运行来加热它。
- ** 回声取消。**如果没有AEC，TTC输出将重新进入麦克风并触发机器人自己的声音的ASB。WebREC AEC 3是开源默认版本。

## 建设党

### 第1步：环形缓冲区

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

容量决定最大缓冲延迟。32，000个样本，16 GHz = 2 s。

### 第2步：VAR门

```python
def simple_energy_vad(frame, threshold=0.01):
    return sum(x * x for x in frame) / len(frame) > threshold ** 2
```

在生产中替换为Silero VAR：

```python
import torch
vad, _ = torch.hub.load("snakers4/silero-vad", "silero_vad")
is_speech = vad(torch.tensor(frame), 16000).item() > 0.5
```

### 步骤3：流式传输ASR

```python
# Parakeet-CTC-0.6B streaming via NeMo
from nemo.collections.asr.models import EncDecCTCModelBPE
asr = EncDecCTCModelBPE.from_pretrained("nvidia/parakeet-ctc-0.6b")
# chunk_ms=320 ms, look_ahead_ms=80 ms
for chunk in audio_stream():
    partial_text = asr.transcribe_streaming(chunk)
    print(partial_text, end="\r")
```

### 第4步：中断处理程序

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

支持Expressc I/O和可取消的RTS流媒体。音频轨道上的WebRSC peerconnect.stop（）是规范的方式。

## 使用它

2026年堆栈：

| 层 | 接 |
|-------|------|
| 运输 | LiveKit（WebTTC）或Pion（Go） |
| VAD | Silero VAR 4.0 |
| 流媒体ASB | Parakeet-CTC-0.6B或Whisper-Stream |
| LLM第一令牌 | Groq、Cerebras、vLLM-streaming |
| 流媒体TTC | Kokoro或ElevenLabs涡轮v2.5 |
| 回波消除 | WebTTC AEC 3 |
| 端到端原生 | OpenAI实时API或Moshi |

## 陷阱

- ** 缓冲500 ms以确保安全。**缓冲区 * 是 * 您的延迟下限。缩小它。
- ** 不固定线程。**优先级低于UI线程上的音频回调=负载下出现故障。
- ** https块太小。**低于200 ms的块使声码器伪影听得见。320 ms的块是最佳点。
- ** 无抖动缓冲区。**真正的网络是紧张不安的;如果不平滑，你就会爆裂。
- ** 单次错误处理。**音频管道必须防碰撞。一个异常会终止会话。

## 把它运

另存为“输出/skill-realtime-designer.md”。设计每个阶段具有具体延迟预算的实时音频管道。

## 演习

1. ** 简单。**运行'代码/main.py '。模拟环形缓冲区+能量VAR;打印假10秒流的舞台延迟。
2. ** 中等。**使用`sounddevice`，构建一个passthrough循环，以20 ms的帧处理麦克风，并在每帧打印VAD状态。
3. ** 很难。**使用“aiortc”构建全速回声测试：浏览器| WebTTC | Python | WebTTC |浏览器。使用1 GHz脉冲测量玻璃到玻璃的延迟时间。

## 关键术语

| Term | 别人怎么说 | 它实际上意味着什么 |
|------|-----------------|-----------------------|
| 环形缓冲器 | 循环队列 | 用于音频帧的固定大小、无锁（或SPSC锁定）的FIFA。 |
| VAD | 死寂之门 | 模型或启发式标记语音与非语音。 |
| 流媒体ASB | 实时STT | 音频到达时发出部分文本;有界前瞻。 |
| 抖动缓冲器 | 网络更流畅 | 队列重新排序无序数据包;典型值为60-80 ms。 |
| AEC | 回声消除 | 减去扬声器到麦克风的反馈路径。 |
| 强插 | 用户中断 | 系统在TTC中检测到用户语音;必须取消播放。 |
| 全双工 | 两种方式同时进行 | 用户和机器人可以同时通话; Moshi是全速的。 |

## 进一步阅读

- [Mach Aček et al.（2023）. Whisper-Streaming]（https：//arxiv.org/abs/2307.14743）-分块的近流Whisper。
- [Kyutai（2024）。Moshi]（https：//kyutai.org/Moshi.pdf）-全速200 ms延迟。
- [LiveKit Agents框架（2024）]（https：//docs.livekit.io/agents/）-生产音频代理编排。
- [Silero RAD repo]（https：//github.com/snakers4/silero-vad）- sub-1 ms VAR，Apache 2.0。
- [WebREC AEC 3论文]（https：//webrtc.googleance.com/src/+/main/modules/audio_processing/aec3/）-开源下的echo取消。
