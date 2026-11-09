# Konuşma Tanıma (ASR)  CTC, RNN-T, Dikkat

> Konuşma tanıma, her zaman adımında ses sınıflandırmasıdır, İngilizce ve sessizlik bilinen bir dizi modeli ile yapıştırılır. CTC, RNN-T ve dikkat bunu yapmanın üç yolu.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 02 (Spectrograms & Mel), Phase 5 · 08 (CNNs & RNNs for Text), Phase 5 · 10 (Attention)
**Time:** ~45 minutes

## Sorun

10 saniyelik 16 kHz klipiniz var. Bir ip istersiniz: "mutfak lambalarını açın". Çabası yapısal: ses çerçeveleri karakterlerle birbiriyle uyumlu değildir. "OK" kelimesi 200 ms veya 1200 ms alabilir. Sessizlik ifadeni noktalar. Bazı fonemler diğerlerinden uzun. Çıktılık belirtilerin sayısı önceden bilinmemektedir.

Üç formülasyon bu durumu çözer:

1. **CTC (Connectionist Temporal Classification).**Özel bir * boş* dahil bir çerçeve için belirtiler olasılığını gönderin. Decode zamanı çöküş tekrarları ve boşlukları.
2. **RNN-T (Recurrent Neural Network Transducer).**Ortak ağ, verilen bir sonraki token'ı kodlayıcı çerçevesine ve önceki token'lara önceden tahmin eder. Akışlanabilir.
3. **Attention encoder-decoder.**Kodlayıcı sesleri gizli durumlara sıkıştırır, dekoderler otomatik olarak jetonlar oluşturmak için çapraz olarak çalışır.

2026 yılında LibriSpeech test temizliği SOTA WER'nin %1.4 (Parakeet-TDT-1.1B, NVIDIA) ve %1.58% (Whisper-Large-v3-turbo) oranı.

## Anlaşım

![Three ASR formulations: CTC, RNN-T, attention-encoder-decoder](../assets/asr-formulations.svg)

**CTC intuition.**Kodlayıcı çıkış yapsın `T`Çerçeve seviyesindeki dağılımlar `V+1`işaretler (V karakterler + boş). Hedef dizilisi için `y`uzunlukta `U < T`, herhangi bir çerçeve düzeni çöküyor `y`CTC kaybı tüm bu ayarların toplamı.

Avantajlar: kendi kendine geri dönmeyen, akışlı, sıfır bakış açısı. Eksikliği: * koşullı bağımsızlık varsayımı*  her çerçeve öngörü diğerlerinden bağımsızdır, bu nedenle iç dil modeli yoktur.

**RNN-T intuition.**Token geçmişini yerleştiren *predictor* ağı ve *joiner* ' i ekler.`V+1`(Devayı)`+1`CTC'nin göz ardı ettiği koşullı bağımlılığı açıkça modeller. Her adım sadece geçmiş çerçeveler ve geçmiş jetonlar için koşullar nedeniyle akışlanabilir.

Avantajlar: akışlı + iç LM. Eksikliği: eğitim daha karmaşık ve hafıza açtır (3D kaybı ağ); RNN-T kaybı çekirdekleri kendi başına bir kütüphane kategorisidir.

**Attention encoder-decoder.**Log-mel çerçeveleri üzerinde kodlayıcı (6-32 transformatör katmanı). Dekoder (6-32 transformatör katmanı) otomatik olarak jetonlar üretmek için kodlama çıkışlarına çapraz hizmet verir. Düzeltme kısıtlaması  dikkat sesin herhangi bir yerinde bakabilir. Dikkatini kısıtlamadan akışılamaz (çıkılmış Şapışkış Akışı, 2024).

Avantajlar: çevrimdışı ASR'de en yüksek kalitede, standart seq2seq araçlarıyla eğitilmek kolaydır. Eksikliği: autoregressive latency çıkış uzunluğuna orantılıdır; mühendislik olmadan akışa izin verilmez.

### WER: tek sayı

**Word Error Rate**= $(S + D + I) / N$, nerede $S$=değiştirme, $D$=Kesinleştirmeler,$I$=İşlemeler, $N$=reference word count. Levenshtein'in kelime seviyesindeki mesafeyi eşleştiriyor. Daha düşük daha iyidir. 20%'den fazla bir WER genellikle kullanılamaz; 5%'in altında okuma konuşması için insan-birliktir. 2026 standart referans değerleri:

| Model | LibriSpeech test-clean | LibriSpeech test-other | Size |
|-------|------------------------|------------------------|------|
| Parakeet-TDT-1.1B | 1.40% | 2.78% | 1.1B params |
| Whisper-Large-v3-turbo | 1.58% | 3.03% | 809M |
| Canary-1B Flash | 1.48% | 2.87% | 1B |
| Seamless M4T v2 | 1.7% | 3.5% | 2.3B |

Tüm bunlar kodlayıcı-dekoder veya RNN-T tabanlıdır.

```figure
ctc-collapse
```

## Yapın

### Adım 1: Açgözlü CTC çözümü

```python
def ctc_greedy(frame_logits, blank=0, vocab=None):
    # frame_logits: list of per-frame probability vectors
    preds = [max(range(len(p)), key=lambda i: p[i]) for p in frame_logits]
    out = []
    prev = -1
    for p in preds:
        if p != prev and p != blank:
            out.append(p)
        prev = p
    return "".join(vocab[i] for i in out) if vocab else out
```

İki kural: çökme ardılı tekrarlar, boşluklar bırak.`a a _ _ a b b _ c`→ `a a b c`- Evet .

### Adım 2: Çığlık araması CTC

