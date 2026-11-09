# Ses Anti-Spoofing & Audio Watermarking  ASVspoof 5, AudioSeal, WaveVerify

> Ses klonlaması savunmadan daha hızlı gönderildi. 2026 üretim ses sistemlerinin iki şeye ihtiyacı var: gerçek ve sahte konuşmayı sınıflandıran bir detektör (AASIST, RawNet2) ve sıkıştırmayı ve düzenlemeyi sağlayan bir su işaretisi (AudioSeal).

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 06 (Speaker Recognition), Phase 6 · 08 (Voice Cloning)
**Time:** ~75 minutes

## Sorun

Üç ilgili savunma:

1. **Anti-spoofing / deepfake detection.**Bir ses klipi verildiğinde, sentetik mi gerçek mi? ASVspoof referansları (ASVspoof 2019 → 2021 → 5) altın standarttır.
2. **Audio watermarking.**Sonradan bir detektörün çıkarması için üretilen seslere algılanabilir bir sinyal yerleştirin.
3. **Authenticated provenance.**Ses dosyalarının + metadataların şifreleme imzası. C2PA / İçerik Doğruluk Girişimi.

Ardından, bu sistemin kullanımı ile ilgili olarak, bir diğer sistemin de bu sistemin kullanımı ile ilgili olarak, bir diğer sistemin de bu sistemin kullanımı ile ilgili olarak, bir diğer sistemin de bu sistemin kullanımı ile ilgili olarak, bir diğer sistemin de bu sistemin kullanımı ile ilgili olarak, bir diğer sistemin de bu sistemin kullanımı ile ilgili olarak, bir diğer sistemin de bu sistemin kullanımı ile ilgili olarak, bir diğer sistemin de bu sistemin kullanımı ile ilgili olarak, bir diğer sistemin de bu sistemin kullanımı ile ilgili olarak, bir diğer sistemin de bu sistemin kullanımı ile ilgili olarak, bir diğer sistemin de bu sistemin kullanımı ile ilgili olarak, bir diğer sistemin de bu sistemin kullanımı ile ilgili olarak, bir diğer sistemin de bu sistemin kullanımı ile ilgili olarak, bir diğer sistemin de bu sistemin de kullanımı ile ilgili olarak, bir diğer sistemin de diğer sistemin de kullanımı ile ilgili olarak, bir diğer sistemin de bu sistemin de kullanımı ile ilgili olarak, bir diğer sistemin de diğer sistemin de diğer sistemin de kullanımı ile, bir diğer diğer sistemin de diğer sistemin de de diğer sistemin de de de diğer sistemlerin de kullanımı ile, diğer sistemlerin de dahil olmak üzere, bir diğer diğer diğerleri de diğerleri de, diğerleri de, diğerleri de de de diğerleri de dahil olmak üzere, diğer diğer diğerleri de diğerleri de, diğerleri de dahil olmak üzere, sistemlerin de, diğerleri de dahil olmak üzere, diğer diğer diğer diğer diğer diğer diğerleri de diğerleri de, diğerleri de dahil olmak üzere,

## Anlaşım

![Anti-spoofing vs watermarking vs provenance — three defense layers](../assets/spoofing-watermark.svg)

### ASVspoof 5  2024-2025 referans değerleri

Önceki baskılardaki en büyük değişiklik:

