# Capstone 02  RAG over Codebase (Kross-Repo Semantic Search)

> 2026'da her ciddi mühendislik kurumu sadece ipler değil, anlamı anlayan bir iç kod arama yürütüyor. Kaynak grafikleri Amp, Cursor'un kod tabanı yanıtları, Augment'ın işletme grafikleri, Aider'in yeniden haritası, Pinterest'in iç MCP  aynı şekil. Birçok repoyi yedik, ağaç bakıcısı ile analiz ettik, işlev ve sınıf seviyesindeki parçaları yerleştirdik, hibrid arama, yeniden sıralama, alıntılarla cevap. Bu son taş, 10 repo üzerinden 2 milyon satır kod ele alan ve her git itme ile artışlı yeniden indekslemeyi sağlayan bir tane oluşturmanızı ister.

**Type:** Capstone
**Languages:** Python (ingestion), TypeScript (API + UI, retrieval scaffold)
**Prerequisites:** Phase 5 (NLP foundations), Phase 7 (transformers), Phase 11 (LLM engineering), Phase 13 (tools), Phase 17 (infrastructure)
**Phases exercised:**P5 · P7 · P11 · P13 · P17
**Time:** 30 hours

## Sorun

2026 yılına kadar her sınır kodlama ajanı bir kod tabanı geri alma katmanı ile gemiye gönderir çünkü bağlam pencereleri tek başına çapraz rep sorularını çözmez. Claude'un 1M-token bağlamı yardımcı olur; sıralama geri alım ihtiyacını ortadan kaldırmaz. Hırslı bir şekilde zehir parçacıkları üzerinde yapılan bir araştırma, üretilen kod, monorepo kopyalama ve nadiren ithal edilen sembollerin uzun kuyruğuna yol açar. Üretim cevabı, bir sembol referansları grafikinden desteklenen bir re-ranker ile AST-a bilinçli parçalar üzerinde hibrit ( yoğun + BM25) arama.

Bunu gerçek bir filoyu indeksiyle öğrenirsiniz  bir ders repo değil  ve MRR@10, alıntı sadakati ve artan tazeliği ölçerek. Başarısızlık modları altyapısal: 100k dosya monorepo, dosyaların yarısını retouch eden bir itki, doğru cevap vermek için dört repos'u geçmesi gereken bir sorgu.

## Anlam

AST-ağlı bir yedik pipeline her dosyayı ağaç-sitter ile analiz eder, işlev ve sınıf düğümlerini çıkarır ve sabit token pencereler yerine düğüm sınırlarında parçalar yapar. Her parça üç temsil elde eder: yoğun bir yerleştirme (Voyage-code-3 veya nomik-embed-code), nadir BM25 terimleri ve kısa bir doğal dil özet. Özet üçüncü bir geri alabilir modalite ekler  kullanıcılar "X nasıl yetkili" sorar ve özet sadece kodun `check_permission`- Evet .

Geri çekim hibrid. Bir sorgu hem yoğun hem de BM25 aramaları ateşler, üst-k'yi birleştirir ve sendikayi çapraz kodlayıcı bir yeniden sıralamacıya (Cohere rerank-3 veya bge-reranker-v2-gemma-2b) verir. Yeniden sıralanan liste, her iddiayı dosya ve satır aralığı ile alıntılama talimatları ile uzun bağlamlı bir sentezleyiciye (Claude Sonnet 4.7'e hızlı önbelleğe veya Llama 3.3 70B'ye) gider. İpuçsuz cevaplar post-filtre ile reddedilmektedir.

Git push, hangi dosyaların değiştirildiğini, hangi sembollerin değiştirildiğini belirler. Sadece etkilenen parçalar yeniden yerleştirilir. etkilenen dosya çapraz sembol kenarları (gelenekler, yöntem çağrıları) yeniden hesaplanır. İndeks her commit'in 2M satırını yeniden işlemeyi gerektirmeden tutarlı kalır.

## Mimarlık

```
git push --> webhook --> ingest worker (LlamaIndex Workflow)
                           |
                           v
             tree-sitter parse + AST chunk
                           |
            +--------------+----------------+
            v              v                v
          dense        BM25 index       summary (LLM)
        (Voyage / bge)  (Tantivy)        (Haiku 4.5)
            |              |                |
            +------> Qdrant / pgvector <----+
                            |
                            v
                      symbol graph (Neo4j / kuzu)
                            |
  query --> LangGraph agent (retrieve -> rerank -> synth)
                            |
                            v
                 Claude Sonnet 4.7 1M context
                            |
                            v
                 answer + file:line citations
```

