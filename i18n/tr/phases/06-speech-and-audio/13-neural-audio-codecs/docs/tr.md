# Nöral Ses Kodekleri  EnCodec, SNAC, Mimi, DAC ve Semantic-Acoustic Split

> 2026 ses jenerasyonu neredeyse tüm jetonlardır. EnCodec, SNAC, Mimi ve DAC, sürekli dalga formlarını bir transformatör tarafından tahmin edilebilen ayrı sıralara dönüştürürler.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 02 (Spectrograms), Phase 10 · 11 (Quantization), Phase 5 · 19 (Subword Tokenization)
**Time:** ~60 minutes

## Sorun

Dil modelleri ayrı belirtiler üzerinde çalışır. Ses süreklidir. Konuşma / müzik için LLM tarzında bir model istiyorsanız  MusicGen, Moshi, Sesame CSM, VibeVoice, Orpheus  önce bir **neural audio codec**: sesleri küçük bir token kelime birikimine ayırt eden öğrenilmiş bir kodlayıcı ve dalga şeklini yeniden oluşturan eşleşen bir dekoder.

İki aile ortaya çıktı:

1. **Reconstruction-first codecs** EnCodec, DAC. Algılama ses kalitesini optimize edin. Tokenler "akustik"  konuşmacı kimliği, timbre, arka plan gürültüsü dahil her şeyi yakalar.
2. **Semantic-first codecs** Mimi (Kyutai), SpeechTokenizer. İlk kod kitabı dil / fonetik içeriği kodlamaya zorlar (sık sık WavLM'den destilleyerek).

2024-2026 yıllarındaki görüşler: **a pure reconstruction codec gives you blurry speech when you try to generate from text.**Kodek simgelerinin üzerine LLM, aynı kod defterinde hem dil yapısını hem de akustik yapısını öğrenmek zorunda.

## Anlaşım

![Four codec landscape: EnCodec, DAC, SNAC (multi-scale), Mimi (semantic+acoustic)](../assets/codec-comparison.svg)

### Temel numara: Geri kalan vektör kvantizasyonu (RVQ)

Bir büyük kod defteri yerine (iyi kalite için milyonlarca kod gerekecek) tüm modern ses kodekleri kullanır **RVQ**: küçük kod defterlerinin bir kaskasası. Birinci kod defterinde kodlayıcı çıkışı, ikincisi kalıntılı kalıntıları kuantleştirir.$1024^8 = 10^{24}$- Evet .

Sonuçlama sırasında, dekodör yeniden yapılandırmak için seçilen tüm kodları çerçeve başına toplamlar.

### 2026'da önemli olan dört kodek

**EnCodec (Meta, 2022).**Baseline. Gelgen şekli üzerinde kodlayıcı-dekoder, RVQ şişe boynuzu. 24 kHz, 32 kod defteri mümkün, varsayılan 4 kod defteri @ 1.5 kbps. Kullanım `1D conv + transformer + 1D conv`MusicGen tarafından kullanılıyor.

**DAC (Descript, 2023).**RVQ, L2 normallaştırılmış kod defterleri, dönemi etkinleştirme fonksiyonları, iyileştirilmiş kayıplar. Herhangi bir açık kodek için en yüksek yeniden yapılandırma sadakati  bazen 12 kod defterle orijinal konuşmadan ayırt edilemez. 44.1 kHz tam bant.

**SNAC (Hubert Siuzdak, 2024).**Çok ölçekli RVQ  kaba kod defterleri ince olanlardan daha düşük bir çerçeve hızında çalışır. Etkili bir şekilde ses hiyerarşik olarak modellendirir: ~ 12 Hz'de kaba bir "sketch" artı 50 Hz'de ayrıntı. Orpheus-3B tarafından kullanılır çünkü hiyerarşik yapısı LM tabanlı jenerasyona iyi haritası yapar.

**Mimi (Kyutai, 2024).**2026 oyun değiştiricisi. 12.5 Hz çerçeve hızı (çok düşük), 8 kod kitabı @ 4.4 kbps.**distilled from WavLM**WavLM'in konuşma içeriği özelliklerini tahmin etmek için eğitilmiştir. 1-7 kod kitabı akustik kalıntılardır. Bu bölünme Moshi (Daabi 15) ve Sesame CSM güçlendiriyor.

### Çerçeve oranları dil modelleme için önemli

Daha düşük çerçeve hızı = daha kısa dizi = daha hızlı LM.

| Codec | Frame rate | 1 s = N frames | Good for |
|-------|-----------|----------------|---------|
| EnCodec-24k | 75 Hz | 75 | music, general audio |
| DAC-44.1k | 86 Hz | 86 | high-fidelity music |
| SNAC-24k (coarse) | ~12 Hz | 12 | AR-LM efficient |
| Mimi | 12.5 Hz | 12.5 | streaming speech |

12.5 Hz'de, 10 saniyelik bir ifadeler sadece 125 kodek çerçevesidir.

### Semantik vs. Akustik Token

```
frame_t → [semantic_token_t, acoustic_token_0_t, acoustic_token_1_t, ..., acoustic_token_6_t]
```

- **Semantic token (codebook 0 in Mimi).**Söylenenleri kodlar  fonemleri, kelimeler, içerik.
- **Acoustic tokens (codebooks 1-7).**Kodlama timbre, hoparlör kimliği, prosody, arka plan gürültüsü, ince detaylar.

Bir AR LM önce semantik simgeyi (metin üzerine koşullanmış) tahmin eder, sonra akustik simgeyi (semantik + hoparlör referansı üzerine koşullanmış) tahmin eder. Bu faktörleşme modern TTS'nin sıfır çekim klon seslerinin nedenini gösterir: semantik model içeriği ele alır; akustik model timbreyi ele alır.

### 2026 yeniden inşaat kalitesi (sekonda bitler, daha düşük bit hızı daha iyidir)

| Codec | Bitrate | PESQ | ViSQOL |
|-------|---------|------|--------|
| Opus-20kbps | 20 kbps | 4.0 | 4.3 |
| EnCodec-6kbps | 6 kbps | 3.2 | 3.8 |
| DAC-6kbps | 6 kbps | 3.5 | 4.0 |
| SNAC-3kbps | 3 kbps | 3.3 | 3.8 |
| Mimi-4.4kbps | 4.4 kbps | 3.1 | 3.7 |

Opus gibi geleneksel kodekler hala algısal kalitede bit başına kazanıyor.**discrete tokens**(Opus üretmediği) ve **generative-model quality**(LM'nin bu tokenlerle ne yapabileceği).

```figure
rvq-codec-cascade
```

## Yapın

### Adım 1: EnCodec ile kodlayın

```python
from encodec import EncodecModel
import torch

model = EncodecModel.encodec_model_24khz()
model.set_target_bandwidth(6.0)  # kbps

wav = torch.randn(1, 1, 24000)
with torch.no_grad():
    encoded = model.encode(wav)
codes, scale = encoded[0]
# codes: (1, n_codebooks, n_frames), dtype=int64
```

`n_codebooks=8`Her kod 0-1023 (10 bit)

### Adım 2: Deşifreleme ve yeniden ölçüm

```python
with torch.no_grad():
    wav_recon = model.decode([(codes, scale)])

from torchaudio.functional import compute_deltas
import torch.nn.functional as F

mse = F.mse_loss(wav_recon[:, :, :wav.shape[-1]], wav).item()
```

### Adım 3: semantik-akustik bölünme (Mimi tarzı)

```python
from moshi.models import loaders
mimi = loaders.get_mimi()

with torch.no_grad():
    codes = mimi.encode(wav)  # shape (1, 8, frames@12.5Hz)

semantic = codes[:, 0]
acoustic = codes[:, 1:]
```

Semantik kod defteri 0 WavLM ile uyumludur. Bir metin-semantik transformatörü  doğrudan seslere gitmekten çok daha küçük bir kelime birikimi eğitmek için.

### Adım 4: neden AR LM kodek simgelerinden çalışıyor

Mimi'nin 12.5 Hz × 8 kod defterinde 10 saniyelik bir konuşma klipi için:

```math
N_{\text{tokens}} = 10 \times 12.5 \times 8 = 1000 \text{ tokens}
```

1000 token, bir transformatör için önemsiz bir bağlamdır. 256M parametre transformatörü modern bir GPU'da milisaniyede 10 saniye konuşma üretebilir.

## Kullan

Harita sorunu → kodek:

| Task | Codec |
|------|-------|
| General music generation | EnCodec-24k |
| Highest-fidelity reconstruction | DAC-44.1k |
| AR LM over speech (TTS) | SNAC or Mimi |
| Streaming full-duplex speech | Mimi (12.5 Hz) |
| Sound-effect library with text | EnCodec + T5 condition |
| Fine-grained audio editing | DAC + inpainting |

Başparmak kuralı: **if you're building a generative model, start with Mimi or SNAC. If you're building a compression pipeline, use Opus.**

## Tuzaklar

- **Too many codebooks.**Kod defterlerini eklemek sadakatini doğrusal olarak arttırır ama LM dizisi uzunluğu da doğrusal olarak.
- **Frame-rate mismatch.**LM'yi 12.5 Hz'de eğitmek Mimi, sonra 50 Hz EnCodec'de ince ayarlama sessizce başarısız olur.
- **Assuming all codebooks equal.**Mimi'de 0 kod kitabı içeriği taşır; kaybetmek anlayışını yok eder.
- **Using reconstruction quality as the only metric.**Bir kodek büyük bir yeniden yapılandırmaya sahip olabilir ama semantik yapısı kötüse LM tabanlı nesil için işe yaramaz.

## Gönder

- Kaydet .`outputs/skill-codec-picker.md`- Verilen bir generatif veya sıkıştırma görevi için bir kodek seçin.

## Egzersizler

1. **Easy.**Çık .`code/main.py`Oyuncak skalar + kalan kuantitörü uyguluyor ve kod defterlerini eklerken yeniden yapılandırma hatasını ölçüyor.
2. **Medium.**Kurulum`encodec`Ve 1, 4, 8, 32 kod defteriyi uzun süreli konuşma klipinde karşılaştırın.
3. **Hard.**Mimi'yi yükle. Bir klip kodla. Kodu 0'yu rastgele tam sayılarla değiştirin; dekode edin. Sonra Kodu 7'yi benzer şekilde değiştirin.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| RVQ | Residual quantization | Cascade of small codebooks; each quantizes the previous residual. |
| Frame rate | Codec speed | How many token-frames per second. Lower = faster LM. |
| Semantic codebook | Codebook 0 (Mimi) | Codebook distilled from SSL features; encodes content. |
| Acoustic codebooks | Everything else | Timbre, prosody, noise, fine detail. |
| PESQ / ViSQOL | Perceptual quality | Objective metrics correlating with MOS. |
| EnCodec | Meta codec | The RVQ baseline; used by MusicGen. |
| Mimi | Kyutai codec | 12.5 Hz frame rate; semantic-acoustic split; powers Moshi. |

## Daha Fazla Okumak

- [Défossez et al. (2023). EnCodec](https://arxiv.org/abs/2210.13438) RVQ başlangıç çizgisi.
- [Kumar et al. (2023). Descript Audio Codec (DAC)](https://arxiv.org/abs/2306.06546)En yüksek sadakatle açık.
- [Siuzdak (2024). SNAC](https://arxiv.org/abs/2410.14411) Çok ölçekli RVQ.
- [Kyutai (2024). Mimi codec](https://kyutai.org/codec-explainer) semantik-akistik bölünme, WavLM destillasyonu.
- [Borsos et al. (2023). AudioLM](https://arxiv.org/abs/2209.03143) iki aşamalı semantik/akustik paradigma.
- [Zeghidour et al. (2021). SoundStream](https://arxiv.org/abs/2107.03312) orijinal akışlanabilir RVQ kodek.
