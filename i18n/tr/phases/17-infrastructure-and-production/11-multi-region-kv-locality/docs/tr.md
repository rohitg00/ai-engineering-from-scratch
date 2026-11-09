# Çok Bölgelik LLM Hizmet ve KV Kayıt Yerleşimi

> Round-robin yük dengeleme, önbelleğe alınmış LLM sonuçları için aktif olarak zararlıdır. Önceden belirtilmiş düğmeye yerleşmeyen bir istek, uzun bir istekle, önbellekle ~80 ms karşılaştırıldığında P50'de yaklaşık 800 ms'lik tam önceden doldurma maliyetini öder. 2026 yılında üretim modeli, KV-cache olaylarını ve prefix-hash eşleşmesi üzerinde rotaları tüketen bir önbelleğe farkındalıklı yönlendirici (vLLM Router in Rust, llm-d yönlendirici) olacaktır. Son araştırmalar (GORGO) yönlendirme hedefi için bölge çapındaki ağ gecikmesini açık bir terim haline getirmiştir. Ticari "bölge çapındaki sonuçlandırma" teklifleri (Bedrock bölge çapındaki sonuçlandırma, GKE çoklu küme geçitleri) sonuçlandırmayı net olmayan bir şekilde değerlendirir  TTFT değil, mevcutluğu ele alırlar. JPMorgan ve Mayo Klinik'i, Kasım 2024'te yaklaşık 22 dakika boyunca, bizim doğu 1'ün başarısızlığını gerçekleştirdi. DR gerçekliği: LLM DR başarısızlıklarının %32'si takımların ağırlıkları yedeklediği ama tokenizer dosyalarını veya kuantitasyon yapılandırmalarını unuttuğu için.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, toy prefix-cache-aware router simulator)
**Prerequisites:** Phase 17 · 04 (vLLM Serving), Phase 17 · 06 (SGLang RadixAttention)
**Time:** ~60 minutes

## Öğrenme Hedefleri

- Dört-robin yük dengeleme kırıklıklarının neden önbelleğe alınmış olduğunu ve TTFT cezasını ölçdüğünü açıklayın.
- Kaş-ağır yönlendiriciyi çiz: girişler (KV-cache olayları), algoritma (prefix-hash eşleşimi), bağlayıcı (GPU kullanımı).
- LLM'ler için %32 DR başarısızlık sürücüsünü (kaybolan tokenizer dosyaları / kuantitasyon yapılandırmaları) isimlendirin ve üç dosya DR kontrol listesini belirtin.
- Ticari bölge çapındaki sunuları (Bedrock CRI, GKE Multi-Cluster Gateway) KV-a karşı yönlendirme ile ayırt edin.

## Sorun

Hizmetiniz US-East-1, US-West-2 ve EU-West-1'de çalışmaktadır. Önüne bir ALB koyup, bir round-robin yapıyorsunuz.

Round-robin, devletsiz hizmetler için optimaldir. LLM sonucu tasarımı ile devletli  KV önbelleği modelin gördüğü her şeyi kodlar. Routing blind yanlış önbelleğe yönlendiriyor.

Özellikle, ekibiniz bir DR planı var. S3 bölgesel boyutlarına model ağırlıklarını yedekledin. Bölgesel kesintisi vurulur; başarısızlığa giriyorsunuz; replik başlatmayı reddediyor. Tokenizer.json, kuantitasyon yapılandırması ve RoPE ölçekleme yapılandırması senkronizasyon yapmadığınız ayrı bir kova içindeydi.

Çoklu bölge LLM servisleri bir önbelleğe, bir yönlendirme sorunu ve DR-higiyen sorunu  yük dengeleme sorunu değil.

## Anlaşım

### Önbelleğe bağlı yönlendirme

İstek bir istekle gelir. Router öntanımlıyı (örneğin ilk 512 jetonu) hash eder; her replikadan "bu öntanımlıyı önbelleğe kaydetmiş misiniz?" sorar. Replikler blokları tahsis ederken ve çıkarırken bir pub / alt kanalda KV-cache olaylarını yayınlar. Router replikayı eşleşme ile seçer, kimse yapmazsa GPU-util tabanlı bir bağ kırıcıya düşer.

**vLLM Router**(Rust, 2026 üretim aşaması):`kv.cache.block_added`Events, prefix-hash → replika indeksini sürdürür,  ile yollar$O(1)$- Hiç eşleşmediğinde en az sırada kalır.

**llm-d router**: aynı desen, Kubernetes-dev. ControlPlane API üzerinden etkinlikleri yayınlar.

**SGLang RadixAttention**(Fase 17 · 06) içe benzerliktir.

### Sayılar

TTFT P50 2K-token sorgulamasında, Llama 3.3 70B FP8, H100:
- Önbelleğe ulaşma (aynı kopya, önbellek sakin): ~80 ms.
- Kayıt kaybı (soğuk önceden doldurma): ~ 800 ms.

10x boşluk. Eğer yönlendiriciniz replikler arasında prefix cache'nin %60-80'ini vurursa, N-replik kapasitesinde tek replik performansını tahmini edersiniz. Eğer %10'u vurursa, saf bir ölçeklendirme yaparsınız.

### Bölge çapında yeni bir kısıtlama var  Ağ gecikmesi

Bölgelerarası RTT:
- US-East-1  US-West-2: ~65 ms.
- US-East-1  eu-West-1: ~ 75 ms.
- US-East-1  ap-southeast-1: ~ 220 ms.

