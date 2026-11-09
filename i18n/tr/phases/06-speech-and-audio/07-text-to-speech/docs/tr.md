# Metin-Söz (TTS)  Tacotron'dan F5 ve Kokoro'ya

> ASR konuşmayı metine çevirir; TTS metini konuşmaya çevirir. 2026 yığın üç parçadan oluşur: metin → jetonlar, jetonlar → mel, mel → dalga şekli. Her bölümde bir dizüstü bilgisayarına uyan bir varsayılan model vardır.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 02 (Spectrograms & Mel), Phase 5 · 09 (Seq2Seq), Phase 7 · 05 (Full Transformer)
**Time:** ~75 minutes

## Sorun

Bir ipiniz var: "Sevgililer, bana öğleden sonra saat 6'da bitkileri sulamayı hatırlatın". Doğal bir sesli, doğru bir prosodiye sahip olan, doğru vokal ile "bitkileri" telaffuz eden ve canlı bir ses asistanı için bir CPU'da 300 ms'den az süren 3 saniyelik bir ses klipi gerekiyor. Ayrıca ses değiştirmeniz, kod değiştirilmiş girişleri ("6'da hatırlat beni, daijoubu?") ile çalışmanız ve isimlerle utanmamanız gerekir.

Modern TTS boru hattları şöyle görünüyor:

1. **Text frontend.**Metni (tarihler, numaralar, e-postalar) normalleştirin, fonemlere veya alt sözcük işaretlerine dönüştürün, prosody özelliklerini tahmin edin.
2. **Acoustic model.**Metin → mel spektrogram. Tacotron 2 (2017), FastSpeech 2 (2020), VITS (2021), F5-TTS (2024), Kokoro (2024).
3. **Vocoder.**Mel → dalga şekli. WaveNet (2016), WaveRNN, HiFi-GAN (2020), BigVGAN (2022), 2024+'te sinir kodek vokodörleri.

2026'da akustik + vokodör uçtan uçta yayılma ve akış eşleşme modelleri ile parçalanır.

## Anlaşım

![Tacotron, FastSpeech, VITS, F5/Kokoro side-by-side](../assets/tts.svg)

**Tacotron 2 (2017).**Seq2seq: char-embedding → BiLSTM encoder → location-sensitive attention → autoregressive LSTM decoder mel frame'leri yayar.

**FastSpeech 2 (2020).**Bir sonlama, Tacotron'dan 10 kat daha hızlı. Biraz doğallik kaybeder (monoton uyum) ama her yere gemi.

**VITS (2021).**Birlikte kodlayıcı + akış tabanlı süresi + HiFi-GAN vokodörü sonu sonu sonu olarak varyasyonsal sonuçlandırma ile birlikte trenler. Yüksek kalite, tek model. Dominant açık kaynak TTS 20222024. Variantlar: YourTTS (büyük hoparlör sıfır çekim), XTTS v2 (2024, Coqui).

**F5-TTS (2024).**Doğal prosodi, sıfır çekim ses klonlaması, 5 saniye referans sesle. 2026 açık kaynaklı TTS sıralama tablolarının en üst kısmı. 335M param.

**Kokoro (2024).**Küçük (82M), CPU-işletilebilir, gerçek zamanlı kullanım için sınıfındaki en iyi İngilizce TTS.

**OpenAI TTS-1-HD, ElevenLabs v2.5, Google Chirp-3.**ElevenLabs v2.5 duygu etiketleri ("[Fısıltılı]", "[kahkaha]") ve karakter sesleri 2026'da sesli kitap üretimine hakim olur.

### Vocoder evrimi

| Era | Vocoder | Latency | Quality |
|-----|---------|---------|---------|
| 2016 | WaveNet | offline only | SOTA at release |
| 2018 | WaveRNN | ~realtime | good |
| 2020 | HiFi-GAN | 100× realtime | near-human |
| 2022 | BigVGAN | 50× realtime | generalizes across speakers/langs |
| 2024 | SNAC, DAC (neural codecs) | integrated with AR models | discrete tokens, bit-efficient |

2026 yılına kadar çoğu "TTS" modeli metinden dalga şekline son derece uzaktır; mel spektrogram bir iç temsilidir.

### Değerlendirme

- **MOS (Mean Opinion Score).**1-5 ölçeği, kalabalık kaynaklı.
- **CMOS (Comparative MOS).**A-vs-B tercihleri, her not için daha sıkı güven aralıkları.
- **UTMOS, DNSMOS.**Referanssız sinirsel MOS tahmincileri, sıralama çizelgeleri için kullanılır.
- **CER (Character Error Rate) via ASR.**TTS çıkışını Whisper üzerinden çalıştır, giriş metnini CER ile hesapla.
- **SECS (Speaker Embedding Cosine Similarity).**Ses klonlama kalitesi.

LibriTTS test temizlemesi için 2026 numarası:

| Model | UTMOS | CER (via Whisper) | Size |
|-------|-------|-------------------|------|
| Ground truth | 4.08 | 1.2% | — |
| F5-TTS | 3.95 | 2.1% | 335M |
| XTTS v2 | 3.81 | 3.5% | 470M |
| VITS | 3.62 | 3.1% | 25M |
| Kokoro v0.19 | 3.87 | 1.8% | 82M |
| Parler-TTS Large | 3.76 | 2.8% | 2.3B |

```figure
sp-tts-stack
```

## Yapın

### Adım 1: fonemize giriş

```python
from phonemizer import phonemize
ph = phonemize("Hello world", language="en-us", backend="espeak")
# 'həloʊ wɜːld'
```

