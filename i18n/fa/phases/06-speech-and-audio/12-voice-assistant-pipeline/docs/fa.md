# ساخت خط لوله دستیار صدا  مرحله 6 Capstone

> همه چیز از درس های 01-11، با هم جویده شده است. یک دستیار صوتی بسازید که گوش می دهد، استدلال می کند و صحبت می کند. در سال 2026 این یک مشکل مهندسی حل شده است، نه یک مشکل تحقیقاتی  اما جزئیات ادغام تصمیم می گیرند که آیا آن را حمل و نقل می کند.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 04, 05, 06, 07, 11; Phase 11 · 09 (Function Calling); Phase 14 · 01 (Agent Loop)
**Time:** ~120 minutes

## مشکل

یک دستیار از آخر به آخر بسازید:

1. درایو میکرو (16 kHz mono) را ضبط می کند.
2. شروع/آخر صحبت کاربر را تشخیص می دهد.
3. پخش پخش رو نقل ميکنه
4. نقل نامه را به یک LLM که می تواند ابزار (تایمر، آب و هوا، تقویم) را فراخوانی کند، می دهد.
5. متن LLM رو به TTS پخش ميکنه
6. صدا را به کاربر باز می کند.
7. اگر کاربر در جواب وسط کار را قطع کند متوقف می شود.

هدف لانتین: اولین بائت صوتی TTS در عرض 800 ms از زمانی که کاربر سخنرانی خود را در یک پردازنده لپ تاپ تکمیل می کند. هدف کیفیت: هیچ کلمه ای از دست رفته، هیچ زیرنویس هالوسیناتی در سکوت، هیچ تخلیه کلون صدا، هیچ موفقیت تزریق فوری.

## مفهوم

![Voice assistant pipeline: mic → VAD → STT → LLM+tools → TTS → speaker](../assets/voice-assistant.svg)

### هفت بخش

1. **Audio capture.**میکرو → 16 کیلو هرتز مونو → 20 ms قطعه. معمولا `sounddevice`در پایتون یا AudioUnit/ALSA/WASAPI بومی در تولید.
2. **VAD (Lesson 11).**سیلرو VAD @ حد 0.5، دقیقه صحبت 250 ms، خاموشی 500 ms. سیگنال "شروع" و "نهایت"
3. **Streaming STT (Lesson 4-5).**پخش به صورت همس، Parakeet-TDT، یا Deepgram Nova-3 (API). نقل نامه های جزئی + نهایی.
4. **LLM with tool calling.**GPT-4o / Claude 3.5 / Gemini 2.5 Flash. طرح JSON برای ابزارها. توکن های جریان.
5. **Streaming TTS (Lesson 7).**Kokoro-82M (سرعت ترین باز) یا کارتزیا سونیک (تجارتي) TTS را پس از 20 توکن LLM شروع کنید.
6. **Playback.**اسپکر خارج شده، کد اپوس برای شبکه های باند وید پایین
7. **Interruption handler.**اگه VAD در طول پخش TTS شلیک بشه پخشش رو متوقف کن، LLM رو لغو کن، STT رو دوباره شروع کن

### سه حالت شکست که شما وارد می کنید

1. **First-word clip.**VAD خیلی دیر شروع می کنه، "هی" کاربر گم شده، حدش 0.3 شروع میشه نه 0.5
2. **Mid-response interrupt confusion.**LLM بعد از قطع کاربری تولید می کند؛ دستیار با کاربر صحبت می کند. Wire VAD → cancel-LLM.
3. **Silence hallucination.**"شکریہ که تماشا کردی" رو توی قاب های گرم کردن خاموش میگه همیشه دروازه های VAD

### 2026 دسته های مرجع تولید

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

## آن را بسازید

### مرحله 1: ضبط میکرو با شکستن (پسیدوکوید)

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

### مرحله دوم: ضبط پیچ با گیت VAD

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

### مرحله سوم: پخش STT → LLM → TTS

```python
async def turn(audio_bytes):
    transcript = await stt.transcribe(audio_bytes)
    async for token in llm.stream(transcript):
        async for audio in tts.stream(token):
            await speaker.play(audio)
```

