# Sesli Asistan Boru Hattı Oluşturun — Aşama 6 Bitirme Taşı

> 01-11 derslerinden her şey bir araya getirildi. Dinleyen, mantık yürüten ve karşılık veren bir sesli asistan oluşturun. 2026'da bu, bir araştırma sorunu değil, çözülmüş bir mühendislik sorunudur; ancak bunun gönderilip gönderilmeyeceğine entegrasyon ayrıntıları karar verecektir.

**Tür:** Yapım
**Diller:** Python
**Önkoşullar:** Aşama 6 · 04, 05, 06, 07, 11; Aşama 11 · 09 (İşlev Çağrısı); Aşama 14 · 01 (Agent Loop)
**Süre:** ~120 dakika

## Sorun

Uçtan uca bir asistan oluşturun:

1. Mikrofon girişini yakalar (16 kHz mono).
2. Kullanıcı konuşmasının başlangıcını/bitişini algılar.
3. Akışı yazıya döker.
4. Transkripti, araçları (zamanlayıcı, hava durumu, takvim) arayabilen bir LLM'ye iletir.
5. LLM metnini bir TTS'ye aktarır.
6. Sesi kullanıcıya geri oynatır.
7. Kullanıcı yanıtın ortasında sözünü keserse durur.

Gecikme hedefi: kullanıcının dizüstü bilgisayar CPU'sunda konuşmasını bitirmesinden sonraki 800 ms içinde ilk TTS ses baytı. Kalite hedefi: kaçırılan kelime yok, sessizlikte halüsinasyonlu altyazı yok, ses klonlama sızıntısı yok, prompt enjeksiyon başarısı yok.

## Konsept

![Sesli asistan hattı: mikrofon → VAD → STT → Yüksek Lisans+araçlar → TTS → hoparlör](../assets/voice-assistant.svg)

### Yedi bileşen

1. **Ses yakalama.** Mikrofon → 16 kHz mono → 20 ms'lik parçalar. Genellikle Python'da `sounddevice` veya üretimde yerel AudioUnit/ALSA/WASAPI.
2. **VAD (Ders 11).** Silero VAD @ eşik 0,5, minimum konuşma 250 ms, sessizlik kesintisi 500 ms. "Başlangıç" ve "bitiş" sinyalleri.
3. **STT Yayını (Ders 4-5).** Whisper-streaming, Parakeet-TDT veya Deepgram Nova-3 (API). Kısmi + son transkriptler.
4. **tool calling ile Yüksek Lisans.** GPT-4o / Claude 3.5 / Gemini 2.5 Flash. Araçlar için JSON şeması. token'leri yayınlayın.
5. **TTS Yayını (Ders 7).** Kokoro-82M (en hızlı açık) veya Cartesia Sonic (ticari). 20 LLM token'den sonra TTS'yi başlatın.
6. **Oynatma.** Hoparlör çıkışı; Düşük bant genişliğine sahip ağlar için opus-encode.
7. **Kesinti işleyicisi.** TTS oynatma sırasında VAD etkinleşirse oynatmayı durdurun, LLM'yi iptal edin, STT'yi yeniden başlatın.

### Karşılaşacağınız üç arıza modu

1. **İlk kelime klibi.** VAD ritmi çok geç başlatıyor. Kullanıcının "hey" sesi eksik. Eşiği 0,5'ten değil 0,3'ten başlatın.
2. **Orta yanıt kesintisi karışıklığı.** LLM, kullanıcı kesintisinden sonra üretmeye devam ediyor; asistan kullanıcı üzerinden konuşuyor. VAD'yi havale edin → LLM'yi iptal edin.
3. **Sessizlik halüsinasyonu.** Sessiz ısınma karelerinde "İzlediğiniz için teşekkürler" fısıltısı çıkar. Her zaman VAD kapısı.

### 2026 üretim referans yığınları

| Yığın | Gecikme | Lisans | Notlar |
|-------|---------|---------|-------|
| LiveKit + Deepgram + GPT-4o + Kartezya | 350-500 ms | ticari API | Sektör temerrüdü 2026 |
| Pipecat + Whisper akışı + GPT-4o + Kokoro | 500-800 ms | çoğunlukla açık | Kendin Yap dostu |
| Moshi (tam çift yönlü) | 200-300 ms | CC-BY 4.0 | Tek model; farklı mimari, ders 15 |
| Vapi / Yeniden Anlat (yönetilen) | 300-500 ms | ticari | Başlatılması en hızlı; sınırlı özelleştirme |
| Whisper.cpp + llama.cpp + Kokoro-ONNX | çevrimdışı | aç | Gizlilik / kenar |

## İnşa Et

### Adım 1: parçalamayla mikrofon yakalama (sözde kod)

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

### Adım 2: VAD geçişli dönüş yakalama

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

### Adım 3: STT akışı → Yüksek Lisans → TTS

