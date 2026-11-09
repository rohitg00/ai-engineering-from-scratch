# Konuşmacı Tanıması ve Doğrulama

> ASR "Ne dediler?" sorusunu sorar. Konuşmacı tanıma "Kim söyledi?" sorusunu sorar. Matematik aynı  gömülmeler artı cosine  gibi görünüyor.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 02 (Spectrograms & Mel), Phase 5 · 22 (Embedding Models)
**Time:** ~45 minutes

## Sorun

Bir kullanıcı bir şifre ifade eder. Bilmek istiyorsunuz: bu kişi olduğunu iddia eden kişi mi (* doğrulama*, 1:1), yoksa kayıt bankasınızdaki ilk kişi mi (* kimlik*, 1:N)?

2018'den önce: GMM-UBM + i vektörleri. Makul EER ancak kanal değişimi (telefon vs dizüstü bilgisayar) ve duygu için kırılgan. 20182022: x vektörleri (tDNN omurgası açılı kenar ile eğitilmiştir). 2022+: ECAPA-TDNN ve WavLM- büyük gömülmeler. 2026 yılına kadar alan üç model ve bir metrik tarafından egemenlik kazanmıştır.

Metrik bu.**EER** Eşit hata oranı. Karar sınırını ayarlayın, böylece yanlış kabul oranı = yanlış reddetme oranı.

## Anlaşım

![Enrollment + verification pipeline with embedding + cosine + EER](../assets/speaker-verification.svg)

**The pipeline.**Kayıt: hedef hoparlörün 530 saniye kayıt; sabit boyutlu bir yerleştirme hesaplayın (192-d ECAPA-TDNN için, 256-d WavLM- büyük için).

**ECAPA-TDNN (2020, still dominant 2026).**Kanal Dikkat, Yayın ve Toplantı - Zaman Gecikmesi Nöral Ağ. 1D konvu blokları sıkıştırma-eğilim, çok başlı dikkat birleştirme, ardından 192-d'ye kadar bir çizgi katman. VoxCeleb 1+2 (2,700 hoparlör, 1.1M ifadeler) ile Eklemel Angular Margin kaybı (AAM-yumuşak maksimum) ile eğitilmiştir.

**WavLM-SV (2022+).**AAM kaybı ile önceden eğitilmiş WavLM büyük bir SSL omurgasını ince ayarlayın. Daha yüksek kalitede ama daha yavaş  300+ MB vs 15 MB.

**x-vector (baseline).**TDNN + istatistikleri birleştirme. Klasik; hala CPU / kenarında yararlı.

**AAM-softmax.**Eklenmiş marj ile standart softmax `m`Kolaylık:`cos(θ + m)`Bu, normal bir şekilde, sınıflar arası açısal ayrım güçleri.`m=0.2`, ölçekli`s=30`- Evet .

### Notlama

- **Cosine**Başvurma ve sınav yerleşimleri arasında.
- **PLDA (Probabilistic LDA).**Aynı hoparlör ile farklı hoparlör arasındaki olasılık oranının kapalı olduğu gizli bir alanın içine yerleştirilen proje. +1020% EER azaltımı için cosine üstüne eklenir. Standart 2020 öncesi; şimdi sadece kapalı set set setuplarda kullanılır.
- **Score normalization.** `S-norm`veya `AS-norm`Bu, her puanı sahte araç ve diğer araçlara karşı normalleştirir.

### Bilmeniz gereken sayılar (2026)

| Model | VoxCeleb1-O EER | Params | Throughput (A100) |
|-------|-----------------|--------|-------------------|
| x-vector (classic) | 3.10% | 5 M | 400× RT |
| ECAPA-TDNN | 0.87% | 15 M | 200× RT |
| WavLM-SV large | 0.42% | 316 M | 20× RT |
| Pyannote 3.1 segmentation + embedding | 0.65% | 6 M | 100× RT |
| ReDimNet (2024) | 0.39% | 24 M | 100× RT |

### Diaryizasyon

"Kim ne zaman konuştu" bir çok hoparlör klipi. Pipeline: VAD → segment → her segment → cluster (aglomeratif veya spektral) → düz sınırlar yerleştirir. Modern yığın: `pyannote.audio`3.1, bir çağrı arkasında hoparlör segmentasyonu + yerleştirme + gruplama birleştirir. 2026 SOTA DER AMI'de ~ 15% (2022'de 23%'den düştü).

```figure
sp-eer-crossover
```

## Yapın

### Adım 1: MFCC istatistiklerinden oyuncak yerleştirme

```python
def embed_mfcc_stats(signal, sr):
    frames = featurize_mfcc(signal, sr, n_mfcc=13)
    mean = [sum(f[i] for f in frames) / len(frames) for i in range(13)]
    std = [
        math.sqrt(sum((f[i] - mean[i]) ** 2 for f in frames) / len(frames))
        for i in range(13)
    ]
    return mean + std  # 26-d
```

Sadece öğretmenlik için bir millik bir SOTA değil.`code/main.py`Bu, sentetik hoparlör verileri üzerinde bir kavram kanıtı olarak kullanır.

### Adım 2: Kosinus benzerliği + eşiği

