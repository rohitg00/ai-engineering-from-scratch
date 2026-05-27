# 构建语音助手流水线 — 第六阶段结业项目

> 将第01-11课的所有内容整合在一起。构建一个能听、能思考、能回话的语音助手。在2026年，这是一个工程问题而非研究问题——但集成细节决定了它能否落地。

**类型：** 构建  
**语言：** Python  
**前置要求：** 第六阶段 · 04、05、06、07、11；第十一阶段 · 09（函数调用）；第十四阶段 · 01（代理循环）  
**时长：** 约120分钟

## 问题

构建一个端到端的助手：

1. 捕获麦克风输入（16 kHz 单声道）。
2. 检测用户语音的开始和结束。
3. 流式转录。
4. 将转录文本传递给能调用工具（定时器、天气、日历）的LLM。
5. 将LLM文本流式输出到TTS。
6. 将音频播放回用户。
7. 如果在回复过程中用户打断，则停止播放。

延迟目标：在笔记本电脑CPU上，用户说完话后800毫秒内输出第一个TTS音频字节。质量目标：无漏词、无声时无幻觉字幕、无声音克隆泄露、无提示注入成功。

## 概念

![语音助手流水线：麦克风 → VAD → STT → LLM+工具 → TTS → 扬声器](../assets/voice-assistant.svg)

### 七个组件

1. **音频捕获**。麦克风 → 16 kHz 单声道 → 20 ms 块。Python中通常用 `sounddevice`，生产环境中用原生 AudioUnit/ALSA/WASAPI。
2. **VAD（第11课）**。Silero VAD，阈值0.5，最小语音250 ms，静默挂起500 ms。输出"开始"和"结束"信号。
3. **流式STT（第4-5课）**。Whisper-streaming、Parakeet-TDT 或 Deepgram Nova-3（API）。输出部分和最终转录文本。
4. **带工具调用的LLM**。GPT-4o / Claude 3.5 / Gemini 2.5 Flash。工具使用JSON Schema。流式输出Token。
5. **流式TTS（第7课）**。Kokoro-82M（最快的开源）或 Cartesia Sonic（商业）。在收到20个LLM Token后开始TTS。
6. **播放**。扬声器输出；低带宽网络下用opus编码。
7. **中断处理**。如果TTS播放期间VAD触发，则停止播放、取消LLM、重启STT。

### 你会遇到的三种失败模式

1. **首字截断**。VAD触发稍晚一拍，用户说的"嘿"丢失。起始阈值设为0.3而不是0.5。
2. **回复中途中断混乱**。用户打断后LLM仍在生成，助手与用户抢话。将VAD连接到取消LLM。
3. **静音幻觉**。Whisper在静音预热帧上输出"Thanks for watching"始终使用VAD门控。

### 2026年生产参考栈

| 栈 | 延迟 | 许可证 | 说明 |
|-----|------|--------|------|
| LiveKit + Deepgram + GPT-4o + Cartesia | 350-500 ms | 商业API | 2026年行业默认 |
| Pipecat + Whisper-streaming + GPT-4o + Kokoro | 500-800 ms | 大多开源 | 适合DIY |
| Moshi（全双工） | 200-300 ms | CC-BY 4.0 | 单一模型；不同架构，第15课 |
| Vapi / Retell（托管） | 300-500 ms | 商业 | 最快上线，定制有限 |
| Whisper.cpp + llama.cpp + Kokoro-ONNX | 离线 | 开源 | 隐私/边缘计算 |

## 构建

### 步骤1：带分块的麦克风捕获（伪代码）

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

### 步骤2：VAD门控的轮次捕获

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

### 步骤3：流式STT → LLM → TTS

```python
async def turn(audio_bytes):
    transcript = await stt.transcribe(audio_bytes)
    async for token in llm.stream(transcript):
        async for audio in tts.stream(token):
            await speaker.play(audio)
```

### 步骤4：LLM循环内的工具调用

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

### 步骤5：中断处理

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

参见 `code/main.py`，这是一个可运行的模拟程序，用桩模块连接所有七个组件，让你即使没有硬件也能看到流水线形状。要实现真实的系统，请替换以下桩模块：

- `silero-vad`（`pip install silero-vad`）
- `deepgram-sdk` 或 `openai-whisper`
- `openai`（`gpt-4o`）或 `anthropic`
- `kokoro` 或 `cartesia`
- `sounddevice` 用于I/O

## 陷阱

- **永久记录PII**。完整轮次音频在大多数司法管辖区属于PII。保留30天，静态加密。
- **无"闯入"（Barge-in）功能**。用户会打断。你的助手必须停止说话。
- **阻塞的TTS**。同步TTS会阻塞事件循环。使用异步或独立线程。
- **无工具调用错误处理**。工具会失败。LLM必须接收错误并重试一次，然后优雅降级。
- **过度激进的幻觉过滤器**。过滤过度，助手会重复"我无法帮助这个"。过滤不足，它什么都说。在保留集上校准。
- **无唤醒词选项**。始终监听是隐私责任。添加唤醒词门控（Porcupine 或 openWakeWord）。

## 交付

保存为 `outputs/skill-voice-assistant-architect.md`。根据预算、规模、语言和合规约束，给出完整的技术栈规格说明。

## 练习

1. **简单**。运行 `code/main.py`。它使用桩模块端到端模拟一个完整轮次，并打印每阶段延迟。
2. **中等**。将STT桩模块替换为真实的Whisper模型，处理预录的 `.wav` 文件。测量WER（词错误率）和端到端延迟。
3. **困难**。添加工具调用：实现 `get_weather`（任何API）和 `set_timer`。让LLM通过工具路由，并验证当用户说"设置一个5分钟定时器"时，正确的函数被触发，并且语音回复确认了该操作。

## 关键术语

| 术语 | 习惯说法 | 实际含义 |
|------|---------|---------|
| Turn（轮次） | 用户+助手的往返 | 一次VAD界定的用户语音 + 一次LLM-TTS响应 |
| Barge-in（闯入） | 打断 | 用户说话时助手在说话；助手停止 |
| Wake word（唤醒词） | "嘿助手" | 短关键词检测器；Porcupine、Snowboy、openWakeWord |
| End-pointing（端点检测） | 轮次结束 | VAD + 最小静默判定用户已说完 |
| Pre-roll（预卷） | 语音前缓冲 | 在VAD触发前保留200-400毫秒音频，避免首字截断 |
| Tool call（工具调用） | 函数调用 | LLM输出JSON；运行时调度；结果在循环内反馈 |

## 延伸阅读

- [LiveKit — 语音代理快速入门](https://docs.livekit.io/agents/) — 生产级参考
- [Pipecat — 语音代理示例](https://github.com/pipecat-ai/pipecat) — 适合DIY的框架
- [OpenAI Realtime API](https://platform.openai.com/docs/guides/realtime) — 托管式语音原生路径
- [Kyutai Moshi](https://github.com/kyutai-labs/moshi) — 全双工参考（第15课）
- [Porcupine唤醒词](https://picovoice.ai/products/porcupine/) — 唤醒词门控
- [Anthropic — 工具使用指南](https://docs.anthropic.com/en/docs/build-with-claude/tool-use) — LLM函数调用