# Ses Temellikleri  Dalga şekilleri, örnekleme, Fourier dönüşümü

> Dalga şekilleri çiğ sinyalidır. Spektrogramlar temsilidir. Mel özellikleri ML dostu formudur. Her modern ASR ve TTS boru hattı bu merdivenin üzerinde yürür ve ilk adım örnekleme ve Fourier'i anlamak.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 1 · 06 (Vectors & Matrices), Phase 1 · 14 (Probability Distributions)
**Time:** ~45 minutes

## Sorun

Bir mikrofon bir basınç ve zaman sinyali üretir. sinir ağınız tenzorlar tüketir. Onların arasında bir dizi konvansiyon bulunur ve bu konvansiyonlar ihlal edildiğinde sessiz böcekler üretir: model iyi çalışır ama WER iki katlanır, ya da TTS bir hisseder veya ses klonlama sistemi hoparlör yerine mikrofonı ezberler.

Konuşma sistemlerinde her hata üç sorudan birine döner:

1. Veriler hangi örnek oranında kaydedildi ve model ne bekliyor?
2. Sinyal adı gizli mi?
3. Çiğ örnekler üzerinde mi çalışıyorsunuz yoksa frekans temsilleri üzerinde mi?

Bunları doğru yaparsanız, 6. aşamada kalanlar kontrol edilebilir.

## Anlaşım

![Waveform, sampling, DFT, and frequency bins visualized](../assets/audio-fundamentals.svg)

**Waveform.**Bir boyutlu bir sünger arşivinde `[-1.0, 1.0]`. Örnek numarasına göre indeksi. Sekünteler için örneğin oranına bölün: `t = n / sr`16 kHz'de 10 saniyelik bir klip 160.000 dalga ile bir dizi.

**Sampling rate (sr).**2026'da ortak oranlar:

| Rate | Use |
|------|-----|
| 8 kHz | Telephony, legacy VOIP. Nyquist at 4 kHz kills consonants. Avoid for ASR. |
| 16 kHz | ASR standard. Whisper, Parakeet, SeamlessM4T v2 all consume 16 kHz. |
| 22.05 kHz | TTS vocoder training for older models. |
| 24 kHz | Modern TTS (Kokoro, F5-TTS, xTTS v2). |
| 44.1 kHz | CD audio, music. |
| 48 kHz | Film, pro audio, high-fidelity TTS (VALL-E 2, NaturalSpeech 3). |

**Nyquist-Shannon.**`sr`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             `sr/2`- Ne ?`sr/2`Sınır * Nyquist frekansıdır. Nyquist'in üzerindeki enerji * aliased *  aşağı frekanslara katlanır  ve sinyali bozar.

**Bit depth.**16 bit PCM (salıkonulan int16, aralığı ±32.767) evrensel değişim biçimidir.`soundfile`int16 okuyun ama float32 dizilerini açığa çıkarın `[-1, 1]`- Evet .

**Fourier Transform.**Herhangi bir sınırlı sinyal, farklı frekanslarda sinusoidlerin toplamıdır.`N`örnekler, `N`karmaşık katı  bir frekans bin başına. `bin k`frekans haritaları `k · sr / N`Hz. Büyüklük bu frekansta genişliktir, açı faz.

**FFT.**Hızlı Fourier Değişimi: bir `O(N log N)`DFT algoritması, `N`Her ses kütüphanesi kapının altında FFT kullanır. 16 kHz'de 1024 örnek FFT, 15.6 Hz çözünürlükte 08 kHz'den oluşan 512 kullanılabilir frekans kutuları verir.

**Framing + window.**Bir klipi FFT yapmıyoruz. Tekrar üst üste *frames* (genellikle 25 ms 10 ms hop) olarak keseriz, kenar kesintisizlikleri ortadan kaldırmak için her çerçeveyi bir pencere işlevi (Hann, Hamming) ile çarpırız, sonra her çerçeveyi FFT yapıyoruz. Bu kısa süreli Fourier dönüşümü (STFT).

```figure
mel-scale
```

## Yapın

### Adım 1: bir klip oku ve dalga şeklini çiz

