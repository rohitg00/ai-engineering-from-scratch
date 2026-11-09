# Ses Değerlendirme  WER, MOS, UTMOS, MMAU, FAD ve Açık Rütbe

> Ölçemeyeceğiniz şeyi gönderemezsiniz. Bu ders her ses görevi için 2026 metrikleri belirler: ASR (WER, CER, RTFx), TTS (MOS, UTMOS, SECS, WER-on-ASR-round-trip), ses dili (MMAU, LongAudioBench), müzik (FAD, CLAP) ve hoparlör (EER).

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 04, 06, 07, 09, 10; Phase 2 · 09 (Model Evaluation)
**Time:** ~60 minutes

## Sorun

Her ses görevinin farklı bir ekseni ölçen birden fazla metrik vardır. Yanlış metrik kullanmak, arabasında harika görünen ve üründe korkunç bir model göndermek demektir. 2026 Kanonik listesi:

| Task | Primary | Secondary |
|------|---------|-----------|
| ASR | WER | CER · RTFx · first-token latency |
| TTS | MOS / UTMOS | SECS · WER-on-ASR-round-trip · CER · TTFA |
| Voice cloning | SECS (ECAPA cosine) | MOS · CER |
| Speaker verification | EER | minDCF · FAR / FRR at operating point |
| Diarization | DER | JER · speaker confusion |
| Audio classification | top-1 · mAP | macro F1 · per-class recall |
| Music generation | FAD | CLAP · listening panel MOS |
| Audio language model | MMAU-Pro | LongAudioBench · AudioCaps FENSE |
| Streaming S2S | latency P50/P95 | WER · MOS |

## Anlaşım

![Audio evaluation matrix — metrics vs tasks vs 2026 leaderboards](../assets/eval-landscape.svg)

### ASR ölçümleri

**WER (Word Error Rate).** `(S + D + I) / N`Küçük harflerle, çizim çizimleriyle, puan almadan önce sayıları normalleştir.`jiwer`veya OpenAI'nin `whisper_normalizer`. &lt;% 5 = insan eşitliği konuşma okuyucu.

**CER (Character Error Rate).**Aynı formül, karakter seviyesinde. Sözcük bölünmesi belirsiz olan ses dillerinde (Mandarin, Kanton) kullanılır.

**RTFx (inverse real-time factor).**Ses saniyeleri, duvar saati saniyesine göre işlenir. Daha yüksek daha iyidir. Parakeet-TDT 3380×'ye ulaşır.

**First-token latency.**Ses girişinden ilk transkript tokenine kadar duvar saati.

### TTS ölçütleri

**MOS (Mean Opinion Score).**1-5 insan derecesi. Altın standart ama yavaş.

**UTMOS (2022-2026).**Öğrenilmiş MOS tahmincisi. ~ 0.9 ile insan MOS'u standart referans değerlerinde ilişkilendiriyor. F5-TTS: UTMOS 3.95; temel gerçeklik: 4.08.

**SECS (Speaker Encoder Cosine Similarity).**Ses klonlaması için. ECAPA referans ve klon edilmiş çıkış arasında cosine yerleştirme. &gt; 0.75 = tanınabilir klon.

**WER-on-ASR-round-trip.**TTS çıkışında Whisper çalıştırın, girilen metne karşı WER hesaplayın. Anlaşılabilirlik gerilemeleri yakalar. 2026 SOTA: &lt; 2% WER İngilizce test setlerinde (Mandarin setleri yerine CER rapor).

**TTFA (time-to-first-audio).**Kokoro-82M: ~100 ms; F5-TTS: ~ 1 saniye.

### Ses klonlaması için özel

**SECS + MOS + CER**Yüksek SECS, düşük MOS puanı veren klonlama, tam anlamıyla doğru ama doğal olmayan bir timbre anlamına gelir.

### Konuşmacı doğrulama

**EER (Equal Error Rate).**Yalancı kabul oranının yanlış reddedilme oranının eşit olduğu eşiği.

**minDCF (min Detection Cost).**Seçilen bir işletme noktasında ağırlıklı maliyet (genellikle FAR=0,01).

### Diaryizasyon

**DER (Diarization Error Rate).** `(FA + Miss + Confusion) / total_speaker_time`. Kaybolan konuşma + yanlış alarm konuşması + hoparlör-kafası, her biri bir bölüm olarak. AMI toplantıları: DER ~ 10-20% gerçekçi. pyannote 3.1 + Precision-2 reklam: &lt;10% DER iyi kaydedilen ses.

