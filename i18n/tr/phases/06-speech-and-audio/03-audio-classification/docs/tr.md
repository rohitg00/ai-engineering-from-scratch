# Ses sınıflandırması  MFCC'ler üzerindeki k-NN'den AST ve BEAT'lere

> "Köpek kışkırtması vs siren"den "bu hangi dil"e kadar her şey ses sınıflandırmasıdır. Özellikleri erimiş. Arsitektir her on yılda hareket eder. Değerlendirme AUC, F1 ve sınıf başına hatırlanmaya kalır.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 02 (Spectrograms & Mel), Phase 3 · 06 (CNNs), Phase 5 · 08 (CNNs & RNNs for Text)
**Time:** ~75 minutes

## Sorun

10 saniyelik bir klip alırsınız. Bilmek istiyorsunuz: "Ne?" Şehir ses (siren, egzersiz, köpek), konuşma komutu (evet/hayır/durma), dil kimliği (en/es/ar), konuşmacı duygu (gürültülü/ayrı taraflı), veya çevresel ses (özel) Bunlar * ses sınıflandırması* ve 2026 yılında temel mimarlık olgunlaşmıştır: log-mel → CNN veya Transformer → softmax.

Ana zorluk ağ değil. Veriler. Ses verilerinin vahşi sınıf dengesizliği, güçlü etki alanı değişimi (temiz vs gürültülü) ve etiket gürültüsü vardır (kim "şehirli gürültü" vs. "restaurant gürültüsü" karar verdi). Sorunun %80'i CNN'i Transformer ile değiştirmek değil, kurasyon, büyütme ve değerlendirme.

## Anlaşım

![Audio classification ladder: k-NN on MFCCs to AST to BEATs](../assets/audio-classification.svg)

**k-NN on MFCCs (the 1990s baseline).**Her klip için düz MFCC'ler, etiketlenmiş bir banka ile cosine benzerliği hesaplamak, üst K'nin çoğunluk oyunu geri vermek. Temiz, küçük veri kümeleri (Speech Commands, ESC-50) üzerinde şaşırtıcı derecede güçlü.

**2D CNN on log-mels (2015-2019).**- Yapabilirsin .`(T, n_mels)`ResNet-18 veya VGG tarzı uygulayın. Küresel ortalama zaman ekseni birleştirir. Sınıflar üzerinde yumuşaklık. 2026 kaggle yarışlarının çoğu için hâlâ temel çizgi.

**Audio Spectrogram Transformer, AST (2021-2024).**Log-mel'i (örneğin 16×16 patch) yapıştırın, pozisyon yerleştirmelerini ekleyin, bir ViT'ye girin.

**BEATs and WavLM-base (2024-2026).**Kendi kendine denetimli ön eğitim milyonlarca saat. İhtiyacınız olan denetimli verilerin %1-10'u ile görevinizi inceleme. 2026 yılında bu konuşma dışı ses için varsayılan başlangıç noktasıdır. BEATs-iter3 hesaplama kullanırken AudioSet'te AST'yi 1-2 mAP'ye yener.

**Whisper-encoder as a frozen backbone (2024).**Whisper'in kodlayıcısını alın, dekodörü bırakın, bir çizgi sınıflandırıcı ekleyin.

### Sınıf dengesizliği gerçek bir zorluk

ESC-50: 50 sınıf, her biri 40 klip  dengeli, kolay. UrbanSound8K: 10 sınıf, denge dışı 10:1. AudioSet: 632 sınıf, 100.000:1 uzun kuyruğu. Çalışan teknikler:

- Eğitim sırasında dengeli örnekleme (değerlendirme sırasında değil).
- Karıştırma: iki klip (ve etiketleri) büyütme olarak doğrusal olarak interpolasyon.
- SpecAugment: rastgele zaman ve frekans bantlarını maske.

### Değerlendirme

- Çok sınıflı özel (Söz Komutları): üst-1 doğruluk, üst-5 doğruluk.
- Çok sınıflı çok etiket (AudioSet, UrbanSound tarzı): ortalama doğruluk (mAP).
- Büyük ölçüde dengesiz: sınıf başına geri çağırma + makro F1.

Bilmen gereken 2026 numarası:

| Benchmark | Baseline | SOTA 2026 | Source |
|-----------|----------|-----------|--------|
| ESC-50 | 82% (AST) | 97.0% (BEATs-iter3) | BEATs paper (2024) |
| AudioSet mAP | 0.485 (AST) | 0.548 (BEATs-iter3) | HEAR leaderboard 2026 |
| Speech Commands v2 | 98% (CNN) | 99.0% (Audio-MAE) | HEAR v2 results |

```figure
mfcc-pipeline
```

## Yapın

### Adım 1: Featurization

```python
def featurize_mfcc(signal, sr, n_mfcc=13, n_mels=40, frame_len=400, hop=160):
    mag = stft_magnitude(signal, frame_len, hop)
    fb = mel_filterbank(n_mels, frame_len, sr)
    mels = apply_filterbank(mag, fb)
    log = log_transform(mels)
    return [dct_ii(frame, n_mfcc) for frame in log]
```

### Adım 2: Sıkı bir uzunluklı özet

```python
def summarize(mfcc_frames):
    n = len(mfcc_frames[0])
    mean = [sum(f[i] for f in mfcc_frames) / len(mfcc_frames) for i in range(n)]
    var = [
        sum((f[i] - mean[i]) ** 2 for f in mfcc_frames) / len(mfcc_frames) for i in range(n)
    ]
    return mean + var
```

Basit ama güçlü: ortalama + zaman aralığı 13 kovan MFCC için 26 boyutlu sabit bir yerleşim sağlar. Anında çalışır. ESC-50'de son zamanlarda 2017 yılında en son NN temel çizgileri yenir.

