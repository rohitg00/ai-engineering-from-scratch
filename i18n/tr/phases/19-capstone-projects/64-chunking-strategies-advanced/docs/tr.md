# Çürükler, karşılaştırıldığında

> Çüklenme, geri dönüş cihazının neyi yüzeye çıkaracağını belirler.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 11 lessons 04 (embeddings), 06 (RAG), 07 (advanced RAG); Phase 19 Track B foundations (lessons 20-29)
**Time:** ~90 minutes

## Öğrenme Hedefleri
- Beş parçalanma stratejisini sıfırdan uygulayın: sabit pencere, cümle, rekürsiv bölünme, semantik kümeler ve yapısal işaretleme başlıkları.
- Altın etiketli cevap aralıkları olan bir cihaz korpusunda hatırlatma ölçümünü yapın ve bir stratejinin neden prozada ve farklı bir stratejinin teknik belgelerde kazanmasının nedenini açıklayın.
- Bir parça uzunluğu dağılımını okuyun ve her stratejinin enjekte ettiği başarısızlık modlarını tanıyın: yetim cümleler, orta sembol kesimleri, sadece başlıklı parçalar, semantik sürükleme.
- Referans değerini çalıştırmadan yeni bir korpus için varsayılan bir seçenek seçin, üç özelliği kontrol ederek: belge türü, ortalama paragraf uzunluğu ve biçimin açık bir yapısı olup olmadığını.

## Sorun

RAG boru hattı, kaynak belgeleri, bir gömleyici modeli onlara uymayacak kadar küçük ve her parça kendi kendine bir fikir taşıyacak kadar büyük parçalara keserek başlar.

"Büjetten kesinti eşiğinin nasıl görüneceği" sorusunu soran sorgu, sadece kesinti eşiğinin bulunduğu parçaya ulaşılırsa başarılı olabilir. Eğer sabit pencere bölücü çevredeki bağlamdan eşiğin değerini keserse, yerleştirme farklı bir kümeye taşınır, BM25 puanı düşer, yeniden sıralamacılar gürültü görür ve LLM'nin oluşturduğu cevap yanlış olur. 2024'te yayınlanan "LongRAG: Long-context LLM ile Retrieval-Augmented Generation Enhancing" makalesinde, sadece parçalanma seçeneğinden elde edilen geri çağırışın yüzde 35 mutlak bir değişikliğini ölçtü. 2025'te bağlamlı parça başlıkları üzerinde yapılan takip çalışmaları boşluğu azaltmış, ama kapatmamıştır.

Bu ders beş stratejiyi bir arada oluşturur, altın etiketli cevap aralığı olan bir sabitleme korpusuna karşı çalışır ve çağrı numaralarını kendiniz okuyabilirsiniz.

## Anlaşım

```mermaid
flowchart LR
  Doc[Source Document] --> S1[Fixed Window]
  Doc --> S2[Sentence]
  Doc --> S3[Recursive Split]
  Doc --> S4[Semantic Cluster]
  Doc --> S5[Structural Markdown]
  S1 --> Chunks1[Chunks]
  S2 --> Chunks2[Chunks]
  S3 --> Chunks3[Chunks]
  S4 --> Chunks4[Chunks]
  S5 --> Chunks5[Chunks]
  Chunks1 --> Index[Embedding Index]
  Chunks2 --> Index
  Chunks3 --> Index
  Chunks4 --> Index
  Chunks5 --> Index
  Index --> Eval[Recall@k vs Gold Spans]
```

### Sıkı penceresi

N pozisyonunda kesilen cümle, N pozisyonunda başlayan parçacık içinde tamamlanmış olarak görünmektedir. Hattı, belirleyici, sınırlarda korkunç. Onu kontrol olarak kullan, varsayılan değil.

### Ceza

Bir cümle sınırlarını regex veya basit bir devlet makinesi ile bölün. Bir veya daha fazla cümleyi hedef karakter bütçesine kadar bir parçaya paketleyin. Sözcük orta kesmeyi bırakın. Yine de paragrafın orta ve bölümün orta kesmesini kesin. Bir çok erken RAG boru hattında varsayılan ve başka bir yapısı olmayan prose için makul bir seçim.

