# Önbellek Servisleri  RadixAtention ve KV Reuse

> KV önbelleğini bir kök ağacında saklanan birinci sınıf, tekrar kullanılabilir bir kaynak olarak ele alın ve programlama değişiklikleri onunla birlikte yapın: FCFS (birincil gelen, ilk hizmet verilen) yerine vLLM programları olarak, bir önbelleğe uyan bir planlamacı daha uzun paylaşılmış önlüklerle yapılan istekleri öncelikli hale getirir  etkili bir derinlik-birincil kök geçiş böylece sıcak dallar HBM'de oturuyor kalır. SGLang, bu fikri destekleyen motor. ShareGPT gibi 1K istekleri ile Llama 3.1 8B'de, SGLang ~ 16.200 tok/s'e ~ 12.500 vLLM'ye ulaşır, %29 bir kenar. Önceden ağır RAG iş yüklerinde avantaj 6.4x'e ulaşır. Ses klonlama şeklinde iş yükleri üzerinde cache trafiği oranı %86 arttı. 2026 yılında xAI, LinkedIn, Cursor, Oracle, GCP, Azure, AWS'de 400.000+ GPU'da dağıtıldı. 6.4x numarası, ön işaret siparişleri tutarlı olmadığı zaman buharlaşır.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, toy radix-tree cache + cache-aware scheduler)
**Prerequisites:** Phase 17 · 04 (Serving Engine Internals), Phase 14 (Agentic RAG)
**Time:** ~75 minutes

## Öğrenme Hedefleri

- Diyar Radix Dikkat: bir radix ağacında önlüklerin nasıl depolandığı ve KV bloklarının aynı dalda kökleşmiş diziler arasında nasıl paylaşıldığı.
- Önbellek farkında olan programlama ve neden FCFS'in ağır trafik için yanlış olduğunu açıklayın.
- Önbellek-cache hit hızı ve hızlı uzunluk dağılımını vererek bir iş yükü için beklenen hızlandırmayı hesaplayın.
- 6.4x sayısını gerçekleştirecek bir hızlandırma disiplini adını verin.

## Sorun

Klasik servis, her talebin istekini açık olmayan bir şekilde değerlendirir. 5.000 RAG istekinin hepsi aynı 2.000 token sistem istekinin yanı sıra aynı kurtarma preamblesinden başladığında bile, vLLM, 2.000 token önlüğünü 5.000 kez doldurur. GPU aynı işi tekrar yapar.

Gözetim: agentic ve RAG iş yüklerinde istekler neredeyse her zaman uzun önlükleri paylaşır. Sistem istekleri, araç şemeleri, birkaç çekim örneği, çekim başlıkları, sohbet geçmişi  tüm istekler boyunca tekrarlanır. Eğer KV önlükleri için bir kez sakladığınız ve tekrar kullandığınızda, tekrar doldurmazsınız.

RadixAttention tam olarak bunu yapar. Tokenler bir radix ağacında indekslenir; her düğüm kökten yolundaki token dizisi için KV bloklarına sahiptir. Yeni bir talep ağacı yürür: token eşleşen herhangi bir düğüm, nodun KV bloklarını tekrar kullanır. Ön doldurma maliyeti tam isteklenme değil, "yeni" sufiksine orantılı hale gelir.

İki istek 2000 tokenlik bir önbölü paylaşırsa ve üçüncü bir de aynı önbölü sadece 200 token paylaşırsa, uzun paylaşılmış iki istekleri birlikte hizmet etmek istersiniz, böylece uzun önbölü HBM'de kalır. FCFS tersini yapar  ilk gelen herkese hizmet eder, potansiyel olarak sıcak dalı sonraki uzun önbölü istek başlamadan önce çıkarır.

## Anlaşım

### KV indeksi olarak kök ağacı

Bir radiks ağacı (kompakt trie) simge dizilerini saklar. Her düğüm bir simge aralığına sahiptir ve bu aralık için hesaplanan KV blokları vardır. Çocuklar bir veya daha fazla simge dizisini uzatırlar.

