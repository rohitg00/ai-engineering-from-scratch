# Async ve Hogwild!

> Spekülatör çözme (Fase 10 · 15) bir dizi içinde simgeler paralelleştirir. Çoklu ajan çerçeveleri bütün diziler boyunca paralelleşir ancak açık bir koordinasyonu zorlar (sayma, alt görev bölüşümü). Hogwild! Inference (Rodionov et al., arXiv:2504.06261) başka bir şey yapar: aynı LLM'nin N örneklerini paralel olarak SHARED anahtar değerleri önbelleği ile çalıştırın. Her işçi diğer işçilerin oluşturduğu simgelerini anında görür. Modern akıl yürütme modelleri  QwQ, DeepSeek-R1  herhangi bir ince ayarlama yapmadan paylaşılan bu önbelleği aracılığıyla kendi kendini koordine edebilir. Bu yaklaşım deneysel ama bu, spekülasyonu çözmeye ortogonal olarak oturan bir sonuç paralelliğinin tamamen yeni bir eksisini açar. Bu ders, iki işçi Hogwild'i uyguluyor! stdlib Python'da simülatör ve ortak önbelleği işbirliğinin mevcut modelin akıl yürütme yeteneklerinden neden ortaya çıktığını açıklar.

**Type:** Build
**Languages:** Python (stdlib), Rust
**Prerequisites:** Phase 10 · 12 (inference optimization), Phase 10 · 15 (speculative decoding)
**Time:** ~60 minutes

## Öğrenme Hedefleri

- Üç ortak paralel LLM topolojisini (sayfalama, alt görev, Hogwild!) ve her birinin hedefleri olan sorunları tanımlayın.
- Hogwild'in temel kurulumunu belirtin: birden fazla işçi, bir KV önbelleği, kendini uyararak gelişen koordinasyon.
- Hogwild'in duvar-zaman hızlandırmasını işçi sayısının işlevi olarak hesaplayın.`N`, görev düzeyinde paralellik `p`, koordinasyon genel maliyetleri `c`- Evet .
- Bir oyuncak sorunu üzerinde Hogwild! simülatörü uygulayın ve ortaya çıkan görev bölümü izleyin.

## Sorun

Modern LLM'ler uzun mantık zincirleri üreterek zor sorunları çözüyor. 5000 tane adım adım mantık yaygın, derin matematik sorunlarında on binlerce tane olur. 70B modelinde 35 tane / saniye dekodda, 50k token 24 dakikadır.

Speküel dekodlama (Fase 10 · 15) bir dizi içinde paralelleştirerek 3-5x hızlandırma sağlar. Autoregressive dekodlamanın sıralı bağımlılığı sert tavan. Her yeni token önceki her token'a bağlıdır.

Açık bir soru: Seanslar arasında paralellik kurabilir miyiz? Aynı modelin birden fazla kopyasını aynı soruya çalıştırır, işbirliği yapsınlar, çalışmayı bölsünler mi?

Önceki çalışma: oylama grupları (N modelleri çalıştırın, çoğunluk cevabını seçin), düşünce ağacı (branch reasoning paths ve rekombine), ve çoklu ajan çerçeveleri (her ajanı bir alt görevlendirin, koordinatör kullanın). Bunlar, belirli görev alanlarında yardımcı olur.

Hogwild! İtiraf farklı bir yaklaşım kullanır. N çalışanları tek bir KV kaydını paylaşıyor. Her işçi, diğer işçinin oluşturduğu simgelerini hemen kendi bağlamı gibi görür. İşçiler  hiçbir eğitim veya ince ayarlama olmadan  işi nasıl bölüştüreceklerini bulurlar. Modern akıl yürütme modelleri (QwQ, DeepSeek-R1, Claude-aile akıl yürütme modu) paylaşılan önbellekleri okuyabilir ve "İşçi 2'nin temel vaka ile ilgilenmiş olduğunu görüyorum, bu yüzden induktif adım üzerinde çalışacağım" gibi şeyler söyleyebilirler.

