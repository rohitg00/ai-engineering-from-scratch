# Yük Testi Yüksek Lisans API'leri — Neden k6 ve Locust Lie

> Geleneksel yük test cihazları akış yanıtları, değişken çıkış uzunlukları, token düzeyindeki ölçümler veya GPU doygunluğu için tasarlanmamıştır. İki tuzak çoğu takımı ısırır. GIL tuzağı: Locust'un token düzeyi ölçümü, yoğun eşzamanlılık altında istek oluşturmayla rekabet eden Python GIL altında tokenization'ı çalıştırır; tokenizasyon biriktirme listesi daha sonra bildirilen token arası gecikmeyi artırır; darboğaz sunucu değil, istemcinizdir. prompt-tekdüzelik tuzağı: bir döngüdeki özdeş prompt'ler, token dağılımındaki bir noktayı test eder; gerçek trafiğin değişken uzunluğu ve çeşitli önek eşleşmeleri vardır. LLPerf bunu `--mean-input-tokens` + `--stddev-input-tokens` ile düzeltir. 2026'da araç haritalama: token seviyesinde doğruluk için LLM'de uzmanlaşmış (GenAI-Perf, LLMPerf, LLM-Locust,guidellm); **k6 v2026.1.0** + **k6 Operator 1.0 GA (Eylül 2025)** — akış uyumlu, TestRun/PrivateLoadZone CRD'ler aracılığıyla Kubernetes'te yerel olarak dağıtılır, CI/CD geçitleri için en iyisi; Go için Vegeta sabit oranlı doygunluk; Locust 2.43.3 yalnızca akış için LLM-Locust uzantısıyla birlikte. Yükleme düzenleri: kararlı durum, rampa, ani artış (otomatik ölçeklendirme testi), ıslatma (bellek sızıntıları).

**Tür:** Yapım
**Diller:** Python (stdlib, oyuncak gerçekçi-prompt oluşturucu + gecikme toplayıcı)
**Önkoşullar:** Aşama 17 · 08 (Inference Metrikleri), Aşama 17 · 03 (GPU Otomatik Ölçeklendirme)
**Süre:** ~75 dakika

## Öğrenme Hedefleri

- Genel yük test cihazlarının LLM API'leri için yalan söylemesine neden olan iki anti-örüntüyü (GIL tuzağı, prompt-tekdüzelik tuzağı) açıklayın.
- Belirli bir amaç için bir araç seçin: LLPerf (benchmark çalıştırması), k6 + akış uzantısı (CI kapısı), kılavuzlama (büyük ölçekli sentetik), GenAI-Perf (NVIDIA referansı).
- Dört yük modeli (sabit, rampa, ani yükselme, ıslatma) tasarlayın ve her birinin yakaladığı arıza modunu adlandırın.
- Sabit uzunluk yerine token girişlerinin ortalama + stddev'ini kullanarak gerçekçi bir prompt dağılımı oluşturun.

## Sorun

LLM uç noktanızı 500 eşzamanlı kullanıcı üzerinde k6-test ettiniz. Tuttu. Sen gönderdin. Üretimde 200 gerçek kullanıcıyla hizmet başarısız oldu; P99 TTFT patladı, GPU'lar sabitlendi.

İki şey oldu. İlk olarak, k6 500 özdeş prompt gönderdi; istek birleştirme ve önek önbelleğe alma işleminiz, aslında bir tanesini işlerken 500 eşzamanlı kod çözme işlemi yapıyormuşsunuz gibi görünmesini sağladı. İkincisi, k6, akış yanıtlarındaki token arası gecikmeyi gözün deneyimlediği şekilde izlemiyor; değişen aralıklarla gelen 500 token yerine tek bir HTTP bağlantısı görüyor.

LLM'ler için yük testi kendi disiplinidir.

## Konsept

### GIL tuzağı (Locust)

