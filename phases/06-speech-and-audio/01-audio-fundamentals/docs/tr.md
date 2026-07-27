# Sesin Temelleri — Dalga Formları, Örnekleme, Fourier Dönüşümü

> Dalga formları ham sinyaldir. Spektrogramlar temsilidir. Mel özellikleri ML dostu formdur. Her modern ASR ve TTS boru hattı bu merdivende yürür ve ilk basamak örneklemeyi ve Fourier'i anlamaktır.

**Tür:** Öğren
**Diller:** Python
**Önkoşullar:** Aşama 1 · 06 (Vektörler ve Matrisler), Aşama 1 · 14 (Olasılık Dağılımları)
**Süre:** ~45 dakika

## Sorun

Bir mikrofon basınç-zaman sinyali üretir. Sinir ağınız tensörleri tüketiyor. Bunların arasında, ihlal edildiğinde sessiz hatalara neden olan bir dizi kural bulunur: Model iyi eğitilir ancak WER iki katına çıkar veya TTS bir tıslama sesi çıkarır veya bir ses klonlama sistemi hoparlör yerine mikrofonu ezberler.

Konuşma sistemlerindeki her hatanın kökeni şu üç sorudan birine dayanmaktadır:

1. Veriler hangi örnekleme hızında kaydedildi ve model ne bekliyor?
2. Sinyal takma adlı mı?
3. Ham örnekler üzerinde mi yoksa frekans gösterimi üzerinde mi çalışıyorsunuz?

Bunları doğru yapın ve Aşama 6'nın geri kalanı izlenebilir hale gelir. Onları yanlış anlayın ve Whisper-Large-v4 bile çöp üretir.

## Konsept

![Dalga biçimi, örnekleme, DFT ve frekans bölmeleri görselleştirildi](../assets/audio-fundamentals.svg)

**Dalga formu.** `[-1.0, 1.0]`'deki tek boyutlu kayan nokta dizisi. Örnek numarasına göre indekslenmiştir. Saniyeye dönüştürmek için örnekleme hızına bölün: `t = n / sr`. 16 kHz'de 10 saniyelik bir klip, 160.000 kayan nokta dizisidir.

**Örnekleme hızı (sr).** Saniyede kaç örnek. 2026'daki ortak oranlar:

| Oranı | Kullan |
|------|-----|
| 8 kHz | Telefon, eski VOIP. 4 kHz'deki Nyquist ünsüz harfleri öldürür. ASR'den kaçının. |
| 16 kHz | ASR standardı. Whisper, Parakeet, SeamlessM4T v2'nin tümü 16 kHz tüketir. |
| 22,05 kHz | Eski modeller için TTS ses kodlayıcı eğitimi. |
| 24 kHz | Modern TTS (Kokoro, F5-TTS, xTTS v2). |
| 44,1 kHz | CD sesi, müzik. |
| 48 kHz | Film, profesyonel ses, yüksek kaliteli TTS (VALL-E 2, NaturalSpeech 3). |

**Nyquist-Shannon.** `sr` örnekleme hızı, `sr/2`'ye kadar olan frekansları açıkça temsil edebilir. `sr/2` sınırı *Nyquist frekansıdır*. Nyquist'in üzerindeki enerji *takma ad alır* (daha düşük frekanslara katlanır) ve sinyali bozar. Altörneklemeden önce daima alçak geçiren filtre.

**Bit derinliği.** 16 bit PCM (int16 işaretli, aralık ±32.767) evrensel değişim formatıdır. Müzik için 24 bit, dahili DSP için 32 bit kayan nokta. `soundfile` gibi kütüphaneler int16'yı okur ancak `[-1, 1]`'deki float32 dizilerini açığa çıkarır.