**JER (Jaccard Error Rate).**DER'e alternatif, kısa segmentli kısıtlama için sağlam.

### Ses sınıflandırması

Çok etiketli: **mAP (mean Average Precision)**Tüm sınıflar için.

Çok sınıflı özel: **top-1, top-5 accuracy**Konuşma Komutları v2: 99.0% top-1 (Audio-MAE).

Denge eksikliği: **macro F1**+ **per-class recall**.Sınıf başına rapor  Toplam doğruluk hangi sınıfların başarısız olduğunu gizler.

### Müzik jenerasyonu

**FAD (Fréchet Audio Distance).**VGGish içeren gerçek vs. üretilen ses dağıtımları arasındaki mesafe. MusicGen MusicCaps üzerinde küçük: 4.5. MusicLM: 4.0. Daha düşük daha iyi.

**CLAP Score.**CLAP gömülmelerini kullanarak metin-audio uyum puanı. &gt; 0.3 = makul uyum.

**Listening panel MOS.**Suno'nun kendi çiftli tercih referanslamasında ELO 1293 puanını aldı. Bu bir satıcı numarasıdır; TTS Arena, müzik değil konuşmayı sıralamaktadır.

### Sesli dil referansları

**MMAU (Massive Multi-Audio Understanding).**10 bin sesli-QA çift.

**MMAU-Pro.**1800 sert öğe, dört kategori: konuşma / ses / müzik / çok sesli. Rastgele şans 25% dört yönlü. Gemini 2.5 Pro genel olarak ~ 60%; çok sesli tüm modellerde ~ 22% .

**LongAudioBench.**Semantik sorularla birlikte birkaç dakikalık klipler.

**AudioCaps / Clotho.**SPICE, CIDER, FENSE ölçümleri.

### Konuşma-söz akışı

**Latency P50 / P95 / P99.**Kullanıcının konuşma sonundan ilk sesli tepkiye kadar duvar saati.

**WER / MOS**Çıktı.

**Barge-in responsiveness.**Kullanıcı kesintiden asistan sessizliğe kadar.

### 2026 liderlik tabloları

| Leaderboard | Tracks | URL |
|------------|--------|-----|
| Open ASR Leaderboard (HF) | English + multilingual + long-form | `huggingface.co/spaces/hf-audio/open_asr_leaderboard` |
| TTS Arena (HF) | English TTS | `huggingface.co/spaces/TTS-AGI/TTS-Arena` |
| Artificial Analysis Speech | TTS + STT, ELO from paired votes | `artificialanalysis.ai/speech` |
| MMAU-Pro | LALM reasoning | `sonalkum.github.io/mmau-pro` |
| SpeakerBench / VoxSRC | Speaker recognition | `voxsrc.github.io` |
| MMAU music subset | Music LALM | (within MMAU) |
| HEAR benchmark | Self-supervised audio | `hearbenchmark.com` |

```figure
sp-wer-align
```

## Yapın

### Adım 1: Normalleşme ile WER

```python
from jiwer import wer, Compose, ToLowerCase, RemovePunctuation, Strip

transform = Compose([ToLowerCase(), RemovePunctuation(), Strip()])
score = wer(
    truth="Please turn on the lights.",
    hypothesis="please turn on the light",
    truth_transform=transform,
    hypothesis_transform=transform,
)
# ~0.17
```

### Adım 2: TTS geri dönüş WER

```python
def ttr_wer(tts_model, asr_model, texts):
    errors = []
    for txt in texts:
        audio = tts_model.synthesize(txt)
        recog = asr_model.transcribe(audio)
        errors.append(wer(truth=txt, hypothesis=recog))
    return sum(errors) / len(errors)
```

### Adım 3: Ses klonlaması için SECS

```python
from speechbrain.inference.speaker import EncoderClassifier
sv = EncoderClassifier.from_hparams("speechbrain/spkrec-ecapa-voxceleb")

emb_ref = sv.encode_batch(load_wav("reference.wav"))
emb_clone = sv.encode_batch(load_wav("cloned.wav"))
secs = torch.nn.functional.cosine_similarity(emb_ref, emb_clone, dim=-1).item()
```

### Adım 4: Müzik jenerasyonu için FAD

```python
from frechet_audio_distance import FrechetAudioDistance
fad = FrechetAudioDistance()
score = fad.get_fad_score("generated_folder/", "reference_folder/")
```