```python
async def turn(audio_bytes):
    transcript = await stt.transcribe(audio_bytes)
    async for token in llm.stream(transcript):
        async for audio in tts.stream(token):
            await speaker.play(audio)
```

### Adım 4: LLM döngüsü içinde tool calling

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

### Adım 5: kesinti yönetimi

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

## Kullan onu

Yedi bileşenin tümünü saplama modelleriyle birleştiren çalıştırılabilir bir simülasyon için `code/main.py`'ye bakın, böylece boru hattı şeklini donanım olmadan bile görebilirsiniz. Gerçek bir uygulama için taslakları şununla değiştirin:

- `silero-vad` (`pip install silero-vad`)
- `deepgram-sdk` veya `openai-whisper`
- `openai` (`gpt-4o`) veya `anthropic`
- `kokoro` veya `cartesia`
- G/Ç için `sounddevice`

## Tuzaklar

- **Kişisel Bilgilerin (PII) sonsuza kadar günlüğe kaydedilmesi.** Tam dönüşlü ses, çoğu yargı bölgesinde PII'dir. 30 günlük saklama, kullanımda değilken şifrelenir.
- **İçeriye girme yok.** Kullanıcılar araya girecek. Asistanınızın konuşmayı bırakması gerekiyor.
- **Engelleyen TTS.** Senkronize TTS, olay döngüsünü engeller. Eşzamansız veya ayrı bir iş parçacığı kullanın.
- **Araç çağrısı hatası işleme yok.** Araçlar başarısız oluyor. LLM hatayı geri almalı + bir kez yeniden denemeli, ardından zarif bir şekilde bozulmalı.
- **Aşırı hevesli halüsinasyon filtreleri.** Aşırı filtre ve asistan "Bu konuda yardımcı olamam" diye tekrarlıyor. Filtre altı ve her şeyi söylüyor. Uzatılmış bir sette kalibre edin.
- **Uyandırma seçeneği yoktur.** Her zaman dinlemek bir gizlilik yükümlülüğüdür. Bir uyandırma sözcüğü kapısı ekleyin (Porcupine veya openWakeWord).

## Gönderin

`outputs/skill-voice-assistant-architect.md` olarak kaydedin. Bütçe + ölçek + dil + uyumluluk kısıtlamaları göz önüne alındığında, tam bir yığın spesifikasyonu oluşturun.

## Egzersizler

1. **Kolay.** `code/main.py`'yi çalıştırın. Saplama modülleri ile uçtan uca bir tam dönüşü simüle eder ve aşama başına gecikmeyi yazdırır.
2. **Orta.** STT saplamasını önceden kaydedilmiş `.wav`'de gerçek bir Whisper modeliyle değiştirin. WER'yi ve uçtan uca gecikmeyi ölçün.
3. **Zor.** tool calling ekleyin: `get_weather` (herhangi bir API) ve `set_timer`'yi uygulayın. LLM'yi araçlara yönlendirin ve kullanıcı "5 dakikalık bir zamanlayıcı ayarlayın" dediğinde doğru işlevin etkinleştiğini ve sesli yanıtın bunu onayladığını doğrulayın.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|-----------------|-----------------------|
| Dönüş | Bir kullanıcı + asistan gidiş-dönüş | Bir VAD sınırlı kullanıcı konuşması + bir LLM-TTS yanıtı. |
| Katılma | Kesinti | Asistan konuşurken kullanıcı konuşur; asistan durur. |
| Kelimeyi uyandır | "Merhaba asistan" | Kısa anahtar kelime dedektörü; Kirpi, Kardan Çocuk, openWakeWord. |
| Sonu işaretleme | Dönüş bitişi | Kullanıcının bitirdiği VAD + min-sessizlik kararı. |
| Videodan önce gösterilen reklam | Konuşma öncesi arabellek | İlk kelime klibini önlemek için VAD tetiklenmeden önce sesi 200-400 ms tutun. |
| Araç çağrısı | İşlev çağırma | Yüksek Lisans JSON'u yayar; çalışma zamanı gönderimleri; sonuç döngü içinde geri beslenir. |

## Daha Fazla Okuma

- [LiveKit — sesli agent hızlı başlangıç](https://docs.livekit.io/agents/) — üretim düzeyinde referans.
- [Pipecat — sesli agent örnekleri](https://github.com/pipecat-ai/pipecat) — Kendin Yap dostu framework.
- [OpenAI Gerçek Zamanlı API](https://platform.openai.com/docs/guides/realtime) — yönetilen ses yerel yolu.
- [Kyutai Moshi](https://github.com/kyutai-labs/moshi) — tam çift yönlü referans (Ders 15).
- [Pircupine uyandırma sözcüğü](https://picovoice.ai/products/porcupine/) — uyandırma sözcüğü geçitleme.
- [Antropik — araç kullanım kılavuzu](https://docs.anthropic.com/en/docs/build-with-claude/tool-use) — Yüksek Lisans işlevinin çağrılması.
