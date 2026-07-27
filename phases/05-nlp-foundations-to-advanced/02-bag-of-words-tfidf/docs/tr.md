# Kelime Torbası, TF-IDF ve Metin Gösterimi

> Önce sayın, sonra düşünün. TF-IDF, 2026'da iyi tanımlanmış görevlerde hala embedding'leri geride bırakıyor.

**Tür:** Yapım
**Diller:** Python
**Önkoşullar:** Aşama 5 · 01 (Metin İşleme), Aşama 2 · 02 (Sıfırdan Doğrusal Regresyon)
**Süre:** ~75 dakika

## Sorun

Modelin sayılara ihtiyacı var. İpleriniz var.

Her NLP boru hattının aynı soruyu yanıtlaması gerekir. Değişken uzunluktaki bir token akışını, bir sınıflandırıcının tüketebileceği sabit boyutlu bir vektöre nasıl dönüştürürüz? Alanın ulaştığı ilk cevap, işe yarayan en aptalca cevaptı. Kelimeleri say. Bir vektör yapın.

Bu vektör herhangi bir embedding modelinden daha fazla üretim NLP'si taşıdı. Spam filtreleri, konu sınıflandırıcıları, günlük anormallik tespiti, arama sıralaması (BM25'ten önce), duygu analizinin ilk dalgası, akademik NLP benchmark'lerin ilk on yılı. 2026 uygulayıcı dar sınıflandırma görevlerinde hâlâ ilk sırada yer alıyor. Kelime varlığının önemli olduğu görevlerde hızlıdır, yorumlanabilir ve genellikle 400M parametreli embedding modelinden ayırt edilemez.

Bu derste bir torba dolusu kelime ve ardından TF-IDF sıfırdan oluşturuluyor. Daha sonra scikit-learn'in aynı şeyi üç satırda yaptığını gösterir. Daha sonra embedding'lere erişmenizi sağlayan arıza modunu adlandırın.

## Konsept

**Bag of Word (BoW)** düzeni ortadan kaldırır. Her belge için, her bir kelime sözcüğünün kaç kez göründüğünü sayın. Vektör uzunluğu kelime büyüklüğüdür. `i` konumu, `i` kelimesinin sayısıdır.

**TF-IDF** BoW'u yeniden ağırlıklandırıyor. Her belgede görünen bir kelime bilgi verici değildir, bu nedenle onu küçültün. Tümcede nadir bulunan ancak tek bir belgede sık görülen bir kelime sinyaldir; bu nedenle ölçeği büyütün.

```
TF-IDF(w, d) = TF(w, d) * IDF(w)
             = count(w in d) / |d| * log(N / df(w))
```

`TF` belgedeki terim sıklığıdır, `df` belge sıklığıdır (kelimeyi kaç belge içerir), `N` toplam belgedir. `log`, her yerde bulunan kelimelerin ağırlığını sınırlı tutar.

Anahtar özellik: her ikisi de yorumlanabilir eksenlere sahip seyrek vektörler üretir. Eğitimli bir sınıflandırıcının ağırlıklarına bakabilir ve hangi kelimelerin bir belgeyi her bir sınıfa ittiğini okuyabilirsiniz. Bunu 768 boyutlu bir BERT embedding ile yapamazsınız.

```figure
bow-tfidf
```

## İnşa Et

### 1. Adım: Kelime dağarcığını oluşturun

```python
def build_vocab(docs):
    vocab = {}
    for doc in docs:
        for token in doc:
            if token not in vocab:
                vocab[token] = len(vocab)
    return vocab
```

Giriş: tokenleştirilmiş belgelerin listesi (herhangi bir kelime düzeyinde tokenizer işe yarar; bu dersteki `code/main.py`, basitleştirilmiş bir küçük harf çeşidi kullanır). Çıktı: `{word: index}` dict. Kararlı ekleme sırası, kelime dizini 0'ın ilk belgede görülen ilk kelime olduğu anlamına gelir. Sözleşme değişiklik gösterir; scikit-learn alfabetik olarak sıralar.

### Adım 2: kelime çantası

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

