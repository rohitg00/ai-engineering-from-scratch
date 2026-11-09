# Ses Transformatörleri  Fısıltıcı Arsitektur

> Ses, zamanla frekansın bir görüntüdür.

**Type:** Learn
**Languages:** Python, Rust
**Prerequisites:** Phase 7 · 05 (Full Transformer), Phase 7 · 08 (Encoder-Decoder), Phase 7 · 09 (ViT)
**Time:** ~45 minutes

## Sorun

Whisper'den önce (OpenAI, Radford et al. 2022), en gelişmiş otomatik konuşma tanıma (ASR) wav2vec 2.0 ve HuBERT  kendiliğinden denetim edilen özellik çıkarıcıları ve ince ayarlanmış bir baş anlamına geliyordu. Yüksek kalite, pahalı veri boru hattları, alan kırılganlığı. Çok dilli konuşma tanıma dil ailesi başına ayrı modeller gerektiriyordu.

Whisper üç bahis yaptı:

1. **Train on everything.**İnternetten 97 dilde 680.000 saat zayıf etiketli ses çıkartıldı temiz akademik bir kitap yok fonem etiketleri yok.
2. **Multi-task single model.**Bir dekoder, birlikte transkripsiyon, çeviri, ses etkinliği algılama, dil kimliği ve görev işaretleri aracılığıyla zaman damgası konusunda eğitilmiştir.
3. **Standard encoder-decoder transformer.**Kodlayıcı log-mel spektrogramlarını tüketir. Dekoder metin belirtilerini otomatik olarak üretir. Vocoder, CTC, HMM yoktur.

Sonuç: Whisper large-v3 aksan, gürültü ve sıfır temiz etiketlenmiş verilere sahip diller arasında sağlamdır. 2026'da her açık kaynaklı ses asistanı ve çoğu ticari için öntanımlı konuşma ön ucudur.

## Anlaşım

![Whisper pipeline: audio → mel → encoder → decoder → text](../assets/whisper.svg)

### Adım 1  Yeniden örnekleme + pencere

Ses 16 kHz. Klip/pad 30 saniye. Hesaplama log-mel spektrogramı: 80 mel bin, 10 ms adım → ~ 3.000 çerçeve × 80 özellik. Bu Whisper'in gördüğü "girinme görüntüsü".

### Adım 2  kıvrımlı gövde

Kerne 3 ve adım 2 ile iki Conv1D katmanı 3000 çerçeveyi 1.500'e düşürür.

### Adım 3  kodlayıcı

Bir 24 katmanlı (büyük) 1500 zaman aşamasında bir transformer kodlayıcı. Sinusoidal pozisyon kodlaması, kendi kendine dikkat, GELU FFN. 1,500 × 1,280 gizli durum üretir.

### Adım 4  dekodör

24 katmanlı bir transformatör dekodörü. Bir kaç ses özel özel jetonlarla GPT-2'lerin bir süperset olan bir BPE sözlükten jetonlar üretir.

### Adım 5  görev işaretleri

Dekodör istekleri, modelin ne yapacağını söyleyen kontrol işaretleriyle başlar:

```
<|startoftranscript|>  <|en|>  <|transcribe|>  <|0.00|>
```

veya

```
<|startoftranscript|>  <|fr|>  <|translate|>   <|0.00|>
```

Bu model bu konvensiyona göre eğitilmiştir. Görevleri önbellekle kontrol ediyorsunuz. 2026'da talimat ayarlama eşdeğeri, ama konuşmaya uygulanır.

### Adım 6  çıkış

Çığlık arama (genişlik 5) log-prob eşiği ile.`<|notimestamps|>`Token yok.

### Şapşırma boyutları

| Model | Params | Layers | d_model | Heads | VRAM (fp16) |
|-------|--------|--------|---------|-------|-------------|
| Tiny | 39M | 4 | 384 | 6 | ~1 GB |
| Base | 74M | 6 | 512 | 8 | ~1 GB |
| Small | 244M | 12 | 768 | 12 | ~2 GB |
| Medium | 769M | 24 | 1024 | 16 | ~5 GB |
| Large | 1550M | 32 | 1280 | 20 | ~10 GB |
| Large-v3 | 1550M | 32 | 1280 | 20 | ~10 GB |
| Large-v3-turbo | 809M | 32 | 1280 | 20 | ~6 GB (4-layer decoder) |

