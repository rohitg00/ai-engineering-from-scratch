# Metin Özetleri

> Ekstraktif sistemler size belgenin ne dediğini söyler. Abstraktif sistemler yazarın ne demek istediğini söyler. Farklı görevler, farklı tuzaqlar.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 02 (BoW + TF-IDF), Phase 5 · 11 (Machine Translation)
**Time:** ~75 minutes

## Sorun

2000 kelimelik bir haber makalesi sizin feed'inize yer alır. 120 kelimeyi ele alabilirsiniz. Ya makaleden en önemli üç cümleyi (ekstrakt) seçebilir veya içeriği kendi kelimelerinizle (abstrakt) yeniden yazabilirsiniz. Her ikisi de özetleme olarak adlandırılır.

Ekstraktif özetleme sıralama sorunu.`k`. Çıkış her zaman dilbilimsel çünkü sözcük olarak kaldırılır.

Abstraktif özetleme bir nesil sorunudır. Bir transformatör giriş üzerine koşullanmış yeni bir metin üretir. Çıktı akıcı ve sıkıştırıcı ancak kaynağa ait olmayan gerçekleri halüsinasyonlayabilir. Risk güvenli bir yapımdır.

Bu ders her ikisini de güçlendirir. Her birinin başarısızlık moduna sahip.

## Anlaşım

![Extractive TextRank vs abstractive transformer](../assets/summarization.svg)

**Extractive.**Makaleyi bir grafik olarak ele alın, burada düğümler cümle, kenarlar da benzerliklerdir.**TextRank**(Mihalcea ve Tarau, 2004).

**Abstractive.**Doküman-sözet çiftlerinde bir transformatör kodlayıcı-dekodör (BART, T5, Pegasus) ince ayarlayın. Sonuçta, model belgeyi okuyor ve çapraz dikkat yoluyla toplamadan token-token oluşturur. Pegasus özellikle çok ince ayarlama yapmadan toplamayı mükemmel kılan bir boşluk cümle öncesi eğitim hedefini kullanır.

 ile değerlendirme**ROUGE**ROUGE-1 ve ROUGE-2 puanları tekerlek ve büyükerlek üstlenir. ROUGE-L puanları en uzun ortak ardıcıllık. Daha yüksek daha iyidir ancak 40 ROUGE-L "iyi" ve 50 "istifadedir". Her makale üçü de rapor eder.`rouge-score`Paket.

```figure
summarize-collapse
```

## Yapın

### Adım 1: TextRank (kısaltma)

```python
import math
import re
from collections import Counter


def sentence_split(text):
    return re.split(r"(?<=[.!?])\s+", text.strip())


def similarity(s1, s2):
    w1 = Counter(s1.lower().split())
    w2 = Counter(s2.lower().split())
    intersection = sum((w1 & w2).values())
    denom = math.log(len(w1) + 1) + math.log(len(w2) + 1)
    if denom == 0:
        return 0.0
    return intersection / denom


def textrank(text, top_k=3, damping=0.85, iterations=50, epsilon=1e-4):
    sentences = sentence_split(text)
    n = len(sentences)
    if n <= top_k:
        return sentences

    sim = [[0.0] * n for _ in range(n)]
    for i in range(n):
        for j in range(n):
            if i != j:
                sim[i][j] = similarity(sentences[i], sentences[j])

    scores = [1.0] * n
    for _ in range(iterations):
        new_scores = [1 - damping] * n
        for i in range(n):
            total_out = sum(sim[i]) or 1e-9
            for j in range(n):
                if sim[i][j] > 0:
                    new_scores[j] += damping * sim[i][j] / total_out * scores[i]
        if max(abs(s - ns) for s, ns in zip(scores, new_scores)) < epsilon:
            scores = new_scores
            break
        scores = new_scores

    ranked = sorted(range(n), key=lambda k: scores[k], reverse=True)[:top_k]
    ranked.sort()
    return [sentences[i] for i in ranked]
```

İki şey isimlendirme değeridir. Benzerlik fonksiyonu orijinal TextRank variansı olan log-normalize word overlap kullanır. TF-IDF vektörlerinin kozine de çalışır. Damping faktörü 0.85 ve tekrar sayısı, PageRank'in öntanımlı özellikleri.

