# Bilgi Arama ve Arama

> BM25 kesin ama kırılgan. Dense geniş bir ağ atıyor ama anahtar kelimeleri kaçırıyor. Hibrit 2026 varsayılan. Her şey ayarlanıyor.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 02 (BoW + TF-IDF), Phase 5 · 04 (GloVe, FastText, Subword)
**Time:** ~75 minutes

## Sorun

Kullanıcı "Birisi para almak için yalan söylerse ne olur" yazıyor ve aslında bu durumu kapsadığı statutu bulmayı bekliyor: "Bölüm 420 IPC". Anahtar kelime arama tamamen kaçırır ( paylaşımlı kelime kitlesi yoktur).

IR, her RAG sistemi, her arama çubuğu, her dok sitesi'nin bulanık aramalarının altındaki boru hattıdır. 2026 mimarisi üretimde çalışan tek bir yöntem değildir.

Bu ders her yakalama başarısız olan her parçayı ve isimleri oluşturur.

## Anlaşım

![Hybrid retrieval: BM25 + dense + RRF + cross-encoder rerank](../assets/retrieval.svg)

Dört katman, ihtiyacın olanları seç.

1. **Sparse retrieval (BM25).**Hızlı, tam eşleşmelerde doğru, semantikte berbat bir indeks, milyonlarca belge üzerinde sorgu başına 10 ms altındaki bir indeks, yasal referanslar, ürün kodları, hata mesajları, isimli varlıklar sağlıyor.
2. **Dense retrieval.**Enkodlama sorgu ve belgeleri vektörlere. En yakın komşu arama. Parafrases ve semantik benzerliği yakalar. Bir karakterle farklı olan tam anahtar kelime eşleşmelerini kaçırır. FAISS veya vektör DB ile sorgu başına 50-200 ms.
3. **Fusion.**Ranklı ve yoğun listeleri birleştirin. karşılıklı sıra birleşimi (RRF) kolay varsayımdır çünkü çiğ puanları (farklı ölçeklerde yaşayan) görmezden gelir ve yalnızca sıra pozisyonlarını kullanır.
4. **Cross-encoder rerank.**Top-30'u füzyondan alın. Bir çapraz kodlayıcı çalıştırın (soru + belge birlikte, her çiftin puanlanması). Top-5'ü tutun. çapraz kodlayıcılar çift başına iki kodlayıcılardan daha yavaş ama çok daha doğru.

Üç yönlü geri alım (BM25 + yoğun + SPLADE gibi öğrenilen boşluk) 2026'da iki yönlü referanslardan daha iyi performans gösterir, ancak öğrenilen boşluk indeksleri için altyapıya ihtiyaç duyar.

```figure
gx-hybrid-retrieval
```

## Yapın

### Adım 1: BM25 sıfırdan

```python
import math
import re
from collections import Counter

TOKEN_RE = re.compile(r"[a-z0-9]+")


def tokenize(text):
    return TOKEN_RE.findall(text.lower())


class BM25:
    def __init__(self, corpus, k1=1.5, b=0.75):
        if not corpus:
            raise ValueError("corpus must not be empty")
        self.corpus = [tokenize(d) for d in corpus]
        self.k1 = k1
        self.b = b
        self.n_docs = len(self.corpus)
        self.avg_dl = sum(len(d) for d in self.corpus) / self.n_docs
        self.df = Counter()
        for doc in self.corpus:
            for term in set(doc):
                self.df[term] += 1

    def idf(self, term):
        n = self.df.get(term, 0)
        return math.log(1 + (self.n_docs - n + 0.5) / (n + 0.5))

    def score(self, query, doc_idx):
        q_tokens = tokenize(query)
        doc = self.corpus[doc_idx]
        dl = len(doc)
        freq = Counter(doc)
        score = 0.0
        for term in q_tokens:
            f = freq.get(term, 0)
            if f == 0:
                continue
            numerator = f * (self.k1 + 1)
            denominator = f + self.k1 * (1 - self.b + self.b * dl / self.avg_dl)
            score += self.idf(term) * numerator / denominator
        return score

    def rank(self, query, top_k=10):
        scored = [(self.score(query, i), i) for i in range(self.n_docs)]
        scored.sort(reverse=True)
        return scored[:top_k]
```

Bilmeye değer iki parametredir.`k1=1.5`Bu nedenle, bu süreci daha fazla kullanmak için kullanılır.`b=0.75`Bu nedenle, bu işlemler, bir önceki yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yazılı yaz

### Adım 2: İki kodlayıcı ile yoğun çekim

```python
from sentence_transformers import SentenceTransformer
import numpy as np


def build_dense_index(corpus, model_id="sentence-transformers/all-MiniLM-L6-v2"):
    encoder = SentenceTransformer(model_id)
    embeddings = encoder.encode(corpus, normalize_embeddings=True)
    return encoder, embeddings


def dense_search(encoder, embeddings, query, top_k=10):
    q_emb = encoder.encode([query], normalize_embeddings=True)
    sims = (embeddings @ q_emb.T).flatten()
    order = np.argsort(-sims)[:top_k]
    return [(float(sims[i]), int(i)) for i in order]
```