Eğer yönlendirme bir istek için US-East-1'den bir sıcak öncü olarak ap-southeast-1'e götürürse, kaydedilen ön doldurma (800 → 80 ms, bu nedenle 720 ms) ~ 220 ms RTT ödedikten sonra yaklaşık 500 ms'e kadar küçülür ve uzak bölge istek için kuyruklar çizerse veya öncüyi zaten çıkarırsa kenarlık ortadan kaybolur. GORGO (2026 araştırması) bunu açıkça  en aza indirir.`prefill_time + network_latency`Genellikle cevap, prefill'in üstün olduğu büyük çok MB önleme dışında bölgesel yönlendirmeyi sürdürmektir.

### Ticari "bölge çapındaki sonuçlar" burada yardımcı olmaz

AWS Bedrock bölgesel kesinti, kapasitede basınç sırasında diğer bölgelere gelen istekleri otomatik olarak yönlendirir. TTFT değil, kullanılabilirliği optimize eder ve kesintiyi açık olmayan bir şekilde ele alır. GKE Multi-Cluster Gateway aynı  hizmet düzeyinde başarısızlık, KV önbelleği farkında değildir.

Bu cihazları kullanırken bile bir uygulama katmanının önbelleğe hazırlanmış bir yönlendirmeye ihtiyacınız var. "US-East-1 yanıyor" durumunu ele alırlar.

### DR hijyen  %32'lik eksik dosya sorunu

Çok sayıda alıntılanan 2026 statüsü: LLM DR başarısızlıklarının %32'si takımların ağırlıkları yedeklediği ama unuttuğu için gerçekleşir:

- `tokenizer.json`veya `tokenizer.model`
- Kvantitasyon yapılandırmaları (`quantize_config.json`, AWQ ölçekleri, GPTQ sıfır noktaları)
- Model-specifik yapılandırmalar (RoPE ölçeklendirme, dikkat maskeleri, sohbet şablonları)
- Motoru yapılandırma (`vllm_config.yaml`, örnekleme öntanımlıları, LoRA adaptör manifestoları)

Düzeltme üç dosya minimum DR manifesti:

1. HF model repo (bozukluk + yapılandırma + tokenizer) altında bulunan tüm dosyalar.
2. Motor özel servis yapılandırması.
3. Deployment manifesti (K8s YAML, Dockerfile, bağımlılık kilitli).

Ayrıca, JPMorgan'ın US-East 1 hareketi, sadece oyun kitabı prova edildiği için Kasım 2024'te 22 dakika geri kazanmış.

### Veriler ortogonal olarak yerleşik

AB müşteri PHI AB'yi terk edemez. Eğer önbellek bağlantısı için Paris'ten gelen bir istek gönderirseniz, TTFT kazançına bakmaksızın GDPR'yi ihlal etmiş olursunuz.

### Hatırlamalısın numaralar

- Kaş çarpması vs. kaçırılan TTFT boşluğu: ~ 10x (80 ms vs 800 ms 2K prompt üzerinde).
- Bölgelerarası RTT ABD-AB: ~75 ms.
- DR başarısızlığı: %32'si tokenizer/quant yapılandırmalarını kaçırıyor.
- JPMorgan us-east-1 başarısızlığı Kasım 2024: 22 dakika (30 dakika SLA).

```figure
cache-aware-router
```

## Kullan

`code/main.py`bir çok bölge iş yükünde üç yönlendirme stratejisini (dolap robin, cache-ağır bölgesel, cache-ağır küresel) simüle eder.

## Gönder

Bu ders bize çok yararlı .`outputs/skill-multi-region-router.md`Bölgeler, ikamet kısıtlamaları ve SLA göz önüne alındığında, bir yol planı tasarlar.

## Egzersizler

1. Çık .`code/main.py`75 ms RTT'ye göre, bölge arası yönlendirme sadece yerel yönlendirmeyi ne kadar hızlı bir şekilde geçirir?
2. Önbellek trafiğin %70'den %12'e düştü.
3. VLLM'de hizmet veren 70B AWQ-quantized model için 5 LoRA adaptörü ile DR manifesti tasarlayın.
4. Bedrock bölgesel kesinti sonucu, sıkı TTFT SLOs ile bir fintech için "yeter" olup olmadığını tartışın.
5. Paris'ten gelen bir talebimiz, Doğu 1'deki bir önbellekle eşleşir.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Cache-aware routing | "smart LB" | Route on prefix-hash match to KV-cache-holding replica |
| KV-cache events | "cache pub-sub" | Replicas publish block add/evict; router indexes |
| Prefix hash | "cache key" | Hash of first N tokens used as router lookup |
| GORGO | "cross-region routing research" | arXiv 2602.11688; network latency as explicit term |
| Cross-region inference | "Bedrock CRI" | AWS product; availability failover, not TTFT awareness |
| DR manifest | "the backup list" | Every file needed to restore — not just weights |
| Data residency | "GDPR boundary" | Legal constraint on which region sees user data |
| RTT | "round-trip time" | Network latency; 75 ms US-EU, 220 ms US-APAC |
| LLM-aware LB | "cache-hit LB" | Cache-aware router as a product category |

## Daha Fazla Okumak

- [BentoML — Multi-cloud and cross-region inference](https://bentoml.com/llm/infrastructure-and-operations/multi-cloud-and-cross-region-inference)
- [arXiv — GORGO (2602.11688)](https://arxiv.org/html/2602.11688v1) Ağ gecikme süreci ile bölge çapındaki KV-cache yeniden kullanımı.
- [TianPan — Multi-Region LLM Serving Cache Locality](https://tianpan.co/blog/2026-04-17-multi-region-llm-serving-data-residency-routing)
- [AWS Bedrock Cross-Region Inference](https://docs.aws.amazon.com/bedrock/latest/userguide/cross-region-inference.html) Dosyaların kullanılabilirliği.
- [vLLM Production Stack Router](https://github.com/vllm-project/production-stack) Kaş-bilinen yönlendirme kaynağı.
