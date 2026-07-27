# Kubernetes'te GPU Otomatik Ölçeklendirme — Karpenter, KAI Scheduler, Gang Scheduling

> Bir değil üç katman. Karpenter, düğümleri dinamik olarak sağlar (bir dakikadan kısa sürede, Cluster Autoscaler'dan %40 daha hızlı). KAI Scheduler, grup planlamayı, topoloji farkındalığını ve hiyerarşik kuyrukları yönetir; yedi düğümün beklediği ve eksik bir GPU'ya yandığı 7'den 8'e kısmi tahsis tuzağını önler. Uygulama düzeyindeki otomatik ölçekleyiciler (NVIDIA Dynamo Planner, llm-d Workload Variant Autoscaler), CPU/DCGM görev döngüsüne göre değil, inference'ye özgü sinyallere (kuyruk derinliği, KV önbellek kullanımı) göre ölçeklenir. Klasik HPA tuzağı, `DCGM_FI_DEV_GPU_UTIL`'nin bir görev döngüsü ölçümü olmasıdır: %100, 10 istek veya 100 olabilir. vLLM, KV önbelleğini önceden tahsis eder, böylece bellek asla ölçek küçültmeyi tetiklemez. Bu ders size üç katmanı oluşturmayı ve inference ortasında GPU işlerini çalıştırmayı sonlandıran varsayılan Karpenter `WhenEmptyOrUnderutilized` politikasından kaçınmayı öğretir.

**Tür:** Öğren
**Diller:** Python (stdlib, oyuncak kuyruğu derinliğinde otomatik ölçekleyici simülatörü)
**Önkoşullar:** Aşama 17 · 02 (Inference Platform Ekonomisi), Aşama 17 · 04 (Motorun Dahili Bileşenlerine Hizmet Verme)
**Süre:** ~75 dakika

## Öğrenme Hedefleri

- Üç otomatik ölçeklendirme katmanını (düğüm sağlama, grup planlama, uygulama düzeyi) diyagramlayın ve her katmanda kullanılan aracı adlandırın.
- `DCGM_FI_DEV_GPU_UTIL`'nin vLLM için neden yanlış HPA sinyali olduğunu açıklayın ve iki değişikliğin adını verin (kuyruk derinliği, KV önbellek kullanımı).
- Grup planlamayı ve KAI Scheduler'ın önlediği kısmi tahsis hata modunu (8 GPU'dan 7'si boşta) açıklayın.
- Çalışan GPU işlerini sonlandıran Karpenter birleştirme ilkesini (`WhenEmptyOrUnderutilized`) adlandırın ve 2026 güvenli alternatifini belirtin.

## Sorun

Ekibiniz Kubernetes'te yüksek lisans hizmeti sunan bir hizmet sunuyor. HPA'yı sinyal olarak `DCGM_FI_DEV_GPU_UTIL` ile kurdunuz. Hizmet, mesai saatleri içinde %100 kullanımda sabitlenir. HPA hiçbir zaman ölçeği artırmaz; zaten doyduğunuzu düşünür. Bir kopyayı manuel olarak eklersiniz; TTFT düşüyor. HPA hala ölçeklenmiyor. Sinyal sana yalan söylüyor.

Ayrı olarak, düğümler için Küme Otomatik Ölçekleyiciyi kullanırsınız. 1M-token prompt, 2 a.m'ye ulaşır; küme bir düğümün hazırlığını yapmak için 3 dakika harcar ve istek zaman aşımına uğrar.

Ayrı olarak, yine 2 düğümde 8 GPU gerektiren bir 70B modelini dağıtırsınız. Kümede 7 ücretsiz GPU bulunur ve 1 tanesi 3 düğüme dağılmıştır. Küme Otomatik Ölçekleyici, eksik olan 1 GPU için bir düğüm hazırlar. Yedi düğüm, Kubernetes son GPU'yu çalıştırırken 4 dakika boyunca para yakmayı bekliyor.

Üç katman, üç farklı arıza modu. 2026'da GPU bilinçli otomatik ölçeklendirme "HPA'yı açmak" değildir. Düğüm sağlama, grup planlama ve uygulama sinyali otomatik ölçeklendirmeyi oluşturuyor.

## Konsept

### Katman 1 — düğüm sağlama (Karpenter)

Karpenter, bekleyen bölmeleri izler ve düğümleri yaklaşık 45-60 saniye içinde hazırlar (Küme Otomatik Ölçekleyici, GPU düğümleri için genellikle 90-120 saniye sürer). Bulut sunucusu türlerini `NodePool` kısıtlamasına göre dinamik olarak seçer; kapsülünüzün 8 H100'e ihtiyacı varsa ve kümede eşleşen düğüm yoksa Karpenter, mevcut bir grubu ölçeklendirmek yerine doğrudan bir tane tedarik eder.

**Konsolidasyon tuzağı**: Karpenter'in varsayılan `consolidationPolicy: WhenEmptyOrUnderutilized`'si GPU havuzları için tehlikelidir. Pod'ları daha ucuz, doğru boyutlu bir örneğe taşımak için çalışan bir GPU düğümünü sonlandıracaktır. inference iş yükleri için bu, çalışan isteklerin çıkarılması ve 70B modelinin yeni düğüme yeniden yüklenmesi anlamına gelir. Kayıp, dakikalarca kapasite artı istek hatalarıdır.

GPU havuzları için güvenli ayar:

```yaml
disruption:
  consolidationPolicy: WhenEmpty
  consolidateAfter: 1h
```

Karpenter'in gerçekten boş düğümleri bir saat sonra birleştirmesine izin verir, ancak çalışan bir işi asla çıkarmaz.

### Katman 2 — grup planlama (KAI Zamanlayıcı)

KAI Scheduler (proje "Karp" daha sonra yeniden adlandırıldı) varsayılan kube-scheduler'ın yapmadığını yönetir:

**Grup planlaması** — ya hep ya hiç planlayın. 8 GPU gerektiren dağıtılmış bir inference bölmesi, ya 8'inin tümü birlikte başlar ya da hiçbiri başlamaz. Bu olmadan kısmi tahsis tuzağına düşersiniz: 8 bölmeden 7'si başlar, süresiz olarak bekler, para yakar.

**Topoloji farkındalığı** — Hangi GPU'ların NVLink'i paylaştığını, hangilerinin aynı rafta bulunduğunu ve aralarında InfiniBand'ın bulunduğunu öğrenin. Bölmeleri buna göre yerleştirin. DeepSeek-V3 67B tensör paralel iş yükünün tek bir NVLink etki alanında kalması gerekir; KAI Scheduler buna saygı duyar.

**Hiyerarşik kuyruklar** — Birden fazla ekip aynı GPU havuzu için öncelik ve kota ile rekabet eder. A Takımının üretim sıkıntısı, yalnızca öncelik kurallarının izin vermesi halinde, B Takımının eğitim işi tarafından önlenir.

KAI, ikincil bir zamanlayıcı olarak kube zamanlayıcının yanında dağıtılır; kullanmak için iş yüklerine açıklama eklersiniz. Ray ve vLLM üretim yığınının her ikisi de entegre olur.

### Katman 3 — uygulama düzeyinde sinyaller

**HPA tuzağı**: `DCGM_FI_DEV_GPU_UTIL` bir görev döngüsü ölçümüdür; GPU'nun her örnekleme aralığında iş yapıp yapmadığını ölçer. %100 kullanım, 10 eşzamanlı istek veya 100 istek anlamına gelebilir; GPU her iki durumda da meşguldü. Görev döngüsünde ölçeklendirme körü körüne ölçekleniyor.

Daha da kötüsü, vLLM ve benzeri motorlar KV önbelleğini önceden tahsis eder (`--gpu-memory-utilization`'ye kadar). Bellek kullanımı tek istekte bile %90'a yakın kalıyor. Bellek tabanlı HPA'nın ölçeği asla küçülmez.

**2026 değiştirme sinyalleri**:

- Kuyruk derinliği (önceden doldurulmayı bekleyen isteklerin sayısı).
- KV önbellek kullanımı (aktif dizilere blokların ne kadarı tahsis edilmiştir).
- Kopya başına P99 TTFT (SLA sinyaliniz).
- İyi çıktı (saniyede tüm SLO'ların karşılanması istekleri).

NVIDIA Dynamo Planner ve llm-d Workload Variant Autoscaler bu sinyalleri kullanır ve kopyaları ölçeklendirir. Yüksek Lisans hizmeti için HPA'nın yerini tamamen alıyorlar.

### Ne zaman ne kullanılmalı

| Ölçek kararı | Araç |
|----------------|------|
| Düğüm ekle/kaldır | Marangoz |
| Çoklu GPU işlerini planlama | KAI Zamanlayıcı |
| Kopyaları ekle/kaldır | Dynamo Planner / llm-d WVA (veya kuyruk derinliğine göre özel HPA) |
| GPU türünü seçin | Marangoz Düğüm Havuzu |
| Düşük önceliklileri önleyin | KAI Zamanlayıcı kuyrukları |

### Ayrıştırılmış önceden doldurma/kod çözme her şeyi karmaşıklaştırır

Ayrıştırılmış ön doldurma/kod çözme işlemini çalıştırırsanız (Aşama 17 · 17), farklı ölçeklendirme tetikleyicilerine sahip iki bölme sınıfınız olur: önceden doldurma bölmeleri kuyruk derinliğine göre ölçeklenir, kod çözme bölmeleri KV önbellek basıncına göre ölçeklenir. llm-d, bunları rol başına HPA ile ayrı `Services` olarak gösterir. Her ikisinin önüne tek bir HPA koymaya çalışmayın.

### Soğuk başlatma burada da önemlidir

Soğuk başlatma azaltma (Aşama 17 · 10), düğüm sağlama süresinin kullanıcı tarafından görülebildiği yerdir. Karpenter'in 45-60 saniyelik ısınması artı 20 GB model yükü artı motorun başlatılması, sıfırdan gelen bir isteğin 2-5 dakika süreceği anlamına gelir. SLO açısından kritik yollar için sıcak bir havuz (`min_workers=1`) tutun veya uygulama katmanında Modal tarzı denetim noktası kullanın.

### Hatırlamanız gereken sayılar

- Karpenter düğüm provizyonu: ~45-60s vs Cluster Autoscaler ~90-120s (GPU düğümleri).
- KAI Zamanlayıcı kısmi tahsis israfını önler - 7'den 8'e tuzak.
- HPA sinyali olarak `DCGM_FI_DEV_GPU_UTIL`: bozuk; kuyruk derinliğini veya KV kullanımını kullanın.
- Karpenter `WhenEmptyOrUnderutilized`: Çalışan GPU işlerini sonlandırır. inference için `WhenEmpty + consolidateAfter: 1h`'yi kullanın.

```figure
autoscaling
```

## Kullan onu

`code/main.py`, yoğun GPU iş yükünde üç katmanlı bir otomatik ölçekleyiciyi simüle eder. Saf HPA'yı (görev döngüsü), kuyruk derinliği HPA'sını ve KAI-çete planlı ölçeklendirmeyi karşılaştırır. Karşılanmayan istekleri, boşta kalan GPU dakikalarını ve bileşik puanı raporlar.

## Gönderin

Bu ders `outputs/skill-gpu-autoscaler-plan.md`'yi üretir. Küme topolojisi, iş yükü şekli ve SLO göz önüne alındığında, üç katmanlı bir otomatik ölçeklendirme planı tasarlar.

## Egzersizler

1. `code/main.py`'yi çalıştırın. Yoğun bir iş yükü altında, sıra derinliğindeki HPA'nın yakaladığı saf görev döngüsü HPA'sı kaç isteği düşürür? Fark nereden geliyor?
2. H100 SXM5 üzerinde Llama 3.3 70B FP8'e hizmet veren bir küme için bir Karpenter NodePool tasarlayın. `capacity-type`, `disruption.consolidationPolicy`, `consolidateAfter` ve GPU dışı iş yüklerini bu düğümlerden uzak tutan bir kusur belirtin.
3. Ekibiniz deployment'lerin "GPU'lar mevcut ancak bölme zamanlama yapmadığı" için Beklemede durumunda kaldığını bildirdi. Teşhis Et — bu Karpenter mi, kube-scheduler mı, yoksa KAI Scheduler mı? Hangi ölçümler doğruluyor?
4. Ayrıştırılmış ön doldurma bölmelerini otomatik olarak ölçeklendirmek için bir sinyal ve kod çözme bölmeleri için farklı bir sinyal seçin. Her ikisini de haklı çıkarın.
5. `WhenEmptyOrUnderutilized` birleştirme tuzağının maliyetini, P99 TTFT > 10 sn'de günde ortalama 60 istek bırakma olayının gerçekleştiği 24x7 üretim hizmetinde hesaplayın.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|----------------|------------------------|
| Marangoz | "düğüm sağlayıcısı" | Kubernetes düğümü otomatik ölçekleyici; dakikadan kısa provizyon |
| Küme Otomatik Ölçekleyici | "eski ölçekleyici" | Kubernetes düğümü otomatik ölçekleyicinin öncülü; daha yavaş, grup tabanlı |
| KAI Zamanlayıcı | "GPU zamanlayıcı" | Grup + topoloji + kuyruklar için ikincil zamanlayıcı |
| Çete planlaması | "ya hep ya hiç" | N bölmeyi atomik olarak programlayın veya hepsini erteleyin |
| Topoloji farkındalığı | "raf uyumlu" | Bölmeleri NVLink/IB/raf yerleşimine göre yerleştirin |
| `DCGM_FI_DEV_GPU_UTIL` | "GPU kullanımı" | Görev döngüsü ölçüsü; Yüksek Lisans'lar için ölçeklendirme sinyali DEĞİLDİR |
| Kuyruk derinliği | "bekleyen istekler" | Önceden doldurmaya bağlı ölçeklendirme için doğru HPA sinyali |
| KV önbellek kullanımı | "bellek baskısı" | Kod çözmeye bağlı ölçeklendirme için doğru HPA sinyali |
| Konsolidasyon | "Karpenter konsolidasyonu" | Daha ucuz örnek tipine göre düğüm sonlandırma |
| `WhenEmpty + 1h` | "güvenli birleştirme" | Çalışan GPU işlerini tahliye etmeyen politika |

## Daha Fazla Okuma

- [KAI Scheduler GitHub](https://github.com/kai-scheduler/KAI-Scheduler) — tasarım belgeleri ve konfigürasyon örnekleri.
- [Karpenter Kesinti Kontrolleri](https://karpenter.sh/docs/concepts/disruption/) — konsolidasyon politikası semantiği ve GPU güvenli varsayılanlar.
- [NVIDIA — Kubernetes üzerinde ayrıştırılmış LLM Inference](https://developer.nvidia.com/blog/deploying-disaggregated-llm-inference-workloads-on-kubernetes/) — Dynamo Planner ölçeklendirme sinyalleri.
- [Ray docs — RayClusters için KAI Zamanlayıcısı](https://docs.ray.io/en/latest/cluster/kubernetes/k8s-ecosystem/kai-scheduler.html) — Ray entegrasyon modeli.
- [AWS EKS Bilgi İşlem ve Otomatik Ölçeklendirme En İyi Uygulamaları](https://docs.aws.amazon.com/eks/latest/best-practices/aiml-compute.html) — Kubernetes'e özel yönetilen rehberlik.
- [llm-d GitHub](https://github.com/llm-d/llm-d) — İş Yükü Değişken Otomatik Ölçekleyici tasarımı.
