# 12 · 构建语音助手管线 —— 第 6 阶段综合实战

> 把 01-11 课的所有内容拼装到一起。构建一个能听、能推理、能回话的语音助手。在 2026 年，这已经是一个被解决了的工程问题，而非研究问题——但整合中的细节，决定了它能否真正交付上线。

**类型：** 实战
**语言：** Python
**前置：** 第 6 阶段 · 04、05、06、07、11；第 11 阶段 · 09（函数调用）；第 14 阶段 · 01（Agent 循环）
**时长：** 约 120 分钟

## 问题

构建一个端到端的助手：

1. 采集麦克风输入（16 kHz 单声道）。
2. 检测用户语音的起点/终点。
3. 流式转写。
4. 把转写文本传给一个能调用工具（计时器、天气、日历）的大语言模型（LLM）。
5. 把 LLM 的文本流式送入「语音合成（TTS）」。
6. 把音频回放给用户。
7. 若用户在助手应答中途打断，则停止。

延迟目标：在笔记本 CPU 上，用户说完话后 800 ms 内输出第一个 TTS 音频字节。质量目标：不漏字、静音时不产生幻觉字幕、不发生声音克隆泄露、提示注入（prompt injection）无法得逞。

## 概念

〔图：语音助手管线：麦克风 → VAD → STT → LLM+工具 → TTS → 扬声器〕

### 七个组件

1. **音频采集。** 麦克风 → 16 kHz 单声道 → 20 ms 分块。在 Python 中通常用 `sounddevice`，生产环境则用原生 AudioUnit/ALSA/WASAPI。
2. **VAD（第 11 课）。** Silero VAD，阈值 0.5，最短语音 250 ms，静音挂起（silence hang-over）500 ms。给出「起点」与「终点」信号。
3. **流式 STT（第 4-5 课）。** Whisper-streaming、Parakeet-TDT，或 Deepgram Nova-3（API）。产出部分转写（partial）与最终转写（final）。
4. **带工具调用的 LLM。** GPT-4o / Claude 3.5 / Gemini 2.5 Flash。工具用 JSON schema 描述。流式输出 token。
5. **流式 TTS（第 7 课）。** Kokoro-82M（开源中最快）或 Cartesia Sonic（商用）。在 LLM 产出 20 个 token 后即开始 TTS。
6. **回放。** 扬声器输出；在低带宽网络下用 opus 编码。
7. **打断处理器。** 若 TTS 回放期间 VAD 被触发，则停止回放、取消 LLM、重启 STT。

### 你必然会遇到的三种失败模式

1. **首字裁切。** VAD 启动晚了一拍。用户的「hey」被丢掉了。把起始阈值设为 0.3，而不是 0.5。
2. **应答中途打断的混乱。** 用户打断后 LLM 仍继续生成；助手压着用户说话。把 VAD → 取消 LLM 接起来。
3. **静音幻觉。** Whisper 在静音的预热帧上输出「Thanks for watching」。永远用 VAD 做闸门。

### 2026 年生产参考技术栈

| 技术栈 | 延迟 | 许可 | 备注 |
|-------|---------|---------|-------|
| LiveKit + Deepgram + GPT-4o + Cartesia | 350-500 ms | 商用 API | 2026 年的行业默认方案 |
| Pipecat + Whisper-streaming + GPT-4o + Kokoro | 500-800 ms | 大部分开源 | 适合自己动手（DIY） |
| Moshi（全双工） | 200-300 ms | CC-BY 4.0 | 单模型；架构不同，见第 15 课 |
| Vapi / Retell（托管） | 300-500 ms | 商用 | 上线最快；定制能力有限 |
| Whisper.cpp + llama.cpp + Kokoro-ONNX | 离线 | 开源 | 隐私 / 边缘 |

## 动手构建

### 第 1 步：带分块的麦克风采集（伪代码）

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

### 第 2 步：VAD 闸控的轮次采集

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

### 第 4 步：在 LLM 循环内进行工具调用

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

## 实际使用

参见 `code/main.py`，那里有一个可运行的模拟，用桩（stub）模型把全部七个组件接在一起，让你即便没有硬件也能看清管线的形态。要做真实实现，把这些桩替换为：

- `silero-vad`（`pip install silero-vad`）
- `deepgram-sdk` 或 `openai-whisper`
- `openai`（`gpt-4o`）或 `anthropic`
- `kokoro` 或 `cartesia`
- 用 `sounddevice` 做 I/O

## 陷阱

- **永久记录 PII。** 在多数司法辖区，整轮音频属于「个人可识别信息（PII）」。保留 30 天，静态加密。
- **没有插话（barge-in）。** 用户一定会打断。你的助手必须停止说话。
- **会阻塞的 TTS。** 同步 TTS 会阻塞事件循环。用异步或单独线程。
- **没有工具调用错误处理。** 工具会失败。必须把错误回传给 LLM 并重试一次，然后优雅降级。
- **过度激进的幻觉过滤。** 过滤过头，助手就会反复说「I can't help with that」；过滤不足，它会胡乱乱说。在留出集（held-out set）上做校准。
- **没有唤醒词选项。** 始终监听是隐私上的负担。加一道唤醒词闸门（Porcupine 或 openWakeWord）。

## 交付

保存为 `outputs/skill-voice-assistant-architect.md`。给定预算 + 规模 + 语言 + 合规约束，产出一份完整的技术栈规格说明。

## 练习

1. **简单。** 运行 `code/main.py`。它用桩模块端到端模拟一个完整轮次，并打印每个阶段的延迟。
2. **中等。** 把 STT 桩替换为在预录制 `.wav` 上运行的真实 Whisper 模型。测量 WER 与端到端延迟。
3. **困难。** 加入工具调用：实现 `get_weather`（任意 API）与 `set_timer`。让 LLM 经过这些工具路由，并验证当用户说「设一个 5 分钟的计时器」时，正确的函数被触发，且语音应答确认了这一点。

## 关键术语

| 术语 | 人们怎么说 | 它实际的含义 |
|------|-----------------|-----------------------|
| Turn（轮次） | 一次用户 + 助手的往返 | 一段由 VAD 界定的用户语音 + 一次 LLM-TTS 应答。 |
| Barge-in（插话） | 打断 | 用户在助手说话时开口；助手停下。 |
| Wake word（唤醒词） | 「Hey assistant」 | 短关键词检测器；Porcupine、Snowboy、openWakeWord。 |
| End-pointing（端点判定） | 轮次结束 | 由 VAD + 最短静音共同判定用户已说完。 |
| Pre-roll（预滚） | 语音前缓冲 | 在 VAD 触发前保留 200-400 ms 音频，以避免首字裁切。 |
| Tool call（工具调用） | 函数调用 | LLM 发出 JSON；运行时分派；结果在循环内回传。 |

## 延伸阅读

- [LiveKit — voice agent quickstart](https://docs.livekit.io/agents/) —— 生产级参考。
- [Pipecat — voice agent examples](https://github.com/pipecat-ai/pipecat) —— 适合自己动手的框架。
- [OpenAI Realtime API](https://platform.openai.com/docs/guides/realtime) —— 托管式、语音原生的路径。
- [Kyutai Moshi](https://github.com/kyutai-labs/moshi) —— 全双工参考（第 15 课）。
- [Porcupine wake-word](https://picovoice.ai/products/porcupine/) —— 唤醒词闸控。
- [Anthropic — tool use guide](https://docs.anthropic.com/en/docs/build-with-claude/tool-use) —— LLM 函数调用。
