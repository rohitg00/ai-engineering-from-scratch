# Çok Bölgeli Yüksek Lisans Hizmeti ve KV Önbellek Yerelliği

> Round-robin yük dengeleme, önbelleğe alınmış LLM inference için aktif olarak zararlıdır. Ön ekini tutan düğüme ulaşmayan bir istek, tam ön doldurma maliyetini öder - P50'de uzun bir prompt'de kabaca 800 ms, önbellek isabetiyle ise ~80 ms. 2026'da üretim modeli, KV-önbellek olaylarını tüketen ve önek-hash eşleşmesine göre yönlendiren, önbellek tanıyan bir yönlendiricidir (Rust'ta vLLM Yönlendirici, llm-d yönlendirici). Son araştırmalar (GORGO), bölgeler arası ağ gecikmesini yönlendirme hedefinde açık bir terim haline getiriyor. Ticari "bölgeler arası inference" teklifleri (Bedrock bölgeler arası inference, GKE çoklu küme ağ geçitleri), inference'yi opak olarak ele alır; TTFT'yi değil kullanılabilirliği yönetir. JPMorgan ve Mayo Clinic, Kasım 2024'te ~22 dakikada us-east-1 yük devretmesini gerçekleştirdi. DR gerçeği: LLM DR hatalarının %32'si, ekiplerin ağırlıkları yedeklemesinden ancak tokenizer dosyalarını veya niceleme yapılandırmalarını unutmasından kaynaklanmaktadır.

**Tür:** Öğren
**Diller:** Python (stdlib, oyuncak önek önbelleğine duyarlı yönlendirici simülatörü)
**Önkoşullar:** Aşama 17 · 04 (vLLM Hizmeti), Aşama 17 · 06 (SGLang RadixAttention)
**Süre:** ~60 dakika

## Öğrenme Hedefleri

- Round-robin yük dengeleme kesintilerinin neden inference önbelleğe alındığını açıklayın ve TTFT cezasını ölçün.
- Önbellek duyarlı bir yönlendiricinin şeması: girişler (KV-önbellek olayları), algoritma (önek-karma eşleşmesi), eşitliği bozan (GPU kullanımı).
- LLM'ler için %32 DR hatası sürücüsünü adlandırın (eksik tokenizer dosya / niceliklendirme yapılandırması) ve üç dosyalı bir DR kontrol listesi belirtin.
- Ticari bölgeler arası teklifleri (Bedrock CRI, GKE Multi-Cluster Gateway) KV uyumlu yönlendirmeden ayırın.

## Sorun

Hizmetiniz us-east-1, us-west-2 ve eu-west-1'de çalışır. Round-robin ile öne bir ALB koyarsınız. Üretimde önek önbellek isabet oranı %8'e düşer. TTFT P50 üç katına çıkar. vLLM günlükleriniz her isteğin ön doldurma maliyetinin tamamını ödediğini gösteriyor.

Round-robin durum bilgisi olmayan hizmetler için idealdir. LLM inference, tasarım gereği durum bilgilidir; KV önbelleği, modelin gördüğü her şeyi kodlar. Yönlendirme körü, yanlış önbelleğe yönlendirmedir.

Ayrıca ekibinizin bir DR planı var. Model ağırlıklarını S3 bölgelerine yedeklersiniz. Bölgesel bir kesinti yaşanıyor; yük devretmeye çalışırsınız; kopya başlamayı reddediyor. tokenizer.json, niceleme yapılandırması ve RoPE ölçeklendirme yapılandırmasının senkronize etmediğiniz ayrı bir pakette olduğunu unuttunuz.

Çok bölgeli LLM hizmeti bir önbellek sorunu, bir yönlendirme sorunu ve bir DR hijyen sorunudur; bir yük dengeleyici sorunu değildir.

## Konsept

### Önbelleğe duyarlı yönlendirme

İstek bir prompt ile gelir. Yönlendirici öneki hashler (örneğin, ilk 512 tokens); her kopyaya "bu öneki önbelleğe aldınız mı?" diye sorar. Kopyalar, blokları ayırıp çıkarırken bir pub/sub kanalında KV-önbellek olaylarını yayınlar. Yönlendirici, eşleşmeyle birlikte kopyayı seçer, eğer kimse bunu yapmazsa, GPU kullanımı tabanlı eşitliği bozucu duruma düşer.