### Adım 2: BART ile soyutlama

```python
from transformers import pipeline

summarizer = pipeline("summarization", model="facebook/bart-large-cnn")

article = """(long news article text)"""

summary = summarizer(article, max_length=120, min_length=60, do_sample=False)
print(summary[0]["summary_text"])
```

BART-large-CNN, CNN/DailyMail korpusuna ince ayarlanmıştır. Kutudan haber tarzında özetler üretir. Diğer alanlar (bilimsel makaleler, diyalog, hukuki), ilgili Pegasus kontrol noktasını veya hedef verilerinizi ince ayarlayın.

### Adım 3: ROUGE değerlendirme

```python
from rouge_score import rouge_scorer

scorer = rouge_scorer.RougeScorer(["rouge1", "rouge2", "rougeL"], use_stemmer=True)
scores = scorer.score(reference_summary, generated_summary)
print({k: round(v.fmeasure, 3) for k, v in scores.items()})
```

Sensiz "cırmak" ve "cırmak" farklı kelimeler olarak sayılır ve ROUGE az sayılır.

### ROUGE'den öte (2026 özet değerlendirme)

ROUGE yirmi yıldır baskın bir toplama metrikidir ve 2026 yılında kendi başına yeterli değildir. NLG makalelerinin büyük ölçekli bir meta-analisisinde şunlar gösterildi:

