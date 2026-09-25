# 构建语音助手流水线 —— 第 6 阶段毕业项目

> 综合运用第 01-11 课的全部内容。构建一个能听、能推理、能回应的语音助手。在 2026 年，这已是一个已解决的工程问题，而非研究问题——但集成细节决定了它能否真正上线。

**Type:** Build
**Languages:** Python
**Prerequisites:** 第 6 阶段 · 04, 05, 06, 07, 11；第 11 阶段 · 09（Function Calling）；第 14 阶段 · 01（Agent Loop）
**Time:** 约 120 分钟

## 问题

构建一个端到端助手：

1. 采集麦克风输入（16 kHz 单声道）。
2. 检测用户语音的起止。
3. 流式转录。
4. 将转录文本传递给可调用工具的 LLM（计时器、天气、日历）。
5. 将 LLM 文本流式输入 TTS。
6. 向用户播放音频。
7. 若用户在响应中途打断，则停止。

延迟目标：在笔记本 CPU 上，用户说完话后 800 ms 内输出第一字节 TTS 音频。质量目标：不漏词、静音时不产生幻觉字幕、无声音克隆泄露、无提示词注入成功案例。

## 概念

![Voice assistant pipeline: mic → VAD → STT → LLM+tools → TTS → speaker](../assets/voice-assistant.svg)

### 七个组件

1. **音频采集。** 麦克风 → 16 kHz 单声道 → 20 ms 数据块。Python 中通常用 `sounddevice`，生产环境中用原生 AudioUnit/ALSA/WASAPI。
2. **VAD（第 11 课）。** Silero VAD，阈值 0.5，最短语音 250 ms，静音挂起 500 ms。发出“开始”和“结束”信号。
3. **流式 STT（第 4-5 课）。** Whisper-streaming、Parakeet-TDT 或 Deepgram Nova-3（API）。部分转录 + 最终转录。
4. **带工具调用的 LLM。** GPT-4o / Claude 3.5 / Gemini 2.5 Flash。工具使用 JSON schema。流式输出 token。
5. **流式 TTS（第 7 课）。** Kokoro-82M（最快的开源方案）或 Cartesia Sonic（商用）。积累 20 个 LLM token 后启动 TTS。
6. **播放。** 扬声器输出；低带宽网络用 opus 编码。
7. **打断处理器。** 若 VAD 在 TTS 播放期间触发，停止播放、取消 LLM、重启 STT。

### 你会遇到的三种失败模式

1. **首词截断。** VAD 启动偏晚，用户的"hey"丢失。起始阈值应为 0.3，而非 0.5。
2. **响应中途打断引起混乱。** 用户打断后 LLM 继续生成，助手抢着说话。需将 VAD 连接到取消 LLM 的逻辑。
3. **静音幻觉。** Whisper 在静音预热帧上输出“Thanks for watching”。务必用 VAD 门控。

### 2026 年生产参考技术栈

| 技术栈 | 延迟 | 许可证 | 备注 |
|-------|---------|---------|-------|
| LiveKit + Deepgram + GPT-4o + Cartesia | 350-500 ms | 商用 API | 2026 年行业默认方案 |
| Pipecat + Whisper-streaming + GPT-4o + Kokoro | 500-800 ms | 大部分开源 | 适合 DIY |
| Moshi（全双工） | 200-300 ms | CC-BY 4.0 | 单模型；不同架构，第 15 课 |
| Vapi / Retell（托管） | 300-500 ms | 商用 | 上线最快；定制受限 |
| Whisper.cpp + llama.cpp + Kokoro-ONNX | 离线 | 开源 | 隐私 / 边缘部署 |

```figure
v4-voice-latency
```

## 动手构建

### 第 1 步：分块的麦克风采集（伪代码）

```python
import sounddevice as sd

def mic_stream(chunk_ms=20, sr=16000):
    q = queue.Queue()
    def cb(indata, frames, time, status):
        q.put(indata.copy().flatten())
    with sd.InputStream(channels=1, samplerate=sr, blocksize=int(sr * chunk_ms/1000), callback=cb):
        while True:
            yield q.get()
```

### 第 2 步：VAD 门控的回合捕获

```python
def capture_turn(stream, vad, pre_roll_ms=300, silence_ms=500):
    buf, pre, triggered = [], collections.deque(maxlen=pre_roll_ms // 20), False
    silent = 0
    for chunk in stream:
        pre.append(chunk)
        if vad(chunk):
            if not triggered:
                buf = list(pre)
                triggered = True
            buf.append(chunk)
            silent = 0
        elif triggered:
            silent += 20
            buf.append(chunk)
            if silent >= silence_ms:
                return b"".join(buf)
```