**Fourier Dönüşümü.** Herhangi bir sonlu sinyal, farklı frekanslardaki sinüzoidlerin toplamıdır. Ayrık Fourier Dönüşümü (DFT), `N` örnekleri için `N` karmaşık katsayılarını (frekans kutusu başına bir tane) hesaplar. `bin k`, `k · sr / N` Hz frekansıyla eşleşir. Büyüklük o frekanstaki genliktir, açı ise fazdır.

**FFT.** Hızlı Fourier Dönüşümü: `N` 2'nin katı olduğunda DFT için bir `O(N log N)` algoritması. Her ses kitaplığı, temel olarak FFT'yi kullanır. 16 kHz'de 1024 örnekli bir FFT, 15,6 Hz çözünürlükte 0-8 kHz'i kapsayan 512 kullanılabilir frekans bölmesi sağlar.

**Çerçeve + pencere.** Klibin tamamını FFT yapmıyoruz. Bunu örtüşen *karelere* (tipik olarak 10 ms atlamalı 25 ms) bölüyoruz, kenar süreksizliklerini ortadan kaldırmak için her kareyi bir pencere fonksiyonuyla (Hann, Hamming) çarpıyoruz, ardından her kareyi FFT yapıyoruz. Bu Kısa Zamanlı Fourier Dönüşümüdür (STFT). Ders 02 buradan başlıyor.

```figure
mel-scale
```

## İnşa Et

### Adım 1: bir klibi okuyun ve dalga formunu çizin

`code/main.py`, demo bağımlılığını ortadan kaldırmak için yalnızca stdlib `wave` modülünü kullanır. Üretim için `soundfile` veya `torchaudio.load` kullanacaksınız (her ikisi de `(waveform, sr)` tanımlama gruplarını döndürür):

```python
import soundfile as sf
waveform, sr = sf.read("clip.wav", dtype="float32")  # shape (T,), sr=int
```

### Adım 2: İlk prensiplerden sinüs dalgasını sentezleyin

```python
import math

def sine(freq_hz, sr, seconds, amp=0.5):
    n = int(sr * seconds)
    return [amp * math.sin(2 * math.pi * freq_hz * i / sr) for i in range(n)]
```

1 saniye boyunca 16 kHz'de 440 Hz'lik bir sinüs (konser A) 16.000 geçiştir. 16 bit PCM kodlamasını kullanarak `wave.open(..., "wb")` ile yazın.

### Adım 3: DFT'yi elle hesaplayın

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

`O(N²)` — `N=256`'nin doğruluğu onaylaması için iyi, gerçek ses için işe yaramaz. Gerçek kod, `numpy.fft.rfft` veya `torch.fft.rfft`'yi çağırır.

### Adım 4: Baskın frekansı bulun

Büyüklük tepe indeksi `k_star`, `k_star * sr / N` frekansıyla eşleşir. Bunu 440 Hz sinüste çalıştırmak `440 * N / sr` binde bir tepe noktası döndürmelidir.

### Adım 5: takma adı gösterin

10 kHz'de (Nyquist = 5 kHz) 7 kHz sinüsü örnekleyin. 7 kHz tonu Nyquist'in üzerindedir ve `10 − 7 = 3 kHz`'ye katlanır. FFT zirvesi 3 kHz'de görünür. Bu, klasik örtüşme demosudur ve her DAC/ADC'nin tuğla duvarlı alçak geçiş filtresiyle birlikte gönderilmesinin nedenidir.

## Kullan onu

Aslında 2026'da göndereceğiniz yığın:

| Görev | Kütüphane | Neden |
|------|---------|-----|
| WAV/FLAC/OGG okuma/yazma | `soundfile` (libsnddosyası sarmalayıcı) | En hızlı, kararlı, float32'yi döndürür. |
| Yeniden Örnekleme | `torchaudio.transforms.Resample` veya `librosa.resample` | Doğru kenar yumuşatma yerleşiktir. |
| STFT / Mel | `torchaudio` veya `librosa` | GPU dostu; PyTorch ekosistemi. |
| Gerçek zamanlı akış | `sounddevice` veya `pyaudio` | Platformlar arası PortAudio bağlamaları. |
| Bir dosyayı inceleyin | `ffprobe` veya `soxi` | CLI, hızlı, sr/kanalları/codec'i raporlar. |

