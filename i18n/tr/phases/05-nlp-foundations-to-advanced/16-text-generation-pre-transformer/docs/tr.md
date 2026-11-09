# Transformatörlerden Önce Metin Genresimi  N-gram Dil Modelleri

> Bir kelime şaşırtıcı ise model kötüdür. Kafası karışıklık bir sayıyı şaşırtır.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 01 (Text Processing), Phase 2 · 14 (Naive Bayes)
**Time:** ~45 minutes

## Sorun

Transformatörlerden, RNN'lerden, kelimeler yerleştirilmeden önce, bir dil modeli, önceki kelimenin ne kadar sıklıkla takip ettiğini sayarak bir sonraki kelimeyi tahmin ediyordu `n-1`"Kedi" → "Yata" 47 kez, "Kedi" → "sapan" 12 kez, "Kedi" → "doğaz" 0 kez sayın.

Bu n-gram dil modeli. 1980'den 2015'e kadar her konuşma tanıtıcısı, her harf kontrolcüsü ve her cümle tabanlı makine çevirisi sistemini çalıştı.

İlginç olan sorun, görünmeyen n-gramlar hakkında ne yapılmasıdır. Çiğ sayım tabanlı bir model, görmediği herhangi bir şeye sıfır olasılık belirler, bu da felaketlidir, çünkü cümleler uzun ve neredeyse her uzun cümle en az bir görünmeyen sırayı içerir.

## Anlaşım

![N-gram model: count, smooth, generate](../assets/ngram.svg)

### Önceden tahmin oyunu

Bu makineler var olmadan önce bir deney dil modelinin ne olduğunu tanımladı. İngilizce cümlenin bir sonraki harfini kaplayın. Bir kişiyi doğru bir tahmin yapana kadar tahmin etmesini isteyin. Tahmin sayısını yazın. Birkaç yüz harfi tekrarlayın.

Tahmin sayıları önemsiz değildir. Bunlar metnin kaybı olmayan bir yeniden kodlamasıdır: sayım sırasını ikinci, aynı tahminciye teslim edin ve her harfi yeniden yapılandırabilirler, çünkü her pozisyonda hangi tahminlerin önce geldiğini tam olarak biliyorlar. Daha az sembolle yeniden kodlayabileceğiniz bir mesaj, her sembol için daha az bilgi taşır, bu nedenle tahmin sayım istatistikleri İngilizce entropiye bir tavan koydu.

Shannon 1951'de bunu yaptı ve bu alanı hala yönetiyen bir sayı aldı. 27 sembollü bir alfabenin (26 harf artı boşluk) taşıyabileceği bir sayı.`log2(27) ≈ 4.75`Bu nedenle, bir modelin öğrenmesi gereken yapı, herhangi bir model öğrenmeden önce ölçülmüştür.

O zamandan beri her dil modeli bu oyunun mekanik bir oyuncusu ve bu dersdeki her değerlendirme numarası da oyunun puanladığı sayı:

- **Cross-entropy loss**Bir LM'yi eğitmek, tahmin oyununda puanını azaltacak.
- **Perplexity**- Evet .`2^bits`(veya `e^nats`): modelin tahmininden sonra hala karşı karşıya olduğu dalgalama faktörü. 27 sembolden fazla teker teker tahmin etmek 27 karmaşıklığa sahiptir; bir harf başına 1 bit oynatıcının karmaşıklığı vardır 2.
- **Context length is the player's memory.**Bir trigram modeli iki hafıza jetonu ile oynar. Bir transformatör aynı oyunu 100K jetonu ile oynar. Kurallar asla değişmez. Oyuncu daha iyi olur.

Bir birimden bir parça: oyun harf başına bitler (`log2`), aşağıdaki n-gram formüller ise nats (doğal log)  ve karmaşıklıktan sonra sözcük başına puan verir.`e^H`- Evet .`2^H`Bitlerdeki iki görüntü farklı birimlerde aynı ölçümdür.

```figure
prediction-game
```

**N-gram probability:** `P(w_i | w_{i-n+1}, ..., w_{i-1})`- Düzelt .`n`(genellikle üç, dört gram için dört) Sayılardan hesaplayın:

```math
P(w \mid \text{context}) = \frac{\mathop{\mathrm{count}}(\text{context}, w)}{\mathop{\mathrm{count}}(\text{context})}
```

**The zero-count problem.**Eğitimde görülmeyen herhangi bir n-gram, olasılık sıfır elde eder. Brown corpus üzerinde 2007 yılında yapılan bir çalışmada, 4 gramlı bir model bile eğitimde görülmemiş 4 gramın %30'unu elde ettiğini bulmuştur.

**Smoothing approaches, in order of sophistication:**

