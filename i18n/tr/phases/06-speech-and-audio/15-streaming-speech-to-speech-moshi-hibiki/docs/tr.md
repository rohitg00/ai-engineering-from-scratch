# Konuşma-Söz Akışları  Moshi, Hibiki ve Tam Dubleks Diyaloğu

> 2024-2026 ses AI'yi yeniden tanımladı. Moshi, 200 ms gecikme ile aynı anda dinleyen ve konuşan tek bir model gönderir. Hibiki konuşma-söz çevirisini parça parça yapar. Her ikisi de ASR → LLM → TTS borusunu Mimi kodek jetonları üzerinde tek bir tam çiftlik mimarisi için terk eder. Bu yeni referans tasarımıdır.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 13 (Neural Audio Codecs), Phase 6 · 11 (Real-Time Audio), Phase 7 · 05 (Full Transformer)
**Time:** ~75 minutes

## Sorun

Ders 11 + 12'den oluşturulan her ses ajansı, temel bir gecikme zemine sahip: 300-500 ms civarında: VAD yangınları, STT süreçleri, LLM nedenleri, TTS üretir. Her aşamada kendi minimum gecikme var. Düzenleyebilir ve paralelleştirebilirsiniz, ancak boru hattı şekli sizi kapsar.

Moshi (Kyutai, 2024-2026) farklı bir soru sorar: bir boru hattı yoksa ne olacak?

Cevap şu:**full-duplex speech-to-speech**- Teorik gecikme 160 ms (80 ms Mimi çerçeve + 80 ms akustik gecikme) - tek L4 GPU'da pratik gecikme 200 ms.

## Anlaşım

![Moshi architecture: two parallel Mimi streams + inner-monologue text](../assets/moshi-hibiki.svg)

### Moshi mimarisi

**Inputs.**İki Mimi kodek akışı, her ikisi de 12.5 Hz × 8 kod defterinde:

- Akış 1: Kullanıcı ses (Mimi-kodlanmış, sürekli gelen)
- Stream 2: Moshi'nin kendi sesini (Moshi tarafından üretilmiş)

**The transformer.**7B parametri olan Zaman Transformer hem akışları hem de bir metin "içi monolog" akışını işliyor.

1. En son kullanıcı Mimi tokenlerini tüketir (8 kod defteri).
2. En son Moshi Mimi tokenlerini tüketir (8 kod kitabı, üretildiği gibi).
3. Bir sonraki Moshi metin belirti (iç monolog) oluşturur.
4. Bir sonraki Moshi Mimi jetonlarını yaratabilir (8 küçük derinlik transformörü aracılığıyla kod defteri).

Üç akış  kullanıcı ses, Moshi ses, Moshi metni  paralel olarak çalışır. Moshi konuşurken kullanıcıyı duyabilir; kullanıcı kesildiğinde kendini kesebilir; ana ifadesini kırmadan arka kanal ("mhm") yapabilir.

**The depth transformer.**Bir çerçeve içinde, 8 kod kitabı paralel olarak tahmin edilmez.  kod kitapları arasında bağımlılıklara sahiptirler. Küçük bir iki katmanlı " derinlik transformatörü " onları 80 ms içinde sırayla tahmin eder. Bu AR kodek LM için standart faktörleşme (VALL-E, VibeVoice tarafından da kullanılır).

### İçerideki tek kelime neden yardımcı olur?

Açık bir metin olmadan, model, akustik akışında dil modeli indirekt olarak oluşturmalıdır. Moshi'nin anlayışı: sesle birlikte metin işaretlerini yaymak için zorlamak. Metin akışı esasen Moshi'nin söylediği şeyin transkriptidir. Bu semantik tutarlılığı artırır, dil model başlığını değiştirmeyi kolaylaştırır ve size transkriptleri ücretsiz verir.

### Hibiki: Konuşma-söz çevirisini akışı