Hızlandırma, iş yüküne bağlı ve Nisan 2026 itibariyle deneysel. Ama fikir bilmeye değer çünkü sonuç paralelliğinin yeni bir eksisini açar.

## Anlaşım

### Yapılandırma

N işçi işlemlerini başlatın, hepsi aynı LLM çalıştırıyor. İşçi başına KV önbelleği yerine, ONE paylaşılan önbelleği koruyun. İşçi `i`Token oluşturur .`t_j`İşçi, işçiyi bir sonraki pozisyonda paylaşılmış depoya yazar.`k`Bir sonraki adımı atınca, bu depoya ait olan mevcut durumu okuyor (bu süre zarfında tüm N çalışanları tarafından oluşturulan her şeyi içerir).

Adım zamanında işçiler jeton yazmak için yarışırlar. İşçi başına konum endeksi yoktur  önbelleği tek bir büyüyen dizidir.

### Koordinasyon neden ortaya çıkıyor?

İşçiler bir uyarı paylaşırlar. Genellikle "Bu sorunda birlikte çalıştığınız N örneklerden biriysiniz. Her örnek paylaşılan hafızayı okuyor ve diğer örneklerin ne yazdığını görebiliyor. Fazla iş yapmaktan kaçının". Dönüşümsel modeller önbelleği okuyor, sorunun hangi bölümlerinin zaten denediğini fark ediyor ve (sık sık ama her zaman değil) keşfedilmemiş bölümlere dönüyor.

Hogwild! makalesinde (Rodionov et al., 2025) şunlar gibi gözlemler bildirilmiştir:

- İşçiler planları formüle eder ve onları diğer işçilere önbelleği aracılığıyla iletir.
- İşçiler diğer işçilerin mantıklarında hatalar fark eder ve onları çağırır.
- İşçiler bir plan başarısız olduğunda uyum sağlar ve alternatif öneriler sunar.
- İşçiler işten çıkarılmaya teşvik edildiğinde, işten çıkarıldıklarını fark eder ve döner.

Bu durumların hiçbirinde ince ayarlama gerekmez. Yeni gelişen davranış modelin zaten sahip olduğu mantık yeteneklerinden kaynaklanmaktadır.

### Adlandırma

Makale adı, asinkron güncelleme optimizer olan Hogwild! SGD'ye (Recht et al., 2011) atfeder. Analogya: SGD'nin asinkron işçileri hepsi ortak bir parametrel vektörüne yazıyor; Hogwild! Inference işçileri hepsi ortak bir KV önbelleğe yazıyor. Her ikisi de senkronizasyon garantileri yerine empiriyel birleşmeye dayanıyor.

### RoPE bu işlemleri kolaylaştırır.

Rotary Position Embeddings (RoPE, Su et al. 2021) konum bilgileri, Q ve K vektörlerinde dönüş yoluyla kodlanır. Dönüştürülen sorgu ve döngülmüş bir anahtar arasındaki dikkat puanı yalnızca görevi mesafeden bağlı olduğu için, önbelleğe alınan girişlerin tümü yeniden hesaplanmadan yeni bir ofset'e geçebilir: her önbelleğe alınan anahtarı yeniden döngülmek yerine sorguyu döndür. Hogwild! Inference bunu önbelleği blokuna bir kez yapar: konumdaki sorgu için `i_q`ve bloktan başlayan bir blok.`i_k`Bu işçinin görüşüyle sorgu göreceli mesafe ile döndürülür.`i_q - i_k`Bu yöntem, her çalışanın kendi sırasıyla paylaşılan önbelleği bloklarını görmesidir. Bu hile, bir blokun birer birer hareketini sağlar.

Hogwild! öğrenilmiş pozisyon veya mutlak pozisyon modelinde, her eşzamanlı yazıda önbelleği geçersiz kılmak gerekir. RoPE önbelleği istikrarlı kalmasına izin verir.