### 第 3 步：流式 STT → LLM → TTS

```python
async def turn(audio_bytes):
    transcript = await stt.transcribe(audio_bytes)
    async for token in llm.stream(transcript):
        async for audio in tts.stream(token):
            await speaker.play(audio)
```

### 第 4 步：LLM 循环内的工具调用

```python
tools = [
    {"name": "get_weather", "parameters": {"location": "string"}},
    {"name": "set_timer", "parameters": {"seconds": "int"}},
]

async for chunk in llm.stream(user_text, tools=tools):
    if chunk.type == "tool_call":
        result = dispatch(chunk.name, chunk.args)
        continue_streaming(result)
    if chunk.type == "text":
        await tts.stream(chunk.text)
```

### 第 5 步：打断处理

```python
tts_task = asyncio.create_task(tts_loop())
while True:
    chunk = await mic.get()
    if vad(chunk):
        tts_task.cancel()
        await speaker.stop()
        await new_turn()
        break
```

## 使用

参见 `code/main.py`，它是一个可运行的仿真，用桩模型连接全部七个组件，因此即使没有硬件也能看清流水线结构。若要真实实现，请将桩替换为：

- `silero-vad`（`pip install silero-vad`）
- `deepgram-sdk` 或 `openai-whisper`
- `openai`（`gpt-4o`）或 `anthropic`
- `kokoro` 或 `cartesia`
- 用于 I/O 的 `sounddevice`

## 常见陷阱

- **永久记录 PII。** 在大多数司法辖区，完整回合的音频属于 PII。保留 30 天，静态加密存储。
- **没有插话支持。** 用户一定会打断。你的助手必须停止说话。
- **阻塞式 TTS。** 同步 TTS 会阻塞事件循环。使用异步或独立线程。
- **没有工具调用错误处理。** 工具会失败。LLM 必须收到错误并重试一次，然后优雅降级。
- **过于激进的幻觉过滤器。** 过滤过度，助手会反复说“我帮不了这个”；过滤不足，它什么都说。在留出集上校准。
- **没有唤醒词选项。** 持续监听是隐私隐患。增加唤醒词门控（Porcupine 或 openWakeWord）。

## 上线交付

保存为 `outputs/skill-voice-assistant-architect.md`。根据预算 + 规模 + 语言 + 合规约束，产出完整的全栈技术规格。

## 练习

1. **简单。** 运行 `code/main.py`。它用桩模块端到端模拟一个完整回合，并打印各阶段延迟。
2. **中等。** 将 STT 桩替换为在预录制的 `.wav` 上运行的真实 Whisper 模型。测量 WER 和端到端延迟。
3. **困难。** 添加工具调用：实现 `get_weather`（任意 API）和 `set_timer`。将 LLM 路由到这些工具，并验证当用户说“设置一个 5 分钟计时器”时，正确的函数被触发且语音回复予以确认。

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|-----------------|-----------------------|
| Turn（回合） | 用户 + 助手的一次往返 | 一次由 VAD 界定的用户语音 + 一次 LLM-TTS 响应。 |
| Barge-in（插话） | 打断 | 助手说话时用户开口；助手停止。 |
| Wake word（唤醒词） | "Hey assistant" | 短关键词检测器；Porcupine、Snowboy、openWakeWord。 |
| End-pointing（端点检测） | 回合结束 | VAD + 最短静音判定用户已说完。 |
| Pre-roll（预滚缓冲） | 语音前缓冲 | 在 VAD 触发前保留 200-400 ms 音频，避免首词截断。 |
| Tool call（工具调用） | 函数调用 | LLM 输出 JSON；运行时分发；结果回传至循环内。 |

## 延伸阅读

- [LiveKit — 语音智能体快速入门](https://docs.livekit.io/agents/) — 生产级参考。
- [Pipecat — 语音智能体示例](https://github.com/pipecat-ai/pipecat) — 适合 DIY 的框架。
- [OpenAI Realtime API](https://platform.openai.com/docs/guides/realtime) — 托管的语音原生路径。
- [Kyutai Moshi](https://github.com/kyutai-labs/moshi) — 全双工参考（第 15 课）。
- [Porcupine 唤醒词](https://picovoice.ai/products/porcupine/) — 唤醒词门控。
- [Anthropic — 工具使用指南](https://docs.anthropic.com/en/docs/build-with-claude/tool-use) — LLM 函数调用。