Büyük v3-turbo (2024) 32 katmanlı bir decoder'i <1 WER nokta geri dönüşü ile 4.8x daha hızlı decoder'e düşürüyor.

### Şapşırmanın yapmadığı şeyler

- Günlükleme yok, bunun için bir çiftlik.
- Gerçek zamanlı akış yok  30 saniyelik pencerenin sabitlenmesi.`faster-whisper`- Evet .`WhisperX`) VAD + üst üste geçiş yoluyla akış açısını kapatmak.
- Dış parçalanmadan 30 saniye sonra uzun şekil bağlamı yoktur. İnsan konuşmasının transkripsiyon için nadiren uzun mesafeli bağlamın gerekliliği olduğu için pratikte iyi çalışır.

### 2026 manzarası

| Task | Model | Notes |
|------|-------|-------|
| English ASR | Whisper-turbo, Moonshine | Moonshine is 4× faster on edge |
| Multilingual ASR | Whisper-large-v3 | 97 languages |
| Streaming ASR | faster-whisper + VAD | 150 ms latency targets achievable |
| TTS | Piper, XTTS-v2, Kokoro | Encoder-decoder pattern, but Whisper-shaped |
| Audio + language | AudioLM, SeamlessM4T | Text tokens + audio tokens in one transformer |

```figure
n5-mel-decode
```

## Yapın

Bakın .`code/main.py`Biz Whisper'i eğitmiyoruz. log-mail spektrogram hattını + görev belirtileri uyarı formatörünü yapıyoruz.

### Adım 1: Ses sentezi

16 kHz'de 16 bin numune ile 440 Hz'de bir saniyelik sinüs dalgasını üretmek.

### Adım 2: Log-mel spektrogramı (sederletilmiş)

Tam mel spektrogramı FFT gerektirir.`librosa`- ...

```python
def frame_signal(x, frame_size=400, hop=160):
    frames = []
    for start in range(0, len(x) - frame_size + 1, hop):
        frames.append(x[start:start + frame_size])
    return frames
```

Çerçeve = 25 ms, hop = 10 ms. Whisper'in penceresine uyuyor.

### Adım 3: 30 saniye

Whisper her zaman 30 saniyelik parçaları işliyor.

### Adım 4: Hemen simgeler oluştur

```python
def whisper_prompt(lang="en", task="transcribe", timestamps=True):
    tokens = ["<|startoftranscript|>", f"<|{lang}|>", f"<|{task}|>"]
    if not timestamps:
        tokens.append("<|notimestamps|>")
    return tokens
```

Bu görev kontrol yüzeyinin tamamı.

## Kullan

```python
import whisper
model = whisper.load_model("large-v3-turbo")
result = model.transcribe("meeting.wav", language="en", task="transcribe")
print(result["text"])
print(result["segments"][0]["start"], result["segments"][0]["end"])
```

Daha hızlı, OpenAI ile uyumlu:

```python
from faster_whisper import WhisperModel
model = WhisperModel("large-v3-turbo", compute_type="int8_float16")
segments, info = model.transcribe("meeting.wav", vad_filter=True)
for s in segments:
    print(f"{s.start:.2f} - {s.end:.2f}: {s.text}")
```

**When to pick Whisper in 2026:**

- Bir model ile çok dilli ASR.
- gürültülü, çeşitlilikli seslerin sağlam bir transkripsiyonu.
- Araştırma / prototip ASR  en hızlı başlangıç noktası.

**When to pick something else:**

- Ultra düşük gecikme oranında  Moonshine eşleşen kaliteli Whisper'i yener.
- Gerçek zamanlı sohbet AI'si <200 ms  özel akış ASR'ye ihtiyaç duyar.
- Konuşmacı günlükleştirme  Fısıltı bunu yapmaz; pyannote'de bir şırıltı.

