# Gerçek Zamanlı Ses İşleme

> Toplu işlem hatları bir dosyayı işler. Gerçek zamanlı işlem hatları, sonraki 20 milisaniye gelmeden sonraki 20 milisaniyeyi işler. Her konuşma yapay zekası, yayın stüdyosu ve telefon robotu bu gecikme bütçesine göre yaşar ve ölür.

**Tür:** Yapım
**Diller:** Python
**Önkoşullar:** Aşama 6 · 02 (Spektrogramlar), Aşama 6 · 04 (ASR), Aşama 6 · 07 (TTS)
**Süre:** ~75 dakika

## Sorun

Canlı hissettiren bir sesli asistan istiyorsunuz. İnsan konuşmasında sıra alma gecikmesi ~230 ms'dir (sessizlikten yanıta). 500 ms'nin üzerindeki her şey robot gibi geliyor; 1500 ms'nin üzerinde kırık hissi veriyor. 2026'daki tam **duy → anla → yanıtla → konuş** döngüsünün bütçesi şöyledir:

| Sahne | Bütçe |
|-------|--------|
| Mikrofon → arabellek | 20 ms |
| VAD | 10 ms |
| ASR (akış) | 150 ms |
| Yüksek Lisans (ilk token) | 100 ms |
| TTS (ilk parça) | 100 ms |
| Oluştur → hoparlör | 20 ms |
| **Toplam** | **~400 ms** |

Moshi (Kyutai, 2024) 200 ms tam çift yönlü hıza ulaştı. GPT-4o-gerçek zamanlı (2024) saatler ~320 ms. 2022'de kademeli boru hatları 2500 ms'de sevk edildi. 10 katlık iyileştirme üç teknikten geldi: (1) her yere akış, (2) kısmi sonuçlarla eşzamansız ardışık düzen, (3) kesintili üretim.

## Konsept

![Halka arabelleği, VAD geçidi, kesinti ile ses akışı akışı](../assets/real-time.svg)

