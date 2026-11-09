# Hibrit bellek: vektör + grafik + KV

> Hibrit bellek paralel olarak üç depo çalışır  semantik benzerlik için vektör, hızlı gerçek arama için KV, varlık ilişkisi mantıklılığı için grafik  ve onları geri almakta birleştiren bir puanlama katmanı ile. Bu, dış bellek için yaygın olarak kullanılan bir üretim örneğidir; Mem0 (Chhikara et al., 2025) bir referans uygulanmasıdır.

**Type:** Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 07 (MemGPT), Phase 14 · 08 (Letta Blocks)
**Time:** ~75 minutes

## Öğrenme Hedefleri

- Tek bir depo (sadece vektör, sadece grafik, sadece KV) neden ajan hafızası için yeterli olmadığını açıklayın.
- Mem0'un üç paralel mağazasını ve her birinin ne için optimize ettiğini söyle.
- Mem0'un birleşme puanlaması  ilgililik, önem, yakınlık  ve neden bir hiyerarşi değil, ağırlıklı bir toplam olduğunu açıklayın.
- Bir oyuncak üç katlı hafıza uygulaması ile stdlib`add()`Bu üçü de birer.`search()`Bu sonuçları birleştirir.

## Sorun

Her mağaza üç sorgu sınıfından sadece birine uygun:

- **Semantic similarity**Vector kazanır, KV ve grafik kaybı.
- **Fact lookup** "kullanıcının telefon numarası nedir?" KV kazanır; vektör harcadır, grafik aşırı öldürür.
- **Relationship reasoning** " hangi müşteriler aynı faturalama kurumunu paylaşıyor?" Graf kazanır; vektör ve KV cevap veremez.

Üretim ajanları üçü de bir oturumda yayınlar. Tek depo belleği her zaman iki tane için yanlış. Mem0'un katkı üçü de tek bir araya getirmek.`add`- Ne ?`search`Bir puanlama fonksiyonu ile bir yüzeyde.

## Anlaşım

### Üç tane paralel mağazada.

Mem0 (arXiv:2504.19413, Nisan 2025)`add(text, user_id, metadata)`- ...

1. Teksten aday gerçekleri çıkarmak (LLM yönlendirilmiş bir adım).
2. Her faktörü semantik arama için vektör depolarına (kaynaklama) yazın.
3. Her faktörü klavye edilen KV depoya yaz (user_id, fact_type, entity) için $O(1)$- Arama.
4. Her faktörü ilişki sorguları için yazı tipleri olarak grafik depolarına (Mem0g) yazın.

- Evet .`search(query, user_id)`- ...

1. Vector store top-k'yi cosine ekleyerek geri gönderir.
2. KV depo sorgu kaynaklı (user_id, tür, varlık) anahtarlı doğrudan isabetleri gönderir.
3. Graf depo sorgu varlıklarından erişilebilir altgraf gönderir.
4. Bir puan tabaka üçü birleştirir.

### Füzyon puanlaması

```
score = w_relevance * relevance(q, record)
      + w_importance * importance(record)
      + w_recency * recency(record)
```

- **Relevance** vektör cosinus, KV tam eşleşme, grafik yol ağırlığı.
- **Importance** yazma zamanı veya öğrenilen (bazı gerçekler daha önemli: isimler, kimlikler, politikalar).
- **Recency** Son yazılı ya da okunmuş tarihten beri zaman içinde eksponensial çöküş.

Ürün başına ağırlıklar ayarlanır.`w_recency`Çat ajanları için; daha yüksek `w_importance`uyumlulık ajanları için; yüksek `w_relevance`- Çıkarma ajanları için.

### Memorandum ve zamanlı akıl yürütme

Mem0g bir çatışma algıcısı ekler. Yeni bir gerçek mevcut bir kenara zıt geldiğinde, mevcut kenar geçersiz olarak işaret edilir, ancak silinmez. Zaman sorguları ("Mart ayında kullanıcı şehri neydi?") geçerli zaman altgrafı üzerinden geçer.

Bu Letta'nın geçersizleştirme örneği genelleştirdiği uyum derecesi davranışıdır.

### Benchmark numaraları

Mem0 Raporu (2025):

- **LoCoMo**(uzun şekilli konuşma hafızası): 91.6
- **LongMemEval**(Uzun Uzak Uçaklıklı Bölümsel Hatırlama): 93.4
- **BEAM 1M**(1M-token hafıza referans değerinde): 64.1

Karşılaştırma temel hatları (tam bağlam 128k LLM, düz vektör depo, düz KV) hepsi 10+ puan kaybeder. Benchmarks tek başına seçim  işletim şekli  haklı çıkarmaz ama rakamlar füzyon tasarımı yuvarlama hatası olmadığını gösterir.

### Etkinlik taksonomisi

Mem0 hafızaları alanına göre bölüyor:

- **User memory** sesyonlar boyunca devam eder, kilitlenir `user_id`- Evet .
- **Session memory** tek bir iplik içinde kalır.
- **Agent memory** Agent başına durum durumu.

Her yazı bir alan seçer. Arama alanı boyunca arama yapabilir. alan ağırlıkları ile. Düşünmeden alanları karıştırmak "asistan Alice'e Bob'un projesi hakkında söyledi" olaylarını elde etmenin bir yolu.

### Bu kalıp yanlış gittiğinde

- **Embedding drift.**İlk yüz sorguda doğru görünen vektör sonuçları, korpus büyüdükçe bozulur.
- **KV schema creep.** `(user_id, type, entity)`Her takım kendi takımlarını ekleyecek kadar basit görünüyor .`type`- Çeyrek bir denetim yapın.
- **Graph explosion.**Bir gürültülü ekstraktör mesaj başına 50 kenar ekler.`add`- Evet. - Evet.

```figure
ae-memory-fusion
```

## Yapın

`code/main.py`stdlib'de üç katlı kalıp uygulanır:

- `VectorStore` bir yerleştirme yerine simge örtüşmesi benzerliği.
- `KVStore` dikte kilitli `(user_id, fact_type, entity)`- Evet .
- `GraphStore` Tiplenmiş kenarlar (subject, relation, object, valid).
- `Mem0` üst düzey fasası `add()`- Evet .`search()`, füzyon puanlaması ve kapsam farkındalıklı geri alım.
- Çok kullanıcılı, çok seanslı bir konuşmada çalışmış bir iz.

Çek şunu:

```
python3 code/main.py
npx tsx code/main.ts
```

Çıktı output üç ayrı geri çağırma yolunu artı top-k fuse eder.`main()`ve sıralamayı izle.

## Kullan

- **Mem0 (Apache 2.0)** üretim hazır. Postgres + Qdrant + Neo4j ile kendi kendine barındırın veya yönetilen bulut kullanın.
- **Letta** Üç katlı çekirdek/kızdırma/arşiv; kendi vektör ve grafik arka planlarını getir.
- **Zep** Zamanlı KG ve gerçek çıkarımı ile ticari alternatif.
- **Custom builds** ekstraktörün ( uyumluluk) veya füzyon ağırlıklarının (sonluk baskın olduğu ses ajanları) tam kontrolü gerektiğinde.

## Gönder

`outputs/skill-hybrid-memory.md`Füzyon skorlayıcı, kapsam taksonomisi ve zamansal geçersizliği kablo ile üç katlı bir bellek asfaltı üretir.

## Egzersizler

1. Oyuncak vektör benzerliğini gerçek bir gömleyici modeli ile değiştirin (cümle-transformers, Ollama, OpenAI gömleği).
2. Zaman sorguyu ekle: `search(query, as_of=timestamp)`Bu zamana kadar geçerli olan kayıtları geri verin.
3. Çatışma algılayıcısı uygulayın: Eğer gelen bir gerçek bir grafik kenarına aykırıysa, eski kenarı geçersiz kıl ve her ikisini de kaydet. "kullanıcı Berlin'de yaşıyor" -> "kullanıcı Lizbon'da yaşıyor" üzerinde test.
4. Füzyon skorunu bir `user_feedback`boyut (alınan kayıtlarda büyüklük). Oyun oynamayı nasıl önleyebilirsiniz (ajan sadece zaten beğendiği kayıtları iade eder)?
5. Mem0 belgeleri oku (`docs.mem0.ai`Oyuncakları buraya getir .`mem0`Aynı 20 test sorusunda çekim kalitesini karşılaştırın.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Hybrid memory | "Vector plus graph plus KV" | Three stores written in parallel, fused on retrieval |
| Fact extraction | "Memory ingestion" | LLM step that breaks text into (entity, relation, fact) tuples |
| Fusion scoring | "Relevance ranking" | Weighted sum of relevance, importance, recency |
| Scope | "Memory namespace" | user / session / agent — determines who sees what |
| Mem0g | "Memory graph" | Typed edges with temporal validity for relationship queries |
| Temporal invalidation | "Soft delete" | Mark contradicted edges invalid; never delete |
| Embedding drift | "Retrieval rot" | Vector quality degrades as corpus grows; re-embed periodically |

## Daha Fazla Okumak

- [Chhikara et al., Mem0 (arXiv:2504.19413)](https://arxiv.org/abs/2504.19413) orijinal kağıt
- [Mem0 docs](https://docs.mem0.ai/platform/overview) üretim API, SDK'lar, yönetilen bulut
- [Packer et al., MemGPT (arXiv:2310.08560)](https://arxiv.org/abs/2310.08560) Sanal bağlam öncesi
- [Letta, Memory Blocks blog](https://www.letta.com/blog/memory-blocks) Üç katlı kardeş tasarım
