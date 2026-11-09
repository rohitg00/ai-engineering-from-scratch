# Ses Aktivitesini tespit ve dönüş yapma  Silero, Cobra ve Flush Trick

> Her ses ajansı iki karar üzerine yaşar veya ölür: kullanıcı şimdi konuşuyor mu, ve onlar bitti mi? VAD ilkine cevap verir. Dönüş algısı (VAD + sessizlik-sükûp + semantik uç noktası modeli) ikincine cevap verir. Yanlış yapın ve asistanınız ya kullanıcıları keser ya da asla susmaz.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 11 (Real-Time Audio), Phase 6 · 12 (Voice Assistant)
**Time:** ~45 minutes

## Sorun

Sesli bir ajanın her 20 ms'lık bir bölümde yaptığı üç farklı karar:

1. **Is this frame speech?**- Biner, çerçeve başına.
2. **Has the user started a new utterance?** başlangıç algısı.
3. **Has the user finished?** son yönlendirme (turn-end).

Naif cevap (enerji eşiği) herhangi bir gürültüde başarısız olur  trafik, klavyeler, kalabalık böbürleri. 2026 cevabı: Silero VAD (açık, derin öğrenilen) + bir dönüş algılama modeli (semantik son işaretleme) + VAD kalibrli bir sessizlik sarhoşluğu.

## Anlaşım

![VAD cascade: energy → Silero → turn-detector → flush trick](../assets/vad-turn-taking.svg)

### Üç katlı VAD kaskasası

**Tier 1: energy gate.**En ucuz, -40 dBFS'de RMS eşiği, açık sessizlik filtreleri ama eşiğinden yüksek herhangi bir gürültü ateş eder.

**Tier 2: Silero VAD**1M parametreleri. 6000+ dilde eğitilmiş. Tek bir CPU düğümünde 30 ms parçası başına ~ 1 ms'de çalışır. % 5 FPR'de % 87,7 TPR. Açık kaynak öntanımlı.

**Tier 3: semantic turn detector.**LiveKit'in dönüş algılama modeli (2024-2026) veya kendi küçük sınıflandırıcınız. "Söz ortasında durmak" ile "dedikten sonra konuşmayı" ayırır.

### Ana parametreler ve öntanımlı özellikleri

- **Threshold.**Silero bir olasılık çıkarır; konuşmayı &gt; 0.5 (devay) veya &gt; 0.3 (hissli) olarak sınıflandırın.
- **Minimum speech duration.**250 ms' dan kısa konuşmayı reddet  genellikle öksürük veya sandalye gürültüsü.
- **Silence hangover (end-pointing).**VAD 0'ya döndükten sonra, dönüşün sonunu ilan etmeden önce 500-800 ms bekleyin. Çok kısa → keskin kullanıcı. Çok uzun → yavaş hissettiriyor.
- **Pre-roll buffer.**VAD ateşlemeden önce 300-500 ms ses tutun. "Hey" kesilmesini önler.

### Flush numarası (Kyutai 2025)

Akış STT modelleri ileriye bakma gecikmesine sahiptir (Kyutai STT-1B için 500 ms, STT-2.6B için 2.5 saniye).**send a flush signal to the STT**STT gerçek zamanlı olarak 4× işlem yapar, bu yüzden 500 ms tampon yaklaşık 125 ms'de biter.

Son-son: 125 ms VAD + flush STT = konuşma gecikmesi.

### 2026 VAD karşılaştırması

| VAD | TPR @ 5% FPR | Latency | License |
|-----|--------------|---------|---------|
| WebRTC VAD (Google, 2013) | 50.0% | 30 ms | BSD |
| Silero VAD (2020-2026) | 87.7% | ~1 ms | MIT |
| Cobra VAD (Picovoice) | 98.9% | ~1 ms | commercial |
| pyannote segmentation | 95% | ~10 ms | MIT-ish |

Silero, doğru varsayımdır. Cobra, uyumluluk / doğruluk yükseltmesidir. Sadece enerjiye sahip VAD'ın 2026 üretiminde yeri yoktur.

```figure
sp-vad-cascade
```

## Yapın

### Adım 1: Enerji kapısı

```python
def energy_vad(chunk, threshold_dbfs=-40.0):
    rms = (sum(x * x for x in chunk) / len(chunk)) ** 0.5
    dbfs = 20.0 * math.log10(max(rms, 1e-10))
    return dbfs > threshold_dbfs
```

### Adım 2: Silero VAD Python

```python
from silero_vad import load_silero_vad, get_speech_timestamps

vad = load_silero_vad()
audio = torch.tensor(waveform_16k, dtype=torch.float32)
segments = get_speech_timestamps(
    audio, vad, sampling_rate=16000,
    threshold=0.5,
    min_speech_duration_ms=250,
    min_silence_duration_ms=500,
    speech_pad_ms=300,
)
for s in segments:
    print(f"{s['start']/16000:.2f}s - {s['end']/16000:.2f}s")
```

