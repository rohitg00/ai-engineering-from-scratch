# Ses Yardımcısı Pipeline Yapın  6. Fazla Kapstone

> 01-11 derslerinden her şey bir arada dikilir. Dinleyen, akıl yürüten ve konuşan bir ses asistanı oluşturun. 2026'da bu bir çözümlü mühendislik sorunu, bir araştırma sorunu değil  ama entegrasyon detayları, gemiyi göndermeye karar verir.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 04, 05, 06, 07, 11; Phase 11 · 09 (Function Calling); Phase 14 · 01 (Agent Loop)
**Time:** ~120 minutes

## Sorun

Sonundan sonuna kadar bir asistan oluştur:

1. Mikrofon girişini (16 kHz mono) yakalar.
2. Kullanıcı konuşmasının başlangıcı ve sonu tespit edilir.
3. Akışını kaydeder.
4. Bir LLM'ye transkripti geçiyor ve araçları çağırabilir (zamanlama, hava, takvim).
5. TTS'e LLM metnini yayınlıyor.
6. Kullanıcıya ses çalıyor.
7. Kullanıcı cevap ortalarında keserse durur.

Gecikme hedefi: kullanıcı, konuşmasını dizüstü bilgisayar CPU'nda bitirdiği 800 ms içinde ilk TTS ses baytı. Kalite hedefi: kayıp kelimeler, sessizliğe halüsinasyonlu altyazılar, ses klonlama sızdırısı, hızlı enjeksiyon başarısı yok.

## Anlaşım

![Voice assistant pipeline: mic → VAD → STT → LLM+tools → TTS → speaker](../assets/voice-assistant.svg)

### Yedi bileşen

1. **Audio capture.**Mikrofon → 16 kHz mono → 20 ms parçalar.`sounddevice`Python veya yerel AudioUnit/ALSA/WASAPI'de üretimde.
2. **VAD (Lesson 11).**Silero VAD @ eşiği 0,5, min konuşma 250 ms, sessizlik 500 ms.
3. **Streaming STT (Lesson 4-5).**Sıfırlayış, Parakeet-TDT veya Deepgram Nova-3 (API).
4. **LLM with tool calling.**GPT-4o / Claude 3.5 / Gemini 2.5 Flash. Aletler için JSON şeması. Akış tokens.
5. **Streaming TTS (Lesson 7).**Kokoro-82M (en hızlı açılış) veya Cartesia Sonic (ticari).
6. **Playback.**Konuşmacı çıkıyor, düşük bant genişliği ağları için opus kodlama.
7. **Interruption handler.**Eğer TTS oynatma sırasında VAD ateş ederse, oynatmayı durdur, LLM'yi iptal et, STT'yi yeniden başlat.

### Başarısızlık modunun üçünü bulacaksınız.

1. **First-word clip.**VAD çok geç bir şekilde başlıyor. Kullanıcının "hey"si eksik.
2. **Mid-response interrupt confusion.**LLM kullanıcı kesildikten sonra üretmeye devam eder; asistan kullanıcı üzerinde konuşur.
3. **Silence hallucination.**Sessiz ısıtma çerçevelerinde "seyrettiğiniz için teşekkürler" sessiz fısıldama çıkışı.

### 2026 üretim referans yığınları

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

## Yapın

### Adım 1: Mikrofon yakalama (pseudokod)

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

### Adım 2: VAD kapalı dönüş yakalama

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

### Adım 3: STT → LLM → TTS akışı

```python
async def turn(audio_bytes):
    transcript = await stt.transcribe(audio_bytes)
    async for token in llm.stream(transcript):
        async for audio in tts.stream(token):
            await speaker.play(audio)
```

### Adım 4: LLM döngüsünün içinde araç çağrısı

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

### Adım 5: Kesinlik işlemleri

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

## Kullan

Bakın .`code/main.py`Bu, tüm yedi bileşenini birer parça ile bağlayan çalıştırılabilir bir simülasyon için, böylece donanım olmadan bile boru hattı şeklini görebilirsiniz. Gerçek bir uygulamak için, birer parça ile değiştirin:

- `silero-vad`(`pip install silero-vad`)
- `deepgram-sdk`veya `openai-whisper`
- `openai`(`gpt-4o`) veya `anthropic`
- `kokoro`veya `cartesia`
- `sounddevice`I/O için

## Tuzaklar

- **Logging PII forever.**Tam dönüşlü ses çoğu yargı bölgesinde kişisel bilgi olarak kullanılır. 30 gün boyunca, dinlenmeden şifreli tutulmaktadır.
- **No barge-in.**Kullanıcılar kesiler.
- **TTS that blocks.**Sinkron TTS olay döngüsünü engeller. Async veya ayrı bir ip kullanın.
- **No tool-call error handling.**Araçlar başarısız. LLM hatayı geri almak + bir kez tekrar denemek, sonra zarif bir şekilde düşürmek gerekir.
- **Overzealous hallucination filters.**Aşırı filtre ve asistan "Bunu yapamam" diye tekrarlıyor.
- **No wake-word option.**Her zaman dinlemek gizlilik sorumluluğudur.

## Gönder

- Kaydet .`outputs/skill-voice-assistant-architect.md`.Büjet + ölçek + dil + uyumluluk kısıtlamaları göz önüne alındığında, tam bir stok özellikleri oluşturun.

## Egzersizler

1. **Easy.**Çık .`code/main.py`Bir tam dönüşü sonundan sonuna simüle eder.
2. **Medium.**STT'nin yerine , önceden kaydedilen bir Whisper modeli koyun .`.wav`WER ve sonundan sonuna kadar gecikmeyi ölçmek.
3. **Hard.**Araç çağrısı ekle: uygulay `get_weather`(herhangi bir API) ve `set_timer`. LLM'yi araçlar üzerinden yönlendirin ve kullanıcı "5 dakika zamanlayıcı ayarlayın" dediğinde doğru işlev ateşlendiğini ve konuşulan yanıtın bunu onayladığını kontrol edin.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Turn | A user + assistant round-trip | One VAD-bounded user speech + one LLM-TTS response. |
| Barge-in | Interruption | User speaks while assistant talks; assistant stops. |
| Wake word | "Hey assistant" | Short keyword detector; Porcupine, Snowboy, openWakeWord. |
| End-pointing | Turn ending | VAD + min-silence decision that user has finished. |
| Pre-roll | Pre-speech buffer | Keep 200-400 ms of audio before VAD fires to avoid first-word clip. |
| Tool call | Function invocation | LLM emits JSON; runtime dispatches; result feeds back in-loop. |

## Daha Fazla Okumak

- [LiveKit — voice agent quickstart](https://docs.livekit.io/agents/) Üretim derecesi referansı.
- [Pipecat — voice agent examples](https://github.com/pipecat-ai/pipecat) DIY dostu çerçeve.
- [OpenAI Realtime API](https://platform.openai.com/docs/guides/realtime) yönetilen ses-dev yol.
- [Kyutai Moshi](https://github.com/kyutai-labs/moshi) Tam ikili referans (Desin 15).
- [Porcupine wake-word](https://picovoice.ai/products/porcupine/)- Uyanık söz kaplama.
- [Anthropic — tool use guide](https://docs.anthropic.com/en/docs/build-with-claude/tool-use) LLM fonksiyonu çağrısı.