**vLLM Yönlendirici** (Rust, 2026 üretim yığını): `kv.cache.block_added` etkinliğine abone olur, bir önek karması → kopya dizini tutar, O(1) aramasıyla yönlendirir. Eşleşme olmadığında en az kuyruk derinliğine düşer.

**llm-d yönlendirici**: aynı model, Kubernetes'te yerel. Olayları ControlPlane API aracılığıyla yayınlar.

**SGLang RadixAttention** (Phase 17 · 06) replika içi eşdeğerdir. Çapraz kopya yönlendirme kesinlikle yukarı yöndedir.

### Sayılar

2K-token prompt, Llama 3.3 70B FP8, H100'de TTFT P50:
- Önbellek isabeti (aynı kopya, yerleşik önek): ~80 ms.
- Önbellek kaçırma (soğuk ön doldurma): ~800 ms.

10x boşluk. Yönlendiriciniz kopyalar genelinde önek önbelleğinin %60-80'ine ulaşırsa, N kopya kapasitesinde tek kopya performansına yaklaşırsınız. Eğer %10'a ulaşırsa saf ölçeklendirmeye yaklaşırsınız.

### Bölgeler arası yeni bir kısıtlama var: ağ gecikmesi

Bölgeler arası RTT:
- us-doğu-1 ↔ us-batı-2: ~65 ms.
- us-east-1 ↔ eu-west-1: ~75 ms.
- us-east-1 ↔ ap-southeast-1: ~220 ms.

Yönlendirme us-east-1'den ap-southeast-1'deki sıcak bir öneke bir istek alırsa, kaydedilen ön doldurma (800 → 80 ms), 440 ms gidiş-dönüş ile gölgede kalır. GORGO (2026 araştırması) bunu açıkça ortaya koyuyor - tek başına önceden doldurmak değil, `prefill_time + network_latency` 'yi birlikte küçültün. Çoğu zaman cevap, önceden doldurmanın baskın olduğu devasa çoklu MB önekleri dışında yönlendirmeyi bölgesel tutmaktır.

### Ticari "bölgeler arası inference" burada yardımcı olmuyor

AWS Bedrock bölgeler arası inference, kapasite baskısı sırasında istekleri otomatik olarak diğer bölgelere yönlendirir. TTFT'yi değil kullanılabilirliği optimize eder ve inference'yi opak olarak değerlendirir. GKE Çoklu Küme Ağ Geçidi de aynıdır; hizmet düzeyinde yük devretme, KV önbelleği farkındalığı yoktur.

Bunları kullanırken bile yine de uygulama katmanı önbelleğe duyarlı bir yönlendiriciye ihtiyacınız var. "ABD-Doğu-1 yanıyor" davasıyla ilgileniyorlar. Önbelleğe duyarlı yönlendirme, TTFT durumunu yönetir.

### DR hijyeni — %32 eksik dosya sorunu

Yaygın olarak alıntılanan 2026 istatistiği: LLM DR başarısızlıklarının %32'si, ekiplerin ağırlıkları yedekleyip unutması nedeniyle meydana gelir:

- `tokenizer.json` veya `tokenizer.model`
- Niceleme yapılandırmaları (`quantize_config.json`, AWQ ölçekleri, GPTQ sıfır noktaları)
- Modele özel yapılandırmalar (RoPE ölçeklendirmesi, dikkat maskeleri, sohbet şablonları)
- Motor yapılandırması (`vllm_config.yaml`, örnekleme varsayılanları, LoRA adaptör bildirimleri)

Düzeltme, üç dosyalı minimum DR bildirimidir:

1. HF model deposu altındaki tüm dosyalar (ağırlıklar + yapılandırmalar + tokenizer).
2. Motora özel sunum yapılandırması.
3. Deployment bildirimi (K8s YAML, Dockerfile, bağımlılık kilidi).

Artı: Üç ayda bir DR tatbikatı yapın. JPMorgan us-east-1 tatbikatı Kasım 2024'te yalnızca taktik kitabının prova edilmesi nedeniyle 22 dakikalık iyileşmeye ulaştı.

### Veri yerleşimi diktir

AB müşterisi PHI AB'den ayrılamaz. Önbellek algılamalı yönlendiriciniz us-east-1'e önek eşleşmesi için Paris kaynaklı bir istek gönderirse, TTFT kazancından bağımsız olarak GDPR'yi ihlal etmiş olursunuz. Önbellek için optimizasyon yapmadan önce yönlendiricileri yerleşim sınırına göre bölümleyin.