### Tekrar bölünme

2023 döneminde kütüphaneler tarafından popülerleştirilen hiyerarşi stratejisi. Önce en güçlü ayırıcıyı bölmeye çalışın (iki yeni satır, paragraf), bir sonrakiye (tek yeni satır), sonra cümlelere, sonra karakterlere geri dönün.

### Semantik gruplama

Her cümleyi yerleştir. Bir konu merkezi paylaşan bitişik cümleleri kümeler. Merkez merkezi ile aynı çalışmanın bir eğiliminin altında düştüğünde kesin. Sınırlar karakterleri değil anlamı yansıtır. İnşa etmekte yavaş ve yerleştirme modeline bağlıdır, ancak bir paragrafın içinde konuları değiştiren belgelere karşı dayanıklıdır.

### Yapısal belirleme başlıkları

Açık bir yapısı olan belgeler için (markalı, yeniden yapılandırılmış metin, RFC tarzı numaralı bölümler), başlık sınırlarında kesin. Her parça başlık artı altındaki her şeyle aynı veya daha yüksek düzeyde bir sonraki başlığa kadar aşağıya düşer. Konu başına en küçük parçalar, ancak sadece korpus iyi biçimlendirilince kullanılabilir.

### Remall@k sınır seçimini nasıl ölçer

Altın etiketli bir sorgu, kaynak belgesinin içindeki cevap aralığının tam karakter karşılığını taşır. Parçalardan sonra soruyorsunuz: Retriever'in geri verdiği üst-k parçalardan biri altın aralığı üzerinde örtüşüyor mu? Eğer evet ise, bu sorunun için recall@k 1'dir. Eğer hayırsa, 0'dur. Sorgu kümesi boyunca ortalama. Her strateji için aynı değerlendirmeyi yapın ve spread size hangi sınır politikası korpusunuzun hayatta kaldığını gösterir.

```figure
ci-chunk-boundaries
```

## Yapın

`code/main.py`Uygulamaları:

- `fixed_window(text, size, overlap)`- Temel çizgi.
- `sentence_chunks(text, target)`- basit cümle paketleme.
- `recursive_split(text, separators, target)`- Hiyerarşik bir geri dönüş.
- `semantic_chunks(text, similarity_threshold)`- Deterministik simge yerleştirme üzerine merkezli gruplama.
- `structural_markdown(text)`- Başlık farkındalıklı bir bölücü.
- `mock_embed(text, dim)`- bir hash tabanlı yerleştirme böylece döngü çevrimdışı çalışır.
- `DenseIndex`- Fase 19'da kullanılan şekil, B'nin hibrid çekim dersinde de kullanılmıştır.
- `eval_recall(strategy, corpus, queries, k)`- karşılaştırma döngüsü.
- A.`main()`Bu sistem, her stratejiyi sabitleme sisteminde çalıştırır ve bir geri çağırma tablosunu basar.

Çek şunu:

```bash
python3 code/main.py
npx tsx code/main.ts
```

Çıkış, strateji başına bir satır ve k başına bir sütun olan küçük bir tablo. Satıs yapılandırılmış ayar üzerinde kaybedir. Struktürel işaretleme, işaretleme ayarında kazanır. Rekürsif, karışık ayar üzerinde kendiliğinden tutar çünkü rekürsiyon uyarlanır.

## Başarısız modlar masa gizlenmeyecek

**Orphan sentences.**Cevap paketlemesi, konu cümlesini kaçırmış parçalar üretir.

**Mid-symbol cuts.**Sıkı pencerede iç kod veya YAML bir kimliği ikiye bölür.

**Header-only chunks.**Yapısal bir markalıma , sadece `## Title`Onları filtreleyin veya bir sonraki bölümün ilk paragrafını ekleyin.