Satırlar belgelerdir. Sütunlar kelime dizinleridir. `[i][j]` girişi, "`i` belgesinde `j` kelimesinin kaç kez göründüğüdür." Doküman 1'de iki kez `cat` var çünkü öyleydi. Doküman 0'da `ran` sıfır kez var çünkü yoktu.

### Adım 3: terim sıklığı ve belge sıklığı

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

Adlandırmaya değer iki yumuşatma numarası. `(n+1)/(d+1)`, `log(x/0)`'yi önler. Sondaki `+1`, her belgedeki bir kelimenin hala scikit-learn'in varsayılanıyla eşleşen IDF 1'e (0 değil) sahip olmasını sağlar. Diğer uygulamalar ham `log(N/df)` kullanır. Her ikisi de işe yarar; düzeltilmiş versiyon daha dost canlısıdır.

### Adım 4: TF-IDF

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

Üç belge, beş kelime kelimesi (`the`, `cat`, `sat`, `dog`, `ran`). `the` üçünde de görünüyor, dolayısıyla IDF'si düşük. `dog` bir tanesinde göründüğünden IDF'si yüksektir. Vektörler seyrektir (girişlerin çoğu küçüktür) ve ayırt edici sözcükler öne çıkar.

### Adım 5: L2-satırları normalleştirin

```python
def l2_normalize(matrix):
    out = []
    for row in matrix:
        norm = math.sqrt(sum(x * x for x in row))
        out.append([x / norm if norm else 0 for x in row])
    return out
```

Normalleştirme olmadan, daha uzun bir belge daha büyük bir vektöre sahip olur ve benzerlik puanlarına hakim olur. L2 normalizasyonu her belgeyi birim hiperküresine yerleştirir. Satırlar arasındaki kosinüs benzerliği artık yalnızca bir nokta çarpımdır.

## Kullan onu

scikit-learn üretim versiyonunu gönderiyor.

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

`CountVectorizer`, tek aramada tokenizasyon, kelime dağarcığı ve BoW işlemlerini yapar. `TfidfVectorizer`, IDF ağırlıklandırmasını ve L2 normalizasyonunu ekler. Her ikisi de seyrek matrisler döndürür. 100 bin belge için yoğun sürüm belleğe sığmaz; sınıflandırıcı yoğun talep edene kadar seyrek kalın.

Her şeyi değiştiren düğmeler:

| Arg | Efekt |
|-----|--------|
| `ngram_range=(1, 2)` | Bigramları dahil edin. Genellikle sınıflandırmayı artırır. |
| `min_df=2` | Kelimeleri 2'den az belgeye bırakın. Gürültülü verilerle ilgili kelime dağarcığını kısaltır. |
| `max_df=0.95` | Dokümanların %95'inden fazlasında sözcükleri bırakın. Sabit kodlanmış bir liste olmadan engellenecek kelime kaldırma işlemini yaklaşık olarak gerçekleştirir. |
| `stop_words="english"` | scikit-learn'in yerleşik engellenecek kelime listesi. Göreve bağlı — duygu analizi, olumsuzlukları *düşürmemelidir*. |
| `sublinear_tf=True` | Ham `tf` yerine `1 + log(tf)` kullanın. Bir terimin bir belgede birçok kez tekrarlanması durumunda yardımcı olur. |

### TF-IDF hala kazandığında (2026 itibariyle)

- Spam tespiti, konu etiketleme, günlük anormalliklerini işaretleme. Önemli olan kelimenin varlığıdır; anlamsal nüans yoktur.
- Düşük veri rejimleri (yüzlerce etiketli örnek). TF-IDF artı lojistik regresyonun ön eğitim maliyeti yoktur.
- Gecikmenin önemli olduğu her yerde. TF-IDF artı doğrusal bir model mikrosaniyeler içinde yanıt verir. Embedding transformer aracılığıyla bir belge 10-100ms sürer.
- Tahminlerini açıklaması gereken sistemler. Sınıflandırıcının katsayılarını inceleyin. Bunun nedeni en iyi olumlu kelimelerdir.

### TF-IDF başarısız olduğunda

Anlamsal körlük başarısızlığı. Şu iki belgeyi düşünün:

- "Film hiç iyi değildi."
- "Film mükemmeldi."