`code/main.py`Sadece stdlib kullanıyor `wave`Bu modül, demo bağımlılığından kurtulmak için kullanılacak.`soundfile`veya `torchaudio.load`(İkisi de geri dönüyor `(waveform, sr)`Tüpler:

```python
import soundfile as sf
waveform, sr = sf.read("clip.wav", dtype="float32")  # shape (T,), sr=int
```

### Adım 2: Birinci ilkelerden sinüs dalgasını sentez edin

```python
import math

def sine(freq_hz, sr, seconds, amp=0.5):
    n = int(sr * seconds)
    return [amp * math.sin(2 * math.pi * freq_hz * i / sr) for i in range(n)]
```

440 Hz sinüs (koncert A) 16 kHz'de 1 saniye için 16,000 float.`wave.open(..., "wb")`16 bit PCM kodlamasını kullanıyor.

### Adım 3: DFT'yi el ile hesaplayın

```python
def dft(x):
    N = len(x)
    out = []
    for k in range(N):
        re = sum(x[n] * math.cos(-2 * math.pi * k * n / N) for n in range(N))
        im = sum(x[n] * math.sin(-2 * math.pi * k * n / N) for n in range(N))
        out.append((re, im))
    return out
```

`O(N²)` için cezalandırılır `N=256`Doğruyu doğrulayan gerçek ses için işe yaramaz.`numpy.fft.rfft`veya `torch.fft.rfft`- Evet .

### Dördüncü adım: baskın frekansı bulun

Büyüklük zirvesi endeksi `k_star`frekans haritaları `k_star * sr / N`440 Hz sinüsünde çalıştırmak bin ' de bir zirve gönderir .`440 * N / sr`- Evet .

### Adım 5: isim değiştirmeyi göster

7 kHz sinüsünün 10 kHz'de (Nyquist = 5 kHz) örneklenmesi. 7 kHz ton Nyquist'in üzerinde ve `10 − 7 = 3 kHz`FFT zirvesi 3 kHz'de görünür. Bu klasik isim göstergesidir ve bu nedenle her DAC/ADC gemisi tuğla duvarı düşük geçiş filtre ile gönderir.

## Kullan

2026'da gerçekten göndereceğiniz yığın:

| Task | Library | Why |
|------|---------|-----|
| Read/write WAV/FLAC/OGG | `soundfile` (libsndfile wrapper) | Fastest, stable, returns float32. |
| Resample | `torchaudio.transforms.Resample` or `librosa.resample` | Correct anti-aliasing built in. |
| STFT / Mel | `torchaudio` or `librosa` | GPU-friendly; PyTorch ecosystem. |
| Real-time streaming | `sounddevice` or `pyaudio` | Cross-platform PortAudio bindings. |
| Inspect a file | `ffprobe` or `soxi` | CLI, fast, reports sr/channels/codec. |

Karar kuralları: **match sample rate before you match anything else**Whisper 16 kHz mono float32'yi bekliyor. 44.1 kHz stereoyu geçirin ve model bir böcek gibi görünen bir çöp alacaksınız.

## Gönder

- Kaydet .`outputs/skill-audio-loader.md`Bu yetenek, ses girişinin aşağıdaki modelin beklentilerine uygun olup olmadığını ve doğru olmayan zamanlarda doğru şekilde örneklemenize yardımcı olur.

## Egzersizler

1. **Easy.**16 kHz'de 220 Hz + 440 Hz + 880 Hz'in 1 saniyelik bir karışımı sentezleyin. DFT çalıştırın. Beklenen kutularda üç zirveyi onaylayın.
2. **Medium.**Sesini 3 saniyelik WAV'da 48 kHz'de kaydet.`torchaudio.transforms.Resample`(anti-aliasing ile), sonra 16 kHz'e naif onarımı kullanarak (her üçüncü örnek).
3. **Hard.**STFT ' i sadece  kullanarak sıfırdan oluşturun`math`Ve DFT'den 3. Adımdan. Çerçeve boyutu 400, hop 160, Hann penceresi.`matplotlib.pyplot.imshow`Bu 2. Dersin spektrogramı.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Sample rate | How many samples per second | Frequency in Hz at which the ADC measures the signal. |
| Nyquist | The max frequency you can represent | `sr/2`; energy above it aliases back down. |
| Bit depth | Resolution of each sample | `int16` = 65,536 levels; `float32` = 24-bit precision in `[-1, 1]`. |
| DFT | The Fourier transform for sequences | `N` samples → `N` complex frequency coefficients. |
| FFT | The fast DFT | `O(N log N)` algorithm requiring `N` = power of 2. |
| Bin | Frequency column | `k · sr / N` Hz; resolution = `sr / N`. |
| STFT | Spectrogram under the hood | Framed + windowed FFT over time. |
| Aliasing | Weird frequency ghosts | Energy above Nyquist mirroring down to lower bins. |

## Daha Fazla Okumak

- [Shannon (1949). Communication in the Presence of Noise](https://people.math.harvard.edu/~ctm/home/text/others/shannon/entropy/entropy.pdf) örnekleme teoreminin arkasındaki kağıt.
- [Smith — The Scientist and Engineer's Guide to Digital Signal Processing](https://www.dspguide.com/ch8.htm) ücretsiz, kanonik DSP ders kitabı.
- [librosa docs — audio primer](https://librosa.org/doc/latest/auto_tutorials/index.html) Kodla pratik bir yürüyüş.
- [Heinrich Kuttruff — Room Acoustics (6th ed.)](https://www.taylorfrancis.com/books/mono/10.1201/9781315372150/room-acoustics-heinrich-kuttruff) Gerçek dünya sesinin neden temiz bir sinusoid olmadığını göstermek için bir referans.
- [Steve Eddins — FFT Interpretation notebook](https://blogs.mathworks.com/steve/2020/03/30/fft-spectrum-and-spectral-densities/) frekans çubuğu algısı 10 dakika içinde temizlendi.