Locust, Python'u kullanıyor ve tokenization istemci tarafını GIL altında çalıştırıyor. Yüksek eşzamanlılık altında tokenizer, istek oluşturmanın arkasında sıraya girer. Bildirilen token arası gecikme, istemci tarafı tokenizasyon biriktirme listesini içerir. Sunucunun yavaş olduğunu düşünüyorsunuz; bu test koşum takımı.

Düzeltme: LLM-Locust uzantısı, tokenization'ı ayrı işlemlere taşıyor veya derlenmiş dil donanımı kullanıyor (k6, tokenizers.rs kullanan LLPerf).

### prompt tekdüzelik tuzağı

Bilinen tüm yük test cihazları bir prompt yapılandırmanıza izin verir. 10.000 yinelemeden oluşan bir döngü testinde, her seferinde tam olarak aynı prompt gönderilir. Sunucu her seferinde aynı öneki görüyor; önek önbellek isabetleri %100'e yaklaşıyor, verim harika görünüyor.

Düzeltme: prompt dağıtımından örnek. LLPerf, `--mean-input-tokens 500 --stddev-input-tokens 150`'yi kullanır - çeşitli uzunluklar, çeşitli içerikler.

### Dört yükleme düzeni

1. **Kararlı durum** — 30-60 dakika boyunca sabit RPS. Yakalamalar: temel performans regresyonları.
2. **Rampa** — 15 dakika boyunca RPS'yi 0'dan hedefe doğrusal olarak artırın. Yakalananlar: kapasite kırılma noktası, ısınma anormallikleri.
3. **Spike** — 2 dakika boyunca ani 3-10x RPS, sonra tekrar geri. Yakalananlar: otomatik ölçeklendirme gecikmesi, sıra doygunluğu, soğuk başlatma etkisi.
4. **Islatma** — 4-8 saat boyunca kararlı durum. Yakalananlar: bellek sızıntıları, bağlantı havuzu kayması, observability taşması.

### 2026 araç eşleme

**LLMPerf** (Anyscale) — Python ancak Rust destekli tokenization. Ortalama/stddev prompt'ler. Akış uyumlu. Performans çalıştırmaları için en iyi varsayılan.

**NVIDIA GenAI-Perf** — NVIDIA'nın referansı. Triton istemcisini kullanır; kapsamlı metrik kapsamı. ITL'nin TTFT'yi hariç tuttuğunu unutmayın; LLMPerf bunu içerir. İki araç aynı sunucu için farklı TPOT üretir.

**LLM-Locust** (TrueFoundry) — GIL tuzağını düzelten Locust uzantısı. Tanıdık Locust DSL + akış ölçümleri.

**guidellm** — büyük ölçekli sentetik benchmarking.

**k6 v2026.1.0** + **k6 Operatör 1.0 GA (Eylül 2025)**:
- k6'nın kendisi (Go, derlenmiş, GIL yok) akışa duyarlı ölçümler ekledi.
- k6 Operatörü, Kubernetes yerel dağıtılmış testler için TestRun / PrivateLoadZone CRD'lerini kullanır.
- CI/CD geçitleri ve SLA testleri için en iyisi.

**Vegeta** — Git, k6'dan daha basittir. Sabit oranlı HTTP doygunluğu. LLM uyumlu değil ancak ağ geçidi / hız sınırı testi için iyi.

**Locust 2.43.3 hisse senedi** — Yüksek Lisans için GIL tuzağına sahiptir. Yalnızca LLM-Locust uzantısıyla.

CI'da ### SLA kapısı

PR'de k6'yı şununla çalıştırın:

- Temel RPS'de her biri 30-50 yineleme.
- Kapı: P50/P95 TTFT, 5xx < %5, TPOT eşiğin altında.
- İhlal üzerine yapıyı bozun.

### Gerçekçi prompt dağıtımı