Phonemler evrensel bir köprüdür.

### Adım 2: Kokoro (2026 CPU varsayılan) çalıştır

```python
from kokoro import KPipeline
tts = KPipeline(lang_code="a")  # "a" = American English
audio, sr = tts("Please remind me to water the plants at 6 pm.", voice="af_bella")
# audio: float32 tensor, sr=24000
```

Oplandık, tek dosya, 82M param.

### Adım 3: Ses klonlaması ile F5-TTS çalıştır

```python
from f5_tts.api import F5TTS
tts = F5TTS()
wav = tts.infer(
    ref_file="my_voice_5s.wav",
    ref_text="The quick brown fox jumps over the lazy dog.",
    gen_text="Please remind me to water the plants.",
)
```

5 saniyelik referans klipi + transkripti geçin; F5 prosodi ve timbre klonları.

### Adım 4: HiFi-GAN vokodörü sıfırdan

Bir öğretim metni için çok büyük ama şekli şöyle:

```python
class HiFiGAN(nn.Module):
    def __init__(self, mel_channels=80, upsample_rates=[8, 8, 2, 2]):
        super().__init__()
        # 4 upsample blocks, total 256x to go from mel-rate to audio-rate
        ...
    def forward(self, mel):
        return self.blocks(mel)  # -> waveform
```

Eğitim: karşıtlık (kısık pencerelerde ayrımcılık) + mel spektrogramı yeniden yapılandırma kaybı + özellik eşleşme kaybı.`hifi-gan`repo veya nvidia-NeMo.

### Adım 5: Tam boru hattı (pseudokod)

```python
text = "Please remind me at 6 pm."
phones = phonemize(text)
mel = acoustic_model(phones, speaker=alice)      # [T, 80]
wav = vocoder(mel)                                # [T * 256]
soundfile.write("out.wav", wav, 24000)
```

## Kullan

2026'da:

| Situation | Pick |
|-----------|------|
| Real-time English voice assistant | Kokoro (CPU) or XTTS v2 (GPU) |
| Voice cloning from 5 s reference | F5-TTS |
| Commercial character voices | ElevenLabs v2.5 |
| Audiobook narration | ElevenLabs v2.5 or XTTS v2 + fine-tune |
| Low-resource language | Train VITS on 5–20 h target-lang data |
| Expressive / emotion tags | ElevenLabs v2.5 or StyleTTS 2 fine-tune |

2026 yılına kadar açık kaynak liderleri: **F5-TTS for quality, Kokoro for efficiency**Tarihçi olmadıkça Tacotron'a ulaşmayın.

## Tuzaklar

- **No text normalizer.**"Dr. Smith" "Doctor" veya "Drive" olarak mı okunuyor? "2026" "twenty twenty six" veya "two zero two six" olarak mı?
- **OOV proper nouns.**"Ghumare" → "ghyu-mair"?
- **Clipping.**Vocoder çıkışı nadiren klipler, ama mel ölçekleme yanlış sonucu ±1.0 aşarak olabilir.`np.clip(wav, -1, 1)`- Evet .
- **Sample-rate mismatch.**Kokoro 24 kHz çıkışı sağlar. Aşağıdaki boru hattınız 16 kHz → yeniden örneklenmesini bekler veya isimsizliğe sahip olur.

## Gönder

- Kaydet .`outputs/skill-tts-designer.md`. Belirli bir ses, gecikme ve dil hedefi için TTS boru hattı tasarlayın.

## Egzersizler

1. **Easy.**Çık .`code/main.py`Oyuncak sözcüklerinden fonem sözlüğü oluşturur, fonem başına sürenin tahminini yapar ve sahte bir "mel" programını basar.
2. **Medium.**Kokoro'yu yükle, sesle aynı cümleyi sentezle.`af_bella`ve `am_adam`- Ses sürelerini ve öznel kalitesi ile karşılaştırın.
3. **Hard.**Kendinizi 5 saniyelik referans klipi kaydetin, F5-TTS'i kullanın klonlayın ve referans ve klon çıkışları arasında SECS raporlayın.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Phoneme | Sound unit | Abstract sound class; 39 in English (ARPABet). |
| Duration predictor | How long each phoneme lasts | Non-AR model output; integer frames per phoneme. |
| Vocoder | Mel → waveform | Neural net mapping mel-spec to raw samples. |
| HiFi-GAN | Standard vocoder | GAN-based; dominant 2020–2024. |
| MOS | Subjective quality | 1–5 mean opinion score from human raters. |
| SECS | Voice-clone metric | Cosine similarity between target and output speaker embedding. |
| F5-TTS | 2024 open-source SOTA | Flow-matching diffusion; zero-shot cloning. |
| Kokoro | CPU English leader | 82M-param model, Apache 2.0. |

## Daha Fazla Okumak

- [Shen et al. (2017). Tacotron 2](https://arxiv.org/abs/1712.05884) sek2 sek'in başlangıç çizgisi.
- [Kim, Kong, Son (2021). VITS](https://arxiv.org/abs/2106.06103) Sonundan sonuna akış tabanlı.
- [Chen et al. (2024). F5-TTS](https://arxiv.org/abs/2410.06885) mevcut açık kaynaklı SOTA.
- [Kong, Kim, Bae (2020). HiFi-GAN](https://arxiv.org/abs/2010.05646)2026'da hala gemiye giden Vocoder.
- [Kokoro-82M on HuggingFace](https://huggingface.co/hexgrad/Kokoro-82M) 2024 CPU dostu İngiliz TTS.
