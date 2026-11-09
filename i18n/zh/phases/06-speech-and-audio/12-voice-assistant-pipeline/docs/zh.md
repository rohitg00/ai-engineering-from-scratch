# 建立一个语音助理管道 第6阶段的石头

> 根据"一"课程,编织在一起. 建立一个听取,推理和回复的语音助理. 2026年,这是一个解决的工程问题,而不是一个研究问题.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 04, 05, 06, 07, 11; Phase 11 · 09 (Function Calling); Phase 14 · 01 (Agent Loop)
**Time:** ~120 minutes

## 问题

建立一个端到端助理:

1. 捕捉麦克风输入 (16 kHz单频).
2. 检测用户语音的开始/结束.
3. 转载了流媒体.
4. 通过转录到可以调用工具的LLM (计时器,天气,日历).
5. 传递法学士文本给一个TTS.
6. 播放音频回给用户.
7. 如果用户中途响应中断,则停止.

延迟目标:用户在笔记本电脑CPU上完成语音后800ms内首个TTS音频字节.质量目标:没有错过的字符,没有沉默的幻觉字幕,没有语音克隆泄漏,没有快速注射成功.

## 概念

![Voice assistant pipeline: mic → VAD → STT → LLM+tools → TTS → speaker](../assets/voice-assistant.svg)

### 七个组成部分

1. **Audio capture.**微 → 16 kHz 单 → 20 ms 块. 通常`sounddevice`在Python或本土AudioUnit/ALSA/WASAPI中制作.
2. **VAD (Lesson 11).**声,声,声,声,声,声,声,声,声,声,声,声,声,声,声,声,声,声,声,声,声,声,声,声,声,声,声,声,声,声,声,声,声,声,声.
3. **Streaming STT (Lesson 4-5).**微声流,Parakeet-TDT,或深度图 Nova-3 (API).部分+最终转录.
4. **LLM with tool calling.**简单的方法是:
5. **Streaming TTS (Lesson 7).**开启的时间是20个LLM代币后开始TTS.
6. **Playback.**低带宽网络的编码.
7. **Interruption handler.**如果在TTS播放期间发生VAD火灾,停止播放,取消LLM,重新启动STT.

### 你将击中的三个失败模式

1. **First-word clip.**升速度太晚了,用户的""没有,开始门为0.3,而不是0.5.
2. **Mid-response interrupt confusion.**接下来,在用户中断后,LLM继续生成;助理在用户之间谈话.
3. **Silence hallucination.**声在安静的加热上发出"谢谢你看的"

### 2026生产参考堆

| Stack | Latency | License | Notes |
|-------|---------|---------|-------|
| LiveKit + Deepgram + GPT-4o + Cartesia | 350-500 ms | commercial API | Industry default 2026 |
| Pipecat + Whisper-streaming + GPT-4o + Kokoro | 500-800 ms | mostly open | DIY-friendly |
| Moshi (full-duplex) | 200-300 ms | CC-BY 4.0 | Single-model; different architecture, lesson 15 |
| Vapi / Retell (managed) | 300-500 ms | commercial | Fastest to launch; limited customization |
| Whisper.cpp + llama.cpp + Kokoro-ONNX | offline | open | Privacy / edge |

```figure
v4-voice-latency
```

## 建立它

### 步骤1:通过分块 (伪代码) 捕获微信

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

### 步骤2:VAD门转录

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

### 步骤3:播放STT →LLM →TTS

```python
async def turn(audio_bytes):
    transcript = await stt.transcribe(audio_bytes)
    async for token in llm.stream(transcript):
        async for audio in tts.stream(token):
            await speaker.play(audio)
```

### 步骤4:在LLM循环中调用工具

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

### 步骤5: 打断处理

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

## 用它

看到`code/main.py`对于一个可运行模拟,将所有七个组件都与模进行连接,以便即使没有硬件,也可以看到管道形状.

- `silero-vad`(`pip install silero-vad`)
- `deepgram-sdk`或`openai-whisper`
- `openai`(`gpt-4o`) 或`anthropic`
- `kokoro`或`cartesia`
- `sounddevice`对于I/O

## 陷

- **Logging PII forever.**在大多数司法管辖区,全转音频是个人信息.
- **No barge-in.**用户会打断,你的助理必须停止说话.
- **TTS that blocks.**通过同步的TTS,可以阻止事件循环.
- **No tool-call error handling.**工具失败. 法律法师必须恢复错误,再尝试一次,然后优雅地降低.
- **Overzealous hallucination filters.**过度过,助理说"我不能帮你",过下,它说任何东西.
- **No wake-word option.**总是倾听是隐私责任. 添加一个警觉门 (Porcupine或 openWakeWord).

## 运送它

保存如`outputs/skill-voice-assistant-architect.md`鉴于预算+规模+语言+合规性限制, 制作完整的堆规格.

## 运动

1. **Easy.**跑步`code/main.py`它模拟一个完整的转向端到端,
2. **Medium.**取代STT的片用一个现实的Whisper模型在预录音的`.wav`测量WER和端到端延迟.
3. **Hard.**添加工具调用:实现 `get_weather`(任何API) 和`set_timer`通过工具引导LLM,并检查用户说"设置5分钟计时器"时,正确的函数会启动,口头回复会确认这一点.

## 关键词

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Turn | A user + assistant round-trip | One VAD-bounded user speech + one LLM-TTS response. |
| Barge-in | Interruption | User speaks while assistant talks; assistant stops. |
| Wake word | "Hey assistant" | Short keyword detector; Porcupine, Snowboy, openWakeWord. |
| End-pointing | Turn ending | VAD + min-silence decision that user has finished. |
| Pre-roll | Pre-speech buffer | Keep 200-400 ms of audio before VAD fires to avoid first-word clip. |
| Tool call | Function invocation | LLM emits JSON; runtime dispatches; result feeds back in-loop. |

## 进一步阅读

- [LiveKit — voice agent quickstart](https://docs.livekit.io/agents/)生产级参考.
- [Pipecat — voice agent examples](https://github.com/pipecat-ai/pipecat) 适合自动制作的框架.
- [OpenAI Realtime API](https://platform.openai.com/docs/guides/realtime)管理的语音母语路径.
- [Kyutai Moshi](https://github.com/kyutai-labs/moshi) 完全双重参考 (课 15).
- [Porcupine wake-word](https://picovoice.ai/products/porcupine/)警报关门.
- [Anthropic — tool use guide](https://docs.anthropic.com/en/docs/build-with-claude/tool-use) 法学士职能调用.