```python
def cosine(a, b):
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(x * x for x in b))
    return dot / (na * nb) if na and nb else 0.0

def verify(enroll, test, threshold=0.75):
    return cosine(enroll, test) >= threshold
```

### Adım 3: Eşlik çiftlerinden EER

```python
def eer(same_scores, diff_scores):
    thresholds = sorted(set(same_scores + diff_scores))
    best = (1.0, 1.0, 0.0)  # (fa, fr, threshold)
    for t in thresholds:
        fr = sum(1 for s in same_scores if s < t) / len(same_scores)
        fa = sum(1 for s in diff_scores if s >= t) / len(diff_scores)
        if abs(fa - fr) < abs(best[0] - best[1]):
            best = (fa, fr, t)
    return (best[0] + best[1]) / 2, best[2]
```

Geri dönüşler (eer, threshold_at_eer).

### Adım 4: SpeechBrain ile üretim

```python
from speechbrain.pretrained import EncoderClassifier

clf = EncoderClassifier.from_hparams(source="speechbrain/spkrec-ecapa-voxceleb")

# enroll: average the embeddings of 3-5 clean samples
enroll = torch.stack([clf.encode_batch(load(x)) for x in enrollment_clips]).mean(0)
# verify
score = clf.similarity(enroll, clf.encode_batch(load("test.wav"))).item()
verdict = score > 0.25   # ECAPA typical threshold; tune on your data
```

### Adım 5: Pyannote ile günlük yazın

```python
from pyannote.audio import Pipeline

pipe = Pipeline.from_pretrained("pyannote/speaker-diarization-3.1")
diarization = pipe("meeting.wav", num_speakers=None)
for turn, _, speaker in diarization.itertracks(yield_label=True):
    print(f"{turn.start:.1f}–{turn.end:.1f}  {speaker}")
```

## Kullan

2026'da:

| Situation | Pick |
|-----------|------|
| Closed-set 1:1 verification, edge | ECAPA-TDNN + cosine threshold |
| Open-set verification, cloud | WavLM-SV + AS-norm |
| Diarization (meetings, podcasts) | `pyannote/speaker-diarization-3.1` |
| Anti-spoofing (replay / deepfake detection) | AASIST or RawNet2 |
| Tiny embedded (KWS + enrollment) | Titanet-Small (NeMo) |

## Tuzaklar

- **Channel mismatch.**VoxCeleb (web video) üzerinde eğitimli model ≠ telefon çağrısı sesini.
- **Short utterances.**EER, test sesinin 3 saniyesinin altında keskin bir şekilde azalır.
- **Enrollment with noise.**Bir gürültülü kayıt, demirciyi zehirliyor.
- **Fixed threshold across conditions.**Hedef alanından çıkmış bir dev seti için her zaman eşiği ayarlayın.
- **Cosine on non-normalized embeddings.**L2- önce normalleştirin; aksi takdirde büyüklük hakim olur.

## Gönder

- Kaydet .`outputs/skill-speaker-verifier.md`- Seçim modeli, kayıt protokolü, eşiğin ayarlama planı ve dolandırıcılık korumaları.

## Egzersizler

1. **Easy.**Çık .`code/main.py`- Sintez "konusucular" (farklı ses profilleri), 100 çift deneme listesine katılır, EER hesaplanır.
2. **Medium.**30 VoxCeleb1 konuşmasında SpeechBrain ECAPA kullanın (5 hoparlör × 6 kişi).
3. **Hard.**Tam kayıt yapın → günlük yapın → verify pipeline with `pyannote.audio`- AMI dev kuruluşu üzerinde DER değerlendiriyoruz.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| EER | The headline metric | Threshold where False Accept = False Reject. |
| Verification | 1:1 | "Is this Alice?" |
| Identification | 1:N | "Who is speaking?" |
| Open-set | Unknown possible | Test set can contain unenrolled speakers. |
| Enrollment | Registering | Computing a speaker's reference embedding. |
| AAM-softmax | The loss | Softmax with additive angular margin; forces cluster separation. |
| PLDA | Classic scoring | Probabilistic LDA; likelihood-ratio scoring on top of embeddings. |
| DER | Diarization metric | Diarization Error Rate — miss + false alarm + confusion. |

## Daha Fazla Okumak

- [Snyder et al. (2018). X-Vectors: Robust DNN Embeddings for Speaker Recognition](https://www.danielpovey.com/files/2018_icassp_xvectors.pdf) klasik derin gömülü kağıt.
- [Desplanques et al. (2020). ECAPA-TDNN](https://arxiv.org/abs/2005.07143) 2020 2026 baskın mimarisi.
- [Chen et al. (2022). WavLM: Large-Scale Self-Supervised Pre-Training for Full Stack Speech Processing](https://arxiv.org/abs/2110.13900) SV ve günlükleştirme için SSL omurgası.
- [Bredin et al. (2023). pyannote.audio 3.1](https://github.com/pyannote/pyannote-audio) üretim günlükleşmesi + yerleştirme yığın.
- [VoxCeleb leaderboard (updated 2026)](https://www.robots.ox.ac.uk/~vgg/data/voxceleb/) Modeller arasında mevcut EER sıralamaları.