## Gönder

Bakın .`outputs/skill-asr-configurator.md`. Yetenek bir ASR modeli, kodlama parametreleri ve yeni bir konuşma uygulaması için önceden işleme boru hattını seçer.

## Egzersizler

1. **Easy.**Çık .`code/main.py`16 kHz'de 1 saniye sinyal için 10 ms hop'un 100 kadro olduğunu onaylayın. 30 saniye için: 3000 kadro.
2. **Medium.**Tüm log-mel spektrogramını kullanarak oluşturun `numpy.fft`80 tane kutu eşleşmesini kontrol et .`librosa.feature.melspectrogram(n_mels=80)`Sayı hataları içinde.
3. **Hard.**Akış sonucu uygulamak: 2 saniyelik bir üst üstelik 10 saniyelik pencerelere parça ses, her parça üzerinde fısıldayarak çalıştırmak, transkriptleri birleştirmek. 5 dakikalık bir podcast örneğinde kelime hatası oranını vs. tek geçiş oranını ölçmek.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Mel spectrogram | "Audio image" | 2D representation: frequency bins on one axis, time frames on the other; log-scaled energy per cell. |
| Log-mel | "What Whisper sees" | Mel spectrogram passed through log; approximates human perception of loudness. |
| Frame | "One time slice" | A 25 ms window of samples; overlapping at 10 ms stride. |
| Task token | "Prompt prefix for speech" | Special tokens like `<\|transcribe\|>` / `<\|translate\|>` in the decoder prompt. |
| Voice activity detection (VAD) | "Find the speech" | Gate that removes silence before ASR; cuts cost massively. |
| CTC | "Connectionist Temporal Classification" | Classic ASR loss for alignment-free training; Whisper does NOT use it. |
| Whisper-turbo | "Small decoder, full encoder" | large-v3 encoder + 4-layer decoder; 8× faster decoding. |
| Faster-whisper | "The production wrapper" | CTranslate2 reimplementation; int8 quantization; 4× faster than OpenAI's reference. |

## Daha Fazla Okumak

- [Radford et al. (2022). Robust Speech Recognition via Large-Scale Weak Supervision](https://arxiv.org/abs/2212.04356) Fısıltı kağıdı.
- [OpenAI Whisper repo](https://github.com/openai/whisper) Referans kodu + model ağırlıkları.`whisper/model.py`Conv1D kökünü + kodlayıcı + dekodörü yukarıdan aşağıya 400 satırda görmek için.
- [OpenAI Whisper — `whisper/decoding.py`](https://github.com/openai/whisper/blob/main/whisper/decoding.py) Adım 56'da açıklanan ışın araması + görev belirti mantığı burada; 500 satır, tamamen okunur.
- [Baevski et al. (2020). wav2vec 2.0: A Framework for Self-Supervised Learning of Speech Representations](https://arxiv.org/abs/2006.11477) öncü; bazı ayarlarda hala SOTA özellikleri.
- [SYSTRAN/faster-whisper](https://github.com/SYSTRAN/faster-whisper) üretim ambalajı, referanstan 4x daha hızlı.
- [Jia et al. (2024). Moonshine: Speech Recognition for Live Transcription and Voice Commands](https://arxiv.org/abs/2410.15608) 2024 kenar dostu ASR, Fısıltı şeklinde ama daha küçük.
- [HuggingFace blog — "Fine-Tune Whisper For Multilingual ASR with 🤗 Transformers"](https://huggingface.co/blog/fine-tune-whisper) mel spektrogram önceden işlemeci ve simge zaman damgası kullanımı dahil olmak üzere kanonik ince ayarlama tarifi.
- [HuggingFace `modeling_whisper.py`](https://github.com/huggingface/transformers/blob/main/src/transformers/models/whisper/modeling_whisper.py) ders mimarisi şemalarını yansıtan tam uygulamayı (kodlama, dekodlama, çapraz dikkat, jenerasyon).