Bunlardan biri olumsuz bir eleştiri. Biri olumlu. TF-IDF örtüşmeleri tam olarak `{the, movie, was}`'dir. Bir kelime torbası sınıflandırıcısının, `good` yakınındaki `not` kelimesinin etiketi çevirdiğini ezberlemesi gerekir. Bunu yeterli veriyle öğrenebilir, ancak asla sözdizimini anlayan bir model kadar zarif bir şekilde öğrenemez.

Diğer başarısızlık: inference'de sözcük dağarcığı dışında kalan kelimeler. IMDb incelemeleri üzerine eğitilmiş bir BoW modelinin, token eğitimde hiç görünmediyse `Zoomer-approved` ile ne yapacağına dair hiçbir fikri yoktur. Alt kelime embedding'ler (ders 04) bunu halleder. TF-IDF bunu yapamaz.

### Hibrit: TF-IDF ağırlıklı embedding'ler

Orta düzey veri sınıflandırması için 2026 pragmatik varsayılanı: embedding kelimesine dikkat etmek için TF-IDF ağırlıklarını kullanın.

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

embedding'lerden anlamsal kapasite ve TF-IDF'den nadir kelime vurgusu elde edersiniz. Sınıflandırıcı, havuzlanmış vektör üzerinde eğitim alır. Bu, yaklaşık 50 bin etiketli örneğin altındaki duyarlılık, konu ve amaç sınıflandırması açısından tek başına daha iyi performans gösteriyor.

## Gönderin

`outputs/prompt-vectorization-picker.md` olarak kaydet:

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

1. **Kolay.** `cosine_similarity(doc_vec_a, doc_vec_b)`'yi L2 normalleştirilmiş TF-IDF çıkışına uygulayın. Aynı belgelerin 1,0, ayrık sözcükler içeren belgelerin ise 0,0 puan aldığını doğrulayın.
2. **Orta.** `bag_of_words`'ye `n-gram` desteği ekleyin. `n` parametresi `n` gramın üzerinde sayımlar üretir. `["the", "cat", "sat"]` üzerindeki `n=2`'nin `["the cat", "cat sat"]` için bigram sayımları ürettiğini test edin.
3. **Zor.** GloVe 100d vektörlerini kullanarak yukarıdaki TF-IDF ağırlıklı-embedding hibritini oluşturun (bir kez indirin, önbellek). Sınıflandırma doğruluğunu, 20 dataset Haber Grubundaki düz TF-IDF ve düz ortalama havuzlu embedding'lerle karşılaştırın. Hangisinin nerede kazandığını bildirin.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|-----------------|-----------------------|
| Yay | Kelime frekans vektörü | Tek bir belgedeki kelime kelimelerinin sayısı. Siparişi çöpe atıyor. |
| TF | Dönem sıklığı | İsteğe bağlı olarak belge uzunluğuna göre normalleştirilmiş bir belgedeki bir kelimenin sayısı. |
| DF | Belge sıklığı | Kelimeyi en az bir kez içeren belgelerin sayısı. |
| IDF | Ters belge sıklığı | `log(N / df)` düzeltildi. Her yerde görünen kelimeleri hafifletir. |
| Seyrek vektör | Çoğunlukla sıfırlar | Kelime dağarcığı genellikle 10 bin ila 100 bin kelimeden oluşur; çoğu herhangi bir belgede yoktur. |
| Kosinüs benzerliği | Vektör açısı | L2-normalize vektörlerin nokta çarpımı. 1 aynıdır, 0 diktir. |

## Daha Fazla Okuma

- [scikit-learn — metinden özellik çıkarma](https://scikit-learn.org/stable/modules/feature_extraction.html#text-feature-extraction) — standart API referansı ve her düğmeyle ilgili notlar.
- [Salton, G. ve Buckley, C. (1988). Otomatik metin alımında terim ağırlıklandırma yaklaşımları](https://www.sciencedirect.com/science/article/pii/0306457388900210) — TF-IDF'yi on yıl boyunca varsayılan yapan makale.
- ["TF-IDF Neden Embedding'leri Hala Yeniyor" — Ashfaque Thonikkadavan (Medium)](https://medium.com/@cmtwskb/why-tf-idf-still-beats-embeddings-ad85c123e1b2) — 2026, eski yöntemin ne zaman kazanacağını ve nedenini ele alacak.
