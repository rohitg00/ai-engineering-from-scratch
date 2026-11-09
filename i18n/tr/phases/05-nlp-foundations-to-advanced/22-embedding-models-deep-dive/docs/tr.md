# Modeller Ekle  2026 Derin Dalış

> Word2Vec size kelimenin bir vektörü verdi. Modern yerleştirme modelleri size geçit başına bir vektör verir, diller arası, nadir, yoğun ve çok vektörlü görüntüler ile, indeksiye uygun boyutlarda. Yanlış seçin ve RAG yanlış şeyi alır.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 03 (Word2Vec), Phase 5 · 14 (Information Retrieval)
**Time:** ~60 minutes

## Sorun

RAG sisteminiz yanlış geçişleri %40'da geri alır. Suçlu nadiren vektör veritabanı veya prompt.

2026'da bir yerleştirme seçimi beş ekseni seçmek anlamına gelir:

1. **Dense vs sparse vs multi-vector.**Bir geçit için bir vektör, ya da bir işaret için, ya da nadir ağırlıklı bir kelime çantası.
2. **Language coverage.**Tek dilli İngiliz modelleri hala sadece İngilizce görevlerinde kazanır.
3. **Context length.**512 token vs 8.192 vs 32.768  ve gerçek etkin kapasite genellikle reklam edilen maksimumın %60-70%'sidir.
4. **Dimension budget.**100M vektörde depolama ayda 1300$. Matryoshka kesimi 4×'yi keser.
5. **Open vs hosted.**Açık ağırlık, yığın ve verileri kontrol etmenizi, barındırılmış ise kontrolü her zaman en sonuna değişmenizi gerektirir.

Bu ders, anlaşmaların isimlerini belirler böylece kanıtları seçersiniz, geçen çeyrekte popüler olanlardan değil.

## Anlaşım

![Dense, sparse, and multi-vector embeddings](../assets/embedding-modes.svg)

**Dense embeddings.**Bir geçit için bir vektör (genellikle 384-3,072 boyut).`text-embedding-3-large`, BGE-M3 yoğun mod, Voyage-3. Öntanımlı seçenek.

**Sparse embeddings.**SPLADE tarzı. Bir transformatör her kelime jetonu için bir ağırlık öngörür, sonra çoğunun sıfırlarını çıkarır. Sonuç büyüklüğü az olan bir vektördür.

**Multi-vector (late interaction).**ColBERTv2, Jina-ColBERT. Token başına bir vektör. MaxSim ile puanlama: her sorgu token için en benzer belge tokenini bul, puanları toplam. Kaydetmek ve puanlamak daha pahalı, ancak uzun sorgular ve alan özel korpuslarda kazanır.

**BGE-M3: all three at once.**Tek model aynı anda yoğun, nadir ve çok vektörlü temsiller üretir. Her biri bağımsız olarak sorulabilir; puanlar ağırlıklı toplam üzerinden birleşir. Tek bir kontrol noktasından esneklik istediğinizde 2026 varsayılan.

**Matryoshka Representation Learning.**Bu şekilde vektörün ilk N boyutları kullanışlı bir bağımsız gömleği oluşturur. 1,536-dim vektörü 256 dim'e kesin ve 6x depolama tasarrufu için ~1% doğruluk ödeyin. OpenAI metin-3, Cohere v4, Voyage-4, Jina v5, Gemini Embedding 2, Nomic v1.5+ tarafından desteklenir.

### MTEB liderlik tabloları kısmi bir hikaye anlatıyor .

Massive Text Embedding Benchmark  Başlatılmasında 8 görev türü boyunca 56 görev (2022), MTEB v2'de 100+ görevlere genişletildi. 2026'ın başında, Gemini Embedding 2 top geri alımı (67.71 MTEB-R). Koherent gömletilmiş v4 genel (65.2 MTEB) liderleri. BGE-M3 açık ağırlıklı çok dilli (63.0) liderleri.

### Üç katlı kalıp

