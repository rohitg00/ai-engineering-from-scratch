# Konu Modelleme  LDA ve BERTopic

> LDA: belgeler konuların karışımı, konuların kelimeler üzerinde dağılımıdır. BERTopic: belge grupları yerleşim alanında, gruplar konulardır. Aynı amaç, farklı parçalanmalar.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 02 (BoW + TF-IDF), Phase 5 · 03 (Word2Vec)
**Time:** ~45 minutes

## Sorun

10,000 müşteri destek bileti, 50.000 haber makalesi veya 200.000 tweetiniz var. Toplumu okumadan ne hakkında olduğunu bilmeniz gerekir. Kategori etiketleri yoktur. Kaç kategori olduğunu bile bilmiyorsunuz.

Konu modeli, denetim olmadan cevaplar. Bir corpus verin, bir dizi tutarlı konuyu geri alın ve her belge için bu konuların dağıtımı.

LDA (2003) her belgeyi gizli konuların bir karışımı ve her konuyu kelimelerin bir dağılım olarak ele alıyor. İndirim Bayesian'dır. Hala karışık üyelik konu görevleri ve açıklanabilir kelime seviyesindeki olasılık dağılımları gerektiği üretiminde gönderir.

BERTopic (2020) belgeleri BERT ile kodlar, UMAP ile boyutluluğu azaltır, HDBSCAN ile kümeler oluşturur ve sınıf tabanlı TF-IDF üzerinden konu kelimelerini çıkarır. Kısa metin, sosyal medya ve kelimelerin üst üste geçmesinden daha fazla anlamlı benzerlik önemi olan her şeyi kazanır. Bir belge tek bir konu alır, bu da uzun biçimli içerik için bir sınırlama.

Bu ders hem içgüdü hem de belirli bir kitap için hangisini seçmek için isimler oluşturur.

## Anlaşım

![LDA mixture model vs BERTopic clustering](../assets/topic-modeling.svg)

**LDA generative story.**Her konu kelimelerin üzerine bir dağılımdır. Her belge bir konu karışımıdır. Bir belgedeki bir kelimeyi oluşturmak için, belge karışımından bir konu örneğini, sonra bu konu dağılımından bir kelimeyi örnekleyin. İndirim bunu tersine çevirir: gözlemlenen kelimeleri vererek, her belge başına konu dağılımını ve her konu başına kelime dağılımını çıkarın.

Anahtar LDA çıkışı:

- `doc_topic`: matris`(n_docs, n_topics)`, her satır 1'e (dokümanın konu karışımı) kadar.
- `topic_word`: matris`(n_topics, vocab_size)`, her satır 1'e (topik kelimelerinin dağılımı) kadar.

**BERTopic pipeline.**

