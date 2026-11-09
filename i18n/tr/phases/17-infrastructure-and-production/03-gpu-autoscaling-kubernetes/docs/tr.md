# Kubernetes'te GPU Otoscaling  Karpenter, KAI Scheduler, Gang Scheduling

> Üç kat, bir kat değil. Karpenter rezervi düğümleri dinamik (bir dakikadan az, Cluster Autoscaler'den %40 daha hızlı). KAI Scheduler, grup programlamasını, topoloji farkındalığını ve hiyerarşik kuyrukları ele alır. Uygulama düzeyinde otomatik ölçeklendiriciler (NVIDIA Dynamo Planner, llm-d Workload Variant Autoscaler) sonuçlandırma spesifik sinyalleri üzerinde ölçeklendirir  kuyruk derinliği, KV önbelleği kullanımı  CPU / DCGM görev döngüsü değil. Klasik HPA tuzağı budur .`DCGM_FI_DEV_GPU_UTIL`Bu ders size üç katmanı oluşturmayı ve varsayılan Karpenter'i önlemek için öğretir.`WhenEmptyOrUnderutilized`GPU işlerinin çalışmasını durdurmak için bir politika.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, toy queue-depth autoscaler simulator)
**Prerequisites:** Phase 17 · 02 (Inference Platform Economics), Phase 17 · 04 (Serving Engine Internals)
**Time:** ~75 minutes

## Öğrenme Hedefleri

- Üç otomatik ölçekleme katmanını (nod sağlama, grup programlaması, uygulama düzeyi) çiz ve her katman için kullanılan araçın adını verin.
- Nedenini açıkla `DCGM_FI_DEV_GPU_UTIL`vLLM için yanlış HPA sinyali ve iki değiştirme adı (kuyruk derinliği, KV önbelleği kullanımı).
- Grup programlamasını ve kısmi tahsis hata modunu açıklayın. KAI Scheduler'ın önlediği (7 GPU'dan 8'i boş).
- Karpenter konsolidasyon politikasını isimlendirin (`WhenEmptyOrUnderutilized`) GPU işlerinin çalışmasını sona erdirir ve 2026'da güvenli bir alternatif belirtiyor.

## Sorun

Ekibiniz Kubernetes'e LLM hizmetini veriyor.`DCGM_FI_DEV_GPU_UTIL`HPA iş saatlerinde %100 kullanımında servis pinleri. HPA asla büyütmez  zaten dolu olduğunu düşünüyor.

Ayrı bir şekilde, düğümler için Cluster Autoscaler kullanıyorsunuz. 1M-token istekleri sabah 2'de gelir; kümeler 3 dakika bir düğüm sağlıyor ve talep süreleri çıkıyor.

Ayrı bir şekilde, 2 düğüm üzerinde 8 GPU gerektiren 70B modelini dağıtıyorsunuz. Kluster 7 GPU'ya sahiptir, 3 düğüm üzerinde dağılmış ve 1 daha gerektirir. Kluster Autoscaler 1 eksik GPU için bir düğüm sağlar. 7 rezerve GPU'lar, Kubernetes'in son GPU'sunu yüklenirken 4 dakika para yakmak için hareketsiz kalır.

Üç katman, üç farklı başarısızlık modu. 2026'da GPU-a karşı otomatik ölçeklendirme HPA'yı açmıyor.

## Anlaşım

### Katman 1  düğüm sağlama (Karpenter)

Karpenter bekleyen kapsüller ve tedbir düğümlerini ~ 45-60 saniye içinde izler (Cluster Autoscaler genellikle GPU düğümleri için 90-120 saniye alır).`NodePool`kısıtlama  eğer kapsülünüz 8 H100'e ihtiyaç duyar ve kümenin eşleşen düğmesi yoksa, Karpenter mevcut bir grubu ölçeklendirmek yerine doğrudan birini sağlar.

**The consolidation trap**Karpenter'ın varsayımsızlığı.`consolidationPolicy: WhenEmptyOrUnderutilized`GPU havuzları için tehlikeli. GPU düğümünü çalıştırarak kapsülleri daha ucuz ve doğru boyutlu bir örnekle aktarır.