1. **Laplace (add-one).**Her sayıya bir ekle.
2. **Good-Turing.**Daha yüksek frekanslı olaylardan görülmeyen olaylara olasılık kütlesini frekans frekanslarına göre yeniden tahsis et.
3. **Interpolation.**N-gram, (n-1)-gram, vb. tahminleri ayarlanabilir ağırlıklar ile birleştirin.
4. **Backoff.**Eğer n-gram sıfır sayıyorsa, (n-1) -gram'a geri düşersiniz.
5. **Absolute discounting.**Sıkı bir indirim çıkar `D`Her sayıdan, görünmeyenlere dağıtmak.
6. **Kneser-Ney.**Kesin indirim ve aşağı sıralama modeli için akıllı bir seçim: * devam olasılığı* (bir kelime kaç bağlamda görünür) kullanmak yerine çiğ frekans.

Kneser-Ney'in anlayışı derin. "San Francisco" da sıradan bir büyüklük. "Francisco" unigramı çoğunlukla "San. " Naive mutlak indirim "Francisco" yüksek unigram olasılığı verir (çünkü sayım yüksek). Kneser-Ney, "Francisco"'nun yalnızca bir bağlamda ortaya çıktığını ve devam olasılığını buna göre azaltdığını belirtir. Sonuç: "Francisco" ile biten bir roman büyüklüğü uygun düşük olasılık elde eder.

**Evaluation: perplexity.**Bir test setinde bir kelime başına ortalama negatif log olasılığının göstergesi. Daha düşük daha iyidir. 100'in karmaşıklığı, modelin 100 kelime arasında eşit seçtiği kadar karışık olduğu anlamına gelir.

```math
\text{perplexity} = \exp\left(-\frac{1}{N} \sum_i \log P(w_i \mid \text{context}_i)\right)
```

```figure
ngram-backoff
```

## Yapın

### Adım 1: Trigram sayıları

```python
from collections import Counter, defaultdict


def train_ngram(corpus_tokens, n=3):
    ngrams = Counter()
    contexts = Counter()
    for sentence in corpus_tokens:
        padded = ["<s>"] * (n - 1) + sentence + ["</s>"]
        for i in range(len(padded) - n + 1):
            ctx = tuple(padded[i:i + n - 1])
            word = padded[i + n - 1]
            ngrams[ctx + (word,)] += 1
            contexts[ctx] += 1
    return ngrams, contexts


def raw_probability(ngrams, contexts, context, word):
    ctx = tuple(context)
    if contexts.get(ctx, 0) == 0:
        return 0.0
    return ngrams.get(ctx + (word,), 0) / contexts[ctx]
```

Giriş, simge edilen cümlelerin bir listesi. Çıktı n-gram sayılar ve bağlam sayılardır. `<s>`ve `</s>`cümle sınırları.

### Adım 2: Laplace düzeltme

```python
def laplace_probability(ngrams, contexts, vocab_size, context, word):
    ctx = tuple(context)
    numerator = ngrams.get(ctx + (word,), 0) + 1
    denominator = contexts.get(ctx, 0) + vocab_size
    return numerator / denominator
```

Her sayıya 1 ekleyin. Gözden geçirilmeyen olaylara kütle ayırır, nadir bilinen olaylara da zarar verir.

### Adım 3: Kneser-Ney (bigram, interpolasyon)

```python
def kneser_ney_bigram_model(corpus_tokens, discount=0.75):
    unigrams = Counter()
    bigrams = Counter()
    unigram_contexts = defaultdict(set)

    for sentence in corpus_tokens:
        padded = ["<s>"] + sentence + ["</s>"]
        for i, w in enumerate(padded):
            unigrams[w] += 1
            if i > 0:
                prev = padded[i - 1]
                bigrams[(prev, w)] += 1
                unigram_contexts[w].add(prev)

    total_unique_bigrams = sum(len(ctx_set) for ctx_set in unigram_contexts.values())
    continuation_prob = {
        w: len(ctx_set) / total_unique_bigrams for w, ctx_set in unigram_contexts.items()
    }

    context_totals = Counter()
    for (prev, w), count in bigrams.items():
        context_totals[prev] += count

    unique_follow = defaultdict(set)
    for (prev, w) in bigrams:
        unique_follow[prev].add(w)

    def prob(prev, w):
        count = bigrams.get((prev, w), 0)
        denom = context_totals.get(prev, 0)
        if denom == 0:
            return continuation_prob.get(w, 1e-9)
        first_term = max(count - discount, 0) / denom
        lambda_prev = discount * len(unique_follow[prev]) / denom
        return first_term + lambda_prev * continuation_prob.get(w, 1e-9)

    return prob
```

Üç hareketli parça.`continuation_prob`Bu kelime kaç farklı bağlamda ortaya çıkıyor? (Kneser-Ney yeniliği).`lambda_prev`Bu, indirimle serbest bırakılan kütle, geri çekimi ağırlaştırmak için kullanılır.

### Adım 4: Örnekleme ile metin oluşturmak

```python
import random


def generate(prob_fn, vocab, prefix, max_len=30, seed=0):
    rng = random.Random(seed)
    tokens = list(prefix)
    for _ in range(max_len):
        candidates = [(w, prob_fn(tokens[-1], w)) for w in vocab]
        total = sum(p for _, p in candidates)
        r = rng.random() * total
        acc = 0.0
        for w, p in candidates:
            acc += p
            if r <= acc:
                tokens.append(w)
                break
        if tokens[-1] == "</s>":
            break
    return tokens
```