1. Her belgeyi cümle dönüştürücü ile kodlayın (örneğin, `all-MiniLM-L6-v2`384 boyutlu vektörler.
2. UMAP ile boyutluluğu ~5 boyutlara düşürün. BERT yerleşimleri kümeler için çok yüksek bir kalınlıkta.
3. HDBSCAN ile gruplama. Sıklık tabanlı, değişken boyutlu gruplamalar ve "outlier" etiketini üretir.
4. Her küme için, en önemli kelimeleri çıkarmak için küme belgeleri üzerinde sınıf tabanlı TF-IDF hesaplayın.

Çıktı, her belgeye bir konu (daha -1 dışarısı etiket) ve seçeneği olarak HDBSCAN'ın olasılık vektörü üzerinden yumuşak bir üyelik.

```figure
topic-drift
```

## Yapın

### Adım 1: Sikit-learn üzerinden LDA

```python
from sklearn.feature_extraction.text import CountVectorizer
from sklearn.decomposition import LatentDirichletAllocation
import numpy as np


def fit_lda(documents, n_topics=5, max_features=1000):
    cv = CountVectorizer(
        max_features=max_features,
        stop_words="english",
        min_df=2,
        max_df=0.9,
    )
    X = cv.fit_transform(documents)
    lda = LatentDirichletAllocation(
        n_components=n_topics,
        random_state=42,
        max_iter=50,
        learning_method="online",
    )
    doc_topic = lda.fit_transform(X)
    feature_names = cv.get_feature_names_out()
    return lda, cv, doc_topic, feature_names


def print_top_words(lda, feature_names, n_top=10):
    for idx, topic in enumerate(lda.components_):
        top_idx = np.argsort(-topic)[:n_top]
        words = [feature_names[i] for i in top_idx]
        print(f"topic {idx}: {' '.join(words)}")
```

Not: Stopwords kaldırıldı, min_df ve max_df nadir ve her yerde bulunan terimleri filtreledi, CountVectorizer (TfidfVectorizer değil) çünkü LDA çiğ sayıları bekliyor.

### Adım 2: BERTopic (önem)

```python
from bertopic import BERTopic

topic_model = BERTopic(
    embedding_model="sentence-transformers/all-MiniLM-L6-v2",
    min_topic_size=15,
    verbose=True,
)

topics, probs = topic_model.fit_transform(documents)
info = topic_model.get_topic_info()
print(info.head(20))
valid_topics = info[info["Topic"] != -1]["Topic"].tolist()
for topic_id in valid_topics[:5]:
    print(f"topic {topic_id}: {topic_model.get_topic(topic_id)[:10]}")
```

Filtrenin açık olması .`Topic != -1`BERTopic'in dışarısı kovalarını düşürür (HDDBSCAN belgeler toplayamadı). `min_topic_size`HDBSCAN'ın en az kümeler boyutunu kontrol eder; BERTopic'in kütüphane standartı 10. Bu örnek ders ölçeği için açıkça 15'e ayarlar. 10.000'den fazla belge için 50 veya 100'e yükseltin.

### Adım 3: Değerlendirme

Her iki yöntem de konu kelimelerini çıkarır.

- **Topic coherence (c_v).**Slide-fenster bağlamlarında en üst kelime çiftlerinin NPMI'sini (normalleştirilmiş nokta yönünde karşılıklı bilgi) birleştirir, puanları konu vektörlerine toplar ve bu vektörleri cosine benzerliği yoluyla karşılaştırır. Daha yüksek daha iyidir. Kullanın `gensim.models.CoherenceModel`- Evet .`coherence="c_v"`- Evet .
- **Topic diversity.**Tüm konuların en önemli kelimelerindeki benzersiz kelimelerin bölümü.
- **Qualitative inspection.**Her konuyu ilk kelimelerle okuyun.

## Hangisini seçmek için ne zaman

| Situation | Pick |
|-----------|------|
| Short text (tweets, reviews, headlines) | BERTopic |
| Long documents with topic mixtures | LDA |
| No GPU / limited compute | LDA or NMF |
| Need document-level multi-topic distributions | LDA |
| LLM integration for topic labeling | BERTopic (direct support) |
| Resource-constrained edge deployment | LDA |
| Max semantic coherence | BERTopic |

En büyük pratik düşünce, belge uzunluğudur. BERT yerleşimleri kısaltılır; LDA, herhangi bir uzunlukta çalışmayı sayır. Yerleşim modelinin bağlamından daha uzun belgelere, ya parça + toplam veya LDA kullanın.

## Kullan

2026'da:

- **BERTopic.**Kısa metin ve semantik önemli olan her şey için öntanımlı.
- **`gensim.models.LdaModel`.**Klasik LDA üretimi, olgun, savaş testinde.
- **`sklearn.decomposition.LatentDirichletAllocation`.**Deney için kolay bir LDA.
- **NMF.**Negatif olmayan matris faktörleşmesi. LDA'ya hızlı alternatif, kısa metin üzerinde karşılaştırılabilir kalite.
- **Top2Vec.**BERTopic'e benzer bir tasarım. Daha küçük bir topluluk ama bazı referans değerlerinde iyi.
- **FASTopic.**Çok büyük korpuslarda BERTopic'ten daha yeni, daha hızlı.
- **LLM-based labeling.**Her türlü gruplama çalıştırın, sonra her gruptan bir modelin adını getirin.

## Gönder

- Kaydet .`outputs/skill-topic-picker.md`- ...

```markdown
---
name: topic-picker
description: Pick LDA or BERTopic for a corpus. Specify library, knobs, evaluation.
version: 1.0.0
phase: 5
lesson: 15
tags: [nlp, topic-modeling]
---

Given a corpus description (document count, avg length, domain, language, compute budget), output:

1. Algorithm. LDA / NMF / BERTopic / Top2Vec / FASTopic. One-sentence reason.
2. Configuration. Number of topics: `recommended = max(5, round(sqrt(n_docs)))`, clamped to 200 for corpora under 40,000 docs; permit >200 only when the corpus is genuinely large (>40k) and note the increased compute cost. `min_df` / `max_df` filters and embedding model for neural approaches also belong here.
3. Evaluation. Topic coherence (c_v) via `gensim.models.CoherenceModel`, topic diversity, and a 20-sample human read.
4. Failure mode to probe. For LDA, "junk topics" absorbing stopwords and frequent terms. For BERTopic, the -1 outlier cluster swallowing ambiguous documents.

Refuse BERTopic on documents longer than the embedding model's context window without a chunking strategy. Refuse LDA on very short text (tweets, reviews under 10 tokens) as coherence collapses. Flag any n_topics choice below 5 as likely wrong; flag >200 on corpora under 40k docs as likely over-splitting.
```

## Egzersizler

1. **Easy.**20 Newsgroup verisi üzerinde 5 konu ile LDA'yı uygulayın. Konu başına en iyi 10 kelimeyi basın. Her konuyu el ile etiketleyin. Algoritm gerçek kategorileri buldu mu?
2. **Medium.**BERTopic'i aynı 20 Haber Grubunun alt kümesine uygulayın. Bulunan konular, en önemli kelimeler ve kalite tutarlılığı LDA ile karşılaştırın. Gerçek kategorileri hangisi daha temiz bir şekilde yüze çıkarır?
3. **Hard.**LDA ve BERTopic için her iki bölüm için de c_v tutarlılığını hesaplayın. Her birini 5, 10, 20, 50 konu ile çalıştırın. Plan tutarlılığı vs. konu sayısı. Konu sayıları boyunca hangi yöntem daha istikrarlı olduğunu bildirin.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Topic | A thing the corpus is about | A probability distribution over words (LDA) or a cluster of similar documents (BERTopic). |
| Mixed membership | Doc is multiple topics | LDA assigns each document a distribution over all topics. |
| UMAP | Dimensionality reduction | Manifold learning that preserves local structure; used in BERTopic. |
| HDBSCAN | Density clustering | Finds variable-size clusters; produces "noise" label (-1) for outliers. |
| c_v coherence | Topic quality metric | NPMI of top topic words over sliding windows, turned into context vectors and compared with cosine similarity. |

## Daha Fazla Okumak

- [Blei, Ng, Jordan (2003). Latent Dirichlet Allocation](https://www.jmlr.org/papers/volume3/blei03a/blei03a.pdf)LDA gazetesi.
- [Grootendorst (2022). BERTopic: Neural topic modeling with a class-based TF-IDF procedure](https://arxiv.org/abs/2203.05794) BERTopic gazetesi.
- [Röder, Both, Hinneburg (2015). Exploring the Space of Topic Coherence Measures](https://svn.aksw.org/papers/2015/WSDM_Topic_Evaluation/public.pdf)- C_v ve arkadaşları tanıtan kağıt.
- [BERTopic documentation](https://maartengr.github.io/BERTopic/) üretim referansı.