L2-normalize yerleşimleri böylece nokta ürünü cosine eşittir. `all-MiniLM-L6-v2`384 boyutlu, hızlı ve İngilizce'nin çoğu için yeterince güçlü.`paraphrase-multilingual-MiniLM-L12-v2`En yüksek doğruluk için,`bge-large-en-v1.5`veya `e5-large-v2`- Evet .

### Adım 3: Karşılıklı Rank Füzyonu

```python
def reciprocal_rank_fusion(rankings, k=60):
    scores = {}
    for ranking in rankings:
        for rank, (_, doc_idx) in enumerate(ranking):
            scores[doc_idx] = scores.get(doc_idx, 0.0) + 1.0 / (k + rank + 1)
    fused = sorted(scores.items(), key=lambda x: x[1], reverse=True)
    return [(score, doc_idx) for doc_idx, score in fused]
```

- Evet .`k=60`sabit orijinal RRF kağıdından geliyor.`k`Renk farklarının katkılarını düzeltir; daha düşük `k`60'ın yayınlanan standart olduğu ve nadiren ayarlanmasına ihtiyacı var.

### Dördüncü adım: hibrit arama + yeniden sıralama

```python
from sentence_transformers import CrossEncoder

reranker = CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2")


def hybrid_search(query, bm25, encoder, dense_embeddings, corpus, top_k=5, pool_size=30, reranker=reranker):
    sparse_ranking = bm25.rank(query, top_k=pool_size)
    dense_ranking = dense_search(encoder, dense_embeddings, query, top_k=pool_size)
    fused = reciprocal_rank_fusion([sparse_ranking, dense_ranking])[:pool_size]

    pairs = [(query, corpus[doc_idx]) for _, doc_idx in fused]
    scores = reranker.predict(pairs)
    reranked = sorted(zip(scores, [doc_idx for _, doc_idx in fused]), reverse=True)
    return reranked[:top_k]
```

BM25 sözlük eşleşmelerini bulur. Dense semantik eşleşmelerini bulur. RRF puan kalibrasyonuna ihtiyaç duymadan iki sıralamayı birleştirir. Cross-encoder sorgu-doküman çiftlerini birlikte kullanarak en üst-30'u yeniden puanlar.

### Adım 5: değerlendirme

| Metric | Meaning |
|--------|---------|
| Recall@k | Of queries where the correct document exists, how often is it in the top-k? |
| MRR (Mean Reciprocal Rank) | Average of 1/rank of first relevant document. |
| nDCG@k | Accounts for relevance gradations, not just binary relevant/not. |

Özellikle RAG için,**Recall@k**Eğer doğru pasaj alınmamış bir sette yoksa okuyucu cevap veremez.

Debugging tip: başarısız sorgular için, nadir ve yoğun sıralamaları ayırın. Biri doğru belgeyi bulursa diğerini bulmazsa, kelime birikimi eşleşmezliği (hatar eden yarısını ekle) veya semantik belirsizlik (hatar: daha iyi yerleştirmeler veya yeniden sıralama).

## Kullan

2026'da:

| Scale | Stack |
|-------|-------|
| 1k-100k docs | In-memory BM25 + `all-MiniLM-L6-v2` embeddings + RRF. No separate DB. |
| 100k-10M docs | FAISS or pgvector for dense + Elasticsearch / OpenSearch for BM25. Run in parallel. |
| 10M+ docs | Qdrant / Weaviate / Vespa / Milvus with hybrid support. Cross-encoder rerank on top-30. |
| Best-quality frontier | Three-way (BM25 + dense + SPLADE) + ColBERT late-interaction reranking |

Seçtiğiniz her şey, değerlendirme için bütçe. Benchmark retrieval raporu, sonundan sonuna kadar RAG doğruluğunu karşılaştırmadan önce geri çağırın.

### 2026 üretiminden alınan zor dersler