### Duvar zamanı matematik

- Bırak .`T_serial`Bir işçinin tek başına sorunu çözmesi için zaman olsun.`p`Görev seviyesinde paralelleşebilir kesim.`c`Adımlardaki koordinasyon genel maliyeti (gelişmiş önbelleği okuyarak, ne yazılacağına karar vermek).

Tek çalışan için zaman: `T_serial`- Evet .
N-işçi Hogwild! zaman, eğer koordinasyon serbest: `T_serial * ((1 - p) + p / N)`Klasik Amdahl.
Koordinasyon genel maliyeti ile: `T_serial * ((1 - p) + p / N) + c * steps_per_worker`- Evet .

Bir işçinin verimli olması için,`c`5k+ token üreten mantık modelleri üzerinde çalışanlar yüzlerce koordinasyon tokenini ödemekle yetinir ve hala öne çıkırlar. Kısa sohbet görevlerinde koordinasyon baskın ve Hogwild! seriye daha kötüdür.

### Konkrete bir örnek

Düşünce zinciri 10 bin tokeni.`p = 0.7`paralelleştirilebilir içerik (farklı kanıt stratejileri, farklı durum analizleri) ve `c = 200`İşçi başına koordinasyon genel maliyetleri belirtileri.`N = 4`İşçiler:

- Seri süresi: 10000 dekode adım.
- Hogwild! zaman: 10000 * (0.3 + 0.7 / 4) + 200 * 4 = 10000 * 0.475 + 800 = 5550 dekode adımları.
- Hızlılık: 10000 / 5550 = 1.8x.

Bu çok küçük bir şey. Ama daha uzun düşünme sorunlarında (50k token) koordinasyon üstü maliyeti bozulur ve hızlanma 2.5-3x'e doğru ilerler. Hogwild! bir dilde doğal olarak çok ipli kod yazmanıza izin veren bir iplik seviyesindeki paralelliğin sonuç eşdeğeri.

### Hogwild'e ne zaman ulaşmak!

- Uzun akıl yürütme sorunları (binlerce token), burada görev bağımsız alt hedefler arasında paralel hale gelebilir.
- Dolayısıyla, düşünen modeller adım adım düşünmeye eğitilmişlerdir.
- Paylaşılan önbelleği ekleyip N işçi süreçlerini tutmak için yeterli VRAM ile tek düğüm dağıtımları. Önbelleği paylaşılan, ancak her işçinin kendi etkinleştirme belleği vardır.

### Ne zaman yapmamak

- Kısa interaktif sohbet, koordinasyon üst düzey baskın.
- Paralelleşmeyen görevler (tek çizgisi kanıt, tek bir kompili). N = 1 maksimum.
- Akılsızlık modelleri.
- Çoklu düğüm dağıtımları. Paylaşılan önbelleğin çok hızlı işçi çapraz sinkronizasyonuna ihtiyacı var. İç düğüm iyi; çapraz düğüm bir gecikme felaketidir.

### Deneysel durum

Nisan 2026 itibariyle, Hogwild! açık kaynaklı PyTorch uygulaması ile bir araştırma yöntemi.

1. Eş zamanlı süreçler boyunca paylaşılan KV önbelleği yönetimi önemsiz mühendisliktir.
2. Çevre koordinasyonu görevden bağımsızdır; referans değerleri hala oluşturuluyor.
3. Hızlı hızlandırmalar spekülasyonsal çözme ile karşılaştırıldığında çok azdır ve ikisi birleştirilebilir ama birleştirilen mühendislik başka bir katmadır.

Bilmeye değer, deney yapmaya değer, henüz bir ürünü bahis etmeye değmez.

```figure
continuous-batching
```

## Yapın

`code/main.py`Oyuncak Hogwild! simülatörü uyguluyor:

