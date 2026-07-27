# Word Embeddings — Sıfırdan Word2Vec

> Bir kelime, sahip olduğu arkadaşlıktır. Bu fikrin üzerine sığ bir ağ çizdiğinizde geometri ortaya çıkar.

**Tür:** Yapım
**Diller:** Python
**Önkoşullar:** Aşama 5 · 02 (BoW + TF-IDF), Aşama 3 · 03 (Scratch'ten Backpropagation)
**Süre:** ~75 dakika

## Sorun

TF-IDF, `dog` ve `puppy`'nin farklı kelimeler olduğunu biliyor. Neredeyse aynı şeyi kastettiklerini bilmiyor. `dog` konusunda eğitilmiş bir sınıflandırıcı, `puppy` hakkındaki bir incelemeye genelleme yapamaz. Eş anlamlıları listeleyerek bu konuyu gözden geçirebilirsiniz, ancak bu nadir terimler, alan adı jargonu ve beklemediğiniz her dilde başarısız olur.

`dog` ve `puppy`'nin uzayda birbirine yakın konumlandığı bir temsil istiyorsunuz. `king - man + woman`'nin `queen` yakınına indiği yer. `dog` üzerinde eğitilmiş bir modelin, bazı sinyalleri ücretsiz olarak `puppy`'ye aktardığı yer.

Word2Vec bize bu alanı verdi. İki katmanlı neural network, trilyon token eğitim çalıştırmaları, 2013'te yayınlandı. Mimari neredeyse utanç verici derecede basittir. Sonuçlar NLP'yi on yıl boyunca yeniden şekillendirdi.

## Konsept

**Dağıtım hipotezi** (Firth, 1957): "Bir kelimeyi, içinde bulunduğu şirkete göre bileceksin." Eğer iki kelime benzer bağlamlarda geçiyorsa muhtemelen benzer şeyleri ifade ediyorlar.

Word2Vec'in her ikisi de bu fikirden yararlanan iki çeşidi vardır.

- **Gram atla.** Ortadaki bir kelime verildiğinde, onu çevreleyen kelimeleri tahmin edin. Pencere boyutu 2 olan `cat -> (the, sat, on)`.
- **CBOW (sürekli kelime çantası).** Çevreleyen kelimelere göre merkezi tahmin edin. `(the, sat, on) -> cat`.

Skip-gram'ın eğitimi daha yavaştır ancak nadir kelimeleri daha iyi işler. Varsayılan haline geldi.

Ağın doğrusal olmayan bir özelliği olmayan bir gizli katmanı vardır. Girdi, sözcük dağarcığı üzerinde tek-sıcak bir vektördür. Çıktı, kelime dağarcığı üzerinde bir softmax'tır. Eğitimden sonra çıktı katmanını atarsınız. Gizli katman ağırlıkları embedding'dir.

```
one-hot(center) ── W ──▶ hidden (d-dim) ── W' ──▶ softmax(vocab)
                          ^
                          this is the embedding
```

İşin püf noktası: 100 bin kelimenin üzerindeki softmax, aşırı derecede pahalıdır. Word2Vec, bunu ikili sınıflandırma görevine dönüştürmek için **negatif örneklemeyi** kullanır. "Bu bağlamsal kelime bu merkez kelimenin yakınında mı göründü, evet mi hayır mı?" tahmininde bulunun. Kelime dağarcığının tamamı üzerinde softmax hesaplamak yerine, eğitim çifti başına bir avuç negatif (birlikte oluşmayan) kelimeyi örnekleyin.

```figure
word-vector-arithmetic
```

## İnşa Et

### Adım 1: bir korpustaki çiftleri eğitmek

```python
def skipgram_pairs(docs, window=2):
    pairs = []
    for doc in docs:
        for i, center in enumerate(doc):
            for j in range(max(0, i - window), min(len(doc), i + window + 1)):
                if i == j:
                    continue
                pairs.append((center, doc[j]))
    return pairs
```

```python
>>> skipgram_pairs([["the", "cat", "sat", "on", "mat"]], window=2)
[('the', 'cat'), ('the', 'sat'),
 ('cat', 'the'), ('cat', 'sat'), ('cat', 'on'),
 ('sat', 'the'), ('sat', 'cat'), ('sat', 'on'), ('sat', 'mat'),
 ...]
```

Bir penceredeki her (merkez, bağlam) çift, olumlu bir eğitim örneğidir.

### Adım 2: embedding tabloları

İki matris. `W`, merkezi kelime embedding tablosudur (sakladığınız tablo). `W'` bağlam-kelime tablosudur (genellikle atılır, bazen `W` ile ortalaması alınır).

```python
import numpy as np


def init_embeddings(vocab_size, dim, seed=0):
    rng = np.random.default_rng(seed)
    W = rng.normal(0, 0.1, size=(vocab_size, dim))
    W_prime = rng.normal(0, 0.1, size=(vocab_size, dim))
    return W, W_prime
```

Küçük rastgele başlangıç. Kelime büyüklüğü 10k ve dim 100 gerçekçidir; öğretim için 50 kelime x 16 dim geometriyi görmek için yeterlidir.

### Adım 3: negatif örnekleme hedefi

Her pozitif `(center, context)` çifti için, sözlükten `k` rastgele kelimeleri negatif olarak örnekleyin. Modeli, `W[center] · W'[context]` nokta çarpımının pozitifler için yüksek ve negatifler için düşük olacağı şekilde eğitin.

```python
def sigmoid(x):
    return 1.0 / (1.0 + np.exp(-np.clip(x, -20, 20)))


def train_pair(W, W_prime, center_idx, context_idx, negative_indices, lr):
    v_c = W[center_idx]
    u_pos = W_prime[context_idx]
    u_negs = W_prime[negative_indices]

    pos_score = sigmoid(v_c @ u_pos)
    neg_scores = sigmoid(u_negs @ v_c)

    grad_center = (pos_score - 1) * u_pos
    for i, u in enumerate(u_negs):
        grad_center += neg_scores[i] * u

    W[context_idx] = W[context_idx]
    W_prime[context_idx] -= lr * (pos_score - 1) * v_c
    for i, neg_idx in enumerate(negative_indices):
        W_prime[neg_idx] -= lr * neg_scores[i] * v_c
    W[center_idx] -= lr * grad_center
```

Sihirli formül: pozitif çiftte lojistik kayıp (1'e yakın sigmoid istiyor) artı negatif çiftlerde lojistik kayıp (0'a yakın sigmoid istiyor). Gradient'ler her iki tabloya da akar. Tam türetme orijinal makalededir; Yapışmasını istiyorsanız kalem ve kağıtla üzerinden bir kez geçin.

### 4. Adım: oyuncak koleksiyonu üzerinde eğitim alın

```python
def train(docs, dim=16, window=2, k_neg=5, epochs=100, lr=0.05, seed=0):
    vocab = build_vocab(docs)
    vocab_size = len(vocab)
    rng = np.random.default_rng(seed)
    W, W_prime = init_embeddings(vocab_size, dim, seed=seed)
    pairs = skipgram_pairs(docs, window=window)

    for epoch in range(epochs):
        rng.shuffle(pairs)
        for center, context in pairs:
            c_idx = vocab[center]
            ctx_idx = vocab[context]
            negs = rng.integers(0, vocab_size, size=k_neg)
            negs = [n for n in negs if n != ctx_idx and n != c_idx]
            train_pair(W, W_prime, c_idx, ctx_idx, negs, lr)
    return vocab, W
```

Geniş bir külliyatta yeterli sayıda çağdan sonra, bağlamları paylaşan kelimeler benzer merkez embedding'lere sahip olur. Bir oyuncak külliyatında etkiyi hafifçe görüyorsunuz. Milyarlarca token'de bunu dramatik bir şekilde görüyorsunuz.

### Adım 5: benzetme numarası

```python
def nearest(vocab, W, target_vec, topk=5, exclude=None):
    exclude = exclude or set()
    inv_vocab = {i: w for w, i in vocab.items()}
    norms = np.linalg.norm(W, axis=1, keepdims=True) + 1e-9
    W_norm = W / norms
    target = target_vec / (np.linalg.norm(target_vec) + 1e-9)
    sims = W_norm @ target
    order = np.argsort(-sims)
    out = []
    for i in order:
        if i in exclude:
            continue
        out.append((inv_vocab[i], float(sims[i])))
        if len(out) == topk:
            break
    return out


def analogy(vocab, W, a, b, c, topk=5):
    v = W[vocab[b]] - W[vocab[a]] + W[vocab[c]]
    return nearest(vocab, W, v, topk=topk, exclude={vocab[a], vocab[b], vocab[c]})
```

Önceden eğitilmiş 300d Google Haberler vektörlerinde:

```python
>>> analogy(vocab, W, "man", "king", "woman")
[('queen', 0.71), ('monarch', 0.62), ('princess', 0.59), ...]
```

`king - man + woman = queen`. Model telif hakkının ne olduğunu bildiği için değil. Çünkü `(king - man)` vektörü "kraliyet" gibi bir şeyi yakalıyor ve onu `woman`'ye ekleyerek kraliyet-kadın bölgesinin yakınına geliyor.

## Kullan onu

Word2Vec'i sıfırdan yazmak öğretmektir. Üretim NLP'si `gensim`'yi kullanır.

```python
from gensim.models import Word2Vec

sentences = [
    ["the", "cat", "sat", "on", "the", "mat"],
    ["the", "dog", "ran", "across", "the", "room"],
]

model = Word2Vec(
    sentences,
    vector_size=100,
    window=5,
    min_count=1,
    sg=1,
    negative=5,
    workers=4,
    epochs=30,
)

print(model.wv["cat"])
print(model.wv.most_similar("cat", topn=3))
```

Gerçek iş için neredeyse hiçbir zaman Word2Vec'i kendiniz eğitmezsiniz. Önceden eğitilmiş vektörleri indirirsiniz.

- **GloVe** — Stanford'un birlikte oluşum matrisi çarpanlarına ayırma yaklaşımı. 50d, 100d, 200d, 300d kontrol noktaları. İyi genel kapsama alanı. Ders 04 özellikle GloVe'u kapsamaktadır.
- **fastText** — Facebook'un karakter n-gramlarını gömen Word2Vec uzantısı. Kelime hazinesi dışında kalan kelimeleri alt kelimeler oluşturarak işler. Ders 04.
- **Google Haberler'de önceden eğitilmiş Word2Vec** — 300d, 3 milyon kelime dağarcığı, 2013'te yayınlandı. Hala günlük olarak indiriliyor.

### Word2Vec 2026'da hâlâ kazandığında

- Hafif alana özgü erişim. Bir dizüstü bilgisayarda bir saat içinde tıbbi özetler üzerinde eğitim alın, genel modellerin yakalayamadığı özel vektörler edinin.
- Analoji tarzı özellik mühendisliği. `gender_vector = mean(man - woman pairs)`. Cinsiyet ayrımı gözetmeyen bir eksen elde etmek için onu diğer kelimelerden çıkarın. Hala adalet araştırmalarında kullanılıyor.
- Yorumlanabilirlik. 100d, PCA veya t-SNE aracılığıyla çizim yapmak ve aslında kümelerin oluştuğunu görmek için yeterince küçüktür.
- inference'nin herhangi bir yerde GPU olmadan cihaz üzerinde çalışması gerekir. Word2Vec araması tek satırlı bir aramadır.

### Word2Vec'in başarısız olduğu yer

Çok anlamlılık duvarı. `bank`'nin bir vektörü var. `river bank` ve `financial bank` bunu paylaşıyor. `table` (elektronik tablo ve mobilya) bunu paylaşıyor. Aşağı yöndeki bir sınıflandırıcı, duyuları vektörden ayıramaz.

Bağlamsal embedding'ler (ELMo, BERT, o zamandan beri her transformer), çevredeki bağlama dayalı olarak kelimenin her geçtiği yer için farklı bir vektör üreterek bunu çözdü. Bu, Word2Vec'ten BERT'e geçiştir: statikten bağlamsala. Aşama 7, transformer yarısını kapsar.

Kelime dağarcığı sorunu ise diğer başarısızlıktır. Word2Vec, eğitim verilerinde olmasaydı `Zoomer-approved`'yi hiç görmedi. Geri dönüş yok. fastText bunu alt kelime kompozisyonu ile düzeltir (ders 04).

## Gönderin

`outputs/skill-embedding-probe.md` olarak kaydet:

```markdown
---
name: embedding-probe
description: Inspect a word2vec model. Run analogies, find neighbors, diagnose quality.
version: 1.0.0
phase: 5
lesson: 03
tags: [nlp, embeddings, debugging]
---

You probe trained word embeddings to verify they are working. Given a `gensim.models.KeyedVectors` object and a vocabulary, you run:

1. Three canonical analogy tests. `king : man :: queen : woman`. `paris : france :: tokyo : japan`. `walking : walked :: swimming : ?`. Report the top-1 result and its cosine.
2. Five nearest-neighbor tests on domain-specific words the user supplies. Print top-5 neighbors with cosines.
3. One symmetry check. `similarity(a, b) == similarity(b, a)` to within float precision.
4. One degenerate check. If any embedding has a norm below 0.01 or above 100, the model has a training bug. Flag it.

Refuse to declare a model good on analogy accuracy alone. Analogy benchmarks are gameable and do not transfer to downstream tasks. Recommend intrinsic + downstream evaluation together.
```

## Egzersizler

1. **Kolay.** Eğitim döngüsünü küçük bir derlemede çalıştırın (kediler ve köpekler hakkında 20 cümle). 200 çağdan sonra, `nearest(vocab, W, W[vocab["cat"]])`'nin `dog`'yi ilk 3'e döndürdüğünü doğrulayın. Değilse, dönemleri veya sözcük dağarcığını artırın.
2. **Orta.** Sık kullanılan kelimelerin alt örneklemesini ekleyin. Frekansı `10^-5`'nin üzerinde olan kelimeler, frekanslarıyla orantılı olasılıkla eğitim çiftlerinden çıkarılır. Nadir kelime benzerliği üzerindeki etkiyi ölçün.
3. **Zor.** 20 Haber Grubu külliyatı üzerinde bir model eğitin. İki önyargı eksenini hesaplayın: `he - she` ve `doctor - nurse`. Meslek kelimelerini her iki eksene de yansıtın. Hangi mesleklerin en büyük önyargı farkına sahip olduğunu bildirin. Bu, adalet araştırmacılarının kullandığı türden bir araştırmadır.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|-----------------|-----------------------|
| Kelime embedding | Vektör olarak kelime | Bağlamdan öğrenilen yoğun, düşük loş (tipik olarak 100-300) temsil. |
| Gramı atla | Word2Vec numarası | Bağlam sözcüklerini merkez sözcükten tahmin edin. CBOW'dan daha yavaştır, nadir kelimeler için daha iyidir. |
| Negatif örnekleme | Eğitim kısayolu | Tam kelime bilgisi yerine softmax'ı, `k` rastgele kelimelere karşı ikili sınıflandırmayla değiştirin. |
| Statik embedding | Kelime başına bir vektör | Bağlamdan bağımsız olarak aynı vektör. Çok anlamlılık konusunda başarısız. |
| Bağlamsal embedding | Bağlama duyarlı vektör | Çevredeki kelimelere göre her oluşum için farklı vektör. transformer'lerin ürettiği şeyler. |
| OOV | Kelime dağarcığı dışında | Eğitimde görülmeyen kelime. Word2Vec bunlar için bir vektör üretemez. |

## Daha Fazla Okuma

- [Mikolov ve ark. (2013). Kelimelerin ve Cümlelerin Dağıtılmış Temsilleri ve Bunların Bileşimleri](https://arxiv.org/abs/1310.4546) — negatif örnekleme makalesi. Kısa ve okunabilir.
- [Rong, X. (2014). word2vec Parametre Öğrenme Açıklaması](https://arxiv.org/abs/1411.2738) — orijinal makalenin matematiği yoğun görünüyorsa gradient'lerin en net türetilmesi.
- [gensim Word2Vec öğreticisi](https://radimrehurek.com/gensim/models/word2vec.html) — gerçekten işe yarayan üretim eğitimi ayarları.