- **Crowdsourced data**(stüdyodan temiz değil)  gerçekçi koşullar.
- **~2000 speakers**(Bundan önce 100'e karşı).
- **32 attack algorithms.**TTS + ses dönüşümü + karşıtlık rahatsızlığı.
- **Two tracks.**Karşı önlem (CM) bağımsız tespit; biyometrik sistemler için sahte-güçlü ASV (SASV).

ABD'de 5'de en son teknoloji: ~ 7.23% EER. Eski ABD'de 2019 LA: 0.42% EER. Gerçek dünyadaki dağıtım: vahşi kliplerde 5-10% EER bekleyin.

### AASIST ve RawNet2  tespit model aileleri

**AASIST**(Yüzde 2021'de, 2026'a kadar güncelleştirilmiştir). Spektral özelliklere grafik-aramak.

**RawNet2.**Çürüklü ön uç, çiğ dalga şekli + TDNN omurgası. Baseline daha basit; ince ayarlama ile rekabetçi.

**NeXt-TDNN + SSL features.**2025 varianti: ECAPA tarzı + WavLM özellikleri + odak kaybı. ASVspoof 2019 LA'da % 0.42% EER'e ulaşır.

### AudioSeal  2024 su işaretinin varsayılan

Meta'lar **AudioSeal**(Ocak 2024, v0.2 Aralık 2024) Ana tasarım:

- **Localized.**Su işaretini 16 kHz (1/16000 s) örnek çözünürlüğünde bir çerçeve başına algılar.
- **Generator + detector jointly trained.**Generatör işitilmeyen sinyal eklemeyi öğrenir. Detektor da onu artırmalar yoluyla bulmayı öğrenir.
- **Robust.**MP3 / AAC sıkıştırması, EQ, hız değişimi ± 10%, gürültü karışımı + 10 dB SNR hayatta.
- **Fast.**Detektor gerçek zamanlı 485x hızla çalışır. WavMark'tan 1000x daha hızlı.
- **Capacity.**16 bitlik payload (model ID'yi kodlayabilir, jenerasyon zaman damgası, kullanıcı ID) her ifadede yerleştirilebilir.

### WavMark

AudioSeal'den önceki açık tabanlı, tersine çevirilebilir sinir ağı, 32 bit/sek.

- Sinkronizeci güç yavaş.
- Gaussian gürültüsü veya MP3 sıkıştırması ile çıkarılabilir.
- Gerçek zamanlı dostluk değil.

### WaveVerify ( Temmuz 2025)

AudioSeal'in zayıflıklarını giderir  Özellikle zamansal manipülasyonlar (dönüştürme, hız). FiLM tabanlı jeneratör + Uzmanların Karıştırması detektörü kullanır. Standart saldırılar için AudioSeal ile rekabetçi; zamansal düzenlemeleri işliyor.

### Düşmanlar açığı kullanıyor

AudioMarkBench'ten: "Pitch shift altında, tüm su işaretleri Bit Recovery Düzgünlüğünü 0.6'dan aşağı gösterir. Bu neredeyse tamamlanmış kaldırımı gösterir". **Pitch-shift is the universal attack.**No 2026 su işaretleri agresif bir yükseklik değiştirmesine tamamen dayanıklıdır. Bu nedenle su işaretleri ile birlikte algılama (AASIST) gereklidir.

### C2PA / İçerik Doğruluk Girişimi

Bu, bir yazılımcı tarafından oluşturulan metadataların bir parçasıdır. Bu metadataların bir kısmı, bir yazılımcı tarafından oluşturulan metadataların bir kısmıdır.

```figure
v4-audio-watermark
```

## Yapın

### Adım 1: basit bir spektral özellik detektörü (oyun)

```python
def spectral_rolloff(spec, percentile=0.85):
    cum = 0
    total = sum(spec)
    if total == 0:
        return 0
    threshold = total * percentile
    for k, v in enumerate(spec):
        cum += v
        if cum >= threshold:
            return k
    return len(spec) - 1

def is_suspicious(audio):
    spec = magnitude_spectrum(audio)
    rolloff = spectral_rolloff(spec)
    return rolloff / len(spec) > 0.92
```

Sintez konuşma genellikle olağanüstü derecede düz yüksek frekanslı enerjiye sahiptir.

### Adım 2: AudioSeal gömül + tespit

```python
from audioseal import AudioSeal
import torch

generator = AudioSeal.load_generator("audioseal_wm_16bits")
detector = AudioSeal.load_detector("audioseal_detector_16bits")

audio = load_wav("generated.wav", sr=16000)[None, None, :]
payload = torch.tensor([[1, 0, 1, 1, 0, 1, 0, 0, 1, 1, 0, 1, 0, 1, 1, 0]])
watermark = generator.get_watermark(audio, sample_rate=16000, message=payload)
watermarked = audio + watermark

result, decoded_payload = detector.detect_watermark(watermarked, sample_rate=16000)
# result: float in [0, 1] — probability of watermark presence
# decoded_payload: 16 bits; match against embedded payload
```

### Adım 3: değerlendirme  EER

```python
def eer(real_scores, fake_scores):
    thresholds = sorted(set(real_scores + fake_scores))
    best = (1.0, 0.0)
    for t in thresholds:
        far = sum(1 for s in fake_scores if s >= t) / len(fake_scores)
        frr = sum(1 for s in real_scores if s < t) / len(real_scores)
        if abs(far - frr) < best[0]:
            best = (abs(far - frr), (far + frr) / 2)
    return best[1]
```

### Dördüncü adım: Üretim entegrasyonu

```python
def safe_tts(text, voice, clone_reference=None):
    if clone_reference is not None:
        verify_consent(user_id, clone_reference)
    audio = tts_model.synthesize(text, voice)
    audio_with_wm = audioseal_embed(audio, payload=build_payload(user_id, model_id))
    manifest = c2pa_sign(audio_with_wm, user_id, timestamp=now())
    return audio_with_wm, manifest
```

Her nesil gemi: (1) su işaretleri, (2) imzalanan manifesto, (3) tutma politikasına uygun denetim kayıtları.

## Kullan

| Use case | Defense |
|----------|---------|
| Shipping TTS / voice cloning | AudioSeal embed on every output (non-negotiable) |
| Biometric voice unlock | AASIST + ECAPA ensemble; liveness challenge |
| Call-center fraud detection | AASIST on 20% sample of incoming calls |
| Podcast authenticity | C2PA signing on upload, AudioSeal if AI-generated |
| Research / training detectors | ASVspoof 5 train/dev/eval sets |

## Tuzaklar

- **Watermark without detector ever running.**İletişim cihazını gönder.
- **Detection without calibration.**AASIST, ABD'de gerçek dünya doğruluk oranında eksikliği yapan bir ekip.
- **Pitch-shift gap.**Agresif bir atış noktası çoğu su işaretini ortadan kaldırır.
- **Metadata strip-and-rehost.**C2PA, yeniden kodlama yoluyla önemsiz olarak atlanabilir. Her zaman kriptografik + algılama (su işaretleri) savunmasını bir araya getirin.
- **Liveness as detection.**Kullanıcıya rastgele bir cümle söylemesini söyle. Tekrarlama saldırılarını önler ama gerçek zamanlı klonlama değil.

## Gönder

- Kaydet .`outputs/skill-spoof-defender.md`Ses geninin dağıtımında tespit modeli, su işaretleri, kaynak manifesti ve operasyonel oyun kitabı seçin.

## Egzersizler

1. **Easy.**Çık .`code/main.py`. Oyuncak detektörü + oyuncak su işaretleri sentetik ses üzerinde yerleştirilmiş/ tespit edilmiş.
2. **Medium.**Kurulum`audioseal`TTS çıkışına 16 bitlik bir payload yerleştirir, yeniden kodlar.
3. **Hard.**ASVspoof 2019 LA'da RawNet2 veya AASIST'i ince ayarlayın. EER ölçün. F5-TTS üretilen kliplerin uzun süren bir setinde test yapın  OOD algılama nasıl bozulduğunu görün.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| ASVspoof | The benchmark | Biennial challenge; 2024 = ASVspoof 5. |
| CM (countermeasure) | Detector | Classifier: real speech vs synthetic / converted. |
| SASV | Speaker verif + CM | Integrated biometric + spoof detection. |
| AudioSeal | Meta watermark | Localized, 16-bit payload, 485× faster than WavMark. |
| Bit Recovery Accuracy | Watermark survival | Fraction of payload bits recovered after attack. |
| C2PA | Provenance manifest | Cryptographic metadata about creation / authorship. |
| AASIST | Detector family | Graph-attention-based anti-spoofing SOTA. |

## Daha Fazla Okumak

- [Todisco et al. (2024). ASVspoof 5](https://dl.acm.org/doi/10.1016/j.csl.2025.101825) mevcut referans değer.
- [Defossez et al. (2024). AudioSeal](https://arxiv.org/abs/2401.17264) Varsayılan su işaretleri.
- [Chen et al. (2025). WaveVerify](https://arxiv.org/abs/2507.21150) Zamanlı saldırılar için MoE dedektörü.
- [Jung et al. (2022). AASIST](https://arxiv.org/abs/2110.01200) SOTA algılama omurgası.
- [AudioMarkBench (2024)](https://proceedings.neurips.cc/paper_files/paper/2024/file/5d9b7775296a641a1913ab6b4425d5e8-Paper-Datasets_and_Benchmarks_Track.pdf) Güçlülik değerlendirme.
- [C2PA specification](https://spec.c2pa.org/specifications/specifications/2.4/index.html) Kaynak açıklaması biçimi.