**Çerçeve / yığın / pencere.** Gerçek zamanlı ses, sabit boyutlu bloklar halinde akar. Ortak seçim: 20 ms (16 kHz'de 320 örnek). Aşağı yöndeki her şey bu tempoya ayak uydurmak zorundadır.

**Halka arabellek.** Sabit boyutlu dairesel arabellek. Üretici dizisi yeni çerçeveler yazar, tüketici dizisi okur. Sıcak yoldaki tahsisleri önler. Boyut ≈ maksimum gecikme süresi × örnekleme hızı; 2 saniyelik 16 kHz halka = 32.000 örnek.

**VAD (Ses Etkinliği Algılama).** Gates aşağı yönde kimse konuşmadığında çalışır. Silero VAD 4.0 (2024), CPU'da 30 ms kare başına <1 ms çalışır. `webrtcvad` daha eski bir alternatiftir.

**Akış ASR'si.** Ses geldiğinde kısmi transkriptler yayınlayan modeller. Akış modunda Parakeet-CTC-0.6B (NeMo, 2024), 320 ms gecikmede %2–5 WER yapar. Whisper-Streaming (Macháček ve diğerleri, 2023), Whisper'ı yaklaşık 2 sn gecikmeyle yakın akış için parçalar.

**Kesinti.** Asistan konuşurken kullanıcı konuştuğunda, (a) içeri girmeyi algılamanız, (b) TTS'yi durdurmanız, (c) kalan LLM çıkışını atmanız gerekir. Tümü 100 ms içinde veya kullanıcı sağır asistanı algılar.

**WebRTC Opus aktarımı.** 20 ms kare, 48 kHz, uyarlanabilir bit hızı 8–128 kbps. Tarayıcı ve mobil cihazlar için standart. LiveKit, Daily.co, Pion, sesli uygulamalar oluşturmaya yönelik 2026 yığındır.

**Titreşim arabelleği.** Ağ paketleri sıra dışı/geç geliyor. Titreşim arabelleği yeniden sıralanır ve düzeltilir; çok küçük → duyulabilir boşluklar, çok büyük → gecikme. 60–80 ms tipik.

### Sık karşılaşılan sorunlar

- **Konu çekişmesi.** Python'un GIL + ağır modelleri ses akışını aç bırakabilir. Bir C-geri çağırma ses kitaplığı (sounddevice, PortAudio) kullanın ve Python'u sıcak yoldan uzak tutun.
- **Örnekleme hızı dönüştürme gecikmesi.** Ardışık düzen içinde yeniden örnekleme 5-20 ms ekler. Önceden yeniden örnekleme yapın veya sıfır gecikmeli bir yeniden örnekleyici kullanın (PolyPhase, `soxr_hq`).
- **TTS hazırlama.** Kokoro gibi hızlı TTS'lerin bile ilk istek üzerine 100-200 ms'lik ısınması vardır. Önbellek modeli + ilk gerçek dönüşten önce yapay bir koşuyla ısıtın.
- **Yankı iptali.** AEC olmadan, TTS çıkışı mikrofona yeniden girer ve botun kendi sesinde ASR'yi tetikler. WebRTC AEC3 açık kaynak varsayılanıdır.

```figure
nyquist-aliasing
```

## İnşa Et

### Adım 1: halka tamponu

```python
import collections

class RingBuffer:
    def __init__(self, capacity):
        self.buf = collections.deque(maxlen=capacity)
    def write(self, frame):
        self.buf.extend(frame)
    def read(self, n):
        return [self.buf.popleft() for _ in range(min(n, len(self.buf)))]
    def level(self):
        return len(self.buf)
```

Kapasite maksimum ara belleğe alma gecikmesini belirler. 16 kHz'de 32.000 örnek = 2 sn.

### Adım 2: VAD kapısı

```python
def simple_energy_vad(frame, threshold=0.01):
    return sum(x * x for x in frame) / len(frame) > threshold ** 2
```

Üretimde Silero VAD ile değiştirin:

```python
import torch
vad, _ = torch.hub.load("snakers4/silero-vad", "silero_vad")
is_speech = vad(torch.tensor(frame), 16000).item() > 0.5
```

### 3. Adım: ASR akışı

```python
# Parakeet-CTC-0.6B streaming via NeMo
from nemo.collections.asr.models import EncDecCTCModelBPE
asr = EncDecCTCModelBPE.from_pretrained("nvidia/parakeet-ctc-0.6b")
# chunk_ms=320 ms, look_ahead_ms=80 ms
for chunk in audio_stream():
    partial_text = asr.transcribe_streaming(chunk)
    print(partial_text, end="\r")
```

### Adım 4: kesinti işleyicisi

```python
class Dialog:
    def __init__(self):
        self.tts_task = None

    def on_user_speech(self, frame):
        if self.tts_task and not self.tts_task.done():
            self.tts_task.cancel()   # barge-in
        # then feed to streaming ASR

    def on_final_user_utterance(self, text):
        self.tts_task = asyncio.create_task(self.reply(text))

    async def reply(self, text):
        async for tts_chunk in llm_then_tts(text):
            speaker.write(tts_chunk)
```

Eşzamansız G/Ç ve iptal edilebilir TTS akışına bağlıdır. Ses kanalındaki WebRTC peerconnection.stop() kanonik yoldur.

## Kullan onu

2026 yığını:

| Katman | Seç |
|-------|------|
| Taşıma | LiveKit (WebRTC) veya Pion (Go) |
| VAD | Silero VAD 4.0 |
| ASR Akışı | Parakeet-CTC-0.6B veya Whisper-Streaming |
| Yüksek Lisans ilk-token | Groq, Cerebras, vLLM akışı |
| TTS Akışı | Kokoro veya ElevenLabs Turbo v2.5 |
| Yankı iptali | WebRTC AEC3 |
| Uçtan uca yerel | OpenAI Gerçek Zamanlı API veya Moshi |

## Tuzaklar

- **Güvenlik amacıyla 500 ms ara belleğe alınıyor.** Ara bellek *gecikme tabanınızdır*. Küçült.
- **İş dizileri sabitlenmiyor.** Kullanıcı arayüzünden daha düşük önceliğe sahip bir iş parçacığında sesli geri arama = yük altında hatalar.
- **TTS parçaları çok küçük.** 200 ms'nin altındaki parçalar ses kodlayıcı artifact'lerin duyulabilir olmasını sağlar. 320 ms'lik parçalar tatlı noktadır.
- **Titreşim arabelleği yok.** Gerçek ağlar titrektir; yumuşatmadan patlamalar elde edersiniz.
- **Tek seferde hata işleme.** Ses hatları çökmeye dayanıklı olmalıdır. Bir istisna oturumu sonlandırır.

## Gönderin

`outputs/skill-realtime-designer.md` olarak kaydedin. Aşama başına somut gecikme bütçeleriyle gerçek zamanlı bir ses hattı tasarlayın.

## Egzersizler

1. **Kolay.** `code/main.py`'yi çalıştırın. Bir halka tamponu + enerji VAD'sini simüle eder; 10 saniyelik sahte bir akış için sahne gecikmelerini yazdırır.
2. **Orta.** `sounddevice` kullanarak, mikrofonunuzu 20 ms karelerde işleyen ve her karede VAD durumunu yazdıran bir geçiş döngüsü oluşturun.
3. **Zor.** `aiortc` ile tam çift yönlü yankı testi oluşturun: tarayıcı → WebRTC → Python → WebRTC → tarayıcı. 1 kHz darbeyle camdan cama gecikmeyi ölçün.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|-----------------|-----------------------|
| Halka tamponu | Dairesel kuyruk | Ses çerçeveleri için sabit boyutlu, kilitsiz (veya SPSC kilitli) FIFO. |
| VAD | Sessizlik kapısı | Model veya buluşsal işaretleme konuşması ve konuşma dışı karşılaştırması. |
| ASR Akışı | Gerçek Zamanlı STT | Ses geldiğinde kısmi metin yayınlar; sınırlı ileri bakış. |
| Titreşim arabelleği | Ağ daha sorunsuz | Sıra dışı paketleri yeniden sıraya koyma; 60–80 ms tipik. |
| AEC | Yankı iptali | Hoparlörden mikrofona geri bildirim yolunu çıkarır. |
| Katılma | Kullanıcı kesintisi | Sistem, TTS'nin ortasında kullanıcı konuşmasını algılar; oynatmayı iptal etmelisiniz. |
| Tam çift yönlü | Her iki yönde eşzamanlı | Kullanıcı ve bot aynı anda konuşabilir; Moshi tam çift yönlüdür. |

## Daha Fazla Okuma

- [Macháček ve ark. (2023). Whisper-Streaming](https://arxiv.org/abs/2307.14743) — parçalanmış yakın akışlı Whisper.
-[Kyutai (2024). Moshi](https://kyutai.org/Moshi.pdf) — tam çift yönlü 200 ms gecikme.
- [LiveKit Agents framework (2024)](https://docs.livekit.io/agents/) — üretim sesi agent orkestrasyonu.
- [Silero VAD deposu](https://github.com/snakers4/silero-vad) — 1 ms'nin altında VAD, Apache 2.0.
- [WebRTC AEC3 kağıdı](https://webrtc.googlesource.com/src/+/main/modules/audio_processing/aec3/) — açık kaynak altında yankı iptali.
