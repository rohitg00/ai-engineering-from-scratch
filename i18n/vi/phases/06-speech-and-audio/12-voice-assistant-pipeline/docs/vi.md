# Xây dựng một đường ống trợ lý giọng nói  Lớp 6 Capstone

> Tất cả từ bài học 01-11, được đan kết hợp. Hãy xây dựng một trợ lý giọng nói lắng nghe, lý luận và nói lại. Năm 2026 đó là một vấn đề kỹ thuật được giải quyết, không phải là một vấn đề nghiên cứu  nhưng chi tiết tích hợp quyết định liệu nó có vận chuyển hay không.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 04, 05, 06, 07, 11; Phase 11 · 09 (Function Calling); Phase 14 · 01 (Agent Loop)
**Time:** ~120 minutes

## Vấn đề

Xây dựng một trợ lý đầu đến cuối:

1. Chụp đầu vào micro (16 kHz mono).
2. Khám phá bắt đầu/sự nói của người dùng.
3. Chuyển lại dòng phát.
4. Chuyển bản sao cho một LLM có thể gọi các công cụ (timer, thời tiết, lịch).
5. Chuyển văn bản LLM cho một TTS.
6. Đưa âm thanh trở lại người dùng.
7. Ngưng nếu người dùng gián đoạn giữa phản ứng.

Mục tiêu trễ: đầu tiên TTS byte âm thanh trong vòng 800 ms của người dùng hoàn thành phát biểu của họ trên một CPU máy tính xách tay. Mục tiêu chất lượng: không có từ bỏ, không có phụ đề ảo giác trên im lặng, không có rò rỉ nhân bản giọng nói, không có sự thành công tiêm nhanh chóng.

## Khái niệm

![Voice assistant pipeline: mic → VAD → STT → LLM+tools → TTS → speaker](../assets/voice-assistant.svg)

### Bảy thành phần

1. **Audio capture.**Mic → 16 kHz mono → 20 ms. thường `sounddevice`trong Python hoặc AudioUnit/ALSA/WASAPI bản địa trong sản xuất.
2. **VAD (Lesson 11).**Silero VAD @ ngưỡng 0,5, min nói 250 ms, im lặng hangover 500 ms. tín hiệu "bắt đầu" và "sự kết thúc".
3. **Streaming STT (Lesson 4-5).**Whisper-streaming, Parakeet-TDT, hoặc Deepgram Nova-3 (API).
4. **LLM with tool calling.**GPT-4o / Claude 3.5 / Gemini 2.5 Flash. JSON schema cho công cụ.
5. **Streaming TTS (Lesson 7).**Kokoro-82M (cởi mở nhanh nhất) hoặc Cartesia Sonic (thị mại).
6. **Playback.**Đóng loa; mã hóa opus cho mạng băng thông thấp.
7. **Interruption handler.**Nếu VAD nổ trong thời gian phát lại TTS, dừng phát lại, hủy LLM, khởi động lại STT.

### Ba chế độ thất bại bạn sẽ nhấn

1. **First-word clip.**VAD bắt đầu một đập quá muộn. người dùng "hey" bị mất. bắt đầu ngưỡng ở 0,3, không phải 0,5.
2. **Mid-response interrupt confusion.**LLM tiếp tục tạo sau khi người dùng gián đoạn; trợ lý nói chuyện trên người dùng.
3. **Silence hallucination.**"Cảm ơn vì đã xem" trên khung làm nóng âm thầm.

### 2026 hàng tham chiếu sản xuất

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

## Hãy xây dựng nó

### Bước 1: chụp micro bằng cách chunking (pseudocode)

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

### Bước 2: Tận dạng vòng quay được vạch VAD

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

### Bước 3: streaming STT → LLM → TTS

```python
async def turn(audio_bytes):
    transcript = await stt.transcribe(audio_bytes)
    async for token in llm.stream(transcript):
        async for audio in tts.stream(token):
            await speaker.play(audio)
```