Aynı mimarlık, çeviri çiftlerinde eğitilmiştir. Kaynak ses, hedef dili ses çıkışı, sürekli. Hibiki-Zero (Feb 2026) sözcük düzeyde uyumlu eğitim verilerinin gerekliliğini ortadan kaldırır.

İlk olarak dört dil çiftine destek verilir; ≈1000 saat ile yeni bir dile uyarlanabilir.

### Daha geniş Kyutai yığın (2026)

- **Moshi** Tam ikili diyalog (İngilizce iyi desteklenmiş önce Fransızca)
- **Hibiki / Hibiki-Zero** Aynı anda konuşma çevirisi
- **Kyutai STT** Akış ASR (500 ms veya 2.5 saniye önümüze bakmak)
- **Kyutai Pocket TTS** 100M-param TTS CPU ile çalışır (Jan 2026)
- **Unmute** Bu sistemleri kamu sunucularında birleştiren tam bir boru hattı

L40S GPU'da geçiş gücü: 64 eşzamanlı oturum 3× gerçek zamanlı.

### Sesam CSM  kuzen

Sesame CSM (2025) aynı fikirde kullanıyor. Llama-3 omurgası ve Mimi kodek başı. Ancak CSM tam dupleks yerine tek yönlüdür (teks + metin alır, konuşma üretir). Piyasadaki en iyi "sessiz varlık" TTS'dir; Moshi'nin tam dupleks yeteneğiyle aynı değil.

### 2026 performans sayıları

| Model | Latency | Use case | License |
|-------|---------|----------|---------|
| Moshi | 200 ms (L4) | full-duplex English / French dialogue | CC-BY 4.0 |
| Hibiki | 12.5 Hz framerate | French ↔ English streaming translation | CC-BY 4.0 |
| Hibiki-Zero | same | 5 language-pairs, no aligned data | CC-BY 4.0 |
| Sesame CSM-1B | 200 ms TTFA | context-conditioned TTS | Apache-2.0 |
| GPT-4o Realtime | ~300 ms | closed, OpenAI API | commercial |
| Gemini 2.5 Live | ~350 ms | closed, Google API | commercial |

```figure
sp-fullduplex
```

## Yapın

### Adım 1: Ara yüzü

Moshi, 80 ms'lik Mimi kodlanmış ses parçalarını alan ve her iki yönde de 80 ms'lık Mimi kodlanmış ses parçalarını geri veren bir WebSocket sunucusu ortaya çıkarıyor.

```python
import asyncio
import websockets
from moshi.client_utils import encode_audio_mimi, decode_audio_mimi

async def moshi_chat():
    async with websockets.connect("ws://localhost:8998/api/chat") as ws:
        mic_task = asyncio.create_task(stream_mic_to(ws))
        spk_task = asyncio.create_task(stream_from_to_speaker(ws))
        await asyncio.gather(mic_task, spk_task)
```

### Adım 2: Tam duplex döngüsü

```python
async def stream_mic_to(ws):
    async for chunk_80ms in mic_stream_at_12_5_hz():
        mimi_tokens = encode_audio_mimi(chunk_80ms)
        await ws.send(serialize(mimi_tokens))

async def stream_from_to_speaker(ws):
    async for msg in ws:
        mimi_tokens, text_token = deserialize(msg)
        audio = decode_audio_mimi(mimi_tokens)
        await play(audio)
```

Python asyncio veya Rust geleceği standart taşımacılıktır.

### Adım 3: Eğitim amacı (konseptik)

Her 80 ms çerçeve için `t`- ...

- Giriş: `user_mimi[0..t]`- Evet .`moshi_mimi[0..t-1]`- Evet .`moshi_text[0..t-1]`
- Önceden:`moshi_text[t]`O zaman ...`moshi_mimi[t, codebook_0..7]`

Metin sesden önce (içer monolog) öngörülür; ses derinlik transformatöründe kod defteri-sükvensel olarak öngörülür.

### Dördüncü adım: Moshi'nin nerede kazanacağı ve nerede kazanacağı.

