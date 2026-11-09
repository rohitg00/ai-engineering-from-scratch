# एक आवाज सहायक पाइपलाइन बनाएं  चरण 6 कैपस्टोन

> सब कुछ सब कुछ से कक्षा 01-11, एक साथ सिलाई। एक आवाज सहायक का निर्माण जो सुनता है, तर्क देता है, और बात करता है। 2026 में यह एक समाधान इंजीनियरिंग समस्या है, एक अनुसंधान समस्या नहीं है  लेकिन एकीकरण विवरण तय करते हैं कि यह जहाज है या नहीं।

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 04, 05, 06, 07, 11; Phase 11 · 09 (Function Calling); Phase 14 · 01 (Agent Loop)
**Time:** ~120 minutes

## समस्या

एक अंत-से-अंत सहायक बनाएंः

1. माइक्रो इनपुट (16 kHz mono) कैप्चर करता है।
2. उपयोगकर्ता भाषण की शुरुआत/अंत का पता लगाता है।
3. स्ट्रीमिंग का अनुवाद करता है।
4. एक LLM में ट्रांसक्रिप्ट पास करता है जो उपकरण (टाइमर, मौसम, कैलेंडर) को कॉल कर सकता है।
5. एक टीटीएस को LLM पाठ प्रसारित करता है।
6. उपयोगकर्ता को ऑडियो वापस चलाता है।
7. यदि उपयोगकर्ता मध्य-उत्तर में बाधित करता है तो रोकता है।

लटेंसी लक्ष्यः उपयोगकर्ता द्वारा लैपटॉप सीपीयू पर अपना भाषण समाप्त करने के 800 एमएस के भीतर पहला टीटीएस ऑडियो बाइट। गुणवत्ता लक्ष्यः कोई याद किए गए शब्द नहीं, मौन पर कोई भ्रमपूर्ण उपशीर्षक नहीं, कोई आवाज क्लोनिंग लीक नहीं, कोई त्वरित इंजेक्शन सफलता नहीं।

## अवधारणा

![Voice assistant pipeline: mic → VAD → STT → LLM+tools → TTS → speaker](../assets/voice-assistant.svg)

### सात घटक

1. **Audio capture.**माइक्रो → 16 kHz मोनो → 20 ms टुकड़े। आमतौर पर `sounddevice`पायथन या मूल AudioUnit/ALSA/WASAPI में उत्पादन में।
2. **VAD (Lesson 11).**Silero VAD @ threshold 0.5, मिन भाषण 250 ms, मौन hangover 500 ms. संकेत "शुरू" और "अंत"
3. **Streaming STT (Lesson 4-5).**विस्पर-स्ट्रीमिंग, पैराकीट-टीडीटी, या डीपग्राम नोवा-3 (एपीआई) । आंशिक + अंतिम प्रतिलेखन।
4. **LLM with tool calling.**GPT-4o / Claude 3.5 / Gemini 2.5 फ्लैश. उपकरण के लिए JSON योजना. स्ट्रीम टोकन.
5. **Streaming TTS (Lesson 7).**कोकोरो-82एम (सबसे तेज़ खोलने) या कार्टेशिया सोनिक (व्यावसायिक) 20 एलएलएम टोकन के बाद टीटीएस शुरू करें।
6. **Playback.**स्पीकर आउट; कम बैंडविड्थ नेटवर्क के लिए अपस-कोड।
7. **Interruption handler.**यदि TTS प्लेबैक के दौरान VAD फायर करता है, प्लेबैक बंद करो, LLM रद्द करो, STT को पुनरारंभ करो।

### तीन विफलता मोड आप हिट करेंगे

1. **First-word clip.**VAD बहुत देर से एक धड़कन शुरू करता है. उपयोगकर्ता का "हे" गायब है. 0.3 पर शुरू करने की सीमा, 0.5 नहीं.
2. **Mid-response interrupt confusion.**एलएलएम उपयोगकर्ता के विराम के बाद उत्पन्न करता रहता है; सहायक उपयोगकर्ता पर बातचीत करता है।
3. **Silence hallucination.**चुपके वार्म-अप फ्रेम पर चुप्पी "देखने के लिए धन्यवाद" आउटपुट। हमेशा VAD-गेट।

### 2026 उत्पादन संदर्भ स्टैक

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

## इसे बनाओ

### चरण 1: चश्मा (पस्यूडोकोड) के साथ माइक्रोफ़ोन कैप्चर

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

### चरण 2: VAD-गेटेड टर्न कैप्चर

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

### चरण 3: स्ट्रीमिंग STT → LLM → TTS