Karar kuralı: **başka bir şeyle eşleşmeden önce örnek oranı eşleştirin**. Whisper, 16 kHz mono float32 bekliyor. 44,1 kHz stereoyu iletirseniz model hatasına benzeyen çöp elde edersiniz.

## Gönderin

`outputs/skill-audio-loader.md` olarak kaydedin. Bu beceri, ses girişinin alt modelin beklentileriyle eşleşip eşleşmediğini kontrol etmenize ve eşleşmediğinde doğru şekilde yeniden örneklemenize yardımcı olur.

## Egzersizler

1. **Kolay.** 16 kHz'de 220 Hz + 440 Hz + 880 Hz'nin 1 saniyelik karışımını sentezleyin. DFT'yi çalıştırın. Beklenen kutularda üç zirveyi onaylayın.
2. **Orta.** Sesinizin 3 saniyelik WAV'ını 48 kHz'de kaydedin. `torchaudio.transforms.Resample` (kenar yumuşatma ile) kullanarak 16 kHz'e, ardından saf desimasyon (her üç örnekte bir) kullanarak 16 kHz'e alt örnekleme yapın. Her ikisi de FFT'dir. Takma ad nerede görünüyor?
3. **Zor.** Yalnızca `math` ve 3. Adımdaki DFT'yi kullanarak STFT'yi sıfırdan oluşturun. Çerçeve boyutu 400, atlama 160, Hann penceresi. Büyüklükleri `matplotlib.pyplot.imshow` ile çizin. Bu Ders 02'nin spektrogramıdır.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|-----------------|-----------------------|
| Örnek oranı | Saniyede kaç örnek | ADC'nin sinyali ölçtüğü Hz cinsinden frekans. |
| Nyquist | Temsil edebileceğiniz maksimum frekans | `sr/2`; üstündeki enerji geri aşağı doğru takma adlar verir. |
| Bit derinliği | Her numunenin çözünürlüğü | `int16` = 65.536 seviye; `float32` = `[-1, 1]`'de 24 bit hassasiyet. |
| DFT | Diziler için Fourier dönüşümü | `N` örnekleri → `N` karmaşık frekans katsayıları. |
| FFT | Hızlı DFT | `N` gerektiren `O(N log N)` algoritması = 2'nin kuvveti. |
| Kutu | Frekans sütunu | `k · sr / N`Hz; çözünürlük = `sr / N`. |
| STFT | Spektrogram başlığı altında | Zaman içinde çerçeveli + pencereli FFT. |
| Takma Adlandırma | Garip frekans hayaletleri | Nyquist'in üzerindeki enerji alt kutulara yansıyor. |

## Daha Fazla Okuma

-[Shannon (1949). Gürültü Varlığında İletişim](https://people.math.harvard.edu/~ctm/home/text/others/shannon/entropy/entropy.pdf) — örnekleme teoreminin arkasındaki makale.
- [Smith — Dijital Sinyal İşleme Bilim Adamı ve Mühendis Kılavuzu](https://www.dspguide.com/ch8.htm) — ücretsiz, standart DSP ders kitabı.
- [librosa docs — ses kılavuzu](https://librosa.org/doc/latest/tutorial.html) — kodla pratik izlenecek yol.
- [Heinrich Kuttruff — Room Acoustics (6. baskı)](https://www.routledge.com/Room-Acoustics/Kuttruff/p/book/9781482260434) — gerçek dünyadaki sesin neden temiz bir sinüzoid olmadığına dair referans.
- [Steve Eddins — FFT Yorumlama defteri](https://blogs.mathworks.com/steve/2020/03/30/fft-spectrum-and-spectral-densities/) — frekans kutusu sezgisi 10 dakika içinde temizlendi.
