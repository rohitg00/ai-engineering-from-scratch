# Ayrıştırılmış Önceden Doldurma/Kod Çözme — NVIDIA Dynamo ve llm-d

> Önceden doldurma hesaplamaya bağlıdır; kod çözme belleğe bağlıdır. Her ikisini de aynı GPU'da çalıştırmak bir kaynağın israfına neden olur. Ayrıştırma, bunları ayrı havuzlara böler ve NIXL (RDMA/InfiniBand veya TCP geri dönüşü) üzerinden KV önbelleğini bunlar arasında aktarır. NVIDIA Dynamo (GTC 2025 duyurusu, 1.0 GA), SLO'ları karşılamak için vLLM/SGLang/TRT-LLM'nin (Planner Profiler + SLA Planner otomatik oran eşleştirme ön doldurma: kod çözme oranları) üzerinde yer alır. NVIDIA bu alanda verim artışlarını yayınladı — developer.nvidia.com (2025-06), orta gecikme rejiminde GB200 NVL72 + Dinamo'da DeepSeek-R1 MoE için ~6 kat iyileşme gösteriyor ve Dynamo ürün sayfası (developer.nvidia.com, tarihsiz) GB300 NVL72 + Dynamo vs Hopper'da 50 kata kadar MoE veriminin reklamını yapıyor. "30x" rakamı, tam yığın Blackwell + Dynamo + DeepSeek-R1 raporlarındaki topluluk toplamıdır; tam olarak 30x'i belirten tek bir birincil kaynak bulamadık, bu nedenle bunu yönlendirici bir iddia olarak değerlendirin. llm-d (Red Hat + AWS), Kubernetes'te yereldir: rol başına HPA ile bağımsız Hizmetler olarak önceden doldurma / kod çözme / yönlendirme. llm-d 0.5, hiyerarşik KV boşaltma, önbelleğe duyarlı LoRA yönlendirme, UCCL ağı, sıfıra ölçeklendirme ekler. Ekonomi: Birden fazla müşteri açıklamasının dahili olarak toplanması, sabit SLA'da Dynamo ile ortak konumlu hizmetten ayrıştırılmış hizmete geçerken $2M-class inference spend (i.e., $600-800.000/yıl) oranında %30-40 tasarruf anlamına gelir; spesifik $2M→$600-800K rakamı, yayınlanmış tek bir vaka çalışması değil, dahili bir bileşiktir; bunu bir referans alıntısı olarak değil, büyüklük sırasına göre bir dayanak noktası olarak kullanın. Kısa prompts (<512 tokens, kısa çıktı) transfer maliyetini haklı çıkarmaz.

**Tür:** Öğren
**Diller:** Python (stdlib, oyuncak ayrıştırılmış ve bir arada konumlandırılmış simülasyon)
**Önkoşullar:** Aşama 17 · 04 (Motorun Dahili Bileşenlerine Hizmet Verme), Aşama 17 · 08 (Inference Metrik)
**Süre:** ~75 dakika

## Öğrenme Hedefleri

- Ön doldurma ve kod çözmenin neden farklı optimum GPU tahsislerine sahip olduğunu açıklayın ve ortak yerleşim sırasındaki israfın miktarını belirleyin.
- Ayrıştırılmış mimarinin şeması: ön doldurma havuzu, kod çözme havuzu, NIXL aracılığıyla KV aktarımı, yönlendirici.
- Ayrıştırmanın sonuç vermediği durumu adlandırın (kısa prompt'lar, kısa çıktılar).
- NVIDIA Dynamo'yu (yukarıdaki yığın) llm-d'den (Kubernetes yerel) ayırın ve her birini operasyonel bağlamla eşleştirin.

## Sorun

Llama 3.3 70B'yi 8 H100'de çalıştırıyorsunuz. Karışık iş yükü altında (uzun prompt saniyeler + kısa çıkışlar), hesaplamanın çoğu önceden doldurmaya harcandığından GPU'lar kod çözme sırasında boşta kalıyor. Farklı iş yükü altında (kısa prompt'lar + uzun çıktılar) bunun tersi gerçekleşir. Birlikte konumlandırılmış önceden doldurma + kod çözme, her ikisini de aşırı tedarik etmeniz anlamına gelir.

