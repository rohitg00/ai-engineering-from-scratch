# Hibrit Bellek: Vektör + Grafik + KV

> Hibrit bellek, üç depoyu paralel olarak çalıştırır - semantik benzerlik için vektör, hızlı gerçek arama için KV, varlık-ilişki muhakemesi için grafik - bunları geri alma sırasında birleştiren bir puanlama katmanı ile. Bu, harici bellek için yaygın olarak kullanılan bir üretim modelidir; Mem0 (Chhikara ve diğerleri, 2025) bir referans uygulamasıdır.

**Tür:** Yapım
**Diller:** Python (stdlib)
**Önkoşullar:** Aşama 14 · 07 (MemGPT), Aşama 14 · 08 (Letta Blokları)
**Süre:** ~75 dakika

## Öğrenme Hedefleri

- Tek bir deponun (yalnızca vektör, yalnızca grafik, yalnızca KV) agent belleği için neden yetersiz olduğunu açıklayın.
- Mem0'ın üç paralel deposunu ve her birinin neyi optimize ettiğini adlandırın.
- Mem0'ın füzyon puanlamasını (ilgililik, önem, güncellik) ve bunun neden bir hiyerarşi değil de ağırlıklı bir toplam olduğunu açıklayın.
- Üçüne de yazan bir `add()` ve sonuçları birleştiren bir `search()` ile stdlib'de üç depolu oyuncak bir bellek uygulayın.

## Sorun

Üç sorgu sınıfından biri için bir depo yanlış:

- **Anlamsal benzerlik** — "Geçen hafta agent kayması hakkında neyi tartıştık?" Vektör kazanır; KV ve grafik özledim.
- **Bilgi arama** — "Kullanıcının telefon numarası nedir?" KV kazanır; vektör israftır, grafik aşırıdır.
- **İlişki mantığı** — "hangi müşteriler aynı faturalandırma kuruluşunu paylaşıyor?" Grafik kazanır; vektör ve KV cevap veremez.

Prodüksiyon agent'lar üçünü de tek oturumda yayınlıyor. Tek depolu bellek bunlardan ikisi için her zaman yanlıştır. Mem0'ın katkısı, üçünü de tek bir `add`/`search` yüzeyinin arkasına, onları birleştiren bir puanlama işleviyle kablolamaktır.

## Konsept

### Paralel olarak üç mağaza

`add(text, user_id, metadata)` ile ilgili Mem0 (arXiv:2504.19413, Nisan 2025):

1. Aday gerçekleri metinden çıkarın (LLM odaklı bir adım).
2. Anlamsal arama için her olguyu vektör deposuna (embedding) yazın.
3. Her olguyu, O(1) araması için anahtarlanan KV deposuna (kullanıcı_id, olgu_tipi, varlık) yazın.
4. Her gerçeği, ilişki sorguları için yazılan kenarlar olarak grafik deposuna (Mem0g) yazın.

`search(query, user_id)` tarihinde:

1. Vektör deposu üst-k'yi embedding kosinüs ile döndürür.
2. KV deposu, sorgudan türetilen (kullanıcı_kimliği, tür, varlık) anahtarlanmış doğrudan isabetleri döndürür.
3. Grafik deposu, sorgu varlıklarından erişilebilen alt grafiği döndürür.
4. Puanlama katmanı üçünü birleştirir.

### Füzyon puanlaması

```
score = w_relevance * relevance(q, record)
      + w_importance * importance(record)
      + w_recency * recency(record)
```

- **Alaka düzeyi** — vektör kosinüs, KV tam eşleşme, grafik yol ağırlığı.
- **Önem** — yazma sırasında etiketlenir veya öğrenilir (bazı gerçekler daha önemlidir: adlar, kimlikler, politikalar).
- **Yenilik** — son yazma veya okumadan bu yana zaman içinde üstel azalma.

Ağırlıklar ürüne göre ayarlanır. Sohbet agent'leri için daha yüksek `w_recency`; uyumluluk agent'lar için daha yüksek `w_importance`; agent'leri almak için daha yüksek {`w_relevance`.

### Mem0g ve zamansal akıl yürütme

Mem0g bir çakışma dedektörü ekler. Yeni bir olgu mevcut bir sınırla çeliştiğinde mevcut sınır geçersiz olarak işaretlenir ancak silinmez. Geçici sorgular ("Kullanıcının Mart ayında şehri neydi?") o sırada geçerli alt grafiğin üzerinden geçer.

Bu, Letta'nın geçersiz kılma modelinin genelleştirdiği uyumluluk düzeyindeki davranıştır.

### Benchmark sayı

Mem0 makalesi şunları bildiriyor (2025):

- **LoCoMo** (uzun biçimli konuşma belleği): 91,6
- **LongMemEval** (uzun ufuklu epizodik bellek): 93,4
- **BEAM 1M** (1M-token bellek benchmark): 64,1

Karşılaştırma temel çizgilerinin (tam bağlamlı 128k LLM, düz vektör deposu, düz KV) tümü 10'dan fazla puan kaybediyor. Benchmark'ler tek başına seçimi haklı çıkarmaz - operasyonel şekil öyledir - ancak sayılar, füzyon tasarımının bir yuvarlama hatası olmadığını gösterir.

### Kapsam sınıflandırması

Mem0 belleği kapsama göre böler:

- **Kullanıcı belleği** — `user_id` ile anahtarlanan oturumlar boyunca kalıcı olur.
- **Oturum belleği** — tek bir iş parçacığı içinde kalır.
- **Agent bellek** — agent örnek durumu başına.