### Bước 4: Công cụ gọi bên trong vòng LLM

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

### Bước 5: xử lý gián đoạn

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

## Sử dụng nó

Nhìn xem`code/main.py`cho một mô phỏng chạy được kết nối tất cả bảy thành phần với các mô hình trục, để bạn có thể thấy hình dạng đường ống ngay cả khi không cần phần cứng.

- `silero-vad`(`pip install silero-vad`(văn)
- `deepgram-sdk`hoặc `openai-whisper`
- `openai`(`gpt-4o`) hoặc `anthropic`
- `kokoro`hoặc `cartesia`
- `sounddevice`cho I/O

## Những bẫy

- **Logging PII forever.**Tiếng nghe quay đầy đủ là thông tin cá nhân ở hầu hết các khu vực pháp lý.
- **No barge-in.**Người dùng sẽ ngắt lời, trợ lý của bạn phải ngừng nói chuyện.
- **TTS that blocks.**TTS đồng bộ chặn vòng lặp sự kiện. Sử dụng async hoặc một chuỗi riêng biệt.
- **No tool-call error handling.**Các công cụ thất bại. LLM phải lấy lại lỗi + thử lại một lần, sau đó hạ thấp lịch sử.
- **Overzealous hallucination filters.**Over-filter và trợ lý lặp lại "Tôi không thể giúp được với điều đó". Under-filter và nó nói bất cứ điều gì.
- **No wake-word option.**Luôn lắng nghe là một trách nhiệm về quyền riêng tư.

## Chuyển nó

Cứ như `outputs/skill-voice-assistant-architect.md`. Với hạn chế ngân sách + quy mô + ngôn ngữ + tuân thủ, tạo ra một thông số kỹ thuật đầy đủ.

## Các bài tập

1. **Easy.**Đi chạy`code/main.py`Nó mô phỏng một vòng hoàn toàn từ đầu đến cuối với các mô-đun và in theo thời gian mỗi giai đoạn.
2. **Medium.**Thay thế STT stub bằng một mô hình Whisper thực sự trên một bản ghi trước `.wav`- đo WER và độ trễ đầu đến cuối.
3. **Hard.**Thêm công cụ gọi: thực hiện `get_weather`(bất kỳ API nào) và `set_timer`. Định hướng LLM qua các công cụ và xác minh rằng khi người dùng nói "đặt một bộ hẹn giờ 5 phút" chức năng đúng phát ra và câu trả lời nói xác nhận điều đó.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Turn | A user + assistant round-trip | One VAD-bounded user speech + one LLM-TTS response. |
| Barge-in | Interruption | User speaks while assistant talks; assistant stops. |
| Wake word | "Hey assistant" | Short keyword detector; Porcupine, Snowboy, openWakeWord. |
| End-pointing | Turn ending | VAD + min-silence decision that user has finished. |
| Pre-roll | Pre-speech buffer | Keep 200-400 ms of audio before VAD fires to avoid first-word clip. |
| Tool call | Function invocation | LLM emits JSON; runtime dispatches; result feeds back in-loop. |

## Đọc thêm

- [LiveKit — voice agent quickstart](https://docs.livekit.io/agents/) tham chiếu cấp sản xuất.
- [Pipecat — voice agent examples](https://github.com/pipecat-ai/pipecat) Khung thân thiện với DIY.
- [OpenAI Realtime API](https://platform.openai.com/docs/guides/realtime) con đường âm thanh bản địa được quản lý.
- [Kyutai Moshi](https://github.com/kyutai-labs/moshi) Đề xuất duplex đầy đủ (Học 15).
- [Porcupine wake-word](https://picovoice.ai/products/porcupine/) Đánh cửa từ thức dậy.
- [Anthropic — tool use guide](https://docs.anthropic.com/en/docs/build-with-claude/tool-use) LLM chức năng gọi.