Bütçe etkisi: GPU zamanının %20-40'ı yanlış kaynakta boşa harcanır. Belleğe bağlı kod çözmeyi çalıştırmak için H100 bilgi işlem satın alıyorsunuz veya hesaplamaya bağlı ön doldurmayı çalıştırmak için H100 HBM bant genişliği satın alıyorsunuz. Her ikisi de pahalı atıklardır.

Ayrıştırma, ön doldurmayı ve kod çözmeyi her birinin darboğazı için boyutlandırılmış ayrı havuzlara böler. KV önbellek, yüksek bant genişliğine sahip ara bağlantı aracılığıyla ön doldurma havuzundan kod çözme havuzuna aktarılır.

## Konsept

### Darboğazlar neden farklı?

**Ön doldurma** — transformer'yi tam giriş prompt üzerinden tek ileri yönde çalıştırın. Matris çarpımları baskındır; hesaplamaya bağlı. H100 FP8 ~2000 TFLOPS faydalı verim sağlar. Toplu iş verimliliği iyidir — bir ileri, birçok tokens'yi işler.

**Kod çözme** — her yinelemede tam ağırlıkları okuyarak her seferinde bir token oluşturun. Bellek bant genişliğine bağlı. HBM3 ~3 TB/sn verir. Toplu iş verimliliği yalnızca yüksek eşzamanlılıkta iyidir; okunan ağırlıklar toplu iş genelinde amorti edilir.

Bunları bir arada kullanmak: her ikisi için optimize edilmiş GPU'lar satın alırsınız. H100 her ikisinde de iyidir ancak her iki durumda da maliyeti aynıdır. Geniş ölçekte, havuzun H100/işlem ağırlıklı olarak önceden doldurulmasını istiyorsunuz; H200/bellek ağırlıklı veya agresif nicemleme ile havuzun kodunu çözer.

### Mimari

```
            ┌──────────────┐
  Request → │    Router    │ ───────────────────────┐
            └──────┬───────┘                        │
                   │                                │
                   ▼ (prompt only)                  │
            ┌──────────────┐    KV cache    ┌───────▼──────┐
            │ Prefill pool │ ─── NIXL ────► │ Decode pool  │
            │  (compute)   │                │  (memory)    │
            └──────────────┘                └──────┬───────┘
                                                   │ tokens
                                                   ▼
                                                 Client
```

NIXL, NVIDIA'nın düğümler arası aktarımıdır. Mümkün olduğunda RDMA/InfiniBand'ı kullanır, aksi halde TCP geri dönüşünü kullanır. Aktarım gecikmesi gerçektir; 70B FP8'deki 4K-token prompt'un KV önbelleği için genellikle 20-80 ms. Bu nedenle kısa prompt'lar ayrıştırmayı haklı çıkarmaz: transfer vergisi tasarrufları aşmaktadır.

### Dinamo vs llm-d

**NVIDIA Dynamo** (GTC 2025 duyurusu, 1.0 GA):
- Orkestratör olarak vLLM, SGLang, TRT-LLM'nin üzerinde yer alır.
- Planner Profiler iş yükünü ölçer, SLA Planner önceden doldurma: kod çözme oranlarını otomatik olarak yapılandırır.
- Rust çekirdeği, Python genişletilebilirliği.
- Verim kazanımları: NVIDIA, orta gecikme rejiminde GB200 NVL72 + Dynamo üzerinde DeepSeek-R1 MoE için 6 kat rapor verdi (developer.nvidia.com, 2025-06); Tam Blackwell + Dynamo + DeepSeek-R1 yığınlarında "30 katına kadar" topluluk raporları tek bir birincil kaynaktan yoksundur ve yönlendirici olarak değerlendirilmelidir.
- GB300 NVL72 + Dinamo: Dynamo ürün sayfası başına (developer.nvidia.com, tarihsiz) Hopper'a kıyasla 50 kata kadar MoE verimi.