Her yazma bir kapsam seçer. Alma, kapsam başına ağırlıklarla kapsamlar arasında sorgulama yapabilir. Kapsamları düşünmeden karıştırmak, "asistanın Alice'e Bob'un projesinden bahsetmesi" olaylarını nasıl elde ettiğinizdir.

### Bu modelin yanlış gittiği yer

- **Embedding sapma.** İlk yüz sorguda tam olarak görünen vektör sonuçları, derlem büyüdükçe kötüleşir. En çok kullanılan N kaydın periyodik olarak yeniden-embedding tanesini ekleyin.
- **KV şeması sürünmesi.** `(user_id, type, entity)`, her takım kendi `type`'sini ekleyene kadar basit görünür. Tür kümesini üç ayda bir denetleyin.
- **Grafik patlaması.** Gürültülü bir çıkarıcı, mesaj başına 50 kenar ekler. Kap grafiği `add` çağrı başına yazar; güven düzeyi düşük kenarları bırakın.

## İnşa Et

`code/main.py`, stdlib'de üç mağazalı modeli uygular:

- `VectorStore` — embedding vekili olarak saf token-örtüşme benzerliği.
- `KVStore` — `(user_id, fact_type, entity)`'ye anahtarlanmış dikte.
- `GraphStore` — yazılan kenarlar (konu, ilişki, nesne, geçerli).
- `Mem0` — `add()`, {`search()`, füzyon puanlaması ve kapsama duyarlı erişim ile üst düzey görünüm.
- Çok kullanıcılı, çok oturumlu bir görüşme üzerinde çalışılmış bir izleme.

Çalıştır:

```
python3 code/main.py
```

Çıktı, üç ayrı geri çağırma yolunun yanı sıra birleştirilmiş üst-k'yi gösterir. `main()`'nin üst kısmındaki puanlama ağırlıklarını çevirin ve sıralama değişimini izleyin.

## Kullan onu

- **Mem0 (Apache 2.0)** — üretime hazır. Postgres + Qdrant + Neo4j ile kendi kendine barındırın veya yönetilen bulutu kullanın.
- **Letta** — üç katmanlı çekirdek/geri çağırma/arşiv; kendi vektör ve grafik arka uçlarınızı getirin.
- **Zep** — geçici KG ve gerçek çıkarma özelliğine sahip ticari alternatif.
- **Özel yapılar** — çıkarıcı (uyumluluk) veya füzyon ağırlıkları (yeniliğin hakim olduğu yerde ses agent'ler) üzerinde tam kontrole ihtiyaç duyduğunuzda.

## Gönderin

`outputs/skill-hybrid-memory.md`, bir füzyon puanlayıcı, kapsam taksonomisi ve kablolu geçici geçersiz kılma ile üç depolu bir bellek iskelesi oluşturur.

## Egzersizler

1. Oyuncak vektör benzerliğini gerçek bir embedding modeliyle değiştirin (cümle-transformers, Ollama, OpenAI embeddings). Sentetik uzun bir konuşmada geri çağırma@10'u ölçün. Sıralama 1000 yazmanın üzerinde değişiyor mu?
2. Geçici bir sorgu ekleyin: `search(query, as_of=timestamp)`. Yalnızca o tarihte veya öncesinde geçerli olan kayıtları döndürün. Hangi mağazanın en çok çalışmaya ihtiyacı var?
3. Bir çakışma algılayıcı uygulayın: Gelen bir olgu bir grafik kenarıyla çelişiyorsa, eski kenarı geçersiz kılın ve her ikisini de günlüğe kaydedin. "Kullanıcı Berlin'de yaşıyor" -> "Kullanıcı Lizbon'da yaşıyor" testini yapın.
4. Füzyon puanlayıcıyı bir `user_feedback` boyutu içerecek şekilde taşıyın (alınan kayıtlar beğenildi). Oyun oynamayı nasıl önlersiniz (agent yalnızca zaten beğendiği kayıtları döndürür)?
5. Mem0 belgelerini okuyun (`docs.mem0.ai`). Oyuncağı `mem0` müşteri çağrısına taşı. Aynı 20 test sorgusunda alma kalitesini karşılaştırın.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|----------------|------------------------|
| Hibrit bellek | "Vektör artı grafik artı KV" | Paralel yazılmış üç mağaza, erişim sırasında birleştirildi |
| Gerçek çıkarma | "Bellek alımı" | Metni (varlık, ilişki, gerçek) tuple'lara ayıran Yüksek Lisans adımı |
| Füzyon puanlaması | "İlgi sıralaması" | Alaka düzeyi, önem ve güncelliğin ağırlıklı toplamı |
| Kapsam | "Bellek ad alanı" | kullanıcı / oturum / agent — kimin neyi göreceğini belirler |
| Mem0g | "Bellek grafiği" | İlişki sorguları için zamansal geçerliliği olan yazılı kenarlar |
| Geçici geçersiz kılma | "Gecikmeli silme" | Çelişkili kenarları geçersiz olarak işaretleyin; asla silme |
| Embedding sürüklenme | "Çürüklüğü geri alma" | Derlem büyüdükçe vektör kalitesi düşer; periyodik olarak yeniden yerleştirin |

## Daha Fazla Okuma

- [Chhikara ve diğerleri, Mem0 (arXiv:2504.19413)](https://arxiv.org/abs/2504.19413) — orijinal makale
- [Mem0 docs](https://docs.mem0.ai/platform/overview) — üretim API'si, SDK'lar, yönetilen bulut
- [Packer ve diğerleri, MemGPT (arXiv:2310.08560)](https://arxiv.org/abs/2310.08560) — sanal bağlam öncülü
- [Letta, Memory Blocks blogu](https://www.letta.com/blog/memory-blocks) — üç katmanlı kardeş tasarım