| Use case | Pattern |
|----------|---------|
| Fast first-pass | Dense bi-encoder (BGE-M3, text-3-small) |
| Recall boost | Sparse (SPLADE, BGE-M3 sparse) + RRF fuse |
| Precision on top-50 | Multi-vector (ColBERTv2) or cross-encoder reranker |

Çoğu üretim yığınları üçünü de kullanıyor.

```figure
gx-matryoshka
```

## Yapın

### Adım 1: Baseline  Sentence-BERT ile yoğun yerleşimler

```python
from sentence_transformers import SentenceTransformer
import numpy as np

encoder = SentenceTransformer("BAAI/bge-small-en-v1.5")
corpus = [
    "The first iPhone launched in 2007.",
    "Apple released the iPod in 2001.",
    "Android is an operating system from Google.",
]
emb = encoder.encode(corpus, normalize_embeddings=True)

query = "When was the iPhone released?"
q_emb = encoder.encode([query], normalize_embeddings=True)[0]
scores = emb @ q_emb
print(sorted(enumerate(scores), key=lambda x: -x[1]))
```

`normalize_embeddings=True`Bu da nokta ürünü eşittir.

### Adım 2: Matryoshka kesimi

```python
def truncate(vectors, dim):
    out = vectors[:, :dim]
    return out / np.linalg.norm(out, axis=1, keepdims=True)

emb_256 = truncate(emb, 256)
emb_128 = truncate(emb, 128)
```

Nomic v1.5, OpenAI text-3, ve Voyage-4 eğitimlidir, bu nedenle ilk birkaç seviyede kayıpsızdır.

### Adım 3: BGE-M3 çok fonksiyonelliği

```python
from FlagEmbedding import BGEM3FlagModel

model = BGEM3FlagModel("BAAI/bge-m3", use_fp16=True)

output = model.encode(
    corpus,
    return_dense=True,
    return_sparse=True,
    return_colbert_vecs=True,
)
# output["dense_vecs"]:    (n_docs, 1024)
# output["lexical_weights"]: list of dict {token_id: weight}
# output["colbert_vecs"]:  list of (n_tokens, 1024) arrays
```

Üç indeks, bir sonuç görüşmesi.

```python
dense_score = ... # cosine over dense_vecs
sparse_score = model.compute_lexical_matching_score(q_lex, d_lex)
colbert_score = model.colbert_score(q_col, d_col)
final = 0.4 * dense_score + 0.2 * sparse_score + 0.4 * colbert_score
```

- Ağırlıkları kendi alanına ayarlayın.

### Adım 4: Özel bir görev için MTEB değerlendirme

```python
from mteb import MTEB

tasks = ["ArguAna", "SciFact", "NFCorpus"]
evaluation = MTEB(tasks=tasks)
results = evaluation.run(encoder, output_folder="./mteb-results")
```

* Temsilci* alt kümede aday modellerinizi çalıştırın.

### Adım 5: Elle sıfırdan fırlatılmış cosine

Bakın .`code/main.py`. Ortalama Hashing Trick yerleşimleri (stdlib-only). Transformer yerleşimleriyle rekabetçi değil, ancak şeklini gösterir: tokenize → vector → normalize → dot product.

## Tuzaklar

- **Same model for query and doc.**Bazı modeller (Voyage, Jina-ColBERT) asimetrik kodlama kullanır.
- **Missing prefix.** `bge-*`Modellerin ihtiyacı`"Represent this sentence for searching relevant passages: "`Eğer unuttuysanız 3-5 puan hatırlama boşluğu.
- **Over-trimming Matryoshka.**1.536 → 256 genellikle güvenli. 1.536 → 64 değil.
- **Context truncation.**Çoğu model en uzun uzunluğunda girişleri sessizce keser. Uzun dokümanlar parçalanmaya ihtiyaç duyar (derseye bakın 23).
- **Ignoring latency tail.**MTEB puanları p99 gecikmeyi gizler. 600M modeli 335M modeliyi 2 puan geçebilir ama sorgu başına 3x daha fazla maliyetli olabilir.

## Kullan

2026'da:

| Situation | Pick |
|-----------|------|
| English-only, fast, API | `text-embedding-3-large` or `voyage-3-large` |
| Open-weight, English | `BAAI/bge-large-en-v1.5` |
| Open-weight, multilingual | `BAAI/bge-m3` or `Qwen3-Embedding-8B` |
| Long context (32k+) | Voyage-3-large, Cohere embed-v4, Qwen3-Embedding-8B |
| CPU-only deployment | Nomic Embed v2 (137M params, MoE) |
| Storage-constrained | Matryoshka-truncated + int8 quantization |
| Keyword-heavy queries | Add SPLADE sparse, RRF-fuse with dense |

2026 model: BGE-M3 veya metin-3 büyüklüğünde başlayın, alanınızda MTEB ile değerlendirin, alan özel bir model 3 puandan fazla kazanırsa değiştirin.

## Gönder

- Kaydet .`outputs/skill-embedding-picker.md`- ...

```markdown
---
name: embedding-picker
description: Pick embedding model, dimension, and retrieval mode for a given corpus and deployment.
version: 1.0.0
phase: 5
lesson: 22
tags: [nlp, embeddings, retrieval]
---

Given a corpus (size, languages, domain, avg length), deployment target (cloud / edge / on-prem), latency budget, and storage budget, output:

1. Model. Named checkpoint or API. One-sentence reason.
2. Dimension. Full / Matryoshka-truncated / int8-quantized. Reason tied to storage budget.
3. Mode. Dense / sparse / multi-vector / hybrid. Reason.
4. Query prefix / template if required by the model card.
5. Evaluation plan. MTEB tasks relevant to domain + held-out domain eval with nDCG@10.

Refuse recommendations that truncate Matryoshka to <64 dims without domain validation. Refuse ColBERTv2 for corpora under 10k passages (overhead not justified). Flag long-document corpora (>8k tokens) routed to models with 512-token windows.
```

## Egzersizler

1. **Easy.**100 cümleyi kodla `bge-small-en-v1.5`Tam olarak solum (384) ve sonra Matryoshka 128.
2. **Medium.**BGE-M3 yoğun, nadir ve colbert alanınızdan 500 bölümde karşılaştırın.
3. **Hard.**Top 2 alan görevlerinizde üç aday modelinde MTEB çalıştırın. MTEB puanı, 100 sorgu seri için p99 gecikme ve $ 1 milyon sorguları rapor edin. Pareto-optimal olanı seçin.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Dense embedding | The vector | One fixed-size vector per text. Cosine similarity for ranking. |
| Sparse embedding | Learned BM25 | One weight per vocab token; mostly zeros; trained end-to-end. |
| Multi-vector | ColBERT-style | One vector per token; MaxSim scoring; bigger index, better recall. |
| Matryoshka | Russian doll trick | First N dims are a valid smaller embedding on their own. |
| MTEB | The benchmark | Massive Text Embedding Benchmark — 56 tasks at launch, 100+ in v2. |
| BEIR | The retrieval benchmark | 18 zero-shot retrieval tasks; often cited for cross-domain robustness. |
| Asymmetric encoding | Query ≠ doc path | Model uses different projections for queries and documents. |

## Daha Fazla Okumak

- [Reimers, Gurevych (2019). Sentence-BERT](https://arxiv.org/abs/1908.10084) iki kodlayıcı kağıt.
- [Muennighoff et al. (2022). MTEB: Massive Text Embedding Benchmark](https://arxiv.org/abs/2210.07316) lider kartı kağıdı.
- [Chen et al. (2024). BGE-M3: Multi-lingual, Multi-functionality, Multi-granularity](https://arxiv.org/abs/2402.03216) teker teker üç mod model.
- [Kusupati et al. (2022). Matryoshka Representation Learning](https://arxiv.org/abs/2205.13147) boyut merdiven eğitim amacı.
- [Santhanam et al. (2022). ColBERTv2: Effective and Efficient Retrieval via Lightweight Late Interaction](https://arxiv.org/abs/2112.01488) İstehsalın geç etkileşimi.
- [MTEB leaderboard on Hugging Face](https://huggingface.co/spaces/mteb/leaderboard) canlı sıralamalar.