- Her biri bilinen olasılıklarla birkaç simge kategorisinden birini (iş simgesi, gözlem simgesi, koordinat simgesi) üreten belirleyici bir "LLM" olan iki işçi işlemidir.
- İki işçinin de okuduğu ve yazdığı ortak bir önbelleği (sadece bir token listesi).
- Basit bir koordinasyon mantığı: Bir işçi, diğerinin bir kategoride yeterince iş tokeni ürettiğini gördüğünde, farklı bir kategorisi seçer.

Simülatör sabit bir adım bütçesi ile çalışır ve raporlar:

- Üretilen toplam iş belirtileri.
- Toplam duvar süresi (işçi adımlarının sayısı).
- Tek bir işçi üzerinde etkili hızlandırma.
- Hangi işçinin hangi simgeyi yazdığı izini.

### Adım 1: Paylaşılan önbelleği

İki işçinin de eklediği bir liste.`threading.Lock`) gerçek bir uygulamada simülasyon yaparken, bir hesaplayıcı ile simülasyon yaparız.

### Adım 2: İşçi döngüsü

Her işçi, her adımda:

- Şu anki paylaşılan önbellek okur.
- Bu, zaten var olanlara göre hangi token kategorisini yazmaya karar verir.
- Bir tane işaret yazıyor.

### Adım 3: Koordinasyon heuristikası

Eğer kategori X'de zaten K simgelerinin önbelleğinde bulunması ve işçinin amaçladığı kategorinin X olması durumunda, işçi kategorine geçiyor. Bu, "Bu zaten kapalı olduğunu fark et, bunun yerine başka bir şey yap" mantık modeli davranışının bir oyuncak yerine geçiyor.

### Dördüncü adım: Ölçülen hızlandırma

N=1 çalışan ve N=2 çalışan ile simülatörü çalıştırın, aynı toplam adım bütçesi. üretilen iş işareti belirtilerini sayın. N=2 koordinasyon yönlendirilmiş görev bölümü nedeniyle yaklaşık 1,5-1,8 kat daha fazla iş iş belirti üretmelidir.

### Adım 5: Koordinasyonu vurgulayın

Koordinasyon heuristiklerinin hassasiyetini azaltın. Tekrar çalışın. İyi bir koordinasyon olmadan N=2'nin aynı simgeleri fazladan ürettiğini ve hızlandırma 1'in altına düştüğünü gözlemleyin.

## Kullan

Hogwild!'in Nisan 2026 itibariyle üretimdeki entegrasyonu araştırma derecesindedir. Yandex/HSE/IST'ten gelen referans uygulanması PyTorch tabanlı ve DeepSeek-R1 ve QwQ modellerinde tek düğümlü çok işlem kurulumlarını hedefliyor.

Pragmatik kabul yolu:

1. Düşünme-iş yükünüzü profil edin. Araştırmacı (çoklu strateji, durum analizleri, arama) vs. doğrusal olan simgelerin bölümü ölçün.
2. Eğer keşif üstünlük kazanırsa, iki işçi Hogwild deneyi yapın.
3. Eğer gelişme 1,3 katın altında ise, koordinasyon baskın rejiminde olursun. Tek çalışanı tekrar.
4. Eğer iyileşme 1,5x'den fazla ise, N=4'e doğru it ve tekrar ölç.

Speküel dekodlama ile birleştirin: Her Hogwild! çalışanı bağımsız olarak spesifik dekodlamayı kullanabilir. İki hızlandırma (kaykaykayla) katlanır ve 3x spesifik dekodlamayı ve 1.8x Hogwild!'ı naif tek çalışan dekodlamasına göre etkili 5.4x'e çıkarır.

## Gönder

Bu ders bize çok yararlı .`outputs/skill-parallel-inference-router.md`. Bir akıl yürütme iş yükü profili (token bütçesi, görev paralelliği profili, model ailesi, dağıtım hedefi) göz önüne alındığında, oylama, düşünce ağacı, çoklu ajan, Hogwild! ve spekülatif dekodlama stratejileri arasında bir rota oluşturur.

