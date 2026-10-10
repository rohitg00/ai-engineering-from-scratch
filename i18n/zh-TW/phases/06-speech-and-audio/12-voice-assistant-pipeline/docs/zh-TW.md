# 打造語音助理管線（voice assistant pipeline）：第 6 階段總整課

> 把第 01 到 11 課的內容整合起來。做一個會聽、會推理、會回嘴的語音助理。2026 年這是已解的工程問題，不是研究問題。能不能交付，看整合細節。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 6 · 04, 05, 06, 07, 11; Phase 11 · 09 (Function Calling); Phase 14 · 01 (Agent Loop)
**Time:** ~120 minutes

## The Problem｜問題

做一個端到端助理：

1. 擷取麥克風輸入（16 kHz、單聲道）。
2. 偵測使用者語音的開始和結束。
3. 串流轉錄。
4. 把逐字稿交給能呼叫工具的 LLM（計時器、天氣、行事曆）。
5. 把 LLM 文字串流到 TTS。
6. 把音訊播回給使用者。
7. 使用者在回應中途打斷就停。

延遲目標：在筆電 CPU 上，使用者說完之後 800 毫秒內送出第一個 TTS 音訊位元組。品質目標：不漏字、靜音上不出現幻覺字幕、沒有聲音仿製外洩、prompt 注入不能成功。

## The Concept｜核心概念

![Voice assistant pipeline: mic → VAD → STT → LLM+tools → TTS → speaker](../assets/voice-assistant.svg)

### 七個元件

1. **音訊擷取（audio capture）。** 麥克風到 16 kHz 單聲道，再到 20 毫秒的塊。Python 通常用 `sounddevice`。正式環境用原生的 AudioUnit、ALSA、WASAPI。
2. **VAD（第 11 課）。** Silero VAD，閾值 0.5，最短語音 250 毫秒，靜音拖尾 500 毫秒。發出「開始」和「結束」。
3. **串流語音轉文字（第 4 到 5 課）。** Whisper-streaming、Parakeet-TDT，或 Deepgram Nova-3（API）。部分逐字稿加最終逐字稿。
4. **帶工具呼叫的 LLM。** GPT-4o、Claude 3.5、Gemini 2.5 Flash。工具用 JSON schema。串流 token。
5. **串流 TTS（第 7 課）。** Kokoro-82M（最快的開放模型）或 Cartesia Sonic（商業）。LLM 產生 20 個 token 就開始 TTS。
6. **播放。** 喇叭輸出。低頻寬網路用 Opus 編碼。
7. **打斷處理器。** TTS 播放中 VAD 觸發，就停播放、取消 LLM、重新開始語音轉文字。

### 你一定會遇到的三種失敗模式

1. **第一個字被切掉。** VAD 慢一拍才開始。使用者的「hey」不見了。開始閾值用 0.3，不要用 0.5。
2. **回應中途打斷搞混。** 使用者打斷之後 LLM 還在生成，助理蓋過使用者。把 VAD 接到取消 LLM。
3. **靜音幻覺。** Whisper 在暖機的靜音音框上輸出「Thanks for watching」。一律先用 VAD 篩掉靜音。

### 2026 年正式環境的參考堆疊

| 堆疊 | 延遲 | 授權 | 備註 |
|-------|---------|---------|-------|
| LiveKit 加 Deepgram 加 GPT-4o 加 Cartesia | 350 到 500 毫秒 | 商業 API | 2026 年業界預設 |
| Pipecat 加 Whisper-streaming 加 GPT-4o 加 Kokoro | 500 到 800 毫秒 | 大多開放 | 適合自己做 |
| Moshi（全雙工） | 200 到 300 毫秒 | CC-BY 4.0 | 單一模型。架構不同，第 15 課 |
| Vapi／Retell（代管） | 300 到 500 毫秒 | 商業 | 最快上線。客製有限 |
| Whisper.cpp 加 llama.cpp 加 Kokoro-ONNX | 離線 | 開放 | 隱私／邊緣 |

```figure
v4-voice-latency
```