### مرحله 4: تماس ابزار در حلقه LLM

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

### مرحله 5: کنترل قطع

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

## ازش استفاده کن

ببین`code/main.py`برای یک شبیه سازی قابل اجرا که تمام هفت قطعه را با مدل های چوب متصل می کند، بنابراین شما می توانید شکل خط لوله را حتی بدون سخت افزار ببینید. برای پیاده سازی واقعی، چوب های چوب را با:

- `silero-vad`(`pip install silero-vad`)
- `deepgram-sdk`یا`openai-whisper`
- `openai`(`gpt-4o`) یا `anthropic`
- `kokoro`یا`cartesia`
- `sounddevice`برای I/O

## دام ها

- **Logging PII forever.**صداي کامل در اکثر حوزه هاي قضايي اطلاعات شخصي است. 30 روز نگه داشتن، رمزنگاري شده در حالت استراحت.
- **No barge-in.**کاربران مزاحمت میکنن.
- **TTS that blocks.**TTS هم زماني حلقات حوادث رو مسدود ميکنه. از async يا رشته ي جداگانه استفاده کن.
- **No tool-call error handling.**ابزارها شکست خورده است. LLM باید خطا + دوباره امتحان کنید، سپس با شکوه و شکوه کاهش یابد.
- **Overzealous hallucination filters.**بیش از حد فیلتر می کنه و دستیارش میگه "من نمیتونم کمکم کنم" زیر فیلتر می کنه و میگه هرچیزی
- **No wake-word option.**همیشه گوش دادن یک مسئولیت حریم خصوصی است. یک دروازه بیدار کردن (Porcupine یا openWakeWord) اضافه کنید.

## -باده

پس از`outputs/skill-voice-assistant-architect.md`. با توجه به محدودیت های بودجه + مقیاس + زبان + رعایت، یک مشخصات کامل را تهیه کنید.

## تمرینات

1. **Easy.**فرار کن`code/main.py`. با ماژول هاي ستب و چاپي در هر مرحله ديرپذير ميکنه
2. **Medium.**. از سستم STT با مدل واقعی Whisper در یک نسخه ثبت شده جایگزین کنید`.wav`اندازه گیری WER و تاخیر آخر به آخر
3. **Hard.**اضافه کردن تماس ابزار: پیاده سازی `get_weather`(هر API) و`set_timer`.در مسیر LLM از طریق ابزارها و بررسی کنید که وقتی کاربر می گوید "تایمر 5 دقیقه ای تنظیم کنید" عملکرد درست را روشن می کند و پاسخ گفتار آن را تأیید می کند.

## اصطلاحات کلیدی

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Turn | A user + assistant round-trip | One VAD-bounded user speech + one LLM-TTS response. |
| Barge-in | Interruption | User speaks while assistant talks; assistant stops. |
| Wake word | "Hey assistant" | Short keyword detector; Porcupine, Snowboy, openWakeWord. |
| End-pointing | Turn ending | VAD + min-silence decision that user has finished. |
| Pre-roll | Pre-speech buffer | Keep 200-400 ms of audio before VAD fires to avoid first-word clip. |
| Tool call | Function invocation | LLM emits JSON; runtime dispatches; result feeds back in-loop. |

## خواندن بیشتر

- [LiveKit — voice agent quickstart](https://docs.livekit.io/agents/) مرجع درجه تولید
- [Pipecat — voice agent examples](https://github.com/pipecat-ai/pipecat) چارچوبی که برای کار خود دوستانه است.
- [OpenAI Realtime API](https://platform.openai.com/docs/guides/realtime) مسیر مدیریت صدای بومی
- [Kyutai Moshi](https://github.com/kyutai-labs/moshi) مرجع دوپلیکس کامل (درسی 15).
- [Porcupine wake-word](https://picovoice.ai/products/porcupine/) بيدار شدن از کلمه
- [Anthropic — tool use guide](https://docs.anthropic.com/en/docs/build-with-claude/tool-use) تماس با وظایف LLM