Moshi kazanır:

- Alt 250 ms ucuza ucuza malzemeler.
- Doğal arka kanallar ve kesintiler.
- - Pipeline yapışkan kodları yok.

Moshi kazanmıyor:

- Araç çağrısı (bunu yaptırmadınız; ayrı bir LLM yoluna ihtiyacınız var).
- Uzun bir mantık (Moshi, Claude/GPT-4 değil, 8B diyalog modeli).
- Niş konularındaki gerçek doğruluk.
- Çoğu üretim işletmesi kullanım durumları (2026 yılında hala boru hattları kullanılıyor).

## Kullan

| Situation | Pick |
|-----------|------|
| Lowest-latency voice companion | Moshi |
| Live translation call | Hibiki |
| Voice demo / research | Moshi, CSM |
| Enterprise agent with tools | Pipeline (Lesson 12), not Moshi |
| Custom-voice TTS in context | Sesame CSM |
| Speech-to-speech, any languages | GPT-4o Realtime or Gemini 2.5 Live (commercial) |

## Tuzaklar

- **Limited tool calling.**Moshi bir iletişim modeli, bir ajan çerçevesidir.
- **Specific-voice conditioning.**Moshi tek bir eğitimli kişilik kullanır; klonlama ayrı bir eğitim koşusudur.
- **Language coverage.**Fransızca + İngilizce mükemmel, diğerleri sınırlıdır. Hibiki-Zero yardımcı olur, ancak hala eğitim verilerine ihtiyacınız var.
- **Resource cost.**Tam bir Moshi oturumunda GPU boşluğu bulunur; ucuz paylaşılan kiracı dağıtım modeli değil.

## Gönder

- Kaydet .`outputs/skill-duplex-pipeline.md`Sesli ajan iş yükü için pipeline vs. full-duplex mimarisi seçin.

## Egzersizler

1. **Easy.**Çık .`code/main.py`İki akımlı + iç monolog mimarisini sembolik olarak simüle eder.
2. **Medium.**HuggingFace'den Moshi'yi çek, sunucu çalıştır, bir konuşmayı test et, kullanıcı konuşmasından Moshi tepkisine kadar duvar saati gecikmesini ölç.
3. **Hard.**Ders 12 boru hattı ajanını al ve 20 eşleşen test açıklaması ile P50 gecikme oranını Moshi ile karşılaştır.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Full-duplex | Hear-and-speak at once | Two audio streams active simultaneously on the same model. |
| Inner monologue | Model's text stream | Moshi emits text tokens alongside its audio output. |
| Depth transformer | Inter-codebook predictor | Small transformer that predicts 8 codebooks within one 80 ms frame. |
| Mimi | Kyutai's codec | 12.5 Hz × 8 codebooks; semantic+acoustic; powers Moshi. |
| Streaming S2S | Audio → audio live | Chunk-by-chunk translation/dialogue, no pipeline stages. |
| Back-channeling | "Mhm" reactions | Moshi can emit small acknowledgments without breaking its turn. |

## Daha Fazla Okumak

- [Défossez et al. (2024). Moshi — speech-text foundation model](https://arxiv.org/html/2410.00037v2)- Gazete.
- [Kyutai Labs (2026). Hibiki-Zero](https://arxiv.org/abs/2602.12345) Düzleştirilmiş veriler olmadan akışlı çeviri.
- [Sesame (2025). Crossing the uncanny valley of voice](https://www.sesame.com/research/crossing_the_uncanny_valley_of_voice) CSM spesifikasyonu.
- [Kyutai — Moshi repo](https://github.com/kyutai-labs/moshi) yükle + sunucu.
- [OpenAI — Realtime API](https://platform.openai.com/docs/guides/realtime) kapalı ticari eş.
- [Kyutai — Delayed Streams Modeling](https://github.com/kyutai-labs/delayed-streams-modeling) Kapus altındaki STT/TTS çerçevesini.