### Adım 3: k-NN

```python
def cosine(a, b):
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a)) or 1e-12
    nb = math.sqrt(sum(x * x for x in b)) or 1e-12
    return dot / (na * nb)

def knn_classify(q, bank, labels, k=5):
    sims = sorted(range(len(bank)), key=lambda i: -cosine(q, bank[i]))[:k]
    votes = Counter(labels[i] for i in sims)
    return votes.most_common(1)[0][0]
```

### Dördüncü adım: Log-Mels'e CNN'e yükselt

PyTorch'te:

```python
import torch.nn as nn

class AudioCNN(nn.Module):
    def __init__(self, n_mels=80, n_classes=50):
        super().__init__()
        self.body = nn.Sequential(
            nn.Conv2d(1, 32, 3, padding=1), nn.ReLU(), nn.MaxPool2d(2),
            nn.Conv2d(32, 64, 3, padding=1), nn.ReLU(), nn.MaxPool2d(2),
            nn.Conv2d(64, 128, 3, padding=1), nn.ReLU(),
            nn.AdaptiveAvgPool2d(1),
        )
        self.head = nn.Linear(128, n_classes)

    def forward(self, x):  # x: (B, 1, T, n_mels)
        return self.head(self.body(x).flatten(1))
```

3M parametreleri. ESC-50'de tek bir RTX 4090 ile 10 dakika içinde trenler.

### Adım 5: önceden eğitilmiş bir ses transformatörünü ince ayarlayın (AST gösterildi)

```python
from transformers import ASTFeatureExtractor, ASTForAudioClassification

ext = ASTFeatureExtractor.from_pretrained("MIT/ast-finetuned-audioset-10-10-0.4593")
model = ASTForAudioClassification.from_pretrained(
    "MIT/ast-finetuned-audioset-10-10-0.4593",
    num_labels=50,
    ignore_mismatched_sizes=True,
)

inputs = ext(audio, sampling_rate=16000, return_tensors="pt")
logits = model(**inputs).logits
```

Örnek, Hub'dan AST'yi ince ayarlar. BEATs, 2026 varsayılan, Hugging Face Hub'da bulunmuyor:[BEATs release in microsoft/unilm](https://github.com/microsoft/unilm/tree/master/beats)Ve onu o repo ile yükle.`BEATs`ve `BEATsConfig`sınıflar; ince ayarlama döngüsü aynı şekli korur.

## Kullan

2026'da:

| Situation | Start with |
|-----------|-----------|
| Tiny dataset (<1000 clips) | k-NN on MFCC means (your baseline) + audio augmentation |
| Medium dataset (1K–100K) | BEATs or AST fine-tune |
| Large dataset (>100K) | Train from scratch or fine-tune Whisper-encoder |
| Real-time, edge | 40-MFCC CNN, quantized to int8 (KWS-style) |
| Multi-label (AudioSet) | BEATs-iter3 with BCE loss + mixup + SpecAugment |
| Language ID | MMS-LID, SpeechBrain VoxLingua107 baseline |

Karar kuralları: **start with a frozen backbone, not a fresh model**Beats'in kafasını ince ayarlamak, bir kaç hafta değil, saatler içinde %95 SOTA elde eder.

## Gönder

- Kaydet .`outputs/skill-classifier-designer.md`. Verilen ses sınıflandırma görevi için mimari, artırmalar, sınıf dengesi stratejisi ve değerlendirme metriklerini seçin.

## Egzersizler

1. **Easy.**Çık .`code/main.py`.K-NN MFCC temel çizgisini 4 sınıf sentetik veri kümesi (farklı tonlarda saf tonlar) üzerine eğitir.
2. **Medium.**Değiştir `summarize`4 anlık birleştirme aynı sentetik veri kümesindeki ortalama + var'ı çarpıyor mu?
3. **Hard.**Kullanım`torchaudio`ESC-50 katında 2 boyutlu bir CNN eğitimi 1. 5 katlı çapraz doğrulama doğruluğunu bildirin. SpecAugment (zaman maskesi = 20, frekans maskesi = 10) ekleyin ve delta raporunu yapın.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| AudioSet | The ImageNet of audio | Google's 2M-clip, 632-class weakly-labeled YouTube dataset. |
| ESC-50 | Small classification benchmark | 50 classes × 40 clips of environmental sounds. |
| AST | Audio Spectrogram Transformer | ViT on log-mel patches; 2021 SOTA. |
| BEATs | Self-supervised audio | Microsoft model, iter3 leads AudioSet as of 2026. |
| Mixup | Pair augmentation | `x = λ·x1 + (1-λ)·x2; y = λ·y1 + (1-λ)·y2`. |
| SpecAugment | Mask-based augmentation | Zero-out random time and frequency bands of the spectrogram. |
| mAP | Main multi-label metric | Mean average precision across classes and thresholds. |

## Daha Fazla Okumak

- [Gong, Chung, Glass (2021). AST: Audio Spectrogram Transformer](https://arxiv.org/abs/2104.01778) 2021 2024 tarihli kayıtlı mimarisi.
- [Chen et al. (2022, rev. 2024). BEATs: Audio Pre-Training with Acoustic Tokenizers](https://arxiv.org/abs/2212.09058) 2024+'ün varsayımlılığı.
- [Park et al. (2019). SpecAugment](https://arxiv.org/abs/1904.08779) baskın ses artışı.
- [Piczak (2015). ESC-50 dataset](https://github.com/karolpiczak/ESC-50)50 sınıflı bir referans değerinin devamı.
- [Gemmeke et al. (2017). AudioSet](https://research.google.com/audioset/) 632 sınıfı YouTube taksonomisi; hala altın standart.