**llm-d** (Red Hat + AWS, Kubernetes'te yerel):
- Bağımsız Kubernetes Hizmetleri olarak önceden doldurma/kod çözme/yönlendirme.
- Kuyruk derinliği (ön doldurma) / KV kullanımı (kod çözme) sinyalleriyle rol başına HPA.
- `topologyConstraint packDomain: rack` , yüksek bant genişliğine sahip KV aktarımı için önceden doldurma+kod çözme kliklerini aynı rafta paketler.
- llm-d 0.5 (2026): hiyerarşik KV boşaltma, önbelleğe duyarlı LoRA yönlendirme, UCCL ağı, sıfıra ölçeklendirme.

Yönetilen bir yığın üstü orkestratör istiyorsanız Dinamo'yu kullanın. Kubernetes'te yerel temel öğeler istiyorsanız ve CNCF ekosistemine bağlıysanız llm-d'yi kullanın.

### Ekonomi

Dahili kompozit (yayınlanmış tek bir vaka çalışması değil - büyüklük sırası dayanağı):

- Ortak konumlu sunum için yılda 2 milyon ABD Doları inference harcama.
- Dinamo ile ayrıştırılmış duruma geçildi.
- Aynı istek hacmi, aynı P99 gecikme SLA'sı.
- Bildirilen tasarruflar: $600K–$800.000/yıl (%30–40 azalma).
- Yeni donanım yok.

Bu rakamı tek bir örnek vaka çalışması yerine birden fazla müşteri açıklamasından sentezledik; yayınlanan en yakın veri noktası Baseten'in Dynamo KV yönlendirmeyle 2 kat daha hızlı TTFT / %61 daha yüksek aktarım hızı (baseten.co, 2025-10) ve VAST + CoreWeave'in %40-60 KV isabet oranında %60-130 daha fazla tokens/$ tahminidir (vastdata.com, 2025-12). Tasarruflar her havuzun doğru boyutlandırılmasıyla sağlanır; önceden doldurma ağırlıklı iş yükleri (8K+ öneklere sahip RAG), dengeli olanlardan daha fazla fayda sağlar.

### Ne zaman ayrıştırılmamalı

- Prompts < 512 tokens ve çıktılar < 200 tokens: transfer vergisi kazanca hakimdir.
- Küçük küme (< 4 GPU): yeterli havuz çeşitliliği yok.
- Ekip, rol başına ölçeklendirmeyle iki GPU havuzunu çalıştıramaz: Dinamo yardımcı olur, ancak önemsiz değildir.
- RDMA yapısı yok: TCP aktarım vergisi daha ağırdır.

### Yönlendirici Faz 17 · 11 ile entegre olur

Ayrıştırılmış yönlendiriciler KV önbelleğine duyarlıdır (Aşama 17 · 11). Kod çözme havuzuna önekini tutan bir istek gelir; eşleşme yoksa ön doldurma → kod çözme yoluyla akar. İsabet oranı ve ayrıştırma bileşiği — önbelleği tanıyan yönlendirici, yeni bir ön doldurmanın gerekip gerekmediğini belirler.

### Blackwell'deki MoE gerçek sayıların bulunduğu yerdir

GB300 NVL72 + Dynamo, Hopper taban değerlerine göre 50 kat MoE verimi gösterir. MoE uzman yönlendirmesi, ön doldurmada hesaplama açısından yoğundur, ancak kod çözmede (uzman önbellekleri) bellek açısından yoğundur, bu nedenle ayrıştırma, çifte kazançtır. 2026 sınır modeli hizmeti MoE ağırlıklıdır (DeepSeek-V3, gelecekteki GPT-5 çeşitleri).

### Hatırlamanız gereken sayılar

Benchmark sayıları değişiyor — NVIDIA ve inference yığını her üç ayda bir güncellenen sonuçları yayınlıyor. Alıntı yapmadan önce tekrar kontrol edin.

- GB200 NVL72 + Dynamo'da DeepSeek-R1: orta gecikme rejiminde taban çizgisine kıyasla ~6 kat verim (developer.nvidia.com, 2025-06); topluluğunun tam Blackwell + Dynamo yığınlarına ilişkin "30 katına kadar" talepleri, tek bir birincil kaynağı olmayan yönlü toplamalardır.
- GB300 NVL72 + Dinamo: Hopper'a kıyasla 50 kata kadar MoE verimi (developer.nvidia.com, tarihsiz).
- Tasarruf dayanağı (dahili bileşik, tek bir örnek olay değil): $600-800K/year off a $Sabit HDS ile yıllık 2 milyon harcama.
- Ayrıştırma eşiği: prompts >512 tokens + çıkışlar >200 tokens.
- NIXL aracılığıyla KV aktarımı: 70B FP8'de 4K-prompt KV için 20-80 ms.

## Use It — Hazır Araçla Uygula

`code/main.py` , birlikte konumlandırılmış ve ayrıştırılmış sunumu simüle eder. Verim, istek başına maliyet ve prompt uzunluklu geçiş raporlanır.

## Ship It — Kullanıma Sun

Bu ders `outputs/skill-disaggregation-decider.md` üretir. Verilen iş yükü ve küme, ayrıştırılıp ayrıştırılmayacağına karar verir.

## Egzersizler

1. `code/main.py`'yı çalıştırın. Ayrıştırma hangi prompt uzunlukta kolokasyonu yener?
2. P99 önek uzunluğu 8K, çıkış 300 olan bir RAG hizmeti için ön doldurma havuzunu ve kod çözme havuzunu tasarlayın.
3. Dynamo vs llm-d: Python çalışma zamanı tercihi olmayan saf Kubernetes mağazası için birini seçin.
4. KV aktarım maliyetini hesaplayın: 70B FP8'de 4K önceden doldurma = ~500 MB KV. RDMA 100 GB/s'de aktarım = 5 ms. TCP'de 10 GB/s = 50 ms. SLA'nız için hangisi önemli?
5. MEB uzman yönlendirmesi KV erişim düzenlerini değiştirir. token başına farklı uzmanları harekete geçiren MEB ile ayrıştırma nasıl davranır?

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|----------------|------------------------|
| Ayrıştırılmış porsiyon | "bölünmüş ön doldurma/kod çözme" | Her aşama için ayrı GPU havuzları |
| NIXL | "NVIDIA aktarımı" | Dinamo'nun düğümler arası KV aktarımı (RDMA/TCP) |
| NVIDIA Dinamo | "orkestratör" | vLLM/SGLang/TRT-LLM için yığın üstü koordinatörü |
| llm-d | "Kubernetes yerel" | Red Hat + AWS K8'lerin ayrıştırılmış yığını |
| Planlayıcı Profil Oluşturucu | "Dinamo otomatik yapılandırması" | İş yükünü ölçer, havuz oranlarını yapılandırır |
| SLA Planlayıcısı | "Dinamo politikası" | SLO'ları karşılamak için ön doldurmayı otomatik olarak eşleştirin: kod çözme |
| `packDomain: rack` | "llm-d topolojisi" | Hızlı KV için önceden doldurma ve kod çözme işlemlerini aynı rafta paketleyin |
| UCCL | "birleşik kolektif" | llm-d 0,5 sıfıra ölçeklendirme için ağ katmanı |
| MEB uzman yönlendirmesi | "token başına uzman" | DeepSeek-V3 modeli; ayrıştırma yardımcı olur |

## Daha Fazla Okuma

- [NVIDIA — Dinamoyla Tanışıyoruz](https://developer.nvidia.com/blog/introducing-nvidia-dynamo-a-low-latency-distributed-inference-framework-for-scaling-reasoning-ai-models/)
- [NVIDIA — Kubernetes'te Ayrıştırılmış Yüksek Lisans Inference](https://developer.nvidia.com/blog/deploying-disaggregated-llm-inference-workloads-on-kubernetes/)
- [TensorRT-LLM Ayrıştırılmış Hizmet blogu](https://nvidia.github.io/TensorRT-LLM/blogs/tech_blog/blog5_Disaggregated_Serving_in_TensorRT-LLM.html)
- [llm-d GitHub](https://github.com/llm-d/llm-d)
- [llm-d 0.5 sürüm notları](https://github.com/llm-d/llm-d/releases)