### Adım 3: Son dönüm devleti makinesi

```python
class TurnDetector:
    def __init__(self, silence_hangover_ms=500, min_speech_ms=250):
        self.state = "idle"
        self.speech_ms = 0
        self.silence_ms = 0
        self.silence_hangover_ms = silence_hangover_ms
        self.min_speech_ms = min_speech_ms

    def update(self, is_speech, chunk_ms=20):
        if is_speech:
            self.speech_ms += chunk_ms
            self.silence_ms = 0
            if self.state == "idle" and self.speech_ms >= self.min_speech_ms:
                self.state = "speaking"
                return "START"
        else:
            self.silence_ms += chunk_ms
            if self.state == "speaking" and self.silence_ms >= self.silence_hangover_ms:
                self.state = "idle"
                self.speech_ms = 0
                return "END"
        return None
```

### Dördüncü adım: Fırıltılı bir sünger kemiri

```python
def flush_on_end(stt_client, audio_buffer):
    stt_client.send_audio(audio_buffer)
    stt_client.send_flush()
    return stt_client.recv_transcript(timeout_ms=150)
```

STT (Kyutai, Deepgram, AssemblyAI) bunun çalışması için flush desteği olmalıdır.

## Kullan

| Situation | VAD choice |
|-----------|-----------|
| Open, fast, general | Silero VAD |
| Commercial call center | Cobra VAD |
| On-device (phone) | Silero VAD ONNX |
| Research / diarization | pyannote segmentation |
| Zero-dependency fallback | WebRTC VAD (legacy) |
| Need turn-ending quality | Silero + LiveKit turn-detector layered |

Baskır kural: başka bir seçeneğiniz yoksa asla enerjiye bağlı VAD'leri göndermeyin.

## Tuzaklar

- **Fixed threshold.**Sessiz çalışır, gürültülü çalışırken başarısız olur.
- **Too-short silence hangover.**Ajan cümle ortasında keser. 500-800 ms konuşma için en iyi noktayı.
- **Too-long hangover.**Hedef kullanıcıları ile A/B testi.
- **No pre-roll buffer.**İlk 200-300 ms kullanıcı sesini kaybettim.
- **Ignoring semantic endpointing.**"Hmm, bırak düşünme"... uzun süreli molalar içerir. Kullanıcılar düşüncelerinin ortasında kesilmekten nefret eder.

## Gönder

- Kaydet .`outputs/skill-vad-tuner.md`- Bir iş yükü için VAD modeli, eşiği, sarhoşluğu, ön rol ve dönüş algılama stratejisini seçin.

## Egzersizler

1. **Easy.**Çık .`code/main.py`Konuşma + sessizlik + konuşma + öksürük dizisini simüle eder ve üç VAD seviyesini test eder.
2. **Medium.**Kurulum`silero-vad`, 5 dakikalık bir kayıt işleme, hem ilk kelime klipleri hem de yanlış tetikleyicileri en aza indirmek için ayarlama eşiği.
3. **Hard.**Mini dönüş algılayıcısı oluşturun: Silero VAD + son 10 kelimenin gömülmelerinde 3 katmanlı MLP (cümle dönüştürücülerini kullanın). El etiketli bir dönüş sonu veriler kümesi üzerinde çalışın. Sadece Silero'yu %10 F1 ile yenebilirsiniz.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| VAD | Voice detector | Binary per-frame: is this speech? |
| Turn detection | End-pointing | VAD + silence-hangover + semantic endpoint. |
| Silence hangover | Wait-after-speech | Time to wait before declaring turn end; 500-800 ms. |
| Pre-roll | Pre-speech buffer | Keep 300-500 ms audio before VAD fires. |
| Flush trick | Kyutai hack | VAD → flush-STT → 125 ms instead of 500 ms delay. |
| Semantic endpoint | "Did they mean to stop?" | ML classifier that looks at words, not just silence. |
| TPR @ FPR 5% | ROC point | Standard VAD benchmark; 87.7% for Silero, 50% WebRTC. |

## Daha Fazla Okumak

- [Silero VAD](https://github.com/snakers4/silero-vad) İpucu açık VAD.
- [Picovoice Cobra VAD](https://picovoice.ai/products/voice/voice-activity-detection/) Ticari doğruluk lideri.
- [Kyutai — Unmute + flush trick](https://kyutai.org/stt)- Sub-200 ms mühendislik hilesi.
- [LiveKit — turn detection](https://docs.livekit.io/agents/logic/turns/) üretimdeki semantik son gösterme.
- [WebRTC VAD](https://webrtc.googlesource.com/src/) miras alınan temel çizgi.
- [pyannote segmentation](https://github.com/pyannote/pyannote-audio) Günlükleştirme derecesi segmentasyonu.