## Egzersizler

1. Çık .`code/main.py`N=2 Hogwild! yapılandırmasının aynı duvar zamanında N=1 temel hattından daha fazla iş-token ürettiğini onaylayın.

2. Koordinasyon heuristik gücünü azaltmak (set `coordination_weight=0.1`Sürekli çalışmanın çöktüğünü göster. Nedenini açıkla: İşçiler koordine edemediğinde çabalarını ikiye katlarlar.

3. 50k token düşünce görevi için beklenen Hogwild! hızlandırmasını hesapla`p=0.8, c=500`Aynı şeyi 1k-token sohbet görevi için yapın.`p=0.3, c=200`Neden biri kazanç, diğeri ise kaybı?

4. Hogwild! makalesinin 4. bölümünü okuyun (Önce değerlendirme). Yazarların bildirdiği iki başarısızlık modunu belirleyin.

5. Hogwild! ile oyuncakta spekülatif dekodlama birleştirin: her işçi 2 token spesifik dekodunu içeride kullanır.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Hogwild! | "Parallel workers, shared cache" | N instances of the same LLM running concurrently with one shared KV cache; emergent coordination via self-prompting |
| Shared KV cache | "The coordination medium" | A single growing KV buffer that all workers read and write; enables instant token visibility across workers |
| Emergent coordination | "No training needed" | Reasoning-capable LLMs can read the shared cache and divide work without any fine-tuning or explicit protocol |
| Coordination overhead (c) | "Tokens spent orienting" | The per-worker cost of reading the extended cache and deciding what to do; must stay small vs total decode time |
| Parallelizable fraction (p) | "What can run in parallel" | Task-level parallelism: the fraction of the total work that is not intrinsically sequential |
| RoPE enables Hogwild! | "Rotary positions are shift-invariant" | Because positions are rotations, writing into a shared cache does not require recomputing prior tokens |
| Voting ensemble | "Run N, pick the majority" | The simplest parallel inference topology; useful for classification, less for long-form reasoning |
| Tree of thought | "Branch and prune" | Reasoning strategy that explores multiple branches and prunes; explicit coordination logic |
| Multi-agent framework | "Assign sub-tasks" | Each agent gets a role; a coordinator orchestrates; heavy protocol overhead |

## Daha Fazla Okumak

- [Rodionov et al. — Hogwild! Inference: Parallel LLM Generation via Concurrent Attention (arXiv:2504.06261)](https://arxiv.org/abs/2504.06261) Hogwild! makalesi, QwQ ve DeepSeek-R1'e yönelik ön değerlendirme
- [Recht, Re, Wright, Niu — Hogwild!: A Lock-Free Approach to Parallelizing Stochastic Gradient Descent (arXiv:1106.5730, NeurIPS 2011)](https://arxiv.org/abs/1106.5730) orijinal Hogwild! isimlerin kökeni
- [Su et al. — RoFormer: Enhanced Transformer with Rotary Position Embedding (arXiv:2104.09864)](https://arxiv.org/abs/2104.09864) RoPE, paylaşılan önbelleği çıkarmayı ele alınması için kullanılabilir hale getiren özellik
- [Yao et al. — Tree of Thoughts: Deliberate Problem Solving with Large Language Models (arXiv:2305.10601)](https://arxiv.org/abs/2305.10601) Hogwild! düşünce ağacı mantık stratejisi ortogonal olarak
- [Leviathan et al. — Fast Inference from Transformers via Speculative Decoding (arXiv:2211.17192)](https://arxiv.org/abs/2211.17192) spekülatör çözme, Hogwild! içi sıra paralelliği
- [Hogwild! reference PyTorch implementation](https://github.com/eqimp/hogwild_llm)- Kağıt deneylerinin tek gerçek kaynağı