```python
async def turn(audio_bytes):
    transcript = await stt.transcribe(audio_bytes)
    async for token in llm.stream(transcript):
        async for audio in tts.stream(token):
            await speaker.play(audio)
```

### चरण 4: LLM लूप के अंदर उपकरण कॉल

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

### चरण 5: विराम का संचालन

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

## इसका प्रयोग करें

देखो`code/main.py`एक चलाने योग्य सिमुलेशन के लिए जो सभी सात घटकों को स्टब मॉडल के साथ तार करता है, ताकि आप हार्डवेयर के बिना भी पाइपलाइन आकार देख सकें। एक वास्तविक कार्यान्वयन के लिए, स्टब को स्विच करेंः

- `silero-vad`(`pip install silero-vad`)
- `deepgram-sdk`या `openai-whisper`
- `openai`(`gpt-4o`) या `anthropic`
- `kokoro`या `cartesia`
- `sounddevice`I/O के लिए

## फंदे

- **Logging PII forever.**पूर्ण-चक्र ऑडियो अधिकांश न्यायालयों में पीआईडी है. 30 दिनों के लिए भंडारण, आराम में एन्क्रिप्टेड.
- **No barge-in.**उपयोगकर्ता बाधित करेंगे. आपके सहायक को बोलना बंद करना चाहिए.
- **TTS that blocks.**समवर्ती TTS घटना लूप को अवरुद्ध करता है. असिनक्रोनस या एक अलग धागा का उपयोग करें.
- **No tool-call error handling.**उपकरण विफल. LLM त्रुटि वापस मिलना चाहिए + एक बार फिर से प्रयास, फिर gracefully degraded.
- **Overzealous hallucination filters.**ओवर-फिल्टर और सहायक दोहराता है "मैं इसके साथ मदद नहीं कर सकता है।" नीचे-फिल्टर और यह कुछ भी कहता है. एक पकड़ सेट पर माप.
- **No wake-word option.**हमेशा सुनना गोपनीयता दायित्व है. एक जागृति शब्द गेट (पोर्किपिन या ओपनवैकवर्ड) जोड़ें।

## इसे भेजें

`outputs/skill-voice-assistant-architect.md`. बजट + पैमाने + भाषा + अनुपालन संबंधी बाधाओं को देखते हुए, एक पूर्ण स्टैक विनिर्देश तैयार करें।

## व्यायाम

1. **Easy.**दौड़ें`code/main.py`यह स्टब मॉड्यूल और प्रति चरण विलंबता के साथ एक पूर्ण बारी अंत-से-अंत अनुकरण करता है।
2. **Medium.**पूर्व-रिकॉर्ड पर एक असली विस्पर मॉडल के साथ STT स्टब की जगह `.wav`. WER और अंत-से-अंत विलंबता का माप करें.
3. **Hard.**उपकरण कॉल जोड़ेंः लागू करें `get_weather`(किसी भी एपीआई) और `set_timer`. LLM को टूल के माध्यम से रूट करें और सत्यापित करें कि जब उपयोगकर्ता कहता है "5 मिनट का टाइमर सेट करें" तो सही फ़ंक्शन चलाता है और बोलने वाले उत्तर इसकी पुष्टि करते हैं।

## प्रमुख शर्तें

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Turn | A user + assistant round-trip | One VAD-bounded user speech + one LLM-TTS response. |
| Barge-in | Interruption | User speaks while assistant talks; assistant stops. |
| Wake word | "Hey assistant" | Short keyword detector; Porcupine, Snowboy, openWakeWord. |
| End-pointing | Turn ending | VAD + min-silence decision that user has finished. |
| Pre-roll | Pre-speech buffer | Keep 200-400 ms of audio before VAD fires to avoid first-word clip. |
| Tool call | Function invocation | LLM emits JSON; runtime dispatches; result feeds back in-loop. |

## आगे पढ़ना

- [LiveKit — voice agent quickstart](https://docs.livekit.io/agents/) उत्पादन स्तर का संदर्भ।
- [Pipecat — voice agent examples](https://github.com/pipecat-ai/pipecat) DIY के अनुकूल ढांचा।
- [OpenAI Realtime API](https://platform.openai.com/docs/guides/realtime) प्रबंधित आवाज-मौलिक पथ।
- [Kyutai Moshi](https://github.com/kyutai-labs/moshi) पूर्ण डुप्लेक्स संदर्भ (पाठ 15)
- [Porcupine wake-word](https://picovoice.ai/products/porcupine/) जागने के शब्द गेटिंग।
- [Anthropic — tool use guide](https://docs.anthropic.com/en/docs/build-with-claude/tool-use) LLM कार्य कॉल।
