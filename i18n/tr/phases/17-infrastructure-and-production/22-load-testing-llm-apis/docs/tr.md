# Yük Testleme LLM API'leri  Neden k6 ve çekirge yalan söylüyor

> Geleneksel yük denetleyicileri akış cevapları, değişken çıkış uzunlukları, token seviyesindeki ölçümler veya GPU doymuşluğu için tasarlanmamıştır. İki tuzak çoğu takımı ısırıyor. GIL tuzağı: Locust'in token seviyesindeki ölçümü Python GIL altında tokenizeyi yürütür, bu da ağır eşzamanlılık altında talep üretimi ile rekabet eder; tokenize geri kalanı daha sonra bildirilen tokenler arası gecikmeyi  müşteriniz şişek boynusu, sunucu değil. Çevre-birliği tuzağı: bir döngüde aynı çevreler, jeton dağılımında bir noktayı test eder; gerçek trafiğin değişken uzunluğu ve çeşitli ön işaret eşleşmeleri vardır. LLMPerf bunu düzeltiyor .`--mean-input-tokens`+ `--stddev-input-tokens`. 2026 yılında araç haritası: Token düzeyinde doğruluk için LLM uzmanlığı (GenAI-Perf, LLMPerf, LLM-Locust, guidellm);**k6 v2026.1.0**+ **k6 Operator 1.0 GA (Sept 2025)** Akıştan haberdar, TestRun/PrivateLoadZone CRD'ler üzerinden dağıtılan Kubernetes-native, CI/CD kapıları için en iyisi; Vegeta for Go sabit oranlı beslenme; Akış için sadece LLM-Locust uzantısı ile 2.43.3.

**Type:** Build
**Languages:** Python, TypeScript (stdlib, toy realistic-prompt generator + latency collector)
**Prerequisites:** Phase 17 · 08 (Inference Metrics), Phase 17 · 03 (GPU Autoscaling)
**Time:** ~75 minutes

## Öğrenme Hedefleri

- Genel yük denetçilerinin LLM API'ler için yalan söylemesini sağlayan iki anti-önemli (GIL tuzağı, prompt-uniformity tuzağı) açıklayın.
- Verilmiş bir amaç için bir araç seçin: LLMPerf (benchmark çalıştırma), k6 + akış uzatma (CI kapısı), guidellm (büyük ölçekli sentetik), GenAI-Perf (NVIDIA referansı).
- Dört yük örneğini (sağlam, ramp, spike, soak) tasarlayın ve her bir yakalama başarısızlık modunun adını verin.
- Yerleşik uzunluk yerine girme jetonlarının ortalama + stddev kullanılarak gerçekçi bir çabuk dağıtım oluşturun.

## Sorun

LLM son noktını 500 aynı anda kullanıcı ile test ettin. 500 aynı anda kullanıcı ile test ettin.

İki şey oldu. Birincisi, k6 500 aynı istek gönderdi.  istek toplama ve önbellek önbelleği önbelleğin aslında bir taneyle uğraşırken 500 eşzamanlı dekod kullanıyormuş gibi görünmesini sağladı. İkincisi, k6 akış tepkilerindeki tokenler arasındaki gecikmeyi izlemiyor. Gözün deneyimlediği şekilde; bir HTTP bağlantısını görür, değişik aralıklarla gelen 500 tokeni değil.

LLM'ler için yük testi kendi disiplinidir.

## Anlaşım

### GIL Tuzakı (Locust)

Locust Python'u kullanır ve GIL altında tokenizasyon istemcisini çalıştırabilir. Yüksek eşzamanlılık altında, talepleri oluşturmak arkasındaki tokenizer kuyrukları. Raporlanan inter-token gecikmesi, istemci tarafındaki tokenizasyon arka planını içerir. Sunucu yavaş olduğunu düşünüyorsunuz; test harnesidir.

Düzeltme: LLM-Locust uzantısı, tokenizasyonu ayrı süreçlere taşıyor veya bir kompile dili harness kullanıyor (k6, tokenizers.rs kullanarak LLMPerf).

### Hızlı bir uyum tuzağı

Tüm bilinen yük denetleyicileri bir istek ayarı yapılandırmanıza izin verir. 10.000 tekrarlı bir döngü testinde her seferinde aynı istek gönderir. Sunucu her  ön ön önbellek kaş'ı vurduğunda aynı önbellek görür. %100'e yaklaşırken, geçiş mükemmel görünüyor.

Düzeltme: hızlı bir dağıtımdan alınan örnek.`--mean-input-tokens 500 --stddev-input-tokens 150` Çeşitli uzunluklar, çeşitli içerikler.

### Dört yük örneği

1. **Steady-state** 30-60 dakika boyunca sabit RPS. Yakalamalar: başlangıç performans gerilemeleri.
2. **Ramp** RPS'yi 15 dakikadan fazla sürede 0'dan hedefe linear olarak artırmak.
3. **Spike**2 dakika sonra 2-10 kat süren süren süren süren.
4. **Soak**4-8 saat boyunca sabit durum. Yakalamalar: hafıza sızıntıları, bağlantı havuzunun sürüşü, gözlemlenebilirlik aşırılığı.