**Semantic drift.**Semantik gruplama, korpusun aynı şekilde konuya yer verdiği zaman kısaltma yapar. 5000 karakterli bir parça, birçok belirli cevabı bir yayılmış yerleştirme içine paketler. Semantik'i sert bir karakter kapakla birleştirir.

**Stale embeddings.**Semantik gruplama bir gömleyici modeli kullanır. Eğer modeli değiştirirseniz, parçaları da değiştirirsiniz. parça modeliyi geri alma modeliden ayrı olarak sabitleyin veya indeksyi yeniden birlikte oluşturun.

## Benchmark çalıştırılmadan varsayılan bir seçenek seçmek

Üç özellik yeni bir korpus için varsayılan parçayı belirler.

| Property | Value | Default |
|----------|-------|---------|
| Document type | Prose with no structure | Recursive split, target 800 |
| Document type | Markdown / RFC / API docs | Structural markdown |
| Document type | Code | AST-aware (out of scope; see Phase 19 lesson 02) |
| Paragraph length | Long, single topic | Sentence, target 500 |
| Paragraph length | Short, mixed topics | Semantic, threshold 0.6 |

Şüphe olduğunda, rekürsiv bölünme seçin.

## Kullan

Üretim biçimleri:

- Yeni bir boru hattı göndermeden önce değerlendirmeyi çalıştırın; kütüphanenizde varsayılan stratejiye güvenmeyin.
- Eklenti modeli veya corpus karışımı değiştirdiğinizde değerlendirmeyi tekrar çalıştırın; kazanan corpus bağımlıdır.
- Her parça metadatalarında strateji adını kalıcı olarak kullanın böylece daha sonra geri dönüşler yapabilersiniz.

## Gönder

Dönüş F sonu sonu RAG sistemi 69 ders burada seçilen chunker kullanır ilk aşama olarak.`eval_recall`Bu derste kazanılacak stratejiyi seçin ve onu ilerlet.

## Egzersizler

1. Altıncı strateji ekle: token- penceresi kullanılarak `tiktoken`Karakter sayımı yerine aynı cihazdaki sabit pencerelere karşı karşılaştır.
2. Programın yazılı kısmının %30'unu yazın, tabloyu tekrar çalıştırın ve yapısal belirleme dışında tüm stratejilerin neden hatırlanmadığını açıklayın.
3. Projenizin gerçek sağlayıcısından gelenine göre belirleyici yerleştirmeyi değiştirin. Semantik gruplama geri çağırma delta'sını ölçün. Stratejiler arasındaki farkın genişleyip daralmadığını bildirin.
4. Bir ekle`summary`Bölüm başına alan: bir cümlelik bir merkez çizgisinin açıklaması. Bölüm bedenine eklenen özetle değerlendirmeyi tekrar çalıştırın.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Recall@k | "Did we get the right chunk?" | Fraction of queries where any of the top-k chunks overlaps the gold answer span |
| Chunk overlap | "Sliding window" | Re-include the last N characters of the previous chunk in the next chunk |
| Structural splitter | "Header-aware chunks" | Cut at H1/H2/H3 boundaries; the heading text is part of the chunk |
| Semantic chunker | "Topic-aware chunks" | Embed sentences, cluster by centroid similarity, cut on drift |
| Centroid drift | "Topic shift" | Cosine similarity between the running mean and the next sentence drops past a threshold |

## Daha Fazla Okumak

- [LongRAG: Enhancing Retrieval-Augmented Generation with Long-context LLMs (arXiv 2406.15319)](https://arxiv.org/abs/2406.15319)
- [Anthropic, Contextual Retrieval](https://www.anthropic.com/news/contextual-retrieval)
- [LlamaIndex, Chunking strategies for production RAG](https://docs.llamaindex.ai/en/stable/optimizing/production_rag/)
- EY 11 Ders 06 - RAG Temellikleri
- Eğitim Fase 11 Ders 07 - Gelişmiş RAG
- Fase 19 ders 65 - burada üretilen parçaları sıralayan hibrit geri alım
- Eğlence 19 ders 68 - üretimdeki strateji seçimini notlayan değerlendirme harmanı