- **BERTScore**(konekstüel yerleştirme benzerliği) 2023 yılına kadar yer aldı ve şimdi çoğu özet makalesinde ROUGE ile birlikte rapor edildi.
- **BARTScore**değerlendirmeyi bir nesil olarak değerlendirir: özetin kaynağı verildiğinde önceden eğitilmiş bir BART'in onu ne kadar olasılıkla tahsis ettiği ile değerlendirilmelidir.
- **MoverScore**(Earth Mover's Distance over contextual embeddings) 2025'te top noktaya ulaştı çünkü ROUGE'den daha iyi semantik üst üsteliklemeyi yakalar.
- **FactCC**ve **QA-based faithfulness**2021-2023 yılları arasında yaygın olanlar, şimdi sıklıkla **G-Eval**(GPT-4 uyarı zinciri, tutarlılık, akıcılık, düşünce zinciri akıllanmasına ilişkin uygunluk puanları).
- **G-Eval**ve benzer LLM-hakimi yaklaşımları, rubrikaların iyi tasarlandığı zaman insan yargısına eşittir.

Üretim önerisi: geçmiş bir karşılaştırma için ROUGE-L raporunu, semantik üst üstelik BERTScore raporunu, tutarlılık ve gerçeklik için G-Eval raporunu. 50-100 insan etiketiyle özetlere göre kalibrel.

### Dördüncü adım: Gerçeklik sorunu

Abstraktif özetler halüsinasyona eğilimlidir. Ekstraktif özetler, kaynaktan sözde çıkarıldığı için çok daha düşük bir halüsinasyon riski taşır, ancak kaynak cümlelerinin bağlamsızlaştırıldığında, eskiye kalmışsa veya sıra dışı alıntı yapıldığında yanıltıcı hale gelebilirler. Bu, üretim sistemlerinin halen uyumlulık ile bitişik içerik için ekstraktif yöntemleri tercih etmesinin tek büyük nedeni.

Halüsinasyon türleri:

- **Entity swap.**Kaynak "John Smith" diyor. Kısacası "John Brown".
- **Number drift.**Kaynak "25.000" diyor. Özet "25 milyon".
- **Polarity flip.**Kaynak "sırayı reddetti" diyor.
- **Fact invention.**Kaynak CEO'dan bahsetmiyor.

Değerlendirme bu işe yaklaşımları:

- **FactCC.**Kaynak cümle ile özet cümlesi arasındaki bağlantıya bağlı olarak eğitilmiş ikili bir sınıflandırıcı.
- **QA-based factuality.**Kaynağında cevapları olan bir soru sor.
- **Entity-level F1.**Kaynak ve özetle ilgili isimleri karşılaştırın.

Gerçeklik önemli olan (haberler, tıbbi, yasal, finansal) kullanıcıya yönelik her şey için, ekstraksif daha güvenli bir özelliktir.

## Kullan

2026'da:

| Use case | Recommended |
|---------|-------------|
| News, 3-5 sentence summary, English | `facebook/bart-large-cnn` |
| Scientific papers | `google/pegasus-pubmed` or a tuned T5 |
| Multi-document, long-form | Any LLM with 32k+ context, prompted |
| Dialog summarization | `philschmid/bart-large-cnn-samsum` |
| Extractive, low hallucination risk by construction | TextRank or `sumy`'s LSA / LexRank |

Uzun bağlamlı LLM'ler, hesaplama bir kısıtlama olmadığı 2026'da genellikle uzmanlaşmış modellerden üstün gelir.

## Gönder

- Kaydet .`outputs/skill-summary-picker.md`- ...

```markdown
---
name: summary-picker
description: Pick extractive or abstractive, named library, factuality check.
version: 1.0.0
phase: 5
lesson: 12
tags: [nlp, summarization]
---

Given a task (document type, compliance requirement, length, compute budget), output:

1. Approach. Extractive or abstractive. Explain in one sentence why.
2. Starting model / library. Name it. `sumy.TextRankSummarizer`, `facebook/bart-large-cnn`, `google/pegasus-pubmed`, or an LLM prompt.
3. Evaluation plan. ROUGE-1, ROUGE-2, ROUGE-L (use rouge-score with stemming). Plus factuality check if abstractive.
4. One failure mode to probe. Entity swap is the most common in abstractive news summarization; flag samples where source entities do not appear in summary.

Refuse abstractive summarization for medical, legal, financial, or regulated content without a factuality gate. Flag input over the model's context window as needing chunked map-reduce summarization (not just truncation).
```

## Egzersizler

1. **Easy.**5 haber makalesinde TextRank çalıştırın. En üst 3 cümleyi referans özetle karşılaştırın. ROUGE-L ölçün. CNN/DailyMail tarzındaki makalelerde 30-45 ROUGE-L görmelisiniz.
2. **Medium.**Kuruluş düzeyinde gerçekliği uygula: Kaynak ve özetten isimlendirilmiş kuruluşları çıkarmak (spaCy), özette kaynak kuruluşlarının hesaplama geri çağırılması ve kaynak karşı özetleyici kuruluşların kesinliği. Yüksek hassasiyet ve düşük hatırlama güvenli ama kısa anlamına gelir; düşük hassasiyet halüsinasyonlu kuruluşlar anlamına gelir.
3. **Hard.**BART-large-CNN ile LLM (Claude veya GPT-4) ile CNN/DailyMail'in 50 makalesinde karşılaştırın. ROUGE-L raporunu, gerçekliği (enti F1) ve özet başına maliyetini rapor edin. Her birinin kazandığı belge.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Extractive | Pick sentences | Return sentences verbatim from the source. Never hallucinates. |
| Abstractive | Rewrite | Generate new text conditioned on source. Can hallucinate. |
| ROUGE | Summary metric | N-gram / LCS overlap between system output and reference. |
| TextRank | Graph-based extractive | PageRank over sentence similarity graph. |
| Factuality | Is it right | Whether summary claims are supported by the source. |
| Hallucination | Made-up content | Content in the summary that the source does not support. |

## Daha Fazla Okumak

- [Mihalcea and Tarau (2004). TextRank: Bringing Order into Texts](https://aclanthology.org/W04-3252/) ekstraksiyon kanonik kağıdı.
- [Lewis et al. (2019). BART: Denoising Sequence-to-Sequence Pre-training](https://arxiv.org/abs/1910.13461)BART kağıdı.
- [Zhang et al. (2019). PEGASUS: Pre-training with Extracted Gap-sentences](https://arxiv.org/abs/1912.08777)Pegasus ve boş cümle hedefi.
- [Lin (2004). ROUGE: A Package for Automatic Evaluation of Summaries](https://aclanthology.org/W04-1013/) Kırmızı kağıt.
- [Maynez et al. (2020). On Faithfulness and Factuality in Abstractive Summarization](https://arxiv.org/abs/2005.00661) gerçeklik manzarası kağıdı.