- **80% of RAG failures trace to ingestion and chunking, not the model.**Takımlar haftalarca LLM'leri değiştirirken ve istekleri ayarlarken geri alınan her üçüncü sorguda sessizce yanlış bağlamı gönderir.
- **Chunking strategy matters more than chunk size.**Sıkı boyutlu bölünmeler tabloları, kodları ve yuva başlıklarını kırar. Ceza bilinçli öntanımlıdır; semantik veya LLM tabanlı parçalanma teknik belgeler ve ürün elyazmaları için ödüllendirilir.
- **Parent-doc pattern.**Aynı ana bölümünden birden fazla çocuk ortaya çıktığında, bağlamı korumak için ana blokunu değiştirin. Bu, yeniden eğitilmeden cevap kalitesini sürekli olarak yükseltir.
- **k_rerank=3 is usually optimal.**Eğer k=8 sizin için k=3'ten daha iyi ise, yeniden sıralama işlemi düşük performans gösteriyor.
- **HyDE / query expansion.**Sorgudan bir hipotetik cevap oluşturun, onu yerleştirin, alın. Kısa sorularla uzun belgeleri arasındaki ifade boşluğunu kapatın.
- **Context budget under 8K tokens.**Bu sınırda sürekli vurmak, yeniden sıralama eşiğinin çok gevşek olduğunu gösterir.
- **Version everything.**İndirimler, parçalanma kuralları, yerleştirme modeli, yeniden sıralama. Her türlü akış sessizce cevap kalitesini kırar. CI, sadakat, bağlam doğruluğu ve cevapsız soru oranı kullanıcıların görmeden önce geri dönüşleri engeller.
- **Three-way retrieval (BM25 + dense + learned-sparse like SPLADE) outperforms two-way**2026 referansları, özellikle de doğru isimleri semantikle karıştırmak için sorular için gönderin.

Doğru geri alım tasarımı, 2026 endüstri ölçümlerine göre halüsinasyonları %70-90 oranında azaltır. RAG performans kazanımlarının çoğu daha iyi geri alımdan gelir, model ince ayarlamalardan değil.

## Gönder

- Kaydet .`outputs/skill-retrieval-picker.md`- ...

```markdown
---
name: retrieval-picker
description: Pick a retrieval stack for a given corpus and query pattern.
version: 1.0.0
phase: 5
lesson: 14
tags: [nlp, retrieval, rag, search]
---

Given requirements (corpus size, query pattern, latency budget, quality bar, infra constraints), output:

1. Stack. BM25 only, dense only, hybrid (BM25 + dense + RRF), hybrid + cross-encoder rerank, or three-way (BM25 + dense + learned-sparse).
2. Dense encoder. Name the specific model. Match to language(s), domain, and context length.
3. Reranker. Name the specific cross-encoder model if used. Flag that rerank adds 30-100ms latency on top-30.
4. Evaluation plan. Recall@10 is the primary retriever metric. MRR for multi-answer. Baseline first, incremental improvements measured against it.

Refuse to recommend dense-only for corpora with named entities, error codes, or product SKUs unless the user has evidence dense handles exact matches. Refuse to skip reranking for high-stakes retrieval (legal, medical) where the final top-5 decides the user's answer.
```

## Egzersizler

1. **Easy.**Uygulama`hybrid_search`500 belgelik bir korpus üzerinde. 20 sorgu test. BM25'li, yoğun ve hibrid arasında 5'e hatırlama karşılaştır.
2. **Medium.**MRR hesaplamasını ekleyin. Bilinen doğru belge ile yapılan her test sorusu için BM25, yoğun ve hibrit sıralamalarda doğru belgenin sıralamasını bulun. Her biri için MRR rapor edin.
3. **Hard.**MultipleNegativesRankingLoss (Sentence Transformers) kullanarak alanınızda yoğun bir kodlayıcıyı ince ayarlayın. 500 sorgu-doküman çiftinden bir eğitim kümesi oluşturun. Pre- ve post-fine-tune hatırlatma karşılaştırın.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| BM25 | Keyword search | Okapi BM25. Scores documents by term frequency, IDF, and length. |
| Dense retrieval | Vector search | Encode query + doc into vectors, find nearest neighbors. |
| Bi-encoder | Embedding model | Encodes query and doc independently. Fast at query time. |
| Cross-encoder | Reranker model | Encodes query + doc together. Slow but accurate. |
| RRF | Rank fusion | Combine two rankings by summing `1/(k + rank)`. |
| Recall@k | Retrieval metric | Fraction of queries where a relevant doc is in the top-k. |

## Daha Fazla Okumak

- [Robertson and Zaragoza (2009). The Probabilistic Relevance Framework: BM25 and Beyond](https://www.staff.city.ac.uk/~sbrp622/papers/foundations_bm25_review.pdf) BM25 tedavisinin sonucunda.
- [Karpukhin et al. (2020). Dense Passage Retrieval for Open-Domain QA](https://arxiv.org/abs/2004.04906)DPR, kanonik iki kodlayıcı.
- [Formal et al. (2021). SPLADE: Sparse Lexical and Expansion Model](https://arxiv.org/abs/2107.05720) sıvı ile boşluğu kapatan öğrenilmiş-sparse retriever.
- [Cormack, Clarke, Büttcher (2009). Reciprocal Rank Fusion outperforms Condorcet and individual Rank Learning Methods](https://plg.uwaterloo.ca/~gvcormac/cormacksigir09-rrf.pdf) RRF kağıdı.
- [Khattab and Zaharia (2020). ColBERT: Efficient and Effective Passage Search](https://arxiv.org/abs/2004.12832) Geç etkileşimden kurtarma.