## Yüküm

- Parsing: 17 dil gramerli ağaç bekçisi (Python, TS, Rust, Go, Java, C++, vb.)
- Sıkı yerleşimler: Voyage-code-3 (hosted) veya nomik-embed-code-v1.5 (self-host), bge-code-v1 fallback
- Sparse indeks: Tantivy (Rust) BM25F ile, simge adı vs. vücut üzerinde alan ağırlığı
- Vektor DB: Qdrant 1.12 hibrit arama veya pgvector + pgvector ölçeği ile 50M vektörden küçük takımlar için
- Bölüm özet modeli: Claude Haiku 4.5 veya Gemini 2.5 Flash, hızlı bir şekilde önbelleğe alınmıştır
- Yeniden sıralama: Koher yeniden sıralama-3 veya bge-re-ranker-v2-gemma-2b kendi kendine konutlandırılmış
- Orkestrasyon: LlamaIndex İş akışları yedikleri için, LangGraph sorgu ajanı için
- Sintezör: Claude Sonnet 4.7 (1M bağlamı) hızlı önbelleğe sahip
- Simbol grafikleri: Neo4j (yönetilen) veya kuzu (aşıtlanmış) ithalat ve çağrı kenarları için
- Gözlem: Langfuse süreleri, her bir çekim + sentez aşamasında

```figure
ce-hybrid-retrieval
```

## Yapın

1. **Ingestion walker.**Git geçmişini her tıklama hokunda tekrarlayın. Değiştirilmiş dosyaları toplayın. Her dosya için, ağaç bakıcısı ile analiz edin, çıkarma işlevi ve sınıf düğümleri ile tam kaynak uzantısı.`{repo, path, start_line, end_line, symbol, body}`- Evet .

2. **Chunk summarizer.**Haiku 4.5 çağrılarına batch parçaları sistem önbellekinde hızlı bir şekilde önbelleğe alınır. "Bu işlevi bir cümleyle özetle, kamu anlaşması ve yan etkileri adını koyun".

3. **Embedding pool.**İki paralel sırada: yoğun (Voyage-code-3 parti 128) ve özet (aynı model, ancak özet zincirinde).`{repo, path, start_line, end_line, symbol, kind}`- Evet .

4. **BM25 index.**Alan ağırlığı Tantivy indeksi: sembol adı ağırlığı 4, sembol vücut ağırlığı 1, özet ağırlığı 2. "X adı verilen fonksiyonu bul" sorgularını "X yapan fonksiyonu bul" ile birlikte etkinleştirir.