Gerçek trafik örneklerinden (varsa) veya yayınlanmış dağıtımlardan (e.g., sohbet için ShareGPT prompt'ler, kod için HumanEval) oluşturun. Ortalama + stddev'i LLMPerf'e besleyin. Ne pahasına olursa olsun bir-prompt ile döngüden kaçının.

### Hatırlamanız gereken sayılar

- k6 Operatör 1.0 GA: Eylül 2025.
- k6 v2026.1.0: akışa duyarlı ölçümler.
- Tipik LLPerf çalıştırması: X eşzamanlılığında 100-1000 istek.
- Tipik CI kapısı: PR başına 30-50 yineleme.
- Dört model: sabit, rampa, yükselme, ıslatma.

## Kullan onu

`code/main.py`, gerçekçi prompt dağılımıyla bir yük testini simüle eder, etkili TPOT'u ölçer ve tek tip prompt tuzağını gösterir.

## Gönderin

Bu ders `outputs/skill-load-test-plan.md`'yi üretir. Verilen iş yükü ve SLA, aracı seçer ve dört yük modelini tasarlar.

## Egzersizler

1. `code/main.py`'yi çalıştırın. Tek tip ve gerçekçi dağılımı karşılaştırın; fark nerede?
2. Bir CI geçidi için k6 komut dosyasını yazın: TTFT P95 < 800 ms, 100 eşzamanlı, çalışma süresi 5 dakika.
3. Islatma testiniz belleğin saatte 50 MB büyüdüğünü gösteriyor. Üç nedeni ve aralarında seçim yapabileceğiniz araçları belirtin.
4. 10 RPS'den 100 RPS'ye yükselme testi. Karpenter + vLLM üretim yığını mevcutsa beklenen iyileşme süresi nedir (Aşama 17 · 03 + 18)?
5. GenAI-Perf, TPOT=6 ms'yi bildirir; LLPerf aynı sunucuda TPOT=11ms rapor ediyor. Açıklamak.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|----------------|------------------------|
| LLMPraf | "LLM koşum takımı" | Her ölçekte benchmark aracı, akış uyumlu |
| GenAI-Perf | "NVIDIA aracı" | NVIDIA referans koşum takımı |
| Yüksek Lisans-Locust | "LLM'ler için Keçiboynuzu" | Keçiboynuzu uzatma sabitleme GIL tuzağı |
| kılavuz | "sentetik benchmark" | Büyük ölçekli sentetik alet |
| k6 Operatörü | "K8s k6" | CRD tabanlı dağıtılmış k6 |
| GIL tuzağı | "Python istemci yükü" | Tokenizasyon biriktirme listesi bildirilen gecikmeyi artırıyor |
| Prompt-tekdüzelik tuzağı | "tek-prompt yalan" | Aynı prompt ile döngü önbelleği vuruyor, verimi artırıyor |
| Kararlı durum | "sabit yük" | N dakika boyunca düz RPS |
| Rampa | "doğrusal yukarı" | Süre boyunca hedeflemek için 0 |
| Başak | "patlama testi" | Ani çarpan sonra geri dön |
| Islatma | "uzun test" | Sızıntı tespit saatleri |

## Daha Fazla Okuma

- [TianPan — Yük Testi Yüksek Lisans Uygulamaları](https://tianpan.co/blog/2026-03-19-load-testing-llm-applications)
- [PremAI — Yük Testi Yüksek Lisans Dereceleri 2026](https://blog.premai.io/load-testing-llms-tools-metrics-realistic-traffic-simulation-2026/)
- [NVIDIA NIM — Yüksek Lisans Inference Benchmarking'e Giriş](https://docs.nvidia.com/nim/large-language-models/1.0.0/benchmarking.html)
- [TrueFoundry — Yüksek Lisans-Locust](https://www.truefoundry.com/blog/llm-locust-a-tool-for-benchmarking-llm-performance)
- [LLMPerf](https://github.com/ray-project/llmperf)
- [k6 Operatörü](https://github.com/grafana/k6-operator)