GPU havuzları için güvenli ayar:

```yaml
disruption:
  consolidationPolicy: WhenEmpty
  consolidateAfter: 1h
```

Karpenter'ın bir saat sonra boş düğümleri birleştirmesine izin verir ama çalışan bir işi asla boşaltmaz.

### Katman 2  çete programlaması (KAI programlayıcı)

KAI Scheduler (sonradan "Karp" projesi olarak adlandırılan) varsayılan kube-scheduler'ın yapmadığı şeyleri ele alır:

**Gang scheduling**Bu programın tümü veya hiçü programlanmıştır. 8 GPU'yı gerektiren dağıtılmış bir sonuçlama kapsülü ya 8 GPU'sı birlikte başlar ya da hiçbiri olmaz.

**Topology awareness** hangi GPU'ların NVLink'i paylaştığını, aynı rafta oturan ve aralarında InfiniBand bulunanlarını bil.

**Hierarchical queues** birden fazla ekip öncelik ve kvota ile aynı GPU havuzuna rekabet eder. A Takımı'nın üretim sıkıntısı, B Takımı'nın eğitim işiyle yalnızca öncelik kuralları izin verdiği takdirde ön plana geçiyor.

KAI kube-scheduler ile birlikte ikinci bir programlayıcı olarak kullanılır; kullanmak için iş yüklerini not ediyorsunuz.

### Katman 3  Uygulama düzeyinde sinyaller

**The HPA trap**- Evet .`DCGM_FI_DEV_GPU_UTIL`Bu, GPU'nun her örnekleme aralığında çalışıp çalışmadığını ölçer. %100 kullanımı 10 eşzamanlı talep veya 100 anlamına gelebilir; GPU her iki şekilde meşguldi.