Örnekleme olasılıkla orantılıdır. Her tohum için her zaman farklı bir çıkış verir. Balık arama benzeri çıkış için, her adımda argmax'i seçin (açık) ve küçük bir rastlantı düğmesi (temperatura) ekleyin.

### Adım 5: Kafası karışık

```python
import math


def perplexity(prob_fn, sentences):
    total_log_prob = 0.0
    total_tokens = 0
    for sentence in sentences:
        padded = ["<s>"] + sentence + ["</s>"]
        for i in range(1, len(padded)):
            p = prob_fn(padded[i - 1], padded[i])
            total_log_prob += math.log(max(p, 1e-12))
            total_tokens += 1
    return math.exp(-total_log_prob / total_tokens)
```

Daha düşük daha iyi. Brown corpus için, iyi ayarlanmış 4 gram KN modeli 140 civarında karmaşıklığa ulaşır.

## Kullan

- **Classical NLP teaching.**En net şekilde düzeltme, MLE ve karışıklığa maruz kalmak.
- **KenLM.**N-gram kütüphanesi. Düşük gecikme önemli olduğu konuşma ve MT sistemlerinde rescorer olarak kullanılır.
- **On-device autocomplete.**- Klavyelerde üçleme modeli var.
- **Baselines.**Eğer transformatörünüz KN'yi geniş bir kenara geçmezse, bir sorun var.

## Gönder

- Kaydet .`outputs/prompt-lm-baseline.md`- ...

```markdown
---
name: lm-baseline
description: Build a reproducible n-gram language model baseline before training a neural LM.
phase: 5
lesson: 16
---

Given a corpus and target use (next-word prediction, rescoring, perplexity baseline), output:

1. N-gram order. Trigram for general English, 4-gram if corpus is large, 5-gram for speech rescoring.
2. Smoothing. Modified Kneser-Ney is the default; Laplace only for teaching.
3. Library. `kenlm` for production, `nltk.lm` for teaching, roll your own only to learn.
4. Evaluation. Held-out perplexity with consistent tokenization between train and test sets.

Refuse to report perplexity computed with different tokenization between systems being compared — perplexity numbers are comparable only under identical tokenization. Flag OOV rate in test set; KN handles OOV poorly unless you reserve a special <UNK> token during training.
```

## Egzersizler

1. **Easy.**1000 cümlelik Shakespeare'in bir corpusunda bir trigram LM'yi eğit. 20 cümle oluşturun. Yerel olarak makul ama küresel olarak tutarlı olmayacaklar. Bu kanonik demo.
2. **Medium.**KN modeliniz için karmaşıklığı uzun süren Shakespeare'in bir bölümü üzerinde uygulayın. Laplace ile karşılaştırın.
3. **Hard.**Trigram yazma düzeltmeci oluşturun: yanlış yazılmış bir kelime ve bağlamı verildiğinde, LM'de bağlam olasılıkları doğrultusunda düzeltmeler oluşturun ve sıralayın. Birkbeck yazma corpusunda değerlendirin (özel).

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| N-gram | Word sequence | Sequence of `n` consecutive tokens. |
| Smoothing | Avoiding zeros | Reallocating probability mass so unseen events get non-zero probability. |
| Perplexity | LM quality metric | `exp(-average log-prob)` on held-out data. Lower is better. |
| Backoff | Fallback to shorter context | If trigram count is zero, use bigram. Katz backoff formalizes this. |
| Kneser-Ney | Best smoothing for n-grams | Absolute discounting + continuation probability for the lower-order model. |
| Continuation probability | KN-specific | `P(w)` weighted by number of contexts `w` appears in, not by raw count. |
| Entropy of text | Information per symbol | Average bits needed to encode the next symbol given the context. Shannon's 1951 estimate for printed English with up to 100 letters of context: 0.6-1.3 bits/letter, measured before any model existed. |

## Daha Fazla Okumak

- [Shannon (1951). Prediction and Entropy of Printed English](https://www.princeton.edu/~wbialek/rome/refs/shannon_51.pdf) hedef tanımlayan tahmin oyunu deneyi her dil modeli hala optimize eder.
- [Jurafsky and Martin — Speech and Language Processing, Chapter 3 (2026 draft)](https://web.stanford.edu/~jurafsky/slp3/3.pdf) n-gram LM'lerin kanonik tedavisi ve düzeltmesi.
- [Chen and Goodman (1998). An Empirical Study of Smoothing Techniques for Language Modeling](https://dash.harvard.edu/handle/1/25104739)Kneser-Ney'i en iyi n-gram daha düzgün olan kağıdı.
- [Kneser and Ney (1995). Improved Backing-off for M-gram Language Modeling](https://ieeexplore.ieee.org/document/479394) orijinal KN kağıdı.
- [KenLM](https://kheafield.com/code/kenlm/) hızlı üretim n-gram LM, 2026'da hala gecikme hassas uygulamalarda kullanılır.
