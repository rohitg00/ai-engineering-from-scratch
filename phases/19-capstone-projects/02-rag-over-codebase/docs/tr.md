# Capstone 02 — Kod Tabanı Üzerinden RAG (Çapraz Repo Semantik Arama)

> 2026'daki her ciddi mühendislik kuruluşu, yalnızca dizeleri değil, anlamı da anlayan dahili bir kod araması yürütüyor. Sourcegraph Amp, Cursor'un kod tabanı yanıtları, Augment'in kurumsal grafiği, Aider'ın repomatı, Pinterest'in dahili MCP'si — aynı şekil. Birçok depoyu alın, ağaç bakıcısıyla ayrıştırın, işlev ve sınıf düzeyindeki parçaları yerleştirin, hibrit arama yapın, yeniden sıralama yapın, alıntılarla yanıtlayın. Bu kapak taşı, 10 depoda 2 milyon satır kod işleyen ve her git push'ta artan yeniden indekslemeden sağ çıkan bir kod oluşturmanızı ister.

**Tür:** Kapak taşı
**Diller:** Python (besleme), TypeScript (API + kullanıcı arayüzü)
**Önkoşullar:** Aşama 5 (NLP temelleri), Aşama 7 (transformer'ler), Aşama 11 (LLM mühendisliği), Aşama 13 (araçlar), Aşama 17 (altyapı)
**Uygulanan aşamalar:** P5 · P7 · P11 · P13 · P17
**Süre:** 30 saat

## Sorun

2026 yılına kadar her sınır kodlaması agent bir kod tabanı alma katmanıyla birlikte gönderilir çünkü context window'ler tek başına çapraz repo sorularını çözemez. Claude'un 1M-token bağlamı yardımcı oluyor; sıralı erişim ihtiyacını ortadan kaldırmaz. Ham parçalar üzerindeki saf kosinüs araması, oluşturulan kodu, monorepo çoğaltmasını ve nadiren içe aktarılan sembollerin uzun kuyruğunu zehirler. Üretim yanıtı, sembol referanslarından oluşan bir grafikle desteklenen, yeniden sıralamaya sahip AST uyumlu parçalar üzerinde hibrit (yoğun + BM25) bir aramadır.

Bunu, tek bir eğitim deposunu değil, gerçek bir filoyu indeksleyerek ve MRR@10'u, alıntı doğruluğunu ve artan tazeliği ölçerek öğrenirsiniz. Arıza modları altyapısaldır: 100k dosyalık bir monorepo, dosyaların yarısını rötuşlayan bir itme, doğru yanıt vermek için dört repoyu geçmesi gereken bir sorgu.

## Konsept

AST uyumlu bir besleme ardışık düzeni, her dosyayı ağaç bakıcısıyla ayrıştırır, işlev ve sınıf düğümlerini çıkarır ve sabit token pencereleri yerine düğüm sınırlarındaki öbekleri çıkarır. Her parça üç temsil alır: yoğun bir embedding (Yolculuk kodu-3 veya nomic-embed-code), seyrek BM25 terimleri ve kısa bir doğal dil özeti. Özet, üçüncü bir geri alınabilir yöntem ekler; kullanıcılar "X nasıl yetkilendirilir" diye sorar ve özette, kodda yalnızca `check_permission` olsa bile "authz"dan bahsedilir.

Geri alma hibrittir. Bir sorgu hem yoğun hem de BM25 aramalarını başlatır, top-k'yi birleştirir ve birliği çapraz kodlayıcı yeniden sıralamaya (Cohere rerank-3 veya bge-reranker-v2-gemma-2b) aktarır. Yeniden sıralanan liste, her iddiayı dosya ve satır aralığına göre belirtme talimatlarını içeren uzun bağlamlı bir sentezleyiciye (prompt önbelleğe alma özelliğine sahip Claude Sonnet 4.7 veya kendi kendine barındırılan Llama 3.3 70B) gider. Alıntı yapılmayan yanıtlar son filtre tarafından reddedilir.

Artan tazelik altyapı sorunudur. Git push bir farkı tetikler: hangi dosyalar değişti, hangi semboller değişti. Yalnızca etkilenen parçalar yeniden yerleştirilir. Etkilenen dosyalar arası simge kenarları (içe aktarmalar, yöntem çağrıları) yeniden hesaplanır. Dizin, her işlemde 2 milyon satırın yeniden işlenmesine gerek kalmadan tutarlı kalır.

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

## Yığın

- Ayrıştırma: 17 dil gramerine sahip ağaç bakıcısı (Python, TS, Rust, Go, Java, C++, vb.)
- Yoğun embedding'lar: Voyage-code-3 (barındırılan) veya nomic-embed-code-v1.5 (kendi kendine barındırılan), bge-code-v1 geri dönüşü
- Seyrek indeks: BM25F ile Tantivy (Pas), sembol adına ve gövdeye göre alan ağırlıklı
- Vektör DB: Hibrit aramalı Qdrant 1.12 veya 50 milyon vektörün altındaki ekipler için pgvector + pgvectorscale
- Parça özeti modeli: Claude Haiku 4.5 veya Gemini 2.5 Flash, prompt-önbelleğe alınmış
- Yeniden sıralama: Cohere reranker-3 veya kendi kendine barındırılan bge-reranker-v2-gemma-2b
- Düzenleme: Besleme için LlamaIndex İş Akışları, agent sorgusu için LangGraph
- Sentezleyici: prompt önbelleğe alma ile Claude Sonnet 4.7 (1M bağlam)
- Sembol grafiği: İçe aktarma ve çağrı kenarları için Neo4j (yönetilen) veya kuzu (yerleşik)
- Observability: Langfuse erişim + sentez adımı başına yayılma alanı

## Build It — Kendin Geliştir

1. **Besleme yürüteç.** Git geçmişini her itme kancasında yineleyin. Değiştirilen dosyaları toplayın. Her dosya için ağaç bakıcısıyla ayrıştırın, işlev ve sınıf düğümlerini tam kaynak yayılımıyla birlikte çıkarın. `{repo, path, start_line, end_line, symbol, body}` parça kayıtlarını yayınla.

2. **Öbek özetleyici.** Sistem giriş bölümünde prompt önbelleğe alma ile Haiku 4.5 çağrılarına toplu yığınlar. Prompt: "Bu işlevi, genel sözleşmesini ve yan etkilerini belirterek bir cümleyle özetleyin." Özeti yığının yanında saklayın.

3. **Embedding havuzu.** İki paralel kuyruk: yoğun (Seyahat kodu-3 toplu 128) ve özet (aynı model, ancak özet dizesinde). `{repo, path, start_line, end_line, symbol, kind}` veri yüküne sahip vektörleri Qdrant'a yazın.

4. **BM25 dizini.** Alan ağırlıklı Tantivy dizini: sembol adı ağırlığı 4, sembol vücut ağırlığı 1, özet ağırlığı 2. "X yapan işlevi bul" sorgularının yanı sıra "X adlı işlevi bul" sorgularını etkinleştirir.

5. **Sembol grafiği.** Her yığın için kenarları kaydedin: içe aktarmalar (bu dosya, Z deposundaki Y sembolünü kullanır), çağrılar (bu işlev, C sınıfında M yöntemini çağırır), kalıtım. Kuzu'da saklayın. Repo sınırları boyunca alımı genişletmek için sorgu zamanında kullanılır.

6. **Sorgu agent.** Üç düğümlü LangGraph. `retrieve` yoğun + BM25'i paralel olarak ateşler, (repo, yol, sembol) tarafından tekilleştirilir. `rerank` çapraz kodlayıcıyı ilk 50'de çalıştırıyor ve ilk 10'da kalıyor. `synth` , bağlamda yeniden sıralanan parçalarla Claude Sonnet 4.7'yi çağırır, sistemi prompt önbelleğe alır, dosya:satır alıntıları gerektirir.

7. **Alıntı uygulaması.** Model çıktısını ayrıştırın; `(repo/path:start-end)` bağlantısı olmayan tüm talepler yeniden sorulmak üzere işaretlenir veya iptal edilir. Kullanıcıya yalnızca alıntı yapılan yanıtı döndür.

8. **Artımlı yeniden indeksleme.** Her web kancasında, sembol düzeyi farkını hesaplayın. Yalnızca metni değişen parçaları yeniden yerleştirin. İçe aktarımı değişen parçalar için sembol kenarlarını yeniden hesaplayın. Ölçü: 2M-LOC filosu için 60 saniyeden kısa sürede yeniden indekslenen 50 dosyalık bir gönderim.

9. **Değerlendir.** 100 çapraz repo sorusunu altın dosya:satır yanıtlarıyla etiketleyin. MRR@10, nDCG@10, alıntı doğruluğunu (doğrulanabilir dayanaklarla iddiaların oranı) ve p50/p99 gecikmesini ölçün.

## Use It — Hazır Araçla Uygula

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

## Ship It — Kullanıma Sun

Teslim edilebilir beceri `outputs/skill-codebase-rag.md`. Bir depo kümesi verildiğinde, besleme hattını, karma dizini ve agent sorgusunu ayağa kaldırır ve herhangi bir çapraz depo sorusu için alıntı yapılan bir yanıt döndürür. Bölüm:

| Ağırlık | Kriter | Nasıl ölçülür |
|:-:|---|---|
| 25 | Alma kalitesi | MRR@10 ve nDCG@10, 100 soruluk uzun bir sette |
| 20 | Alıntı sadakati | Doğrulanabilir dosya:satır bağlantılarına sahip yanıt taleplerinin oranı |
| 20 | Gecikme ve ölçek | indekslenmiş derlem boyutunda 10.000 QPS'de p95 sorgu gecikmesi |
| 20 | Artımlı indeksleme doğruluğu | Git Push'tan 50 dosyalık bir işlemde aranabilir hale gelene kadar geçen süre |
| 15 | UX ve yanıt biçimlendirmesi | Alıntı tıklanabilirliği, snippet önizlemeleri, takip uygunluğu |
| **100** | | |

## Egzersizler

1. Voyage-code-3'ü, kendi kendine barındırılan nomic-embed-code ile değiştirin. MRR@10 deltasını ölçün. Yeniden sıralama etkinleştirildiğinde farkın kapanıp kapanmadığını bildirin.

2. Oluşturulan kodun %20'sini (LLM tarafından üretilen ortak metin) derlemin içerisine enjekte edin ve yeniden değerlendirin. Geri alma zehirlenmesini gözlemleyin. Yüke "oluşturulmuş" bir bayrak ekleyin ve bu isabetlerin ağırlığını azaltın.

3. Benchmark Derlem boyutunuza göre Qdrant karma araması ile pgvector + pgvectorscale karşılaştırması. p99'u parti boyutu 1'de rapor edin.

4. Örneklemeye dayalı bir sapma kontrolü ekleyin: 100 soruluk değerlendirmeyi haftalık olarak yeniden çalıştırın. MRR@10 düşüşü > %5'e ilişkin uyarı.

5. Diller arası sembol çözümlemesini genişletin: gRPC üzerinden Go hizmetini çağıran bir Python işlevi. Bunları bağlamak için sembol grafiğini kullanın.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|-----------------|------------------------|
| AST uyumlu parçalama | "İşlev düzeyinde bölünmeler" | Sabit token pencere yerine ağaç bakıcısı düğüm sınırlarında kod kesme |
| Hibrit arama | "Yoğun + seyrek" | BM25'i çalıştırın ve vektör aramasını paralel olarak yapın, top-k'yi birleştirin, yeniden sıralayın |
| Çapraz kodlayıcı yeniden sıralaması | "İkinci aşama sıralaması" | Her bir (sorgu, aday) çiftini birlikte puanlayan model, kosinüs'ten daha doğrudur |
| Prompt önbelleğe alma | "Önbelleğe alınmış sistem prompt" | Tekrarlanan önek token'lari %90'a kadar azaltan 2026 Claude / OpenAI özelliği |
| Sembol grafiği | "Kod grafiği" | Dosyalar ve depolar arasında içe aktarma, çağrı ve devralma için uçlar |
| Alıntı sadakati | "Temelli yanıt oranı" | Kullanıcının bağlantıya tıklayarak ve başvurulan aralığı okuyarak doğrulayabileceği iddiaların oranı |
| Artımlı yeniden indeksleme | "Bas-arama süresi" | Git Push'tan değiştirilen sembollerin sorgulanabilir olmasına kadar duvar saati |

## Daha Fazla Okuma

- [Sourcegraph Amp](https://ampcode.com) — üretim çapraz repo kod zekası
- [Sourcegraph Cody RAG mimarisi](https://sourcegraph.com/blog/how-cody-understands-your-codebase) — bu temel taş için ayrıntılı referans incelemesi
- [Aider repo-map](https://aider.chat/docs/repomap.html) — ağaç bakıcısı dereceli repo görünümü
- [Augment Code kurumsal grafiği](https://www.augmentcode.com) — ticari sembol grafiği RAG
- [Qdrant karma arama belgeleri](https://qdrant.tech/documentation/concepts/hybrid-queries/) — referans uygulaması
- [Voyage AI code embeddings](https://docs.voyageai.com/docs/embeddings) — Voyage-code-3 ayrıntıları
- [Cohere rerank-3](https://docs.cohere.com/reference/rerank) — çapraz kodlayıcı referansı
- [Pinterest MCP dahili araması](https://medium.com/pinterest-engineering) — dahili platform referansı