```
root
 |- "You are a helpful assistant..."  (2,000 tokens, 124 KV blocks)
      |- "Context: <doc A>..."        (500 tokens, 31 blocks)
           |- "Question: Alice..."    (80 tokens, 5 blocks)
           |- "Question: Bob..."      (95 tokens, 6 blocks)
      |- "Context: <doc B>..."        (520 tokens, 33 blocks)
```

Yeni bir istek sistem istekleri + "Kontext: <doc A>" + "Question: Carol" ile gelir. Programlayıcı: sistem önbellekleri eşleşir (124 blok yeniden kullanılır), doc-A dal eşleşir (31 blok yeniden kullanılır), sonra sadece "Question: Carol" için yeni bloklar tahsis eder (4 blok). Ön doldurma maliyeti: 4 blok yeni jetonlar. Ağaç olmadan: 160 blok. ~40x ön doldurma tasarruf.

### Kaynaklı programlama

Eğer bu arşiv çalışmıyorsa, Radix ağacı desteklenen tekrar kullanımı anlamsızdır.

1. **Depth-first dispatch**Sıradan bir sonraki talebi seçerken, geçerli çalıştırma seti ile aynı dalda kökleşmiş istekleri tercih edin. Bu sıcak dalı sabit tutar.
2. **LRU at branch level, not block level**. Bireysel bloklar yerine tüm dalları (en kısa kullanılan yapraklardan başlayarak) çıkarın, böylece önbelleğin şekli radix şekliyle eşleşir.

FCFS her ikisini de ihlal eder. 2000 token paylaşım talebi 50 token paylaşım talebi arkasında kalır.

### Hatırlamalısınız.

- Llama 3.1 8B, H100, ShareGPT 1K istekleri: SGLang ~ 16,200 tok/s vs vLLM ~ 12,500 (~ 29% kenar).
- Önceden ağır RAG (aynı sistem + aynı belge, farklı soru): SGLang'da 6.4x'e kadar.
- Ses klonlama iş yükleri: 86,4% önbellek-cache hit oranı.
- SGLang müşterilerinde üretim oranları: hızlı disiplinlere bağlı olarak %50-99'dur.
- 2026'da 400.000+ GPU'da dağıtıldı.

### Sipariş aldı.

6.4x numarası, sürekli bir istek şablon siparişine dayanır.`[system, tools, context, history, question]`Bazı isteklerde ve`[system, context, tools, history, question]`Bir insan için ortak bir önlük gibi görünen şey, kök ağacının iki farklı sırasıdır.

Mühendislik Lever: Cevap şablonunuz bir önbelleğe açılır. Düzenlemeyi düzeltin. Değişmez olan her şeyi (sistem, araçlar, şemalar) önce koyun. Ardından geri alım bağlamını koyun. Kullanıcı sorusunu sonuna koyun. Dinamik içeriği önlükte bırakmayın.

Araştırmadan gerçek bir durum: Kaynağabilir önlükten dinamik içeriği taşımak bir değişiklikte bir dağıtımın %7'ten %74'e kadar kaynağa ulaşma oranını aldı.

### RadixAttention'ın kazanıp kaybettiği yer

Kazanç:
- RAG (aynı bir alıntı önbellek, farklı soru).
- Ajanlar (aynı araç şemeleri, farklı sorgular).
- Uzun sistem mesajıyla sohbet edin.
- Tekrarlanan preambulları olan ses/görüş iş yükleri.

Kayıplar (vLLM seviyesindeki geçiş seviyesine geri döner):
- Tek çekim generasyonu, benzersiz isteklerle (kod tamamlanması, sistem isteksiz açık sohbet).
- Dinamik istekler, her istek için eşsiz içeriği önbellek içine bırakır.

### Neden bu sadece çekirdek sorunu değil, bir programlayıcı sorunu

KV yeniden kullanımı bir çekirdek hilesi olarak uygulayabilirsiniz. SGLang'ın anlayışı, tekrar kullanımı yalnızca programcı sıcak dalın oturucuunu tutursa ödenecektir. Saf bir "daha kullanılabilirse yeniden kullan" politikası, önbelleği karışık yük altında hızlandıracak. Radiks ağacı indeksi programcısı çekirdek hilesini% 29 üretim kenarına çeviren şeydir.

