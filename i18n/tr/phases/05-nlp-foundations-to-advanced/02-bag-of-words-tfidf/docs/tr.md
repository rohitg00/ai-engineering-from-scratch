# Sözcükler, TF-IDF ve Metin Temsil

> TF-IDF, 2026'da da iyi tanımlanmış görevlerde yerleşimleri yenmeye devam ediyor.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 01 (Text Processing), Phase 2 · 02 (Linear Regression from Scratch)
**Time:** ~75 minutes

## Sorun

Model numaralara ihtiyacı var.

Her NLP boru hattı aynı soruya cevap vermeli. Değişken uzunluklı bir token akışını bir sınıflandırıcı tarafından tüketilebilecek sabit boyutlu bir vektöre nasıl dönüştürebiliriz. Alanın ilk verdiği cevap işe yarayan en aptalca cevaptı. Sözleri sayın.

Bu vektör, herhangi bir yerleştirme modeliyle karşılaştırıldığında daha fazla üretim NLP taşıdı. Spam filtreleri, konu sınıflandırıcıları, kayıt anomali tespitleri, arama sıralaması (BM25'den önce), duygu analizinin ilk dalgası, akademik NLP referanslarının ilk on yılı. 2026 uygulayıcıları, dar sınıflandırma görevlerinde hala ilk olarak ulaşmaktadır. Sözcük varlığı önemli olan görevlerde 400M-parametrli bir gömleyici modelinden hızlı, yorumlanabilir ve sıklıkla ayırt edilemez.

Bu ders, sıfırdan kelimelerden bir çanta oluşturur, sonra TF-IDF, sonra üç satırda aynı şeyi yapan bir scikit-learn gösterir. Sonra yerleşimlere ulaşmanızı sağlayan başarısızlık modunu adlandırır.

## Anlaşım

**Bag of Words (BoW)**Her belge için, her kelime birikimi kelimesinin kaç kez ortaya çıktığını sayın.`i`kelimelerin sayımıdır.`i`- Evet .

**TF-IDF**Bu, bir tek belgeye ait bir kelime, yani bir sinyal, yani bir kelime.

```math
\begin{aligned}
\text{TF-IDF}(w, d) &= \text{TF}(w, d) \cdot \text{IDF}(w) \\
&= \frac{\mathop{\mathrm{count}}(w \text{ in } d)}{|d|} \cdot \log\frac{N}{\mathop{\mathrm{df}}(w)}
\end{aligned}
```

Nerede ?`TF`belgede terim sıklığıdır, `df`belgelerin sıklığı (sözü içeren kaç belge),`N`Bu, toplam belgeler.`log`Her yerde bulunan kelimelerin ağırlığını sınırlı tutar.

Ana özellik: her ikisi de yorumlanabilir eksilerle nadir vektörler üretir. Eğitimli bir sınıflandırıcının ağırlıklarına bakabilir ve hangi kelimeleri her sınıfın yönüne doğru bir belgeyi itiyor okuyabilirsiniz. Bunu 768 boyutlu bir BERT gömleği ile yapamazsınız.

```figure
bow-tfidf
```

## Yapın

### Adım 1: Sözlük birikimi oluşturun

```python
def build_vocab(docs):
    vocab = {}
    for doc in docs:
        for token in doc:
            if token not in vocab:
                vocab[token] = len(vocab)
    return vocab
```

Giriş: Tokenized belgeler listesini (her kelime seviyesindeki tokenizer yapacaktır; `code/main.py`Bu ders basitleştirilmiş küçük harflerle kullanılır.`{word: index}`Dict. Stabil ekleme sırası, sözcük indeksi 0'nın ilk belgede görülen ilk kelime olduğunu gösterir.

### Adım 2: Sözler çanta

```python
def bag_of_words(docs, vocab):
    matrix = [[0] * len(vocab) for _ in docs]
    for i, doc in enumerate(docs):
        for token in doc:
            if token in vocab:
                matrix[i][vocab[token]] += 1
    return matrix
```

```python
>>> docs = [["cat", "sat", "on", "mat"], ["cat", "cat", "ran"]]
>>> vocab = build_vocab(docs)
>>> bag_of_words(docs, vocab)
[[1, 1, 1, 1, 0], [2, 0, 0, 0, 1]]
```

Satırlar belge, sütunlar sözlük indeksleri.`[i][j]`"Ne kadar defa sözcük"`j`Belgede görünmektedir `i`Dok. 1'nin yaptığı.`cat`- Doktor, iki kez oldu.`ran`- Hayır, çünkü sıfır.

### Adım 3: Sözleşme sıklığı ve belge sıklığı

```python
import math


def term_frequency(doc_bow, doc_length):
    return [c / doc_length if doc_length else 0 for c in doc_bow]


def document_frequency(bow_matrix):
    df = [0] * len(bow_matrix[0])
    for row in bow_matrix:
        for j, count in enumerate(row):
            if count > 0:
                df[j] += 1
    return df


def inverse_document_frequency(df, n_docs):
    return [math.log((n_docs + 1) / (d + 1)) + 1 for d in df]
```

İki tane düzeltme numarasını anmaya değer.`(n+1)/(d+1)`kaçınılması `log(x/0)`- Arka tarafta .`+1`Bu, her belgedeki bir kelimeyi hâlâ IDF 1 (değil 0) olarak oluşturur ve scikit-learn'ın öntanımlı metniyle eşleşir.`log(N/df)`Her ikisi de çalışır, düzeltilmiş versiyon daha dostça.

### 4. Adım: TF-IDF

```python
def tfidf(bow_matrix):
    n_docs = len(bow_matrix)
    df = document_frequency(bow_matrix)
    idf = inverse_document_frequency(df, n_docs)
    out = []
    for row in bow_matrix:
        length = sum(row)
        tf = term_frequency(row, length)
        out.append([tf_j * idf_j for tf_j, idf_j in zip(tf, idf)])
    return out
```

```python
>>> docs = [
...     ["the", "cat", "sat"],
...     ["the", "dog", "sat"],
...     ["the", "cat", "ran"],
... ]
>>> vocab = build_vocab(docs)
>>> bow = bag_of_words(docs, vocab)
>>> tfidf(bow)
```

Üç belge, beş kelime kelime (`the`- Evet .`cat`- Evet .`sat`- Evet .`dog`- Evet .`ran` ).`the`Üçünde de görülüyor, bu yüzden IDF'si düşük.`dog`Bu, bir kez daha çok sözcüklü bir kelime ve bu vektörlerin sayısı çok azdır.

### Adım 5: L2- sırayı normalleştir

```python
def l2_normalize(matrix):
    out = []
    for row in matrix:
        norm = math.sqrt(sum(x * x for x in row))
        out.append([x / norm if norm else 0 for x in row])
    return out
```

Normalleşme olmadan, daha uzun bir belge daha büyük bir vektör alır ve benzerlik puanlarına hakim olur. L2 normalleşmesi her belgeyi birim hipersferine yerleştirir.

## Kullan

Scikit-Learn üretim versiyonunu gönderir.

```python
from sklearn.feature_extraction.text import CountVectorizer, TfidfVectorizer

docs = ["the cat sat on the mat", "the dog sat on the mat", "the cat ran"]

bow_vectorizer = CountVectorizer()
bow = bow_vectorizer.fit_transform(docs)
print(bow_vectorizer.get_feature_names_out())
print(bow.toarray())

tfidf_vectorizer = TfidfVectorizer()
tfidf = tfidf_vectorizer.fit_transform(docs)
print(tfidf.toarray().round(3))
```

`CountVectorizer`Tek bir çağrıda işaretleme, kelime depolama ve BoW yapar. `TfidfVectorizer`Bu sayede, L2 normalleştirme ve IDF ağırlığı eklenir. Her ikisi de nadir matrisler gönderir. 100k belgeler için, yoğun versiyon hafıza girmez; sınıflandırıcı yoğun talep edene kadar nadir kalır.

Her şeyi değiştiren düğmeler:

| Arg | Effect |
|-----|--------|
| `ngram_range=(1, 2)` | Include bigrams. Usually boosts classification. |
| `min_df=2` | Drop words in fewer than 2 docs. Trims vocabulary on noisy data. |
| `max_df=0.95` | Drop words in more than 95% of docs. Approximates stopword removal without a hardcoded list. |
| `stop_words="english"` | scikit-learn's builtin stopword list. Task-dependent — sentiment analysis should *not* drop negations. |
| `sublinear_tf=True` | Use `1 + log(tf)` instead of raw `tf`. Helps when a term repeats many times in one doc. |

### TF-IDF hala kazanırken (2026 itibariyle)

- Spam tespit, konu etiketleme, kayıt anomali işaretleme.
- Düşük veri rejimleri (yüzlerce etiketlenen örnek). TF-IDF artı lojistik geri dönüşü, eğitim öncesi maliyetlere sahip değildir.
- TF-IDF artı bir çizgisi model mikrosekundada cevap verir.
- Bu sistemler tahminlerini açıklamalı, sınıflandırıcının katılıklarını incelemeli, en iyi kelimeler neden oluyor.

### TF-IDF'nin başarısız olması

Semantik körlük başarısızlığı.

- "Film hiç de iyi değildi".
- "Film mükemmeldi".

Birincisi olumlu, birincisi olumlu, TF-IDF üst üstelik tam olarak aynı.`{the, movie, was}`Bir kelime kese sınıflandırıcısı bu kelimeyi ezberlemesi gerekir .`not`Yakınlıkta`good`Bunu yeterli veriyle öğrenebilir ama sözcük anlamlı bir model kadar zarif bir şekilde asla.

Diğer başarısızlık: Sözcük kaynağı dışındaki kelimeler sonucu. IMDb incelemelerinde eğitilmiş bir BoW modeli neyle uğraşacaklarını bilmiyor `Zoomer-approved`Bu, bir eğitim sırasında hiç ortaya çıkmamış bir token olarak görülür.

### Hibrit: TF-IDF ağırlıklı yerleştirmeler

Ortalama veri sınıflandırması için 2026 pragmatik varsayım: sözcük yerleştirmelerine dikkat etmek için TF-IDF ağırlıklarını kullanın.

```python
def tfidf_weighted_embedding(doc, tfidf_scores, embedding_table, dim):
    vec = [0.0] * dim
    total_weight = 0.0
    for token in doc:
        if token not in embedding_table or token not in tfidf_scores:
            continue
        weight = tfidf_scores[token]
        emb = embedding_table[token]
        for i in range(dim):
            vec[i] += weight * emb[i]
        total_weight += weight
    if total_weight == 0:
        return vec
    return [v / total_weight for v in vec]
```

Bu, duygu, konu ve niyet sınıflandırması için kendi başına 50k etiketli örnekten daha düşük performans gösterir.

## Gönder

- Kaydet .`outputs/prompt-vectorization-picker.md`- ...

```markdown
---
name: vectorization-picker
description: Given a text-classification task, recommend BoW, TF-IDF, embeddings, or a hybrid.
phase: 5
lesson: 02
---

You recommend a text-vectorization strategy. Given a task description, output:

1. Representation (BoW, TF-IDF, transformer embeddings, or a hybrid). Explain why in one sentence.
2. Specific vectorizer configuration. Name the library. Quote the arguments (`ngram_range`, `min_df`, `max_df`, `sublinear_tf`, `stop_words`).
3. One failure mode to test before shipping.

Refuse to recommend embeddings when the user has under 500 labeled examples unless they show evidence of semantic failure in a TF-IDF baseline. Refuse to remove stopwords for sentiment analysis (negations carry signal). Flag class imbalance as needing more than a vectorizer change.

Example input: "Classifying 30k customer support tickets into 12 categories. Most tickets are 2-3 sentences. English only. Need explainability for audit logs."

Example output:

- Representation: TF-IDF. 30k examples is not small; explainability requirement rules out dense embeddings.
- Config: `TfidfVectorizer(ngram_range=(1, 2), min_df=3, max_df=0.95, sublinear_tf=True, stop_words=None)`. Keep stopwords because category keywords sometimes are stopwords ("not working" vs "working").
- Failure to test: verify `min_df=3` does not drop rare category keywords. Run `get_feature_names_out` filtered by class and eyeball.
```

## Egzersizler

1. **Easy.**Uygulama`cosine_similarity(doc_vec_a, doc_vec_b)`L2 normallaştırılmış TF-IDF çıkışında. Aynı belgelerin 1.0 puanı ve ayrılmış sözcüklük belgeleri ise 0.0 puanı verilir.
2. **Medium.**Ekle`n-gram``bag_of_words`Parametre .`n`Üretir sayılar `n`- Gram, bunu test et.`n=2`- Evet .`["the", "cat", "sat"]`Büyük bir miktar hesaplar üretir.`["the cat", "cat sat"]`- Evet .
3. **Hard.**Yukarıda bulunan TF-IDF ağırlıklı gömülü hibridini GloVe 100d vektörleri kullanarak oluşturun (bir kez indir, önbelleğe). 20 Newsgroups veri kümesindeki sıradan TF-IDF ve sıradan ortalama birleştirilmiş gömülmelerle sınıflandırma doğruluğunu karşılaştırın.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| BoW | Word frequency vector | Counts of vocabulary words in one document. Throws away order. |
| TF | Term frequency | Count of a word in a document, optionally normalized by document length. |
| DF | Document frequency | Count of documents containing the word at least once. |
| IDF | Inverse document frequency | `log(N / df)` smoothed. Downweights words that appear everywhere. |
| Sparse vector | Mostly zeros | Vocabulary is typically 10k-100k words; most are absent from any given document. |
| Cosine similarity | Vector angle | Dot product of L2-normalized vectors. 1 is identical, 0 is orthogonal. |

## Daha Fazla Okumak

- [scikit-learn — feature extraction from text](https://scikit-learn.org/stable/modules/feature_extraction.html#text-feature-extraction) Kanonik API referansı, her düğmeye notlar eklenir.
- [Salton, G., & Buckley, C. (1988). Term-weighting approaches in automatic text retrieval](https://www.sciencedirect.com/science/article/pii/0306457388900210) TF-IDF'yi on yıl boyunca geri dönüş yapan kağıt.
- ["Why TF-IDF Still Beats Embeddings" — Ashfaque Thonikkadavan (Medium)](https://medium.com/@cmtwskb/why-tf-idf-still-beats-embeddings-ad85c123e1b2) 2026'da eski yöntemin ne zaman ve neden kazanması gerekiyor.