5. **Symbol graph.**Her parça için kayıt kenarları: ithalat (bu dosya repo Z'den Y sembolünü kullanır), çağrılar (bu işlev C sınıfında M yöntemi çağırır), miras. kuzu'da saklayın. Arama sırasında repo sınırları üzerinden geri alımı genişletmek için kullanılır.

6. **Query agent.**LangGraph'ın üç düğümü var.`retrieve`yoğun ateşler + BM25 paralel olarak, (repo, yol, sembol) ile çoğaltılır. `rerank`Top-50'e çapraz kodlayıcıyı çalıştırır ve top-10'u tutar.`synth`Claude Sonnet 4.7'i bağlamda yeniden sıralamalı parçalarla çağırır, sistem istasyonunu önbelleğe alır, dosya:satır alıntılarını gerektirir.

7. **Citation enforcement.**Model çıkışını analiz edin .`(repo/path:start-end)`Anchor tekrar sormak için işaretlenir veya bırakılır. Kullanıcıya sadece alıntılı cevaplar gönderin.

8. **Incremental re-index.**Her webhauk'ta, sembol düzeyinde farkı hesaplayın. Tekrar yerleştirilen metin değiştirilen parçalar. İçe aktarılan parçalar için sembol kenarlarını yeniden hesaplayın. Ölçüm: 2M-LOC filosu için 60 saniyeden kısa bir sürede 50 dosya yeniden indeksiye edilmesi.

9. **Eval.**100 çapraz reposu sorusunu altın dosya ile etiketlenir: hat cevapları. MRR@10, nDCG@10, alıntı sadakati (anchor verilebilir iddiaların bir kısmı) ve p50/p99 gecikme ölçüleri.

## Kullan

```
$ code-rag ask "how is S3 multipart abort wired into our retry budget?"
[retrieve]  12 chunks dense + 7 chunks bm25, 16 unique after dedup
[rerank]    top-5 kept (cohere rerank-3)
[synth]     claude-sonnet-4.7, cache hit rate 68%, 2.1s
answer:
  Multipart aborts are triggered by `AbortMultipartOnFail` in
  services/uploader/retry.go:122-148, which decrements the per-bucket
  retry budget defined in config/budgets.yaml:34-51 ...
  citations: [services/uploader/retry.go:122-148, config/budgets.yaml:34-51,
              libs/s3client/multipart.ts:44-61]
```

## Gönder

Yapabilir yetenekler `outputs/skill-codebase-rag.md`. Bir depo korpusu verildiğinde, içme borusunu, hibrit indeksini ve sorgu ajanını ortaya çıkarır ve her türlü rekabetçi soruya alıntılı bir cevap verir.

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | Retrieval quality | MRR@10 and nDCG@10 on a 100-question held-out set |
| 20 | Citation faithfulness | Fraction of answer claims with verifiable file:line anchors |
| 20 | Latency and scale | p95 query latency at 10k QPS on the indexed corpus size |
| 20 | Incremental indexing correctness | Time from git push to searchable on a 50-file commit |
| 15 | UX and answer formatting | Citation clickability, snippet previews, follow-up affordance |
| **100** | | |

## Egzersizler

1. Voyage-code-3'i isimli-ekleme kodu kendine konutlanmış olarak değiştirin. MRR@10 delta ölçülür. Yeniden sıralama etkinleştirildiğinde boşluk kapatılıp kapatılmadığını bildirin.

2. %20 üretilen kod (LLM üretilen kazanplate) i corpus'a enjekte edin ve yeniden değerlendirin. Alım zehirlenmesini gözlemleyin. Faydalı yükü "yüklenmiş" bir bayrak ekleyin ve bu vurguları azaltın.

3. Benchmark Qdrant hibrid arama vs pgvector + pgvector ölçeği korpus boyutunuzda.

4. Örnekleme tabanlı bir sürükleme kontrolü ekleyin: haftalık, 100 sorunun değerlendirilmesini tekrarlayın. MRR@10 düşüşü> 5% uyarın.

5. GRPC üzerinden bir Go hizmetini çağıran Python fonksiyonu.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| AST-aware chunking | "Function-level splits" | Cutting code at tree-sitter node boundaries instead of fixed token windows |
| Hybrid search | "Dense + sparse" | Run BM25 and vector search in parallel, merge top-k, rerank |
| Cross-encoder rerank | "Second-stage rank" | Model that scores each (query, candidate) pair together, more accurate than cosine |
| Prompt caching | "Cached system prompt" | 2026 Claude / OpenAI feature that discounts repeat prefix tokens up to 90% |
| Symbol graph | "Code graph" | Edges for imports, calls, inheritance across files and repos |
| Citation faithfulness | "Grounded answer rate" | Fraction of claims a user can verify by clicking the anchor and reading the referenced span |
| Incremental re-index | "Push-to-search time" | Wall-clock from git push to the changed symbols being queryable |

## Daha Fazla Okumak

- [Sourcegraph Amp](https://ampcode.com) üretim çapraz rapor kod bilgisi
- [Sourcegraph Cody RAG architecture](https://sourcegraph.com/blog/how-cody-understands-your-codebase) Bu taşın referans derin dalışı
- [Aider repo-map](https://aider.chat/docs/repomap.html) ağaç bakıcısı sıralamalı repo görünümü
- [Augment Code enterprise graph](https://www.augmentcode.com) Ticari sembol-grafi RAG
- [Qdrant hybrid search docs](https://qdrant.tech/documentation/concepts/hybrid-queries/) Referans uygulanması
- [Voyage AI code embeddings](https://docs.voyageai.com/docs/embeddings) Gezi kodu-3 detayları
- [Cohere rerank-3](https://docs.cohere.com/reference/rerank) Çaplak kodlayıcı referansı
- [Pinterest MCP internal search](https://medium.com/pinterest-engineering) İç platform referansı