### 2026 Araç haritası

**LLMPerf**(Anyscale) Python ama Rust desteklenen tokenizasyon. Ortalama / stddev istekleri. Akıştan haberdar. Performans çalışmalar için en iyi varsayılan.

**NVIDIA GenAI-Perf** NVIDIA'nın referansı. Triton istemcisini kullanır; kapsamlı metrik kapsam. Not ITL TTFT hariç; LLMPerf'in içerdiğini unutmayın.

**LLM-Locust**GIL tuzağını düzelten çekirgeler uzantısı.

**guidellm** Büyük ölçekli sentetik referans değerlendirme.

**k6 v2026.1.0**+ **k6 Operator 1.0 GA (Sept 2025)**- ...
- k6 kendisi (Go, oluşturulmuş, GIL yok) akıştan haberdar metrikler ekledi.
- k6 Operator, Kubernetes- doğuştan dağıtılmış testler için TestRun / PrivateLoadZone CRD'leri kullanır.
- CI/CD kapıları ve SLA testleri için en iyisi.

**Vegeta** Git, k6'dan daha basit. Sürekli HTTP doymuşluğu. LLM bilgili değil ama geçit / hız sınırı testleri için iyidir.

**Locust 2.43.3 stock** LLM için GIL tuzağı vardır. Sadece LLM-Locust uzantısı ile.

### SLA kapısı CI

İletişimde k6 çalıştır:

- Her biri 30-50 tekrarlar, başlangıç RPS'de.
- Kapı: P50/P95 TTFT, 5xx < 5%, TPOT eşiğinden aşağı.
- Çatışmayı boz.

### Gerçekçi bir hızlı dağıtım

Gerçek trafik örneklerinden (eğer varsa) veya yayınlanan dağıtımlardan (örneğin sohbet için ShareGPT istekleri, kod için HumanEval) oluşturun.

### Hatırlamalısın numaralar

- k6 Operatör 1.0 GA: Eylül 2025.
- K6 v2026.1.0: Akıştan haberdar olan ölçümler.
- Tipik LLMPerf çalışması: 100-1000 istek eşzamanlı X.
- Tipik CI kapısı: PR'ye 30-50 tekrarlama.
- Dört model: sabit, ramp, tırnak, ıslak.

```figure
load-pattern-waves
```

## Kullan

`code/main.py`gerçekçi bir hızlı dağıtım ile yük testi simülasyonu, etkili TPOT ölçümleri ve benzer bir hızlı tuzak gösterimi.

## Gönder

Bu ders bize çok yararlı .`outputs/skill-load-test-plan.md`İş yükü ve SLA'yı göz önünde bulundurarak, araç seçer ve dört yük örneğini tasarlar.

## Egzersizler

1. Çık .`code/main.py`-Eskilik ve gerçekçilik arasındaki dağılımları karşılaştırın.
2. CI kapısı için k6 senaryosunu yaz: TTFT P95 < 800 ms 100 eşzamanlı, 5 dakika çalıştırma süresi.
3. Sıkıştırma testi 50 MB/saat hafızayı artırdığını gösteriyor.
4. Spike test 10 RPS'den 100 RPS'e kadar. Karpenter + vLLM üretim-buçukları yerlerinde ise beklenen kurtarma süresi nedir (Fase 17 · 03 + 18)?
5. GenAI-Perf TPOT=6ms rapor ediyor. LLMPerf aynı sunucuda TPOT=11ms rapor ediyor.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| LLMPerf | "the LLM harness" | Anyscale benchmark tool, streaming-aware |
| GenAI-Perf | "NVIDIA tool" | NVIDIA reference harness |
| LLM-Locust | "Locust for LLMs" | Locust extension fixing GIL trap |
| guidellm | "synthetic benchmark" | Large-scale synthetic tool |
| k6 Operator | "K8s k6" | CRD-based distributed k6 |
| GIL trap | "Python client overhead" | Tokenization backlog inflates reported latency |
| Prompt-uniformity trap | "single-prompt lie" | Loop with same prompt hits cache, inflates throughput |
| Steady-state | "constant load" | Flat RPS for N minutes |
| Ramp | "linear up" | 0 to target over duration |
| Spike | "burst test" | Sudden multiplier then revert |
| Soak | "long test" | Hours for leak detection |

## Daha Fazla Okumak

- [TianPan — Load Testing LLM Applications](https://tianpan.co/blog/2026-03-19-load-testing-llm-applications)
- [PremAI — Load Testing LLMs 2026](https://blog.premai.io/load-testing-llms-tools-metrics-realistic-traffic-simulation-2026/)
- [NVIDIA NIM — Introduction to LLM Inference Benchmarking](https://docs.nvidia.com/nim/large-language-models/1.0.0/benchmarking.html)
- [TrueFoundry — LLM-Locust](https://www.truefoundry.com/blog/llm-locust-a-tool-for-benchmarking-llm-performance)
- [LLMPerf](https://github.com/ray-project/llmperf)
- [k6 Operator](https://github.com/grafana/k6-operator)
