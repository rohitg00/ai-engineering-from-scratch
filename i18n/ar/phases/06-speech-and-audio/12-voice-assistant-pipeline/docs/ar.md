# بناء خط أنابيب مساعد الصوت  مرحلة 6 Capstone

> كل شيء من الدروس 01-11 ، تم خياطة كل شيء معاً. بناء مساعد صوتي يستمع ، ويعبر ، ويتحدث مرة أخرى. في عام 2026 هذه مشكلة هندسية حل ، وليس مشكلة بحثية  ولكن تفاصيل التكامل تقرر ما إذا كانت تسير.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 04, 05, 06, 07, 11; Phase 11 · 09 (Function Calling); Phase 14 · 01 (Agent Loop)
**Time:** ~120 minutes

## المشكلة

بناء مساعد من نهاية إلى نهاية:

1. يلتقط المدخلات الميكروفونية (16 كيلوهرتز)
2. يكتشف بداية/نهاية خطاب المستخدم.
3. ينسخ التدفق
4. يمر النسخة إلى ماجستير في العلوم التي يمكن أن تدعو الأدوات (تايمر، الطقس، التقويم).
5. تُشغل رسالة ماجستير في العلوم إلى TTS
6. يعيد الصوت إلى المستخدم
7. يتوقف إذا قام المستخدم بتقاطع الرد في منتصفها.

هدف التأخير: أول بايت صوتي TTS في غضون 800 ميس من الانتهاء من المستخدم من التعبير على جهاز كمبيوتر محمول. هدف الجودة: لا كلمات مفقودة، لا ترجمة الهلوسة على الصمت، لا تسرب من نسخ الصوت، لا نجاح في الحقن السريع.

## المفهوم

![Voice assistant pipeline: mic → VAD → STT → LLM+tools → TTS → speaker](../assets/voice-assistant.svg)

### المكونات السبعة

1. **Audio capture.**ميكروفونات → 16 كيلوهرتز مونو → 20 ميس قطعة. عادة `sounddevice`في Python أو AudioUnit/ALSA/WASAPI الأصلي في الإنتاج.
2. **VAD (Lesson 11).**سيلرو فاد @ عتبة 0.5، تقرير الدقيقة 250 ms، صمت تعليق 500 ms. إشارات "بدء" و "نهاية".
3. **Streaming STT (Lesson 4-5).**التدفقات الهزيمة، Parakeet-TDT، أو Deepgram Nova-3 (API). النسخ الجزئية + النهائية.
4. **LLM with tool calling.**GPT-4o / Claude 3.5 / Gemini 2.5 Flash. مخطط JSON للأدوات. رموز التدفق.
5. **Streaming TTS (Lesson 7).**كوكورو-82M (أسرع فتح) أو كارتيسيا سونيك (التجارية). بدء TTS بعد 20 رمزا LLM.
6. **Playback.**المتكلم خارج، رمزية للشبكات ذات النطاق النطاق المنخفض.
7. **Interruption handler.**إذا أطلقت (فاد) أثناء تشغيل (تيتس) ، توقف تشغيل (تيتس) ، إلغ (اللم) ، إعادة تشغيل (ستيتس)

### الوضعين الثلاثة التي ستضربها

1. **First-word clip.**يبدأ VAD ضربة متأخرة جداً، "هي" المستخدم مفقود، حد البدء عند 0.3، وليس 0.5.
2. **Mid-response interrupt confusion.**يواصل LLM توليد بعد انقطاع المستخدم؛ يتحدث المساعد على المستخدم.
3. **Silence hallucination.**"تخرج النصائح "شكراً على مشاهدتك على الإطار الصامت للتدفئة

### 2026 مستويات الإشارة الإنتاجية

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

## بناءها

### الخطوة الأولى: التقاط الميكروفون مع التقطيع (مخططات مزيفة)

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

### الخطوة الثانية: التقاط المديرات المضمنة بمفتاح VAD

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

### الخطوة الثالثة: التدفق على STT → LLM → TTS