### Hatırlamanız gereken sayılar

- Önbellek isabeti - kaçırılan TTFT boşluğu: ~10x (2K prompt'da 80 ms - 800 ms).
- Bölgeler arası RTT ABD-AB: ~75 ms.
- DR hatası: %32 oranında tokenizer/quant yapılandırmaları eksik.
- JPMorgan us-east-1 yük devretme Kasım 2024: 22 dakika (30 dakikalık SLA).

## Use It — Hazır Araçla Uygula

`code/main.py` , çok bölgeli bir iş yükünde üç yönlendirme stratejisini (yönlendirme, önbelleği tanıyan bölgesel, önbelleği tanıyan genel) simüle eder. Önbellek isabet oranını, TTFT P50/P99'u ve bölgeler arası faturayı raporlar.

## Ship It — Kullanıma Sun

Bu ders `outputs/skill-multi-region-router.md` üretir. Verilen bölgeler, ikamet kısıtlamaları ve SLA, bir yönlendirme planı tasarlar.

## Egzersizler

1. `code/main.py`'yı çalıştırın. 75 ms RTT göz önüne alındığında, bölgeler arası yönlendirme hangi prompt uzunlukta yalnızca yerel yönlendirmeyi yener?
2. Önbellek isabet oranınız %70'ten %12'ye düşer. Üç olası nedeni ve her birini doğrulayacak gözlemlenebilirleri teşhis edin.
3. 5 LoRA bağdaştırıcısıyla vLLM'de sunulan 70B AWQ nicemli model için bir DR bildirimi tasarlayın. Her dosyayı ve yapılandırmayı listeleyin.
4. Katı TTFT SLO'lara sahip bir fintech için Bedrock çapraz bölge inference'nin "yeterli" olup olmadığını tartışın. Belirli davranışlardan alıntı yapın.
5. Paris kökenli bir istek us-east-1 önekiyle eşleşiyor. yönlendiriyor musunuz? Politikayı yazın.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|----------------|------------------------|
| Önbelleğe duyarlı yönlendirme | "akıllı LB" | Ön ek karması eşleşmesinde KV önbellek tutma kopyasına yönlendirme |
| KV-önbellek etkinlikleri | "pub-sub'ı önbelleğe al" | Kopyalar yayınlama bloğu ekleme/çıkarma; yönlendirici dizinleri |
| Önek karması | "önbellek anahtarı" | Yönlendirici araması olarak kullanılan ilk N token'ın karması |
| GORGO | "bölgeler arası yönlendirme araştırması" | arXiv 2602.11688; açık bir terim olarak ağ gecikmesi |
| Bölgeler arası inference | "Ana kaya CRI" | AWS ürünü; TTFT farkındalığı değil, kullanılabilirlik yük devretme |
| DR bildirimi | "yedekleme listesi" | Geri yüklenmesi gereken her dosya — yalnızca ağırlıklar değil |
| Veri yerleşimi | "GDPR sınırı" | Kullanıcı verilerini hangi bölgenin göreceğine ilişkin yasal kısıtlama |
| RTT | "gidiş-dönüş süresi" | Ağ gecikmesi; 75 ms ABD-AB, 220 ms ABD-APAC |
| Yüksek Lisans uyumlu LB | "önbellek vuruşu LB" | Ürün kategorisi olarak önbelleğe duyarlı yönlendirici |

## Daha Fazla Okuma

- [BentoML — Çoklu bulut ve bölgeler arası inference](https://bentoml.com/llm/infrastructure-and-operations/multi-cloud-and-cross-region-inference)
- [arXiv — GORGO (2602.11688)](https://arxiv.org/html/2602.11688v1) — ağ gecikme süresiyle bölgeler arası KV önbelleğinin yeniden kullanımı.
- [TianPan — Çok Bölgeli LLM Hizmet Önbelleği Yerelliği](https://tianpan.co/blog/2026-04-17-multi-region-llm-serving-data-residency-routing)
- [AWS Bedrock Cross-Region Inference](https://docs.aws.amazon.com/bedrock/latest/userguide/cross-region-inference.html) — kullanılabilirlik yük devretme belgeleri.
- [vLLM Üretim Yığını Yönlendiricisi](https://github.com/vllm-project/production-stack) — önbelleğe duyarlı yönlendirici kaynağı.