### VLLM ile etkileşim

İki sistem de sıkı bir rekabetçi değildir.`--enable-prefix-caching`SGLang'ın tüm yığını radix-birincidir; vLLM onu aşıladı. Önceden yeniden kullanımı ile egemen olan iş yükleri için, SGLang varsayılan olarak kalır.

```figure
roofline
```

## Kullan

`code/main.py`Oyuncak bir radix-tree KV önbelleği ek olarak iki politika ile bir programlayıcı: FCFS ve önbelleği farkındadır. Her ikisinden de aynı iş yükünü çalışır, önbelleği önbelleği isabet oranı ve özet delta raporları.

- Evet .[Inside an LLM Serving GPU](https://aiengineeringfromscratch.com/inside-an-llm-serving-gpu?workload=shared&shared=4096)makine gerçek bir L4 çalışmasında radix önbelleğini gösterir. Dört grubun her birinin kendi 4.096 jeton sistem sorgulaması vardır. Bir grubun ilk istekleri onun sorgulamasını hesaplar. Bu sorgulama önbellekte kalırken, grubun sonraki istekleri sadece 128- jeton sorgulamasını hesaplar.

## Gönder

Bu ders bize çok yararlı .`outputs/skill-radix-scheduler-advisor.md`. İş yükünün bir açıklaması (sürekli şablon şekli, geri alım örneği, eş zamanlı kiracı sayısı) verildiğinde, SGLang'ın kabul edilmesi için bir sürekli sipariş reçetesini ve bir git/götürme reçetesini üretir.

## Egzersizler

1. Çık .`code/main.py`. Aynı iş yükü üzerinde FCFS ve cache-conscious'i karşılaştırın.
2. Çalışma yükünü değiştir , böylece istekler rastgele dönüştürülür .`[system, tools, context]`- Tekrar çalış.
3. Llama 3.1 8B'de bir radix dalı olarak 2.000 tokenlik bir sistem istekçiyi tutmanın HBM maliyetini hesaplayın. Önceden yeniden kullanılmadan 16 dizi bir parti maliyetine karşılaştırın.
4. SGLang RadixAttention makalesini okuyun. Üç cümle ile açıklayın, neden ağaç şeklinde LRU'nun çıkarılması, ağır yük altında blok şeklinde LRU'yu yener.
5. Bir müşteri sadece %8'lik bir önbelleğe rastlanan oranı rapor ediyor.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| RadixAttention | "the SGLang thing" | KV cache indexed as a radix tree so shared prefixes reuse blocks |
| Radix tree | "compact trie" | Tree where each node owns a token range and its KV blocks |
| Cache-aware scheduler | "hot-branch-first" | Scheduler that prefers requests sharing the resident branch |
| Prefix-cache hit rate | "how much of your prompt was free" | Fraction of prompt tokens served from reused KV blocks |
| FCFS | "first-come first-served" | Default scheduling that breaks prefix locality |
| Branch-level LRU | "evict the leaf" | Eviction policy matched to radix shape |
| Prompt template ordering | "the cache key" | The prompt's component order determines what the tree can share |
| System prompt pinning | "resident prefix" | Keep the immutable system portion pinned to avoid eviction thrash |

## Daha Fazla Okumak

- [SGLang GitHub](https://github.com/sgl-project/sglang) kaynak ve belgeler.
- [SGLang documentation](https://sgl-project.github.io/) Radixİzdenme ve programlama detayları.
- [SGLang paper — Efficiently Programming Large Language Models (arXiv:2312.07104)](https://arxiv.org/abs/2312.07104) tasarım referansı.
- [LMSYS blog — SGLang with RadixAttention](https://www.lmsys.org/blog/2024-01-17-sglang/) Referans sayıları ve programcı mantıklılığı.
- [vLLM — Prefix Caching](https://docs.vllm.ai/en/latest/features/automatic_prefix_caching/) vLLM'nin kendi radikal uygulaması, karşılaştırma için.