Daha da kötüsü, vLLM ve benzeri motorlar KV önbelleği belleğini önceden tahsis eder (ya da `--gpu-memory-utilization`Bir istekle bile hafıza kullanımı %90'a yakın kalır.

**2026 replacement signals**- ...

- Sır derinliği (ön doldurulmayı bekleyen talepleri sayısı).
- KV önbelleği kullanımı (blokların aktif dizilere ne kadar bölümü tahsis edilir).
- Replik P99 TTFT (SLA sinyali).
- Güç (saniye başına tüm SLO'ları karşılama talepleri).

NVIDIA Dynamo Planer ve llm-d Workload Variant Autoscaler bu sinyalleri ve ölçek kopyalarını tüketir. LLM servisinde HPA'yı tamamen değiştirirler.

### Ne zaman kullanılır

| Scale decision | Tool |
|----------------|------|
| Add/remove nodes | Karpenter |
| Schedule multi-GPU jobs | KAI Scheduler |
| Add/remove replicas | Dynamo Planner / llm-d WVA (or custom HPA on queue depth) |
| Choose GPU type | Karpenter NodePool |
| Preempt low-priority | KAI Scheduler queues |

### Ayrıntılı prefill/decode her şeyi karmaşıklaştırır.

Ayrıntılı prefill/decode (Fase 17 · 17) çalıştırırsanız, farklı ölçeklendirme tetikleyicileri olan iki pod sınıfınız vardır: ön doldurucu pods ölçeği kuyruk derinliği üzerinde, KV önbelleği basıncı üzerinde dekode pods ölçeği üzerinde. llm-d bunları ayrı olarak ortaya çıkarır `Services`Her iki rolün önüne tek bir HPA koymaya çalışmayın.

### Soğuk başlangıç burada da önemli .

Karpenter'in 45-60 saniye ısıtması artı 20GB model yükü artı motor init, sıfırdan başlayan bir istek 2-5 dakika sürer.`min_workers=1`) SLO- kritik yollar için veya uygulama katmanında Modal tarzında kontrol işaretleme kullanın.

### Hatırlamalısın numaralar

- Karpenter düğümleri: ~ 45-60s vs. Cluster Autoscaler ~ 90-120s (GPU düğümleri).
- KAI Scheduler, kısmi tahsis atıklarının  7/8 tuzağından kaçınmasını sağlar.
- `DCGM_FI_DEV_GPU_UTIL`HPA sinyali olarak: kırılmış; kuyruk derinliği veya KV kullanımı kullanın.
- Karpenter `WhenEmptyOrUnderutilized`: GPU işlerini çalıştırmayı bitirir.`WhenEmpty + consolidateAfter: 1h`- Bu sonuca varmak için.

```figure
autoscaling
```

## Kullan

`code/main.py`Üç katmanlı bir oto-skalatörü patlayan bir GPU iş yükü üzerinde simüle eder. Saf HPA ( görev döngüsü), kuyruk derinliği HPA ve KAI-gaş programlı ölçeklemeyi karşılaştırır.

## Gönder

Bu ders bize çok yararlı .`outputs/skill-gpu-autoscaler-plan.md`. Kluster topolojisi, iş yükü şekli ve SLO göz önüne alındığında, üç katlı bir otomatik ölçekleme planı tasarlıyor.

## Egzersizler

1. Çık .`code/main.py`Bir iş yükü altında, saf görev döngüsü HPA kaç kere alıyor?
2. H100 SXM5'te Llama 3.3 70B FP8 hizmet veren bir klaster için Karpenter NodePool tasarlayın.`capacity-type`- Evet .`disruption.consolidationPolicy`- Evet .`consolidateAfter`, ve GPU olmayan iş yüklerini bu düğümlerden uzak tutan bir leke.
3. Ekibiniz, "GPU'lar mevcut ama modül programlamıyor" diye dağıtımların beklenmekte olduğunu bildirir.
4. Otomatik ölçekli prefill pods'a bir sinyal ve dekode pods'a farklı bir sinyal seçin.
5. `WhenEmptyOrUnderutilized`24×7 üretim servisinde, günde ortalama 60 talep düşüş olayı olan P99 TTFT > 10s'de bir konsolidasyon tuzağı.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Karpenter | "the node provisioner" | Kubernetes node autoscaler; sub-minute provisioning |
| Cluster Autoscaler | "the old scaler" | Kubernetes node autoscaler predecessor; slower, group-based |
| KAI Scheduler | "the GPU scheduler" | Secondary scheduler for gang + topology + queues |
| Gang scheduling | "all or nothing" | Schedule N pods atomically or defer all of them |
| Topology awareness | "rack-aware" | Place pods based on NVLink/IB/rack placement |
| `DCGM_FI_DEV_GPU_UTIL` | "GPU utilization" | Duty-cycle metric; NOT a scaling signal for LLMs |
| Queue depth | "waiting requests" | Correct HPA signal for prefill-bound scaling |
| KV cache utilization | "memory pressure" | Correct HPA signal for decode-bound scaling |
| Consolidation | "Karpenter consolidation" | Node termination to cheaper instance type |
| `WhenEmpty + 1h` | "safe consolidation" | Policy that doesn't evict running GPU jobs |

## Daha Fazla Okumak

- [KAI Scheduler GitHub](https://github.com/kai-scheduler/KAI-Scheduler) tasarım belgeleri ve yapılandırma örnekleri.
- [Karpenter Disruption Controls](https://karpenter.sh/docs/concepts/disruption/) konsolidasyon politikası semantikası ve GPU güvenli standardlar.
- [NVIDIA — Disaggregated LLM Inference on Kubernetes](https://developer.nvidia.com/blog/deploying-disaggregated-llm-inference-workloads-on-kubernetes/)Dinamo Planer'ın sinyalleri.
- [Ray docs — KAI Scheduler for RayClusters](https://docs.ray.io/en/latest/cluster/kubernetes/k8s-ecosystem/kai-scheduler.html) Çığlık entegrasyon modeli.
- [AWS EKS Compute and Autoscaling Best Practices](https://docs.aws.amazon.com/eks/latest/best-practices/aiml-compute.html) yönetilen-Kubernetes-sözlü rehberlik.
- [llm-d GitHub](https://github.com/llm-d/llm-d) İş yükü Variant Autoscaler tasarımı.