### Adım 5: Konuşmacıların doğrulanması için EER (Disim 6)

```python
def eer(same_scores, diff_scores):
    thresholds = sorted(set(same_scores + diff_scores))
    best = (1.0, 0.0)
    for t in thresholds:
        far = sum(1 for s in diff_scores if s >= t) / len(diff_scores)
        frr = sum(1 for s in same_scores if s < t) / len(same_scores)
        if abs(far - frr) < best[0]:
            best = (abs(far - frr), (far + frr) / 2)
    return best[1]
```

## Kullan

Her dağıtımın her model güncelleme sırasında çalışacak sabit bir değerlendirme harnesine eşleştirilmesini sağlayın.

1. **Normalize before scoring.**Küçük harf, nokta çizgisi, sayı genişle.
2. **Report distributions, not averages.**P50/P95/P99 gecikme için. Sınıf başına geri çağırma sınıflandırma için. MMAU için kategori başına.
3. **Run one canonical public benchmark.**Üretim verileriniz farklı olsa bile, Open ASR / TTS Arena / MMAU'da raporlar, inceleyicilerin elma ile elma arasında bir kıyaslama yapmasına izin verir.

## Tuzaklar

- **UTMOS extrapolation.**VCTK tarzı temiz konuşma konusunda eğitilmiş; gürültülü / klonlanmış / duygusal sesleri kötü puanlar.
- **MOS panel bias.**20 Amazon Mechanical Turk çalışanı ≠ 20 hedef kullanıcı.
- **FAD depends on reference set.**Modeller arasında aynı referans dağılımına karşılaştırın.
- **Aggregate WER.**Toplam %5 REM'de, aksanlı konuşmalarda %30 REM'i gizleyebilir.
- **Public benchmark saturation.**Çoğu sınır modeli standart standart standartlarda tavanın yakınında. Trafikinizi yansıtan bir ev içi bir tutunma seti yapın.

## Gönder

- Kaydet .`outputs/skill-audio-evaluator.md`. Her ses modelinin yayını için ölçümleri, referansları ve raporlama biçimini seçin.

## Egzersizler

1. **Easy.**Çık .`code/main.py`Oyuncak girişleri üzerinde WER / CER / EER / SECS / FAD-ish / MMAU-ish hesaplayın.
2. **Medium.**TTS dönüş WER harnesini yapın. Kokoro veya F5-TTS çıkışınızı Whisper üzerinden çalıştırın. WER'i 50'den fazla ipucu hesaplayın. Bayrak ipucuları WER &gt; % 10 ile.
3. **Hard.**Ders 10 LALM seçeneğini MMAU-Pro konuşma + çoklu ses alt kümeleri üzerinde değerlendirin (her biri 50 madde).

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| WER | ASR score | `(S+D+I)/N` at word level after normalization. |
| CER | Character WER | For tone languages or char-level systems. |
| MOS | Human opinion | 1-5 rating; 20+ listeners × 100 samples. |
| UTMOS | ML MOS predictor | Learned model; correlates ~0.9 with human MOS. |
| SECS | Voice-clone similarity | ECAPA cosine between reference and clone. |
| EER | Speaker verif score | Threshold where FAR = FRR. |
| DER | Diarization score | (FA + Miss + Confusion) / total. |
| FAD | Music-gen quality | Fréchet distance on VGGish embeddings. |
| RTFx | Throughput | Audio seconds per wall-clock second. |

## Daha Fazla Okumak

- [jiwer](https://github.com/jitsi/jiwer) Normalleşme araçları ile WER/CER kütüphanesi.
- [UTMOS (Saeki et al. 2022)](https://arxiv.org/abs/2204.02152) MOS tahmincisi öğrendi.
- [Fréchet Audio Distance (Kilgour et al. 2019)](https://arxiv.org/abs/1812.08466) Müzik-gen standardı.
- [Open ASR Leaderboard](https://huggingface.co/spaces/hf-audio/open_asr_leaderboard)2026 canlı sıralamaları.
- [TTS Arena](https://huggingface.co/spaces/TTS-AGI/TTS-Arena) İnsan oyları TTS lider listesinde.
- [MMAU-Pro benchmark](https://sonalkum.github.io/mmau-pro/) LALM akıl yürütme lider tablosu.
- [HEAR benchmark](https://hearbenchmark.com/) sesli SSL referansları.