## Build It｜動手實作

### 步驟 1：切塊擷取麥克風（偽程式）

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

### 步驟 2：VAD 閘控的輪次擷取

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

### 步驟 3：串流語音轉文字，到 LLM，到 TTS

```python
async def turn(audio_bytes):
    transcript = await stt.transcribe(audio_bytes)
    async for token in llm.stream(transcript):
        async for audio in tts.stream(token):
            await speaker.play(audio)
```

### 步驟 4：LLM 迴圈裡的工具呼叫

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

### 步驟 5：打斷處理

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

## Use It｜實際應用

看 `code/main.py`。它用替身模型把七個元件接起來，沒有硬體也能看到管線形狀。真的實作時，把替身換成：

- `silero-vad`（`pip install silero-vad`）
- `deepgram-sdk` 或 `openai-whisper`
- `openai`（`gpt-4o`）或 `anthropic`
- `kokoro` 或 `cartesia`
- I/O 用 `sounddevice`

## Pitfalls｜容易踩的坑

- **永久記錄個人資料。** 整輪音訊在大多數法域都是個人資料。保留 30 天，並對儲存中的資料加密。
- **沒有插話。** 使用者會打斷。助理必須停止說話。
- **TTS 會堵住。** 同步 TTS 會堵住事件迴圈。用非同步，或另開執行緒。
- **工具呼叫沒有錯誤處理。** 工具會失敗。LLM 必須拿回錯誤、重試一次，然後優雅降級。
- **幻覺過濾太兇。** 濾太兇，助理會一直說「I can't help with that」。濾太鬆，它什麼都說。在留出集上調。
- **沒有喚醒詞選項。** 持續聆聽是隱私風險。加一個喚醒詞閘（Porcupine 或 openWakeWord）。

## Ship It｜交付成果

存成 `outputs/skill-voice-assistant-architect.md`。依預算、規模、語言和合規限制，產出完整的堆疊規格。

## Exercises｜練習

1. **簡單。** 跑 `code/main.py`。它用替身模組模擬一整輪端到端，並印出各階段延遲。
2. **中等。** 把語音轉文字替身換成真正的 Whisper，吃預錄的 `.wav`。量 WER 和端到端延遲。
3. **困難。** 加上工具呼叫：實作 `get_weather`（任何 API）和 `set_timer`。讓 LLM 走這些工具。使用者說「set a 5 minute timer」時，確認對的函式被叫到，口語回覆也確認了。

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|-----------------|-----------------------|
| 輪次 | 使用者和助理一來回 | 一次由 VAD 框住的使用者語音，加一次 LLM 到 TTS 的回應。 |
| 插話 | 打斷 | 助理還在說時使用者開口。助理停下。 |
| 喚醒詞 | 「Hey assistant」 | 短的關鍵詞偵測器。Porcupine、Snowboy、openWakeWord。 |
| 結束點（endpoint） | 輪次結束 | VAD 加最短靜音，判定使用者說完了。 |
| 預捲（pre-roll） | 語音前緩衝 | VAD 觸發前留 200 到 400 毫秒音訊，避免第一個字被切掉。 |
| 工具呼叫 | 函式呼叫 | LLM 發出 JSON。執行環境分派。結果在迴圈裡送回去。 |

## Further Reading｜延伸閱讀

- [LiveKit — voice agent quickstart](https://docs.livekit.io/agents/) ——正式環境等級的參考。
- [Pipecat — voice agent examples](https://github.com/pipecat-ai/pipecat) ——適合自己做的框架。
- [OpenAI Realtime API](https://platform.openai.com/docs/guides/realtime) ——代管的語音原生路徑。
- [Kyutai Moshi](https://github.com/kyutai-labs/moshi) ——全雙工參考（第 15 課）。
- [Porcupine wake-word](https://picovoice.ai/products/porcupine/) ——喚醒詞閘。
- [Anthropic — tool use guide](https://docs.anthropic.com/en/docs/build-with-claude/tool-use) ——LLM 的函式呼叫。