```python
def ctc_beam(frame_logits, beam=8, blank=0):
    import math
    beams = [([], 0.0)]  # (tokens, log_prob)
    for p in frame_logits:
        log_p = [math.log(max(pi, 1e-10)) for pi in p]
        candidates = []
        for seq, lp in beams:
            for t, lpt in enumerate(log_p):
                new = seq[:] if t == blank else (seq + [t] if not seq or seq[-1] != t else seq)
                candidates.append((new, lp + lpt))
        candidates.sort(key=lambda x: -x[1])
        beams = candidates[:beam]
    return beams[0][0]
```

Üretim LM füzyonu ile prefix ağaç ışın araması kullanır; bu kavramsal iskelet.

### Adım 3: WER

```python
def wer(ref, hyp):
    r, h = ref.split(), hyp.split()
    dp = [[0] * (len(h) + 1) for _ in range(len(r) + 1)]
    for i in range(len(r) + 1):
        dp[i][0] = i
    for j in range(len(h) + 1):
        dp[0][j] = j
    for i in range(1, len(r) + 1):
        for j in range(1, len(h) + 1):
            cost = 0 if r[i - 1] == h[j - 1] else 1
            dp[i][j] = min(
                dp[i - 1][j] + 1,
                dp[i][j - 1] + 1,
                dp[i - 1][j - 1] + cost,
            )
    return dp[len(r)][len(h)] / max(1, len(r))
```

### Dördüncü adım: Fısıltı ile sonuç

```python
import whisper
model = whisper.load_model("large-v3-turbo")
result = model.transcribe("clip.wav")
print(result["text"])
```

2026'da en güçlü genel ASR için tek satır. ~ 20× gerçek zamanlı bir 24 GB GPU'da çalışır.

### Adım 5: Parakeet veya wav2vec 2.0 ile akış

```python
from transformers import pipeline
asr = pipeline("automatic-speech-recognition", model="nvidia/parakeet-tdt-1.1b")
for chunk in streaming_audio():
    print(asr(chunk, return_timestamps=True))
```

Akış ASR'nin parçalara ayrılmış kodlama dikkatini ve taşıma durumu gerektirir; destekleyen bir kütüphaneden kullanın (NeMo için Parakeet, `transformers` ile birlikte`chunk_length_s`)

## Kullan

2026'da:

| Situation | Pick |
|-----------|------|
| English, offline, max quality | Whisper-large-v3-turbo |
| Multilingual, robust | SeamlessM4T v2 |
| Streaming, low latency | Parakeet-TDT-1.1B or Riva |
| Edge, mobile, <500 ms latency | Whisper-Tiny quantized or Moonshine (2024) |
| Long-form | Whisper with VAD-based chunking (WhisperX) |
| Domain-specific (medical, legal) | Fine-tune wav2vec 2.0 + domain LM fusion |

## 2026'da hala yolculuk eden tuzaklar

- **No VAD.**Sessizlikle Sısırmak, halüsinasyonlar yaratır ("Seyrettiğiniz için teşekkürler!").
- **Character vs word vs subword WER.**Söz düzeyinde WER *after* normalisasyonunu bildirin (en az yazılı, noktalama kaldırıldı).
- **Language ID drift.**Whisper'in otomatik LID'si gürültülü klipleri Japonca veya Gallerce'ye yanlış yönlendirir; güç `language="en"`- Ne zaman bilsen.
- **Long clips without chunking.**Whisper'in 30 saniyelik bir penceresi var.`chunk_length_s=30, stride=5`Daha uzun süre.

## Gönder

- Kaydet .`outputs/skill-asr-picker.md`- Belirli bir dağıtım hedefi için model seçin, kodlama stratejisi, parçalanma ve LM birleşimi.

## Egzersizler

1. **Easy.**Çık .`code/main.py`- El yapımı bir CTC çıkışını açgözlülükle çözüyor ve WER'yi referans ile hesaplıyor.
2. **Medium.**Adım 2'de önlük-taş ışın aramayı doğru şekilde uygulayın (boş birleştirme kuralını hesaplayın). 10 örnekteki sentetik veri kümesinde açgözlülükle karşılaştırın.
3. **Hard.**Kullanım`whisper-large-v3-turbo`- Evet .[LibriSpeech test-clean](https://www.openslr.org/12)İlk 100 konuşma ile WER hesaplayın.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| CTC | The blank-token loss | Marginal over all frame-to-token alignments; non-AR. |
| RNN-T | The streaming loss | CTC + next-token predictor; handles word-order. |
| Attention enc-dec | Whisper-style | Encoder + cross-attending decoder; best offline quality. |
| WER | The number you report | `(S+D+I)/N` at word level. |
| Blank | The emptiness | Special token in CTC signalling "no emission this frame". |
| LM fusion | External language model | Add weighted LM log-probs during beam search. |
| VAD | The silence gate | Voice activity detector; trims non-speech. |

## Daha Fazla Okumak

- [Graves et al. (2006). Connectionist Temporal Classification](https://www.cs.toronto.edu/~graves/icml_2006.pdf) CTC kağıdı.
- [Graves (2012). Sequence Transduction with RNNs](https://arxiv.org/abs/1211.3711)RNN-T kağıdı.
- [Radford et al. / OpenAI (2022). Whisper: Robust Speech Recognition via Large-Scale Weak Supervision](https://arxiv.org/abs/2212.04356) 2022 Kanonik Kağıdı; 2024'te v3-turbo uzantısı.
- [NVIDIA NeMo — Parakeet-TDT card](https://huggingface.co/nvidia/parakeet-tdt-1.1b) 2026 Açık ASR Leaderboard lideri.
- [Hugging Face — Open ASR Leaderboard](https://huggingface.co/spaces/hf-audio/open_asr_leaderboard) 25+ model üzerinde canlı bir referans.
