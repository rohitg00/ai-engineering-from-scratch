# 构建语音助理管道-第6阶段Capstone

> 第01-11课的所有内容都缝合在一起。构建一个可以倾听、推理和反驳的语音助手。到2026年，这是一个已解决的工程问题，而不是研究问题--但集成细节决定了它是否上市。

** 类型：** 构建
** 语言：** Python
** 先决条件：** 阶段6 · 04、05、06、07、11;阶段11 · 09（功能调用）;阶段14 · 01（代理循环）
** 时间：** ~120分钟

## 问题

构建端到端助理：

1. 捕获麦克风输入（16 GHz单声）。
2. 检测用户语音的开始/结束。
3. 转录流媒体。
4. 将成绩单传递给可以调用工具（计时器，天气，日历）的LLM。
5. 将LLM文本流式传输到TTC。
6. 向用户播放音频。
7. 如果用户在响应过程中中断，则停止。

延迟目标：用户在笔记本电脑中央处理器上完成讲话后800 ms内的第一个TTC音频字节。质量目标：无漏字、静音时无幻觉字幕、无语音克隆泄露、无提示注入成功。

## 概念

![Voice assistant pipeline: mic → VAD → STT → LLM+tools → TTS → speaker](../assets/voice-assistant.svg)

### 七个组成部分

1. ** 音频捕获。**麦克风-16 GHz单声-20 ms块。通常是Python中的“soundsystem”或生产中的本地AudioUnit/ALSA/WASAPI。
2. ** VAR（第11课）。** Silero VAR @阈值0.5，最小语音250 ms，静音宿醉500 ms。信号“开始”和“结束”。"
3. ** 流媒体STT（第4-5课）。** Whisper-streaming、Parakeet-TDT或Deepgram Nova-3（API）。部分+最终成绩单。
4. **LLM，带工具调用。** GPT-4o / Claude 3.5 / Gemini 2.5 Flash。工具的son模式。流代币。
5. ** 流传输TTC（第7课）。** Kokoro-82 M（最快打开）或Cartesia Sonic（商业）。20个LLM代币后开始TTC。
6. ** 回放。**扬声器出局;低带宽网络的操作编码。
7. ** 中断处理器。**如果在TTC播放期间触发VAR，请停止播放，取消LLM，重新启动STT。

### 您将遇到的三种故障模式

1. ** 第一个词剪辑。** VAR开始节拍太晚了。用户的“嘿”缺失。开始阈值为0.3，而不是0.5。
2. ** 中间响应中断混淆。** LLM在用户中断后继续生成;助理与用户交谈。Wire VAD → cancel-LLM。
3. ** 沉默幻觉。** Whisper在静音热身画面上输出“感谢观看”。始终是VAR门。

### 2026年生产参考堆栈

| 堆叠 | 延迟 | 许可证 | 注意到 |
|-------|---------|---------|-------|
| LiveKit + Deepgram + GPT-4o + Cartesia | 350-500毫秒 | 商业API | 2026年行业违约 |
| Pipecat + Whisper-streaming + GPT-4o + Kokoro | 500-800 ms | 大部分开放 | DIY友好 |
| Moshi（全速） | 200-300 ms | CC-BY 4.0 | 单一模型;不同的架构，第15课 |
| Vapi / Retell（管理） | 300-500 ms | 商业 | 推出最快;定制有限 |
| Whisper.cpp + llama.cpp + Kokoro-ONNX | 线下 | 开放 | 隐私/边缘 |

## 建设党

### 第1步：使用分块的麦克风捕获（伪代码）

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

### 第2步：VAR门控转弯捕获

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

### 第3步：流媒体STT → LLM → TTC

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

### 第5步：中断处理

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

## 使用它

请参阅“code/main.py”以获取可运行的模拟，该模拟使用桩模型连接所有七个组件，因此即使没有硬件，您也可以看到管道形状。对于实际实现，请将树桩交换为：

- ' silero-vad '（' pip start silero-vad '）
- “deepgram-sdk”或“openai-whisper”
- “openai”（“gpt-4o”）或“anthropic”
- “kokoro”或“Cartesia”
- 用于I/O的“soundequate”

## 陷阱

- ** 永远记录PRI。**在大多数司法管辖区，全方位音频属于PRI。30-白天保留，休息时加密。
- ** 不得强行闯入。**用户会打断。你的助理必须停止说话。
- ** 会阻塞的TTC。**同步TTC阻止事件循环。使用Deliverc或单独的线程。
- ** 无工具调用错误处理。**工具失效。LLM必须返回错误+重试一次，然后优雅地降级。
- ** 过度热心的幻觉过滤器。**过度过滤，助理重复道：“我对此无能为力。“过滤不足，它可以说明任何情况。在固定的设置上进行校准。
- ** 没有唤醒词选项。**始终倾听是一种隐私责任。添加唤醒字门（Porcupine或openWakeWord）。

## 把它运

另存为“输出/skill-voice-assistant-architect.md”。给定预算+规模+语言+合规性约束，生成完整的堆栈规范。

## 演习

1. ** 简单。**运行'代码/main.py '。它用stub模块模拟一整轮端到端，并打印每阶段的延迟。
2. ** 中等。**在预先录制的“.wav”上用真实的Whisper模型替换STT树桩。测量WER和端到端延迟。
3. ** 很难。**添加工具调用：实现“get_weather”（任何API）和“set_timer”。通过工具路由LLM，并验证当用户说“设置5分钟计时器”时是否会触发正确的功能，并且口头回复会确认这一点。

## 关键术语

| Term | 别人怎么说 | 它实际上意味着什么 |
|------|-----------------|-----------------------|
| 反过来 | 用户+助理往返 | 一个VAR限制的用户语音+一个LLM-TTC响应。 |
| 强插 | 中断 | 用户说话，而助理说话;助理停止。 |
| 唤醒词 | “嘿助理” | 短关键词检测器;豪猪、雪男、openWakeWord。 |
| 终点指示 | 转弯结束 | 用户已完成的VAR+最低静音决定。 |
| 前贴片 | 语音前缓冲区 | 在VAR触发之前保留200-400 ms的音频，以避免第一个词剪辑。 |
| 工具调用 | 函数调用 | LLM发出SON;运行时调度;结果循环反馈。 |

## 进一步阅读

- [LiveKit -语音代理快速启动]（https：//docs.livekit.io/agents/）-生产级参考。
- [Pipecat -语音代理示例]（https：//github.com/pipecat-ai/pipecat）-DIY友好的框架。
- [OpenAI Realtime API]（https：//platform.openai.com/docs/guides/realtime）-托管语音原生路径。
- [Kyutai Moshi]（https：//github.com/kyutai-labs/moshi）-全速参考（第15课）。
- [豪猪唤醒词]（https：//picovoice.ai/products/porcupine/）-唤醒词门控。
- [Anthropic -工具使用指南]（https：//docs.anthropic.com/en/docs/build-with-claude/tool-use）- LLM函数调用。