```python
async def turn(audio_bytes):
    transcript = await stt.transcribe(audio_bytes)
    async for token in llm.stream(transcript):
        async for audio in tts.stream(token):
            await speaker.play(audio)
```

### الخطوة الرابعة: أداة الدعوة داخل حلقة LLM

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

### الخطوة 5: التعامل مع المقاطعة

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

## استخدمها

انظر`code/main.py`لتنمية قابلة للتشغيل التي تصل جميع المكونات السبعة مع نماذج القطع، حتى تتمكن من رؤية شكل خط الأنابيب حتى دون أجهزة.

- `silero-vad`(`pip install silero-vad`)
- `deepgram-sdk`أو`openai-whisper`
- `openai`(`gpt-4o`) أو `anthropic`
- `kokoro`أو`cartesia`
- `sounddevice`لـ (I/O)

## الفخاخ

- **Logging PII forever.**الصوت المُتَحرك بالكامل هو المعلومات الشخصية في معظم الولايات القضائية.
- **No barge-in.**المستخدمون سيقاطعون، يجب أن يتوقف مساعدك عن الحديث
- **TTS that blocks.**تث سمنشري يمنع حلقة الحدث. استخدم async أو خيط منفصل.
- **No tool-call error handling.**أدوات الفشل يجب أن يحصل ماجستير في العلوم على الخطأ + محاولة مرة أخرى ثم تخفيض gracefully.
- **Overzealous hallucination filters.**"فلتراً أكثر" ويقول المساعد "لا أستطيع المساعدة" "فلتراً أقل" ويقول أي شيء
- **No wake-word option.**الاستماع دائماً هو مسؤولية خصوصية. أضف بوابة استيقظ (Porcupine أو openWakeWord).

## أرسله

إبقوا`outputs/skill-voice-assistant-architect.md`. بالنظر إلى القيود المفروضة على الميزانية + الحجم + اللغة + الامتثال، قم بإعداد تحديد كامل للمجموعة.

## التمارين

1. **Easy.**أركض`code/main.py`إنه يحاكي دور كامل واحد من نهاية إلى نهاية مع وحدات الصفوف والطبعات في كل مرحلة
2. **Medium.**استبدل النصيب من STT بنموذج Whisper الحقيقي على نسخة مسجلة مسبقاً`.wav`. قياس WER و التأخير من نهاية إلى نهاية
3. **Hard.**إضافة دعوة أداة: تنفيذ `get_weather`(أي إطار إطار إطار عمل) و `set_timer`. توجيه الدرجة العليا من خلال الأدوات والتحقق من أنه عندما يقول المستخدم "وضع 5 دقيقة التوقيت" تعمل الوظيفة الصحيحة والرد المتكلم يؤكد ذلك.

## الشروط الرئيسية

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Turn | A user + assistant round-trip | One VAD-bounded user speech + one LLM-TTS response. |
| Barge-in | Interruption | User speaks while assistant talks; assistant stops. |
| Wake word | "Hey assistant" | Short keyword detector; Porcupine, Snowboy, openWakeWord. |
| End-pointing | Turn ending | VAD + min-silence decision that user has finished. |
| Pre-roll | Pre-speech buffer | Keep 200-400 ms of audio before VAD fires to avoid first-word clip. |
| Tool call | Function invocation | LLM emits JSON; runtime dispatches; result feeds back in-loop. |

## المزيد من القراءة

- [LiveKit — voice agent quickstart](https://docs.livekit.io/agents/) إشارة إلى مستوى الإنتاج
- [Pipecat — voice agent examples](https://github.com/pipecat-ai/pipecat)إطار عمل صديقي للشراء
- [OpenAI Realtime API](https://platform.openai.com/docs/guides/realtime) المسار المُدار الصوتي الأصلي
- [Kyutai Moshi](https://github.com/kyutai-labs/moshi) إشارة كاملة (الدرس 15).
- [Porcupine wake-word](https://picovoice.ai/products/porcupine/)-إغلاق الكلمات المُستيقظة
- [Anthropic — tool use guide](https://docs.anthropic.com/en/docs/build-with-claude/tool-use) دعوة وظيفة LLM.
