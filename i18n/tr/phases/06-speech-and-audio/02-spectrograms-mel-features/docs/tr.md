# Spektrogramlar, Mel Skala ve Ses Özellikleri

> Neural ağlar çiğ dalga biçimlerini iyi tüketmezler. Spektrogramları tüketirler. Mel spektrogramlarını daha iyi tüketirler. 2026'da her ASR, TTS ve ses sınıflandırıcısı bu tek önceden işleme seçeneğiyle yaşar veya ölür.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 01 (Audio Fundamentals)
**Time:** ~45 minutes

## Sorun

10 saniyelik 16 kHz klip al. 160.000 dalga.`[-1, 1]`"Köpek havlaması" ya da " kedi kelimesi" etiketleriyle neredeyse tamamen ilişkili olmayan. Çiğ dalga şekli bilgiyi içerir, ancak bir biçimde model kolayca çıkaramaz. 100 ms arası konuşulan iki aynı fonem tamamen farklı çiğ örneklere sahiptir.

Bir spektrogram bunu düzeltir. İnsan algısının onu görmezden geldiği zamansal ayrıntıları çökür (mikrosekundu jitter) ve algının katıldığı yapı (frequency enerjik olan, ~ 1025 ms'lik zaman pencereleri boyunca) korur.

Mel spektrogramları daha da ileriye doğru ilerler. İnsanlar yüksek sesleri logaritmik olarak algılar: 100 Hz vs. 200 Hz 1000 Hz vs. 2000 Hz ile "eşit mesafe" sesleri. Mel ölçeği frekans eksisini eşleşecek şekilde çarpıtır. Mel ölçeği spektrogramı 2010-2026 yılları arasında konuşma ML'de en önemli özelliktir.

## Anlaşım

![Waveform to STFT to mel spectrogram to MFCC ladder](../assets/mel-features.svg)

**STFT (Short-Time Fourier Transform).**Dalga şeklini üst üste döşen çerçevelere kes (tipik: 25 ms penceresi, 10 ms hop = 400 örnek / 16 kHz'de 160 örnek). Her çerçeveyi bir pencere işleviyle çarpın (Hann varsayılan; Hamming biraz farklı bir değişim).`(n_frames, n_freq_bins)`Bu senin spektrogramın.

**Log-magnitude.**Çömlek büyüklükleri 5-6 büyüklük sırası arasında değişir.`log(|X| + 1e-6)`veya `20 * log10(|X|)`Her üretim borusunda çiğ büyüklük değil, log büyüklüğü kullanılır.

**Mel scale.**Sıklık`f`Hz haritelerinde mel `m`- ...$m = 2595 \cdot \log_{10}(1 + f / 700)$. Haritalama yaklaşık olarak 1 kHz'nin altında lineer ve yukarıda yaklaşık olarak logaritmiktir.

**Mel filterbank.**Mel ölçeğinde eşit derecede uzanan üçgenli filtrelerin bir kümesi. Her filtreler, bitişik FFT kutularının ağırlıklı toplamıdır. STFT büyüklüğünü filtrebank matrisine çarpırsak, bir matmul'de mel spektrogramını verir.

**Log-mel spectrogram.** `log(mel_spec + 1e-10)`- Whisper'in girişleri, Parakeet'in girişleri, Seamless M4T'nin girişleri, evrensel 2026 ses ön uçları.

**MFCCs.**Log-mel spektrogramını alın, DCT (Tipe II) uygulayın, ilk 13 katılamı tutun. Özellikleri dekorele eder ve daha da sıkıştırır. Çöm log-mellerde CNN'ler / Transformers yakalandığı 2015 yılına kadar baskın özellik. Hâlâ hoparlör tanıma (x vektörleri, ECAPA) için kullanılır.

**Resolution trade.**Daha büyük FFT = daha iyi frekans çözünürlüğü ancak daha kötü zaman çözünürlüğü. 25 ms / 10 ms ses-ML standartıdır; müzik için 50 ms / 12.5 ms; geçici algılama için 5 ms / 2 ms (baton vurguları, plosivler).

```figure
spectrogram-window
```

## Yapın

### Adım 1: Dalga şeklini çerçeve

```python
def frame(signal, frame_len, hop):
    n = 1 + (len(signal) - frame_len) // hop
    return [signal[i * hop : i * hop + frame_len] for i in range(n)]
```

10 saniyelik 16 kHz klip ile `frame_len=400, hop=160`998 çerçeve verir.

### Adım 2: Hann penceresi

```python
import math

def hann(N):
    return [0.5 * (1 - math.cos(2 * math.pi * n / (N - 1))) for n in range(N)]
```

FFT'den önce element olarak çarpın. sıfır olmayan uç noktalarda kısaltma nedeniyle kaynaklanan spektral sızıntıları ortadan kaldırır.

### Adım 3: STFT büyüklüğü

```python
def stft_magnitude(signal, frame_len=400, hop=160):
    win = hann(frame_len)
    frames = frame(signal, frame_len, hop)
    return [magnitudes(dft([w * s for w, s in zip(win, f)])) for f in frames]
```

Üretim kullanımları `torch.stft`veya `librosa.stft`Bu döngü pedagojiktir; kısa klipler üzerinde çalışır.`code/main.py`- Evet .

### Dördüncü adım: mel filterbank

```python
def hz_to_mel(f):
    return 2595.0 * math.log10(1.0 + f / 700.0)

def mel_to_hz(m):
    return 700.0 * (10 ** (m / 2595.0) - 1)

def mel_filterbank(n_mels, n_fft, sr, fmin=0, fmax=None):
    fmax = fmax or sr / 2
    mels = [hz_to_mel(fmin) + (hz_to_mel(fmax) - hz_to_mel(fmin)) * i / (n_mels + 1)
            for i in range(n_mels + 2)]
    hzs = [mel_to_hz(m) for m in mels]
    bins = [int(h * n_fft / sr) for h in hzs]
    fb = [[0.0] * (n_fft // 2 + 1) for _ in range(n_mels)]
    for m in range(n_mels):
        for k in range(bins[m], bins[m + 1]):
            fb[m][k] = (k - bins[m]) / max(1, bins[m + 1] - bins[m])
        for k in range(bins[m + 1], bins[m + 2]):
            fb[m][k] = (bins[m + 2] - k) / max(1, bins[m + 2] - bins[m + 1])
    return fb
```

80 mels 08 kHz ile`n_fft=400`bir `(80, 201)`Matrix.`(n_frames, 201)`Transpose ile STFT büyüklüğü elde etmek için `(n_frames, 80)`Mel spektrogramı.

### Adım 5: log-mel

```python
def log_mel(mel_spec, eps=1e-10):
    return [[math.log(max(v, eps)) for v in frame] for frame in mel_spec]
```

Ortak alternatifler: `librosa.power_to_db`(referans normallaştırılmış dB),`10 * log10(power + eps)`. Whisper daha fazla katılımcı bir klip kullanır + rutinleri normalleştirir (Whisper's `log_mel_spectrogram`)

### Adım 6: MFCC'ler

```python
def dct_ii(x, n_coeffs):
    N = len(x)
    return [
        sum(x[n] * math.cos(math.pi * k * (2 * n + 1) / (2 * N)) for n in range(N))
        for k in range(n_coeffs)
    ]
```

Bu, MFCC matrisinizdir. İlk katı genellikle düşürülür (toplam enerjiyi kodlar).

## Kullan

2026'da:

| Task | Features |
|------|----------|
| ASR (Whisper, Parakeet, SeamlessM4T) | 80 log-mels, 10 ms hop, 25 ms window |
| TTS acoustic model (VITS, F5-TTS, Kokoro) | 80 mels, 5–12 ms hop for fine temporal control |
| Audio classification (AST, PANNs, BEATs) | 128 log-mels, 10 ms hop |
| Speaker embedding (ECAPA-TDNN, WavLM) | 80 log-mels or raw-waveform SSL |
| Music (MusicGen, Stable Audio 2) | EnCodec discrete tokens (not mels) |
| Keyword spotting | 40 MFCCs for tiny devices |

Başparmak kuralı: **if you are not working on music, start with 80 log-mels.**Kanıt yükü herhangi bir sapıklık üzerindedir.

## 2026'da hala yolculuk eden tuzaklar

- **Mel count mismatch.**80 mels ile eğitim, 128 mels ile sonuç, sessiz başarısızlık, her iki ucunda da özellik şeklini kaydet.
- **Sample-rate mismatch upstream.**22.05 kHz'de hesaplanan Mels 16 kHz'den farklı görünüyor.
- **dB vs log.**Whisper, dB-mel değil log-mel bekliyor.
- **Normalization drift.**Eğitim sırasında bir çıkış normallaştırması, sonuçlama sırasında küresel normallaştırma.
- **Leakage from padding.**Bir klifin sonunu sıfırla doldurmak, arka çerçevelerde düz bir spektrum oluşturur.

## Gönder

- Kaydet .`outputs/skill-feature-extractor.md`. Yetenek belirli bir model hedefi için özellik türü, mel sayısı, çerçeve/sıkış ve normallaşımı seçer.

## Egzersizler

1. **Easy.**Çık .`code/main.py`. Bir çırp sentez eder (frekans 200 → 4000 Hz) ve çerçeve başına argmax mel bin yazdırırır.
2. **Medium.**Tekrar çalıştır `n_mels`İçeride`{40, 80, 128}`ve `frame_len`İçeride`{200, 400, 800}`Zaman eksisinde keskin yükseklik bant genişliğini ölçün.
3. **Hard.**Uygulama`power_to_db`ve AudioMNIST'te küçük bir CNN sınıflandırıcısının ASR doğruluğunu (a) çiğ log-mel, (b) dB-mel ile karşılaştırmak`ref=max`, (c) MFCC-13 + delta + delta-delta.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Frame | A slice | 25 ms chunk of waveform fed to one FFT. |
| Hop | Stride | Samples between consecutive frames; 10 ms is ASR default. |
| Window | Hann/Hamming thing | Point-wise multiplier that tapers the frame edges to zero. |
| STFT | Spectrogram generator | Framed + windowed FFT; yields time × frequency matrix. |
| Mel | Warped frequency | Log-perception scale; `m = 2595·log10(1 + f/700)`. |
| Filterbank | The matrix | Triangular filters that project STFT onto mel bins. |
| Log-mel | Whisper's input | `log(mel_spec + eps)`; standardized in 2026. |
| MFCC | Old-school feature | DCT of log-mel; 13 coeffs, decorrelated. |

## Daha Fazla Okumak

- [Davis, Mermelstein (1980). Comparison of parametric representations for monosyllabic word recognition](https://ieeexplore.ieee.org/document/1163420)- MFCC kağıdı.
- [Stevens, Volkmann, Newman (1937). A Scale for the Measurement of the Psychological Magnitude Pitch](https://pubs.aip.org/asa/jasa/article-abstract/8/3/185/735757/) orijinal mel ölçeği.
- [OpenAI — Whisper source, log_mel_spectrogram](https://github.com/openai/whisper/blob/main/whisper/audio.py) referans uygulanmasını okuyun.
- [librosa feature extraction docs](https://librosa.org/doc/latest/api/feature.html) referans için `mfcc`- Evet .`melspectrogram`, ve hop / penceresi.
- [NVIDIA NeMo — audio preprocessing](https://docs.nvidia.com/deeplearning/nemo/user-guide/docs/en/main/asr/asr_all.html#featurizers) Parakeet + Canary modelleri için üretim ölçeği boru hattı.
